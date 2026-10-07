import { describe, expect, it } from "vitest";

import type { ProposalDraft } from "@/contracts/proposals";

import {
  checkDraftSafety,
  findIntroducedClinicalLanguage,
  isGroundedIn,
  matchesRiskLanguage,
  RISK_STOP_MESSAGE,
} from "./safety";

const CAPTURE =
  "Work Saturday 2–7, test Tuesday, gym Monday Wednesday Friday, need groceries, and I've been exhausted lately.";

describe("risk-language stop", () => {
  it.each([
    "I want to die",
    "honestly i wanna  die",
    "thinking about suicide",
    "I might hurt myself tonight",
    "I don’t want to keep going, I want to end my life",
    "self harm again",
    "SELF-HARM",
  ])("stops on %s", (text) => {
    expect(matchesRiskLanguage(text)).toBe(true);
  });

  it.each([
    CAPTURE,
    "so stressed about the exam",
    "I'm dead tired",
    "this class is killing me",
    "dying to see that movie",
    "my legs hurt after gym",
    "kill the bugs in my code",
  ])("does not stop on ordinary text: %s", (text) => {
    expect(matchesRiskLanguage(text)).toBe(false);
  });

  it("points to human help", () => {
    expect(RISK_STOP_MESSAGE).toContain("988");
  });
});

describe("clinical-language denylist", () => {
  it.each([
    "Sounds like depression",
    "Possible burnout",
    "You may have a sleep disorder",
    "Take 20mg melatonin",
    "Increase your dose",
    "Skip your meds today",
    "Ask to be prescribed something",
  ])("rejects model text %s", (text) => {
    expect(findIntroducedClinicalLanguage(text, CAPTURE)).not.toEqual([]);
  });

  it.each(["Pick up prescription", "Refill meds", "Groceries", "Rest day"])(
    "allows logistics: %s",
    (text) => {
      expect(findIntroducedClinicalLanguage(text, "pick up prescription, refill meds")).toEqual([]);
    },
  );

  it("does not flag the user's own words", () => {
    expect(findIntroducedClinicalLanguage("my ADHD", "ugh my ADHD is bad today")).toEqual([]);
  });
});

describe("grounding", () => {
  it("accepts quotes that are spans of the capture", () => {
    expect(isGroundedIn("I've been exhausted lately", CAPTURE)).toBe(true);
    expect(isGroundedIn("work saturday  2–7", CAPTURE)).toBe(true);
    expect(isGroundedIn("I\u2019ve been exhausted", CAPTURE)).toBe(true);
  });

  it("rejects quotes the user never wrote", () => {
    expect(isGroundedIn("I feel burned out", CAPTURE)).toBe(false);
    expect(isGroundedIn("   ", CAPTURE)).toBe(false);
  });

  const observation = (
    payload: Extract<ProposalDraft, { kind: "observation.record" }>["payload"],
    quote = "I've been exhausted lately",
  ): ProposalDraft => ({ kind: "observation.record", payload, quote, confidence: "high" });

  it("passes the worked example's observation", () => {
    const draft = observation({
      category: "energy",
      valueText: "exhausted lately",
      occurredOn: "2026-10-07",
    });
    expect(checkDraftSafety(draft, CAPTURE)).toEqual([]);
  });

  it("drops invented scores, paraphrases, and modes", () => {
    const issues = checkDraftSafety(
      observation({ category: "capacity", valueText: "Survival Day", valueNum: 2 }),
      CAPTURE,
    );
    expect(issues.map((i) => i.code).sort()).toEqual([
      "observation_not_user_words",
      "observation_number_not_stated",
    ]);
  });

  it("keeps a number the user stated", () => {
    const capture = "slept 5 hours";
    const draft = observation(
      { category: "sleep", valueText: "slept 5 hours", valueNum: 5 },
      "slept 5 hours",
    );
    expect(checkDraftSafety(draft, capture)).toEqual([]);
  });

  it("drops items with ungrounded quotes or clinical titles", () => {
    const draft: ProposalDraft = {
      kind: "task.create",
      payload: { title: "Talk to a doctor about burnout", taskKind: "other" },
      quote: "exhausted lately",
      confidence: "medium",
    };
    expect(checkDraftSafety(draft, CAPTURE).map((i) => i.code)).toEqual(["clinical_language"]);
    expect(
      checkDraftSafety({ ...draft, quote: "made up", payload: { title: "Nap" } }, CAPTURE).map(
        (i) => i.code,
      ),
    ).toEqual(["quote_not_in_capture"]);
  });
});
