"use client";

import { Check } from "lucide-react";
import { cn } from "cn";
import { useId } from "react";

import { useThemeChoice, type PersistTheme } from "@/components/theme/useThemeChoice";
import { THEME_BLURB, THEME_LABEL, THEMES } from "@/lib/theme";

/** Settings → Appearance. Each swatch is painted with its own theme's tokens. */
export function AppearanceCard({ persist }: { persist: PersistTheme }) {
  const { theme, choose, status } = useThemeChoice(persist);
  const name = useId();
  return (
    <section
      aria-labelledby="appearance-title"
      className="space-y-4 rounded-2xl border bg-card p-5 shadow-paper"
    >
      <div className="space-y-1">
        <h2 id="appearance-title" className="text-lg">
          Appearance
        </h2>
        <p className="text-sm text-muted-foreground">
          Pick the look that suits the hour. It follows you to every device you sign in on.
        </p>
      </div>
      <fieldset className="m-0 grid min-w-0 gap-3 border-0 p-0 sm:grid-cols-3">
        <legend className="sr-only">Theme</legend>
        {THEMES.map((value) => (
          <label key={value} className="relative block">
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
                "block cursor-pointer space-y-3 rounded-xl border-2 border-line-strong/40 bg-surface-2 p-3 transition-colors hover:bg-surface-3",
                "peer-focus-visible:outline-focus peer-checked:border-gold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
              )}
            >
              <span
                data-theme={value}
                aria-hidden
                className="block space-y-2 rounded-lg border border-border bg-background p-3 text-foreground shadow-paper"
              >
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-gold" />
                  <span className="h-1.5 w-10 rounded-full bg-foreground/70" />
                </span>
                <span className="block rounded-md border-l-4 border-l-gold bg-card px-2 py-1.5">
                  <span className="block h-1.5 w-16 rounded-full bg-foreground/60" />
                  <span className="mt-1.5 block h-1.5 w-10 rounded-full bg-muted-foreground/60" />
                </span>
                <span className="block h-4 w-12 rounded-md bg-primary" />
              </span>
              <span className="flex items-start justify-between gap-2">
                <span>
                  <span className="block font-heading font-semibold">{THEME_LABEL[value]}</span>
                  <span className="block text-sm text-muted-foreground">{THEME_BLURB[value]}</span>
                </span>
                {theme === value ? (
                  <Check aria-hidden className="mt-1 size-4 shrink-0 text-gold-text" />
                ) : null}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <p role="status" className="min-h-5 text-sm text-muted-foreground">
        {status === "saved"
          ? "Saved. NOVA will look like this everywhere you sign in."
          : status === "local"
            ? "Saved on this device only. We couldn't reach your account just now."
            : ""}
      </p>
    </section>
  );
}
