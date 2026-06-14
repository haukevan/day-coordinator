"use client";

import { useState, useEffect } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { toZonedTime } from "date-fns-tz";
import { format } from "date-fns";
import { Clock, Link2, Pencil, User } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type {
  SerializedTask,
  SerializedSubTask,
  SerializedVendor,
} from "@/lib/types";

interface TaskDetailSheetProps {
  eventId: string;
  task: SerializedTask | undefined;
  timezone: string;
  open: boolean;
  userRole: "admin" | "vendor";
  /** Whether the current user is an accepted vendor assigned to this task (controls checklist visibility) */
  canViewSubTasks: boolean;
  /** The current vendor's EventVendor ID — used to restrict subtask status toggling */
  currentVendorEventId?: string | null;
  onClose: () => void;
  onEdit: (task: SerializedTask) => void;
}

function formatTimeInZone(iso: string, timezone: string): string {
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
  open,
  userRole,
  canViewSubTasks,
  currentVendorEventId,
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
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <SheetHeader className="px-4 pt-3 pb-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <SheetTitle className="truncate text-lg">{task.title}</SheetTitle>
            </div>
            <div className="mr-7 shrink-0">
              <TaskStatusBadge status={task.status} />
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
                {formatTimeInZone(task.scheduledStart!, timezone)}
                {hasEnd && (
                  <> – {formatTimeInZone(task.scheduledEnd!, timezone)}</>
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
