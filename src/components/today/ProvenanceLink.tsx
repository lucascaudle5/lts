import Link from "next/link";
import { format, parseISO } from "date-fns";

export function ProvenanceLink({
  provenance,
}: {
  provenance: { captureId: string; referenceDate: string } | null;
}) {
  if (!provenance) return null;
  const date = format(parseISO(provenance.referenceDate), "MMM d");
  return (
    <Link
      className="text-xs text-muted-foreground underline-offset-4 hover:underline"
      href={`/captures/${provenance.captureId}`}
    >
      From your note on {date}
    </Link>
  );
}
