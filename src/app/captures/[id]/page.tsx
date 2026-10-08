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
    <Suspense fallback={<p className="text-sm text-muted-foreground">Opening your note…</p>}>
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
        className="inline-flex min-h-11 items-center text-sm text-ink-soft underline underline-offset-4"
        href="/today"
      >
        ← Today
      </Link>
      <header className="space-y-3">
        <p className="eyebrow text-muted-foreground">Your note</p>
        <h1 className="text-3xl">Here&apos;s what I heard</h1>
        <blockquote className="rounded-2xl border border-l-[6px] border-l-gold bg-card px-5 py-4 font-heading text-lg leading-relaxed shadow-paper sm:px-6">
          {capture.text}
        </blockquote>
        <p className="text-sm text-ink-soft">
          Nothing changes until you approve it. Edit anything that is off.
        </p>
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
            <div className="rounded-2xl border border-dashed border-line-strong/60 p-6 text-sm text-ink-soft">
              I couldn&apos;t turn that note into a change. Try adding a day, a time, or a clear
              task.
            </div>
          )}
        </>
      )}
    </div>
  );
}
