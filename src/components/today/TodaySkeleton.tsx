import { Skeleton } from "@/components/ui/skeleton";

function Rows({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function TodaySkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Opening your day">
      <div className="space-y-2">
        <Skeleton className="h-3 w-44" />
        <Skeleton className="h-9 w-56 max-w-full" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <Skeleton className="h-44 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Rows count={3} />
    </div>
  );
}
