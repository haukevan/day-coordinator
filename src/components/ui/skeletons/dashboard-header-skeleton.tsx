import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for the dashboard page header ("Your events" + count + new event button) */
export function DashboardHeaderSkeleton() {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div>
        <Skeleton className="mb-1 h-6 w-36 sm:h-7" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-8 w-28 rounded-md" />
    </div>
  );
}

/** Full dashboard page skeleton: header + card grid */
export function DashboardPageSkeleton() {
  return (
    <div className="px-4 py-5 sm:p-6">
      <DashboardHeaderSkeleton />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col rounded-xl border border-border bg-card p-5"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="mb-2">
              <Skeleton className="h-5 w-28 rounded-md" />
            </div>
            <div className="mb-4 flex items-center gap-1.5">
              <Skeleton className="size-3.5 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="mt-auto flex items-center justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="size-3.5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
