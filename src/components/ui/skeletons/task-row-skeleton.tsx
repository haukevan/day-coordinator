import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function TaskRowSkeleton({ depth = 0 }: { depth?: number }) {
  return (
    <div
      style={{ paddingLeft: depth > 0 ? `${depth * 20}px` : undefined }}
      className={cn(depth > 0 && "relative")}
    >
      {depth > 0 && (
        <div className="absolute left-3 top-0 bottom-0 w-px bg-border/60" />
      )}
      <div className="flex items-center gap-3 rounded-xl border border-l-[3px] border-border bg-card/60 px-4 py-3.5">
        {/* Status dot */}
        <Skeleton className="size-2 flex-shrink-0 rounded-full" />

        {/* Title */}
        <div className="min-w-0 flex-1">
          <Skeleton className="mb-1 h-4 w-48" />
          <Skeleton className="h-3 w-24" />
        </div>

        {/* Time range */}
        <div className="hidden sm:flex items-center gap-1.5">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-3 w-6" />
          <Skeleton className="h-4 w-14" />
        </div>

        {/* Dependency icon placeholder */}
        <Skeleton className="size-4 flex-shrink-0" />
      </div>
    </div>
  );
}

/** List of task row skeletons for timeline loading state */
export function TaskRowSkeletonList({
  count = 6,
}: {
  readonly count?: number;
}) {
  // Mix of root tasks (depth=0) and child tasks (depth=1) for realistic look
  const depths = Array.from({ length: count }).map((_, i) =>
    i % 3 === 1 ? 1 : 0,
  );

  return (
    <div className="flex flex-col gap-2">
      {depths.map((depth, i) => (
        <TaskRowSkeleton key={`task-sk-${i}`} depth={depth} />
      ))}
    </div>
  );
}
