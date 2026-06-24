/**
 * Live status computation — determines day-of task status labels.
 *
 * During live mode, tasks are labeled:
 *   - "Up next": all tasks in the first unblocked dependency chain
 *   - "Ready": other unblocked PENDING tasks
 *   - "In progress": IN_PROGRESS
 *   - "Delayed": DELAYED
 *   - "Done": COMPLETED
 *   - SKIPPED: hidden or shown as skipped
 */

import type { SerializedTask } from "@/lib/types";

export type LiveStatus =
  | "up-next"
  | "ready"
  | "in-progress"
  | "delayed"
  | "done"
  | "skipped";

export interface TaskWithLiveStatus extends SerializedTask {
  liveStatus: LiveStatus;
  isOverdue: boolean;
}

/**
 * Compute live statuses for a list of tasks during LIVE mode.
 * Returns tasks with attached liveStatus and isOverdue flags.
 *
 * "Up next" includes the entire dependency chain of the first unblocked
 * PENDING root task — because all tasks in that chain must execute in order.
 */
export function computeLiveStatuses(
  tasks: SerializedTask[],
): TaskWithLiveStatus[] {
  const now = new Date();
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  // Build a set of completed task IDs for blocker resolution
  const completedIds = new Set(
    tasks.filter((t) => t.status === "COMPLETED").map((t) => t.id),
  );

  // A task is unblocked if it has no parent or its parent is completed
  function isUnblocked(task: SerializedTask): boolean {
    if (!task.parentTaskId) return true;
    return completedIds.has(task.parentTaskId);
  }

  // Find root tasks (no parent or parent not in this task list) that are
  // PENDING and unblocked, sorted by scheduledStart
  const unblockedPendingRoots = tasks
    .filter((t) => {
      if (t.status !== "PENDING") return false;
      if (!isUnblocked(t)) return false;
      // Only consider root tasks (no parent or parent is completed)
      if (t.parentTaskId && !completedIds.has(t.parentTaskId)) return false;
      return true;
    })
    .filter((t) => {
      // A root is a task whose parent is not in the list or is completed
      const parent = t.parentTaskId ? taskById.get(t.parentTaskId) : null;
      return !parent || parent.status === "COMPLETED";
    })
    .sort((a, b) => {
      const aStart = a.scheduledStart
        ? new Date(a.scheduledStart).getTime()
        : Infinity;
      const bStart = b.scheduledStart
        ? new Date(b.scheduledStart).getTime()
        : Infinity;
      if (aStart !== bStart) return aStart - bStart;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  // Build the set of "up next" task IDs: the first root chain
  const upNextIds = new Set<string>();
  if (unblockedPendingRoots.length > 0) {
    const root = unblockedPendingRoots[0];
    // Walk down the chain: root → children → grandchildren
    function collectChain(taskId: string) {
      upNextIds.add(taskId);
      const children = tasks.filter((t) => t.parentTaskId === taskId);
      for (const child of children) {
        collectChain(child.id);
      }
    }
    collectChain(root.id);
  }

  return tasks.map((task) => {
    let liveStatus: LiveStatus;
    switch (task.status) {
      case "PENDING":
        if (upNextIds.has(task.id)) {
          liveStatus = "up-next";
        } else {
          liveStatus = isUnblocked(task) ? "ready" : "ready"; // blocked still "ready" visually, lock icon shown separately
        }
        break;
      case "IN_PROGRESS":
        liveStatus = "in-progress";
        break;
      case "DELAYED":
        liveStatus = "delayed";
        break;
      case "COMPLETED":
        liveStatus = "done";
        break;
      case "SKIPPED":
        liveStatus = "skipped";
        break;
      default:
        liveStatus = "ready";
    }

    const isOverdue =
      (task.status === "PENDING" || task.status === "IN_PROGRESS") &&
      !!task.scheduledEnd &&
      new Date(task.scheduledEnd) < now;

    return { ...task, liveStatus, isOverdue };
  });
}

/**
 * Determine if a task is blocked (has an uncompleted parent).
 */
export function isTaskBlocked(
  task: SerializedTask,
  allTasks: SerializedTask[],
): boolean {
  if (!task.parentTaskId) return false;
  const parent = allTasks.find((t) => t.id === task.parentTaskId);
  if (!parent) return false;
  return parent.status !== "COMPLETED";
}
