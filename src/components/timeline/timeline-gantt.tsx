"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { toZonedTime } from "date-fns-tz";
import { getHours, getMinutes } from "date-fns";
import { Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SerializedTask } from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────
const HOUR_HEIGHT = 80; // px per hour
const LABEL_WIDTH = 52; // px for left hour-label column
const MIN_BLOCK_HEIGHT = 24; // minimum task block height in px

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Convert a UTC ISO string to minutes-since-midnight in the given timezone. */
function toMinuteOfDay(iso: string, timezone: string): number {
  const zoned = toZonedTime(new Date(iso), timezone);
  return getHours(zoned) * 60 + getMinutes(zoned);
}

/** Format a minute-of-day value as a 12-hour time string, e.g. "9:30 AM". */
function fmtMin(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Format an hour number as a label, e.g. "9 AM", "12 PM". */
function fmtHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
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
): PositionedTask[] {
  const timed = tasks.filter((t) => t.scheduledStart != null);

  const items: PositionedTask[] = timed.map((task) => {
    const startMin = toMinuteOfDay(task.scheduledStart!, timezone);
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
  items.sort((a, b) => a.startMin - b.startMin);

  // Greedy column assignment: find the leftmost column where this task doesn't
  // overlap any already-placed task.
  const columnEnds: number[] = [];
  for (const item of items) {
    const col = columnEnds.findIndex((end) => end <= item.startMin);
    const assigned = col === -1 ? columnEnds.length : col;
    columnEnds[assigned] = item.endMin;
    item.column = assigned;
  }

  // Compute totalColumns for each task based on its overlap group
  for (const item of items) {
    const overlapping = items.filter(
      (o) => o.startMin < item.endMin && o.endMin > item.startMin,
    );
    item.totalColumns = Math.max(...overlapping.map((o) => o.column)) + 1;
  }

  return items;
}

function getTimeRange(
  tasks: SerializedTask[],
  timezone: string,
): { startHour: number; endHour: number } {
  const timed = tasks.filter((t) => t.scheduledStart != null);
  if (timed.length === 0) return { startHour: 8, endHour: 18 };

  const startMins = timed.map((t) =>
    toMinuteOfDay(t.scheduledStart!, timezone),
  );
  const endMins = timed.map((t) => {
    const s = toMinuteOfDay(t.scheduledStart!, timezone);
    return s + (t.durationMins ?? 30);
  });

  const startHour = Math.max(0, Math.floor(Math.min(...startMins) / 60) - 1);
  const endHour = Math.min(24, Math.ceil(Math.max(...endMins) / 60) + 1);
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
  onTaskClick,
}: {
  tasks: SerializedTask[];
  timezone: string;
  onTaskClick?: (task: SerializedTask) => void;
}) {
  const { startHour, endHour } = useMemo(
    () => getTimeRange(tasks, timezone),
    [tasks, timezone],
  );

  const hours = useMemo(
    () => Array.from({ length: endHour - startHour }, (_, i) => startHour + i),
    [startHour, endHour],
  );

  const totalMinutes = (endHour - startHour) * 60;
  const totalHeight = totalMinutes * (HOUR_HEIGHT / 60);

  const positioned = useMemo(
    () => layoutTasks(tasks, timezone),
    [tasks, timezone],
  );

  // Current-time indicator
  const [nowMin, setNowMin] = useState<number | null>(null);
  useEffect(() => {
    function update() {
      const min = toMinuteOfDay(new Date().toISOString(), timezone);
      setNowMin(min);
    }
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [timezone]);

  // Auto-scroll to first task or current time on mount
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollRef.current) return;
    const firstTimed = tasks.find((t) => t.scheduledStart);
    const scrollToMin = firstTimed
      ? toMinuteOfDay(firstTimed.scheduledStart!, timezone) - 60
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
            {hours.map((hour) => (
              <div
                key={hour}
                className="relative flex items-start justify-end pr-2.5 pt-1"
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                <span className="text-[11px] leading-none text-muted-foreground">
                  {fmtHour(hour)}
                </span>
              </div>
            ))}
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
                const hasParent = Boolean(task.parentTaskId);
                const colorClass =
                  STATUS_BLOCK[task.status] ?? STATUS_BLOCK.PENDING;

                return (
                  <div
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Task: ${task.title}`}
                    className={cn(
                      "absolute overflow-hidden rounded-lg border p-2 transition-shadow",
                      colorClass,
                      onTaskClick &&
                        "cursor-pointer hover:ring-2 hover:ring-ring focus:outline-none focus:ring-2 focus:ring-ring",
                      hasParent && "border-l-[3px] border-l-accent",
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
                    {hasParent && height > 52 && (
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
