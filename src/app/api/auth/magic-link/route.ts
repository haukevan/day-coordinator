import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { storePkceCookies } from "@/lib/auth/pkce-store";

const schema = z.object({
  email: z.string().email(),
  next: z.string().optional(),
});

// In-memory rate limiter: max 3 requests per IP per 15 minutes
const ipRequests = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 3;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequests.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRequests.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  if (entry.count >= MAX_PER_WINDOW) return true;
  entry.count++;
  return false;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429 },
    );
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid email address." },
      { status: 400 },
    );
  }

  const { email, next } = parsed.data;

  // Generate a unique state parameter to key the PKCE cookie store
  const state = crypto.randomUUID();

  // Use the request origin so magic links work on any local port or deploy URL
  const origin =
    request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

  const callbackUrl = next
    ? `${origin}/api/auth/callback?next=${encodeURIComponent(next)}&state=${state}`
    : `${origin}/api/auth/callback?state=${state}`;

  // Capture PKCE cookies that @supabase/ssr sets during signInWithOtp.
  // On mobile, magic links open in in-app browsers with a different cookie jar,
  // so we store them server-side and replay them in the callback route.
  const capturedCookies: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }> = [];
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Capture cookies for server-side storage (handles mobile in-app browser PKCE issue)
          capturedCookies.push(...cookiesToSet);
          // Also set them normally for the current response
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Ignore: setAll may be called in read-only context
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl,
    },
  });

  if (error) {
    console.error("[magic-link] Supabase error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Store captured PKCE cookies server-side so the callback can retrieve them
  // even when the magic link opens in a different browsing context (mobile in-app browser)
  if (capturedCookies.length > 0) {
    storePkceCookies(state, capturedCookies);
  }

  return NextResponse.json({ ok: true });
}
