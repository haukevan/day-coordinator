import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { canManageEvent } from "@/lib/db/permissions";
import { emitEventUpdate } from "@/lib/realtime";
import {
  computeScheduledEnd,
  propagateSchedule,
  detectCycle,
} from "@/lib/scheduler";
import { z } from "zod";

type Params = { params: Promise<{ eventId: string; taskId: string }> };

const updateTaskSchema = z.object({
  title: z.string().min(1).max(256).optional(),
  description: z.string().max(2000).optional().nullable(),
  scheduledStart: z.string().datetime().optional().nullable(),
  scheduledEnd: z.string().datetime().optional().nullable(),
  parentTaskId: z.string().optional().nullable(),
  vendorIds: z.array(z.string()).optional(),
  sequenceLabel: z.string().max(64).optional().nullable(),
});

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
    select: { id: true, status: true },
  });

  const allowed = event || (await canManageEvent(eventId, dbUser.id));
  if (!allowed)
    return NextResponse.json(
      {
        error:
          "You don't have permission to manage tasks for this event. Your access may have been changed — try reloading the page.",
      },
      { status: 403 },
    );

  // ARCHIVED events are read-only — no task editing
  if (event && event.status === "ARCHIVED") {
    return NextResponse.json(
      { error: "Cannot modify tasks in an archived event." },
      { status: 422 },
    );
  }

  const task = await prisma.task.findFirst({ where: { id: taskId, eventId } });
  if (!task)
    return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const rawBody = await req.json().catch(() => null);
  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const body = rawBody as Record<string, unknown>;

  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const {
    title,
    description,
    scheduledEnd,
    scheduledStart,
    parentTaskId,
    vendorIds,
  } = parsed.data;

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

  // Snapshot old scheduledEnd before the update so we can compute the delta
  // for buffer-preserving propagation.
  const oldScheduledEnd = task.scheduledEnd;

  // Compute durationMins from scheduledEnd and scheduledStart when end is provided
  const changingStart = scheduledStart !== undefined;
  const startDate: Date | null | undefined = changingStart
    ? scheduledStart
      ? new Date(scheduledStart)
      : null
    : undefined;
  const changingEnd = "scheduledEnd" in body;
  const endDate: Date | null | undefined = changingEnd
    ? scheduledEnd
      ? new Date(scheduledEnd)
      : null
    : undefined;

  function resolveDurationMins(
    sd: Date | null | undefined,
    ed: Date | null | undefined,
  ): number | null | undefined {
    if (ed === undefined || sd === undefined) return undefined;
    if (!ed || !sd) return null;
    if (Number.isNaN(ed.getTime()) || Number.isNaN(sd.getTime())) return null;
    const mins = Math.round((ed.getTime() - sd.getTime()) / 60_000);
    return mins > 0 ? mins : null;
  }

  const durationMins = resolveDurationMins(startDate, endDate);

  // Build update payload
  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = title.trim();
  if ("description" in body)
    updateData.description = description?.trim() || null;
  if (durationMins !== undefined) updateData.durationMins = durationMins;
  if (scheduledStart !== undefined) updateData.scheduledStart = startDate;
  if (endDate !== undefined) updateData.scheduledEnd = endDate;
  if (newParentId !== undefined) updateData.parentTaskId = newParentId;
  if ("sequenceLabel" in body)
    updateData.sequenceLabel = body.sequenceLabel ?? null;

  // Sync vendor assignments if vendorIds provided
  const changingVendors = "vendorIds" in body;
  let vendorUpdate: object = {};
  if (changingVendors) {
    const vendorIdList: string[] = Array.isArray(vendorIds) ? vendorIds : [];
    if (vendorIdList.length > 0) {
      const validCount = await prisma.eventVendor.count({
        where: { eventId, id: { in: vendorIdList } },
      });
      if (validCount !== vendorIdList.length) {
        return NextResponse.json(
          {
            error: "One or more vendor assignments are invalid for this event.",
          },
          { status: 400 },
        );
      }
    }
    vendorUpdate = {
      taskVendors: {
        deleteMany: {},
        create: vendorIdList.map((eventVendorId) => ({ eventVendorId })),
      },
    };
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { ...updateData, ...vendorUpdate },
  });

  // Fallback: compute scheduledEnd from durationMins if end wasn't provided
  const endIsMissing = endDate !== undefined ? !endDate : !task.scheduledEnd;
  if (endIsMissing) {
    await computeScheduledEnd(taskId);
  }

  // Compute how much the task's end shifted and propagate that delta
  // downstream so every descendant keeps its buffer.
  const updatedTask = await prisma.task.findUnique({
    where: { id: taskId },
    select: { scheduledEnd: true },
  });
  const deltaMs =
    oldScheduledEnd && updatedTask?.scheduledEnd
      ? updatedTask.scheduledEnd.getTime() - oldScheduledEnd.getTime()
      : undefined;

  await propagateSchedule(taskId, deltaMs);

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
    include: {
      parentTask: { select: { id: true, title: true } },
      taskVendors: {
        include: {
          eventVendor: {
            select: {
              id: true,
              company: true,
              jobTitle: true,
              vendorContact: {
                select: {
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      },
    },
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
    select: { id: true, status: true },
  });

  const allowed = event || (await canManageEvent(eventId, dbUser.id));
  if (!allowed)
    return NextResponse.json(
      {
        error:
          "You don't have permission to manage tasks for this event. Your access may have been changed — try reloading the page.",
      },
      { status: 403 },
    );

  // ARCHIVED events are read-only — no task deletion
  if (event && event.status === "ARCHIVED") {
    return NextResponse.json(
      { error: "Cannot delete tasks from an archived event." },
      { status: 422 },
    );
  }

  const task = await prisma.task.findFirst({ where: { id: taskId, eventId } });
  if (!task)
    return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // Keep the DAG valid by detaching direct children before deletion.
  // Pass the sequence label down to the first child so the chain name survives.
  await prisma.$transaction(async (tx) => {
    const firstChild = await tx.task.findFirst({
      where: { eventId, parentTaskId: taskId },
      orderBy: { scheduledStart: "asc" },
      select: { id: true },
    });

    await tx.task.updateMany({
      where: { eventId, parentTaskId: taskId },
      data: { parentTaskId: null, manualOverride: false },
    });

    if (firstChild && task.sequenceLabel) {
      await tx.task.update({
        where: { id: firstChild.id },
        data: { sequenceLabel: task.sequenceLabel },
      });
    }

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
