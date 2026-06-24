import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import {
  canManageEvent,
  isVendorAssignedToSubTask,
} from "@/lib/db/permissions";
import { emitEventUpdate } from "@/lib/realtime";
import { z } from "zod";

type Params = {
  params: Promise<{ eventId: string; taskId: string; subTaskId: string }>;
};

const updateSubTaskSchema = z.object({
  title: z.string().min(1).max(256).optional(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]).optional(),
  vendorIds: z.array(z.string()).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const vendorUpdateSchema = z.object({
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]),
});

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  const { eventId, taskId, subTaskId } = await params;

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

  // Verify sub-task exists and belongs to the task & event
  const subTask = await prisma.subTask.findFirst({
    where: { id: subTaskId, taskId, task: { eventId } },
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
  if (!subTask)
    return NextResponse.json(
      { error: "Checklist item not found" },
      { status: 404 },
    );

  // Permission: event owner or coordinator can update anything
  const canManage = await canManageEvent(eventId, dbUser.id);

  // Accepted vendor assigned to THIS specific sub-task can update status
  const isAssignedToSubTask = await isVendorAssignedToSubTask(
    subTaskId,
    dbUser.id,
  );

  if (!canManage && !isAssignedToSubTask) {
    return NextResponse.json(
      {
        error:
          "You don't have access to update this checklist item. Only vendors assigned to it can change its status.",
      },
      { status: 403 },
    );
  }

  // ARCHIVED events are read-only — only allow status reads
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

  const body = await req.json();

  // If user is only a vendor (not admin/coordinator), restrict to status-only
  if (!canManage) {
    const vendorParsed = vendorUpdateSchema.safeParse(body);
    if (!vendorParsed.success) {
      return NextResponse.json(
        {
          error:
            "Vendors can only update checklist item status. Valid statuses: NOT_STARTED, IN_PROGRESS, COMPLETED",
        },
        { status: 422 },
      );
    }
    const { status } = vendorParsed.data;

    // Always track who changed the status
    const changedByName =
      [dbUser.firstName, dbUser.lastName].filter(Boolean).join(" ") ||
      dbUser.email;

    await prisma.subTask.update({
      where: { id: subTaskId },
      data: {
        status,
        completedById: dbUser.id,
        completedByName: changedByName,
      },
    });

    await prisma.activityLog.create({
      data: {
        eventId,
        userId: dbUser.id,
        taskId,
        subTaskId,
        action: "subtask.status_changed",
        metadata: {
          subTaskId,
          oldStatus: subTask.status,
          newStatus: status,
          changedBy: dbUser.id,
          changedByName,
        },
      },
    });

    await emitEventUpdate(eventId, "subtask.updated", {
      eventId,
      taskId,
      subTaskId,
      subTask: {
        ...subTask,
        status,
        completedById: dbUser.id,
        completedByName: changedByName,
      },
    });

    return NextResponse.json({
      subTask: {
        ...subTask,
        status,
        completedById: dbUser.id,
        completedByName: changedByName,
      },
    });
  }

  // Admin/coordinator: full update capability
  const parsed = updateSubTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const { title, status, vendorIds, sortOrder } = parsed.data;

  // Track changed fields for ActivityLog
  const changes: string[] = [];

  const updateData: Record<string, unknown> = {};
  if (title !== undefined) {
    updateData.title = title.trim();
    changes.push("title");
  }
  if (status !== undefined) {
    updateData.status = status;
    changes.push("status");

    // Always track who last changed the status
    updateData.completedById = dbUser.id;
    updateData.completedByName =
      [dbUser.firstName, dbUser.lastName].filter(Boolean).join(" ") ||
      dbUser.email;
  }
  if (sortOrder !== undefined) {
    updateData.sortOrder = sortOrder;
    changes.push("sortOrder");
  }

  // Sync vendor assignments if provided
  let vendorUpdate: object = {};
  if (vendorIds !== undefined) {
    // Validate vendor IDs are from parent task's vendor list
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
    vendorUpdate = {
      subTaskVendors: {
        deleteMany: {},
        create: vendorIds.map((eventVendorId) => ({ eventVendorId })),
      },
    };
    changes.push("vendors");
  }

  await prisma.subTask.update({
    where: { id: subTaskId },
    data: { ...updateData, ...vendorUpdate },
  });

  // Determine action type
  const isStatusChange = status !== undefined && status !== subTask.status;
  const action = isStatusChange ? "subtask.status_changed" : "subtask.updated";

  await prisma.activityLog.create({
    data: {
      eventId,
      userId: dbUser.id,
      taskId,
      subTaskId,
      action,
      metadata: {
        subTaskId,
        changes,
        ...(isStatusChange
          ? {
              oldStatus: subTask.status,
              newStatus: status,
              changedBy: dbUser.id,
            }
          : {}),
      },
    },
  });

  // Fetch fresh sub-task with vendors and completedBy
  const fresh = await prisma.subTask.findUnique({
    where: { id: subTaskId },
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

  await emitEventUpdate(eventId, "subtask.updated", {
    eventId,
    taskId,
    subTaskId,
    subTask: fresh,
  });

  return NextResponse.json({ subTask: fresh });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { eventId, taskId, subTaskId } = await params;

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

  // Only admins and coordinators can delete sub-tasks
  const allowed = await canManageEvent(eventId, dbUser.id);
  if (!allowed)
    return NextResponse.json(
      { error: "Only coordinators can delete checklist items." },
      { status: 403 },
    );

  // ARCHIVED events are read-only
  const event = await prisma.event.findFirst({
    where: { id: eventId },
    select: { status: true },
  });
  if (event?.status === "ARCHIVED") {
    return NextResponse.json(
      { error: "Cannot delete checklist items from an archived event." },
      { status: 422 },
    );
  }

  // Verify checklist item exists and belongs to the task & event
  const subTask = await prisma.subTask.findFirst({
    where: { id: subTaskId, taskId, task: { eventId } },
    select: { id: true, title: true },
  });
  if (!subTask)
    return NextResponse.json(
      { error: "Checklist item not found" },
      { status: 404 },
    );

  // Cascade delete will handle SubTaskVendor records via onDelete: Cascade
  await prisma.subTask.delete({ where: { id: subTaskId } });

  await prisma.activityLog.create({
    data: {
      eventId,
      userId: dbUser.id,
      taskId,
      action: "subtask.deleted",
      metadata: { subTaskId, title: subTask.title },
    },
  });

  await emitEventUpdate(eventId, "subtask.deleted", {
    eventId,
    taskId,
    subTaskId,
  });

  return NextResponse.json({ deleted: true });
}
