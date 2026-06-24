import { toZonedTime } from "date-fns-tz";
import { format } from "date-fns";

/**
 * Format a UTC ISO string as a local time string in the given IANA timezone.
 * Output: "3:00 PM EDT"
 */
export function formatTimeInZone(iso: string, timezone: string): string {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  }).format(date);
  const abbr =
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value ?? "";
  return abbr ? `${time} ${abbr}` : time;
}

/**
 * Format a UTC ISO string as a local time with an optional day indicator.
 *
 * Compares the calendar date of the timestamp against the event date (both
 * in the event timezone). Returns the time string with a "+1d" suffix when
 * the timestamp falls on the next calendar day.
 *
 * Output examples:
 *   event day:  "3:00 PM EDT"
 *   next day:   "3:00 PM EDT +1d"
 */
export function formatTimeInZoneWithDay(
  iso: string,
  timezone: string,
  eventDateIso: string | null,
): string {
  const time = formatTimeInZone(iso, timezone);
  if (!eventDateIso) return time;

  const taskZoned = toZonedTime(new Date(iso), timezone);
  const eventZoned = toZonedTime(new Date(eventDateIso), timezone);
  const taskDay = format(taskZoned, "yyyy-MM-dd");
  const eventDay = format(eventZoned, "yyyy-MM-dd");

  return taskDay !== eventDay ? `${time} +1d` : time;
}

/**
 * Format a UTC ISO string as a long date in the given IANA timezone.
 * Output: "Saturday, June 14, 2025"
 */
export function formatDateInZone(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: timezone,
  }).format(new Date(iso));
}
