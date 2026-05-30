import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
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
});

async function resolveOwnership(eventId: string, vendorId: string, supabaseUserId: string) {
  const dbUser = await prisma.user.findUnique({ where: { supabaseId: supabaseUserId } });
  if (!dbUser) return null;
  const event = await prisma.event.findFirst({ where: { id: eventId, ownerId: dbUser.id } });
  if (!event) return null;
  const eventVendor = await prisma.eventVendor.findFirst({
    where: { id: vendorId, eventId },
    include: { vendorContact: true },
  });
  return eventVendor ? { dbUser, eventVendor } : null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { eventId, vendorId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolved = await resolveOwnership(eventId, vendorId, user.id);
  if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { dbUser, eventVendor } = resolved;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 422 });
  }

  const { firstName, lastName, phone, company, jobTitle } = parsed.data;

  // Update EventVendor event-specific fields
  await prisma.eventVendor.update({
    where: { id: vendorId },
    data: {
      ...(company !== undefined && { company: company ?? null }),
      ...(jobTitle !== undefined && { jobTitle: jobTitle ?? null }),
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

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { eventId, vendorId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolved = await resolveOwnership(eventId, vendorId, user.id);
  if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
