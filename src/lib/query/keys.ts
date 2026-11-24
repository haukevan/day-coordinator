/**
 * Shared React Query keys.
 *
 * One key per list, plus a key per event detail. Mutations must only touch
 * their own key so unrelated lists never refetch.
 */
export const queryKeys = {
  events: ["events"] as const,
  vendors: ["vendors"] as const,
  venues: ["venues"] as const,
  profile: ["profile"] as const,
  event: (eventId: string) => ["event", eventId] as const,
};

/** Planning lists stay fresh for 45 seconds before a background refetch. */
export const LIST_STALE_TIME = 45_000;

/** Profile data is stable for the session; invalidated after edits. */
export const PROFILE_STALE_TIME = 5 * 60_000;
