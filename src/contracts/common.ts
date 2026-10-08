import { z } from "zod";

function isRealCalendarDate(value: string): boolean {
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Calendar date in the user's timezone, `YYYY-MM-DD`. */
export const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine(isRealCalendarDate, "Not a real calendar date");
export type IsoDate = z.infer<typeof IsoDate>;

/** Wall-clock time, 24-hour `HH:MM`. */
export const HhMm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM (24-hour)");
export type HhMm = z.infer<typeof HhMm>;

export const Timezone = z.string().min(1).refine(isIanaTimezone, "Unknown IANA timezone");
export type Timezone = z.infer<typeof Timezone>;

export const Uuid = z.uuid();
export type Uuid = z.infer<typeof Uuid>;

export const BlockKind = z.enum(["work", "class", "exam", "fitness", "meal", "focus", "personal"]);
export type BlockKind = z.infer<typeof BlockKind>;

export const TaskKind = z.enum(["errand", "assignment", "exam", "chore", "other"]);
export type TaskKind = z.infer<typeof TaskKind>;

export const TaskStatus = z.enum(["open", "done", "parked"]);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const TaskPriority = z.enum(["low", "medium", "high"]);
export type TaskPriority = z.infer<typeof TaskPriority>;

export const ObservationCategory = z.enum(["energy", "sleep", "stress", "capacity", "note"]);
export type ObservationCategory = z.infer<typeof ObservationCategory>;

export const SensitiveCategory = z.enum(["energy", "sleep", "stress", "capacity", "note"]);
export type SensitiveCategory = z.infer<typeof SensitiveCategory>;

export const ObservationSource = z.enum(["user_statement", "manual_entry"]);
export type ObservationSource = z.infer<typeof ObservationSource>;

export const Sensitivity = z.enum(["normal", "health"]);
export type Sensitivity = z.infer<typeof Sensitivity>;

/** How a domain row came to exist or change. */
export const ChangeOrigin = z.enum(["manual", "proposal", "undo"]);
export type ChangeOrigin = z.infer<typeof ChangeOrigin>;

export const Actor = z.enum(["user", "automation"]);
export type Actor = z.infer<typeof Actor>;

export const Confidence = z.enum(["low", "medium", "high"]);
export type Confidence = z.infer<typeof Confidence>;

export const WarningCode = z.enum([
  "date_from_weekday",
  "date_is_today",
  "time_assumed_pm",
  "time_assumed_duration",
  "conflicts_with_fixed_block",
  "possible_duplicate_task",
  "low_confidence",
]);
export type WarningCode = z.infer<typeof WarningCode>;

export const Warning = z.object({
  code: WarningCode,
  message: z.string().min(1),
});
export type Warning = z.infer<typeof Warning>;

/** A required field the user still has to fill before an item can be approved. */
export const MissingSlot = z.object({
  path: z.string().min(1),
  reason: z.string().min(1),
  options: z.array(z.string()).optional(),
});
export type MissingSlot = z.infer<typeof MissingSlot>;
