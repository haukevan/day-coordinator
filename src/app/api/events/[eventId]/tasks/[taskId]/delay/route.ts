import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { canActOnTask } from "@/lib/db/permissions";
import { emitEventUpdate } from "@/lib/realtime";
import { propagateDelay } from "@/lib/scheduler/delay";
import { computeScheduledEnd } from "@/lib/scheduler";
import { z } from "zod";
import {
  createNotification,
  resolveCoordinatorUserIds,
  buildIdempotencyKey,
} from "@/lib/notifications/helpers";
import { sendNotification } from "@/lib/notifications";

type Params = { params: Promise<{ eventId: string; taskId: string }> };

const delayTaskSchema = z.object({
  delayMinutes: z.number().int().min(1).max(1440),
});

export async function POST(req: NextRequest, { params }: Params) {
  const { eventId, taskId } = await params;

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

  // Verify event exists and is LIVE
  const event = await prisma.event.findFirst({
    where: { id: eventId },
    select: { id: true, status: true },
  });
  if (!event)
    return NextResponse.json({ error: "Event not found" }, { status: 404 });

  if (event.status !== "LIVE") {
    return NextResponse.json(
      { error: "Task delay can only be set during live mode." },
      { status: 422 },
    );
  }

  // Permission check: owner, coordinator, or assigned vendor
  const allowed = await canActOnTask(eventId, taskId, dbUser.id);
  if (!allowed)
    return NextResponse.json(
      { error: "You don't have permission to delay this task." },
      { status: 403 },
    );

  // Fetch task
  const task = await prisma.task.findFirst({
    where: { id: taskId, eventId },
  });
  if (!task)
    return NextResponse.json({ error: "Task not found" }, { status: 404 });

  if (task.status === "COMPLETED" || task.status === "SKIPPED") {
    return NextResponse.json(
      { error: `Cannot delay a ${task.status.toLowerCase()} task.` },
      { status: 422 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = delayTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const roundedDelay = parsed.data.delayMinutes;
  const previousStatus = task.status;
  const originalEnd = task.scheduledEnd;
  const originalDuration = task.durationMins;

  // Increase durationMins so computeScheduledEnd produces the extended end time
  const newDuration = (originalDuration ?? 0) + roundedDelay;

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "DELAYED",
      delayAmountMins: roundedDelay,
      durationMins: newDuration,
    },
  });

  // Recompute end from start + extended duration
  await computeScheduledEnd(taskId);

  // Propagate delay to all descendants
  await propagateDelay(taskId, roundedDelay);

  // Activity log
  await prisma.activityLog.create({
    data: {
      eventId,
      userId: dbUser.id,
      taskId,
      action: "task.delayed",
      metadata: {
        delayMinutes: roundedDelay,
        originalEnd: originalEnd?.toISOString() ?? null,
        previousStatus,
      },
    },
  });

  // Real-time broadcast
  await emitEventUpdate(eventId, "task.delayed", {
    eventId,
    taskId,
    delayMinutes: roundedDelay,
    status: "DELAYED",
    previousStatus,
  });

  // Notify direct children's assignees + coordinators about the delay
  const childTasks = await prisma.task.findMany({
    where: { parentTaskId: taskId },
    select: { id: true, title: true, assignedToId: true },
  });

  const coordinatorIds = await resolveCoordinatorUserIds(eventId);
  const delayBucket = Math.floor(Date.now() / 60000).toString();

  // PUSH for each child task assignee
  for (const child of childTasks) {
    if (child.assignedToId) {
      createNotification({
        eventId,
        type: "TASK_DELAYED",
        channel: "PUSH",
        recipient: child.assignedToId,
        payload: {
          title: "Task Delayed",
          body: `"${task.title}" was delayed by ${roundedDelay} min. "${child.title}" is affected.`,
          data: { url: `/events/${eventId}/timeline` },
        },
        idempotencyKey: buildIdempotencyKey(
          "TASK_DELAYED",
          eventId,
          child.id,
          delayBucket,
        ),
      }).then((nid) => {
        if (nid) sendNotification(nid).catch(console.error);
      });
    }
  }

  // PUSH + SMS for coordinators (summary)
  for (const cid of coordinatorIds) {
    createNotification({
      eventId,
      type: "TASK_DELAYED",
      channel: "PUSH",
      recipient: cid,
      payload: {
        title: "Task Delayed",
        body: `"${task.title}" was delayed by ${roundedDelay} min. ${childTasks.length} downstream task(s) affected.`,
        data: { url: `/events/${eventId}/timeline` },
      },
      idempotencyKey: buildIdempotencyKey(
        "TASK_DELAYED",
        eventId,
        `coordinator-${cid}`,
        delayBucket,
      ),
    }).then((nid) => {
      if (nid) sendNotification(nid).catch(console.error);
    });
    createNotification({
      eventId,
      type: "TASK_DELAYED",
      channel: "SMS",
      recipient: cid,
      payload: {
        body: `"${task.title}" was delayed by ${roundedDelay} min. ${childTasks.length} downstream task(s) affected.`,
      },
      idempotencyKey: buildIdempotencyKey(
        "TASK_DELAYED",
        eventId,
        `coordinator-sms-${cid}`,
        delayBucket,
      ),
    }).then((nid) => {
      if (nid) sendNotification(nid).catch(console.error);
    });
  }

  // Fetch fresh task to return
  const fresh = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      status: true,
      scheduledEnd: true,
      delayAmountMins: true,
      actualStart: true,
      actualEnd: true,
    },
  });

  return NextResponse.json({ task: fresh });
}

/**
 * PATCH — adjust an existing delay amount.
 * Only works when the task is already DELAYED.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { eventId, taskId } = await params;

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
    where: { id: eventId },
    select: { id: true, status: true },
  });
  if (!event || event.status !== "LIVE")
    return NextResponse.json(
      { error: "Delay can only be adjusted during live mode." },
      { status: 422 },
    );

  const allowed = await canActOnTask(eventId, taskId, dbUser.id);
  if (!allowed)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const task = await prisma.task.findFirst({ where: { id: taskId, eventId } });
  if (!task)
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (task.status !== "DELAYED")
    return NextResponse.json(
      { error: "Task is not currently delayed." },
      { status: 422 },
    );

  const body = await req.json();
  const { delayMinutes } = body as { delayMinutes: number };
  if (
    typeof delayMinutes !== "number" ||
    delayMinutes <= 0 ||
    delayMinutes > 1440
  )
    return NextResponse.json(
      { error: "delayMinutes must be 1-1440." },
      { status: 400 },
    );

  const roundedDelay = Math.round(delayMinutes);
  const oldDelay = task.delayAmountMins ?? 0;
  const delta = roundedDelay - oldDelay;

  // Adjust durationMins by the delta so computeScheduledEnd produces the right end
  const newDuration = (task.durationMins ?? 0) + delta;

  await prisma.task.update({
    where: { id: taskId },
    data: {
      delayAmountMins: roundedDelay,
      durationMins: newDuration > 0 ? newDuration : null,
    },
  });

  await computeScheduledEnd(taskId);

  // Propagate the delta to descendants
  await propagateDelay(taskId, delta);

  await prisma.activityLog.create({
    data: {
      eventId,
      userId: dbUser.id,
      taskId,
      action: "task.delayed",
      metadata: { adjusted: true, oldDelay, newDelay: roundedDelay, delta },
    },
  });

  await emitEventUpdate(eventId, "task.delayed", {
    eventId,
    taskId,
    delayMinutes: roundedDelay,
    adjusted: true,
  });

  // Notify coordinators + child assignees about the delay adjustment (only if delta ≠ 0)
  if (delta !== 0) {
    const taskTitle = task.title;
    const childTasks = await prisma.task.findMany({
      where: { parentTaskId: taskId },
      select: { id: true, title: true, assignedToId: true },
    });
    const coordinatorIds = await resolveCoordinatorUserIds(eventId);
    const delayBucket = Math.floor(Date.now() / 60000).toString();

    // PUSH for each child task assignee
    for (const child of childTasks) {
      if (child.assignedToId) {
        createNotification({
          eventId,
          type: "TASK_DELAYED",
          channel: "PUSH",
          recipient: child.assignedToId,
          payload: {
            title: "Task Delay Adjusted",
            body: `"${taskTitle}" delay was changed to ${roundedDelay} min. "${child.title}" is affected.`,
            data: { url: `/events/${eventId}/timeline` },
          },
          idempotencyKey: buildIdempotencyKey(
            "TASK_DELAYED",
            eventId,
            `adj-${child.id}`,
            delayBucket,
          ),
        }).then((nid) => {
          if (nid) sendNotification(nid).catch(console.error);
        });
      }
    }

    // PUSH + SMS for coordinators
    for (const cid of coordinatorIds) {
      createNotification({
        eventId,
        type: "TASK_DELAYED",
        channel: "PUSH",
        recipient: cid,
        payload: {
          title: "Task Delay Adjusted",
          body: `"${taskTitle}" delay was changed from ${oldDelay} min to ${roundedDelay} min.`,
          data: { url: `/events/${eventId}/timeline` },
        },
        idempotencyKey: buildIdempotencyKey(
          "TASK_DELAYED",
          eventId,
          `adj-coordinator-${cid}`,
          delayBucket,
        ),
      }).then((nid) => {
        if (nid) sendNotification(nid).catch(console.error);
      });
      createNotification({
        eventId,
        type: "TASK_DELAYED",
        channel: "SMS",
        recipient: cid,
        payload: {
          body: `"${taskTitle}" delay was changed from ${oldDelay} min to ${roundedDelay} min.`,
        },
        idempotencyKey: buildIdempotencyKey(
          "TASK_DELAYED",
          eventId,
          `adj-coordinator-sms-${cid}`,
          delayBucket,
        ),
      }).then((nid) => {
        if (nid) sendNotification(nid).catch(console.error);
      });
    }
  }

  return NextResponse.json({
    task: { id: taskId, delayAmountMins: roundedDelay },
  });
}

/**
 * DELETE — remove a delay entirely.
 * Resets status to previous, clears delayAmountMins, pulls back descendants.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { eventId, taskId } = await params;

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
    where: { id: eventId },
    select: { id: true, status: true },
  });
  if (!event || event.status !== "LIVE")
    return NextResponse.json(
      { error: "Delay can only be removed during live mode." },
      { status: 422 },
    );

  const allowed = await canActOnTask(eventId, taskId, dbUser.id);
  if (!allowed)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const task = await prisma.task.findFirst({ where: { id: taskId, eventId } });
  if (!task)
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (task.status !== "DELAYED")
    return NextResponse.json(
      { error: "Task is not currently delayed." },
      { status: 422 },
    );

  const delayAmount = task.delayAmountMins ?? 0;

  // Restore the original duration (subtract delay amount)
  const restoredDuration = (task.durationMins ?? 0) - delayAmount;

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "IN_PROGRESS",
      delayAmountMins: null,
      durationMins: restoredDuration > 0 ? restoredDuration : null,
    },
  });

  await computeScheduledEnd(taskId);

  // Pull back descendants to tight scheduling
  await propagateDelay(taskId, -delayAmount);

  await prisma.activityLog.create({
    data: {
      eventId,
      userId: dbUser.id,
      taskId,
      action: "task.delayed",
      metadata: { removedDelay: true, delayAmount },
    },
  });

  await emitEventUpdate(eventId, "task.delayed", {
    eventId,
    taskId,
    delayRemoved: true,
  });

  // Notify coordinators + child assignees about the delay removal
  const taskTitle = task.title;
  const childTasks = await prisma.task.findMany({
    where: { parentTaskId: taskId },
    select: { id: true, title: true, assignedToId: true },
  });
  const coordinatorIds = await resolveCoordinatorUserIds(eventId);
  const delayBucket = Math.floor(Date.now() / 60000).toString();

  // PUSH for each child task assignee
  for (const child of childTasks) {
    if (child.assignedToId) {
      createNotification({
        eventId,
        type: "TASK_DELAYED",
        channel: "PUSH",
        recipient: child.assignedToId,
        payload: {
          title: "Task Delay Removed",
          body: `The delay on "${taskTitle}" was removed. "${child.title}" is back on schedule.`,
          data: { url: `/events/${eventId}/timeline` },
        },
        idempotencyKey: buildIdempotencyKey(
          "TASK_DELAYED",
          eventId,
          `rm-${child.id}`,
          delayBucket,
        ),
      }).then((nid) => {
        if (nid) sendNotification(nid).catch(console.error);
      });
    }
  }

  // PUSH + SMS for coordinators
  for (const cid of coordinatorIds) {
    createNotification({
      eventId,
      type: "TASK_DELAYED",
      channel: "PUSH",
      recipient: cid,
      payload: {
        title: "Task Delay Removed",
        body: `The ${delayAmount} min delay on "${taskTitle}" was removed — back on schedule.`,
        data: { url: `/events/${eventId}/timeline` },
      },
      idempotencyKey: buildIdempotencyKey(
        "TASK_DELAYED",
        eventId,
        `rm-coordinator-${cid}`,
        delayBucket,
      ),
    }).then((nid) => {
      if (nid) sendNotification(nid).catch(console.error);
    });
    createNotification({
      eventId,
      type: "TASK_DELAYED",
      channel: "SMS",
      recipient: cid,
      payload: {
        body: `The ${delayAmount} min delay on "${taskTitle}" was removed — back on schedule.`,
      },
      idempotencyKey: buildIdempotencyKey(
        "TASK_DELAYED",
        eventId,
        `rm-coordinator-sms-${cid}`,
        delayBucket,
      ),
    }).then((nid) => {
      if (nid) sendNotification(nid).catch(console.error);
    });
  }

  return NextResponse.json({
    task: { id: taskId, status: "IN_PROGRESS", delayAmountMins: null },
  });
}
