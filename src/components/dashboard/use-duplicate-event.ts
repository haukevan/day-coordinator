"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";

/**
 * Duplicate an event and navigate to the new draft's settings so the
 * coordinator can adjust the date/venue.
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
          event?: { id: string; title: string };
          error?: string;
        } | null;

        if (res.ok && data?.event?.id) {
          addToast({
            title: "Event duplicated",
            body: `"${data.event.title}" is ready to edit.`,
            variant: "success",
          });
          router.push(`/events/${data.event.id}/settings`);
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
