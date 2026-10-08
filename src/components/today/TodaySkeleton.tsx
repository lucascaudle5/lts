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
    <div className="space-y-8" aria-busy="true" aria-label="Loading your day">
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-8">
          <Rows count={4} />
          <Rows count={1} />
        </div>
        <div className="space-y-8">
          <Rows count={3} />
          <Rows count={2} />
        </div>
      </div>
    </div>
  );
}
