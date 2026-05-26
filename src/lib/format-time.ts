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
