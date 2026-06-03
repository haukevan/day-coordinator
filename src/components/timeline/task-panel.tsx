"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { format, addMinutes } from "date-fns";
import { Clock, ChevronDown, Link2, Trash2, Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SerializedTask } from "@/lib/types";

// ── Timezone helpers ──────────────────────────────────────────────────────────

/** Extract HH:mm from a UTC ISO string displayed in a given timezone. */
function utcToLocalHHMM(iso: string, timezone: string): string {
  const zoned = toZonedTime(new Date(iso), timezone);
  return format(zoned, "HH:mm");
}

/** Convert an event-local HH:mm time to a UTC ISO string.
 *  Uses eventDate as the calendar date (in the event timezone). */
function localHHMMToUtcISO(
  eventDateISO: string | null,
  hhmm: string,
  timezone: string,
): string {
  // Derive the calendar date in the event timezone from eventDate.
  // We use noon UTC of the eventDate to avoid midnight-boundary mismatches
  // for UTC-offset timezones where UTC midnight falls on the previous day.
  const baseMs = eventDateISO
    ? new Date(eventDateISO).getTime() + 12 * 60 * 60_000
    : Date.now();
  const baseDate = new Date(baseMs);

  // Get the date string in the event timezone (YYYY-MM-DD)
  const datePart = format(toZonedTime(baseDate, timezone), "yyyy-MM-dd");

  // Combine date + user-entered time as a local datetime string, then convert
  // to UTC using the event timezone.
  return fromZonedTime(`${datePart}T${hhmm}:00`, timezone).toISOString();
}

/** Format a UTC ISO scheduledEnd for display, e.g. "10:30 AM". */
function formatEndTime(endISO: string, timezone: string): string {
  const zoned = toZonedTime(new Date(endISO), timezone);
  return format(zoned, "h:mm a");
}

// ── Time picker helpers ───────────────────────────────────────────────────────

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12
const MINUTES_5 = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,10…55

function to12h(hhmm: string): { h: number; m: number; period: "AM" | "PM" } {
  const [hStr, mStr] = hhmm.split(":");
  const h24 = Number.parseInt(hStr, 10);
  const m = Number.parseInt(mStr, 10);
  const period: "AM" | "PM" = h24 < 12 ? "AM" : "PM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return { h, m: Number.isNaN(m) ? 0 : m, period };
}

function to24h(h: number, m: number, period: "AM" | "PM"): string {
  let h24 = h % 12;
  if (period === "PM") h24 += 12;
  return `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatTimeDisplay(hhmm: string): string {
  const { h, m, period } = to12h(hhmm);
  return `${h}:${String(m).padStart(2, "0")} ${period}`;
}

function hhmmToMinutes(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number.parseInt(hStr, 10);
  const m = Number.parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return Number.NaN;
  return h * 60 + m;
}

function TimePickerPopover({
  value,
  onChange,
  minInclusive,
}: Readonly<{
  value: string;
  onChange: (hhmm: string) => void;
  minInclusive?: string | null;
}>) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);

  const parsed = value ? to12h(value) : null;
  const [selH, setSelH] = useState(parsed?.h ?? 12);
  const [selM, setSelM] = useState(parsed?.m ?? 0);
  const [selPeriod, setSelPeriod] = useState<"AM" | "PM">(
    parsed?.period ?? "AM",
  );

  const minInclusiveMinutes = useMemo(() => {
    if (!minInclusive) return null;
    const mins = hhmmToMinutes(minInclusive);
    return Number.isNaN(mins) ? null : mins;
  }, [minInclusive]);

  function isSelectable(h: number, m: number, p: "AM" | "PM") {
    if (minInclusiveMinutes === null) return true;
    return hhmmToMinutes(to24h(h, m, p)) >= minInclusiveMinutes;
  }

  useEffect(() => {
    if (value) {
      const { h, m, period } = to12h(value);
      setSelH(h);
      setSelM(m);
      setSelPeriod(period);
    }
  }, [value]);

  // Auto-scroll selected items into view whenever the dropdown opens
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      hourRef.current
        ?.querySelector<HTMLButtonElement>("[data-selected='true']")
        ?.scrollIntoView({ block: "center", behavior: "instant" });
      minuteRef.current
        ?.querySelector<HTMLButtonElement>("[data-selected='true']")
        ?.scrollIntoView({ block: "center", behavior: "instant" });
    }, 50);
    return () => clearTimeout(timer);
  }, [open]);

  // Close on outside pointer-down
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (
        !dropdownRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function handleTrigger() {
    if (open) {
      setOpen(false);
      return;
    }
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const viewportPadding = 12;
      const gap = 4;
      const dropdownHeight = 216;
      const spaceBelow = window.innerHeight - r.bottom - viewportPadding;
      const spaceAbove = r.top - viewportPadding;
      const top =
        spaceBelow < dropdownHeight && spaceAbove > spaceBelow
          ? Math.max(viewportPadding, r.top - dropdownHeight - gap)
          : r.bottom + gap;
      const dropdownWidth = Math.min(
        248,
        window.innerWidth - viewportPadding * 2,
      );
      const left = Math.max(
        viewportPadding,
        Math.min(r.left, window.innerWidth - dropdownWidth - viewportPadding),
      );
      setPos({ top, left, width: dropdownWidth });
    }
    setOpen(true);
  }

  function commit(h: number, m: number, p: "AM" | "PM") {
    if (!isSelectable(h, m, p)) return;
    onChange(to24h(h, m, p));
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTrigger}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring",
          value ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <Clock className="size-3.5 shrink-0 text-muted-foreground" />
        {value ? formatTimeDisplay(value) : "Select time"}
      </button>

      {open && pos && (
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: pos.width,
          }}
          className="z-[9999] flex divide-x divide-border overflow-hidden rounded-lg bg-popover shadow-md ring-1 ring-foreground/10"
        >
          {/* Hours */}
          <div
            ref={hourRef}
            className="flex max-h-52 flex-col overflow-y-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {HOURS_12.map((h) =>
              (() => {
                const selectable = isSelectable(h, selM, selPeriod);
                return (
                  <button
                    key={h}
                    type="button"
                    data-selected={selH === h ? "true" : undefined}
                    disabled={!selectable}
                    onClick={() => {
                      setSelH(h);
                      commit(h, selM, selPeriod);
                    }}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm transition-colors",
                      selectable
                        ? "hover:bg-accent hover:text-accent-foreground"
                        : "cursor-not-allowed opacity-40",
                      selH === h
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground",
                    )}
                  >
                    {h}
                  </button>
                );
              })(),
            )}
          </div>

          {/* Minutes */}
          <div
            ref={minuteRef}
            className="flex max-h-52 flex-col overflow-y-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {MINUTES_5.map((m) =>
              (() => {
                const selectable = isSelectable(selH, m, selPeriod);
                return (
                  <button
                    key={m}
                    type="button"
                    data-selected={selM === m ? "true" : undefined}
                    disabled={!selectable}
                    onClick={() => {
                      setSelM(m);
                      commit(selH, m, selPeriod);
                    }}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm transition-colors",
                      selectable
                        ? "hover:bg-accent hover:text-accent-foreground"
                        : "cursor-not-allowed opacity-40",
                      selM === m
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground",
                    )}
                  >
                    {String(m).padStart(2, "0")}
                  </button>
                );
              })(),
            )}
          </div>

          {/* AM / PM */}
          <div className="flex flex-col p-1">
            {(["AM", "PM"] as const).map((p) =>
              (() => {
                const selectable = isSelectable(selH, selM, p);
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={!selectable}
                    onClick={() => {
                      setSelPeriod(p);
                      commit(selH, selM, p);
                      setOpen(false);
                    }}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm transition-colors",
                      selectable
                        ? "hover:bg-accent hover:text-accent-foreground"
                        : "cursor-not-allowed opacity-40",
                      selPeriod === p
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground",
                    )}
                  >
                    {p}
                  </button>
                );
              })(),
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Duration picker ─────────────────────────────────────────────────────────

const DURATION_SUGGESTIONS = [
  { mins: 5, label: "5 min" },
  { mins: 10, label: "10 min" },
  { mins: 15, label: "15 min" },
  { mins: 20, label: "20 min" },
  { mins: 30, label: "30 min" },
  { mins: 45, label: "45 min" },
  { mins: 60, label: "1 hr" },
  { mins: 75, label: "1 hr 15 min" },
  { mins: 90, label: "1 hr 30 min" },
  { mins: 105, label: "1 hr 45 min" },
  { mins: 120, label: "2 hr" },
  { mins: 135, label: "2 hr 15 min" },
  { mins: 150, label: "2 hr 30 min" },
  { mins: 165, label: "2 hr 45 min" },
  { mins: 180, label: "3 hr" },
  { mins: 210, label: "3 hr 30 min" },
  { mins: 240, label: "4 hr" },
  { mins: 270, label: "4 hr 30 min" },
  { mins: 300, label: "5 hr" },
];

function computeDurationDropdownPosition(r: DOMRect) {
  const viewportPadding = 12;
  const gap = 4;
  const preferredHeight = 280;
  const spaceBelow = window.innerHeight - r.bottom - viewportPadding;
  const spaceAbove = r.top - viewportPadding;
  const opensUp = spaceBelow < 180 && spaceAbove > spaceBelow;
  const maxHeight = Math.max(120, opensUp ? spaceAbove : spaceBelow);
  const heightForTop = Math.min(preferredHeight, maxHeight);
  const top = opensUp
    ? Math.max(viewportPadding, r.top - heightForTop - gap)
    : r.bottom + gap;
  const width = Math.min(r.width, window.innerWidth - viewportPadding * 2);
  const left = Math.max(
    viewportPadding,
    Math.min(r.left, window.innerWidth - width - viewportPadding),
  );
  return { top, left, width, maxHeight };
}

/** Format the computed end time given a start HH:mm and duration in minutes. */
function formatEndTimeFromStart(
  startHHMM: string,
  durationMins: number,
): string | null {
  const [h, m] = startHHMM.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m) || durationMins <= 0) return null;
  const totalMins = h * 60 + m + durationMins;
  const endH = Math.floor(totalMins / 60) % 24;
  const endM = totalMins % 60;
  return format(new Date(0, 0, 0, endH, endM), "h:mm a");
}

function DurationInput({
  value,
  onChange,
  startHHMM,
}: Readonly<{
  value: string;
  onChange: (v: string) => void;
  startHHMM?: string;
}>) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (
        !dropdownRef.current?.contains(e.target as Node) &&
        !wrapRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function handleToggle() {
    if (open) {
      setOpen(false);
      return;
    }
    if (wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setPos(computeDurationDropdownPosition(r));
    }
    setOpen(true);
  }

  function handleInputClick(e: React.MouseEvent<HTMLInputElement>) {
    e.currentTarget.select();
    if (!open) {
      if (wrapRef.current) {
        const r = wrapRef.current.getBoundingClientRect();
        setPos(computeDurationDropdownPosition(r));
      }
      setOpen(true);
    }
  }

  const numValue = value ? Number.parseInt(value, 10) : Number.NaN;

  return (
    <>
      <div ref={wrapRef} className="relative">
        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min="1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={handleInputClick}
          placeholder="e.g. 60"
          className="w-full rounded-lg border border-border bg-background py-2 pl-3 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={handleToggle}
          className="absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform duration-150",
              open && "rotate-180",
            )}
          />
        </button>
      </div>

      {open && pos && (
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: pos.width,
            maxHeight: pos.maxHeight,
          }}
          className="z-[9999] overflow-y-auto rounded-lg bg-popover py-1 shadow-md ring-1 ring-foreground/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {DURATION_SUGGESTIONS.map(({ mins, label }) => {
            const endTime = startHHMM
              ? formatEndTimeFromStart(startHHMM, mins)
              : null;
            return (
              <button
                key={mins}
                type="button"
                onClick={() => {
                  onChange(String(mins));
                  setOpen(false);
                }}
                className={cn(
                  "w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                  !Number.isNaN(numValue) && numValue === mins
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground",
                )}
              >
                <span>{label}</span>
                {endTime && (
                  <span className="ml-1.5 text-muted-foreground">
                    — {endTime}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

/** Compute end HH:mm from start HH:mm + duration. Returns null if inputs invalid. */
function computedEnd(
  startHHMM: string,
  durationMins: number,
): { hhmm: string; label: string } | null {
  const [h, m] = startHHMM.split(":").map(Number);
  if (isNaN(h) || isNaN(m) || durationMins <= 0) return null;
  const totalMins = h * 60 + m + durationMins;
  const endH = Math.floor(totalMins / 60) % 24;
  const endM = totalMins % 60;
  const hhmm = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

  // Build 12h label for the start
  const startLabel = format(addMinutes(new Date(0, 0, 0, h, m), 0), "h:mm a");
  const endLabel = format(new Date(0, 0, 0, endH, endM), "h:mm a");
  return { hhmm, label: `${startLabel} → ${endLabel}` };
}

// ── TaskPanel ─────────────────────────────────────────────────────────────────

export function TaskPanel({
  eventId,
  tasks,
  timezone,
  eventDate,
  task,
  open,
  onClose,
  onSaved,
  onRefresh,
}: {
  eventId: string;
  tasks: SerializedTask[];
  timezone: string;
  eventDate: string | null;
  task?: SerializedTask;
  open: boolean;
  onClose: () => void;
  onSaved: (task: SerializedTask) => void;
  onRefresh: () => void;
}) {
  const isEdit = Boolean(task);

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [startHHMM, setStartHHMM] = useState(
    task?.scheduledStart ? utcToLocalHHMM(task.scheduledStart, timezone) : "",
  );
  const [durationStr, setDurationStr] = useState(
    task?.durationMins?.toString() ?? "",
  );
  const [parentTaskId, setParentTaskId] = useState(task?.parentTaskId ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  // Reset form when the task prop changes (e.g., switching from create → edit)
  useEffect(() => {
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setStartHHMM(
      task?.scheduledStart ? utcToLocalHHMM(task.scheduledStart, timezone) : "",
    );
    setDurationStr(task?.durationMins?.toString() ?? "");
    setParentTaskId(task?.parentTaskId ?? "");
    setDeleting(false);
    setConfirmDelete(false);
    setError("");
  }, [task, timezone, open]);

  // Auto-fill start time from parent's scheduledEnd when blocking task changes.
  function handleParentChange(pid: string) {
    setParentTaskId(pid);
    if (pid) {
      const parent = tasks.find((t) => t.id === pid);
      if (parent?.scheduledEnd) {
        const parentEndHHMM = utcToLocalHHMM(parent.scheduledEnd, timezone);
        setStartHHMM(parentEndHHMM);
        return;
      }
    }
  }

  // Computed end time label
  const durationMins = durationStr ? parseInt(durationStr, 10) : NaN;
  const endInfo =
    startHHMM && !isNaN(durationMins)
      ? computedEnd(startHHMM, durationMins)
      : null;

  // Compute buffer from parent's end to this task's start (in minutes).
  // When parent shifts, this buffer is preserved.
  const parent = tasks.find((t) => t.id === parentTaskId);
  const parentEndHHMM = parent?.scheduledEnd
    ? utcToLocalHHMM(parent.scheduledEnd, timezone)
    : null;
  const bufferMins =
    parentEndHHMM && startHHMM
      ? Math.max(0, hhmmToMinutes(startHHMM) - hhmmToMinutes(parentEndHHMM))
      : null;
  const hasBuffer = bufferMins !== null && bufferMins > 0;

  const minInclusiveStartHHMM = parent?.scheduledEnd
    ? utcToLocalHHMM(parent.scheduledEnd, timezone)
    : null;

  // Eligible prerequisites: exclude self and descendants to avoid reverse links.
  const ineligiblePrereqIds = useMemo(() => {
    if (!task?.id) return new Set<string>();

    const childrenByParent = new Map<string, string[]>();
    for (const t of tasks) {
      if (!t.parentTaskId) continue;
      const siblings = childrenByParent.get(t.parentTaskId) ?? [];
      siblings.push(t.id);
      childrenByParent.set(t.parentTaskId, siblings);
    }

    const blocked = new Set<string>([task.id]);
    const stack = [task.id];

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      const children = childrenByParent.get(currentId) ?? [];
      for (const childId of children) {
        if (blocked.has(childId)) continue;
        blocked.add(childId);
        stack.push(childId);
      }
    }

    return blocked;
  }, [task?.id, tasks]);

  const eligiblePrereqs = tasks.filter((t) => !ineligiblePrereqIds.has(t.id));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Task name is required.");
      return;
    }
    if (!startHHMM) {
      setError("Start time is required.");
      return;
    }
    setSaving(true);
    setError("");

    const scheduledStartISO = localHHMMToUtcISO(eventDate, startHHMM, timezone);

    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || null,
      durationMins: !isNaN(durationMins) ? durationMins : null,
      scheduledStart: scheduledStartISO,
      parentTaskId: parentTaskId || null,
    };

    const url = isEdit
      ? `/api/events/${eventId}/tasks/${task!.id}`
      : `/api/events/${eventId}/tasks`;

    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setSaving(false);

    if (res.ok) {
      const t = data.task;
      onSaved({
        ...t,
        scheduledStart: t.scheduledStart ?? null,
        scheduledEnd: t.scheduledEnd ?? null,
        actualStart: t.actualStart ?? null,
        actualEnd: t.actualEnd ?? null,
        createdAt: t.createdAt ?? new Date().toISOString(),
        updatedAt: t.updatedAt ?? new Date().toISOString(),
        parentTask: t.parentTask ?? null,
      } as SerializedTask);
      // Refresh all tasks to pick up propagated schedule changes
      if (isEdit) onRefresh();
      onClose();
    } else {
      setError(data.error ?? "Failed to save task.");
    }
  }

  async function handleDeleteTask() {
    if (!isEdit || !task) return;

    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    setError("");

    const res = await fetch(`/api/events/${eventId}/tasks/${task.id}`, {
      method: "DELETE",
    });

    let data: { error?: string } | null = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    setDeleting(false);

    if (!res.ok) {
      setConfirmDelete(false);
      setError(data?.error ?? "Failed to delete task.");
      return;
    }

    onRefresh();
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader className="px-5">
          <SheetTitle>{isEdit ? "Edit task" : "New task"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update task details, schedule, and duration."
              : "Create a new task with a title, schedule, and duration."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="mt-4 flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4"
        >
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Task name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Bridal party photos"
              autoFocus
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Notes{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any relevant details..."
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Blocked by */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Link2 className="size-3.5 text-muted-foreground" />
              Blocked by{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <select
              value={parentTaskId}
              onChange={(e) => handleParentChange(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">None</option>
              {eligiblePrereqs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                  {t.scheduledEnd
                    ? ` · ends ${utcToLocalHHMM(t.scheduledEnd, timezone)}`
                    : ""}
                  {t.status === "COMPLETED" ? " ✓" : ""}
                </option>
              ))}
            </select>
            {!parentTaskId && (
              <p className="text-xs text-muted-foreground">
                Choose a task that must finish before this one can start. If
                that task shifts, this one moves with it automatically.
              </p>
            )}
            {parentTaskId && (
              <p className="text-xs text-muted-foreground">
                Can&apos;t start until{" "}
                <span className="font-medium text-foreground">
                  {parent?.title ?? "blocking task"}
                </span>{" "}
                finishes
                {hasBuffer
                  ? ` · ${bufferMins} min buffer after`
                  : " — starts right after"}
                . If that task runs late, this one shifts to stay in sequence.
              </p>
            )}
          </div>

          {/* Start + Duration row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Clock className="size-3.5 text-muted-foreground" />
                Start time <span className="text-destructive">*</span>
              </label>
              <TimePickerPopover
                value={startHHMM}
                minInclusive={minInclusiveStartHHMM}
                onChange={(hhmm) => {
                  setStartHHMM(hhmm);
                }}
              />
              {minInclusiveStartHHMM && (
                <p className="text-xs text-muted-foreground">
                  Start must be at or after{" "}
                  {formatTimeDisplay(minInclusiveStartHHMM)}.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Duration (min)
              </label>
              <DurationInput
                value={durationStr}
                onChange={setDurationStr}
                startHHMM={startHHMM || undefined}
              />
            </div>
          </div>

          {/* Computed end time */}
          {endInfo && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {endInfo.label}
              </span>
              <span>({durationMins} min)</span>
            </p>
          )}

          {/* Buffer info */}
          {hasBuffer && (
            <div className="flex items-start gap-2 rounded-lg border border-info/40 bg-info/5 px-3 py-2.5">
              <Clock className="mt-0.5 size-3.5 shrink-0 text-info" />
              <p className="text-xs text-foreground">
                {bufferMins} min buffer after{" "}
                <span className="font-medium">
                  {parent?.title ?? "blocking task"}
                </span>
                . If that task shifts, the buffer stays the same.
              </p>
            </div>
          )}

          {/* Error */}
          {error && <p className="text-xs text-destructive">{error}</p>}

          {/* Actions */}
          <div
            className={cn(
              "mt-auto flex items-center justify-between gap-2 border-t border-border pt-4",
            )}
          >
            <div className="flex items-center">
              {isEdit && (
                <Button
                  type="button"
                  variant={confirmDelete ? "destructive" : "ghost"}
                  size="icon"
                  aria-label={
                    confirmDelete ? "Confirm delete task" : "Delete task"
                  }
                  title={
                    confirmDelete
                      ? "Tap again to confirm delete"
                      : "Delete task"
                  }
                  onClick={handleDeleteTask}
                  disabled={saving || deleting}
                >
                  {confirmDelete ? (
                    <Check className="size-4" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfirmDelete(false);
                  onClose();
                }}
                disabled={saving || deleting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving || deleting}>
                {saving ? "Saving…" : isEdit ? "Save changes" : "Create task"}
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
