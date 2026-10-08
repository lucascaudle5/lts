import { pathToFileURL } from "node:url";

import { eq, sql } from "drizzle-orm";

import type { HhMm, IsoDate } from "@/contracts/common";
import {
  addDaysIso,
  instantToLocal,
  localDateTimeToInstant,
  todayInTimezone,
  weekdayOf,
} from "@/domain/dates";
import { runMutations, type MutationRequest } from "@/server/mutations/runMutations";

import { createDb, type Db } from "./client";
import { isLocalDatabaseUrl } from "./connection";
import { loadLocalEnv, requireScriptEnv } from "./local-env";
import { observations, profiles, scheduleBlocks, tasks } from "./schema";

/** Fictional dev user. Never seed real personal data. */
export const SAM_USER_ID = "5a5a5a5a-0000-4000-8000-000000000001";
export const SAM_TIMEZONE = "America/Chicago";
/** Sign in as Sam locally; the local Supabase stack catches the email (Mailpit, port 54324). */
export const SAM_EMAIL = "sam@example.com";

export { isLocalDatabaseUrl };

export interface SeedCounts {
  blocks: number;
  tasks: number;
  observations: number;
}

/**
 * Replaces Sam's data with one week around `referenceDate`. Idempotent: deleting the profile
 * cascades to every row Sam owns, then the week is recreated.
 */
export async function seedSam(db: Db, referenceDate: IsoDate): Promise<SeedCounts> {
  const monday = addDaysIso(referenceDate, -((weekdayOf(referenceDate) + 6) % 7));
  const day = (offset: number) => addDaysIso(monday, offset);
  const at = (date: IsoDate, time: HhMm) => localDateTimeToInstant(date, time, SAM_TIMEZONE);

  const block = (
    offset: number,
    title: string,
    kind: (typeof scheduleBlocks.$inferInsert)["kind"],
    start: HhMm,
    end: HhMm,
    fixed: boolean,
  ): typeof scheduleBlocks.$inferInsert => ({
    userId: SAM_USER_ID,
    title,
    kind,
    startsAt: at(day(offset), start),
    endsAt: at(day(offset), end),
    fixed,
    origin: "manual",
  });

  const blockRows = [
    block(0, "Intro to Statistics", "class", "09:00", "10:15", true),
    block(2, "Intro to Statistics", "class", "09:00", "10:15", true),
    block(4, "Intro to Statistics", "class", "09:00", "10:15", true),
    block(1, "Biology lab", "class", "13:00", "15:50", true),
    block(3, "Biology lab", "class", "13:00", "15:50", true),
    block(1, "Gym", "fitness", "07:00", "08:00", false),
    block(3, "Gym", "fitness", "07:00", "08:00", false),
    block(2, "Library study block", "focus", "15:00", "17:00", false),
    block(5, "Work at the bookstore", "work", "14:00", "19:00", true),
    block(6, "Meal prep", "meal", "17:00", "18:00", false),
  ];

  const taskSeeds: Omit<typeof tasks.$inferInsert, "userId" | "origin">[] = [
    { title: "Stats problem set 4", kind: "assignment", dueOn: day(4) },
    { title: "Biology midterm", kind: "exam", dueOn: day(8) },
    { title: "Groceries", kind: "errand" },
    { title: "Laundry", kind: "chore", status: "done" },
    { title: "Email advisor about spring classes", kind: "other", status: "parked" },
  ];
  const taskRows = taskSeeds.map((t) => ({ ...t, userId: SAM_USER_ID, origin: "manual" as const }));

  const observationSeeds: Pick<
    typeof observations.$inferInsert,
    "category" | "valueText" | "valueNum" | "occurredOn"
  >[] = [
    {
      category: "sleep",
      valueText: "slept about 6 hours",
      valueNum: 6,
      occurredOn: addDaysIso(referenceDate, -1),
    },
    { category: "energy", valueText: "pretty tired after lab", occurredOn: referenceDate },
  ];
  const observationRows = observationSeeds.map((o) => ({
    ...o,
    userId: SAM_USER_ID,
    source: "manual_entry" as const,
    quote: o.valueText,
    sensitivity: "health" as const,
    origin: "manual" as const,
  }));

  const mutationCommands: Extract<MutationRequest, { origin: "manual" }>["commands"] = [
    ...blockRows.map((row) => {
      const start = instantToLocal(row.startsAt, SAM_TIMEZONE);
      const end = instantToLocal(row.endsAt, SAM_TIMEZONE);
      return {
        command: {
          kind: "schedule_block.create" as const,
          payload: {
            title: row.title,
            blockKind: row.kind,
            date: start.date,
            start: start.time,
            end: end.time,
            fixed: row.fixed ?? false,
          },
        },
      };
    }),
    ...taskRows.map((row) => ({
      command: {
        kind: "task.create" as const,
        payload: {
          title: row.title,
          taskKind: row.kind,
          ...(row.dueOn ? { dueOn: row.dueOn } : {}),
          ...(row.notes ? { notes: row.notes } : {}),
        },
      },
      taskStatus: row.status ?? "open",
    })),
    ...observationRows.map((row) => ({
      command: {
        kind: "observation.record" as const,
        payload: {
          category: row.category,
          valueText: row.valueText,
          ...(row.valueNum != null ? { valueNum: row.valueNum } : {}),
          occurredOn: row.occurredOn,
        },
      },
    })),
  ];

  await db.transaction(async (tx) => {
    await tx.delete(profiles).where(eq(profiles.userId, SAM_USER_ID));
    await tx.insert(profiles).values({ userId: SAM_USER_ID, timezone: SAM_TIMEZONE });
    await runMutations(
      SAM_USER_ID,
      {
        origin: "manual",
        timezone: SAM_TIMEZONE,
        actor: "automation",
        commands: mutationCommands,
      },
      tx as unknown as Db,
    );
  });

  return {
    blocks: blockRows.length,
    tasks: taskRows.length,
    observations: observationRows.length,
  };
}

/**
 * On the local Supabase stack, makes Sam a confirmed Auth user with the seed's fixed id so a
 * magic-link sign-in as SAM_EMAIL lands on the seeded week. Plain Postgres (CI) has no `auth`
 * schema; then this is a no-op and returns false. Token columns must be '' rather than NULL for
 * Supabase Auth to load the user.
 */
export async function ensureSamAuthUser(db: Db): Promise<boolean> {
  const [{ exists }] = await db.execute<{ exists: boolean }>(
    sql`select to_regclass('auth.users') is not null and to_regclass('auth.identities') is not null as exists`,
  );
  if (!exists) return false;
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      insert into auth.users (
        instance_id, id, aud, role, email, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', ${SAM_USER_ID}, 'authenticated', 'authenticated',
        ${SAM_EMAIL}, now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(),
        '', '', '', ''
      ) on conflict (id) do nothing`);
    await tx.execute(sql`
      insert into auth.identities (
        provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        ${SAM_USER_ID}, ${SAM_USER_ID},
        ${JSON.stringify({ sub: SAM_USER_ID, email: SAM_EMAIL, email_verified: true })}::jsonb,
        'email', now(), now(), now()
      ) on conflict (provider_id, provider) do nothing`);
  });
  return true;
}

async function main() {
  const loaded = loadLocalEnv();
  const url = requireScriptEnv("POSTGRES_URL_NON_POOLING", loaded);
  if (!isLocalDatabaseUrl(url)) {
    throw new Error(
      "Refusing to seed: POSTGRES_URL_NON_POOLING does not point at a local database " +
        "(localhost / 127.0.0.1). The seed is for local development only.",
    );
  }
  const db = createDb(url);
  try {
    const referenceDate = todayInTimezone(new Date(), SAM_TIMEZONE);
    const counts = await seedSam(db, referenceDate);
    const canSignIn = await ensureSamAuthUser(db);
    console.log(
      `Seeded Sam (week of ${referenceDate}): ${counts.blocks} blocks, ${counts.tasks} tasks, ` +
        `${counts.observations} observations.`,
    );
    console.log(
      canSignIn
        ? `Sign in at /sign-in as ${SAM_EMAIL}; the link arrives in Mailpit (http://127.0.0.1:54324).`
        : "No Supabase Auth schema here, so Sam has no login (fine for CI and plain Postgres).",
    );
  } finally {
    await db.$client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
