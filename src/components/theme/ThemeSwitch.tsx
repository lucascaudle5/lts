"use client";

import { Moon, Ruler, ScrollText, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { useId } from "react";

import { THEMES, THEME_LABEL, type Theme } from "@/lib/theme";

import { useThemeChoice, type PersistTheme } from "./useThemeChoice";

const ICON: Record<Theme, LucideIcon> = {
  sandstone: ScrollText,
  blueprint: Ruler,
  dark: Moon,
};

export interface ThemeSwitchProps {
  /** Saves to the account. Left out on /demo and sign-in, where the choice stays in this browser. */
  persist?: PersistTheme;
  /** `rail` sits on the dark header; `page` sits on the page background. */
  tone?: "rail" | "page";
}

/** Three-segment quick switch: paper, rule and moon. */
export function ThemeSwitch({ persist, tone = "rail" }: ThemeSwitchProps) {
  const { theme, choose, status } = useThemeChoice(persist);
  const name = useId();
  return (
    <div className="flex items-center gap-2">
      {status === "local" ? (
        <span className="hidden text-xs opacity-80 sm:inline">Saved on this device only</span>
      ) : null}
      <fieldset
        className={cn(
          "m-0 flex min-w-0 gap-0.5 rounded-lg border-0 p-0.5",
          tone === "rail" ? "bg-rail-ink/10" : "bg-surface-2",
        )}
      >
        <legend className="sr-only">Theme</legend>
        {THEMES.map((value) => {
          const Icon = ICON[value];
          return (
            <label key={value} title={THEME_LABEL[value]} className="relative">
              <input
                type="radio"
                name={name}
                value={value}
                checked={theme === value}
                onChange={() => choose(value)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex size-10 cursor-pointer items-center justify-center rounded-md transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-gold",
                  tone === "rail"
                    ? "text-rail-ink/80 peer-checked:bg-rail-ink peer-checked:text-rail hover:bg-rail-ink/15"
                    : "text-muted-foreground peer-checked:bg-primary peer-checked:text-primary-foreground hover:bg-surface-3",
                )}
              >
                <Icon aria-hidden className="size-[18px]" strokeWidth={1.75} />
                <span className="sr-only">{THEME_LABEL[value]}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <span role="status" className="sr-only">
        {status === "saved"
          ? "Theme saved"
          : status === "local"
            ? "Theme saved on this device only"
            : ""}
      </span>
    </div>
  );
}
