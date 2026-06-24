import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

type Params = { params: Promise<{ token: string }> };

const joinSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(64),
  lastName: z.string().min(1, "Last name is required").max(64),
  phone: z
    .string()
    .regex(/^\+1\d{10}$/, "Phone must be a valid US number")
    .optional()
    .nullable(),
  company: z.string().max(128).optional().nullable(),
  jobTitle: z.string().max(128).optional().nullable(),
});

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;

  // Rate limit: 10 token attempts per 15 min per IP
  const ip = getClientIp(req);
  const { allowed: rateOk } = await checkRateLimit(
    `invite:token:${ip}`,
    10,
    15 * 60 * 1000,
  );
  if (!rateOk) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait before trying again." },
      { status: 429 },
    );
  }

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

  const eventVendor = await prisma.eventVendor.findUnique({
    where: { inviteToken: token },
    include: { vendorContact: true },
  });

  if (!eventVendor)
    return NextResponse.json(
      { error: "Invalid invite link." },
      { status: 404 },
    );
  if (
    eventVendor.inviteTokenExpiresAt &&
    eventVendor.inviteTokenExpiresAt < new Date()
  ) {
    return NextResponse.json(
      {
        error:
          "This invite link has expired. Ask the coordinator to resend it.",
      },
      { status: 410 },
    );
  }
  if (eventVendor.status === "ACCEPTED") {
    return NextResponse.json({
      eventId: eventVendor.eventId,
      alreadyAccepted: true,
    });
  }

  // Verify the authenticated user's email matches the invite
  if (
    dbUser.email.toLowerCase() !== eventVendor.vendorContact.email.toLowerCase()
  ) {
    return NextResponse.json(
      {
        error: `Please sign in with the email address this invite was sent to: ${eventVendor.vendorContact.email}`,
      },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const { firstName, lastName, phone, company, jobTitle } = parsed.data;

  // Update user profile if not yet onboarded
  if (!dbUser.onboarded) {
    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        phone: phone ?? null,
        onboarded: true,
      },
    });
  }

  // Mark vendor as accepted
  await prisma.eventVendor.update({
    where: { id: eventVendor.id },
    data: {
      status: "ACCEPTED",
      userId: dbUser.id,
      joinedAt: new Date(),
      company: company ?? null,
      jobTitle: jobTitle ?? null,
    },
  });

  // Sync VendorContact defaults with confirmed info
  await prisma.vendorContact.update({
    where: { id: eventVendor.vendorContactId },
    data: {
      firstName,
      lastName,
      phone: phone ?? null,
      ...(company !== undefined && { company: company ?? null }),
      ...(jobTitle !== undefined && { jobTitle: jobTitle ?? null }),
    },
  });

  await prisma.activityLog.create({
    data: {
      eventId: eventVendor.eventId,
      userId: dbUser.id,
      action: "vendor.joined",
      metadata: { eventVendorId: eventVendor.id },
    },
  });

  return NextResponse.json({ eventId: eventVendor.eventId });
}
