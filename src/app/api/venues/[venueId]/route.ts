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
  });
  if (!venue) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Block deletion if any events reference this venue
  const eventCount = await prisma.event.count({
    where: { venueId },
  });
  if (eventCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete a venue that is linked to events." },
      { status: 409 },
    );
  }

  await prisma.venue.delete({ where: { id: venueId } });

  return NextResponse.json({ success: true });
}
