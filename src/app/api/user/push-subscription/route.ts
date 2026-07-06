import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const subscribeSchema = z.object({
  endpoint: z.string().min(1, "endpoint is required"),
  keys: z.object({
    p256dh: z.string().min(1, "p256dh key is required"),
    auth: z.string().min(1, "auth secret is required"),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().min(1, "endpoint is required"),
});

/**
 * POST /api/user/push-subscription
 * Save (upsert) a push subscription for the authenticated user.
 *
 * Body: { endpoint: string, keys: { p256dh: string, auth: string } }
 * Returns: the saved PushSubscription
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    select: { id: true },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const { endpoint, keys } = parsed.data;

  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: {
      userId: dbUser.id,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    create: {
      userId: dbUser.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  });

  return NextResponse.json(subscription, { status: 200 });
}

/**
 * DELETE /api/user/push-subscription
 * Remove a push subscription for the authenticated user.
 *
 * Body: { endpoint: string }
 * Returns: { deleted: true }
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    select: { id: true },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = unsubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const { endpoint } = parsed.data;

  await prisma.pushSubscription.deleteMany({
    where: {
      userId: dbUser.id,
      endpoint,
    },
  });

  return NextResponse.json({ deleted: true }, { status: 200 });
}
