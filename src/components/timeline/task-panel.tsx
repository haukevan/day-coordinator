"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { format, addDays } from "date-fns";
import {
  ChevronDown,
  Clock,
  Link2,
  Trash2,
  Check,
  X,
  Loader2,
  User,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { SerializedTask, SerializedVendor } from "@/lib/types";

// ── Timezone helpers ──────────────────────────────────────────────────────────

/** Extract HH:mm from a UTC ISO string displayed in a given timezone. */
function utcToLocalHHMM(iso: string, timezone: string): string {
  const zoned = toZonedTime(new Date(iso), timezone);
  return format(zoned, "HH:mm");
}

/** Determine the calendar day offset (0 or 1) of a UTC ISO timestamp
 *  relative to the event date in the event timezone. */
function getDayOffset(
  iso: string,
  eventDateISO: string | null,
  timezone: string,
): number {
  if (!eventDateISO) return 0;
  const taskDay = format(toZonedTime(new Date(iso), timezone), "yyyy-MM-dd");
  const eventDay = format(
    toZonedTime(new Date(eventDateISO), timezone),
    "yyyy-MM-dd",
  );
  if (taskDay === eventDay) return 0;
  // Compute signed day difference
  const taskDate = new Date(taskDay + "T12:00:00");
  const eventDate = new Date(eventDay + "T12:00:00");
  const diff = Math.round(
    (taskDate.getTime() - eventDate.getTime()) / (24 * 60 * 60 * 1000),
  );
  return diff;
}

/** Convert an event-local HH:mm time to a UTC ISO string.
 *  Uses eventDate as the calendar date (in the event timezone).
 *  @param dayOffset number of days to add to the event date (0 = event day, 1 = next day) */
function localHHMMToUtcISO(
  eventDateISO: string | null,
  hhmm: string,
  timezone: string,
  dayOffset = 0,
): string {
  // Derive the calendar date in the event timezone from eventDate.
  // We use noon UTC of the eventDate to avoid midnight-boundary mismatches
  // for UTC-offset timezones where UTC midnight falls on the previous day.
  const baseMs = eventDateISO
    ? new Date(eventDateISO).getTime() + 12 * 60 * 60_000
    : Date.now();
  const baseDate = new Date(baseMs);

  // Get the date string in the event timezone (YYYY-MM-DD)
  let datePart = format(toZonedTime(baseDate, timezone), "yyyy-MM-dd");

  // Apply day offset (e.g., +1 for next-day tasks)
  if (dayOffset !== 0) {
    datePart = format(
      addDays(new Date(datePart + "T12:00:00"), dayOffset),
      "yyyy-MM-dd",
    );
  }

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
  onClear,
  onlyAM = false,
}: Readonly<{
  value: string;
  onChange: (hhmm: string) => void;
  minInclusive?: string | null;
  onClear?: () => void;
  onlyAM?: boolean;
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

  /** Check if *any* minute in the given hour is selectable (uses max minute 55). */
  function isHourSelectable(h: number, p: "AM" | "PM") {
    if (minInclusiveMinutes === null) return true;
    return hhmmToMinutes(to24h(h, 55, p)) >= minInclusiveMinutes;
  }

  /** Check if *any* time in the given period is selectable. */
  function isPeriodSelectable(p: "AM" | "PM") {
    // Next-day mode restricts to AM only
    if (onlyAM && p === "PM") return false;
    if (minInclusiveMinutes === null) return true;
    // AM runs from 12:00 AM (0 min) to 11:55 AM (715 min)
    // PM runs from 12:00 PM (720 min) to 11:55 PM (1435 min)
    if (p === "AM") return minInclusiveMinutes <= 715;
    return true;
  }

  /** Find the first valid (hour, minute) in a period, or null. */
  function findFirstValidInPeriod(
    p: "AM" | "PM",
  ): { h: number; m: number } | null {
    for (const h of HOURS_12) {
      if (!isHourSelectable(h, p)) continue;
      const m = MINUTES_5.find((mm) => isSelectable(h, mm, p));
      if (m !== undefined) return { h, m };
    }
    return null;
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
    // Auto-correct selection to the first valid time if current selection is invalid
    if (minInclusiveMinutes !== null && !isSelectable(selH, selM, selPeriod)) {
      for (const p of ["AM", "PM"] as const) {
        const first = findFirstValidInPeriod(p);
        if (first) {
          setSelH(first.h);
          setSelM(first.m);
          setSelPeriod(p);
          break;
        }
      }
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

  /** Commit an hour selection, auto-adjusting minutes up if needed. */
  function commitHour(h: number) {
    setSelH(h);
    if (minInclusiveMinutes === null) {
      onChange(to24h(h, selM, selPeriod));
      return;
    }
    const currentMins = hhmmToMinutes(to24h(h, selM, selPeriod));
    if (currentMins >= minInclusiveMinutes) {
      onChange(to24h(h, selM, selPeriod));
      return;
    }
    // Find the first 5-min increment that meets the minimum
    const firstValidM = MINUTES_5.find(
      (m) => hhmmToMinutes(to24h(h, m, selPeriod)) >= minInclusiveMinutes,
    );
    if (firstValidM !== undefined) {
      setSelM(firstValidM);
      onChange(to24h(h, firstValidM, selPeriod));
    }
  }

  return (
    <>
      <div className="relative flex w-full rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-ring">
        <button
          ref={triggerRef}
          type="button"
          onClick={handleTrigger}
          className="flex flex-1 items-center gap-1 px-2.5 py-1.5 text-sm focus:outline-none min-h-[42px]"
        >
          <Clock className="size-3.5 shrink-0 text-muted-foreground" />
          <span
            className={cn(
              "flex-1 text-left",
              value ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {value ? formatTimeDisplay(value) : "Select time"}
          </span>
        </button>
        {onClear && value && (
          <button
            type="button"
            aria-label="Clear time"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="mr-1 flex shrink-0 items-center justify-center self-center rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

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
                const selectable = isHourSelectable(h, selPeriod);
                return (
                  <button
                    key={h}
                    type="button"
                    data-selected={selH === h ? "true" : undefined}
                    disabled={!selectable}
                    onClick={() => {
                      commitHour(h);
                    }}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm transition-colors min-h-[42px]",
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
                      "rounded-md px-3 py-1.5 text-sm transition-colors min-h-[42px]",
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
                const selectable = isPeriodSelectable(p);
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={!selectable}
                    onClick={() => {
                      setSelPeriod(p);
                      if (isSelectable(selH, selM, p)) {
                        commit(selH, selM, p);
                      } else {
                        const first = findFirstValidInPeriod(p);
                        if (first) {
                          setSelH(first.h);
                          setSelM(first.m);
                          commit(first.h, first.m, p);
                        }
                      }
                    }}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm transition-colors min-h-[42px]",
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

/** Format duration in minutes as a human-readable string, e.g. "1hr 30min". */
function formatDurationLabel(totalMins: number): string {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}hr`;
  return `${h}hr ${m}min`;
}

// ── VendorChip ─────────────────────────────────────────────────────────────

function VendorChip({
  vendor,
  onRemove,
}: Readonly<{
  vendor: SerializedVendor;
  onRemove: () => void;
}>) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
      <span className="truncate max-w-[160px]">{vendor.email}</span>
      <button
        type="button"
        onClick={onRemove}
        className="flex size-4 shrink-0 items-center justify-center rounded-full text-primary/70 transition-colors hover:bg-primary/20 hover:text-primary"
        aria-label={`Remove ${vendor.email}`}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

// ── AvailableVendorRow ────────────────────────────────────────────────────

function AvailableVendorRow({
  vendor,
  selected,
  onToggle,
}: Readonly<{
  vendor: SerializedVendor;
  selected: boolean;
  onToggle: (id: string) => void;
}>) {
  const displayName =
    vendor.firstName || vendor.lastName
      ? [vendor.firstName, vendor.lastName].filter(Boolean).join(" ")
      : vendor.email;

  return (
    <button
      type="button"
      onClick={() => onToggle(vendor.id)}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      {selected ? (
        <Check className="size-3.5 shrink-0 text-primary" />
      ) : (
        <User className="size-3.5 shrink-0 text-muted-foreground" />
      )}
      <div className="flex flex-col min-w-0">
        <span className="truncate text-xs font-medium">{displayName}</span>
        {vendor.firstName || vendor.lastName ? (
          <span className="truncate text-[11px] text-muted-foreground">
            {vendor.email}
          </span>
        ) : null}
      </div>
    </button>
  );
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
  vendors,
  readOnly = false,
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
  vendors: SerializedVendor[];
  readOnly?: boolean;
}) {
  const isEdit = Boolean(task);

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [startHHMM, setStartHHMM] = useState(
    task?.scheduledStart ? utcToLocalHHMM(task.scheduledStart, timezone) : "",
  );
  const [endHHMM, setEndHHMM] = useState(
    task?.scheduledEnd ? utcToLocalHHMM(task.scheduledEnd, timezone) : "",
  );
  const [startNextDay, setStartNextDay] = useState(
    task?.scheduledStart
      ? getDayOffset(task.scheduledStart, eventDate, timezone) > 0
      : false,
  );
  const [endNextDay, setEndNextDay] = useState(
    task?.scheduledEnd
      ? getDayOffset(task.scheduledEnd, eventDate, timezone) > 0
      : false,
  );
  const [parentTaskId, setParentTaskId] = useState(task?.parentTaskId ?? "");
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>(
    task?.taskVendors?.map((tv) => tv.eventVendorId) ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  // Brief skeleton state while form initializes (Sheet animation)
  const [formReady, setFormReady] = useState(false);

  // Reset form when the task prop changes (e.g., switching from create → edit)
  useEffect(() => {
    setFormReady(false);
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setStartHHMM(
      task?.scheduledStart ? utcToLocalHHMM(task.scheduledStart, timezone) : "",
    );
    setEndHHMM(
      task?.scheduledEnd ? utcToLocalHHMM(task.scheduledEnd, timezone) : "",
    );
    setStartNextDay(
      task?.scheduledStart
        ? getDayOffset(task.scheduledStart, eventDate, timezone) > 0
        : false,
    );
    setEndNextDay(
      task?.scheduledEnd
        ? getDayOffset(task.scheduledEnd, eventDate, timezone) > 0
        : false,
    );
    setParentTaskId(task?.parentTaskId ?? "");
    setSelectedVendorIds(
      task?.taskVendors?.map((tv) => tv.eventVendorId) ?? [],
    );
    setDeleting(false);
    setConfirmDelete(false);
    setError("");
  }, [task, timezone, open]);

  // Mark form ready after first paint so skeleton hides
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setFormReady(true));
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Auto-fill times from parent's scheduledEnd when blocking task changes.
  function handleParentChange(pid: string) {
    setParentTaskId(pid);
    if (!pid) return;

    const parent = tasks.find((t) => t.id === pid);
    if (!parent?.scheduledEnd) return;

    const parentEndHHMM = utcToLocalHHMM(parent.scheduledEnd, timezone);
    const parentNextDay =
      getDayOffset(parent.scheduledEnd, eventDate, timezone) > 0;

    if (startHHMM && endHHMM) {
      // Both start and end are set — preserve duration, shift both
      const origDuration = hhmmToMinutes(endHHMM) - hhmmToMinutes(startHHMM);
      setStartHHMM(parentEndHHMM);
      setStartNextDay(parentNextDay);
      if (origDuration > 0) {
        const newEndTotalMins = hhmmToMinutes(parentEndHHMM) + origDuration;
        const endH = Math.floor(newEndTotalMins / 60) % 24;
        const endM = newEndTotalMins % 60;
        setEndHHMM(
          `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
        );
        // If total end is beyond 24h, set endNextDay
        if (newEndTotalMins >= 24 * 60) {
          setEndNextDay(true);
        }
      }
    } else if (!startHHMM && endHHMM) {
      // Only end is set, no start — set both to parent's end
      setStartHHMM(parentEndHHMM);
      setStartNextDay(parentNextDay);
      setEndHHMM(parentEndHHMM);
      setEndNextDay(parentNextDay);
    } else {
      // Only start set (or neither) — just update start
      setStartHHMM(parentEndHHMM);
      setStartNextDay(parentNextDay);
    }
  }

  // Computed duration from start and end times (handles cross-midnight)
  const startMins = startHHMM ? hhmmToMinutes(startHHMM) : Number.NaN;
  const endMinsRaw = endHHMM ? hhmmToMinutes(endHHMM) : Number.NaN;
  // If end is next-day but start is not, add 24h worth of minutes
  const endMins =
    !Number.isNaN(endMinsRaw) && endNextDay && !startNextDay
      ? endMinsRaw + 24 * 60
      : !Number.isNaN(endMinsRaw) && startNextDay && endNextDay
        ? endMinsRaw
        : endMinsRaw;
  const durationMins =
    !Number.isNaN(startMins) && !Number.isNaN(endMins) && endMins > startMins
      ? endMins - startMins
      : Number.NaN;

  // The end display value for cross-day: if end is next-day and start is not,
  // we offset end display by 24h for correct duration calculation
  const endDisplayMins =
    !Number.isNaN(endMinsRaw) && endNextDay && !startNextDay
      ? endMinsRaw + 24 * 60
      : endMinsRaw;

  // Summary label: "12:00 PM - 1:00 PM (1hr)" or cross-day with +1d
  const summaryLabel =
    startHHMM && endHHMM && !Number.isNaN(durationMins)
      ? `${formatTimeDisplay(startHHMM)}${startNextDay ? " +1d" : ""} - ${formatTimeDisplay(endHHMM)}${endNextDay ? " +1d" : ""} (${formatDurationLabel(durationMins)})`
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

  function handleAddVendor(id: string) {
    setSelectedVendorIds((prev) => [...prev, id]);
  }

  function handleRemoveVendor(id: string) {
    setSelectedVendorIds((prev) => prev.filter((vid) => vid !== id));
  }

  // Compare current form state with original task to detect unsaved changes
  const hasChanges = useMemo(() => {
    if (!isEdit || !task) return true; // create mode: always allow submit
    const origTitle = task.title ?? "";
    const origDesc = task.description ?? "";
    const origStart = task.scheduledStart
      ? utcToLocalHHMM(task.scheduledStart, timezone)
      : "";
    const origEnd = task.scheduledEnd
      ? utcToLocalHHMM(task.scheduledEnd, timezone)
      : "";
    const origStartNextDay = task.scheduledStart
      ? getDayOffset(task.scheduledStart, eventDate, timezone) > 0
      : false;
    const origEndNextDay = task.scheduledEnd
      ? getDayOffset(task.scheduledEnd, eventDate, timezone) > 0
      : false;
    const origParentId = task.parentTaskId ?? "";
    const origVendorIds = (
      task.taskVendors?.map((tv) => tv.eventVendorId) ?? []
    )
      .slice()
      .sort((a, b) => a.localeCompare(b));
    const curVendorIds = selectedVendorIds
      .slice()
      .sort((a, b) => a.localeCompare(b));

    return (
      title !== origTitle ||
      description !== origDesc ||
      startHHMM !== origStart ||
      endHHMM !== origEnd ||
      startNextDay !== origStartNextDay ||
      endNextDay !== origEndNextDay ||
      parentTaskId !== origParentId ||
      curVendorIds.length !== origVendorIds.length ||
      curVendorIds.some((id, i) => id !== origVendorIds[i])
    );
  }, [
    isEdit,
    task,
    title,
    description,
    startHHMM,
    endHHMM,
    startNextDay,
    endNextDay,
    parentTaskId,
    selectedVendorIds,
    timezone,
    eventDate,
  ]);

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

    // ── Next-day boundary check: max 12 hours past midnight of event date ──
    if (startNextDay || endNextDay) {
      const maxEndLocal = "12:00"; // noon next day = 12 hours past midnight
      const maxEndISO = localHHMMToUtcISO(eventDate, maxEndLocal, timezone, 1);
      const maxEndMs = new Date(maxEndISO).getTime();

      // Check start time
      const startISO = localHHMMToUtcISO(
        eventDate,
        startHHMM,
        timezone,
        startNextDay ? 1 : 0,
      );
      if (new Date(startISO).getTime() > maxEndMs) {
        setError("Next-day tasks must start by noon the day after the event.");
        setSaving(false);
        return;
      }

      // Check end time
      if (endHHMM) {
        const endISO = localHHMMToUtcISO(
          eventDate,
          endHHMM,
          timezone,
          endNextDay ? 1 : 0,
        );
        if (new Date(endISO).getTime() > maxEndMs) {
          setError("Next-day tasks must end by noon the day after the event.");
          setSaving(false);
          return;
        }
      }
    }

    // Cross-day validation: end must be after start in absolute time
    if (endHHMM) {
      const startISO = localHHMMToUtcISO(
        eventDate,
        startHHMM,
        timezone,
        startNextDay ? 1 : 0,
      );
      const endISO = localHHMMToUtcISO(
        eventDate,
        endHHMM,
        timezone,
        endNextDay ? 1 : 0,
      );
      if (new Date(endISO).getTime() <= new Date(startISO).getTime()) {
        setError("End time must be after start time.");
        setSaving(false);
        return;
      }
    }

    const scheduledStartISO = localHHMMToUtcISO(
      eventDate,
      startHHMM,
      timezone,
      startNextDay ? 1 : 0,
    );
    const scheduledEndISO = endHHMM
      ? localHHMMToUtcISO(eventDate, endHHMM, timezone, endNextDay ? 1 : 0)
      : null;

    setSaving(true);
    setError("");

    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || null,
      scheduledStart: scheduledStartISO,
      scheduledEnd: scheduledEndISO,
      parentTaskId: parentTaskId || null,
      vendorIds: selectedVendorIds,
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
    // Full navigation to ensure all sheets/state are reset after delete
    window.location.href = `/events/${eventId}/timeline`;
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col sm:max-w-xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="px-4">
          <SheetTitle>
            {readOnly
              ? (task?.title ?? "Task details")
              : isEdit
                ? "Edit task"
                : "New task"}
          </SheetTitle>
        </SheetHeader>

        {readOnly ? (
          /* ── Read-only vendor view ─────────────────────────────────────── */
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
            {/* Description */}
            {task?.description && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Notes
                </span>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {task.description}
                </p>
              </div>
            )}

            {/* Time */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Time
              </span>
              <p className="text-sm text-foreground">
                {summaryLabel ?? (
                  <>
                    {startHHMM ? formatTimeDisplay(startHHMM) : "Not scheduled"}
                    {startHHMM && endHHMM && (
                      <> – {formatTimeDisplay(endHHMM)}</>
                    )}
                  </>
                )}
              </p>
              {!Number.isNaN(durationMins) && (
                <p className="text-xs text-muted-foreground">
                  Duration: {formatDurationLabel(durationMins)}
                </p>
              )}
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Status
              </span>
              <p className="text-sm text-foreground capitalize">
                {task?.status?.toLowerCase().replace(/_/g, " ") ?? "—"}
              </p>
            </div>

            {/* Blocked by */}
            {parent && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Blocked by
                </span>
                <p className="text-sm text-foreground">
                  {parent.title}
                  {hasBuffer
                    ? ` · ${bufferMins} min buffer`
                    : " · starts right after"}
                </p>
              </div>
            )}

            {/* Vendors */}
            {selectedVendorIds.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Vendors
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedVendorIds.map((vid) => {
                    const vendor = vendors.find((v) => v.id === vid);
                    if (!vendor) return null;
                    const displayName =
                      vendor.firstName || vendor.lastName
                        ? [vendor.firstName, vendor.lastName]
                            .filter(Boolean)
                            .join(" ")
                        : vendor.email;
                    return (
                      <span
                        key={vid}
                        className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                      >
                        {displayName}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── Admin edit/create form ────────────────────────────────────── */
          <form
            id="task-form"
            onSubmit={handleSubmit}
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
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
                required
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
              {formReady ? (
                <>
                  <div className="relative">
                    <select
                      value={parentTaskId}
                      onChange={(e) => handleParentChange(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-border bg-background py-2 pl-3 pr-8 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">None</option>
                      {eligiblePrereqs.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                          {(() => {
                            const displayIso =
                              t.scheduledEnd ?? t.scheduledStart;
                            return displayIso
                              ? ` · ends ${formatEndTime(displayIso, timezone)}`
                              : "";
                          })()}
                          {t.status === "COMPLETED" ? " ✓" : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  </div>
                  {!parentTaskId && (
                    <p className="text-xs text-muted-foreground">
                      Choose a task that must finish before this one can start.
                      If that task shifts, this one moves with it automatically.
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
                      . If that task runs late, this one shifts to stay in
                      sequence.
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full rounded-lg" />
                  <Skeleton className="h-4 w-64" />
                </div>
              )}
            </div>

            {/* Start + End row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Clock className="size-3.5 text-muted-foreground" />
                  Start time <span className="text-destructive">*</span>
                </label>
                <TimePickerPopover
                  value={startHHMM}
                  minInclusive={minInclusiveStartHHMM}
                  onlyAM={startNextDay}
                  onChange={(hhmm) => {
                    setStartHHMM(hhmm);
                  }}
                />
                <label className="flex items-center gap-1.5 self-start cursor-pointer select-none">
                  <Switch
                    checked={startNextDay}
                    onCheckedChange={(checked) => {
                      if (checked && startHHMM) {
                        const mins = hhmmToMinutes(startHHMM);
                        if (mins >= 12 * 60) setStartHHMM("");
                      }
                      setStartNextDay(checked);
                    }}
                    className="scale-75"
                  />
                  <span className="text-xs text-muted-foreground">
                    Next day
                  </span>
                  {startNextDay && (
                    <span className="rounded bg-primary/10 px-1 text-[10px] font-medium text-primary">
                      +1d
                    </span>
                  )}
                </label>
                {minInclusiveStartHHMM && (
                  <p className="text-xs text-muted-foreground">
                    Start must be at or after{" "}
                    {formatTimeDisplay(minInclusiveStartHHMM)}.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Clock className="size-3.5 text-muted-foreground" />
                  End time
                </label>
                <TimePickerPopover
                  value={endHHMM}
                  minInclusive={
                    startNextDay === endNextDay
                      ? startHHMM || undefined
                      : undefined
                  }
                  onlyAM={endNextDay}
                  onChange={(hhmm) => {
                    setEndHHMM(hhmm);
                  }}
                  onClear={() => setEndHHMM("")}
                />
                <label className="flex items-center gap-1.5 self-start cursor-pointer select-none">
                  <Switch
                    checked={endNextDay}
                    onCheckedChange={(checked) => {
                      if (checked && endHHMM) {
                        const mins = hhmmToMinutes(endHHMM);
                        if (mins >= 12 * 60) setEndHHMM("");
                      }
                      setEndNextDay(checked);
                    }}
                    className="scale-75"
                  />
                  <span className="text-xs text-muted-foreground">
                    Next day
                  </span>
                  {endNextDay && (
                    <span className="rounded bg-primary/10 px-1 text-[10px] font-medium text-primary">
                      +1d
                    </span>
                  )}
                </label>
              </div>
            </div>

            {/* Summary: "12:00 PM - 1:00 PM (1hr)" */}
            {summaryLabel && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {summaryLabel}
                </span>
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

            {/* Vendors */}
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <User className="size-3.5 text-muted-foreground" />
                Vendors{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>
              <p className="text-xs text-muted-foreground">
                Vendors who are responsible for this task.
              </p>

              {/* Add vendors button + popover */}
              {vendors.length > 0 ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-fit gap-1.5"
                    >
                      <User className="size-3.5" />
                      Add vendors
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-64 p-0"
                    align="start"
                    sideOffset={4}
                  >
                    <div className="flex max-h-52 flex-col overflow-y-auto p-1">
                      {vendors.map((vendor) => (
                        <AvailableVendorRow
                          key={vendor.id}
                          vendor={vendor}
                          selected={selectedVendorIds.includes(vendor.id)}
                          onToggle={(id) =>
                            selectedVendorIds.includes(id)
                              ? handleRemoveVendor(id)
                              : handleAddVendor(id)
                          }
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No vendors added to this event yet.
                </p>
              )}

              {/* Selected vendor chips */}
              {selectedVendorIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedVendorIds.map((vid) => {
                    const vendor = vendors.find((v) => v.id === vid);
                    if (!vendor) return null;
                    return (
                      <VendorChip
                        key={vid}
                        vendor={vendor}
                        onRemove={() => handleRemoveVendor(vid)}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Error */}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </form>
        )}

        {/* Actions */}
        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border bg-background px-4 py-4">
          {readOnly ? (
            <div className="flex w-full justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
              >
                Done
              </Button>
            </div>
          ) : (
            /* ── Admin actions ─────────────────────────────────────── */
            <>
              <div className="flex items-center">
                {isEdit && (
                  <Button
                    type="button"
                    variant={confirmDelete ? "destructive" : "ghost"}
                    size="sm"
                    className="overflow-hidden transition-all duration-200 ease-in-out"
                    aria-label={
                      confirmDelete ? "Confirm delete task" : "Delete task"
                    }
                    title="Delete task"
                    onClick={handleDeleteTask}
                    disabled={saving || deleting}
                  >
                    {deleting ? (
                      <Loader2 className="size-4 shrink-0 animate-spin" />
                    ) : (
                      <Trash2 className="size-4 shrink-0" />
                    )}
                    <span
                      className={cn(
                        "whitespace-nowrap transition-all duration-200 ease-in-out",
                        confirmDelete
                          ? "max-w-[120px] ml-1.5 opacity-100"
                          : "max-w-0 ml-0 opacity-0",
                      )}
                    >
                      {deleting ? "Deleting…" : "Delete task"}
                    </span>
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {confirmDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                    disabled={saving || deleting}
                  >
                    Cancel
                  </Button>
                ) : (
                  <>
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
                    <Button
                      type="submit"
                      size="sm"
                      disabled={saving || deleting || (isEdit && !hasChanges)}
                      form="task-form"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Saving…
                        </>
                      ) : isEdit ? (
                        "Save changes"
                      ) : (
                        "Create task"
                      )}
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
