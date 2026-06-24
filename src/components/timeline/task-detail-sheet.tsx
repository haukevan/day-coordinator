"use client";

import { useState, useEffect } from "react";
import { toZonedTime } from "date-fns-tz";
import { format } from "date-fns";
import {
  ArrowLeft,
  Check,
  Clock,
  ClockAlert,
  Link2,
  Pencil,
  User,
  AlertTriangle,
  Undo2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SubtaskList } from "./subtask-list";
import { TaskStatusBadge } from "./task-status-badge";
import { LiveActionButtons } from "./live-action-buttons";
import { cn } from "@/lib/utils";
import { formatTimeInZoneWithDay } from "@/lib/format-time";
import type {
  SerializedTask,
  SerializedSubTask,
  SerializedVendor,
} from "@/lib/types";

interface TaskDetailSheetProps {
  eventId: string;
  task: SerializedTask | undefined;
  timezone: string;
  eventDate?: string | null;
  open: boolean;
  userRole: "admin" | "vendor";
  /** Whether the current user is an accepted vendor assigned to this task (controls checklist visibility) */
  canViewSubTasks: boolean;
  /** The current vendor's EventVendor ID — used to restrict subtask status toggling */
  currentVendorEventId?: string | null;
  /** Whether the event is in LIVE mode */
  isLive?: boolean;
  /** Whether the current user can act on this task (start/complete/delay) */
  canAct?: boolean;
  /** Callback to refetch tasks after a status change */
  onStatusChange?: () => void;
  /** Whether the task is blocked by an uncompleted parent */
  isBlocked?: boolean;
  /** Optimistic local state update before API call */
  onOptimisticUpdate?: (
    taskId: string,
    changes: Record<string, unknown>,
  ) => void;
  onClose: () => void;
  onEdit: (task: SerializedTask) => void;
}

/** Local time-only formatter for inline use in this component. */
function fmtTime(iso: string, timezone: string): string {
  const zoned = toZonedTime(new Date(iso), timezone);
  return format(zoned, "h:mm a");
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDateInZone(iso: string, timezone: string): string {
  const zoned = toZonedTime(new Date(iso), timezone);
  return format(zoned, "EEE, MMM d");
}

export function TaskDetailSheet({
  eventId,
  task,
  timezone,
  eventDate,
  open,
  userRole,
  canViewSubTasks,
  currentVendorEventId,
  isLive = false,
  canAct = false,
  isBlocked = false,
  onOptimisticUpdate,
  onStatusChange,
  onClose,
  onEdit,
}: TaskDetailSheetProps) {
  const [subTasks, setSubTasks] = useState<SerializedSubTask[]>([]);
  const [loadingSubTasks, setLoadingSubTasks] = useState(false);

  // Fetch checklist items when sheet opens with a task
  useEffect(() => {
    if (!open || !task || !canViewSubTasks) {
      setSubTasks([]);
      return;
    }

    let cancelled = false;
    async function fetchSubTasks() {
      setLoadingSubTasks(true);
      try {
        const res = await fetch(
          `/api/events/${eventId}/tasks/${task!.id}/subtasks`,
        );
        if (!cancelled && res.ok) {
          const data = await res.json();
          setSubTasks(data.subTasks ?? []);
        }
      } catch {
        // non-critical
      } finally {
        if (!cancelled) setLoadingSubTasks(false);
      }
    }
    fetchSubTasks();
    return () => {
      cancelled = true;
    };
  }, [open, task?.id, eventId, canViewSubTasks]);

  // Extract parent task vendors from task.taskVendors
  const parentTaskVendors: SerializedVendor[] = (task?.taskVendors ?? []).map(
    (tv) => {
      const v = tv.eventVendor;
      return {
        id: v.id,
        eventId: task?.eventId ?? "",
        vendorContactId: "",
        userId: null,
        isEventOwner: false,
        company: v.company,
        jobTitle: v.jobTitle,
        status: "ACCEPTED",
        role: "VENDOR",
        inviteSentAt: null,
        joinedAt: null,
        createdAt: "",
        updatedAt: "",
        email: v.vendorContact.email,
        firstName: v.vendorContact.firstName,
        lastName: v.vendorContact.lastName,
        phone: null,
      };
    },
  );

  if (!task) return null;

  const hasTime = Boolean(task.scheduledStart);
  const hasEnd = Boolean(task.scheduledEnd);
  const hasDuration = Boolean(task.durationMins);
  const hasDescription = Boolean(task.description);
  const hasParent = Boolean(task.parentTask);
  const hasVendors = (task.taskVendors?.length ?? 0) > 0;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex !w-full flex-col sm:!w-3/4 sm:max-w-xl"
        showCloseButton={false}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <SheetHeader className="px-4 pt-3 pb-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex shrink-0 items-center justify-center size-8 -ml-1.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div className="flex-1 min-w-0">
              <SheetTitle className="truncate text-lg">{task.title}</SheetTitle>
            </div>
            <div className="shrink-0">
              <TaskStatusBadge
                status={task.status}
                delayAmountMins={task.delayAmountMins}
              />
            </div>
          </div>
        </SheetHeader>

        {/* ── Summary Section ────────────────────────────────────────── */}
        <div className="flex flex-col gap-1 overflow-y-auto px-4">
          {/* Time */}
          {hasTime && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-foreground">
                {eventDate
                  ? formatTimeInZoneWithDay(
                      task.scheduledStart!,
                      timezone,
                      eventDate,
                    )
                  : fmtTime(task.scheduledStart!, timezone)}
                {hasEnd && (
                  <>
                    {" – "}
                    {eventDate
                      ? formatTimeInZoneWithDay(
                          task.scheduledEnd!,
                          timezone,
                          eventDate,
                        )
                      : fmtTime(task.scheduledEnd!, timezone)}
                  </>
                )}
              </span>
              {hasDuration && (
                <span className="text-muted-foreground">
                  · {formatDuration(task.durationMins!)}
                </span>
              )}
            </div>
          )}

          {/* Date */}
          {task.scheduledStart && (
            <p className="text-xs text-muted-foreground">
              {formatDateInZone(task.scheduledStart, timezone)}
            </p>
          )}

          {/* Actual completion time (when done) */}
          {task.status === "COMPLETED" && task.actualEnd && (
            <div className="flex items-center gap-2 text-sm">
              <Check className="size-4 shrink-0 text-success" />
              <span className="text-foreground">
                Completed{" "}
                {eventDate
                  ? formatTimeInZoneWithDay(task.actualEnd, timezone, eventDate)
                  : fmtTime(task.actualEnd, timezone)}
              </span>
            </div>
          )}

          {/* Delay history note */}
          {task.delayAmountMins != null &&
            task.delayAmountMins > 0 &&
            (() => {
              const delayLabel = formatDuration(task.delayAmountMins);
              let note = "";
              if (task.status === "DELAYED") {
                note = `Delayed ${delayLabel}`;
              } else if (task.status === "COMPLETED") {
                note = `Delay marked ${delayLabel}`;
                if (task.actualEnd && task.scheduledEnd) {
                  const originalEnd =
                    new Date(task.scheduledEnd).getTime() -
                    task.delayAmountMins * 60 * 1000;
                  const actualMs =
                    new Date(task.actualEnd).getTime() - originalEnd;
                  const actualMins = Math.round(actualMs / 60 / 1000);
                  const actualLabel =
                    actualMins > 0 ? formatDuration(actualMins) : "on time";
                  note += ` · Actually completed: ${actualLabel} late`;
                }
              } else {
                note = `Delay: ${delayLabel}`;
              }
              return (
                <div className="flex items-center gap-2 text-sm text-warning">
                  <ClockAlert className="size-4 shrink-0" />
                  <span>{note}</span>
                </div>
              );
            })()}

          {/* Description */}
          {hasDescription && (
            <div className="rounded-lg bg-muted/50 px-3 py-2.5">
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          )}

          {/* Parent task */}
          {hasParent && (
            <div className="flex items-center gap-2 text-sm">
              <Link2 className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">Blocked by</span>
              <span className="font-medium text-foreground">
                {task.parentTask!.title}
              </span>
            </div>
          )}

          {/* Vendors */}
          {hasVendors && (
            <div className="flex flex-wrap items-center gap-1.5">
              <User className="size-4 shrink-0 text-muted-foreground" />
              {task.taskVendors!.map((tv) => {
                const v = tv.eventVendor;
                const displayName =
                  [v.vendorContact.firstName, v.vendorContact.lastName]
                    .filter(Boolean)
                    .join(" ") || v.vendorContact.email;
                return (
                  <span
                    key={tv.eventVendorId}
                    className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                  >
                    {displayName}
                  </span>
                );
              })}
            </div>
          )}

          {/* Edit button (admin / coordinator only) */}
          {userRole === "admin" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit gap-1.5"
              onClick={() => onEdit(task)}
            >
              <Pencil className="size-3.5" />
              Edit task
            </Button>
          )}

          {/* Live mode: overdue warning + action buttons for all non-done tasks */}
          {isLive &&
            task.status !== "COMPLETED" &&
            task.status !== "SKIPPED" && (
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
                {/* Overdue warning */}
                {task.scheduledEnd &&
                  new Date(task.scheduledEnd) < new Date() && (
                    <div className="flex items-center gap-2 text-sm text-warning">
                      <AlertTriangle className="size-4" />
                      <span>This task is overdue</span>
                    </div>
                  )}
                {/* Action buttons (always shown in detail sheet for non-done tasks) */}
                {canAct && (
                  <LiveActionButtons
                    taskId={task.id}
                    taskTitle={task.title}
                    taskStatus={task.status}
                    eventId={eventId}
                    isBlocked={isBlocked}
                    scheduledEnd={task.scheduledEnd}
                    delayAmountMins={task.delayAmountMins}
                    onOptimisticUpdate={onOptimisticUpdate}
                    onStatusChanged={onStatusChange ?? (() => {})}
                  />
                )}
                {/* Reset option for started or delayed tasks */}
                {canAct &&
                  (task.status === "IN_PROGRESS" ||
                    task.status === "DELAYED") && (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-muted-foreground hover:text-foreground gap-1.5 w-fit"
                      onClick={async () => {
                        const res = await fetch(
                          `/api/events/${eventId}/tasks/${task.id}/status`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: "PENDING" }),
                          },
                        );
                        if (res.ok) {
                          onStatusChange?.();
                        }
                      }}
                    >
                      <Undo2 className="size-3.5" />
                      Reset status to pending
                    </Button>
                  )}
              </div>
            )}

          {/* Reset option for completed tasks (shown outside the main actions block) */}
          {isLive && task.status === "COMPLETED" && canAct && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
              <Button
                variant="ghost"
                size="xs"
                className="text-muted-foreground hover:text-foreground gap-1.5 w-fit"
                onClick={async () => {
                  const res = await fetch(
                    `/api/events/${eventId}/tasks/${task.id}/status`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: "PENDING" }),
                    },
                  );
                  if (res.ok) {
                    onStatusChange?.();
                  }
                }}
              >
                <Undo2 className="size-3.5" />
                Reset status to pending
              </Button>
            </div>
          )}
        </div>

        {/* ── Divider ────────────────────────────────────────────────── */}
        <div className="mx-4 border-t border-border" />

        {/* ── Checklist Section ──────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2">
          {!canViewSubTasks ? (
            <p className="text-xs text-muted-foreground italic py-2">
              Checklist items are visible to assigned vendors.
            </p>
          ) : loadingSubTasks ? (
            <div className="flex flex-col gap-0.5 pt-1">
              {[70, 45, 60, 50].map((w, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 min-h-[44px]"
                >
                  <Skeleton className="size-5 rounded-full shrink-0" />
                  <Skeleton
                    className="h-4 rounded"
                    style={{ width: `${w}%` }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <SubtaskList
              subTasks={subTasks}
              userRole={userRole}
              parentTaskVendors={parentTaskVendors}
              allEventVendors={parentTaskVendors}
              taskId={task.id}
              eventId={eventId}
              currentVendorEventId={currentVendorEventId ?? null}
              onSubTasksChange={setSubTasks}
            />
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="sticky bottom-0 flex items-center justify-end border-t border-border bg-background px-4 py-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
