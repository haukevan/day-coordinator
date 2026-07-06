"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { supabaseBrowser } from "@/lib/realtime/supabase";

/**
 * Listens for notification events from Supabase Realtime and shows in-app toasts.
 *
 * Mount this in the dashboard layout. It subscribes to a single shared
 * channel that carries notification events for all events the user is part of.
 *
 * Event format from the server (via emitEventUpdate):
 *   { type: "broadcast", event: "task.started", payload: { taskId, ... } }
 */
export function NotificationToastListener() {
  const { addToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    // Subscribe to a shared notifications channel
    const channel = supabaseBrowser.channel("notifications");

    channel
      .on("broadcast", { event: "task.overdue" }, (payload) => {
        addToast({
          title: "Task Overdue",
          body: payload.payload?.body as string | undefined,
          variant: "destructive",
          onClick: () => {
            const url = payload.payload?.data?.url as string | undefined;
            if (url) router.push(url);
          },
        });
      })
      .on("broadcast", { event: "task.started" }, (payload) => {
        addToast({
          title: "Task Started",
          body: payload.payload?.body as string | undefined,
          variant: "default",
          onClick: () => {
            const url = payload.payload?.data?.url as string | undefined;
            if (url) router.push(url);
          },
        });
      })
      .on("broadcast", { event: "task.completed" }, (payload) => {
        addToast({
          title: "Task Completed",
          body: payload.payload?.body as string | undefined,
          variant: "success",
          onClick: () => {
            const url = payload.payload?.data?.url as string | undefined;
            if (url) router.push(url);
          },
        });
      })
      .on("broadcast", { event: "task.delayed" }, (payload) => {
        addToast({
          title: "Task Delayed",
          body: payload.payload?.body as string | undefined,
          variant: "warning",
          onClick: () => {
            const url = payload.payload?.data?.url as string | undefined;
            if (url) router.push(url);
          },
        });
      })
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [addToast, router]);

  return null;
}
