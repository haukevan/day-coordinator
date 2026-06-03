"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { List, BarChart2, Plus, Pencil, Check, X, Loader2 } from "lucide-react";
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

  // Custom sequence labels keyed by root task id
  const [customLabels, setCustomLabels] = useState<Map<string, string>>(
    new Map(),
  );
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingLabel, setSavingLabel] = useState(false);

  const dependencyLegend = useMemo(() => {
    const metaByTask = buildDependencyGroupMeta(tasks);
    const groups = new Map<
      string,
      { groupId: string; label: string; chipClass: string }
    >();

    for (const meta of metaByTask.values()) {
      if (groups.has(meta.groupId)) continue;
      groups.set(meta.groupId, {
        groupId: meta.groupId,
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

  // ── Sequence label editing ──────────────────────────────────────────────
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingGroupId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingGroupId]);

  function startEditing(groupId: string, currentLabel: string) {
    setEditValue(currentLabel);
    setEditingGroupId(groupId);
  }

  async function saveLabel(groupId: string) {
    const trimmed = editValue.trim();
    setSavingLabel(true);
    setCustomLabels((prev) => {
      const next = new Map(prev);
      if (trimmed) {
        next.set(groupId, trimmed);
      } else {
        next.delete(groupId);
      }
      return next;
    });

    // Persist to the root task, then refresh so dependency-groups picks it up
    try {
      const res = await fetch(`/api/events/${eventId}/tasks/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequenceLabel: trimmed || null }),
      });
      if (res.ok) await refreshTasks();
    } finally {
      setSavingLabel(false);
      setEditingGroupId(null);
    }
  }

  function cancelEditing() {
    setEditingGroupId(null);
  }

  return (
    <div
      className={cn(
        view === "gantt"
          ? "flex h-full flex-col overflow-hidden px-3 pt-2 pb-2 sm:px-6 sm:pt-6 sm:pb-6"
          : "px-3 py-2 sm:p-6",
      )}
    >
      {/* Toolbar */}
      <div
        className={cn(
          "flex items-center justify-between",
          view === "gantt" ? "mb-2 sm:mb-4 shrink-0" : "mb-3 sm:mb-6",
        )}
      >
        <div className="flex overflow-hidden rounded-lg border border-border">
          <button
            onClick={() => setView("list")}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:py-1.5 min-h-[36px] min-w-[36px] justify-center",
              view === "list"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted",
            )}
            aria-label="List view"
          >
            <List className="size-3.5" />
            <span className="hidden sm:inline">List</span>
          </button>
          <button
            onClick={() => setView("gantt")}
            className={cn(
              "flex items-center gap-1.5 border-l border-border px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:py-1.5 min-h-[36px] min-w-[36px] justify-center",
              view === "gantt"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted",
            )}
            aria-label="Calendar view"
          >
            <BarChart2 className="size-3.5" />
            <span className="hidden sm:inline">Calendar</span>
          </button>
        </div>

        {userRole === "admin" && (
          <Button size="sm" onClick={openCreate} className="sm:px-3">
            <Plus className="size-4 sm:mr-1" />
            <span className="hidden sm:inline">Add task</span>
          </Button>
        )}
      </div>

      {dependencyLegend.length > 0 && (
        <div className="mb-2 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
            Sequences:
          </span>
          {dependencyLegend.map((group) => {
            const isEditing = editingGroupId === group.groupId;
            const displayLabel = customLabels.get(group.groupId) ?? group.label;
            const truncatedLabel =
              displayLabel.length > 12
                ? displayLabel.slice(0, 12) + "…"
                : displayLabel;

            return isEditing ? (
              <span
                key={group.groupId}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5",
                  group.chipClass,
                )}
              >
                <input
                  ref={editInputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (savingLabel) return;
                    if (e.key === "Enter") saveLabel(group.groupId);
                    if (e.key === "Escape") cancelEditing();
                  }}
                  className="w-20 bg-transparent text-[11px] font-medium outline-none placeholder:text-current/40"
                  placeholder="Name…"
                />
                <button
                  type="button"
                  onClick={() => saveLabel(group.groupId)}
                  disabled={savingLabel}
                  className="inline-flex size-3.5 items-center justify-center rounded-sm opacity-70 hover:opacity-100 disabled:opacity-50"
                  aria-label="Save"
                >
                  {savingLabel ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Check className="size-3" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={savingLabel}
                  className="inline-flex size-3.5 items-center justify-center rounded-sm opacity-70 hover:opacity-100 disabled:opacity-30"
                  aria-label="Cancel"
                >
                  <X className="size-3" />
                </button>
              </span>
            ) : (
              <span
                key={group.groupId}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
                  group.chipClass,
                )}
                title={displayLabel}
              >
                {truncatedLabel}
                <button
                  type="button"
                  onClick={() => startEditing(group.groupId, displayLabel)}
                  className="inline-flex size-3.5 items-center justify-center rounded-sm opacity-60 hover:opacity-100"
                  aria-label="Rename sequence"
                >
                  <Pencil className="size-2.5" />
                </button>
              </span>
            );
          })}
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
