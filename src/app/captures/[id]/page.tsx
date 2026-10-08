import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ItemCard } from "@/components/proposals/ItemCard";
import { requireUser } from "@/server/auth";
import { getCapture } from "@/server/repositories/captures";
import { getLatestHarnessRunForCapture } from "@/server/repositories/harnessRuns";
import { listProposalItemsForCapture } from "@/server/repositories/proposals";
import { RISK_STOP_MESSAGE } from "@/server/safety";

import {
  approveItemsAction,
  rejectItemsAction,
  updateProposalItemAction,
} from "@/app/captures/actions";

export default async function CaptureReviewPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading your note…</p>}>
      <CaptureReviewContent params={params} />
    </Suspense>
  );
}

async function CaptureReviewContent({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  const capture = await getCapture(user.userId, id);
  if (!capture) notFound();
  const [items, run] = await Promise.all([
    listProposalItemsForCapture(user.userId, capture.id),
    getLatestHarnessRunForCapture(user.userId, capture.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <Link
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        href="/today"
      >
        ← Today
      </Link>
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Review your note</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Check what LTS understood
        </h1>
        <blockquote className="rounded-xl border bg-card px-4 py-3 text-sm leading-relaxed sm:px-5">
          {capture.text}
        </blockquote>
      </header>

      {capture.safetyStop ? (
        <div
          role="status"
          className="rounded-xl border border-gold/50 bg-gold-soft p-4 text-sm leading-relaxed"
        >
          {RISK_STOP_MESSAGE}
        </div>
      ) : (
        <>
          {run?.status === "fell_back" ? (
            <p
              role="status"
              className="rounded-xl border border-gold/50 bg-gold-soft p-4 text-sm leading-relaxed"
            >
              AI interpretation was unavailable, so LTS used its built-in parser. Review these
              suggestions before approving anything.
            </p>
          ) : null}
          {items.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  captureId={capture.id}
                  updateAction={updateProposalItemAction}
                  approveAction={approveItemsAction}
                  rejectAction={rejectItemsAction}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              I couldn&apos;t turn that note into a change. Try adding a day, a time, or a clear
              task.
            </div>
          )}
        </>
      )}
    </div>
  );
}
