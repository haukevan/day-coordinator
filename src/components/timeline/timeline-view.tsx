"use client";

import { useState } from "react";
import { List, BarChart2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimelineList } from "./timeline-list";
import { TimelineGantt } from "./timeline-gantt";
import { cn } from "@/lib/utils";
import type { SerializedTask } from "@/lib/types";

export function TimelineView({
  eventId,
  tasks: initialTasks,
  timezone,
}: {
  eventId: string;
  tasks: SerializedTask[];
  timezone: string;
}) {
  const [view, setView] = useState<"list" | "gantt">("list");
  const [tasks, setTasks] = useState(initialTasks);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  async function handleAddTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAdding(true);
    setError("");

    const res = await fetch(`/api/events/${eventId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle.trim(),
        durationMins: newDuration ? parseInt(newDuration, 10) : undefined,
      }),
    });

    const data = await res.json();
    setAdding(false);

    if (res.ok) {
      const t = data.task;
      setTasks((prev) => [
        ...prev,
        {
          ...t,
          scheduledStart: t.scheduledStart ?? null,
          scheduledEnd: t.scheduledEnd ?? null,
          actualStart: t.actualStart ?? null,
          actualEnd: t.actualEnd ?? null,
          createdAt: t.createdAt ?? new Date().toISOString(),
          updatedAt: t.updatedAt ?? new Date().toISOString(),
        },
      ]);
      setNewTitle("");
      setNewDuration("");
      setShowForm(false);
    } else {
      setError(data.error ?? "Failed to add task.");
    }
  }

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="mb-6 flex items-center justify-between">
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
            Gantt
          </button>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="size-4" />
          Add task
        </Button>
      </div>

      {/* Inline add-task form */}
      {showForm && (
        <form
          onSubmit={handleAddTask}
          className="mb-4 flex flex-wrap gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3"
        >
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Task name"
            autoFocus
            required
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50"
          />
          <input
            type="number"
            value={newDuration}
            onChange={(e) => setNewDuration(e.target.value)}
            placeholder="min"
            min={1}
            className="w-16 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50"
          />
          <Button type="submit" size="sm" disabled={adding}>
            {adding ? "Adding…" : "Add"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowForm(false);
              setError("");
            }}
          >
            Cancel
          </Button>
          {error && <p className="w-full text-xs text-destructive">{error}</p>}
        </form>
      )}

      {view === "list" ? (
        <TimelineList tasks={tasks} timezone={timezone} />
      ) : (
        <TimelineGantt />
      )}
    </div>
  );
}
