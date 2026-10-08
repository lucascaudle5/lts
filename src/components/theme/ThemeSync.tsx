"use client";

import { useEffect } from "react";

import type { Theme } from "@/lib/theme";

import { getThemeStore } from "./useTheme";

/** Renders nothing. Brings the browser's cached theme in line with the one saved on the account. */
export function ThemeSync({ accountTheme }: { accountTheme: Theme }) {
  useEffect(() => {
    getThemeStore().syncFromAccount(accountTheme);
  }, [accountTheme]);
  return null;
}
