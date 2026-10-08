import type { IsoDate, Warning, WarningCode } from "@/contracts/common";
import type { ProposalDraft } from "@/contracts/proposals";
import { findDateExpressions, parseTimeRange } from "@/domain/dates";

const OBSERVATION_PATTERNS: readonly {
  pattern: RegExp;
  category: "energy" | "sleep" | "stress";
}[] = [
  { pattern: /\b(exhausted|tired|worn out|low energy)\b/i, category: "energy" },
  { pattern: /\b(slept|sleeping|sleep)\b/i, category: "sleep" },
  { pattern: /\b(stressed|stressful|under pressure)\b/i, category: "stress" },
];

const TASK_START = /\b(?:needs?(?:\s+to)?|buy|get|pick up|remember to|todo)\s+(.+)$/i;
const KNOWN_TASK = /\b(groceries|laundry|homework|assignment|exam|test|email|call|appointment)\b/i;
const TASK_ACTION =
  /^(?:i\s+(?:need to|want to)\s+)?(?:read|review|finish|complete|submit|pay|take out|do|wash|clean|book|call|email|drink|order|return|write|prep|prepare|put away)\b/i;
const KNOWN_BLOCK =
  /\b(work|class|lecture|lab|gym|workout|dentist|doctor|meeting|study|lunch|dinner)\b/i;

const WARNING_MESSAGES: Record<WarningCode, string> = {
  date_from_weekday: "Check that the weekday resolves to the intended date.",
  date_is_today: "This weekday is today.",
  time_assumed_pm: "I read this time as PM. Please check it.",
  time_assumed_duration: "I assumed a duration. Please check it.",
  conflicts_with_fixed_block: "This overlaps a fixed block on your schedule.",
  possible_duplicate_task: "You may already have this task open.",
  low_confidence: "Not sure about this one. Please check it.",
} as const;

function clauses(text: string): string[] {
  return text
    .split(/[,;\n]+|\band\b/gi)
    .map((part) => part.trim().replace(/^[\s.!?]+|[\s.!?]+$/g, ""))
    .filter(Boolean);
}

function titleFrom(clause: string, dateMatches: readonly string[], timeMatch?: string): string {
  let title = clause;
  for (const match of dateMatches) title = title.replace(match, " ");
  if (timeMatch) title = title.replace(timeMatch, " ");
  title = title
    .replace(/\b(?:next|this)\b/gi, " ")
    .replace(/\b(?:need|needs|buy|get|pick up|remember to|todo)\b/gi, " ")
    .replace(/\b(?:i|i've|i’m|i'm|been|lately|on|at|from|to|until|till)\b/gi, " ")
    .replace(/[–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return title ? title[0].toUpperCase() + title.slice(1) : "";
}

function blockKind(
  clause: string,
): "work" | "class" | "exam" | "fitness" | "meal" | "focus" | "personal" {
  if (/\b(gym|workout)\b/i.test(clause)) return "fitness";
  if (/\b(class|lecture|lab)\b/i.test(clause)) return "class";
  if (/\b(exam|test)\b/i.test(clause)) return "exam";
  if (/\b(study)\b/i.test(clause)) return "focus";
  if (/\b(lunch|dinner)\b/i.test(clause)) return "meal";
  if (/\b(work)\b/i.test(clause)) return "work";
  return "personal";
}

function taskKind(clause: string): "errand" | "assignment" | "exam" | "chore" | "other" {
  if (/\b(groceries|buy|pick up|errand)\b/i.test(clause)) return "errand";
  if (/\b(laundry|chore)\b/i.test(clause)) return "chore";
  if (/\b(exam|test)\b/i.test(clause)) return "exam";
  if (/\b(homework|assignment)\b/i.test(clause)) return "assignment";
  return "other";
}

/**
 * Deterministic M3 parser. It only creates typed drafts; callers must persist them as proposals
 * and wait for an explicit approval before any domain table is changed.
 */
export function parseCapture(text: string, referenceDate: IsoDate): ProposalDraft[] {
  const result: ProposalDraft[] = [];

  for (const clause of clauses(text)) {
    const dateExpressions = findDateExpressions(clause, referenceDate);
    const dates = dateExpressions.map((date) => date.date);
    const dateMatches = dateExpressions.map((date) => date.match);
    const timeRange = parseTimeRange(clause);
    const observation = OBSERVATION_PATTERNS.find(({ pattern }) => pattern.test(clause));

    if (observation) {
      const date = dates[0] ?? referenceDate;
      result.push({
        kind: "observation.record",
        quote: clause,
        confidence: "medium",
        payload: { category: observation.category, valueText: clause, occurredOn: date },
      });
      continue;
    }

    const taskMatch = clause.match(TASK_START);
    const isTask = Boolean(
      taskMatch || KNOWN_TASK.test(clause) || (!timeRange && TASK_ACTION.test(clause)),
    );
    if (isTask) {
      const explicitTitle = taskMatch?.[1]?.trim();
      const title = explicitTitle
        ? titleFrom(explicitTitle, dateMatches)
        : titleFrom(clause, dateMatches, timeRange?.match);
      result.push({
        kind: "task.create",
        quote: clause,
        confidence: dates.length > 0 ? "high" : "medium",
        payload: {
          ...(title ? { title } : {}),
          taskKind: taskKind(clause),
          ...(dates[0] ? { dueOn: dates[0] } : {}),
        },
      });
      continue;
    }

    if (!timeRange && !KNOWN_BLOCK.test(clause)) continue;
    const title = titleFrom(clause, dateMatches, timeRange?.match);
    const scheduleDates = dates.length > 0 ? dates : [undefined];
    for (const date of scheduleDates) {
      result.push({
        kind: "schedule_block.create",
        quote: clause,
        confidence: date && timeRange ? "high" : "medium",
        payload: {
          ...(title ? { title } : {}),
          blockKind: blockKind(clause),
          ...(date ? { date } : {}),
          ...(timeRange ? { start: timeRange.start, end: timeRange.end } : {}),
          fixed: /\b(appointment|dentist|doctor|class|lecture|lab|meeting|work)\b/i.test(clause),
        },
      });
    }
  }

  return result.slice(0, 20);
}

export function parserWarnings(draft: ProposalDraft, referenceDate: IsoDate): Warning[] {
  const codes = new Set<WarningCode>();
  for (const expression of findDateExpressions(draft.quote, referenceDate)) {
    for (const warning of expression.warnings) codes.add(warning);
  }
  if (draft.kind === "schedule_block.create") {
    for (const warning of parseTimeRange(draft.quote)?.warnings ?? []) codes.add(warning);
  }
  if (draft.confidence === "low") codes.add("low_confidence");
  return [...codes].map((code) => ({ code, message: WARNING_MESSAGES[code] }));
}
