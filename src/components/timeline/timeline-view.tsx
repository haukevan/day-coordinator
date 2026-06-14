"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { TimelineList } from "./timeline-list";
import { TimelineGantt } from "./timeline-gantt";
import { TaskPanel } from "./task-panel";
import { TaskDetailSheet } from "./task-detail-sheet";
import { useTimelineView } from "./timeline-view-context";
import { cn } from "@/lib/utils";
import { TaskRowSkeletonList } from "@/components/ui/skeletons";
import type { SerializedTask, SerializedVendor } from "@/lib/types";

export function TimelineView({
  eventId,
  tasks: initialTasks,
  timezone,
  eventDate,
  userRole = "admin",
  currentUserId,
  vendorEventVendorId,
}: {
  eventId: string;
  tasks: SerializedTask[];
  timezone: string;
  eventDate: string | null;
  userRole?: "admin" | "vendor";
  /** The current user's database ID. Used to check sub-task visibility for vendors. */
  currentUserId?: string;
  /** The vendor's EventVendor ID (server-provided). Used when userRole is "vendor" to bypass the vendors API for canViewSubTasks. */
  vendorEventVendorId?: string;
}) {
  const { view, createPanelTrigger } = useTimelineView();
  const [tasks, setTasks] = useState(initialTasks);
  const [vendors, setVendors] = useState<SerializedVendor[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<SerializedTask | undefined>();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Detail sheet state (new flow: click task → detail sheet)
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<SerializedTask | undefined>();

  // Open create panel instantly when toolbar triggers it via context
  const prevTrigger = useRef(createPanelTrigger);
  useEffect(() => {
    if (createPanelTrigger !== prevTrigger.current) {
      prevTrigger.current = createPanelTrigger;
      openCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createPanelTrigger]);

  // Fetch event vendors for task assignment
  useEffect(() => {
    async function fetchVendors() {
      try {
        const res = await fetch(`/api/events/${eventId}/vendors`);
        if (!res.ok) return;
        const data = await res.json();
        setVendors(data.vendors ?? []);
      } catch {
        // non-critical
      }
    }
    fetchVendors();
  }, [eventId]);

  // Reload all tasks from the API (used after edits that may propagate)
  const refreshTasks = useCallback(async () => {
    setIsRefreshing(true);
    try {
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
    } finally {
      setIsRefreshing(false);
    }
  }, [eventId]);

  function openCreate() {
    setEditingTask(undefined);
    setPanelOpen(true);
  }

  /** Open the detail sheet (summary + sub-tasks) when a task card is clicked. */
  function openDetail(task: SerializedTask) {
    setDetailTask(task);
    setDetailOpen(true);
  }

  /** Open the edit panel from the detail sheet's "Edit" button. */
  function openEditFromDetail(task: SerializedTask) {
    setEditingTask(task);
    setPanelOpen(true);
  }

  /** Open the edit panel directly (for the "+" create button). */
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
    // Also update the detail task if it matches
    setDetailTask((prev) => (prev?.id === saved.id ? saved : prev));
  }

  // Compute if the current user can view sub-tasks for the detail task.
  // For vendors, we use the server-provided vendorEventVendorId to check
  // directly against the task's vendor assignments — no vendors API needed.
  const canViewSubTasks = useMemo(() => {
    if (userRole === "admin") return true;
    if (!detailTask || !vendorEventVendorId) return false;
    // Vendor can view sub-tasks if their EventVendor ID is in the task's vendor list
    return (detailTask.taskVendors ?? []).some(
      (tv) => tv.eventVendorId === vendorEventVendorId,
    );
  }, [userRole, detailTask, vendorEventVendorId]);

  // The current vendor's EventVendor ID — used to restrict subtask status toggling.
  // For vendors, this comes directly from the server; for admins it's not needed.
  const currentVendorEventId = useMemo(() => {
    if (userRole !== "vendor") return null;
    return vendorEventVendorId ?? null;
  }, [userRole, vendorEventVendorId]);

  return (
    <div
      className={cn(
        view === "gantt"
          ? "flex h-full flex-col overflow-hidden px-3 pt-2 pb-2 sm:px-6 sm:pt-6 sm:pb-6"
          : "px-3 py-2 sm:p-6",
      )}
    >
      {/* View content */}
      {isRefreshing && tasks.length > 0 ? (
        <TaskRowSkeletonList count={4} />
      ) : view === "list" ? (
        <TimelineList
          tasks={tasks}
          timezone={timezone}
          onTaskClick={openDetail}
        />
      ) : (
        <div className="flex-1 min-h-0">
          <TimelineGantt
            tasks={tasks}
            timezone={timezone}
            onTaskClick={openDetail}
          />
        </div>
      )}

      {/* Task detail sheet (summary + sub-tasks) — new primary click target */}
      <TaskDetailSheet
        eventId={eventId}
        task={detailTask}
        timezone={timezone}
        open={detailOpen}
        userRole={userRole}
        canViewSubTasks={canViewSubTasks}
        currentVendorEventId={currentVendorEventId}
        onClose={() => setDetailOpen(false)}
        onEdit={openEditFromDetail}
      />

      {/* Task edit slide-over panel (existing form) — opened via "Edit" button */}
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
        vendors={vendors}
        readOnly={userRole === "vendor"}
      />
    </div>
  );
}
