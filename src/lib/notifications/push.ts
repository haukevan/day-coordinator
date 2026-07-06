/**
 * Web Push dispatch — server-side only.
 *
 * Uses @pushforge/builder (MIT, zero deps) which works in Vercel Edge/Node
 * via the standard Web Crypto API.
 *
 * @see https://www.npmjs.com/package/@pushforge/builder
 */

import { buildPushHTTPRequest } from "@pushforge/builder";
import { prisma } from "@/lib/db/prisma";

/** The email/URL contact required by Web Push protocol. */
const ADMIN_CONTACT = "mailto:noreply@daycoordinator.com";

/** JSON-serializable value type matching @pushforge/builder's expected payload. */
export type Jsonifiable =
  | string
  | number
  | boolean
  | null
  | Jsonifiable[]
  | { [key: string]: Jsonifiable };

/**
 * Send a push notification to all subscribed devices of a user.
 *
 * Fetches all PushSubscription rows for the given userId, then dispatches
 * to each one via the browser push service (FCM, APNs, Mozilla autopush).
 *
 * Gracefully handles:
 * - Expired subscriptions (410 Gone) — deletes the DB row automatically
 * - Network errors — logs and continues to next subscription
 *
 * @returns Counts of successful and failed dispatches.
 */
export async function sendPush(
  userId: string,
  payload: Jsonifiable,
): Promise<{ sent: number; failed: number }> {
  const privateKeyRaw = process.env.VAPID_PRIVATE_KEY;
  if (!privateKeyRaw) {
    throw new Error(
      "Missing VAPID_PRIVATE_KEY. Set it in the environment for this deployment.",
    );
  }

  const privateJWK = JSON.parse(privateKeyRaw);

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        const { endpoint, headers, body } = await buildPushHTTPRequest({
          privateJWK,
          subscription: {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          message: {
            payload,
            adminContact: ADMIN_CONTACT,
          },
        });

        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          // @pushforge/builder returns ArrayBuffer body
          body: body instanceof ArrayBuffer ? new Uint8Array(body) : body,
        });

        if (response.status === 410) {
          // Subscription expired or unsubscribed — clean up
          await prisma.pushSubscription.delete({
            where: { id: sub.id },
          });
          return { status: "expired" as const };
        }

        if (!response.ok) {
          throw new Error(
            `Push service returned ${response.status}: ${response.statusText}`,
          );
        }

        return { status: "sent" as const };
      } catch (err) {
        console.error(
          `[push] Failed to send to subscription ${sub.id}:`,
          err instanceof Error ? err.message : String(err),
        );
        throw err; // re-throw so Promise.allSettled captures it
      }
    }),
  );

  const sent = results.filter(
    (r) => r.status === "fulfilled" && r.value.status === "sent",
  ).length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return { sent, failed };
}
