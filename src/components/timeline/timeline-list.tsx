import { TaskCard } from "./task-card";
import type { SerializedTask } from "@/lib/types";

/** Build an ordered list that places children immediately after their parent,
 *  indented. Tasks without parents (roots) are sorted by scheduledStart then
 *  createdAt. Children are sorted the same way within each parent group. */
function buildSortedList(
  tasks: SerializedTask[],
): { task: SerializedTask; depth: number }[] {
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

  const result: { task: SerializedTask; depth: number }[] = [];

  function walk(parentId: string | null, depth: number) {
    const group = byParent.get(parentId) ?? [];
    for (const task of sortGroup(group)) {
      result.push({ task, depth });
      walk(task.id, depth + 1);
    }
  }

  walk(null, 0);

  // Append any tasks not reached (should not happen, but guard against cycles)
  const seen = new Set(result.map((r) => r.task.id));
  for (const task of tasks) {
    if (!seen.has(task.id)) result.push({ task, depth: 0 });
  }

  return result;
}

export function TimelineList({
  tasks,
  timezone,
  onTaskClick,
}: {
  tasks: SerializedTask[];
  timezone: string;
  onTaskClick?: (task: SerializedTask) => void;
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

  return (
    <div className="flex flex-col gap-2">
      {sorted.map(({ task, depth }) => {
        const parentTitle =
          task.parentTaskId
            ? (task.parentTask?.title ?? taskMap.get(task.parentTaskId)?.title ?? null)
            : null;

        return (
          <div
            key={task.id}
            style={{ paddingLeft: depth > 0 ? `${depth * 20}px` : undefined }}
            className={depth > 0 ? "relative" : undefined}
          >
            {depth > 0 && (
              <div className="absolute left-3 top-0 bottom-0 w-px bg-border/60" />
            )}
            <TaskCard
              task={task}
              timezone={timezone}
              parentTitle={parentTitle}
              onTaskClick={onTaskClick}
            />
          </div>
        );
      })}
    </div>
  );
}
