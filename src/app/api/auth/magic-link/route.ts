import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
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
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  const { email } = parsed.data;
  const supabase = await createSupabaseServerClient();

  // Use the request origin so magic links work on any local port or deploy URL
  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/api/auth/callback`,
    },
  });

  if (error) {
    console.error("[magic-link] Supabase error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
