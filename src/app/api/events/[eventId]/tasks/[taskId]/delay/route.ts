import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { canActOnTask } from "@/lib/db/permissions";
import { emitEventUpdate } from "@/lib/realtime";
import { propagateDelay } from "@/lib/scheduler/delay";
import { computeScheduledEnd } from "@/lib/scheduler";

type Params = { params: Promise<{ eventId: string; taskId: string }> };

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

  const body = await req.json();
  const { delayMinutes } = body as { delayMinutes: number };

  if (
    typeof delayMinutes !== "number" ||
    !Number.isFinite(delayMinutes) ||
    delayMinutes <= 0
  ) {
    return NextResponse.json(
      { error: "delayMinutes must be a positive number." },
      { status: 400 },
    );
  }

  if (delayMinutes > 1440) {
    return NextResponse.json(
      { error: "Delay cannot exceed 24 hours (1440 minutes)." },
      { status: 400 },
    );
  }

  // Round to nearest minute
  const roundedDelay = Math.round(delayMinutes);
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

  return NextResponse.json({
    task: { id: taskId, status: "IN_PROGRESS", delayAmountMins: null },
  });
}
