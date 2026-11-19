"use client";

import { useSyncExternalStore } from "react";

/**
 * The browser timezone does not change during a session, so there is nothing
 * to subscribe to.
 */
function subscribe() {
  return () => {};
}

function getSnapshot(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function getServerSnapshot(): null {
  return null;
}

/**
 * Browser timezone, resolved after hydration.
 *
 * Reading Intl.DateTimeFormat() during render produces "Africa/Abidjan" on
 * the server (where TZ is UTC) and a different value in the browser, which
 * causes hydration flicker. The server snapshot is null, so callers can render
 * a stable placeholder until React re-renders on the client.
 */
export function useClientTimeZone(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
