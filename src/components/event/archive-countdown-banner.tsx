"use client";

import { useState, useEffect, useRef } from "react";
import { Clock, Archive } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  eventId: string;
  eventStatus: string;
};

type TaskSummary = {
  id: string;
  status: string;
  actualEnd: string | null;
  scheduledEnd: string | null;
};

/**
 * Banner shown when an event is LIVE and all tasks have reached a terminal
 * state (COMPLETED or SKIPPED). Displays a live countdown to when the event
 * will be automatically archived (24 hours after the latest task end time).
 */
export function ArchiveCountdownBanner({ eventId, eventStatus }: Props) {
  const [archiveAt, setArchiveAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState("");
  const [isPast, setIsPast] = useState(false);
  const initialised = useRef(false);

  // Fetch tasks and compute the archive time (runs once when LIVE)
  useEffect(() => {
    if (initialised.current) return;
    if (eventStatus !== "LIVE") return;
    initialised.current = true;

    let cancelled = false;

    async function fetchAndCompute() {
      try {
        const res = await fetch(`/api/events/${eventId}/tasks`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const tasks: TaskSummary[] = data.tasks ?? [];

        if (tasks.length === 0) return;

        // Check if ALL tasks are COMPLETED or SKIPPED
        const allTerminal = tasks.every(
          (t) => t.status === "COMPLETED" || t.status === "SKIPPED",
        );
        if (!allTerminal) return;

        // Find the latest end time (prefer actualEnd, fall back to scheduledEnd)
        let latestEndMs = 0;
        for (const task of tasks) {
          const endStr = task.actualEnd ?? task.scheduledEnd;
          if (endStr) {
            const endMs = new Date(endStr).getTime();
            if (endMs > latestEndMs) latestEndMs = endMs;
          }
        }

        if (latestEndMs === 0) return;

        // Archive time = 24 hours after the latest task ended
        if (!cancelled) {
          setArchiveAt(new Date(latestEndMs + 24 * 60 * 60 * 1000));
        }
      } catch {
        // silent
      }
    }

    fetchAndCompute();
    return () => {
      cancelled = true;
    };
  }, [eventId, eventStatus]);

  // Live countdown timer — also tracks whether archive time has passed
  useEffect(() => {
    if (!archiveAt) return;

    function tick() {
      const remaining = archiveAt!.getTime() - Date.now();

      if (remaining <= 0) {
        setCountdown("Archiving now…");
        setIsPast(true);
        return;
      }

      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m until auto-archive`);
      } else {
        setCountdown(`${minutes}m until auto-archive`);
      }
    }

    tick();
    const interval = setInterval(tick, 30_000); // update every 30s
    return () => clearInterval(interval);
  }, [archiveAt]);

  if (eventStatus !== "LIVE" || !archiveAt || isPast) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-2 border-b border-info/30 bg-info/10 px-3 py-2 sm:px-6 sm:py-3",
      )}
    >
      <Archive className="mt-0.5 size-4 shrink-0 text-info" />
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm font-medium text-foreground">
          All tasks completed
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] sm:text-xs text-muted-foreground">
          <Clock className="size-3" />
          <span>{countdown}</span>
        </p>
        <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground/70">
          After archiving, this event will become read-only. You&apos;ll still
          be able to view or delete it.
        </p>
      </div>
    </div>
  );
}
