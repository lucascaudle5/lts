"use client";

export default function RoomError({ retry }: { retry: () => void }) {
  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-2xl border p-6">
      <h1 className="text-xl font-semibold">This room could not load</h1>
      <p className="text-sm text-muted-foreground">
        Your saved records remain available. Check your connection and try again.
      </p>
      <button className="min-h-10 rounded-lg border px-4 text-sm" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
