import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

type Params = { params: Promise<{ venueId: string }> };

const updateVenueSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().min(1).max(500).optional(),
  description: z.string().max(1000).optional().nullable(),
  ownerName: z.string().max(128).optional().nullable(),
  ownerPhone: z.string().max(20).optional().nullable(),
  ownerEmail: z
    .string()
    .email()
    .max(254)
    .optional()
    .nullable()
    .or(z.literal("")),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  placeId: z.string().max(128).optional().nullable(),
});

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

  const parsed = updateVenueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const data = parsed.data;

  const updated = await prisma.venue.update({
    where: { id: venueId },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.address !== undefined && { address: data.address.trim() }),
      ...(data.description !== undefined && {
        description: data.description?.trim() ?? null,
      }),
      ...(data.ownerName !== undefined && {
        ownerName: data.ownerName?.trim() ?? null,
      }),
      ...(data.ownerPhone !== undefined && {
        ownerPhone: data.ownerPhone?.trim() ?? null,
      }),
      ...(data.ownerEmail !== undefined && {
        ownerEmail: data.ownerEmail?.trim() || null,
      }),
      ...(data.lat !== undefined && { lat: data.lat }),
      ...(data.lng !== undefined && { lng: data.lng }),
      ...(data.placeId !== undefined && {
        placeId: data.placeId?.trim() ?? null,
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
