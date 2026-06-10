import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { emitEventUpdate } from "@/lib/realtime";
import {
  computeScheduledEnd,
  propagateSchedule,
  detectCycle,
} from "@/lib/scheduler";

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
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
    select: { id: true },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { title, description, scheduledEnd, parentTaskId, scheduledStart, vendorIds } =
    body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  if (!scheduledStart) {
    return NextResponse.json(
      { error: "Start time is required." },
      { status: 400 },
    );
  }

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
      taskVendors: vendorIdList.length > 0
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
