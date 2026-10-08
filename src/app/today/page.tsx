import type { Metadata } from "next";
import { Suspense } from "react";

import { TodaySkeleton } from "@/components/today/TodaySkeleton";
import { TodayView } from "@/components/today/TodayView";
import { requireUser } from "@/server/auth";
import { getToday } from "@/server/today";

export const metadata: Metadata = { title: "Today · LTS" };

export default function TodayPage() {
  return (
    <Suspense fallback={<TodaySkeleton />}>
      <TodayContent />
    </Suspense>
  );
}

async function TodayContent() {
  const user = await requireUser();
  const view = await getToday(user.userId, user.timezone, new Date());
  return <TodayView view={view} />;
}
