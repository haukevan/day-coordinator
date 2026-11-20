"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { emitEventDuplicated } from "@/lib/client-events";
import type { DashboardEvent } from "./event-card";

/**
 * Duplicate an event. The new card is inserted optimistically via the client
 * event bus (so filtered lists and counts update immediately) and the current
 * route is refreshed so the server data catches up.
 */
export function useDuplicateEvent() {
  const router = useRouter();
  const { addToast } = useToast();
  const [duplicating, setDuplicating] = useState(false);

  const duplicateEvent = useCallback(
    async (eventId: string) => {
      if (duplicating) return;
      setDuplicating(true);

      try {
        const res = await fetch(`/api/events/${eventId}/duplicate`, {
          method: "POST",
        });
        const data = (await res.json().catch(() => null)) as {
          event?: DashboardEvent;
          error?: string;
        } | null;

        const newEvent = data?.event;
        if (res.ok && newEvent?.id) {
          emitEventDuplicated<DashboardEvent>(newEvent);
          addToast({
            title: "Event duplicated",
            body: `"${newEvent.title}" is ready — click to open.`,
            variant: "success",
            onClick: () => router.push(`/events/${newEvent.id}/settings`),
          });
          router.refresh();
          return;
        }

        addToast({
          title: "Could not duplicate event",
          body: data?.error ?? "Please try again.",
          variant: "destructive",
        });
      } catch {
        addToast({
          title: "Could not duplicate event",
          body: "Network error. Please try again.",
          variant: "destructive",
        });
      } finally {
        setDuplicating(false);
      }
    },
    [addToast, duplicating, router],
  );

  return { duplicateEvent, duplicating };
}
