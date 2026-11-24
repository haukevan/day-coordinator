"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PROFILE_STALE_TIME, queryKeys } from "./keys";
import type {
  DashboardPayload,
  EventDetail,
  Profile,
  SerializedVendorContactWithEvents,
  SerializedVenue,
} from "@/lib/types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

/**
 * Session-level snapshots of each list.
 *
 * The React Query cache is the source of truth; these snapshots are only a
 * render fallback. If the query cache is ever emptied (garbage collection,
 * an explicit reset, a provider remount), the last list still renders
 * instantly instead of flashing a cold skeleton. A full page reload starts
 * fresh, and sign-out clears them.
 */
let dashboardSnapshot: DashboardPayload | undefined;
let vendorsSnapshot: SerializedVendorContactWithEvents[] | undefined;
let venuesSnapshot: SerializedVenue[] | undefined;

export function clearSessionSnapshots(): void {
  dashboardSnapshot = undefined;
  vendorsSnapshot = undefined;
  venuesSnapshot = undefined;
}

/** Dashboard payload: owned events, pending invites, vendor memberships. */
export async function fetchDashboardPayload(): Promise<DashboardPayload> {
  const payload = await fetchJson<DashboardPayload>("/api/events");
  dashboardSnapshot = payload;
  return payload;
}

/**
 * Core event list. Cached for the session and refreshed silently in the
 * background — the UI renders the cached list immediately on navigation.
 */
export function useDashboardQuery() {
  return useQuery({
    queryKey: queryKeys.events,
    queryFn: fetchDashboardPayload,
    placeholderData: () => dashboardSnapshot,
  });
}

export async function fetchVendors(): Promise<
  SerializedVendorContactWithEvents[]
> {
  const data = await fetchJson<{
    contacts: SerializedVendorContactWithEvents[];
  }>("/api/user/vendor-contacts");
  const vendors = data.contacts ?? [];
  vendorsSnapshot = vendors;
  return vendors;
}

export function useVendorsQuery() {
  return useQuery({
    queryKey: queryKeys.vendors,
    queryFn: fetchVendors,
    placeholderData: () => vendorsSnapshot,
  });
}

export async function fetchVenues(): Promise<SerializedVenue[]> {
  const data = await fetchJson<{ venues: SerializedVenue[] }>("/api/venues");
  const venues = data.venues ?? [];
  venuesSnapshot = venues;
  return venues;
}

export function useVenuesQuery() {
  return useQuery({
    queryKey: queryKeys.venues,
    queryFn: fetchVenues,
    placeholderData: () => venuesSnapshot,
  });
}

export async function fetchProfile(): Promise<Profile> {
  const data = await fetchJson<{ profile: Profile }>("/api/user/profile");
  return data.profile;
}

/** Profile is stable for the session; edits write to the cache directly. */
export function useProfileQuery(initialData?: Profile) {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: fetchProfile,
    staleTime: PROFILE_STALE_TIME,
    refetchOnWindowFocus: false,
    initialData,
  });
}

export async function fetchEvent(eventId: string): Promise<EventDetail> {
  const data = await fetchJson<{ event: EventDetail }>(
    `/api/events/${eventId}`,
  );
  return data.event;
}

export function useEventQuery(eventId: string, initialData?: EventDetail) {
  return useQuery({
    queryKey: queryKeys.event(eventId),
    queryFn: () => fetchEvent(eventId),
    placeholderData: keepPreviousData,
    initialData,
  });
}

/**
 * Warm the shared lists on the first dashboard load so Vendors and Venues
 * render from cache. React Query dedupes these with the page-level hooks.
 */
export function useSessionPrefetch() {
  useVendorsQuery();
  useVenuesQuery();
  useProfileQuery();
}
