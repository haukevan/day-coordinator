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

  const root = await prisma.task.findUnique({
    where: { id: taskId },
    select: { eventId: true, scheduledEnd: true },
  });
  if (!root?.scheduledEnd) return;

  // Use pre-delay end time for gap calculation (end may already be extended)
  const preDelayEndMs = root.scheduledEnd.getTime() - delayMs;

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

  const queue: Array<{
    parentId: string;
    preDelayParentEndMs: number;
    remainingMs: number;
  }> = [
    {
      parentId: taskId,
      preDelayParentEndMs: preDelayEndMs,
      remainingMs: delayMs,
    },
  ];

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) continue;

    for (const child of childrenByParent.get(node.parentId) ?? []) {
      // Manual overrides break the propagation chain, including its subtree.
      if (child.manualOverride) continue;
      if (!child.scheduledStart) continue;

      // Calculate the gap between original parent end and child start
      const gapMs = child.scheduledStart.getTime() - node.preDelayParentEndMs;

      if (gapMs >= node.remainingMs) {
        // Gap fully absorbs the delay — child doesn't move, nothing propagates
        continue;
      }

      // Gap partially absorbs; remaining delay pushes the child
      const overflowMs = node.remainingMs - gapMs;
      const newStart = new Date(child.scheduledStart.getTime() + overflowMs);
      let newEnd: Date | null = null;
      if (child.scheduledEnd) {
        newEnd = new Date(child.scheduledEnd.getTime() + overflowMs);
      } else if (child.durationMins != null) {
        newEnd = new Date(newStart.getTime() + child.durationMins * 60_000);
      }

      updates.push({
        id: child.id,
        scheduledStart: newStart,
        scheduledEnd: newEnd,
      });

      // Grandchildren are measured against the child's pre-delay end.
      const childPreDelayEndMs =
        child.scheduledEnd?.getTime() ??
        (child.durationMins != null
          ? child.scheduledStart.getTime() + child.durationMins * 60_000
          : child.scheduledStart.getTime());

      queue.push({
        parentId: child.id,
        preDelayParentEndMs: childPreDelayEndMs,
        remainingMs: overflowMs,
      });
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
 * Only affects tasks where actualStart IS NULL (not yet started); manual
 * overrides and subtrees beneath them are left alone.
 */
async function pullBackUnstartedDescendants(taskId: string): Promise<void> {
  const root = await prisma.task.findUnique({
    where: { id: taskId },
    select: { eventId: true, scheduledEnd: true },
  });
  if (!root?.scheduledEnd) return;

  const tasks = await prisma.task.findMany({
    where: { eventId: root.eventId },
    select: {
      id: true,
      parentTaskId: true,
      scheduledStart: true,
      scheduledEnd: true,
      durationMins: true,
      manualOverride: true,
      actualStart: true,
    },
  });

  const taskById = new Map(tasks.map((task) => [task.id, task]));
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

    const parentEnd = taskById.get(parentId)?.scheduledEnd ?? null;
    if (!parentEnd) continue;

    for (const child of childrenByParent.get(parentId) ?? []) {
      if (child.manualOverride) continue;
      if (child.actualStart) continue;

      const newStart = parentEnd;
      const newEnd =
        child.durationMins != null
          ? new Date(newStart.getTime() + child.durationMins * 60_000)
          : null;

      updates.push({
        id: child.id,
        scheduledStart: newStart,
        scheduledEnd: newEnd,
      });

      // Keep the in-memory graph in sync so grandchildren use the new end.
      child.scheduledStart = newStart;
      child.scheduledEnd = newEnd;
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
