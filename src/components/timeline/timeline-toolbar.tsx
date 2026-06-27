"use client";

import { List, BarChart2, Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useTimelineView } from "./timeline-view-context";
import { cn } from "@/lib/utils";

export function TimelineToolbar({
  userRole = "admin",
}: {
  userRole?: "admin" | "vendor";
}) {
  const { view, setView, openCreatePanel } = useTimelineView();
  const pathname = usePathname();

  // Only show the view toggle + add-task button on the timeline tab
  if (!pathname.endsWith("/timeline")) return null;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex overflow-hidden rounded-lg border border-border">
        <button
          onClick={() => setView("list")}
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium transition-colors min-h-[42px] min-w-[42px] justify-center sm:min-w-0 sm:justify-start sm:px-3 sm:py-1.5",
            view === "list"
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-muted",
          )}
          aria-label="List view"
        >
          <List className="size-4" />
          <span className="hidden sm:inline">List</span>
        </button>
        <button
          onClick={() => setView("gantt")}
          className={cn(
            "inline-flex items-center gap-1.5 border-l border-border px-2 py-1.5 text-xs font-medium transition-colors min-h-[42px] min-w-[42px] justify-center sm:min-w-0 sm:justify-start sm:px-3 sm:py-1.5",
            view === "gantt"
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-muted",
          )}
          aria-label="Calendar view"
        >
          <BarChart2 className="size-4" />
          <span className="hidden sm:inline">Calendar</span>
        </button>
      </div>

      {userRole === "admin" && (
        <Button size="sm" onClick={openCreatePanel}>
          <Plus className="size-4 sm:mr-1" />
          <span className="hidden sm:inline">Add task</span>
        </Button>
      )}
    </div>
  );
}
