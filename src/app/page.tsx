import { Button } from "@/components/ui/button";

const pipeline = [
  "Say what is going on, in your own words",
  "LTS proposes typed changes and asks only for what is missing",
  "You approve, edit, or reject each change",
  "Today shows what you approved — nothing else",
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-2">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Life Tracker Suite 1.0 · skeleton
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Messy life in. Approved action out.
        </h1>
        <p className="text-muted-foreground">
          This build is the repository skeleton (milestone M0). Sign-in and Today arrive in M2,
          Capture and approval in M3 — see <code>docs/DEVELOPMENT_PLAYBOOK.md</code>.
        </p>
      </header>

      <ol className="space-y-3">
        {pipeline.map((step, i) => (
          <li key={step} className="flex gap-3 rounded-lg border p-4">
            <span className="font-mono text-sm text-muted-foreground">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <div>
        <Button disabled>Capture opens in M3</Button>
      </div>
    </main>
  );
}
