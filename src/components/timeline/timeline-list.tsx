import { TaskCard } from "./task-card";
import type { SerializedTask } from "@/lib/types";

export function TimelineList({
  tasks,
  timezone,
}: {
  tasks: SerializedTask[];
  timezone: string;
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

  return (
    <div className="flex flex-col gap-3">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} timezone={timezone} />
      ))}
    </div>
  );
}
