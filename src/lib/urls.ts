/**
 * Dynamic app URL resolution.
 *
 * Priority:
 * 1. Vercel system env var (auto-set for preview and production deployments)
 * 2. Request origin header (server-side, handles any local port)
 * 3. NEXT_PUBLIC_APP_URL (explicitly configured fallback)
 * 4. Localhost default (last resort)
 */

const VERCEL_URL = process.env.VERCEL_URL;
const CONFIGURED_URL = process.env.NEXT_PUBLIC_APP_URL;

/** Resolve the app base URL server-side (has access to request origin). */
export function resolveAppUrl(origin?: string | null): string {
  // Vercel preview/production — auto-detected, no config needed
  if (VERCEL_URL) return `https://${VERCEL_URL}`;

  // Server-side: use the incoming request origin (works on any port)
  if (origin) return origin;

  // Explicitly configured fallback
  if (CONFIGURED_URL) return CONFIGURED_URL;

  // Last resort
  return "http://localhost:3000";
}

/**
 * Resolve the app base URL client-side.
 * Uses window.location.origin when available.
 */
export function resolveAppUrlClient(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return resolveAppUrl();
}
