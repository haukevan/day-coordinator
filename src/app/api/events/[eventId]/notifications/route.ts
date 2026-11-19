import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const dismissSchema = z.object({
  ids: z.array(z.string()).optional(), // omit = dismiss all
});

type Params = { params: Promise<{ eventId: string }> };

/**
 * GET /api/events/[eventId]/notifications?limit=10
 *
 * Returns recent sent, undismissed notifications for this event.
 * Requires the user to be a member of the event.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { eventId } = await params;
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "10");

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

  // Verify membership: owner or accepted EventVendor
  const event = await prisma.event.findFirst({
    where: { id: eventId },
    select: { ownerId: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const isOwner = event.ownerId === dbUser.id;
  if (!isOwner) {
    const membership = await prisma.eventVendor.findFirst({
      where: { eventId, userId: dbUser.id, status: "ACCEPTED" },
    });
    if (!membership) {
      return NextResponse.json(
        { error: "You are not a member of this event." },
        { status: 403 },
      );
    }
  }

  const notifications = await prisma.notification.findMany({
    where: {
      eventId,
      recipient: dbUser.id,
      channel: "PUSH",
      status: { in: ["SENT", "SKIPPED"] },
      dismissedAt: null,
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 50),
    select: {
      id: true,
      type: true,
      channel: true,
      payload: true,
      sentAt: true,
      createdAt: true,
    },
  });

  // Total undismissed count (for badge display)
  const total = await prisma.notification.count({
    where: {
      eventId,
      recipient: dbUser.id,
      channel: "PUSH",
      status: { in: ["SENT", "SKIPPED"] },
      dismissedAt: null,
    },
  });

  return NextResponse.json({ notifications, total });
}

/**
 * PATCH /api/events/[eventId]/notifications
 *
 * Dismiss notifications. Body: { ids?: string[] }
 * - If ids is provided: dismiss only those notifications
 * - If ids is omitted or empty: dismiss ALL undismissed notifications for this event
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { eventId } = await params;

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

  // Verify membership
  const event = await prisma.event.findFirst({
    where: { id: eventId },
    select: { ownerId: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const isOwner = event.ownerId === dbUser.id;
  if (!isOwner) {
    const membership = await prisma.eventVendor.findFirst({
      where: { eventId, userId: dbUser.id, status: "ACCEPTED" },
    });
    if (!membership) {
      return NextResponse.json(
        { error: "You are not a member of this event." },
        { status: 403 },
      );
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = dismissSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const now = new Date();

  if (parsed.data.ids && parsed.data.ids.length > 0) {
    // Dismiss specific notifications (must belong to this event AND this user)
    await prisma.notification.updateMany({
      where: { id: { in: parsed.data.ids }, eventId, recipient: dbUser.id },
      data: { dismissedAt: now },
    });
  } else {
    // Dismiss all undismissed notifications for this event AND this user
    await prisma.notification.updateMany({
      where: { eventId, recipient: dbUser.id, status: "SENT", dismissedAt: null },
      data: { dismissedAt: now },
    });
  }

  return NextResponse.json({ dismissed: true });
}
