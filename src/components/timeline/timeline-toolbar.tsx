"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import { List, BarChart2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TimelineToolbar() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const view = searchParams.get("view") || "list";

  const setView = useCallback(
    (newView: "list" | "gantt") => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", newView);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, pathname, router],
  );

  const openCreate = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("panel", "create");
    router.replace(`${pathname}?${params.toString()}`);
  }, [searchParams, pathname, router]);

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex overflow-hidden rounded-lg border border-border">
        <button
          onClick={() => setView("list")}
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium transition-colors min-h-[36px] sm:px-3 sm:py-1.5",
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
            "inline-flex items-center gap-1.5 border-l border-border px-2 py-1.5 text-xs font-medium transition-colors min-h-[36px] sm:px-3 sm:py-1.5",
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

      <Button size="lg" onClick={openCreate} className="sm:px-3">
        <Plus className="size-4 sm:mr-1" />
        <span className="hidden sm:inline">Add task</span>
      </Button>
    </div>
  );
}
