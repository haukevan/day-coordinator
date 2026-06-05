import { Skeleton } from "@/components/ui/skeleton";

export function EventCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-5">
      {/* Title + status badge row */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>

      {/* Venue chip */}
      <div className="mb-2">
        <Skeleton className="h-5 w-28 rounded-md" />
      </div>

      {/* Date */}
      <div className="mb-4 flex items-center gap-1.5">
        <Skeleton className="size-3.5 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Footer: task count + arrow */}
      <div className="mt-auto flex items-center justify-between">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="size-3.5" />
      </div>
    </div>
  );
}

/** Grid of event card skeletons for dashboard loading state */
export function EventCardSkeletonGrid({
  count = 6,
}: {
  readonly count?: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <EventCardSkeleton key={`event-sk-${i}`} />
      ))}
    </div>
  );
}
