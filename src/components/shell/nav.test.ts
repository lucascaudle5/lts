import { describe, expect, it } from "vitest";

import { isActivePath, PRIMARY_NAV, roomGroup, ROOM_NAV } from "./nav";

describe("nav", () => {
  it("marks the current room and its children, never a prefix lookalike", () => {
    expect(isActivePath("/habits", "/habits")).toBe(true);
    expect(isActivePath("/tasks/abc", "/tasks")).toBe(true);
    expect(isActivePath("/history", "/habits")).toBe(false);
    expect(isActivePath("/today", "/tasks")).toBe(false);
    expect(isActivePath(null, "/today")).toBe(false);
  });

  it("keeps Today lit while a captured note is being reviewed", () => {
    expect(isActivePath("/captures/1234", "/today")).toBe(true);
    expect(isActivePath("/captures/1234", "/tasks")).toBe(false);
  });

  it("gives every room a hue group, with red reserved for nothing", () => {
    const groups = new Set([...PRIMARY_NAV, ...ROOM_NAV].map((item) => item.group));
    expect([...groups].sort()).toEqual(["nova", "plan", "practice", "quiet", "self"]);
    expect(roomGroup("habits")).toBe("practice");
    expect(roomGroup("mind")).toBe("self");
    expect(roomGroup("schedule")).toBe("plan");
    expect(roomGroup("nowhere")).toBe("quiet");
  });

  it("has no bottom taskbar to link to: every room is reachable from the top nav", () => {
    expect(ROOM_NAV.map((item) => item.href)).toEqual(
      expect.arrayContaining(["/schedule", "/tasks", "/habits", "/routines", "/review"]),
    );
  });
});
