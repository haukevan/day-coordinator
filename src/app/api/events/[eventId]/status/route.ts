import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { emitEventUpdate } from "@/lib/realtime";
import { sendVendorInviteEmail } from "@/lib/notifications/vendor-invite";
import type { EventStatus } from "@/generated/prisma/client";

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

  const { status: targetStatus, password } = await req.json();
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
    const pendingVendors = await prisma.eventVendor.findMany({
      where: {
        eventId,
        status: "PENDING",
        inviteSentAt: null,
        inviteToken: { not: null },
      },
      select: { id: true },
    });
    for (const v of pendingVendors) {
      try {
        await sendVendorInviteEmail(v.id);
      } catch (err) {
        console.error(
          "[vendor-invite] Failed to send invite for eventVendor",
          v.id,
          err,
        );
      }
    }
  }

  return NextResponse.json({ event: updated });
}
