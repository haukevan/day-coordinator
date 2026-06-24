import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { emitEventUpdate } from "@/lib/realtime";
import { nanoid } from "nanoid";
import { z } from "zod";
import { checkEventLimit } from "@/lib/db/limits";

const createEventSchema = z.object({
  title: z.string().min(1, "Title is required.").max(100),
  description: z.string().max(500).optional(),
  eventDate: z.string().optional(),
  timezone: z.string().optional(),
  slug: z.string().optional(),
  company: z.string().min(1, "Company is required.").max(128),
  jobTitle: z.string().min(1, "Role is required.").max(128),
  venueId: z.string().optional(),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function uniqueSlug(base: string): Promise<string> {
  const candidate = slugify(base);
  const existing = await prisma.event.findUnique({
    where: { slug: candidate },
  });
  if (!existing) return candidate;
  return `${candidate}-${nanoid(6)}`;
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

  // Enforce per-user event limit
  const eventLimit = await checkEventLimit(dbUser.id);
  if (!eventLimit.allowed) {
    return NextResponse.json(
      { error: `You've reached the maximum of ${eventLimit.max} events.` },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const {
    title,
    description,
    eventDate,
    timezone,
    slug,
    company,
    jobTitle,
    venueId,
  } = parsed.data;

  // Validate venue ownership if provided
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

  const resolvedSlug = slug?.trim() ? await uniqueSlug(slug.trim()) : undefined;

  const event = await prisma.$transaction(async (tx) => {
    const createdEvent = await tx.event.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        eventDate: eventDate ? new Date(eventDate + "T12:00:00.000Z") : null,
        timezone: timezone || "UTC",
        slug: resolvedSlug ?? null,
        venueId: venueId || null,
        ownerId: dbUser.id,
      },
    });

    const ownerEmail = dbUser.email.toLowerCase().trim();

    const ownerVendorContact = await tx.vendorContact.upsert({
      where: { ownerId_email: { ownerId: dbUser.id, email: ownerEmail } },
      update: {
        firstName: dbUser.firstName ?? null,
        lastName: dbUser.lastName ?? null,
        company: company.trim(),
        jobTitle: jobTitle.trim(),
      },
      create: {
        ownerId: dbUser.id,
        email: ownerEmail,
        firstName: dbUser.firstName ?? null,
        lastName: dbUser.lastName ?? null,
        phone: dbUser.phone ?? null,
        company: company.trim(),
        jobTitle: jobTitle.trim(),
      },
    });

    await tx.eventVendor.create({
      data: {
        eventId: createdEvent.id,
        vendorContactId: ownerVendorContact.id,
        userId: dbUser.id,
        company: company.trim(),
        jobTitle: jobTitle.trim(),
        status: "ACCEPTED",
        joinedAt: new Date(),
      },
    });

    return createdEvent;
  });

  await prisma.activityLog.create({
    data: {
      eventId: event.id,
      userId: dbUser.id,
      action: "event.created",
      metadata: { title: event.title },
    },
  });

  await emitEventUpdate(event.id, "event.created", {
    eventId: event.id,
    title: event.title,
  });

  return NextResponse.json({ event }, { status: 201 });
}
