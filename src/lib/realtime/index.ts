/**
 * Realtime — all real-time emission lives here via Supabase Broadcast.
 *
 * Channel naming: event-{eventId}
 *
 * Events:
 *   task.created | task.updated | task.started | task.completed | task.delayed
 */

import { supabase } from "./supabase";

/**
 * Emit a real-time broadcast to the event-scoped channel.
 * Server-side only.
 */
export async function emitEventUpdate(
  eventId: string,
  eventName: string,
  data: Record<string, unknown>
): Promise<void> {
  await supabase.channel(`event-${eventId}`).send({
    type: "broadcast",
    event: eventName,
    payload: data,
  });
}
