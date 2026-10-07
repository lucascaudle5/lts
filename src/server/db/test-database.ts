import { randomBytes } from "node:crypto";

import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { createDb, type Db } from "./client";
import { loadLocalEnv } from "./local-env";
import { isLocalDatabaseUrl } from "./connection";

export interface TestDatabase {
  db: Db;
  drop: () => Promise<void>;
}

/** For `*.db.test.ts`: a freshly migrated, uniquely named local database, dropped afterwards. */
export async function createTestDatabase(): Promise<TestDatabase> {
  loadLocalEnv();
  const adminUrl = process.env.TEST_DATABASE_URL ?? process.env.POSTGRES_URL_NON_POOLING ?? "";
  if (!isLocalDatabaseUrl(adminUrl)) {
    throw new Error(
      "DB tests need a local Postgres: set POSTGRES_URL_NON_POOLING (or TEST_DATABASE_URL) to a " +
        "localhost URL, e.g. after `supabase start`.",
    );
  }
  const name = `lts_test_${randomBytes(4).toString("hex")}`;
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${name}`);
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const db = createDb(url.toString());
  await migrate(db, {
    migrationsFolder: "db/migrations",
    migrationsTable: "__drizzle_migrations",
    migrationsSchema: "drizzle",
  });
  return {
    db,
    drop: async () => {
      await db.$client.end();
      await admin.unsafe(`drop database if exists ${name} with (force)`);
      await admin.end();
    },
  };
}
