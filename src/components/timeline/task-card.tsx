import { cn } from "@/lib/utils";
import { TaskStatusBadge } from "./task-status-badge";
import { formatTimeInZone } from "@/lib/format-time";
import type { SerializedTask } from "@/lib/types";

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const statusStyles: Record<string, { wrapper: string; dot: string }> = {
  PENDING: {
    wrapper: "border-border bg-card/60",
    dot: "bg-muted-foreground/40",
  },
  IN_PROGRESS: {
    wrapper: "border-primary/40 bg-primary/5 ring-1 ring-primary/20",
    dot: "bg-primary animate-pulse",
  },
  COMPLETED: {
    wrapper: "border-border bg-card/40 opacity-60",
    dot: "bg-success",
  },
  DELAYED: {
    wrapper: "border-warning/40 bg-warning/5 ring-1 ring-warning/20",
    dot: "bg-warning",
  },
  SKIPPED: {
    wrapper: "border-border bg-card/30 opacity-40",
    dot: "bg-muted-foreground/30",
  },
};

export function TaskCard({
  task,
  timezone,
}: {
  task: SerializedTask;
  timezone: string;
}) {
  const style = statusStyles[task.status] ?? statusStyles.PENDING;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-colors",
        style.wrapper,
      )}
    >
      <div className={cn("size-2 flex-shrink-0 rounded-full", style.dot)} />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium text-foreground",
            (task.status === "COMPLETED" || task.status === "SKIPPED") &&
              "line-through text-muted-foreground",
          )}
        >
          {task.title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {task.scheduledStart
            ? formatTimeInZone(task.scheduledStart, timezone)
            : "No time set"}
          {task.durationMins ? ` · ${formatDuration(task.durationMins)}` : ""}
        </p>
      </div>
      <TaskStatusBadge status={task.status} />
    </div>
  );
}
