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
import { checkTaskLimit } from "@/lib/db/limits";
import { z } from "zod";

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(256),
  description: z.string().max(2000).optional().nullable(),
  scheduledStart: z
    .string()
    .datetime({ message: "Start time must be a valid ISO date" }),
  scheduledEnd: z.string().datetime().optional().nullable(),
  parentTaskId: z.string().optional().nullable(),
  vendorIds: z.array(z.string()).optional().default([]),
  sequenceLabel: z.string().max(64).optional().nullable(),
  assignedToId: z.string().optional().nullable(),
});

type Params = { params: Promise<{ eventId: string }> };

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
    select: { id: true },
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

  const tasks = await prisma.task.findMany({
    where: { eventId },
    orderBy: [{ scheduledStart: "asc" }, { createdAt: "asc" }],
    include: {
      parentTask: { select: { id: true, title: true } },
      _count: { select: { childTasks: true } },
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

  return NextResponse.json({ tasks });
}

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

  // ARCHIVED events are read-only — no task creation or editing
  if (event && event.status === "ARCHIVED") {
    return NextResponse.json(
      { error: "Cannot modify tasks in an archived event." },
      { status: 422 },
    );
  }

  // Enforce per-event task limit
  const taskLimit = await checkTaskLimit(eventId);
  if (!taskLimit.allowed) {
    return NextResponse.json(
      {
        error: `This event has reached the maximum of ${taskLimit.max} tasks.`,
      },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createTaskSchema.safeParse(body);
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
    parentTaskId,
    scheduledStart,
    vendorIds,
  } = parsed.data;

  // Compute durationMins from scheduledEnd and scheduledStart
  const startDate = new Date(scheduledStart);
  const endDate = scheduledEnd ? new Date(scheduledEnd) : null;
  let durationMins: number | null = null;
  if (endDate && !Number.isNaN(endDate.getTime())) {
    durationMins = Math.round(
      (endDate.getTime() - startDate.getTime()) / 60_000,
    );
    if (durationMins <= 0) durationMins = null;
  }

  // Validate parentTaskId belongs to same event
  if (parentTaskId) {
    const parent = await prisma.task.findFirst({
      where: { id: parentTaskId, eventId },
    });
    if (!parent) {
      return NextResponse.json(
        { error: "Parent task not found in this event." },
        { status: 400 },
      );
    }
    // Cycle detection: a newly created task has no children, so technically
    // no cycle is possible, but guard against the task being its own parent.
    if (parentTaskId === "self") {
      return NextResponse.json(
        { error: "Circular dependency detected." },
        { status: 400 },
      );
    }
  }

  // Validate vendorIds — each must belong to this event
  const vendorIdList: string[] = Array.isArray(vendorIds) ? vendorIds : [];
  if (vendorIdList.length > 0) {
    const validCount = await prisma.eventVendor.count({
      where: { eventId, id: { in: vendorIdList } },
    });
    if (validCount !== vendorIdList.length) {
      return NextResponse.json(
        { error: "One or more vendor assignments are invalid for this event." },
        { status: 400 },
      );
    }
  }

  const task = await prisma.task.create({
    data: {
      eventId,
      title: title.trim(),
      description: description?.trim() || null,
      durationMins,
      scheduledEnd: endDate,
      parentTaskId: parentTaskId ?? null,
      scheduledStart: startDate,
      taskVendors:
        vendorIdList.length > 0
          ? {
              createMany: {
                data: vendorIdList.map((eventVendorId) => ({ eventVendorId })),
              },
            }
          : undefined,
    },
  });

  // Fallback: compute scheduledEnd from durationMins if end wasn't provided
  if (task.scheduledStart && task.durationMins && !task.scheduledEnd) {
    await computeScheduledEnd(task.id);
  }

  // Propagate schedule from parent
  if (parentTaskId) {
    await propagateSchedule(parentTaskId);
  }

  await prisma.activityLog.create({
    data: {
      eventId,
      userId: dbUser.id,
      action: "task.created",
      metadata: { taskId: task.id, title: task.title },
    },
  });

  await emitEventUpdate(eventId, "task.created", {
    eventId,
    taskId: task.id,
    title: task.title,
  });

  const fresh = await prisma.task.findUnique({
    where: { id: task.id },
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
  return NextResponse.json({ task: fresh }, { status: 201 });
}
