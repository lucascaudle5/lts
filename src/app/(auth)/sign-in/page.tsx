import type { Metadata } from "next";
import { Suspense } from "react";

import { SignInNotice } from "@/contracts/auth";
import { SignInForm } from "@/components/auth/SignInForm";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { signIn } from "@/app/(auth)/actions";
import { getSupabaseConfig } from "@/server/supabase";

export const metadata: Metadata = { title: "Sign in · LTS" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-5 py-12">
      <header className="space-y-2">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Life Tracker Suite
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to see your day</h1>
        <p className="text-sm text-muted-foreground">
          Sign in with your email and password. Your data stays in sync across devices.
        </p>
      </header>
      <Suspense fallback={<Skeleton className="h-36 w-full" />}>
        <SignInContent searchParams={searchParams} />
      </Suspense>
      <div className="flex justify-end">
        <ThemeSwitch tone="page" />
      </div>
    </main>
  );
}

async function SignInContent({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  const params = await searchParams;
  const notice = SignInNotice.safeParse(params.notice);
  const configured = getSupabaseConfig() !== null;
  return (
    <SignInForm
      action={signIn}
      next={typeof params.next === "string" ? params.next : undefined}
      notice={configured ? (notice.success ? notice.data : undefined) : "not_configured"}
      configured={configured}
    />
  );
}
