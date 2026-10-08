import "server-only";

import { and, desc, eq, gte, inArray, lte, isNull } from "drizzle-orm";

import { GetRecentObservationsInput, GetRecentObservationsOutput } from "@/contracts/tools";
import { addDaysIso } from "@/domain/dates";
import { getDb, type Db } from "@/server/db/client";
import { observations, profiles } from "@/server/db/schema";

export async function getRecentObservationsTool(
  userId: string,
  input: unknown,
  referenceDate: string,
  db: Db = getDb(),
) {
  const { days, categories } = GetRecentObservationsInput.parse(input);
  const [profile] = await db
    .select({ categories: profiles.aiSensitiveCategories })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  const allowed = new Set(profile?.categories ?? []);
  if (categories.some((category) => !allowed.has(category))) {
    throw new Error("Observation category has not been enabled for AI access");
  }
  const since = addDaysIso(referenceDate, -(days - 1));
  const rows = await db
    .select({
      id: observations.id,
      category: observations.category,
      valueText: observations.valueText,
      occurredOn: observations.occurredOn,
    })
    .from(observations)
    .where(
      and(
        eq(observations.userId, userId),
        isNull(observations.deletedAt),
        gte(observations.occurredOn, since),
        lte(observations.occurredOn, referenceDate),
        inArray(observations.category, categories),
      ),
    )
    .orderBy(desc(observations.occurredOn), desc(observations.createdAt))
    .limit(50);
  return GetRecentObservationsOutput.parse({ observations: rows });
}
