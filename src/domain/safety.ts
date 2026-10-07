import type { ProposalDraft } from "@/contracts/proposals";

/**
 * Explicit self-harm or harm-to-others wording. This is a fixed, narrow phrase check, not a crisis
 * classifier: it does not score or infer risk and will miss indirect language. Changing this list
 * or the message requires a PR that says why (docs/ARCHITECTURE.md, "Risk-language stop").
 */
export const RISK_PHRASES: readonly string[] = [
  "kill myself",
  "killing myself",
  "end my life",
  "ending my life",
  "take my own life",
  "want to die",
  "wanna die",
  "suicide",
  "suicidal",
  "hurt myself",
  "harm myself",
  "self harm",
  "self-harm",
  "cut myself",
  "kill someone",
  "hurt someone",
];

export const RISK_STOP_MESSAGE =
  "It sounds like you might be going through something really hard. LTS isn't the right place for " +
  "this, and you deserve support from a person. In the US you can call or text 988 any time. " +
  "Elsewhere, contact your local emergency services.";

function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function phrasePattern(phrase: string): RegExp {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/[\s-]+/g, "[\\s-]+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu");
}

const RISK_PATTERNS = RISK_PHRASES.map(phrasePattern);

/** Step 0 of the pipeline: on a match, nothing else runs. */
export function matchesRiskLanguage(text: string): boolean {
  const normalized = normalizeText(text);
  return RISK_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Diagnosis and medication-adjustment language LTS must never produce (Constitution, health and
 * safety boundaries). Logistics like "pick up prescription" are allowed.
 */
const CLINICAL_PATTERNS: readonly RegExp[] = [
  /\bdiagnos(?:e|ed|es|is|ing)\b/i,
  /\b(?:disorder|syndrome|clinical(?:ly)?)\b/i,
  /\b(?:depression|bipolar|adhd|ptsd|ocd|insomnia|anorexia|bulimia)\b/i,
  /\b(?:burnout|burned out|burnt out)\b/i,
  /\b(?:dose|dosage|doses|dosing)\b/i,
  /\b\d+(?:\.\d+)?\s?(?:mg|mcg|ml)\b/i,
  /\b(?:increase|decrease|reduce|raise|lower|stop|skip|double|halve|adjust|change)\s+(?:your\s+|the\s+)?(?:meds|medication|medications|dose|dosage|prescription)\b/i,
  /\b(?:prescribe|prescribed|prescribing)\b/i,
  /\b(?:antidepressants?|ssris?|stimulants?|benzodiazepines?)\b/i,
];

/** Clinical terms in `text`, ignoring any the user wrote themselves in `capture`. */
export function findIntroducedClinicalLanguage(text: string, capture: string): string[] {
  const normalizedCapture = normalizeText(capture);
  return CLINICAL_PATTERNS.flatMap((pattern) => {
    const match = normalizeText(text).match(pattern);
    if (!match) return [];
    return pattern.test(normalizedCapture) ? [] : [match[0]];
  });
}

/** The quote must be a span of the capture (whitespace, quote marks, and case aside). */
export function isGroundedIn(quote: string, capture: string): boolean {
  const q = normalizeText(quote).toLowerCase();
  return q.length > 0 && normalizeText(capture).toLowerCase().includes(q);
}

export type SafetyIssueCode =
  | "quote_not_in_capture"
  | "observation_not_user_words"
  | "observation_number_not_stated"
  | "clinical_language";

export interface SafetyIssue {
  code: SafetyIssueCode;
  detail: string;
}

function numbersIn(text: string): number[] {
  return [...text.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
}

/**
 * Grounding and safety (pipeline step 5). Any issue means the item is dropped, never shown
 * half-valid.
 */
export function checkDraftSafety(draft: ProposalDraft, capture: string): SafetyIssue[] {
  const issues: SafetyIssue[] = [];

  if (!isGroundedIn(draft.quote, capture)) {
    issues.push({ code: "quote_not_in_capture", detail: draft.quote });
  }

  const generatedText: string[] = [];
  if (draft.kind === "schedule_block.create") {
    if (draft.payload.title) generatedText.push(draft.payload.title);
  } else if (draft.kind === "task.create") {
    if (draft.payload.title) generatedText.push(draft.payload.title);
    if (draft.payload.notes) generatedText.push(draft.payload.notes);
  } else {
    const { valueText, valueNum } = draft.payload;
    if (valueText) {
      generatedText.push(valueText);
      if (!isGroundedIn(valueText, capture)) {
        issues.push({ code: "observation_not_user_words", detail: valueText });
      }
    }
    if (valueNum !== undefined && !numbersIn(draft.quote).includes(valueNum)) {
      issues.push({ code: "observation_number_not_stated", detail: String(valueNum) });
    }
  }

  for (const text of generatedText) {
    for (const term of findIntroducedClinicalLanguage(text, capture)) {
      issues.push({ code: "clinical_language", detail: term });
    }
  }

  return issues;
}
