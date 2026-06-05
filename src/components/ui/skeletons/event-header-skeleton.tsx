import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for the event layout header (used in event detail layouts) */
export function EventHeaderSkeleton() {
  return (
    <div className="border-b border-border bg-card px-3 py-2 sm:px-6 sm:py-3">
      {/* Title row */}
      <div className="flex items-center gap-1.5">
        {/* Back chevron */}
        <Skeleton className="size-7 rounded" />
        {/* Title */}
        <Skeleton className="h-6 w-48 sm:w-64" />
      </div>

      {/* Metadata row: status, date, venue */}
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {/* Status badge */}
        <Skeleton className="h-6 w-20 rounded-full" />
        {/* Date chip */}
        <Skeleton className="h-5 w-28 rounded-md" />
        {/* Venue chip */}
        <Skeleton className="h-5 w-24 rounded-md" />
      </div>

      {/* Tab bar */}
      <div className="mt-2 flex gap-1">
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
}
