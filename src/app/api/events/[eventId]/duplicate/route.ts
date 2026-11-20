import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { emitEventUpdate } from "@/lib/realtime";
import { checkEventLimit } from "@/lib/db/limits";

type Params = { params: Promise<{ eventId: string }> };

const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** True when the source event date is older than the grace cutoff. */
function sourceDatePassed(
  cutoffDay: string,
  sourceDay: string | null,
): boolean {
  return sourceDay !== null && sourceDay < cutoffDay;
}

/**
 * Duplicate an event the current user owns.
 *
 * The copy is a fresh DRAFT: tasks keep their dates/times/gaps and dependency
 * links, vendors are re-linked without sending invites, and checklist items
 * are copied unstarted. Live-mode fields are reset.
 */
export async function POST(_req: NextRequest, { params }: Params) {
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

  const source = await prisma.event.findFirst({
    where: { id: eventId, ownerId: dbUser.id },
    include: {
      eventVendors: true,
      venue: {
        select: {
          id: true,
          name: true,
          address: true,
          description: true,
          ownerName: true,
          ownerPhone: true,
          ownerEmail: true,
        },
      },
      tasks: {
        include: {
          taskVendors: true,
          subTasks: {
            include: { subTaskVendors: true },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!source)
    return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const limit = await checkEventLimit(dbUser.id);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `You've reached the maximum of ${limit.max} events.` },
      { status: 429 },
    );
  }

  const title = `${source.title} (copy)`.slice(0, 100);
  const inviteTokenExpiresAt = new Date(Date.now() + INVITE_TTL_MS);

  // A past date is locked in settings, so don't carry it into the new draft.
  // Tasks keep their times and are re-anchored when a new date is chosen.
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 1);
  const cutoffDay = cutoff.toISOString().slice(0, 10);
  const sourceDay = source.eventDate?.toISOString().slice(0, 10) ?? null;
  const copiedEventDate = sourceDatePassed(cutoffDay, sourceDay)
    ? null
    : source.eventDate;

  const createdEvent = await prisma.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        title,
        description: source.description,
        eventDate: copiedEventDate,
        timezone: source.timezone,
        status: "DRAFT",
        slug: null,
        publicTimeline: false,
        paymentStatus: "FREE",
        ownerId: dbUser.id,
        venueId: source.venueId,
      },
    });

    // ── Vendors ────────────────────────────────────────────────────────
    const vendorIdMap = new Map<string, string>();
    for (const eventVendor of source.eventVendors) {
      const isOwner = eventVendor.userId === source.ownerId;
      const createdVendor = await tx.eventVendor.create({
        data: {
          eventId: created.id,
          vendorContactId: eventVendor.vendorContactId,
          userId: isOwner ? dbUser.id : null,
          company: eventVendor.company,
          jobTitle: eventVendor.jobTitle,
          status: isOwner ? "ACCEPTED" : "PENDING",
          role: eventVendor.role,
          inviteToken: isOwner ? null : nanoid(32),
          inviteTokenExpiresAt: isOwner ? null : inviteTokenExpiresAt,
          inviteSentAt: null,
          joinedAt: isOwner ? new Date() : null,
          invitedByUserId: dbUser.id,
          pushEnabled: eventVendor.pushEnabled,
          smsEnabled: eventVendor.smsEnabled,
        },
      });
      vendorIdMap.set(eventVendor.id, createdVendor.id);
    }

    // ── Tasks, task vendors, checklists ────────────────────────────────
    const taskIdMap = new Map<string, string>();
    for (const task of source.tasks) {
      const createdTask = await tx.task.create({
        data: {
          eventId: created.id,
          title: task.title,
          description: task.description,
          status: "PENDING",
          scheduledStart: task.scheduledStart,
          scheduledEnd: task.scheduledEnd,
          durationMins: task.durationMins,
          manualOverride: task.manualOverride,
          sequenceLabel: task.sequenceLabel,
          publicVisibility: task.publicVisibility,
          assignedToId: task.assignedToId,
        },
      });
      taskIdMap.set(task.id, createdTask.id);

      for (const taskVendor of task.taskVendors) {
        const mappedVendorId = vendorIdMap.get(taskVendor.eventVendorId);
        if (!mappedVendorId) continue;
        await tx.taskVendor.create({
          data: {
            taskId: createdTask.id,
            eventVendorId: mappedVendorId,
          },
        });
      }

      for (const subTask of task.subTasks) {
        const createdSubTask = await tx.subTask.create({
          data: {
            taskId: createdTask.id,
            title: subTask.title,
            status: "NOT_STARTED",
            sortOrder: subTask.sortOrder,
          },
        });

        for (const subTaskVendor of subTask.subTaskVendors) {
          const mappedVendorId = vendorIdMap.get(subTaskVendor.eventVendorId);
          if (!mappedVendorId) continue;
          await tx.subTaskVendor.create({
            data: {
              subTaskId: createdSubTask.id,
              eventVendorId: mappedVendorId,
            },
          });
        }
      }
    }

    // Second pass: re-link parent tasks once every copy has an ID.
    for (const task of source.tasks) {
      if (!task.parentTaskId) continue;
      const newTaskId = taskIdMap.get(task.id);
      const newParentTaskId = taskIdMap.get(task.parentTaskId);
      if (!newTaskId || !newParentTaskId) continue;
      await tx.task.update({
        where: { id: newTaskId },
        data: { parentTaskId: newParentTaskId },
      });
    }

    await tx.activityLog.create({
      data: {
        eventId: created.id,
        userId: dbUser.id,
        action: "event.duplicated",
        metadata: { sourceEventId: source.id },
      },
    });

    return created;
  });

  revalidatePath("/dashboard");

  await emitEventUpdate(createdEvent.id, "event.created", {
    eventId: createdEvent.id,
    title,
  });

  return NextResponse.json(
    {
      event: {
        id: createdEvent.id,
        title,
        eventDate: createdEvent.eventDate,
        status: createdEvent.status,
        createdAt: createdEvent.createdAt,
        _count: { tasks: source.tasks.length },
        venue: source.venue,
      },
    },
    { status: 201 },
  );
}
