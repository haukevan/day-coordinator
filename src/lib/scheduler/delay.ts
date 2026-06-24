/**
 * Delay propagation and reconciliation logic for live mode.
 *
 * - propagateDelay: pushes descendants forward by the delay amount, but
 *   gaps between tasks absorb the delay first. Only excess delay beyond
 *   the gap pushes the next task.
 * - reconcileDelay: when a delayed task completes, calculates actual delay vs
 *   specified delay and pulls back unstarted descendants by the unused portion.
 */

import { prisma } from "@/lib/db/prisma";

/**
 * Push descendants forward by delayMinutes, letting gaps between
 * parent.scheduledEnd and child.scheduledStart absorb the delay.
 *
 * Example: Task A ends 9:00, Task B starts 9:15 (15 min gap).
 *   A delayed 15 min → B stays at 9:15 (gap absorbs it).
 *   A delayed 30 min → B moves to 9:30 (15 min gap + 15 min push).
 */
export async function propagateDelay(
  taskId: string,
  delayMinutes: number,
): Promise<void> {
  const delayMs = delayMinutes * 60 * 1000;

  // Negative delay = pull back (remove/adjust delay downward)
  if (delayMs < 0) {
    await pullBackUnstartedDescendants(taskId);
    return;
  }

  if (delayMs === 0) return;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { scheduledEnd: true, durationMins: true },
  });
  if (!task?.scheduledEnd) return;

  // Use pre-delay end time for gap calculation (end may already be extended)
  const preDelayEndMs = task.scheduledEnd.getTime() - delayMs;

  const children = await prisma.task.findMany({
    where: { parentTaskId: taskId },
    select: {
      id: true,
      scheduledStart: true,
      scheduledEnd: true,
      durationMins: true,
    },
  });

  for (const child of children) {
    // Calculate the gap between original parent end and child start
    const gapMs = child.scheduledStart
      ? child.scheduledStart.getTime() - preDelayEndMs
      : 0;

    if (gapMs >= delayMs) {
      // Gap fully absorbs the delay — child doesn't move, nothing to propagate
      continue;
    }

    // Gap partially absorbs; remaining delay pushes the child
    const remainingMs = delayMs - gapMs;

    const newStart = child.scheduledStart
      ? new Date(child.scheduledStart.getTime() + remainingMs)
      : task.scheduledEnd; // already extended, no extra offset needed

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

    // Recurse with the remaining delay (only what actually pushed this child)
    await propagateDelay(child.id, remainingMs);
  }
}

/**
 * Reconcile a delayed task's completion.
 *
 * Calculates the actual delay (actualEnd - originalScheduledEnd) and compares
 * it with the specified delayAmountMins. If the actual delay was shorter than
 * specified, unstarted descendants are pulled back by the unused portion.
 *
 * Started descendants keep their current schedule to avoid conflicts.
 */
export async function reconcileDelay(
  taskId: string,
  actualEnd: Date,
): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      scheduledEnd: true,
      delayAmountMins: true,
    },
  });

  if (!task?.delayAmountMins || !task.scheduledEnd) return;

  const delayMs = task.delayAmountMins * 60 * 1000;
  // The original scheduled end before the delay was applied
  const originalEndMs = task.scheduledEnd.getTime() - delayMs;
  // How long the task actually overran its original end
  const actualDelayMs = actualEnd.getTime() - originalEndMs;
  // How much of the specified delay was unused
  const unusedDelayMs = delayMs - actualDelayMs;

  // If there's unused delay, pull back unstarted descendants
  if (unusedDelayMs > 0) {
    await pullBackUnstartedDescendants(taskId);
  }
}

/**
 * Pull back unstarted descendants to tight scheduling (child start = parent end).
 * Used when a delay is removed — resets the chain to its natural position.
 * Only affects tasks where actualStart IS NULL (not yet started).
 */
async function pullBackUnstartedDescendants(taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { scheduledEnd: true },
  });
  if (!task?.scheduledEnd) return;

  const children = await prisma.task.findMany({
    where: { parentTaskId: taskId },
    select: { id: true, actualStart: true, durationMins: true },
  });

  for (const child of children) {
    if (child.actualStart) continue;

    const newStart = task.scheduledEnd;
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

    await pullBackUnstartedDescendants(child.id);
  }
}

/**
 * Get tasks that are overdue in a live event.
 * Returns tasks where status is PENDING or IN_PROGRESS, scheduledEnd has
 * passed, and the event is LIVE.
 */
export async function getOverdueTasks(eventId: string) {
  const now = new Date();

  return prisma.task.findMany({
    where: {
      eventId,
      status: { in: ["PENDING", "IN_PROGRESS"] },
      scheduledEnd: { lt: now },
      event: { status: "LIVE" },
    },
    select: {
      id: true,
      title: true,
      status: true,
      scheduledEnd: true,
      scheduledStart: true,
    },
    orderBy: { scheduledEnd: "asc" },
  });
}
