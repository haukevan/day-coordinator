import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { emitEventUpdate } from "@/lib/realtime";

type Params = { params: Promise<{ eventId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
  });
  if (!dbUser)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId: dbUser.id },
  });

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ event });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
  });
  if (!dbUser)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId: dbUser.id },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const {
    title,
    description,
    eventDate,
    timezone,
    slug,
    publicTimeline,
    venueId,
  } = body;

  const isLocked =
    event.status === "LIVE" ||
    event.status === "COMPLETED" ||
    event.status === "ARCHIVED";

  // publicTimeline is the only field editable in any status
  if (isLocked && Object.keys(body).some((k) => k !== "publicTimeline")) {
    return NextResponse.json(
      {
        error: `Event details cannot be edited in ${event.status.toLowerCase()} status.`,
      },
      { status: 403 },
    );
  }

  // Validate venue ownership if venueId is provided and different
  if (venueId !== undefined && venueId !== event.venueId) {
    if (venueId) {
      const venue = await prisma.venue.findFirst({
        where: { id: venueId, creatorId: dbUser.id },
      });
      if (!venue) {
        return NextResponse.json(
          { error: "Venue not found or you do not have access to it." },
          { status: 422 },
        );
      }
    }
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      ...(title !== undefined && !isLocked && { title: title.trim() }),
      ...(description !== undefined &&
        !isLocked && { description: description?.trim() || null }),
      ...(eventDate !== undefined &&
        !isLocked && {
          eventDate: eventDate ? new Date(eventDate + "T12:00:00.000Z") : null,
        }),
      ...(timezone !== undefined && !isLocked && { timezone }),
      ...(slug !== undefined && !isLocked && { slug: slug?.trim() || null }),
      ...(venueId !== undefined && !isLocked && { venueId: venueId || null }),
      ...(publicTimeline !== undefined && {
        publicTimeline: Boolean(publicTimeline),
      }),
    },
  });

  await prisma.activityLog.create({
    data: {
      eventId,
      userId: dbUser.id,
      action: "event.updated",
      metadata: { fields: Object.keys(body) },
    },
  });

  await emitEventUpdate(eventId, "event.updated", {
    eventId,
    status: updated.status,
  });

  return NextResponse.json({ event: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
  });
  if (!dbUser)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId: dbUser.id },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (event.status === "LIVE") {
    return NextResponse.json(
      { error: "Cannot delete an event that is currently live." },
      { status: 422 },
    );
  }

  await prisma.$transaction([
    prisma.activityLog.deleteMany({ where: { eventId } }),
    prisma.eventVendor.deleteMany({ where: { eventId } }),
    prisma.task.deleteMany({ where: { eventId } }),
    prisma.event.delete({ where: { id: eventId } }),
  ]);

  return NextResponse.json({ success: true });
}
