import type { Metadata } from "next";
import { Suspense } from "react";

import { requireUser } from "@/server/auth";
import { getWorkspace } from "@/server/workspace";
import { LifeWorkspace } from "@/app/(life)/LifeWorkspace";
import { workspaceAction } from "@/app/(life)/actions";

export const metadata: Metadata = { title: "Tasks · LTS" };

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4" aria-label="Loading tasks">
          <div className="h-8 w-56 animate-pulse rounded bg-muted" />
          <div className="h-44 animate-pulse rounded-xl bg-muted" />
          <div className="h-28 animate-pulse rounded-xl bg-muted" />
        </div>
      }
    >
      <TasksContent />
    </Suspense>
  );
}

async function TasksContent() {
  const user = await requireUser();
  return (
    <LifeWorkspace
      room="tasks"
      data={await getWorkspace(user.userId, user.timezone)}
      act={workspaceAction}
    />
  );
}
