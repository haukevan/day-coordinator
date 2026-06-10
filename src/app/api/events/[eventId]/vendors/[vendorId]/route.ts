import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { canManageEvent } from "@/lib/db/permissions";
import { z } from "zod";

type Params = { params: Promise<{ eventId: string; vendorId: string }> };

const updateSchema = z.object({
  firstName: z.string().max(64).optional().nullable(),
  lastName: z.string().max(64).optional().nullable(),
  phone: z
    .string()
    .regex(/^\+1\d{10}$/, "Phone must be a valid US number")
    .optional()
    .nullable(),
  company: z.string().max(128).optional().nullable(),
  jobTitle: z.string().max(128).optional().nullable(),
  role: z.enum(["VENDOR", "COORDINATOR"]).optional(),
});

async function resolveOwnership(
  eventId: string,
  vendorId: string,
  supabaseUserId: string,
) {
  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: supabaseUserId },
  });
  if (!dbUser) return null;
  const allowed = await canManageEvent(eventId, dbUser.id);
  if (!allowed) return null;
  const eventVendor = await prisma.eventVendor.findFirst({
    where: { id: vendorId, eventId },
    include: { vendorContact: true },
  });
  return eventVendor ? { dbUser, eventVendor } : null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { eventId, vendorId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolved = await resolveOwnership(eventId, vendorId, user.id);
  if (!resolved)
    return NextResponse.json(
      {
        error:
          "You don't have permission to manage vendors for this event. Your access may have been changed — try reloading the page.",
      },
      { status: 403 },
    );

  const { dbUser, eventVendor } = resolved;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const { firstName, lastName, phone, company, jobTitle, role } = parsed.data;

  // Update EventVendor event-specific fields
  await prisma.eventVendor.update({
    where: { id: vendorId },
    data: {
      ...(company !== undefined && { company: company ?? null }),
      ...(jobTitle !== undefined && { jobTitle: jobTitle ?? null }),
      ...(role !== undefined && { role }),
    },
  });

  // Sync VendorContact defaults
  await prisma.vendorContact.update({
    where: { id: eventVendor.vendorContactId },
    data: {
      ...(firstName !== undefined && { firstName: firstName ?? null }),
      ...(lastName !== undefined && { lastName: lastName ?? null }),
      ...(phone !== undefined && { phone: phone ?? null }),
      ...(company !== undefined && { company: company ?? null }),
      ...(jobTitle !== undefined && { jobTitle: jobTitle ?? null }),
    },
  });

  await prisma.activityLog.create({
    data: {
      eventId,
      userId: dbUser.id,
      action: "vendor.updated",
      metadata: { vendorId, fields: Object.keys(parsed.data) },
    },
  });

  // Return the updated vendor so the UI can update state
  const updated = await prisma.eventVendor.findUnique({
    where: { id: vendorId },
    include: {
      event: { select: { ownerId: true } },
      vendorContact: {
        select: { email: true, firstName: true, lastName: true, phone: true },
      },
    },
  });

  if (!updated)
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  return NextResponse.json({
    vendor: {
      id: updated.id,
      eventId: updated.eventId,
      vendorContactId: updated.vendorContactId,
      userId: updated.userId,
      isEventOwner: updated.userId === updated.event.ownerId,
      company: updated.company,
      jobTitle: updated.jobTitle,
      status: updated.status,
      role: updated.role,
      inviteSentAt: updated.inviteSentAt?.toISOString() ?? null,
      joinedAt: updated.joinedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      email: updated.vendorContact.email,
      firstName: updated.vendorContact.firstName,
      lastName: updated.vendorContact.lastName,
      phone: updated.vendorContact.phone,
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { eventId, vendorId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolved = await resolveOwnership(eventId, vendorId, user.id);
  if (!resolved)
    return NextResponse.json(
      {
        error:
          "You don't have permission to manage vendors for this event. Your access may have been changed — try reloading the page.",
      },
      { status: 403 },
    );

  const { dbUser } = resolved;

  await prisma.eventVendor.delete({ where: { id: vendorId } });

  await prisma.activityLog.create({
    data: {
      eventId,
      userId: dbUser.id,
      action: "vendor.removed",
      metadata: { vendorId },
    },
  });

  return NextResponse.json({ ok: true });
}
