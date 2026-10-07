import { Suspense } from "react";

import { signOut } from "@/app/(auth)/actions";
import { AccountMenu } from "@/components/shell/AccountMenu";
import { AppShell } from "@/components/shell/AppShell";
import { getSessionUser } from "@/server/auth";

export default function TodayLayout({ children }: LayoutProps<"/today">) {
  return (
    <AppShell
      account={
        <Suspense fallback={null}>
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
  return user ? <AccountMenu email={user.email} signOut={signOut} /> : null;
}
