/**
 * Scheduler — all scheduling computation lives here.
 *
 * Rules:
 * - scheduledStart of a task = scheduledEnd of its parent (if parent exists)
 * - scheduledEnd = scheduledStart + durationMins
 * - Propagation is delta-preserving: when a task's end shifts, every
 *   descendant shifts by the same delta so planned buffers are kept.
 *   Negative deltas pull descendants back.
 * - Subtrees rooted at a task with manualOverride = true are skipped.
 * - There is no implicit propagation: creating a task or changing its
 *   parent never repositions existing tasks.
 */

import { prisma } from "@/lib/db/prisma";
import { emitEventUpdate } from "@/lib/realtime";

/**
 * Detect a circular dependency. Returns true if adding proposedParentId as the
 * parent of taskId would create a cycle. Walks up the ancestor chain from
 * proposedParentId and returns true if taskId is encountered.
 */
export async function detectCycle(
  taskId: string,
  proposedParentId: string,
): Promise<boolean> {
  const visited = new Set<string>();
  let current: string | null = proposedParentId;

  while (current) {
    if (current === taskId) return true;
    if (visited.has(current)) return false;
    visited.add(current);

    const parent: { parentTaskId: string | null } | null =
      await prisma.task.findUnique({
        where: { id: current },
        select: { parentTaskId: true },
      });
    current = parent?.parentTaskId ?? null;
  }

  return false;
}

/**
 * Propagate a schedule change from a given task downward through the DAG.
 *
 * Every descendant moves by the same `deltaMs` the task itself moved, so
 * planned gaps (“buffers”) between tasks are preserved. Negative deltas pull
 * descendants back. Subtrees rooted at a `manualOverride` task are skipped,
 * and unscheduled tasks (no scheduledStart) are left untouched.
 *
 * Without a delta there is nothing to propagate.
 */
export async function propagateSchedule(
  taskId: string,
  deltaMs?: number,
): Promise<void> {
  if (!deltaMs) return;

  const root = await prisma.task.findUnique({
    where: { id: taskId },
    select: { eventId: true },
  });
  if (!root) return;

  // Load the event's tasks once, then walk the DAG in memory.
  const tasks = await prisma.task.findMany({
    where: { eventId: root.eventId },
    select: {
      id: true,
      parentTaskId: true,
      scheduledStart: true,
      scheduledEnd: true,
      durationMins: true,
      manualOverride: true,
    },
  });

  const childrenByParent = new Map<string, Array<(typeof tasks)[number]>>();
  for (const task of tasks) {
    if (!task.parentTaskId) continue;
    const siblings = childrenByParent.get(task.parentTaskId) ?? [];
    siblings.push(task);
    childrenByParent.set(task.parentTaskId, siblings);
  }

  const updates: Array<{
    id: string;
    scheduledStart: Date;
    scheduledEnd: Date | null;
  }> = [];
  const queue: string[] = [taskId];

  while (queue.length > 0) {
    const parentId = queue.shift();
    if (!parentId) continue;

    for (const child of childrenByParent.get(parentId) ?? []) {
      // Manual overrides break the propagation chain, including its subtree.
      if (child.manualOverride) continue;
      // Unscheduled tasks have no anchor to shift.
      if (!child.scheduledStart) continue;

      const newStart = new Date(child.scheduledStart.getTime() + deltaMs);
      let newEnd: Date | null = null;
      if (child.scheduledEnd) {
        newEnd = new Date(child.scheduledEnd.getTime() + deltaMs);
      } else if (child.durationMins != null) {
        newEnd = new Date(newStart.getTime() + child.durationMins * 60_000);
      }

      updates.push({
        id: child.id,
        scheduledStart: newStart,
        scheduledEnd: newEnd,
      });
      queue.push(child.id);
    }
  }

  if (updates.length === 0) return;

  await prisma.$transaction(
    updates.map((update) =>
      prisma.task.update({
        where: { id: update.id },
        data: {
          scheduledStart: update.scheduledStart,
          ...(update.scheduledEnd ? { scheduledEnd: update.scheduledEnd } : {}),
        },
      }),
    ),
  );
}

/**
 * Compute and persist scheduledEnd for a task from its start + duration.
 */
export async function computeScheduledEnd(taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || !task.scheduledStart || !task.durationMins) return;

  const scheduledEnd = new Date(
    task.scheduledStart.getTime() + task.durationMins * 60 * 1000,
  );
  await prisma.task.update({ where: { id: taskId }, data: { scheduledEnd } });
}

// ─── Event Status Reconciliation ─────────────────────────────────────────────

/**
 * Called on every event page load as a fallback when cron isn't configured.
 * Checks whether the event is overdue for an automatic status transition
 * and applies it silently. Returns the (possibly updated) event status.
 *
 * Transitions applied:
 *   SCHEDULED → LIVE   when eventDate has passed
 *   LIVE → ARCHIVED    when all tasks are terminal and 24h have elapsed
 *                       since the latest task's end time.
 */
export async function reconcileEventStatus(eventId: string): Promise<string> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, status: true, eventDate: true },
  });

  if (!event) return "DRAFT";

  const now = new Date();

  // ── SCHEDULED → LIVE ──────────────────────────────────────────────────
  if (
    event.status === "SCHEDULED" &&
    event.eventDate &&
    event.eventDate <= now
  ) {
    await prisma.event.update({
      where: { id: eventId },
      data: { status: "LIVE", liveStartedAt: now },
    });

    await prisma.activityLog.create({
      data: {
        eventId,
        action: "event.live_started",
        metadata: { from: "SCHEDULED", to: "LIVE", trigger: "page-load" },
      },
    });

    await emitEventUpdate(eventId, "event.live_started", {
      eventId,
      status: "LIVE",
    });

    return "LIVE";
  }

  // ── LIVE → ARCHIVED ───────────────────────────────────────────────────
  if (event.status === "LIVE") {
    const tasks = await prisma.task.findMany({
      where: { eventId },
      select: { id: true, status: true, actualEnd: true, scheduledEnd: true },
    });

    if (tasks.length === 0) return "LIVE";

    const allTerminal = tasks.every(
      (t) => t.status === "COMPLETED" || t.status === "SKIPPED",
    );

    if (allTerminal) {
      let latestEndMs = 0;
      for (const task of tasks) {
        const endMs = task.actualEnd
          ? task.actualEnd.getTime()
          : task.scheduledEnd
            ? task.scheduledEnd.getTime()
            : 0;
        if (endMs > latestEndMs) latestEndMs = endMs;
      }

      const ARCHIVE_AFTER_MS = 24 * 60 * 60 * 1000;
      if (latestEndMs > 0 && now.getTime() - latestEndMs >= ARCHIVE_AFTER_MS) {
        await prisma.event.update({
          where: { id: eventId },
          data: { status: "ARCHIVED" },
        });

        await prisma.activityLog.create({
          data: {
            eventId,
            action: "event.archived",
            metadata: {
              from: "LIVE",
              to: "ARCHIVED",
              trigger: "page-load",
              reason: "24h after last task ended",
            },
          },
        });

        await emitEventUpdate(eventId, "event.archived", {
          eventId,
          status: "ARCHIVED",
        });

        return "ARCHIVED";
      }
    }
  }

  return event.status;
}
