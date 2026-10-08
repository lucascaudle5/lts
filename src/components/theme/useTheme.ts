"use client";

import { useSyncExternalStore } from "react";

import {
  createThemeStore,
  DEFAULT_THEME,
  parseTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/theme";

function browserStore() {
  if (typeof document === "undefined") {
    return createThemeStore({ storage: null, root: null });
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const store = createThemeStore({
    storage: window.localStorage,
    root: document.documentElement,
    animate(root) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      root.classList?.add("theme-fade");
      clearTimeout(timer);
      timer = setTimeout(() => root.classList?.remove("theme-fade"), 260);
    },
  });
  window.addEventListener("storage", (event) => {
    const next = event.key === THEME_STORAGE_KEY ? parseTheme(event.newValue) : null;
    if (next) store.set(next);
  });
  return store;
}

let cached: ReturnType<typeof browserStore> | undefined;
export function getThemeStore() {
  cached ??= browserStore();
  return cached;
}

export function useTheme(): Theme {
  const store = getThemeStore();
  return useSyncExternalStore(store.subscribe, store.get, () => DEFAULT_THEME);
}
