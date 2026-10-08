import type { Metadata } from "next";
import { Suspense } from "react";

import { TodaySkeleton } from "@/components/today/TodaySkeleton";
import { TodayView } from "@/components/today/TodayView";
import { requireUser } from "@/server/auth";
import { getToday } from "@/server/today";
import { CaptureForm } from "./CaptureForm";

export const metadata: Metadata = { title: "Today · LTS" };

export default function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string; capture?: string }>;
}) {
  return (
    <Suspense fallback={<TodaySkeleton />}>
      <TodayContent searchParams={searchParams} />
    </Suspense>
  );
}

async function TodayContent({
  searchParams,
}: {
  searchParams: Promise<{ added?: string; capture?: string }>;
}) {
  const query = await searchParams;
  const user = await requireUser();
  const view = await getToday(user.userId, user.timezone, new Date());
  const added = Number.parseInt(query.added ?? "", 10);
  return (
    <div className="space-y-8">
      {Number.isInteger(added) && added > 0 ? (
        <p
          role="status"
          className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm"
        >
          Added {added} {added === 1 ? "change" : "changes"}.
        </p>
      ) : null}
      <CaptureForm invalid={query.capture === "invalid"} />
      <TodayView view={view} />
    </div>
  );
}
