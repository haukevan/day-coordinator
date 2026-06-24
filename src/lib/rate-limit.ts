import { prisma } from "@/lib/db/prisma";

/**
 * Check a rate limit using a DB-backed upsert.
 *
 * - `key`: unique identifier, e.g. "sms:send:192.168.1.1"
 * - `maxRequests`: max allowed requests within the window
 * - `windowMs`: sliding window duration in milliseconds
 *
 * Returns `{ allowed: boolean }` — when false, the caller should respond 429.
 *
 * Cleanup is lazy: if the stored windowStart is older than windowMs,
 * the counter is reset on the next access. No separate cron needed.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<{ allowed: boolean }> {
  const now = new Date();

  // Try to find existing record
  const existing = await prisma.rateLimit.findUnique({ where: { key } });

  // Window expired or no record yet → reset
  if (!existing || existing.windowStart.getTime() + windowMs < now.getTime()) {
    await prisma.rateLimit.upsert({
      where: { key },
      update: { count: 1, windowStart: now },
      create: { key, count: 1, windowStart: now },
    });
    return { allowed: true };
  }

  // Within window — check count
  if (existing.count >= maxRequests) {
    return { allowed: false };
  }

  // Increment
  await prisma.rateLimit.update({
    where: { key },
    data: { count: { increment: 1 } },
  });

  return { allowed: true };
}

/**
 * Extract the client IP from a NextRequest.
 * Checks x-forwarded-for first (Vercel proxy), falls back to other headers.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
