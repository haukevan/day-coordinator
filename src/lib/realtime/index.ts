/**
 * Realtime — all real-time emission lives here via Supabase Broadcast.
 *
 * Channel naming: event-{eventId}
 *
 * Events:
 *   task.created | task.updated | task.started | task.completed | task.delayed
 *   subtask.created | subtask.updated | subtask.deleted
 *   notification.sent
 *
 * Emission uses the Realtime broadcast REST endpoint (one HTTP request) rather
 * than subscribing and waiting for a channel. It is best-effort: failures are
 * logged and never block the mutation that triggered them.
 */

const BROADCAST_TIMEOUT_MS = 3000;

/**
 * Emit a real-time broadcast to the event-scoped channel.
 * Server-side only.
 */
export async function emitEventUpdate(
  eventId: string,
  eventName: string,
  data: Record<string, unknown>,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn("Realtime broadcast skipped: Supabase env vars are missing");
    return;
  }

  try {
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `event-${eventId}`,
            event: eventName,
            payload: data,
          },
        ],
      }),
      signal: AbortSignal.timeout(BROADCAST_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`Realtime broadcast failed: ${res.status}`);
    }
  } catch (error) {
    // Realtime is best-effort — never fail the request that emitted it.
    console.warn("Realtime broadcast skipped", error);
  }
}
