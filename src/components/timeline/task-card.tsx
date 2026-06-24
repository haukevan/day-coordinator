import { Link2, Lock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskStatusBadge } from "./task-status-badge";
import { LiveActionButtons } from "./live-action-buttons";
import { formatTimeInZone, formatTimeInZoneWithDay } from "@/lib/format-time";
import type { SerializedTask } from "@/lib/types";
import type { DependencyGroupMeta } from "./dependency-groups";

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
  eventDate,
  parentTitle,
  parentStatus,
  dependencyMeta,
  onTaskClick,
  isLive = false,
  liveStatus,
  canAct = false,
  isOverdue = false,
  showLiveButtons = false,
  onOptimisticUpdate,
  onStatusChange,
}: {
  task: SerializedTask;
  timezone: string;
  eventDate?: string | null;
  parentTitle?: string | null;
  parentStatus?: string | null;
  dependencyMeta?: DependencyGroupMeta;
  onTaskClick?: (task: SerializedTask) => void;
  /** Whether the event is in LIVE mode */
  isLive?: boolean;
  /** Day-of live status label (up-next, ready, in-progress, delayed, done) */
  liveStatus?: string;
  /** Whether the current user can act on this task */
  canAct?: boolean;
  /** Whether the task is past its scheduledEnd without being completed */
  isOverdue?: boolean;
  /** Show action buttons inline (false for Gantt/calendar view) */
  showLiveButtons?: boolean;
  /** Optimistic local state update before API call */
  onOptimisticUpdate?: (
    taskId: string,
    changes: Partial<SerializedTask>,
  ) => void;
  /** Callback to refetch tasks after a status change */
  onStatusChange?: () => void;
}) {
  const style = statusStyles[task.status] ?? statusStyles.PENDING;
  const isClickable = Boolean(onTaskClick);
  const isBlocked = Boolean(parentTitle) && parentStatus !== "COMPLETED";
  const isFollowing = Boolean(parentTitle) && parentStatus === "COMPLETED";
  const isDone = task.status === "COMPLETED" || task.status === "SKIPPED";

  // Show action buttons for actionable tasks in live mode (not on Gantt)
  const showActions = isLive && showLiveButtons && canAct && !isDone;

  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable ? `Edit task: ${task.title}` : undefined}
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-l-[3px] px-4 py-3.5 transition-colors",
        style.wrapper,
        dependencyMeta ? dependencyMeta.style.railClass : "border-l-border",
        isBlocked && "opacity-75",
        isOverdue && "ring-2 ring-warning/40",
        isClickable &&
          "cursor-pointer hover:ring-2 hover:ring-ring focus:outline-none focus:ring-2 focus:ring-ring",
      )}
    >
      {/* Main row: dot + content + badge */}
      <div
        className="flex items-center gap-3"
        onClick={() => onTaskClick?.(task)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && onTaskClick)
            onTaskClick(task);
        }}
      >
        <div className={cn("size-2 flex-shrink-0 rounded-full", style.dot)} />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-sm font-medium text-foreground",
              isDone && "line-through text-muted-foreground",
            )}
          >
            {task.title}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="text-xs text-muted-foreground">
              {task.scheduledStart
                ? eventDate
                  ? formatTimeInZoneWithDay(
                      task.scheduledStart,
                      timezone,
                      eventDate,
                    )
                  : formatTimeInZone(task.scheduledStart, timezone)
                : "No time set"}
              {task.scheduledEnd && task.scheduledStart
                ? ` → ${eventDate ? formatTimeInZoneWithDay(task.scheduledEnd, timezone, eventDate) : formatTimeInZone(task.scheduledEnd, timezone)}`
                : task.durationMins
                  ? ` · ${formatDuration(task.durationMins)}`
                  : ""}
            </p>
            {isOverdue && (
              <span
                className="flex items-center gap-0.5 text-xs text-warning"
                data-testid={`live_${task.id}_overdue_indicator`}
              >
                <AlertTriangle className="size-3" />
                Overdue
              </span>
            )}
            {isBlocked && (
              <span className="flex items-center gap-0.5 text-xs text-warning">
                <Lock className="size-3" />
                Blocked by {parentTitle}
              </span>
            )}
            {isFollowing && (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Link2 className="size-3" />
                Follows {parentTitle}
              </span>
            )}
          </div>
        </div>
        <TaskStatusBadge
          status={task.status}
          liveStatus={liveStatus}
          delayAmountMins={task.delayAmountMins}
        />
      </div>

      {/* Action buttons row — shown inline for live mode list view */}
      {showActions && (
        <div className="flex items-center justify-end">
          <LiveActionButtons
            taskId={task.id}
            taskTitle={task.title}
            taskStatus={task.status}
            eventId={task.eventId}
            isBlocked={isBlocked}
            scheduledEnd={task.scheduledEnd}
            delayAmountMins={task.delayAmountMins}
            onOptimisticUpdate={onOptimisticUpdate}
            onStatusChanged={onStatusChange ?? (() => {})}
          />
        </div>
      )}
    </div>
  );
}
