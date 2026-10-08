import { Suspense, type ReactNode } from "react";

import { signOut } from "@/app/(auth)/actions";
import { saveThemeAction } from "@/app/settings/actions";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { ThemeSync } from "@/components/theme/ThemeSync";
import { DEFAULT_THEME, parseTheme } from "@/lib/theme";
import { getSessionUser } from "@/server/auth";
import { getPreferences } from "@/server/repositories/profiles";

import { AccountMenu } from "@/components/shell/AccountMenu";
import { AppShell } from "@/components/shell/AppShell";

/** The one layout every signed-in page shares: the rail, the quick switch and the account menu. */
export function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      account={
        <Suspense fallback={<ThemeSwitch />}>
          <Account />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}

async function Account() {
  const user = await getSessionUser();
  if (!user) return <ThemeSwitch />;
  const preferences = await getPreferences(user.userId);
  return (
    <>
      <ThemeSync accountTheme={parseTheme(preferences?.theme) ?? DEFAULT_THEME} />
      <ThemeSwitch persist={saveThemeAction} />
      <AccountMenu email={user.email} signOut={signOut} />
    </>
  );
}
