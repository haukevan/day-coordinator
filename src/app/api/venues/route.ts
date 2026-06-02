import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const createVenueSchema = z.object({
  name: z.string().min(1, "Venue name is required.").max(200),
  address: z.string().min(1, "Address is required.").max(500),
  description: z.string().max(1000).optional(),
  ownerName: z.string().max(128).optional(),
  ownerPhone: z.string().max(20).optional(),
  ownerEmail: z
    .string()
    .email("Invalid email.")
    .max(254)
    .optional()
    .or(z.literal("")),
  lat: z.number().optional(),
  lng: z.number().optional(),
  placeId: z.string().max(128).optional(),
});

export async function GET() {
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

  const venues = await prisma.venue.findMany({
    where: { creatorId: dbUser.id },
    include: {
      events: {
        select: { id: true, title: true, status: true },
        orderBy: { eventDate: "desc" },
      },
      _count: { select: { events: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ venues });
}

export async function POST(req: NextRequest) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createVenueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const {
    name,
    address,
    description,
    ownerName,
    ownerPhone,
    ownerEmail,
    lat,
    lng,
    placeId,
  } = parsed.data;

  const venue = await prisma.venue.create({
    data: {
      name: name.trim(),
      address: address.trim(),
      description: description?.trim() || null,
      ownerName: ownerName?.trim() || null,
      ownerPhone: ownerPhone?.trim() || null,
      ownerEmail: ownerEmail?.trim() || null,
      lat: lat ?? null,
      lng: lng ?? null,
      placeId: placeId?.trim() || null,
      creatorId: dbUser.id,
    },
  });

  return NextResponse.json({ venue }, { status: 201 });
}
