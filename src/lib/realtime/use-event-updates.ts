"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "./supabase";

const TASK_EVENTS = [
  "task.created",
  "task.updated",
  "task.deleted",
  "task.started",
  "task.completed",
  "task.delayed",
  "subtask.created",
  "subtask.updated",
  "subtask.deleted",
  "subtask.status_changed",
] as const;

/**
 * Silent task refreshes for an event timeline.
 *
 * Subscribes to the event's Supabase Realtime broadcast channel so changes
 * made on another device appear without navigation. When `pollMs` is set
 * (LIVE mode), it also refetches on an interval as a fallback for clients
 * that cannot keep a websocket open.
 */
export function useEventTaskUpdates(
  eventId: string,
  onChange: () => void,
  { pollMs }: { pollMs?: number } = {},
) {
  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let lastRefresh = 0;

    // Collapse bursts (a single delay can touch many tasks) into one refresh.
    const scheduleRefresh = () => {
      if (refreshTimer) return;
      const wait = Math.max(0, 500 - (Date.now() - lastRefresh));
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        lastRefresh = Date.now();
        onChange();
      }, wait);
    };

    const channel = supabaseBrowser.channel(`event-${eventId}`);
    for (const event of TASK_EVENTS) {
      channel.on("broadcast", { event }, scheduleRefresh);
    }
    channel.subscribe();

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    if (pollMs) {
      pollTimer = setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        onChange();
      }, pollMs);
    }

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      if (pollTimer) clearInterval(pollTimer);
      void supabaseBrowser.removeChannel(channel);
    };
  }, [eventId, onChange, pollMs]);
}
