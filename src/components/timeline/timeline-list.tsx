import { TaskCard } from "./task-card";
import { buildDependencyGroupMeta } from "./dependency-groups";
import type { SerializedTask } from "@/lib/types";
import type { LiveStatus } from "@/lib/scheduler/live-status";

/** Build an ordered list that places children immediately after their parent,
 *  indented. Tasks without parents (roots) are sorted by scheduledStart then
 *  createdAt. Children are sorted the same way within each parent group. */
function buildSortedList(
  tasks: SerializedTask[],
): { task: SerializedTask; depth: number }[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const byParent = new Map<string | null, SerializedTask[]>();
  for (const task of tasks) {
    const key = task.parentTaskId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(task);
  }

  function sortGroup(group: SerializedTask[]): SerializedTask[] {
    return [...group].sort((a, b) => {
      if (a.scheduledStart && b.scheduledStart)
        return (
          new Date(a.scheduledStart).getTime() -
          new Date(b.scheduledStart).getTime()
        );
      if (a.scheduledStart) return -1;
      if (b.scheduledStart) return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  // Sort dependency chains by their first scheduled task (root or descendant).
  const chainStartMemo = new Map<string, number>();
  function getChainStartMs(taskId: string, seen = new Set<string>()): number {
    const memo = chainStartMemo.get(taskId);
    if (memo !== undefined) return memo;
    if (seen.has(taskId)) return Number.POSITIVE_INFINITY;

    seen.add(taskId);

    const task = taskById.get(taskId);
    let earliest = task?.scheduledStart
      ? new Date(task.scheduledStart).getTime()
      : Number.POSITIVE_INFINITY;

    const children = byParent.get(taskId) ?? [];
    for (const child of children) {
      const childEarliest = getChainStartMs(child.id, seen);
      if (childEarliest < earliest) earliest = childEarliest;
    }

    seen.delete(taskId);
    chainStartMemo.set(taskId, earliest);
    return earliest;
  }

  const result: { task: SerializedTask; depth: number }[] = [];

  function walk(parentId: string | null, depth: number) {
    const group = byParent.get(parentId) ?? [];
    for (const task of sortGroup(group)) {
      result.push({ task, depth });
      walk(task.id, depth + 1);
    }
  }

  const rootTasks = tasks.filter(
    (task) => !task.parentTaskId || !taskById.has(task.parentTaskId),
  );

  const sortedRoots = [...rootTasks].sort((a, b) => {
    const aStart = getChainStartMs(a.id);
    const bStart = getChainStartMs(b.id);

    if (aStart !== bStart) return aStart - bStart;

    const aCreated = new Date(a.createdAt).getTime();
    const bCreated = new Date(b.createdAt).getTime();
    return aCreated - bCreated;
  });

  for (const root of sortedRoots) {
    result.push({ task: root, depth: 0 });
    walk(root.id, 1);
  }

  // Append any tasks not reached (should not happen, but guard against cycles)
  const seen = new Set(result.map((r) => r.task.id));
  for (const task of sortGroup(tasks)) {
    if (!seen.has(task.id)) result.push({ task, depth: 0 });
  }

  return result;
}

export function TimelineList({
  tasks,
  timezone,
  onTaskClick,
  isLive = false,
  liveStatuses,
  canActMap,
  overdueIds,
  onOptimisticUpdate,
  onStatusChange,
}: {
  tasks: SerializedTask[];
  timezone: string;
  onTaskClick?: (task: SerializedTask) => void;
  /** Whether the event is in LIVE mode */
  isLive?: boolean;
  /** Map of taskId → LiveStatus for day-of labels */
  liveStatuses?: Map<string, LiveStatus>;
  /** Map of taskId → boolean for canAct permission */
  canActMap?: Map<string, boolean>;
  /** Set of overdue task IDs */
  overdueIds?: Set<string>;
  /** Optimistic local state update before API call */
  onOptimisticUpdate?: (
    taskId: string,
    changes: Partial<SerializedTask>,
  ) => void;
  /** Callback when a task status changes (silently refetches) */
  onStatusChange?: () => void;
}) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <p className="mb-1 text-sm font-medium text-foreground">No tasks yet</p>
        <p className="text-xs text-muted-foreground">
          Add your first task to start building the timeline.
        </p>
      </div>
    );
  }

  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const sorted = buildSortedList(tasks);
  const dependencyMetaByTask = buildDependencyGroupMeta(tasks);

  return (
    <div className="flex flex-col gap-2">
      {sorted.map(({ task, depth }) => {
        const dependencyMeta = dependencyMetaByTask.get(task.id);
        const parentId = task.parentTaskId;
        const parentTask = parentId ? taskMap.get(parentId) : undefined;
        const parentTitle = parentId
          ? (task.parentTask?.title ?? parentTask?.title ?? null)
          : null;
        const parentStatus = parentTask?.status ?? null;

        return (
          <div
            key={task.id}
            style={{
              paddingLeft:
                depth > 0 ? `${Math.min(depth, 1) * 20}px` : undefined,
            }}
          >
            <TaskCard
              task={task}
              timezone={timezone}
              parentTitle={parentTitle}
              parentStatus={parentStatus}
              dependencyMeta={dependencyMeta}
              onTaskClick={onTaskClick}
              isLive={isLive}
              liveStatus={liveStatuses?.get(task.id)}
              canAct={canActMap?.get(task.id) ?? false}
              isOverdue={overdueIds?.has(task.id) ?? false}
              showLiveButtons={isLive}
              onOptimisticUpdate={onOptimisticUpdate}
              onStatusChange={onStatusChange}
            />
          </div>
        );
      })}
    </div>
  );
}
