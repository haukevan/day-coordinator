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
import { emitEventUpdate } from "@/lib/realtime";

/**
 * Send a pending notification by ID.
 * Idempotent — safe to call multiple times on the same notificationId.
 *
 * @returns "SENT" | "SKIPPED" — the final status of the notification
 */
export async function sendNotification(
  notificationId: string,
): Promise<"SENT" | "SKIPPED"> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) return "SKIPPED";

  // Idempotency guard
  if (notification.status === "SENT" || notification.status === "SKIPPED") {
    return notification.status;
  }

  // Preference gate — check if this user has disabled this channel.
  // Push/SMS toggles only affect external delivery; the notification row
  // already exists in the DB for in-app (bell) display.
  const vendorPref = await prisma.eventVendor.findFirst({
    where: { eventId: notification.eventId, userId: notification.recipient },
    select: { pushEnabled: true, smsEnabled: true },
  });

  if (notification.channel === "PUSH" && vendorPref?.pushEnabled === false) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: "SKIPPED" },
    });
    return "SKIPPED";
  }

  // SMS: opt-in — requires explicit true. null/false/missing row = skipped.
  if (notification.channel === "SMS" && vendorPref?.smsEnabled !== true) {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: "SKIPPED" },
    });
    return "SKIPPED";
  }

  try {
    // Dispatch via channel
    if (notification.channel === "PUSH") {
      const { sent, failed } = await sendPush(
        notification.recipient,
        notification.payload as unknown as Jsonifiable,
      );
      // No subscriptions at all — skip gracefully
      if (sent === 0 && failed === 0) {
        await prisma.notification.update({
          where: { id: notificationId },
          data: { status: "SKIPPED" },
        });
        return "SKIPPED";
      }
      if (failed > 0 && sent === 0) {
        throw new Error(`Push dispatch failed for all ${failed} subscriptions`);
      }
    } else if (notification.channel === "SMS") {
      // Resolve phone number: strictly event-scoped for vendors, User profile
      // fallback only for owners (no EventVendor row). A vendor with no
      // VendorContact.phone should never receive SMS, even if User.phone exists.
      let phone: string | null = null;

      const eventVendor = await prisma.eventVendor.findFirst({
        where: {
          eventId: notification.eventId,
          userId: notification.recipient,
        },
        select: { vendorContact: { select: { phone: true } } },
      });

      if (eventVendor) {
        // Vendor: only the event-scoped phone matters — no fallback
        phone = eventVendor.vendorContact?.phone ?? null;
      } else {
        // Owner (no EventVendor row): use User.phone
        const user = await prisma.user.findUnique({
          where: { id: notification.recipient },
          select: { phone: true },
        });
        phone = user?.phone ?? null;
      }

      if (!phone) {
        await prisma.notification.update({
          where: { id: notificationId },
          data: { status: "SKIPPED" },
        });
        return "SKIPPED";
      }
      const body =
        typeof (notification.payload as Record<string, unknown>).body ===
        "string"
          ? (notification.payload as Record<string, unknown>).body
          : JSON.stringify(notification.payload);
      await sendSms(phone, body as string);
    } else if (notification.channel === "EMAIL") {
      // Resolve userId → email
      const user = await prisma.user.findUnique({
        where: { id: notification.recipient },
        select: { email: true },
      });
      if (!user?.email) {
        await prisma.notification.update({
          where: { id: notificationId },
          data: { status: "SKIPPED" },
        });
        return "SKIPPED";
      }
      const p = notification.payload as Record<string, unknown>;
      const subject =
        typeof p.subject === "string" ? p.subject : "Day Coordinator";
      const html =
        typeof p.html === "string"
          ? p.html
          : `<p>${typeof p.body === "string" ? p.body : JSON.stringify(p)}</p>`;
      await sendEmail(user.email, subject, html);
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

    // Broadcast real-time event so the bell badge updates immediately
    try {
      await emitEventUpdate(notification.eventId, "notification.sent", {
        notificationId,
        type: notification.type,
        payload: notification.payload as Record<string, unknown>,
        eventId: notification.eventId,
      });
    } catch (err) {
      // Real-time is best-effort — don't fail the send if broadcast errors
      console.error("[notifications] Failed to emit real-time event:", err);
    }

    return "SENT";
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
