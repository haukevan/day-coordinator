"use client";

import { useState, useCallback, useMemo } from "react";
import { List, BarChart2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimelineList } from "./timeline-list";
import { TimelineGantt } from "./timeline-gantt";
import { TaskPanel } from "./task-panel";
import { buildDependencyGroupMeta } from "./dependency-groups";
import { cn } from "@/lib/utils";
import type { SerializedTask } from "@/lib/types";

export function TimelineView({
  eventId,
  tasks: initialTasks,
  timezone,
  eventDate,
  userRole = "admin",
}: {
  eventId: string;
  tasks: SerializedTask[];
  timezone: string;
  eventDate: string | null;
  userRole?: "admin" | "vendor";
}) {
  const [view, setView] = useState<"list" | "gantt">("list");
  const [tasks, setTasks] = useState(initialTasks);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<SerializedTask | undefined>();

  const dependencyLegend = useMemo(() => {
    const metaByTask = buildDependencyGroupMeta(tasks);
    const groups = new Map<string, { label: string; chipClass: string }>();

    for (const meta of metaByTask.values()) {
      if (groups.has(meta.groupId)) continue;
      groups.set(meta.groupId, {
        label: meta.groupLabel,
        chipClass: meta.style.chipClass,
      });
    }

    return [...groups.values()]
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, 5);
  }, [tasks]);

  // Reload all tasks from the API (used after edits that may propagate)
  const refreshTasks = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/tasks`);
    if (!res.ok) return;
    const data = await res.json();
    setTasks(
      data.tasks.map((t: SerializedTask) => ({
        ...t,
        scheduledStart: t.scheduledStart ?? null,
        scheduledEnd: t.scheduledEnd ?? null,
        actualStart: t.actualStart ?? null,
        actualEnd: t.actualEnd ?? null,
        parentTask: t.parentTask ?? null,
      })),
    );
  }, [eventId]);

  function openCreate() {
    setEditingTask(undefined);
    setPanelOpen(true);
  }

  function openEdit(task: SerializedTask) {
    setEditingTask(task);
    setPanelOpen(true);
  }

  function handleSaved(saved: SerializedTask) {
    setTasks((prev) => {
      const existing = prev.find((t) => t.id === saved.id);
      if (existing) {
        return prev.map((t) => (t.id === saved.id ? saved : t));
      }
      return [...prev, saved];
    });
  }

  return (
    <div
      className={cn(
        view === "gantt"
          ? "flex h-full flex-col overflow-hidden px-4 pt-4 pb-4 sm:px-6 sm:pt-6 sm:pb-6"
          : "p-4 sm:p-6",
      )}
    >
      {/* Toolbar */}
      <div
        className={cn(
          "flex items-center justify-between",
          view === "gantt" ? "mb-4 shrink-0" : "mb-6",
        )}
      >
        <div className="flex overflow-hidden rounded-lg border border-border">
          <button
            onClick={() => setView("list")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
              view === "list"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            <List className="size-3.5" />
            List
          </button>
          <button
            onClick={() => setView("gantt")}
            className={cn(
              "flex items-center gap-1.5 border-l border-border px-3 py-1.5 text-xs font-medium transition-colors",
              view === "gantt"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            <BarChart2 className="size-3.5" />
            Calendar
          </button>
        </div>

        {userRole === "admin" && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            Add task
          </Button>
        )}
      </div>

      {dependencyLegend.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">
            Dependency chains:
          </span>
          {dependencyLegend.map((group) => (
            <span
              key={group.label}
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                group.chipClass,
              )}
            >
              {group.label}
            </span>
          ))}
        </div>
      )}

      {/* View content */}
      {view === "list" ? (
        <TimelineList
          tasks={tasks}
          timezone={timezone}
          onTaskClick={userRole === "admin" ? openEdit : undefined}
        />
      ) : (
        <div className="flex-1 min-h-0">
          <TimelineGantt
            tasks={tasks}
            timezone={timezone}
            onTaskClick={userRole === "admin" ? openEdit : undefined}
          />
        </div>
      )}

      {/* Task slide-over panel */}
      {userRole === "admin" && (
        <TaskPanel
          eventId={eventId}
          tasks={tasks}
          timezone={timezone}
          eventDate={eventDate}
          task={editingTask}
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          onSaved={handleSaved}
          onRefresh={refreshTasks}
        />
      )}
    </div>
  );
}
