import { pathToFileURL } from "node:url";

import { eq } from "drizzle-orm";

import type { HhMm, IsoDate } from "@/contracts/common";
import { addDaysIso, localDateTimeToInstant, todayInTimezone, weekdayOf } from "@/domain/dates";

import { createDb, type Db } from "./client";
import { loadLocalEnv, requireEnv } from "./env";
import { observations, profiles, scheduleBlocks, tasks } from "./schema";

/** Fictional dev user. Never seed real personal data. */
export const SAM_USER_ID = "5a5a5a5a-0000-4000-8000-000000000001";
export const SAM_TIMEZONE = "America/Chicago";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function isLocalDatabaseUrl(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

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

  const taskRows: (typeof tasks.$inferInsert)[] = [
    { title: "Stats problem set 4", kind: "assignment", dueOn: day(4) },
    { title: "Biology midterm", kind: "exam", dueOn: day(8) },
    { title: "Groceries", kind: "errand" },
    { title: "Laundry", kind: "chore", status: "done" },
    { title: "Email advisor about spring classes", kind: "other", status: "parked" },
  ].map((t) => ({ ...t, userId: SAM_USER_ID, origin: "manual" as const }));

  const observationRows: (typeof observations.$inferInsert)[] = [
    {
      category: "sleep",
      valueText: "slept about 6 hours",
      valueNum: 6,
      occurredOn: addDaysIso(referenceDate, -1),
    },
    { category: "energy", valueText: "pretty tired after lab", occurredOn: referenceDate },
  ].map((o) => ({
    ...o,
    userId: SAM_USER_ID,
    source: "manual_entry" as const,
    quote: o.valueText,
    sensitivity: "health" as const,
    origin: "manual" as const,
  }));

  await db.transaction(async (tx) => {
    await tx.delete(profiles).where(eq(profiles.userId, SAM_USER_ID));
    await tx.insert(profiles).values({ userId: SAM_USER_ID, timezone: SAM_TIMEZONE });
    await tx.insert(scheduleBlocks).values(blockRows);
    await tx.insert(tasks).values(taskRows);
    await tx.insert(observations).values(observationRows);
  });

  return {
    blocks: blockRows.length,
    tasks: taskRows.length,
    observations: observationRows.length,
  };
}

async function main() {
  loadLocalEnv();
  const url = requireEnv("POSTGRES_URL_NON_POOLING");
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
    console.log(
      `Seeded Sam (week of ${referenceDate}): ${counts.blocks} blocks, ${counts.tasks} tasks, ` +
        `${counts.observations} observations.`,
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
