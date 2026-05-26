import { cn } from "@/lib/utils";

type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "DELAYED" | "SKIPPED";

const config: Record<TaskStatus, { label: string; className: string }> = {
  PENDING: { label: "Up next", className: "bg-muted text-muted-foreground" },
  IN_PROGRESS: { label: "Live", className: "bg-primary/15 text-primary" },
  COMPLETED: { label: "Done", className: "bg-success/15 text-success" },
  DELAYED: { label: "Delayed", className: "bg-warning/15 text-warning" },
  SKIPPED: { label: "Skipped", className: "bg-muted text-muted-foreground" },
};

export function TaskStatusBadge({ status }: { status: string }) {
  const c = config[status as TaskStatus] ?? config.PENDING;
  return (
    <span className={cn("flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", c.className)}>
      {c.label}
    </span>
  );
}
