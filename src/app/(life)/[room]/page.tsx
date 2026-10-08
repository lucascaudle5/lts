import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getWorkspace } from "@/server/workspace";
import { LifeWorkspace } from "@/app/(life)/LifeWorkspace";
import { workspaceAction } from "@/app/(life)/actions";

const rooms = [
  "schedule",
  "habits",
  "routines",
  "fitness",
  "diet",
  "mind",
  "projects",
  "money",
  "review",
  "history",
  "archive",
  "sandbox",
  "inbox",
];
export default function RoomPage({ params }: { params: Promise<{ room: string }> }) {
  return (
    <Suspense fallback={<p className="py-12 text-muted-foreground">Opening your workspace…</p>}>
      <Room params={params} />
    </Suspense>
  );
}
async function Room({ params }: { params: Promise<{ room: string }> }) {
  const { room } = await params;
  if (!rooms.includes(room)) notFound();
  const user = await requireUser();
  const data = await getWorkspace(user.userId, user.timezone);
  return <LifeWorkspace room={room} data={data} act={workspaceAction} />;
}
