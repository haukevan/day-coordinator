import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { emitEventUpdate } from "@/lib/realtime";
import {
  computeScheduledEnd,
  propagateSchedule,
  detectCycle,
} from "@/lib/scheduler";

type Params = { params: Promise<{ eventId: string; taskId: string }> };

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
    where: { id: eventId, ownerId: dbUser.id },
    select: { id: true },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const task = await prisma.task.findFirst({ where: { id: taskId, eventId } });
  if (!task)
    return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const body = await req.json();
  const {
    title,
    description,
    durationMins,
    scheduledStart,
    parentTaskId,
    manualOverride,
  } = body;

  if (title !== undefined && !title?.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  // Resolve the effective new parentTaskId (undefined = not changing)
  const changingParent = "parentTaskId" in body;
  const newParentId: string | null | undefined = changingParent
    ? (parentTaskId ?? null)
    : undefined;

  // Validate new parent if changing
  if (newParentId) {
    const parent = await prisma.task.findFirst({
      where: { id: newParentId, eventId },
    });
    if (!parent)
      return NextResponse.json(
        { error: "Parent task not found in this event." },
        { status: 400 },
      );

    if (await detectCycle(taskId, newParentId))
      return NextResponse.json(
        { error: "Circular dependency detected." },
        { status: 400 },
      );
  }

  // Determine manualOverride value
  const effectiveParentId =
    newParentId !== undefined ? newParentId : task.parentTaskId;
  const settingManualStart =
    scheduledStart !== undefined && scheduledStart !== null;

  let newManualOverride: boolean;
  if ("manualOverride" in body && manualOverride !== undefined) {
    newManualOverride = Boolean(manualOverride);
  } else if (newParentId === null) {
    newManualOverride = false;
  } else if (settingManualStart && Boolean(effectiveParentId)) {
    newManualOverride = true;
  } else {
    newManualOverride = task.manualOverride;
  }

  // Build update payload
  const updateData: Record<string, unknown> = {
    manualOverride: newManualOverride,
  };
  if (title !== undefined) updateData.title = title.trim();
  if ("description" in body)
    updateData.description = description?.trim() || null;
  if (durationMins !== undefined)
    updateData.durationMins = durationMins ?? null;
  if (scheduledStart !== undefined)
    updateData.scheduledStart = scheduledStart
      ? new Date(scheduledStart)
      : null;
  if (newParentId !== undefined) updateData.parentTaskId = newParentId;

  await prisma.task.update({ where: { id: taskId }, data: updateData });

  await computeScheduledEnd(taskId);
  await propagateSchedule(taskId);

  await prisma.activityLog.create({
    data: {
      eventId,
      userId: dbUser.id,
      action: "task.updated",
      metadata: { taskId, changes: Object.keys(updateData) },
    },
  });

  const fresh = await prisma.task.findUnique({
    where: { id: taskId },
    include: { parentTask: { select: { id: true, title: true } } },
  });

  await emitEventUpdate(eventId, "task.updated", {
    eventId,
    taskId,
    task: fresh,
  });

  return NextResponse.json({ task: fresh });
}

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
    where: { id: eventId, ownerId: dbUser.id },
    select: { id: true },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const task = await prisma.task.findFirst({ where: { id: taskId, eventId } });
  if (!task)
    return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // Keep the DAG valid by detaching direct children before deletion.
  await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({
      where: { eventId, parentTaskId: taskId },
      data: { parentTaskId: null, manualOverride: false },
    });

    await tx.task.delete({ where: { id: taskId } });

    await tx.activityLog.create({
      data: {
        eventId,
        userId: dbUser.id,
        action: "task.updated",
        metadata: { taskId, operation: "deleted" },
      },
    });
  });

  await emitEventUpdate(eventId, "task.updated", {
    eventId,
    taskId,
    deleted: true,
  });

  return NextResponse.json({ ok: true });
}
