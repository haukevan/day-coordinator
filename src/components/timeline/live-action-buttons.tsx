"use client";

import { useState } from "react";
import { Play, ClockAlert, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DelayDialog } from "./delay-dialog";
import { CompleteConfirmDialog } from "./complete-confirm-dialog";

interface LiveActionButtonsProps {
  taskId: string;
  taskTitle: string;
  taskStatus: string;
  eventId: string;
  isBlocked: boolean;
  scheduledEnd: string | null;
  delayAmountMins?: number | null;
  /** Optimistic local state update before API call */
  onOptimisticUpdate?: (
    taskId: string,
    changes: Partial<{
      status: string;
      actualStart: string | null;
      actualEnd: string | null;
      delayAmountMins: number | null;
    }>,
  ) => void;
  onStatusChanged: () => void;
}

export function LiveActionButtons({
  taskId,
  taskTitle,
  taskStatus,
  eventId,
  isBlocked,
  scheduledEnd,
  delayAmountMins,
  onOptimisticUpdate,
  onStatusChanged,
}: LiveActionButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [delayOpen, setDelayOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  const isDone = taskStatus === "COMPLETED" || taskStatus === "SKIPPED";
  const isDelayed = taskStatus === "DELAYED";

  async function handleStatus(status: string, actualEnd?: string) {
    setLoading(status);
    // Optimistic update
    const optimisticChanges: Record<string, unknown> = { status };
    if (status === "IN_PROGRESS") {
      optimisticChanges.actualStart = new Date().toISOString();
    }
    if (status === "COMPLETED") {
      optimisticChanges.actualEnd = actualEnd ?? new Date().toISOString();
      optimisticChanges.delayAmountMins = null;
    }
    onOptimisticUpdate?.(taskId, optimisticChanges as Record<string, unknown>);

    try {
      const res = await fetch(`/api/events/${eventId}/tasks/${taskId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(actualEnd ? { actualEnd } : {}) }),
      });
      if (!res.ok) {
        const err = await res.json();
        console.error("Failed to update task status:", err.error);
      } else {
        onStatusChanged();
      }
    } catch (err) {
      console.error("Failed to update task status:", err);
    } finally {
      setLoading(null);
    }
  }

  async function handleDelay(delayMinutes: number) {
    setLoading("DELAYED");
    // Optimistic update
    onOptimisticUpdate?.(taskId, {
      status: "DELAYED",
      delayAmountMins: delayMinutes,
    });

    try {
      const method = isDelayed ? "PATCH" : "POST";
      const res = await fetch(`/api/events/${eventId}/tasks/${taskId}/delay`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delayMinutes }),
      });
      if (!res.ok) {
        const err = await res.json();
        console.error("Failed to delay task:", err.error);
      } else {
        onStatusChanged();
      }
    } catch (err) {
      console.error("Failed to delay task:", err);
    } finally {
      setLoading(null);
      setDelayOpen(false);
    }
  }

  async function handleRemoveDelay() {
    setLoading("DELAYED");
    onOptimisticUpdate?.(taskId, {
      status: "IN_PROGRESS",
      delayAmountMins: null,
    });
    try {
      const res = await fetch(`/api/events/${eventId}/tasks/${taskId}/delay`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        console.error("Failed to remove delay:", err.error);
      } else {
        onStatusChanged();
      }
    } catch (err) {
      console.error("Failed to remove delay:", err);
    } finally {
      setLoading(null);
      setDelayOpen(false);
    }
  }

  function handleCompleteConfirm(actualEnd: string) {
    setCompleteOpen(false);
    handleStatus("COMPLETED", actualEnd);
  }

  if (isDone) return null;

  return (
    <>
      <div
        className="flex w-full items-center gap-1.5"
        role="group"
        aria-label="Task actions"
      >
        {/* PENDING: Start + Done */}
        {taskStatus === "PENDING" && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={isBlocked || loading !== null}
              onClick={() => handleStatus("IN_PROGRESS")}
              className={cn(
                "flex-1 gap-1 min-w-0",
                "border-primary/40 text-primary hover:bg-primary/10",
              )}
              data-testid={`live_${taskId}_inProgress_btn`}
            >
              {loading === "IN_PROGRESS" ? (
                <Loader2 className="size-4 shrink-0 animate-spin" />
              ) : (
                <Play className="size-4 shrink-0" />
              )}
              <span className="truncate">Start</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading !== null}
              onClick={() => handleStatus("COMPLETED")}
              className={cn(
                "flex-1 gap-1 min-w-0",
                "border-success/40 text-success hover:bg-success/10",
              )}
              data-testid={`live_${taskId}_done_btn`}
            >
              {loading === "COMPLETED" ? (
                <Loader2 className="size-4 shrink-0 animate-spin" />
              ) : (
                <Check className="size-4 shrink-0" />
              )}
              <span className="truncate">Done</span>
            </Button>
          </>
        )}

        {/* IN_PROGRESS or DELAYED: Delay + Done */}
        {(taskStatus === "IN_PROGRESS" || taskStatus === "DELAYED") && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={loading !== null}
              onClick={() => setDelayOpen(true)}
              className={cn(
                "flex-1 gap-1 min-w-0",
                "border-warning/40 text-warning hover:bg-warning/10",
                isDelayed && "bg-warning/15",
              )}
              data-testid={`live_${taskId}_delayed_btn`}
            >
              {loading === "DELAYED" ? (
                <Loader2 className="size-4 shrink-0 animate-spin" />
              ) : (
                <ClockAlert className="size-4 shrink-0" />
              )}
              <span className="truncate">
                {isDelayed && delayAmountMins ? `${delayAmountMins}m` : "Delay"}
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading !== null}
              onClick={() => {
                if (isDelayed) {
                  setCompleteOpen(true);
                } else {
                  handleStatus("COMPLETED");
                }
              }}
              className={cn(
                "flex-1 gap-1 min-w-0",
                "border-success/40 text-success hover:bg-success/10",
              )}
              data-testid={`live_${taskId}_done_btn`}
            >
              {loading === "COMPLETED" ? (
                <Loader2 className="size-4 shrink-0 animate-spin" />
              ) : (
                <Check className="size-4 shrink-0" />
              )}
              <span className="truncate">Done</span>
            </Button>
          </>
        )}
      </div>

      <DelayDialog
        open={delayOpen}
        taskTitle={taskTitle}
        scheduledEnd={scheduledEnd}
        currentDelayMinutes={
          isDelayed ? (delayAmountMins ?? undefined) : undefined
        }
        onConfirm={handleDelay}
        onRemove={isDelayed ? handleRemoveDelay : undefined}
        onCancel={() => setDelayOpen(false)}
      />

      <CompleteConfirmDialog
        open={completeOpen}
        taskTitle={taskTitle}
        onConfirm={handleCompleteConfirm}
        onCancel={() => setCompleteOpen(false)}
      />
    </>
  );
}
