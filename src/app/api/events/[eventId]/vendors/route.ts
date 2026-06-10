import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { canManageEvent } from "@/lib/db/permissions";
import { z } from "zod";
import { nanoid } from "nanoid";
import { sendVendorInviteEmail } from "@/lib/notifications/vendor-invite";
import type { SerializedVendor } from "@/lib/types";

type Params = { params: Promise<{ eventId: string }> };

const addVendorSchema = z.object({
  email: z.string().email("Valid email required"),
  firstName: z.string().max(64).optional().nullable(),
  lastName: z.string().max(64).optional().nullable(),
  phone: z
    .string()
    .regex(/^\+1\d{10}$/, "Phone must be a valid US number")
    .optional()
    .nullable(),
  company: z.string().max(128).optional().nullable(),
  jobTitle: z.string().max(128).optional().nullable(),
  role: z.enum(["VENDOR", "COORDINATOR"]).optional().default("VENDOR"),
});

function serializeVendor(ev: {
  id: string;
  eventId: string;
  vendorContactId: string;
  userId: string | null;
  event: {
    ownerId: string;
  };
  company: string | null;
  jobTitle: string | null;
  status: string;
  role: string;
  inviteSentAt: Date | null;
  joinedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  vendorContact: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  };
}): SerializedVendor {
  return {
    id: ev.id,
    eventId: ev.eventId,
    vendorContactId: ev.vendorContactId,
    userId: ev.userId,
    isEventOwner: ev.userId === ev.event.ownerId,
    company: ev.company,
    jobTitle: ev.jobTitle,
    status: ev.status,
    role: ev.role,
    inviteSentAt: ev.inviteSentAt?.toISOString() ?? null,
    joinedAt: ev.joinedAt?.toISOString() ?? null,
    createdAt: ev.createdAt.toISOString(),
    updatedAt: ev.updatedAt.toISOString(),
    email: ev.vendorContact.email,
    firstName: ev.vendorContact.firstName,
    lastName: ev.vendorContact.lastName,
    phone: ev.vendorContact.phone,
  };
}

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
  const allowed = event || (await canManageEvent(eventId, dbUser.id));
  if (!allowed)
    return NextResponse.json(
      {
        error:
          "You don't have permission to manage vendors for this event. Your access may have been changed — try reloading the page.",
      },
      { status: 403 },
    );

  const vendors = await prisma.eventVendor.findMany({
    where: { eventId },
    include: {
      event: { select: { ownerId: true } },
      vendorContact: {
        select: { email: true, firstName: true, lastName: true, phone: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ vendors: vendors.map(serializeVendor) });
}

export async function POST(req: NextRequest, { params }: Params) {
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
  const allowed = event || (await canManageEvent(eventId, dbUser.id));
  if (!allowed)
    return NextResponse.json(
      {
        error:
          "You don't have permission to manage vendors for this event. Your access may have been changed — try reloading the page.",
      },
      { status: 403 },
    );

  // Resolve event status for invite-send decision
  const eventStatus =
    event?.status ??
    (
      await prisma.event.findUnique({
        where: { id: eventId },
        select: { status: true },
      })
    )?.status;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = addVendorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const { email, firstName, lastName, phone, company, jobTitle, role } =
    parsed.data;

  // Upsert the admin's contact book entry
  const vendorContact = await prisma.vendorContact.upsert({
    where: { ownerId_email: { ownerId: dbUser.id, email } },
    update: {
      ...(firstName !== undefined && { firstName: firstName ?? null }),
      ...(lastName !== undefined && { lastName: lastName ?? null }),
      ...(phone !== undefined && { phone: phone ?? null }),
      ...(company !== undefined && { company: company ?? null }),
      ...(jobTitle !== undefined && { jobTitle: jobTitle ?? null }),
    },
    create: {
      ownerId: dbUser.id,
      email,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      phone: phone ?? null,
      company: company ?? null,
      jobTitle: jobTitle ?? null,
    },
  });

  // Check for duplicate in this event
  const existing = await prisma.eventVendor.findUnique({
    where: {
      eventId_vendorContactId: { eventId, vendorContactId: vendorContact.id },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "This vendor is already added to the event." },
      { status: 409 },
    );
  }

  const inviteToken = nanoid(32);
  const inviteTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const eventVendor = await prisma.eventVendor.create({
    data: {
      eventId,
      vendorContactId: vendorContact.id,
      company: company ?? null,
      jobTitle: jobTitle ?? null,
      role,
      inviteToken,
      inviteTokenExpiresAt,
    },
    include: {
      event: { select: { ownerId: true } },
      vendorContact: {
        select: { email: true, firstName: true, lastName: true, phone: true },
      },
    },
  });

  await prisma.activityLog.create({
    data: {
      eventId,
      userId: dbUser.id,
      action: "vendor.added",
      metadata: { email, vendorContactId: vendorContact.id },
    },
  });

  // Send invite immediately if event is SCHEDULED or LIVE
  if (eventStatus === "SCHEDULED" || eventStatus === "LIVE") {
    try {
      await sendVendorInviteEmail(eventVendor.id);
    } catch {
      /* non-fatal */
    }
    // Re-fetch so the response reflects the updated inviteSentAt
    const fresh = await prisma.eventVendor.findUnique({
      where: { id: eventVendor.id },
      include: {
        event: { select: { ownerId: true } },
        vendorContact: {
          select: { email: true, firstName: true, lastName: true, phone: true },
        },
      },
    });
    if (fresh)
      return NextResponse.json(
        { vendor: serializeVendor(fresh) },
        { status: 201 },
      );
  }

  return NextResponse.json(
    { vendor: serializeVendor(eventVendor) },
    { status: 201 },
  );
}
