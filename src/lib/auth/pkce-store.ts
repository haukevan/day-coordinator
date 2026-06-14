/**
 * Server-side PKCE cookie store.
 *
 * On mobile, magic links often open in in-app browsers (SFSafariViewController,
 * WKWebView) that have a separate cookie jar from the main browser. This means
 * the PKCE code-verifier cookie set during signInWithOtp is missing when the
 * callback route tries to exchange the auth code.
 *
 * This store captures the PKCE cookies at magic-link-send time and replays them
 * at callback time, so the code exchange works regardless of browsing context.
 */

interface StoredEntry {
  cookies: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }>;
  expires: number;
}

const store = new Map<string, StoredEntry>();

// Clean up expired entries every 60 seconds
const CLEANUP_INTERVAL = 60_000;
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.expires) store.delete(key);
    }
  }, CLEANUP_INTERVAL);
}

/** TTL for stored PKCE cookies (15 minutes — matches magic link expiry) */
const TTL_MS = 15 * 60 * 1000;

/**
 * Store PKCE cookies server-side, keyed by a unique state parameter.
 * Called from the magic-link route after signInWithOtp.
 */
export function storePkceCookies(
  state: string,
  cookies: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }>,
): void {
  store.set(state, { cookies, expires: Date.now() + TTL_MS });
}

/**
 * Retrieve and consume stored PKCE cookies by state.
 * Returns null if the state is not found or expired.
 * The entry is deleted after retrieval (one-time use).
 */
export function getPkceCookies(
  state: string,
): Array<{
  name: string;
  value: string;
  options: Record<string, unknown>;
}> | null {
  const entry = store.get(state);
  if (!entry || Date.now() > entry.expires) {
    store.delete(state);
    return null;
  }
  store.delete(state); // one-time use
  return entry.cookies;
}
