import { cn } from "@/lib/utils";

type TaskStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "DELAYED"
  | "SKIPPED";

const config: Record<TaskStatus, { label: string; className: string }> = {
  PENDING: { label: "Up next", className: "bg-muted text-muted-foreground" },
  IN_PROGRESS: { label: "Live", className: "bg-primary/15 text-primary" },
  COMPLETED: { label: "Done", className: "bg-success/15 text-success" },
  DELAYED: { label: "Delayed", className: "bg-warning/15 text-warning" },
  SKIPPED: { label: "Skipped", className: "bg-muted text-muted-foreground" },
};

/** Day-of live mode labels override the default labels. */
const liveConfig: Record<string, { label: string; className: string }> = {
  "up-next": {
    label: "Up next",
    className: "bg-accent/20 text-accent ring-1 ring-accent/30",
  },
  ready: { label: "Ready", className: "bg-muted text-muted-foreground" },
  "in-progress": {
    label: "Live",
    className: "bg-primary/15 text-primary animate-pulse",
  },
  delayed: { label: "Delayed", className: "bg-warning/15 text-warning" },
  done: { label: "Done", className: "bg-success/15 text-success" },
  skipped: { label: "Skipped", className: "bg-muted text-muted-foreground" },
};

interface TaskStatusBadgeProps {
  status: string;
  /** Optional live mode day-of status for contextual labels */
  liveStatus?: string;
  /** When delayed, the delay amount in minutes for display */
  delayAmountMins?: number | null;
}

export function TaskStatusBadge({
  status,
  liveStatus,
  delayAmountMins,
}: TaskStatusBadgeProps) {
  // Use live mode label if available, otherwise fall back to default
  const c = liveStatus
    ? (liveConfig[liveStatus] ?? config[status as TaskStatus] ?? config.PENDING)
    : (config[status as TaskStatus] ?? config.PENDING);

  // Build display label: show delay amount for delayed tasks
  let label = c.label;
  if (status === "DELAYED" && delayAmountMins != null) {
    label = `Delayed ${delayAmountMins}m`;
  }

  return (
    <span
      className={cn(
        "flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
        c.className,
      )}
    >
      {label}
    </span>
  );
}
