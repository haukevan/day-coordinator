import { QueryClient } from "@tanstack/react-query";
import { LIST_STALE_TIME } from "./keys";

/**
 * Create the single client-side cache for the session.
 *
 * - Cached data renders immediately on navigation; refetches happen in the
 *   background and only replace data when the server returns something new.
 * - Window-focus refetches only run for stale queries.
 * - The cache is in memory only, so a full page reload always refetches.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: LIST_STALE_TIME,
        // Keep every list in memory for the whole page session. A mutation
        // followed by a long editing session must never let the Dashboard's
        // cached list be garbage-collected, which would show a cold skeleton
        // on the next navigation. A full page reload still starts fresh.
        gcTime: Infinity,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
