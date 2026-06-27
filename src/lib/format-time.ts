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

/**
 * Format a Date as a short date string in the given IANA timezone.
 * Output: "Sat, Jun 27, 2026"
 */
export function formatShortDateInZone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: timezone,
  }).format(date);
}

export type DateStatus = "today" | "upcoming" | "past";

/**
 * Compare a Date against "now" in a given IANA timezone and return
 * whether the date is today, upcoming, or past.
 *
 * Both the event date and "now" are resolved to calendar dates in the
 * given timezone, so the comparison is timezone-aware.
 */
export function getDateStatus(date: Date, timezone: string): DateStatus {
  const now = new Date();

  const eventParts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).formatToParts(date);

  const nowParts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).formatToParts(now);

  const eventYear = +eventParts.find((p) => p.type === "year")!.value;
  const eventMonth = +eventParts.find((p) => p.type === "month")!.value;
  const eventDay = +eventParts.find((p) => p.type === "day")!.value;

  const nowYear = +nowParts.find((p) => p.type === "year")!.value;
  const nowMonth = +nowParts.find((p) => p.type === "month")!.value;
  const nowDay = +nowParts.find((p) => p.type === "day")!.value;

  // Compare as YYYYMMDD integers for simplicity
  const eventDateInt = eventYear * 10000 + eventMonth * 100 + eventDay;
  const nowDateInt = nowYear * 10000 + nowMonth * 100 + nowDay;

  if (eventDateInt === nowDateInt) return "today";
  if (eventDateInt > nowDateInt) return "upcoming";
  return "past";
}
