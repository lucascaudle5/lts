import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  createThemeStore,
  DEFAULT_THEME,
  parseTheme,
  THEME_BOOT_SCRIPT,
  THEME_STORAGE_KEY,
  THEMES,
  type Theme,
} from "./theme";

const css = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");

function themeTokens(theme: Theme): Record<string, string> {
  const selector =
    theme === "sandstone" ? ':root,\n[data-theme="sandstone"]' : `[data-theme="${theme}"]`;
  const start = css.indexOf(`${selector} {`);
  expect(start, `${theme} block`).toBeGreaterThanOrEqual(0);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  );
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** [foreground, background, minimum ratio]: 4.5 for text, 3 for controls, focus and gold edges. */
const PAIRS: Array<[string, string, number]> = [
  ["ink", "surface", 4.5],
  ["ink", "bg", 4.5],
  ["ink", "surface-2", 4.5],
  ["ink-soft", "bg", 4.5],
  ["muted-ink", "bg", 4.5],
  ["muted-ink", "surface", 4.5],
  ["muted-ink", "surface-2", 4.5],
  ["muted-ink", "surface-3", 4.5],
  ["btn-ink", "btn", 4.5],
  ["rail-ink", "rail", 4.5],
  ["gold-ink", "gold", 4.5],
  ["gold-text", "surface", 4.5],
  ["gold-text", "gold-soft", 4.5],
  ["success", "surface", 4.5],
  ["success", "green-soft", 4.5],
  ["red", "surface", 4.5],
  ["red", "red-soft", 4.5],
  ["blue", "surface", 4.5],
  ["blue", "blue-soft", 4.5],
  ["purple", "surface", 4.5],
  ["purple", "purple-soft", 4.5],
  ["ink", "gold-soft", 4.5],
  ["ink", "blue-soft", 4.5],
  ["ink", "green-soft", 4.5],
  ["ink", "lime-soft", 4.5],
  ["ink", "purple-soft", 4.5],
  ["line-strong", "surface", 3],
  ["line-strong", "bg", 3],
  ["focus", "bg", 3],
  ["focus", "surface", 3],
  ["gold", "rail", 3],
];

describe("theme tokens", () => {
  for (const theme of THEMES) {
    describe(theme, () => {
      const tokens = themeTokens(theme);
      it.each(PAIRS)("%s on %s reaches %s:1", (fg, bg, min) => {
        expect(tokens[fg], `--${fg}`).toMatch(/^#[0-9a-f]{6}$/);
        expect(tokens[bg], `--${bg}`).toMatch(/^#[0-9a-f]{6}$/);
        expect(contrast(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(min);
      });
    });
  }

  it("defines the same tokens in every theme", () => {
    const [first, ...rest] = THEMES.map((t) => Object.keys(themeTokens(t)).sort());
    for (const other of rest) expect(other).toEqual(first);
  });

  it("keeps hard-coded Tailwind palette colors out of components", () => {
    const palette =
      /\b(?:bg|text|border|ring|from|to|via|fill|stroke)-(?:amber|sky|rose|emerald|orange|violet|slate|red|green|blue|yellow|lime|purple|pink|gray|zinc|neutral|stone)-\d/;
    const offenders = [
      "../components/today/labels.ts",
      "../app/tasks/TaskBoard.tsx",
      "../app/captures/[id]/page.tsx",
    ].filter((file) =>
      palette.test(readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});

function fakeEnv(initial: { stored?: string; attr?: string } = {}) {
  const store = new Map<string, string>();
  if (initial.stored) store.set(THEME_STORAGE_KEY, initial.stored);
  const attrs = new Map<string, string>();
  if (initial.attr) attrs.set("data-theme", initial.attr);
  return {
    store,
    attrs,
    env: {
      storage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
      root: {
        getAttribute: (k: string) => attrs.get(k) ?? null,
        setAttribute: (k: string, v: string) => void attrs.set(k, v),
      },
    },
  };
}

describe("theme store", () => {
  it("parses only the three known themes", () => {
    expect(THEMES).toEqual(["sandstone", "blueprint", "dark"]);
    expect(parseTheme("blueprint")).toBe("blueprint");
    expect(parseTheme("sepia")).toBeNull();
    expect(parseTheme("system")).toBeNull();
    expect(parseTheme(undefined)).toBeNull();
  });

  it("defaults to Sandstone and prefers the attribute the boot script set", () => {
    expect(createThemeStore(fakeEnv().env).get()).toBe(DEFAULT_THEME);
    expect(createThemeStore(fakeEnv({ stored: "dark" }).env).get()).toBe("dark");
    expect(createThemeStore(fakeEnv({ stored: "dark", attr: "blueprint" }).env).get()).toBe(
      "blueprint",
    );
    expect(createThemeStore(fakeEnv({ attr: "garbage" }).env).get()).toBe("sandstone");
  });

  it("applies, caches and announces a change", () => {
    const { env, store, attrs } = fakeEnv();
    const themeStore = createThemeStore(env);
    let calls = 0;
    const off = themeStore.subscribe(() => (calls += 1));
    themeStore.set("dark");
    expect(attrs.get("data-theme")).toBe("dark");
    expect(store.get(THEME_STORAGE_KEY)).toBe("dark");
    expect(themeStore.get()).toBe("dark");
    expect(calls).toBe(1);
    off();
    themeStore.set("blueprint");
    expect(calls).toBe(1);
  });

  it("lets the account value replace the cache, but not a save still in flight", async () => {
    const { env, attrs, store } = fakeEnv({ stored: "sandstone", attr: "sandstone" });
    const themeStore = createThemeStore(env);
    themeStore.syncFromAccount("dark");
    expect(attrs.get("data-theme")).toBe("dark");
    expect(store.get(THEME_STORAGE_KEY)).toBe("dark");

    let finish!: () => void;
    const pending = themeStore.trackSave(new Promise<void>((r) => (finish = r)));
    themeStore.set("blueprint");
    themeStore.syncFromAccount("dark");
    expect(themeStore.get()).toBe("blueprint");
    finish();
    await pending;
    themeStore.syncFromAccount("blueprint");
    expect(themeStore.get()).toBe("blueprint");
  });

  it("survives storage that throws", () => {
    const themeStore = createThemeStore({
      storage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("full");
        },
      },
      root: null,
    });
    expect(themeStore.get()).toBe("sandstone");
    expect(() => themeStore.set("dark")).not.toThrow();
  });

  it("ships a boot script that only accepts known themes", () => {
    const attrs = new Map<string, string>();
    const run = (stored: string | null) => {
      attrs.clear();
      new Function("localStorage", "document", THEME_BOOT_SCRIPT)(
        { getItem: () => stored },
        { documentElement: { setAttribute: (k: string, v: string) => attrs.set(k, v) } },
      );
      return attrs.get("data-theme");
    };
    expect(run("dark")).toBe("dark");
    expect(run("blueprint")).toBe("blueprint");
    expect(run("sepia")).toBeUndefined();
    expect(run(null)).toBeUndefined();
    expect(() =>
      new Function("localStorage", "document", THEME_BOOT_SCRIPT)(
        {
          getItem: () => {
            throw new Error("denied");
          },
        },
        {},
      ),
    ).not.toThrow();
  });
});
