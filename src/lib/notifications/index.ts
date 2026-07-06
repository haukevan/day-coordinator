/**
 * Notifications — direct dispatch (no queue for now).
 *
 * Rules:
 * - Always check NotificationStatus before sending (idempotency)
 * - Log every send/failure to ActivityLog
 * - Never call this from the UI — server-side only
 *
 * Queue-based scheduling (BullMQ) can be added later when needed.
 */

import { prisma } from "@/lib/db/prisma";
import { sendPush, type Jsonifiable } from "@/lib/notifications/push";
import { sendSms } from "@/lib/notifications/sms";
import { sendEmail } from "@/lib/notifications/email";

/**
 * Send a pending notification by ID.
 * Idempotent — safe to call multiple times on the same notificationId.
 */
export async function sendNotification(notificationId: string): Promise<void> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) return;

  // Idempotency guard
  if (notification.status === "SENT" || notification.status === "SKIPPED") {
    return;
  }

  try {
    // Dispatch via channel
    if (notification.channel === "PUSH") {
      const { sent, failed } = await sendPush(
        notification.recipient,
        notification.payload as unknown as Jsonifiable,
      );
      if (failed > 0 && sent === 0) {
        throw new Error(`Push dispatch failed for all ${failed} subscriptions`);
      }
    } else if (notification.channel === "SMS") {
      const body =
        typeof (notification.payload as Record<string, unknown>).body ===
        "string"
          ? (notification.payload as Record<string, unknown>).body
          : JSON.stringify(notification.payload);
      await sendSms(notification.recipient, body as string);
    } else if (notification.channel === "EMAIL") {
      const p = notification.payload as Record<string, unknown>;
      const subject =
        typeof p.subject === "string" ? p.subject : "Day Coordinator";
      const html =
        typeof p.html === "string"
          ? p.html
          : `<p>${typeof p.body === "string" ? p.body : JSON.stringify(p)}</p>`;
      await sendEmail(notification.recipient, subject, html);
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: "SENT", sentAt: new Date() },
    });

    await prisma.activityLog.create({
      data: {
        eventId: notification.eventId,
        action: "notification.sent",
        metadata: { notificationId },
      },
    });
  } catch (err) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: "FAILED" },
    });

    await prisma.activityLog.create({
      data: {
        eventId: notification.eventId,
        action: "notification.failed",
        metadata: {
          notificationId,
          error: err instanceof Error ? err.message : String(err),
        },
      },
    });

    throw err;
  }
}
