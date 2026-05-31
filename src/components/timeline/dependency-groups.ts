import type { SerializedTask } from "@/lib/types";

export type DependencyGroupStyle = {
  railClass: string;
  chipClass: string;
  lineClass: string;
};

export type DependencyGroupMeta = {
  groupId: string;
  groupLabel: string;
  style: DependencyGroupStyle;
};

const DEPENDENCY_STYLES: DependencyGroupStyle[] = [
  {
    railClass: "border-l-dependency-1",
    chipClass:
      "border-dependency-1 bg-dependency-1 text-dependency-1-foreground",
    lineClass: "bg-dependency-1/55",
  },
  {
    railClass: "border-l-dependency-2",
    chipClass:
      "border-dependency-2 bg-dependency-2 text-dependency-2-foreground",
    lineClass: "bg-dependency-2/55",
  },
  {
    railClass: "border-l-dependency-3",
    chipClass:
      "border-dependency-3 bg-dependency-3 text-dependency-3-foreground",
    lineClass: "bg-dependency-3/55",
  },
  {
    railClass: "border-l-dependency-4",
    chipClass:
      "border-dependency-4 bg-dependency-4 text-dependency-4-foreground",
    lineClass: "bg-dependency-4/55",
  },
  {
    railClass: "border-l-dependency-5",
    chipClass:
      "border-dependency-5 bg-dependency-5 text-dependency-5-foreground",
    lineClass: "bg-dependency-5/55",
  },
];

function compareTasks(a: SerializedTask, b: SerializedTask): number {
  if (a.scheduledStart && b.scheduledStart) {
    return (
      new Date(a.scheduledStart).getTime() -
      new Date(b.scheduledStart).getTime()
    );
  }
  if (a.scheduledStart) return -1;
  if (b.scheduledStart) return 1;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export function buildDependencyGroupMeta(
  tasks: SerializedTask[],
): Map<string, DependencyGroupMeta> {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const hasChild = new Set<string>();

  for (const task of tasks) {
    if (task.parentTaskId) hasChild.add(task.parentTaskId);
  }

  const rootMemo = new Map<string, string>();

  function findRootId(taskId: string): string {
    const memoized = rootMemo.get(taskId);
    if (memoized) return memoized;

    const seen = new Set<string>();
    let currentId = taskId;

    while (true) {
      if (seen.has(currentId)) break;
      seen.add(currentId);

      const currentTask = byId.get(currentId);
      const parentId = currentTask?.parentTaskId;

      if (!parentId || !byId.has(parentId)) break;
      currentId = parentId;
    }

    for (const id of seen) rootMemo.set(id, currentId);
    return currentId;
  }

  const rootIds = new Set<string>();
  const relatedTaskIds: string[] = [];

  for (const task of tasks) {
    const isRelated = Boolean(task.parentTaskId) || hasChild.has(task.id);
    if (!isRelated) continue;
    relatedTaskIds.push(task.id);
    rootIds.add(findRootId(task.id));
  }

  const sortedRoots = [...rootIds]
    .map((id) => byId.get(id))
    .filter((task): task is SerializedTask => Boolean(task))
    .sort(compareTasks)
    .map((task) => task.id);

  const rootToIndex = new Map<string, number>(
    sortedRoots.map((rootId, i) => [rootId, i]),
  );

  const metaByTask = new Map<string, DependencyGroupMeta>();
  for (const taskId of relatedTaskIds) {
    const rootId = findRootId(taskId);
    const rawIndex = rootToIndex.get(rootId) ?? 0;
    const style = DEPENDENCY_STYLES[rawIndex % DEPENDENCY_STYLES.length];
    metaByTask.set(taskId, {
      groupId: rootId,
      groupLabel: `Chain ${rawIndex + 1}`,
      style,
    });
  }

  return metaByTask;
}
