import { randomBytes } from "node:crypto";

import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDb, type Db } from "./client";
import { loadLocalEnv } from "./local-env";
import { isLocalDatabaseUrl, SAM_USER_ID, seedSam } from "./seed";

const V1_TABLES = [
  "captures",
  "change_log",
  "harness_run_payloads",
  "harness_runs",
  "observations",
  "profiles",
  "proposal_items",
  "schedule_blocks",
  "tasks",
];

loadLocalEnv();
const adminUrl = process.env.TEST_DATABASE_URL ?? process.env.POSTGRES_URL_NON_POOLING ?? "";
const dbName = `lts_test_${randomBytes(4).toString("hex")}`;

let admin: postgres.Sql;
let db: Db;
let sql: postgres.Sql;

const rollback = Symbol("rollback");

/** Runs `fn` in a transaction that is always rolled back. */
async function inRollback(fn: (tx: postgres.TransactionSql) => Promise<void>): Promise<void> {
  await sql
    .begin(async (tx) => {
      await fn(tx);
      throw rollback;
    })
    .catch((error: unknown) => {
      if (error !== rollback) throw error;
    });
}

async function migrateFresh() {
  await migrate(db, {
    migrationsFolder: "db/migrations",
    migrationsTable: "__drizzle_migrations",
    migrationsSchema: "drizzle",
  });
}

beforeAll(async () => {
  if (!isLocalDatabaseUrl(adminUrl)) {
    throw new Error(
      "DB tests need a local Postgres: set POSTGRES_URL_NON_POOLING (or TEST_DATABASE_URL) to a " +
        "localhost URL, e.g. after `supabase start`.",
    );
  }
  admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${dbName}`);
  const url = new URL(adminUrl);
  url.pathname = `/${dbName}`;
  db = createDb(url.toString());
  sql = db.$client;
  await migrateFresh();
});

afterAll(async () => {
  await sql?.end();
  await admin?.unsafe(`drop database if exists ${dbName} with (force)`);
  await admin?.end();
});

describe("0000_init on an empty database", () => {
  it("creates exactly the v1 tables", async () => {
    const rows = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`;
    expect(rows.map((r) => r.table_name)).toEqual(V1_TABLES);
  });

  it("gives every table a non-null user_id and created_at", async () => {
    const rows = await sql<{ table_name: string; column_name: string; is_nullable: string }[]>`
      select table_name, column_name, is_nullable from information_schema.columns
      where table_schema = 'public' and column_name in ('user_id', 'created_at')`;
    for (const table of V1_TABLES) {
      const cols = rows.filter((r) => r.table_name === table);
      expect(cols.map((c) => c.column_name).sort(), table).toEqual(["created_at", "user_id"]);
      expect(
        cols.every((c) => c.is_nullable === "NO"),
        table,
      ).toBe(true);
    }
  });

  it("enables RLS on every table and defines no policies", async () => {
    const rls = await sql<{ relname: string; relrowsecurity: boolean }[]>`
      select c.relname, c.relrowsecurity from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'`;
    expect(rls).toHaveLength(V1_TABLES.length);
    expect(rls.filter((r) => !r.relrowsecurity)).toEqual([]);

    const policies = await sql`select policyname from pg_policies where schemaname = 'public'`;
    expect(policies).toEqual([]);
  });

  it("is a no-op when applied again", async () => {
    await migrateFresh();
    const [{ count }] = await sql<{ count: number }[]>`
      select count(*)::int from drizzle.__drizzle_migrations`;
    expect(count).toBe(1);
  });
});

describe("seed", () => {
  it("creates Sam's week and is idempotent", async () => {
    const first = await seedSam(db, "2026-10-07");
    const second = await seedSam(db, "2026-10-07");
    expect(second).toEqual(first);

    const [counts] = await sql<{ blocks: number; tasks: number; observations: number }[]>`
      select
        (select count(*)::int from schedule_blocks where user_id = ${SAM_USER_ID}) as blocks,
        (select count(*)::int from tasks where user_id = ${SAM_USER_ID}) as tasks,
        (select count(*)::int from observations where user_id = ${SAM_USER_ID}) as observations`;
    expect(counts).toEqual(first);
  });

  it("stores wall-clock times in Sam's timezone", async () => {
    const [work] = await sql<{ starts_at: string; ends_at: string }[]>`
      select starts_at, ends_at from schedule_blocks
      where user_id = ${SAM_USER_ID} and kind = 'work'`;
    expect(new Date(work.starts_at).toISOString()).toBe("2026-10-10T19:00:00.000Z");
    expect(new Date(work.ends_at).toISOString()).toBe("2026-10-11T00:00:00.000Z");
  });

  it("records only numbers the user gave", async () => {
    const rows = await sql<{ category: string; value_num: number | null }[]>`
      select category, value_num from observations
      where user_id = ${SAM_USER_ID} order by category`;
    expect(rows).toEqual([
      { category: "energy", value_num: null },
      { category: "sleep", value_num: 6 },
    ]);
  });
});

describe("constraints and row-level security", () => {
  it("rejects a block that ends before it starts", async () => {
    await inRollback(async (tx) => {
      await expect(
        tx`insert into schedule_blocks (user_id, title, kind, starts_at, ends_at, origin)
           values (${SAM_USER_ID}, 'Backwards', 'focus', '2026-10-07T20:00Z', '2026-10-07T19:00Z', 'manual')`,
      ).rejects.toThrow(/schedule_blocks_ends_after_starts/);
    });
  });

  it("rejects rows for a user without a profile", async () => {
    await inRollback(async (tx) => {
      await expect(
        tx`insert into tasks (user_id, title, kind, origin)
           values ('00000000-0000-4000-8000-000000000000', 'Orphan', 'other', 'manual')`,
      ).rejects.toThrow(/foreign key/);
    });
  });

  it("denies the Supabase anon and authenticated roles even with table grants", async () => {
    await seedSam(db, "2026-10-07");
    for (const role of ["anon", "authenticated"]) {
      await inRollback(async (tx) => {
        await tx.unsafe(`
          do $$ begin
            if not exists (select 1 from pg_roles where rolname = '${role}') then
              create role ${role} nologin;
            end if;
          end $$;
          grant usage on schema public to ${role};
          grant select, insert, update, delete on all tables in schema public to ${role};
          set local role ${role};
        `);
        for (const table of V1_TABLES) {
          const [{ count }] = await tx.unsafe<{ count: number }[]>(
            `select count(*)::int as count from ${table}`,
          );
          expect(count, `${role} reads ${table}`).toBe(0);
        }
        await expect(
          tx.savepoint(
            (sp) => sp`insert into profiles (user_id, timezone)
                       values ('00000000-0000-4000-8000-000000000000', 'UTC')`,
          ),
        ).rejects.toThrow(/row-level security/);
      });
    }
  });
});
