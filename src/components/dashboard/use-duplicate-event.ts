"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { queryKeys } from "@/lib/query/keys";
import type { DashboardEvent, DashboardPayload } from "@/lib/types";

type DuplicateResponse = {
  event?: DashboardEvent;
  error?: string;
};

/**
 * Duplicate an event.
 *
 * The copy is inserted into the shared `events` cache as soon as the server
 * responds, so an active search/status filter and the "Showing X of Y events"
 * count update in the same render. A targeted background refetch then
 * reconciles the list with the server.
 */
export function useDuplicateEvent() {
  const router = useRouter();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await fetch(`/api/events/${eventId}/duplicate`, {
        method: "POST",
      });
      const data = (await res
        .json()
        .catch(() => null)) as DuplicateResponse | null;

      if (!res.ok || !data?.event?.id) {
        throw new Error(data?.error ?? "Please try again.");
      }

      return data.event;
    },
    onSuccess: (newEvent) => {
      queryClient.setQueryData<DashboardPayload>(
        queryKeys.events,
        (previous) => {
          if (!previous) return previous;
          if (previous.events.some((event) => event.id === newEvent.id)) {
            return previous;
          }
          return { ...previous, events: [newEvent, ...previous.events] };
        },
      );

      // Reconcile with the server in the background. Only affected keys are
      // touched: the event list, plus venue usage counts (the copy keeps the
      // source event's venue).
      void queryClient.invalidateQueries({
        queryKey: queryKeys.events,
        exact: true,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.venues });

      addToast({
        title: "Event duplicated",
        body: `"${newEvent.title}" is ready — click to open.`,
        variant: "success",
        onClick: () => router.push(`/events/${newEvent.id}/settings`),
      });
    },
    onError: (error: Error) => {
      addToast({
        title: "Could not duplicate event",
        body: error.message,
        variant: "destructive",
      });
    },
  });

  const duplicateEvent = useCallback(
    (eventId: string) => mutation.mutate(eventId),
    [mutation],
  );

  return { duplicateEvent, duplicating: mutation.isPending };
}
