import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

type Params = { params: Promise<{ eventId: string }> };

const prefsSchema = z.object({
  pushEnabled: z.boolean().optional().nullable(),
  smsEnabled: z.boolean().optional().nullable(),
});

/**
 * PATCH /api/events/[eventId]/notification-prefs
 *
 * Update the current user's per-event notification preferences.
 * Stores on the EventVendor row for this event+user.
 * Requires the user to be a member of the event (owner, coordinator, or vendor).
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = prefsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const { pushEnabled, smsEnabled } = parsed.data;

  // Check if user is the event owner
  const event = await prisma.event.findFirst({
    where: { id: eventId },
    select: { ownerId: true },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const isOwner = event.ownerId === dbUser.id;

  // For non-owners, find their EventVendor row
  let eventVendor = null;
  if (!isOwner) {
    eventVendor = await prisma.eventVendor.findFirst({
      where: { eventId, userId: dbUser.id },
    });
    if (!eventVendor) {
      return NextResponse.json(
        { error: "You are not a member of this event." },
        { status: 403 },
      );
    }
  }

  // Owners don't have an EventVendor row yet — upsert one so prefs persist.
  // If the user is the owner but has no EventVendor row, create one with COORDINATOR role.
  if (isOwner) {
    const existing = await prisma.eventVendor.findFirst({
      where: { eventId, userId: dbUser.id },
    });

    if (!existing) {
      // Get the owner's vendor contact (self-referencing)
      const ownerContact = await prisma.vendorContact.upsert({
        where: { ownerId_email: { ownerId: dbUser.id, email: user.email! } },
        update: {},
        create: {
          ownerId: dbUser.id,
          email: user.email!,
        },
      });

      await prisma.eventVendor.create({
        data: {
          eventId,
          vendorContactId: ownerContact.id,
          userId: dbUser.id,
          status: "ACCEPTED",
          role: "COORDINATOR",
          pushEnabled: pushEnabled ?? null,
          smsEnabled: smsEnabled ?? null,
          joinedAt: new Date(),
        },
      });

      return NextResponse.json({
        pushEnabled: pushEnabled ?? null,
        smsEnabled: smsEnabled ?? null,
      });
    }

    // Owner already has an EventVendor row — update it
    const updated = await prisma.eventVendor.update({
      where: { id: existing.id },
      data: {
        ...(pushEnabled !== undefined && { pushEnabled }),
        ...(smsEnabled !== undefined && { smsEnabled }),
      },
      select: { id: true, pushEnabled: true, smsEnabled: true },
    });

    return NextResponse.json(updated);
  }

  const updated = await prisma.eventVendor.update({
    where: { id: eventVendor!.id },
    data: {
      ...(pushEnabled !== undefined && { pushEnabled }),
      ...(smsEnabled !== undefined && { smsEnabled }),
    },
    select: {
      id: true,
      pushEnabled: true,
      smsEnabled: true,
    },
  });

  return NextResponse.json(updated);
}
