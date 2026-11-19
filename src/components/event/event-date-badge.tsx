"use client";

import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClientTimeZone } from "@/lib/use-client-timezone";
import {
  type DateStatus,
  formatShortDateInZone,
  getDateStatus,
} from "@/lib/format-time";

/**
 * Displays the event date with a relative "today / upcoming / past"
 * indicator, computed in the browser's local timezone so that the
 * comparison matches what the user actually experiences as "today".
 *
 * The timezone is resolved after mount; the first render uses a stable
 * fallback so SSR and hydration agree.
 */
export function EventDateBadge({
  eventDate,
  className,
}: Readonly<{
  eventDate: Date;
  className?: string;
}>) {
  const clientTimeZone = useClientTimeZone();
  const formatted = formatShortDateInZone(eventDate, clientTimeZone ?? "UTC");
  const status: DateStatus | null = clientTimeZone
    ? getDateStatus(eventDate, clientTimeZone)
    : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium min-h-[28px]",
        status === "today" && "bg-warning/15 text-warning",
        status === "upcoming" && "bg-info/15 text-info",
        status === "past" && "bg-muted text-muted-foreground",
        status === null && "bg-muted text-muted-foreground",
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
