import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { TodayBoard } from "@/components/today/TodayBoard";
import { TodaySkeleton } from "@/components/today/TodaySkeleton";
import { requireUser } from "@/server/auth";
import { getToday } from "@/server/today";
import { CaptureForm } from "./CaptureForm";
import { getWorkspace } from "@/server/workspace";
import { workspaceAction } from "@/app/(life)/actions";

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
  const workspace = await getWorkspace(user.userId, user.timezone);
  if (workspace.records.some((record) => !record.archivedAt)) view.isEmpty = false;
  const added = Number.parseInt(query.added ?? "", 10);
  return (
    <TodayBoard
      view={view}
      data={workspace}
      act={workspaceAction}
      capture={<CaptureForm invalid={query.capture === "invalid"} />}
      banner={
        Number.isInteger(added) && added > 0 ? (
          <p
            role="status"
            className="rounded-xl border border-room/40 bg-room-soft px-4 py-3 text-sm font-medium text-room-ink"
          >
            Added {added} {added === 1 ? "change" : "changes"}. You can undo it from{" "}
            <Link href="/history" className="underline underline-offset-4">
              History
            </Link>
            .
          </p>
        ) : null
      }
    />
  );
}
