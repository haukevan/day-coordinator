/**
 * Scheduler — all scheduling computation lives here.
 *
 * Rules:
 * - scheduledStart of a task = scheduledEnd of its parent (if parent exists)
 * - scheduledEnd = scheduledStart + durationMins
 * - manualOverride = true → stop propagation to children
 * - Delays propagate downstream unless child has manualOverride = true
 */

import { prisma } from "@/lib/db/prisma";

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
 * Skips subtrees rooted at tasks with manualOverride = true.
 */
export async function propagateSchedule(taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || !task.scheduledEnd) return;

  const children = await prisma.task.findMany({
    where: { parentTaskId: taskId },
  });

  for (const child of children) {
    if (child.manualOverride) continue; // break propagation chain

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

    await propagateSchedule(child.id);
  }
}

/**
 * Compute and persist scheduledEnd for a task from its start + duration.
 */
export async function computeScheduledEnd(taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || !task.scheduledStart || !task.durationMins) return;

  const scheduledEnd = new Date(
    task.scheduledStart.getTime() + task.durationMins * 60 * 1000
  );
  await prisma.task.update({ where: { id: taskId }, data: { scheduledEnd } });
}
