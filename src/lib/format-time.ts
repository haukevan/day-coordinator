import { toZonedTime } from "date-fns-tz";
import { format } from "date-fns";

// ─── Timezone abbreviations ─────────────────────────────────────────────────

type ZoneAbbreviation = {
  test: (timeZone: string) => boolean;
  standard: string;
  daylight: string;
};

/**
 * North American zones where ICU's short name can be generic ("PT") or
 * inconsistent across engines. Offsets are used to decide standard vs daylight.
 */
const NORTH_AMERICAN_ABBREVIATIONS: ZoneAbbreviation[] = [
  {
    test: (tz) => /Phoenix|US\/Arizona/.test(tz),
    standard: "MST",
    daylight: "MST",
  },
  {
    test: (tz) => /Honolulu|Pacific\/Honolulu/.test(tz),
    standard: "HST",
    daylight: "HST",
  },
  {
    test: (tz) => /Anchorage|Juneau|Sitka|Nome/.test(tz),
    standard: "AKST",
    daylight: "AKDT",
  },
  {
    test: (tz) => /Vancouver|Los_Angeles|Tijuana|US\/Pacific/.test(tz),
    standard: "PST",
    daylight: "PDT",
  },
  {
    test: (tz) => /Denver|Edmonton|Boise|Yellowknife|US\/Mountain/.test(tz),
    standard: "MST",
    daylight: "MDT",
  },
  {
    test: (tz) => /Regina|Swift_Current/.test(tz),
    standard: "CST",
    daylight: "CST",
  },
  {
    test: (tz) => /Chicago|Winnipeg|Menominee|US\/Central/.test(tz),
    standard: "CST",
    daylight: "CDT",
  },
  {
    test: (tz) => /Halifax|Moncton|Glace_Bay/.test(tz),
    standard: "AST",
    daylight: "ADT",
  },
  {
    test: (tz) => /St_Johns/.test(tz),
    standard: "NST",
    daylight: "NDT",
  },
  {
    test: (tz) => /New_York|Toronto|Detroit|Nassau|US\/Eastern/.test(tz),
    standard: "EST",
    daylight: "EDT",
  },
];

function getOffsetMinutes(date: Date, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    }).formatToParts(date);
    const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "";

    if (raw === "GMT" || raw === "UTC") return 0;

    const match = /^GMT([+-])(\d{2}):?(\d{2})?$/.exec(raw);
    if (!match) return null;

    const sign = match[1] === "-" ? -1 : 1;
    return sign * (Number(match[2]) * 60 + Number(match[3] ?? "0"));
  } catch {
    return null;
  }
}

/** True when the instant falls in daylight saving time for the zone. */
function isDaylightSaving(date: Date, timeZone: string): boolean {
  const year = date.getUTCFullYear();
  const januaryOffset = getOffsetMinutes(
    new Date(Date.UTC(year, 0, 1, 12)),
    timeZone,
  );
  const julyOffset = getOffsetMinutes(
    new Date(Date.UTC(year, 6, 1, 12)),
    timeZone,
  );
  const currentOffset = getOffsetMinutes(date, timeZone);

  if (januaryOffset === null || julyOffset === null || currentOffset === null) {
    return false;
  }

  // Standard time is the smaller (more negative for the Americas) offset.
  const standardOffset = Math.min(januaryOffset, julyOffset);
  return currentOffset > standardOffset;
}

/**
 * Abbreviation for a timestamp in a zone, e.g. "PST" for a December instant
 * in America/Vancouver even if ICU would otherwise return a generic label.
 */
export function getTimeZoneAbbreviation(
  iso: string | Date,
  timeZone: string,
): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;

  const knownZone = NORTH_AMERICAN_ABBREVIATIONS.find((zone) =>
    zone.test(timeZone),
  );
  if (knownZone) {
    return isDaylightSaving(date, timeZone)
      ? knownZone.daylight
      : knownZone.standard;
  }

  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short",
    })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value ?? ""
  );
}

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
  const abbr = getTimeZoneAbbreviation(date, timezone);
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

/**
 * Format a date as a relative time string (Instagram-style).
 * Output: "just now", "5m", "1h", "2d", "1w"
 */
export function relativeTime(date: Date | string): string {
  const then = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - then.getTime();
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return `${weeks}w`;
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
