"use client";

import { useCallback, useState } from "react";

import type { Theme } from "@/lib/theme";

import { getThemeStore, useTheme } from "./useTheme";

export type PersistTheme = (theme: Theme) => Promise<{ ok: boolean; message: string }>;
export type SaveStatus = "idle" | "saving" | "saved" | "local";

/**
 * Applies a theme at once (the page and the browser cache change before any network call), then
 * saves it to the account in the background. A failed save never undoes the choice.
 */
export function useThemeChoice(persist?: PersistTheme) {
  const theme = useTheme();
  const [status, setStatus] = useState<SaveStatus>("idle");

  const choose = useCallback(
    (next: Theme) => {
      const store = getThemeStore();
      store.set(next);
      if (!persist) return;
      setStatus("saving");
      store
        .trackSave(persist(next))
        .then((result) => setStatus(result.ok ? "saved" : "local"))
        .catch(() => setStatus("local"));
    },
    [persist],
  );

  return { theme, choose, status };
}
