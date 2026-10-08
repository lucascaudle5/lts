import "server-only";

import { randomUUID } from "node:crypto";

import { getDb, type Db } from "@/server/db/client";
import { captures } from "@/server/db/schema";
import { matchesRiskLanguage } from "@/domain/safety";
import { todayInTimezone } from "@/domain/dates";

import { CaptureText } from "@/contracts/captures";

export async function createCapture(
  userId: string,
  text: unknown,
  timezone: string,
  now = new Date(),
  db: Db = getDb(),
): Promise<{ captureId: string; safetyStop: boolean }> {
  const parsedText = CaptureText.parse(text);
  const safetyStop = matchesRiskLanguage(parsedText);
  const captureId = randomUUID();
  await db.insert(captures).values({
    id: captureId,
    userId,
    text: parsedText,
    referenceDate: todayInTimezone(now, timezone),
    timezone,
    safetyStop,
  });
  return { captureId, safetyStop };
}
