import { Skeleton } from "@/components/ui/skeleton";

export function VenueCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4">
      {/* Icon + name + address row */}
      <div className="mb-2 flex items-start gap-2">
        <Skeleton className="size-4 shrink-0 mt-0.5 rounded-full" />
        <div className="min-w-0">
          <Skeleton className="mb-1 h-4 w-36" />
          <Skeleton className="h-3 w-52" />
        </div>
      </div>

      {/* Description */}
      <Skeleton className="mb-3 h-3 w-full" />
      <Skeleton className="mb-3 h-3 w-3/4" />

      {/* Contact info */}
      <Skeleton className="mb-0.5 h-3 w-28" />
      <Skeleton className="mb-0.5 h-3 w-32" />
      <Skeleton className="mb-0.5 h-3 w-40" />

      {/* Footer: event count */}
      <div className="mt-auto flex items-center gap-1.5 pt-3 border-t border-border">
        <Skeleton className="size-3 shrink-0 rounded-full" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

/** Grid of venue card skeletons */
export function VenueCardSkeletonGrid({
  count = 6,
}: {
  readonly count?: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <VenueCardSkeleton key={`venue-sk-${i}`} />
      ))}
    </div>
  );
}
