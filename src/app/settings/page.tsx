import type { Metadata } from "next";
import { Suspense } from "react";

import { SensitiveCategory } from "@/contracts/common";
import { getAiSensitiveCategories, getPreferences } from "@/server/repositories/profiles";
import { workspaceAction } from "@/app/(life)/actions";
import { Preferences } from "./Preferences";
import { requireUser } from "@/server/auth";
import { AppearanceCard } from "./AppearanceCard";
import { saveAiCategorySettingsAction, saveThemeAction } from "./actions";

export const metadata: Metadata = { title: "Settings · LTS" };

const categoryLabels: Record<(typeof SensitiveCategory.options)[number], string> = {
  energy: "Energy",
  sleep: "Sleep",
  stress: "Stress",
  capacity: "Capacity",
  note: "Personal notes",
};

export default async function SettingsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading settings…</p>}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  const user = await requireUser();
  const enabled = new Set(await getAiSensitiveCategories(user.userId));
  const preferences = await getPreferences(user.userId);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="space-y-2">
        <p className="eyebrow text-muted-foreground">Settings</p>
        <h1 className="text-3xl">Make NOVA yours</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          How NOVA looks, when it shows times, and what it may read when it interprets your notes.
        </p>
      </header>

      <AppearanceCard persist={saveThemeAction} />
      <Preferences
        timezone={user.timezone}
        authority={preferences?.authority ?? "ask"}
        act={workspaceAction}
      />
      <form
        action={saveAiCategorySettingsAction}
        className="space-y-5 rounded-2xl border bg-card p-5 shadow-paper"
      >
        <div className="space-y-1">
          <h2 className="text-lg">AI access</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            LTS can use these observations when interpreting your notes. They stay private unless
            you turn on a category. Access is recorded with each interpretation.
          </p>
        </div>
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Sensitive observation categories</legend>
          {SensitiveCategory.options.map((category) => (
            <label key={category} className="flex items-center gap-3 text-sm">
              <input
                className="size-4 accent-primary"
                type="checkbox"
                name="category"
                value={category}
                defaultChecked={enabled.has(category)}
              />
              <span>{categoryLabels[category]}</span>
            </label>
          ))}
        </fieldset>
        <button
          className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          type="submit"
        >
          Save settings
        </button>
      </form>
    </div>
  );
}
