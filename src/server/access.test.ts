import { describe, expect, it } from "vitest";

import { accessRedirect, safeNextPath } from "./access";

describe("accessRedirect", () => {
  it.each([
    ["/today", "", "/sign-in?next=%2Ftoday"],
    ["/today", "?d=1", "/sign-in?next=%2Ftoday%3Fd%3D1"],
    ["/history", "", "/sign-in?next=%2Fhistory"],
    ["/", "", "/sign-in"],
    ["/sign-in", "", null],
    ["/forgot-password", "", null],
    ["/reset-password", "", null],
    ["/api/health", "", null],
    ["/sign-inx", "", "/sign-in?next=%2Fsign-inx"],
  ])("signed out: %s%s → %s", (path, search, expected) => {
    expect(accessRedirect(path, search, false)).toBe(expected);
  });

  it.each([
    ["/sign-in", "/today"],
    ["/", "/today"],
    ["/today", null],
    ["/api/health", null],
  ])("signed in: %s → %s", (path, expected) => {
    expect(accessRedirect(path, "", true)).toBe(expected);
  });
});

describe("safeNextPath", () => {
  it.each([
    [undefined, "/today"],
    ["", "/today"],
    ["/today", "/today"],
    ["/today?d=1", "/today?d=1"],
    ["https://evil.example/today", "/today"],
    ["//evil.example", "/today"],
    ["/\\evil.example", "/today"],
    ["today", "/today"],
    ["/sign-in", "/today"],
  ])("%s → %s", (next, expected) => {
    expect(safeNextPath(next)).toBe(expected);
  });
});
