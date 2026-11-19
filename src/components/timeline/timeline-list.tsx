import { TaskCard } from "./task-card";
import { buildDependencyGroupMeta } from "./dependency-groups";
import type { SerializedTask } from "@/lib/types";
import type { LiveStatus } from "@/lib/scheduler/live-status";

/**
 * Sort every task chronologically by scheduled start (unscheduled tasks last),
 * then by creation time. Depth is derived from the parent chain so dependent
 * tasks stay indented without breaking global time order.
 */
function buildSortedList(
  tasks: SerializedTask[],
): { task: SerializedTask; depth: number }[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  const startMs = (task: SerializedTask) =>
    task.scheduledStart ? new Date(task.scheduledStart).getTime() : null;

  const sorted = [...tasks].sort((a, b) => {
    const aStart = startMs(a);
    const bStart = startMs(b);

    if (aStart !== null && bStart !== null && aStart !== bStart) {
      return aStart - bStart;
    }
    if (aStart !== null && bStart === null) return -1;
    if (aStart === null && bStart !== null) return 1;

    const aCreated = new Date(a.createdAt).getTime();
    const bCreated = new Date(b.createdAt).getTime();
    if (aCreated !== bCreated) return aCreated - bCreated;

    return a.title.localeCompare(b.title);
  });

  function depthOf(task: SerializedTask): number {
    let depth = 0;
    let current: SerializedTask | undefined = task;
    const seen = new Set<string>();

    while (
      current?.parentTaskId &&
      taskById.has(current.parentTaskId) &&
      !seen.has(current.id)
    ) {
      seen.add(current.id);
      depth += 1;
      current = taskById.get(current.parentTaskId);
    }

    return depth;
  }

  return sorted.map((task) => ({ task, depth: depthOf(task) }));
}

export function TimelineList({
  tasks,
  timezone,
  eventDate,
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
  eventDate?: string | null;
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
              eventDate={eventDate}
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
