import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";

type Params = { params: Promise<{ eventId: string }> };

/**
 * GET /api/events/[eventId]/notifications?limit=10
 *
 * Returns recent sent notifications for this event.
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
    where: { eventId, status: "SENT" },
    orderBy: { sentAt: "desc" },
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

  return NextResponse.json({ notifications });
}
