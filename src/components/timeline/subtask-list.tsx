"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Plus, Loader2, ListChecks } from "lucide-react";
import { SubtaskItem } from "./subtask-item";
import { cn } from "@/lib/utils";
import type { SerializedSubTask, SerializedVendor } from "@/lib/types";

type SubTaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

interface SubtaskListProps {
  subTasks: SerializedSubTask[];
  userRole: "admin" | "vendor";
  parentTaskVendors: SerializedVendor[];
  allEventVendors: SerializedVendor[];
  taskId: string;
  eventId: string;
  /** The current vendor's EventVendor ID — used to restrict subtask status toggling */
  currentVendorEventId?: string | null;
  onSubTasksChange: (subTasks: SerializedSubTask[]) => void;
}

export function SubtaskList({
  subTasks,
  userRole,
  parentTaskVendors,
  allEventVendors,
  taskId,
  eventId,
  currentVendorEventId,
  onSubTasksChange,
}: SubtaskListProps) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const removeSubTask = useCallback(
    (id: string) => {
      onSubTasksChange(subTasks.filter((st) => st.id !== id));
    },
    [subTasks, onSubTasksChange],
  );

  // ── Status change ───────────────────────────────────────────────────────

  const handleStatusChange = useCallback(
    async (
      subTaskId: string,
      status: SubTaskStatus,
    ): Promise<SerializedSubTask | null> => {
      // Optimistic update
      const optimistic = subTasks.map((st) =>
        st.id === subTaskId ? { ...st, status } : st,
      );
      onSubTasksChange(optimistic);

      try {
        const res = await fetch(
          `/api/events/${eventId}/tasks/${taskId}/subtasks/${subTaskId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          },
        );
        if (!res.ok) {
          // Rollback on error
          onSubTasksChange(subTasks);
          return null;
        }
        const data = await res.json();
        return data.subTask ?? null;
      } catch {
        onSubTasksChange(subTasks);
        return null;
      }
    },
    [eventId, taskId, subTasks, onSubTasksChange],
  );

  // ── Title change (admin only) ───────────────────────────────────────────

  const handleTitleChange = useCallback(
    async (
      subTaskId: string,
      title: string,
    ): Promise<SerializedSubTask | null> => {
      // Optimistic update
      const optimistic = subTasks.map((st) =>
        st.id === subTaskId ? { ...st, title } : st,
      );
      onSubTasksChange(optimistic);

      try {
        const res = await fetch(
          `/api/events/${eventId}/tasks/${taskId}/subtasks/${subTaskId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title }),
          },
        );
        if (!res.ok) {
          onSubTasksChange(subTasks);
          return null;
        }
        const data = await res.json();
        return data.subTask ?? null;
      } catch {
        onSubTasksChange(subTasks);
        return null;
      }
    },
    [eventId, taskId, subTasks, onSubTasksChange],
  );

  // ── Vendor change (admin only) ──────────────────────────────────────────

  const handleVendorsChange = useCallback(
    async (
      subTaskId: string,
      vendorIds: string[],
    ): Promise<SerializedSubTask | null> => {
      // Optimistic update: reconstruct vendor refs
      const vendorRefs = vendorIds.map((vid) => {
        const vendor = allEventVendors.find((v) => v.id === vid);
        return {
          eventVendorId: vid,
          eventVendor: {
            id: vid,
            company: vendor?.company ?? null,
            jobTitle: vendor?.jobTitle ?? null,
            vendorContact: {
              email: vendor?.email ?? "",
              firstName: vendor?.firstName ?? null,
              lastName: vendor?.lastName ?? null,
            },
          },
        };
      });

      const optimistic = subTasks.map((st) =>
        st.id === subTaskId ? { ...st, subTaskVendors: vendorRefs } : st,
      );
      onSubTasksChange(optimistic);

      try {
        const res = await fetch(
          `/api/events/${eventId}/tasks/${taskId}/subtasks/${subTaskId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vendorIds }),
          },
        );
        if (!res.ok) {
          onSubTasksChange(subTasks);
          return null;
        }
        const data = await res.json();
        return data.subTask ?? null;
      } catch {
        onSubTasksChange(subTasks);
        return null;
      }
    },
    [eventId, taskId, subTasks, allEventVendors, onSubTasksChange],
  );

  // ── Delete (admin only) ─────────────────────────────────────────────────

  const handleDelete = useCallback(
    async (subTaskId: string): Promise<boolean> => {
      // Optimistic removal
      const prev = [...subTasks];
      removeSubTask(subTaskId);

      try {
        const res = await fetch(
          `/api/events/${eventId}/tasks/${taskId}/subtasks/${subTaskId}`,
          { method: "DELETE" },
        );
        if (res.ok) return true;
        // Rollback
        onSubTasksChange(prev);
        return false;
      } catch {
        onSubTasksChange(prev);
        return false;
      }
    },
    [eventId, taskId, subTasks, onSubTasksChange, removeSubTask],
  );

  // ── Create (admin only) ─────────────────────────────────────────────────

  const handleAddSubTask = useCallback(async () => {
    const trimmed = newTitle.trim();
    if (!trimmed || creating) return;

    setCreating(true);
    try {
      const res = await fetch(
        `/api/events/${eventId}/tasks/${taskId}/subtasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmed }),
        },
      );
      const data = await res.json();
      if (res.ok && data.subTask) {
        onSubTasksChange([...subTasks, data.subTask]);
        setNewTitle("");
        setAdding(false);
      }
    } finally {
      setCreating(false);
    }
  }, [newTitle, creating, eventId, taskId, subTasks, onSubTasksChange]);

  const handleAddKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddSubTask();
      } else if (e.key === "Escape") {
        setNewTitle("");
        setAdding(false);
      }
    },
    [handleAddSubTask],
  );

  // ── Drag-and-drop reordering (admin only) ───────────────────────────────

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<
    "above" | "below" | null
  >(null);
  const dragPrevSubTasks = useRef(subTasks);

  const handleDragStart = useCallback(
    (e: React.DragEvent, id: string) => {
      setDraggedId(id);
      dragPrevSubTasks.current = subTasks;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
    },
    [subTasks],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, id: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (id === draggedId) {
        setDragOverId(null);
        setDragOverPosition(null);
        return;
      }
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const pos = e.clientY < midY ? "above" : "below";
      setDragOverId(id);
      setDragOverPosition(pos);
    },
    [draggedId],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
    setDragOverPosition(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      const sourceId = e.dataTransfer.getData("text/plain");
      if (!sourceId || sourceId === targetId) {
        setDraggedId(null);
        setDragOverId(null);
        setDragOverPosition(null);
        return;
      }

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const insertBefore = e.clientY < midY;

      const sourceIdx = subTasks.findIndex((st) => st.id === sourceId);
      const targetIdx = subTasks.findIndex((st) => st.id === targetId);
      if (sourceIdx === -1 || targetIdx === -1) return;

      // Build new array with the moved item
      const reordered = [...subTasks];
      const [moved] = reordered.splice(sourceIdx, 1);
      const newTargetIdx = insertBefore
        ? targetIdx > sourceIdx
          ? targetIdx - 1
          : targetIdx
        : targetIdx > sourceIdx
          ? targetIdx
          : targetIdx + 1;
      reordered.splice(newTargetIdx, 0, moved);

      // Update sortOrder for each item
      const updated = reordered.map((st, i) => ({ ...st, sortOrder: i }));
      onSubTasksChange(updated);

      // Persist sortOrder changes for items whose order actually changed
      const oldSortMap = new Map(subTasks.map((st) => [st.id, st.sortOrder]));
      const affected = updated.filter(
        (st) => st.sortOrder !== oldSortMap.get(st.id),
      );
      Promise.all(
        affected.map((st) =>
          fetch(`/api/events/${eventId}/tasks/${taskId}/subtasks/${st.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: st.sortOrder }),
          }).catch(() => {}),
        ),
      );

      setDraggedId(null);
      setDragOverId(null);
      setDragOverPosition(null);
    },
    [eventId, taskId, subTasks, onSubTasksChange],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverId(null);
    setDragOverPosition(null);
  }, []);

  // ── Touch-based drag for mobile ────────────────────────────────────────

  const touchState = useRef<{
    itemId: string;
    startY: number;
    moved: boolean;
  } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent, id: string) => {
      const touch = e.touches[0];
      touchState.current = {
        itemId: id,
        startY: touch.clientY,
        moved: false,
      };
      setDraggedId(id);
      dragPrevSubTasks.current = subTasks;
    },
    [subTasks],
  );

  // Attach global touchmove/touchend when dragging
  useEffect(() => {
    if (!draggedId || !touchState.current) return;

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      touchState.current!.moved = true;

      // Find the checklist item under the finger
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const row = el?.closest("[data-item-id]") as HTMLElement | null;
      if (!row) {
        setDragOverId(null);
        setDragOverPosition(null);
        return;
      }
      const targetId = row.getAttribute("data-item-id");
      if (!targetId || targetId === draggedId) {
        setDragOverId(null);
        setDragOverPosition(null);
        return;
      }
      const rect = row.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const pos = touch.clientY < midY ? "above" : "below";
      setDragOverId(targetId);
      setDragOverPosition(pos);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const state = touchState.current;
      if (!state || !state.moved) {
        setDraggedId(null);
        touchState.current = null;
        return;
      }

      // Find the element under the final touch point
      const touch = e.changedTouches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const row = el?.closest("[data-item-id]") as HTMLElement | null;
      const targetId = row?.getAttribute("data-item-id");

      if (targetId && targetId !== state.itemId) {
        const rect = row!.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const insertBefore = touch.clientY < midY;

        const sourceIdx = subTasks.findIndex((st) => st.id === state.itemId);
        const targetIdx = subTasks.findIndex((st) => st.id === targetId);
        if (sourceIdx !== -1 && targetIdx !== -1) {
          const reordered = [...subTasks];
          const [moved] = reordered.splice(sourceIdx, 1);
          const newTargetIdx = insertBefore
            ? targetIdx > sourceIdx
              ? targetIdx - 1
              : targetIdx
            : targetIdx > sourceIdx
              ? targetIdx
              : targetIdx + 1;
          reordered.splice(newTargetIdx, 0, moved);

          const updated = reordered.map((st, i) => ({
            ...st,
            sortOrder: i,
          }));
          onSubTasksChange(updated);

          const oldSortMap = new Map(
            subTasks.map((st) => [st.id, st.sortOrder]),
          );
          const affected = updated.filter(
            (st) => st.sortOrder !== oldSortMap.get(st.id),
          );
          Promise.all(
            affected.map((st) =>
              fetch(
                `/api/events/${eventId}/tasks/${taskId}/subtasks/${st.id}`,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ sortOrder: st.sortOrder }),
                },
              ).catch(() => {}),
            ),
          );
        }
      }

      setDraggedId(null);
      setDragOverId(null);
      setDragOverPosition(null);
      touchState.current = null;
    };

    document.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [draggedId, eventId, taskId, subTasks, onSubTasksChange]);

  return (
    <div className="flex flex-col">
      {/* Sticky header area — always visible */}
      <div className="sticky top-0 z-10 bg-popover pb-0.5">
        {/* Header */}
        <div className="flex items-center justify-between px-1 py-1">
          <div className="flex items-center gap-1.5">
            <ListChecks className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Checklist
            </span>
            {subTasks.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {subTasks.filter((st) => st.status === "COMPLETED").length}/
                {subTasks.length}
              </span>
            )}
          </div>

          {userRole === "admin" && !adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              <Plus className="size-3.5" />
              Add
            </button>
          )}
        </div>

        {/* Add inline input */}
        {adding && userRole === "admin" && (
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="size-5 shrink-0" />
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={handleAddKeyDown}
              onBlur={() => {
                if (!newTitle.trim()) setAdding(false);
              }}
              placeholder="Checklist item…"
              autoFocus
              disabled={creating}
              className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground border-b border-border pb-0.5 outline-none focus:border-primary"
            />
            {creating && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            )}
          </div>
        )}
      </div>

      {/* Scrollable items list */}
      <div className="flex flex-col gap-0.5">
        {/* Checklist items */}
        {subTasks.length === 0 && !adding ? (
          <p className="px-3 py-3 text-xs text-muted-foreground italic">
            No checklist items yet.
            {userRole === "admin" && ' Tap "Add" to create one.'}
          </p>
        ) : (
          subTasks.map((st) => {
            // Vendor can only toggle status if assigned to this specific subtask
            const isAssignedToSubtask =
              userRole === "admin" ||
              (currentVendorEventId != null &&
                (st.subTaskVendors ?? []).some(
                  (sv) => sv.eventVendorId === currentVendorEventId,
                ));
            return (
              <SubtaskItem
                key={st.id}
                subTask={st}
                userRole={userRole}
                parentTaskVendors={parentTaskVendors}
                allEventVendors={allEventVendors}
                canToggleStatus={isAssignedToSubtask}
                onStatusChange={handleStatusChange}
                onTitleChange={handleTitleChange}
                onVendorsChange={handleVendorsChange}
                onDelete={handleDelete}
                itemId={st.id}
                isDragging={draggedId === st.id}
                dropIndicator={dragOverId === st.id ? dragOverPosition : null}
                onDragStart={
                  userRole === "admin"
                    ? (e: React.DragEvent) => handleDragStart(e, st.id)
                    : undefined
                }
                onTouchStart={
                  userRole === "admin"
                    ? (e: React.TouchEvent) => handleTouchStart(e, st.id)
                    : undefined
                }
                onDragOver={
                  userRole === "admin"
                    ? (e: React.DragEvent) => handleDragOver(e, st.id)
                    : undefined
                }
                onDragLeave={userRole === "admin" ? handleDragLeave : undefined}
                onDrop={
                  userRole === "admin"
                    ? (e: React.DragEvent) => handleDrop(e, st.id)
                    : undefined
                }
                onDragEnd={userRole === "admin" ? handleDragEnd : undefined}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
