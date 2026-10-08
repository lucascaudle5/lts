import { createCaptureAction } from "@/app/captures/actions";
import { Button } from "@/components/ui/button";

/** The hero of Today: a raised card with a gold edge and a serif prompt. */
export function CaptureForm({ invalid = false }: { invalid?: boolean }) {
  return (
    <section
      aria-label="Capture a note"
      className="rounded-2xl border border-l-[5px] border-l-gold bg-card p-4 shadow-raised sm:p-5"
    >
      <form action={createCaptureAction} className="space-y-3">
        <label
          htmlFor="capture-text"
          className="block font-heading text-xl leading-7 font-semibold"
        >
          What&apos;s going on?
        </label>
        <textarea
          id="capture-text"
          name="text"
          required
          maxLength={2000}
          rows={3}
          placeholder="Dentist Friday 3–4pm, need groceries…"
          className="focus-visible:outline-focus w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-[15px] placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        {invalid ? (
          <p role="alert" className="text-sm text-destructive">
            Add a note between 1 and 2,000 characters.
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" variant="gold" size="lg">
            See what I heard
          </Button>
        </div>
      </form>
    </section>
  );
}
