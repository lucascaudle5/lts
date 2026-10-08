export const THEMES = ["sandstone", "blueprint", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "sandstone";
export const THEME_STORAGE_KEY = "nova-theme";

export const THEME_LABEL: Record<Theme, string> = {
  sandstone: "Sandstone",
  blueprint: "Blueprint",
  dark: "Dark",
};

export const THEME_BLURB: Record<Theme, string> = {
  sandstone: "Warm paper and ink. The default.",
  blueprint: "Cool, light and crisp.",
  dark: "Low glare for the evening.",
};

export function parseTheme(value: unknown): Theme | null {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value)
    ? (value as Theme)
    : null;
}

/**
 * Runs in <head> before first paint so the saved theme is on <html> before anything is drawn.
 * The server always renders the same markup (Sandstone); this only reads the browser cache.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(${JSON.stringify(THEMES)}.indexOf(t)>-1)document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface RootLike {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  classList?: { add(name: string): void; remove(name: string): void };
}

export interface ThemeEnv {
  storage: StorageLike | null;
  root: RootLike | null;
  /** Called after the theme changes, to animate the switch. Browser only. */
  animate?: (root: RootLike) => void;
}

export interface ThemeStore {
  get(): Theme;
  set(theme: Theme): void;
  subscribe(listener: () => void): () => void;
  /** Applies the account's theme unless a save of a newer choice is still in flight. */
  syncFromAccount(theme: Theme): void;
  /** Wraps a save so account syncs ignore stale values until it settles. */
  trackSave<T>(save: Promise<T>): Promise<T>;
}

/** The browser-side theme state: <html data-theme> is the truth, localStorage is only a cache. */
export function createThemeStore(env: ThemeEnv): ThemeStore {
  const listeners = new Set<() => void>();
  let saving = 0;

  function get(): Theme {
    return (
      parseTheme(env.root?.getAttribute("data-theme")) ??
      parseTheme(readStorage(env.storage)) ??
      DEFAULT_THEME
    );
  }

  function cache(theme: Theme) {
    try {
      env.storage?.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Private mode or a full quota: the account value still wins on the next visit.
    }
  }

  function set(theme: Theme) {
    if (get() !== theme) env.animate?.(env.root!);
    env.root?.setAttribute("data-theme", theme);
    cache(theme);
    for (const listener of listeners) listener();
  }

  return {
    get,
    set,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    syncFromAccount(theme) {
      if (saving > 0) return;
      if (get() !== theme) set(theme);
      else cache(theme);
    },
    async trackSave(save) {
      saving += 1;
      try {
        return await save;
      } finally {
        saving -= 1;
      }
    },
  };
}

function readStorage(storage: StorageLike | null): string | null {
  try {
    return storage?.getItem(THEME_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}
