"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { TimelineList } from "./timeline-list";
import { TimelineGantt } from "./timeline-gantt";
import { TaskPanel } from "./task-panel";
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
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const view = (searchParams.get("view") as "list" | "gantt") || "list";
  const [tasks, setTasks] = useState(initialTasks);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<SerializedTask | undefined>();

  // Handle ?panel=create from the toolbar in the header
  useEffect(() => {
    if (searchParams.get("panel") === "create") {
      openCreate();
      // Clear the param without a full navigation
      const next = new URLSearchParams(searchParams.toString());
      next.delete("panel");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }
    // Only run when searchParams change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
          ? "flex h-full flex-col overflow-hidden px-3 pt-2 pb-2 sm:px-6 sm:pt-6 sm:pb-6"
          : "px-3 py-2 sm:p-6",
      )}
    >
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
