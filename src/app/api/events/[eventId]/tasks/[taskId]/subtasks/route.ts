import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { canManageEvent, isVendorAssignedToTask } from "@/lib/db/permissions";
import { emitEventUpdate } from "@/lib/realtime";
import { z } from "zod";

type Params = { params: Promise<{ eventId: string; taskId: string }> };

const createSubTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(256),
  vendorIds: z.array(z.string()).optional().default([]),
});

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
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

  // Verify task belongs to event
  const task = await prisma.task.findFirst({
    where: { id: taskId, eventId },
    select: { id: true },
  });
  if (!task)
    return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // Permission: event owner, coordinator, OR accepted vendor assigned to this task
  const canManage = await canManageEvent(eventId, dbUser.id);
  const isAssignedVendor = await isVendorAssignedToTask(taskId, dbUser.id);

  if (!canManage && !isAssignedVendor) {
    return NextResponse.json(
      { error: "You don't have access to checklist items for this task." },
      { status: 403 },
    );
  }

  const subTasks = await prisma.subTask.findMany({
    where: { taskId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      subTaskVendors: {
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
      completedBy: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
  });

  return NextResponse.json({ subTasks });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

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

  // Only admins and coordinators can create sub-tasks
  const allowed = await canManageEvent(eventId, dbUser.id);
  if (!allowed)
    return NextResponse.json(
      { error: "Only coordinators can create checklist items." },
      { status: 403 },
    );

  // ARCHIVED events are read-only
  const event = await prisma.event.findFirst({
    where: { id: eventId },
    select: { status: true },
  });
  if (event?.status === "ARCHIVED") {
    return NextResponse.json(
      { error: "Cannot modify checklist items in an archived event." },
      { status: 422 },
    );
  }

  // Verify task belongs to event
  const task = await prisma.task.findFirst({
    where: { id: taskId, eventId },
    select: { id: true },
  });
  if (!task)
    return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const body = await req.json();
  const parsed = createSubTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const { title, vendorIds } = parsed.data;

  // If vendor IDs are provided, validate they come from the parent task's vendor list
  if (vendorIds.length > 0) {
    const parentTaskVendors = await prisma.taskVendor.findMany({
      where: { taskId },
      select: { eventVendorId: true },
    });
    const parentVendorIds = new Set(
      parentTaskVendors.map((tv) => tv.eventVendorId),
    );
    const invalidIds = vendorIds.filter((id) => !parentVendorIds.has(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        {
          error:
            "Checklist item vendors must be selected from the parent task's vendor list.",
        },
        { status: 422 },
      );
    }
  }

  // Get next sortOrder
  const maxSort = await prisma.subTask.aggregate({
    where: { taskId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;

  const subTask = await prisma.subTask.create({
    data: {
      taskId,
      title: title.trim(),
      sortOrder,
      subTaskVendors:
        vendorIds.length > 0
          ? {
              createMany: {
                data: vendorIds.map((eventVendorId) => ({ eventVendorId })),
              },
            }
          : undefined,
    },
    include: {
      subTaskVendors: {
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

  await prisma.activityLog.create({
    data: {
      eventId,
      userId: dbUser.id,
      taskId,
      subTaskId: subTask.id,
      action: "subtask.created",
      metadata: { title: subTask.title },
    },
  });

  await emitEventUpdate(eventId, "subtask.created", {
    eventId,
    taskId,
    subTaskId: subTask.id,
    subTask,
  });

  return NextResponse.json({ subTask }, { status: 201 });
}
