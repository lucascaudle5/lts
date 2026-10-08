import { createCaptureAction } from "@/app/captures/actions";

export function CaptureForm({ invalid = false }: { invalid?: boolean }) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <form action={createCaptureAction} className="space-y-3">
        <label htmlFor="capture-text" className="block font-medium">
          What&apos;s going on?
        </label>
        <textarea
          id="capture-text"
          name="text"
          required
          maxLength={2000}
          rows={3}
          placeholder="Dentist Friday 3–4pm, need groceries…"
          className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
        {invalid ? (
          <p role="alert" className="text-sm text-destructive">
            Add a note between 1 and 2,000 characters.
          </p>
        ) : null}
        <div className="flex justify-end">
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            type="submit"
          >
            Review note
          </button>
        </div>
      </form>
    </section>
  );
}
