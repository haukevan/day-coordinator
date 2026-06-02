import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";

type Params = { params: Promise<{ venueId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { venueId } = await params;
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

  const venue = await prisma.venue.findFirst({
    where: { id: venueId, creatorId: dbUser.id },
    include: {
      events: { select: { id: true, title: true, status: true } },
    },
  });
  if (!venue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;

  const updated = await prisma.venue.update({
    where: { id: venueId },
    data: {
      ...(data.name !== undefined && { name: String(data.name).trim() }),
      ...(data.address !== undefined && {
        address: String(data.address).trim(),
      }),
      ...(data.description !== undefined && {
        description: data.description ? String(data.description).trim() : null,
      }),
      ...(data.ownerName !== undefined && {
        ownerName: data.ownerName ? String(data.ownerName).trim() : null,
      }),
      ...(data.ownerPhone !== undefined && {
        ownerPhone: data.ownerPhone ? String(data.ownerPhone).trim() : null,
      }),
      ...(data.ownerEmail !== undefined && {
        ownerEmail: data.ownerEmail ? String(data.ownerEmail).trim() : null,
      }),
      ...(data.lat !== undefined && { lat: data.lat as number | null }),
      ...(data.lng !== undefined && { lng: data.lng as number | null }),
      ...(data.placeId !== undefined && {
        placeId: data.placeId ? String(data.placeId).trim() : null,
      }),
    },
  });

  return NextResponse.json({ venue: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { venueId } = await params;
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

  const venue = await prisma.venue.findFirst({
    where: { id: venueId, creatorId: dbUser.id },
    include: {
      events: { select: { id: true, title: true, status: true } },
    },
  });
  if (!venue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Unlink all events from this venue, then delete — in a transaction
  const linkedEventIds = venue.events.map((e) => e.id);

  await prisma.$transaction([
    // Set venueId to null on all linked events
    prisma.event.updateMany({
      where: { venueId },
      data: { venueId: null },
    }),
    // Delete the venue
    prisma.venue.delete({ where: { id: venueId } }),
  ]);

  return NextResponse.json({
    success: true,
    unlinkedEvents: linkedEventIds,
  });
}
