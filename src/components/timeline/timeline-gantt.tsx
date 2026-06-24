"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { getHours, getMinutes, format } from "date-fns";
import { Link2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildDependencyGroupMeta } from "./dependency-groups";
import type { SerializedTask } from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────
const HOUR_HEIGHT = 80; // px per hour
const LABEL_WIDTH = 52; // px for left hour-label column
const MIN_BLOCK_HEIGHT = 24; // minimum task block height in px
const MAX_EVENT_HOURS = 36; // event day midnight to noon next day = 36-hour window

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Convert a UTC ISO string to minutes elapsed since the event date midnight
 *  (in the event timezone). Handles next-day tasks naturally — returns values
 *  beyond 1440 for tasks on the following calendar day. */
function toMinutesFromEventMidnight(
  iso: string,
  timezone: string,
  eventDateIso: string,
): number {
  const eventDate = new Date(eventDateIso);
  // Get the date string in the event timezone (YYYY-MM-DD)
  const datePart = format(toZonedTime(eventDate, timezone), "yyyy-MM-dd");
  // Create midnight in that timezone and convert to UTC
  const midnightUtc = fromZonedTime(`${datePart}T00:00:00`, timezone);
  const taskUtc = new Date(iso);
  return (taskUtc.getTime() - midnightUtc.getTime()) / 60_000;
}

/** Format a minute-of-day value as a 12-hour time string, e.g. "9:30 AM".
 *  Minutes beyond 1440 (next day) are handled with modulo. */
function fmtMin(min: number): string {
  const displayMin = min % (24 * 60);
  const h = Math.floor(displayMin / 60) % 24;
  const m = displayMin % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Format an hour number as a label. Hours 0-23 get standard labels.
 *  Hours 24+ get a two-line display: time on top, "+1d" below. */
function fmtHourLabel(hour: number): { time: string; sub?: string } {
  const isNextDay = hour >= 24;
  const displayHour = hour % 24;
  let time: string;
  if (displayHour === 0) time = "12 AM";
  else if (displayHour === 12) time = "12 PM";
  else time = displayHour < 12 ? `${displayHour} AM` : `${displayHour - 12} PM`;
  return isNextDay ? { time, sub: "+1d" } : { time };
}

// ── Layout algorithm ──────────────────────────────────────────────────────────

type PositionedTask = {
  task: SerializedTask;
  startMin: number;
  endMin: number;
  column: number;
  totalColumns: number;
};

function layoutTasks(
  tasks: SerializedTask[],
  timezone: string,
  eventDateIso: string,
): PositionedTask[] {
  const timed = tasks.filter((t) => t.scheduledStart != null);

  const items: PositionedTask[] = timed.map((task) => {
    const startMin = toMinutesFromEventMidnight(
      task.scheduledStart!,
      timezone,
      eventDateIso,
    );
    const dur = task.durationMins ?? 30;
    return {
      task,
      startMin,
      endMin: startMin + dur,
      column: 0,
      totalColumns: 1,
    };
  });

  // Sort by start time
  items.sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    return a.endMin - b.endMin;
  });

  // Build overlap groups so each group can be laid out with a shared column
  // grid. This prevents visual collisions from mixed per-task totalColumns.
  const groups: PositionedTask[][] = [];
  let currentGroup: PositionedTask[] = [];
  let currentGroupEnd = -1;

  for (const item of items) {
    if (currentGroup.length === 0) {
      currentGroup = [item];
      currentGroupEnd = item.endMin;
      continue;
    }

    if (item.startMin < currentGroupEnd) {
      currentGroup.push(item);
      currentGroupEnd = Math.max(currentGroupEnd, item.endMin);
      continue;
    }

    groups.push(currentGroup);
    currentGroup = [item];
    currentGroupEnd = item.endMin;
  }

  if (currentGroup.length > 0) groups.push(currentGroup);

  const assignedColumnsByTaskId = new Map<string, number>();

  for (const group of groups) {
    const columnEnds: number[] = [];

    for (const item of group) {
      const availableColumns: number[] = [];
      for (let i = 0; i < columnEnds.length; i++) {
        if (columnEnds[i] <= item.startMin) availableColumns.push(i);
      }

      const preferredColumn = item.task.parentTaskId
        ? assignedColumnsByTaskId.get(item.task.parentTaskId)
        : undefined;

      let assigned: number;
      if (
        preferredColumn !== undefined &&
        availableColumns.includes(preferredColumn)
      ) {
        assigned = preferredColumn;
      } else if (availableColumns.length > 0) {
        assigned = availableColumns[0];
      } else {
        assigned = columnEnds.length;
      }

      columnEnds[assigned] = item.endMin;
      item.column = assigned;
      assignedColumnsByTaskId.set(item.task.id, assigned);
    }

    const groupTotalColumns = Math.max(1, columnEnds.length);
    for (const item of group) {
      item.totalColumns = groupTotalColumns;
    }
  }

  return items;
}

function getTimeRange(
  tasks: SerializedTask[],
  timezone: string,
  eventDateIso: string,
): { startHour: number; endHour: number } {
  const timed = tasks.filter((t) => t.scheduledStart != null);
  if (timed.length === 0) return { startHour: 8, endHour: 18 };

  const startMins = timed.map((t) =>
    toMinutesFromEventMidnight(t.scheduledStart!, timezone, eventDateIso),
  );
  const endMins = timed.map((t) => {
    const s = toMinutesFromEventMidnight(
      t.scheduledStart!,
      timezone,
      eventDateIso,
    );
    return s + (t.durationMins ?? 30);
  });

  const startHour = Math.max(0, Math.floor(Math.min(...startMins) / 60) - 1);
  const endHour = Math.min(
    MAX_EVENT_HOURS,
    Math.ceil(Math.max(...endMins) / 60) + 1,
  );
  return { startHour, endHour };
}

// ── Status styling ────────────────────────────────────────────────────────────

const STATUS_BLOCK: Record<string, string> = {
  PENDING: "border-border bg-card text-foreground",
  IN_PROGRESS:
    "border-primary/50 bg-primary/10 text-foreground ring-1 ring-primary/20",
  COMPLETED: "border-border bg-card/40 text-muted-foreground opacity-60",
  DELAYED: "border-warning/50 bg-warning/10 text-foreground",
  SKIPPED: "border-border bg-card/20 text-muted-foreground opacity-40",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function TimelineGantt({
  tasks,
  timezone,
  eventDate,
  onTaskClick,
}: {
  tasks: SerializedTask[];
  timezone: string;
  eventDate: string | null;
  onTaskClick?: (task: SerializedTask) => void;
}) {
  const eventDateIso = eventDate ?? new Date().toISOString();

  const { startHour, endHour } = useMemo(
    () => getTimeRange(tasks, timezone, eventDateIso),
    [tasks, timezone, eventDateIso],
  );

  const hours = useMemo(
    () => Array.from({ length: endHour - startHour }, (_, i) => startHour + i),
    [startHour, endHour],
  );

  const totalMinutes = (endHour - startHour) * 60;
  const totalHeight = totalMinutes * (HOUR_HEIGHT / 60);

  const positioned = useMemo(
    () => layoutTasks(tasks, timezone, eventDateIso),
    [tasks, timezone, eventDateIso],
  );

  const dependencyMetaByTask = useMemo(
    () => buildDependencyGroupMeta(tasks),
    [tasks],
  );

  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  // Current-time indicator
  const [nowMin, setNowMin] = useState<number | null>(null);
  useEffect(() => {
    function update() {
      const min = toMinutesFromEventMidnight(
        new Date().toISOString(),
        timezone,
        eventDateIso,
      );
      setNowMin(min);
    }
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [timezone, eventDateIso]);

  // Auto-scroll to first task or current time on mount
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollRef.current) return;
    const firstTimed = tasks.find((t) => t.scheduledStart);
    const scrollToMin = firstTimed
      ? toMinutesFromEventMidnight(
          firstTimed.scheduledStart!,
          timezone,
          eventDateIso,
        ) - 60
      : nowMin !== null
        ? nowMin - 60
        : startHour * 60;
    const top = ((scrollToMin - startHour * 60) / 60) * HOUR_HEIGHT;
    scrollRef.current.scrollTop = Math.max(0, top);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally only on mount

  const showNow =
    nowMin !== null && nowMin >= startHour * 60 && nowMin <= endHour * 60;
  const nowTop = showNow ? ((nowMin! - startHour * 60) / 60) * HOUR_HEIGHT : 0;

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 py-20 text-center">
        <p className="mb-1 text-sm font-medium text-foreground">No tasks yet</p>
        <p className="text-xs text-muted-foreground">
          Add your first task to start building the timeline.
        </p>
      </div>
    );
  }

  if (positioned.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 py-20 text-center">
        <p className="mb-1 text-sm font-medium text-foreground">
          No scheduled times yet
        </p>
        <p className="text-xs text-muted-foreground">
          Set start times on tasks to see them in the calendar view.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex" style={{ minHeight: `${totalHeight}px` }}>
          {/* Hour labels */}
          <div
            className="flex-shrink-0 select-none"
            style={{ width: `${LABEL_WIDTH}px` }}
          >
            {hours.map((hour) => {
              const label = fmtHourLabel(hour);
              return (
                <div
                  key={hour}
                  className="relative flex items-start justify-end pr-2.5 pt-1"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                >
                  {label.sub ? (
                    <div className="flex flex-col items-end leading-none">
                      <span className="text-[11px] text-muted-foreground">
                        {label.time}
                      </span>
                      <span className="text-[9px] font-medium text-warning">
                        {label.sub}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] leading-none text-muted-foreground">
                      {label.time}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Task grid */}
          <div
            className="relative flex-1 border-l border-border"
            style={{ minHeight: `${totalHeight}px` }}
          >
            {/* Hour gridlines */}
            {hours.map((hour, i) => (
              <div
                key={hour}
                className="pointer-events-none absolute left-0 right-0 border-t border-border/60"
                style={{ top: `${i * HOUR_HEIGHT}px` }}
              />
            ))}

            {/* Half-hour gridlines */}
            {hours.map((hour, i) => (
              <div
                key={`h-${hour}`}
                className="pointer-events-none absolute left-0 right-0 border-t border-border/20"
                style={{ top: `${i * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }}
              />
            ))}

            {/* Midnight divider — shown when tasks span into the next day */}
            {endHour > 24 && (
              <div
                className="pointer-events-none absolute left-0 right-0 z-10"
                style={{
                  top: `${(24 - startHour) * HOUR_HEIGHT}px`,
                }}
              >
                <div className="mx-2 border-t-2 border-dashed border-warning/60" />
                <span className="absolute -top-2.5 right-2 rounded border border-warning/30 bg-card px-1.5 py-0.5 text-[10px] font-medium text-warning">
                  Midnight
                </span>
              </div>
            )}

            {/* Live time indicator */}
            {showNow && (
              <div
                className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                style={{ top: `${nowTop}px` }}
              >
                <div className="size-2.5 flex-shrink-0 rounded-full bg-destructive shadow-sm" />
                <div className="h-px flex-1 bg-destructive shadow-sm" />
              </div>
            )}

            {/* Task blocks */}
            {positioned.map(
              ({ task, startMin, endMin, column, totalColumns }) => {
                const top = ((startMin - startHour * 60) / 60) * HOUR_HEIGHT;
                const rawHeight = ((endMin - startMin) / 60) * HOUR_HEIGHT;
                const height = Math.max(rawHeight, MIN_BLOCK_HEIGHT);
                const widthPct = 100 / totalColumns;
                const leftPct = (column / totalColumns) * 100;
                const dependencyMeta = dependencyMetaByTask.get(task.id);
                const parentTask = task.parentTaskId
                  ? taskMap.get(task.parentTaskId)
                  : undefined;
                const isBlocked =
                  Boolean(parentTask) && parentTask!.status !== "COMPLETED";
                const colorClass =
                  STATUS_BLOCK[task.status] ?? STATUS_BLOCK.PENDING;

                return (
                  <div
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Task: ${task.title}`}
                    className={cn(
                      "absolute overflow-hidden rounded-lg border border-l-[3px] p-2 transition-shadow",
                      colorClass,
                      dependencyMeta
                        ? dependencyMeta.style.railClass
                        : "border-l-border",
                      onTaskClick &&
                        "cursor-pointer hover:ring-2 hover:ring-ring focus:outline-none focus:ring-2 focus:ring-ring",
                    )}
                    style={{
                      top: `${top + 1}px`,
                      height: `${height - 2}px`,
                      left: `calc(${leftPct}% + 3px)`,
                      width: `calc(${widthPct}% - 6px)`,
                    }}
                    onClick={() => onTaskClick?.(task)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        onTaskClick?.(task);
                    }}
                  >
                    <p className="truncate text-[11px] font-semibold leading-tight">
                      {task.title}
                    </p>
                    {height > 38 && (
                      <p className="mt-0.5 truncate text-[10px] leading-tight opacity-70">
                        {fmtMin(startMin)}
                        {" – "}
                        {fmtMin(endMin)}
                      </p>
                    )}
                    {isBlocked && height > 52 && (
                      <Lock className="absolute bottom-1.5 right-1.5 size-3 text-warning opacity-60" />
                    )}
                    {!isBlocked && dependencyMeta && height > 52 && (
                      <Link2 className="absolute bottom-1.5 right-1.5 size-3 opacity-40" />
                    )}
                  </div>
                );
              },
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
