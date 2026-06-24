import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { emitEventUpdate } from "@/lib/realtime";
import {
  sendVendorInviteEmail,
  sendVendorInviteEmailBatch,
} from "@/lib/notifications/vendor-invite";
import type { EventStatus } from "@/generated/prisma/client";
import { z } from "zod";

type Params = { params: Promise<{ eventId: string }> };

// Manual transitions are restricted: users can only upgrade from DRAFT → SCHEDULED.
// After SCHEDULED, the system owns the lifecycle:
//   SCHEDULED → LIVE (auto-cron on event date)
//   LIVE → ARCHIVED (auto-cron 24h after last task ends)
const VALID_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  DRAFT: ["SCHEDULED", "ARCHIVED"],
  SCHEDULED: [],
  LIVE: [],
  COMPLETED: [],
  ARCHIVED: [],
};

const updateEventStatusSchema = z.object({
  status: z.enum(["DRAFT", "SCHEDULED", "LIVE", "COMPLETED", "ARCHIVED"]),
  password: z.string().optional(),
});

const ACTION_MAP: Record<string, string> = {
  SCHEDULED: "event.scheduled",
  LIVE: "event.live_started",
  COMPLETED: "event.completed",
  ARCHIVED: "event.archived",
};

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
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateEventStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const { status: targetStatus, password } = parsed.data;
  const allowed = VALID_TRANSITIONS[event.status as EventStatus] ?? [];

  if (!allowed.includes(targetStatus as EventStatus)) {
    return NextResponse.json(
      { error: `Cannot transition from ${event.status} to ${targetStatus}.` },
      { status: 422 },
    );
  }

  // Password gate for DRAFT → SCHEDULED (placeholder for Stripe payment)
  if (event.status === "DRAFT" && targetStatus === "SCHEDULED") {
    if (!password || password !== process.env.UPGRADE_PASSWORD) {
      return NextResponse.json(
        { error: "Invalid access code." },
        { status: 403 },
      );
    }

    // Require an event date before scheduling
    if (!event.eventDate) {
      return NextResponse.json(
        { error: "Please set an event date in settings before scheduling." },
        { status: 422 },
      );
    }
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      status: targetStatus,
      ...(targetStatus === "LIVE" && !event.liveStartedAt
        ? { liveStartedAt: new Date() }
        : {}),
    },
  });

  const action = ACTION_MAP[targetStatus] ?? "event.updated";
  await prisma.activityLog.create({
    data: {
      eventId,
      userId: dbUser.id,
      action,
      metadata: { from: event.status, to: targetStatus },
    },
  });

  await emitEventUpdate(eventId, action, { eventId, status: targetStatus });

  // When going SCHEDULED, send queued invite emails to all PENDING vendors
  if (targetStatus === "SCHEDULED") {
    // Batch-fetch all pending vendor data in a single query to avoid N+1
    const pendingVendors = await prisma.eventVendor.findMany({
      where: {
        eventId,
        status: "PENDING",
        inviteSentAt: null,
        inviteToken: { not: null },
      },
      include: {
        vendorContact: true,
        event: { select: { title: true, eventDate: true } },
      },
    });
    if (pendingVendors.length > 0) {
      await sendVendorInviteEmailBatch(pendingVendors);
    }
  }

  return NextResponse.json({ event: updated });
}
