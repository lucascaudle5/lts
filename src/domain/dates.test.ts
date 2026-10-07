import { describe, expect, it } from "vitest";

import {
  findDateExpressions,
  formatTime12h,
  instantToLocal,
  localDateTimeToInstant,
  parseTimeRange,
  resolveDateExpression,
  todayInTimezone,
} from "./dates";

/** Wed 2026-10-07, the worked example's reference date. */
const REF = "2026-10-07";
const TZ = "America/Chicago";

describe("resolveDateExpression (reference Wed 2026-10-07)", () => {
  it.each([
    ["work saturday 2-7", "2026-10-10", ["date_from_weekday"]],
    ["work sat 2-7", "2026-10-10", ["date_from_weekday"]],
    ["Sat", "2026-10-10", ["date_from_weekday"]],
    ["gym mon", "2026-10-12", ["date_from_weekday"]],
    ["test Tuesday", "2026-10-13", ["date_from_weekday"]],
    ["tues", "2026-10-13", ["date_from_weekday"]],
    ["wed", "2026-10-07", ["date_from_weekday", "date_is_today"]],
    ["Wednesday", "2026-10-07", ["date_from_weekday", "date_is_today"]],
    ["thurs", "2026-10-08", ["date_from_weekday"]],
    ["dentist friday 3-4pm", "2026-10-09", ["date_from_weekday"]],
    ["sun", "2026-10-11", ["date_from_weekday"]],
    ["this friday", "2026-10-09", ["date_from_weekday"]],
    ["next friday", "2026-10-16", ["date_from_weekday"]],
    ["next monday", "2026-10-12", ["date_from_weekday"]],
    ["next wednesday", "2026-10-14", ["date_from_weekday"]],
    ["today", "2026-10-07", []],
    ["tonight", "2026-10-07", []],
    ["Tomorrow", "2026-10-08", []],
    ["tmrw", "2026-10-08", []],
  ])("%s → %s", (text, date, warnings) => {
    const result = resolveDateExpression(text, REF);
    expect(result?.date).toBe(date);
    expect(result?.warnings).toEqual(warnings);
  });

  it.each(["this month", "money for rent", "saturn notes", "satisfied", "monument", "frisbee"])(
    "does not read a weekday inside %s",
    (text) => {
      expect(resolveDateExpression(text, REF)).toBeNull();
    },
  );

  it("finds every weekday in order", () => {
    const dates = findDateExpressions("gym Monday Wednesday Friday", REF).map((d) => d.date);
    expect(dates).toEqual(["2026-10-12", "2026-10-07", "2026-10-09"]);
  });

  it("wraps across month and year ends", () => {
    expect(resolveDateExpression("sat", "2026-12-31")?.date).toBe("2027-01-02");
    expect(resolveDateExpression("tomorrow", "2026-02-28")?.date).toBe("2026-03-01");
  });
});

describe("parseTimeRange", () => {
  it.each([
    ["work 2-7", "14:00", "19:00", ["time_assumed_pm"]],
    ["Work Saturday 2–7", "14:00", "19:00", ["time_assumed_pm"]],
    ["class 7am-8am", "07:00", "08:00", []],
    ["7am - 8am", "07:00", "08:00", []],
    ["7-8am", "07:00", "08:00", []],
    ["7am-8", "07:00", "08:00", []],
    ["dentist 3-4pm", "15:00", "16:00", []],
    ["3pm-4pm", "15:00", "16:00", []],
    ["11-1pm", "11:00", "13:00", []],
    ["11am-1", "11:00", "13:00", []],
    ["10:30am-12pm", "10:30", "12:00", []],
    ["9-5", "09:00", "17:00", ["time_assumed_pm"]],
    ["8-10", "08:00", "10:00", []],
    ["10-12", "10:00", "12:00", []],
    ["14:00–19:00", "14:00", "19:00", []],
    ["9-17", "09:00", "17:00", []],
    ["2:30 to 4", "14:30", "16:00", ["time_assumed_pm"]],
    ["11pm-11:30pm", "23:00", "23:30", []],
  ])("%s → %s–%s", (text, start, end, warnings) => {
    const result = parseTimeRange(text);
    expect(result).toMatchObject({ start, end, warnings });
  });

  it("keeps an explicit backwards range so validation can ask", () => {
    expect(parseTimeRange("8pm-7pm")).toMatchObject({ start: "20:00", end: "19:00" });
  });

  it.each(["2026-10-07", "10/07", "25-30", "13pm-2pm", "room 101", "no times here"])(
    "finds no time range in %s",
    (text) => {
      expect(parseTimeRange(text)).toBeNull();
    },
  );
});

describe("timezone conversion (America/Chicago)", () => {
  it("maps wall-clock time to the right instant across DST", () => {
    expect(localDateTimeToInstant("2026-10-10", "14:00", TZ).toISOString()).toBe(
      "2026-10-10T19:00:00.000Z",
    );
    expect(localDateTimeToInstant("2026-12-10", "14:00", TZ).toISOString()).toBe(
      "2026-12-10T20:00:00.000Z",
    );
  });

  it("round-trips through local time", () => {
    const instant = localDateTimeToInstant("2026-11-01", "09:30", TZ);
    expect(instantToLocal(instant, TZ)).toEqual({ date: "2026-11-01", time: "09:30" });
  });

  it("uses the user's local date, not UTC (the legacy late-evening bug)", () => {
    const lateEvening = new Date("2026-10-08T03:30:00Z");
    expect(todayInTimezone(lateEvening, TZ)).toBe("2026-10-07");
    expect(todayInTimezone(lateEvening, "UTC")).toBe("2026-10-08");
  });

  it("formats 12-hour times", () => {
    expect(formatTime12h("14:00")).toBe("2:00 PM");
    expect(formatTime12h("00:15")).toBe("12:15 AM");
    expect(formatTime12h("12:00")).toBe("12:00 PM");
  });
});
