import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

type Params = { params: Promise<{ contactId: string }> };

const updateVendorContactSchema = z.object({
  email: z.string().email("Valid email is required.").max(254).optional(),
  firstName: z.string().max(128).optional(),
  lastName: z.string().max(128).optional(),
  phone: z.string().max(20).optional(),
  company: z.string().max(128).optional(),
  jobTitle: z.string().max(128).optional(),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function trimPatch(data: z.infer<typeof updateVendorContactSchema>) {
  const result: Record<string, unknown> = {};
  if (data.email !== undefined) result.email = data.email.trim().toLowerCase();
  for (const f of [
    "firstName",
    "lastName",
    "phone",
    "company",
    "jobTitle",
  ] as const) {
    if (data[f] !== undefined) result[f] = data[f] ? data[f].trim() : null;
  }
  return result;
}

// ─── PATCH ─────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  const { contactId } = await params;
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

  const contact = await prisma.vendorContact.findFirst({
    where: { id: contactId, ownerId: dbUser.id },
    include: {
      eventVendors: {
        include: {
          event: { select: { id: true, title: true, status: true } },
        },
      },
      _count: { select: { eventVendors: true } },
    },
  });
  if (!contact)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateVendorContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const updated = await prisma.vendorContact.update({
    where: { id: contactId },
    data: trimPatch(parsed.data),
  });

  // Build linked events list for the response
  const linkedEvents = contact.eventVendors.map((ev) => ({
    id: ev.event.id,
    title: ev.event.title,
    status: ev.event.status,
  }));

  return NextResponse.json({
    contact: {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      phone: updated.phone,
      company: updated.company,
      jobTitle: updated.jobTitle,
    },
    linkedEvents,
    eventCount: contact._count.eventVendors,
  });
}

// ─── DELETE ────────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { contactId } = await params;
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

  const contact = await prisma.vendorContact.findFirst({
    where: { id: contactId, ownerId: dbUser.id },
    include: {
      eventVendors: {
        select: {
          id: true,
          eventId: true,
          event: { select: { id: true, title: true } },
        },
      },
    },
  });
  if (!contact)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const removedFromEvents = contact.eventVendors.map((ev) => ({
    id: ev.event.id,
    title: ev.event.title,
  }));

  await prisma.$transaction([
    prisma.eventVendor.deleteMany({ where: { vendorContactId: contactId } }),
    prisma.vendorContact.delete({ where: { id: contactId } }),
  ]);

  return NextResponse.json({
    success: true,
    removedFromEvents,
  });
}
