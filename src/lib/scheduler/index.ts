/**
 * Scheduler — all scheduling computation lives here.
 *
 * Rules:
 * - scheduledStart of a task = scheduledEnd of its parent (if parent exists)
 * - scheduledEnd = scheduledStart + durationMins
 * - Propagation is delta-based: when a parent's end shifts by +X min, all
 *   descendants shift by +X min, preserving any buffers the user set.
 * - manualOverride is no longer used; propagation always cascades.
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
 *
 * When deltaMs is provided, every descendant is shifted by that many
 * milliseconds, preserving any buffer the user set between parent end
 * and child start.  When deltaMs is omitted (e.g. for new tasks),
 * children are set to start at the parent's end.
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
    // Always propagate — buffers are preserved via delta shifting.
    let newStart: Date;
    if (deltaMs !== undefined && child.scheduledStart) {
      newStart = new Date(child.scheduledStart.getTime() + deltaMs);
    } else {
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

    // Recurse with the same delta so grandchildren also shift.
    await propagateSchedule(child.id, deltaMs);
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
