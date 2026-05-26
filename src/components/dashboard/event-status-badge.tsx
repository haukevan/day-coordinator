import { cn } from "@/lib/utils";

type EventStatus = "DRAFT" | "SCHEDULED" | "LIVE" | "COMPLETED" | "ARCHIVED";

const statusConfig: Record<EventStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground" },
  SCHEDULED: { label: "Scheduled", className: "bg-info/15 text-info" },
  LIVE: { label: "Live", className: "bg-success/15 text-success" },
  COMPLETED: { label: "Completed", className: "bg-muted text-muted-foreground" },
  ARCHIVED: { label: "Archived", className: "bg-muted/60 text-muted-foreground/60" },
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const config = statusConfig[status] ?? statusConfig.DRAFT;
  return (
    <span
      className={cn(
        "inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
        config.className
      )}
    >
      {status === "LIVE" && (
        <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-success" />
      )}
      {config.label}
    </span>
  );
}
