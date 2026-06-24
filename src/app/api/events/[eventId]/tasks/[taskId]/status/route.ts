import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { canActOnTask } from "@/lib/db/permissions";
import { emitEventUpdate } from "@/lib/realtime";
import { reconcileDelay } from "@/lib/scheduler/delay";
import { z } from "zod";

type Params = { params: Promise<{ eventId: string; taskId: string }> };

const updateTaskStatusSchema = z.object({
  status: z.enum(["IN_PROGRESS", "COMPLETED", "PENDING"]),
  actualEnd: z.string().datetime().optional().nullable(),
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
    select: { id: true, status: true, liveStartedAt: true },
  });
  if (!event)
    return NextResponse.json({ error: "Event not found" }, { status: 404 });

  if (event.status !== "LIVE") {
    return NextResponse.json(
      { error: "Task status can only be changed during live mode." },
      { status: 422 },
    );
  }

  // Permission check: owner, coordinator, or assigned vendor
  const allowed = await canActOnTask(eventId, taskId, dbUser.id);
  if (!allowed)
    return NextResponse.json(
      { error: "You don't have permission to update this task's status." },
      { status: 403 },
    );

  // Fetch task
  const task = await prisma.task.findFirst({
    where: { id: taskId, eventId },
  });
  if (!task)
    return NextResponse.json({ error: "Task not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateTaskStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  const { status: targetStatus, actualEnd: rawActualEnd } = parsed.data;

  // ── Transition to IN_PROGRESS ──────────────────────────────────────────
  if (targetStatus === "IN_PROGRESS") {
    if (task.status === "COMPLETED" || task.status === "SKIPPED") {
      return NextResponse.json(
        { error: `Cannot start a ${task.status.toLowerCase()} task.` },
        { status: 422 },
      );
    }

    // Check if task is blocked by an uncompleted parent
    if (task.parentTaskId) {
      const parent = await prisma.task.findUnique({
        where: { id: task.parentTaskId },
        select: { status: true },
      });
      if (parent && parent.status !== "COMPLETED") {
        return NextResponse.json(
          { error: "This task is blocked by an uncompleted dependency." },
          { status: 422 },
        );
      }
    }

    const now = new Date();
    const isFirstStart = !task.actualStart;

    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "IN_PROGRESS",
        actualStart: isFirstStart ? now : task.actualStart,
      },
    });

    // Auto-trigger event LIVE if this is the first task start
    if (event.status !== "LIVE" || !event.liveStartedAt) {
      await prisma.event.update({
        where: { id: eventId },
        data: { status: "LIVE", liveStartedAt: now },
      });
      await prisma.activityLog.create({
        data: {
          eventId,
          userId: dbUser.id,
          action: "event.live_started",
          metadata: { triggeredByTask: taskId, taskTitle: task.title },
        },
      });
      await emitEventUpdate(eventId, "event.live_started", {
        eventId,
        status: "LIVE",
        liveStartedAt: now.toISOString(),
      });
    }

    await prisma.activityLog.create({
      data: {
        eventId,
        userId: dbUser.id,
        taskId,
        action: "task.started",
        metadata: {
          actualStart: now.toISOString(),
          previousStatus: task.status,
        },
      },
    });

    await emitEventUpdate(eventId, "task.started", {
      eventId,
      taskId,
      actualStart: now.toISOString(),
      status: "IN_PROGRESS",
    });

    return NextResponse.json({
      task: {
        id: taskId,
        status: "IN_PROGRESS",
        actualStart: now.toISOString(),
      },
    });
  }

  // ── Transition to COMPLETED ────────────────────────────────────────────
  if (targetStatus === "COMPLETED") {
    if (task.status === "COMPLETED" || task.status === "SKIPPED") {
      return NextResponse.json(
        { error: "This task is already completed or skipped." },
        { status: 422 },
      );
    }

    const now = new Date();
    let actualEnd: Date = now;

    // For delayed tasks, allow specifying when it was actually completed
    if (task.status === "DELAYED" && rawActualEnd) {
      const parsed = new Date(rawActualEnd);
      if (!Number.isNaN(parsed.getTime()) && parsed <= now) {
        actualEnd = parsed;
      }
    }

    // For tasks that were never started, set actualStart to actualEnd
    const needsActualStart = !task.actualStart;

    const updateData: Record<string, unknown> = {
      status: "COMPLETED",
      actualEnd,
    };
    if (needsActualStart) {
      updateData.actualStart = actualEnd;
    }

    // Reconcile delay if task was delayed
    if (task.status === "DELAYED" && task.delayAmountMins != null) {
      await reconcileDelay(taskId, actualEnd);
      // Keep delayAmountMins so the UI can show delay history
    }

    await prisma.task.update({
      where: { id: taskId },
      data: updateData,
    });

    await prisma.activityLog.create({
      data: {
        eventId,
        userId: dbUser.id,
        taskId,
        action: "task.completed",
        metadata: {
          actualEnd: actualEnd.toISOString(),
          actualStart: needsActualStart
            ? actualEnd.toISOString()
            : task.actualStart?.toISOString(),
          previousStatus: task.status,
          wasDelayed: task.status === "DELAYED",
          delayAmountMins: task.delayAmountMins,
        },
      },
    });

    await emitEventUpdate(eventId, "task.completed", {
      eventId,
      taskId,
      actualEnd: actualEnd.toISOString(),
      status: "COMPLETED",
    });

    return NextResponse.json({
      task: {
        id: taskId,
        status: "COMPLETED",
        actualEnd: actualEnd.toISOString(),
        actualStart: needsActualStart
          ? actualEnd.toISOString()
          : task.actualStart?.toISOString(),
      },
    });
  }

  // ── Reset to PENDING ──────────────────────────────────────────────────
  if (targetStatus === "PENDING") {
    if (task.status === "PENDING") {
      return NextResponse.json(
        { error: "Task is already pending." },
        { status: 422 },
      );
    }

    // If removing delay, also pull back descendants
    if (task.status === "DELAYED" && task.delayAmountMins != null) {
      await reconcileDelay(taskId, new Date()); // reconcile with "now" — full pullback
    }

    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "PENDING",
        actualStart: null,
        actualEnd: null,
        delayAmountMins: null,
      },
    });

    await prisma.activityLog.create({
      data: {
        eventId,
        userId: dbUser.id,
        taskId,
        action: "task.updated",
        metadata: {
          reset: true,
          previousStatus: task.status,
          clearedActualStart: !!task.actualStart,
          clearedActualEnd: !!task.actualEnd,
        },
      },
    });

    await emitEventUpdate(eventId, "task.updated", {
      eventId,
      taskId,
      status: "PENDING",
      reset: true,
    });

    return NextResponse.json({
      task: {
        id: taskId,
        status: "PENDING",
        actualStart: null,
        actualEnd: null,
        delayAmountMins: null,
      },
    });
  }

  return NextResponse.json({ error: "Invalid status" }, { status: 400 });
}
