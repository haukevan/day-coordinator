import { Skeleton } from "@/components/ui/skeleton";

export function VendorCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4">
      {/* Icon + name + email row */}
      <div className="mb-2 flex items-start gap-2">
        <Skeleton className="size-4 shrink-0 mt-0.5 rounded-full" />
        <div className="min-w-0 flex-1">
          <Skeleton className="mb-1 h-4 w-32" />
          <Skeleton className="h-3 w-44" />
        </div>
      </div>

      {/* Phone */}
      <Skeleton className="mb-0.5 h-3 w-28" />

      {/* Company */}
      <Skeleton className="mb-0.5 h-3 w-28" />

      {/* Job title */}
      <Skeleton className="h-3 w-20" />

      {/* Footer: event count */}
      <div className="mt-auto flex items-center gap-1.5 pt-3 border-t border-border">
        <Skeleton className="size-3 shrink-0 rounded-full" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

/** Grid of vendor card skeletons */
export function VendorCardSkeletonGrid({
  count = 6,
}: {
  readonly count?: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <VendorCardSkeleton key={`vendor-sk-${i}`} />
      ))}
    </div>
  );
}
