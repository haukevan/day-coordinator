import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { emitEventUpdate } from "@/lib/realtime";
import { z } from "zod";

type Params = { params: Promise<{ eventId: string }> };

/**
 * Yesterday's date as a YYYY-MM-DD string — used as the cutoff for
 * "date in the past" checks. Using yesterday instead of today gives a
 * 1-day grace period that absorbs timezone differences (a user in UTC-7
 * at 10 PM should still be allowed to set the date to "today" even though
 * UTC has already rolled over).
 */
function cutoffDateStr(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split("T")[0];
}

/** Extract the date portion (YYYY-MM-DD) from an event's stored DateTime. */
function eventDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

const updateEventSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  eventDate: z.string().optional().nullable(),
  timezone: z.string().optional(),
  slug: z.string().max(100).optional().nullable(),
  publicTimeline: z.boolean().optional(),
  venueId: z.string().optional().nullable(),
});

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

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ event });
}

export async function PATCH(req: NextRequest, { params }: Params) {
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

  const parsed = updateEventSchema.safeParse(body);
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
    publicTimeline,
    venueId,
  } = parsed.data;

  const cutoffStr = cutoffDateStr();

  // Determine whether the event date has already passed (lock the date field).
  // Uses yesterday as the cutoff to tolerate timezone differences.
  const eventDatePassed = !!(
    event.eventDate && eventDateStr(event.eventDate) <= cutoffStr
  );

  // ARCHIVED events are fully read-only — no field may be edited.
  if (event.status === "ARCHIVED") {
    return NextResponse.json(
      {
        error:
          "Archived events cannot be edited. You can still view or delete this event.",
      },
      { status: 403 },
    );
  }

  // ── Date-passed lock ──────────────────────────────────────────────────
  // Once the event date has passed, only the eventDate field is locked.
  // This prevents reusing a paid event across multiple dates. All other
  // fields are always editable (including during LIVE — last-minute
  // changes are expected).
  const dateFieldLocked = eventDatePassed;

  // ── Reject past dates ────────────────────────────────────────────────
  // Uses yesterday's date as the cutoff so "today" works in all timezones.
  // Strictly less than (not <=) — yesterday is still allowed as a grace day.
  if (eventDate && eventDate < cutoffStr) {
    return NextResponse.json(
      { error: "Event date cannot be in the past." },
      { status: 422 },
    );
  }

  // Validate venue ownership if venueId is provided and different
  if (venueId !== undefined && venueId !== event.venueId) {
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
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && {
        description: description?.trim() || null,
      }),
      // eventDate is only locked when the date has already passed
      ...(eventDate !== undefined &&
        !dateFieldLocked && {
          eventDate: eventDate ? new Date(eventDate + "T12:00:00.000Z") : null,
        }),
      ...(timezone !== undefined && { timezone }),
      ...(slug !== undefined && { slug: slug?.trim() || null }),
      ...(venueId !== undefined && { venueId: venueId || null }),
      ...(publicTimeline !== undefined && {
        publicTimeline: Boolean(publicTimeline),
      }),
    },
  });

  // ── Propagate event date change to all task times ──────────────────────
  // When the event date shifts by N days, move every task's scheduledStart
  // and scheduledEnd by the same number of days so tasks don't get stranded
  // on the old date.
  if (
    eventDate !== undefined &&
    !dateFieldLocked &&
    eventDate &&
    event.eventDate
  ) {
    const oldDateMs = event.eventDate.getTime();
    const newDateMs = new Date(eventDate + "T12:00:00.000Z").getTime();
    const dayDelta = Math.round(
      (newDateMs - oldDateMs) / (24 * 60 * 60 * 1000),
    );

    if (dayDelta !== 0) {
      const offsetMs = dayDelta * 24 * 60 * 60 * 1000;
      const allTasks = await prisma.task.findMany({
        where: { eventId },
        select: { id: true, scheduledStart: true, scheduledEnd: true },
      });

      for (const t of allTasks) {
        const taskUpdates: Record<string, Date> = {};
        if (t.scheduledStart)
          taskUpdates.scheduledStart = new Date(
            t.scheduledStart.getTime() + offsetMs,
          );
        if (t.scheduledEnd)
          taskUpdates.scheduledEnd = new Date(
            t.scheduledEnd.getTime() + offsetMs,
          );
        if (Object.keys(taskUpdates).length > 0) {
          await prisma.task.update({
            where: { id: t.id },
            data: taskUpdates,
          });
        }
      }
    }
  }

  await prisma.activityLog.create({
    data: {
      eventId,
      userId: dbUser.id,
      action: "event.updated",
      metadata: { fields: Object.keys(body as Record<string, unknown>) },
    },
  });

  await emitEventUpdate(eventId, "event.updated", {
    eventId,
    status: updated.status,
  });

  return NextResponse.json({ event: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
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

  if (event.status === "LIVE") {
    return NextResponse.json(
      { error: "Cannot delete an event that is currently live." },
      { status: 422 },
    );
  }

  await prisma.$transaction([
    prisma.activityLog.deleteMany({ where: { eventId } }),
    prisma.eventVendor.deleteMany({ where: { eventId } }),
    prisma.task.deleteMany({ where: { eventId } }),
    prisma.event.delete({ where: { id: eventId } }),
  ]);

  return NextResponse.json({ success: true });
}
