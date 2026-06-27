"use client";

import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type DateStatus,
  formatShortDateInZone,
  getDateStatus,
} from "@/lib/format-time";

/**
 * Displays the event date with a relative "today / upcoming / past"
 * indicator, computed in the browser's local timezone so that the
 * comparison matches what the user actually experiences as "today".
 */
export function EventDateBadge({
  eventDate,
  className,
}: Readonly<{
  eventDate: Date;
  className?: string;
}>) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const status: DateStatus = getDateStatus(eventDate, timezone);
  const formatted = formatShortDateInZone(eventDate, timezone);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium min-h-[28px]",
        status === "today" && "bg-warning/15 text-warning",
        status === "upcoming" && "bg-info/15 text-info",
        status === "past" && "bg-muted text-muted-foreground",
        className,
      )}
    >
      <CalendarDays className="size-3" />
      <span className="sm:hidden">
        {status === "today" ? "Today" : formatted}
      </span>
      <span className="hidden sm:inline">
        {status === "today" ? `Today · ${formatted}` : formatted}
      </span>
    </span>
  );
}
