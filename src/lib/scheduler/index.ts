/**
 * Scheduler — all scheduling computation lives here.
 *
 * Rules:
 * - scheduledStart of a task = scheduledEnd of its parent (if parent exists)
 * - scheduledEnd = scheduledStart + durationMins
 * - Propagation is delta-based and gap-aware: when a parent's end shifts,
 *   gaps between parent end and child start absorb the change first.
 *   Only the overflow beyond the gap pushes the child.
 * - When deltaMs is omitted (new task / parent change), children are
 *   set to start at the parent's end (tight scheduling, no gaps).
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
 * When deltaMs is provided (parent's end shifted), gaps between parent end
 * and child start absorb the change. Only overflow beyond the gap pushes
 * the child and recurses downstream.
 *
 * When deltaMs is omitted (new task, parent change), children are set to
 * start at the parent's end.
 */
export async function propagateSchedule(
  taskId: string,
  deltaMs?: number,
): Promise<void> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || !task.scheduledEnd) return;

  const children = await prisma.task.findMany({
    where: { parentTaskId: taskId },
  });

  for (const child of children) {
    let newStart: Date;
    let overflowMs: number | undefined; // amount to propagate further

    if (deltaMs !== undefined) {
      // Parent's end shifted by deltaMs. Calculate gap and absorb.
      const oldParentEnd = task.scheduledEnd.getTime() - deltaMs;
      const gapMs = child.scheduledStart
        ? child.scheduledStart.getTime() - oldParentEnd
        : 0;

      if (deltaMs <= gapMs) {
        // Gap fully absorbs the change — child stays put, nothing propagates
        continue;
      }

      // Only the overflow beyond the gap pushes the child
      overflowMs = deltaMs - gapMs;
      newStart = child.scheduledStart
        ? new Date(child.scheduledStart.getTime() + overflowMs)
        : task.scheduledEnd;
    } else {
      // No delta: tight scheduling — child starts at parent end
      newStart = task.scheduledEnd;
    }

    const newEnd =
      child.durationMins != null
        ? new Date(newStart.getTime() + child.durationMins * 60 * 1000)
        : null;

    await prisma.task.update({
      where: { id: child.id },
      data: {
        scheduledStart: newStart,
        ...(newEnd ? { scheduledEnd: newEnd } : {}),
      },
    });

    // Recurse with the overflow (or undefined for tight scheduling)
    await propagateSchedule(child.id, overflowMs);
  }
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
