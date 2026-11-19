/**
 * Notification helpers — create Notification rows and resolve recipients.
 *
 * All functions are server-side only (use Prisma directly).
 */

import { prisma } from "@/lib/db/prisma";
import type {
  NotificationType,
  NotificationChannel,
  Prisma,
} from "@/generated/prisma/client";

/**
 * Create a Notification row. Idempotent via idempotencyKey.
 *
 * Safety gate (silently skip):
 * - Event is DRAFT or ARCHIVED
 *
 * Preference gating (pushEnabled/smsEnabled) happens at dispatch time
 * in sendNotification(), NOT here. This ensures notification rows always
 * exist for the in-app bell, even when external delivery is disabled.
 *
 * Returns the notification ID so callers can immediately dispatch,
 * or `null` if the notification was gated (not created).
 */
export async function createNotification(params: {
  eventId: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipient: string;
  payload: Prisma.JsonObject;
  idempotencyKey: string;
  scheduledAt?: Date;
}): Promise<string | null> {
  // Global event state gate — no notifications for DRAFT or ARCHIVED
  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    select: { status: true },
  });
  if (!event || event.status === "DRAFT" || event.status === "ARCHIVED") {
    return null;
  }

  // Always create the row — preference gating happens at dispatch time.
  // This ensures in-app notifications (bell) always work, even when
  // external Push/SMS delivery is disabled by user preferences.

  const result = await prisma.notification.upsert({
    where: { idempotencyKey: params.idempotencyKey },
    update: {}, // no-op — already exists
    create: {
      eventId: params.eventId,
      type: params.type,
      channel: params.channel,
      recipient: params.recipient,
      payload: params.payload,
      idempotencyKey: params.idempotencyKey,
      scheduledAt: params.scheduledAt ?? null,
    },
  });

  return result.id;
}

/**
 * Resolve all coordinator user IDs for an event.
 *
 * Coordinators = event owner + all EventVendors with role=COORDINATOR who have accepted.
 * Returns unique user IDs (deduplicated).
 */
export async function resolveCoordinatorUserIds(
  eventId: string,
): Promise<string[]> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { ownerId: true },
  });

  if (!event) return [];

  const coordinatorVendors = await prisma.eventVendor.findMany({
    where: {
      eventId,
      role: "COORDINATOR",
      status: "ACCEPTED",
      userId: { not: null },
    },
    select: { userId: true },
  });

  const ids = new Set<string>();
  ids.add(event.ownerId);
  for (const cv of coordinatorVendors) {
    if (cv.userId) ids.add(cv.userId);
  }

  return Array.from(ids);
}

/**
 * Get the userId for a notification recipient string.
 *
 * Validates that the user exists and returns their ID.
 * Returns null if the user doesn't exist.
 */
export async function resolveUserId(
  recipientId: string,
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { id: true },
  });
  return user?.id ?? null;
}

/**
 * Build an idempotency key in the format: <type>:<eventId>:<entityId>:<bucket>
 *
 * The bucket prevents collisions for recurring notifications
 * (e.g., one reminder per hour).
 */
export function buildIdempotencyKey(
  type: NotificationType,
  eventId: string,
  entityId: string,
  bucket?: string,
): string {
  return [type, eventId, entityId, bucket].filter(Boolean).join(":");
}

/**
 * Create (or recreate) event reminder notifications for the 24h and 2h marks.
 *
 * Deletes any existing EVENT_REMINDER_24H / EVENT_REMINDER_2H notifications
 * for this event first, then creates new ones with the correct scheduledAt.
 *
 * Safe to call multiple times (e.g., when event date changes).
 */
export async function createEventReminders(
  eventId: string,
  eventDate: Date,
): Promise<void> {
  // Delete existing reminders for this event
  await prisma.notification.deleteMany({
    where: {
      eventId,
      type: { in: ["EVENT_REMINDER_24H", "EVENT_REMINDER_2H"] },
      status: "PENDING",
    },
  });

  const coordinatorIds = await resolveCoordinatorUserIds(eventId);
  if (coordinatorIds.length === 0) return;

  // 24-hour reminder
  const reminder24h = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
  // 2-hour reminder
  const reminder2h = new Date(eventDate.getTime() - 2 * 60 * 60 * 1000);
  const now = new Date();

  for (const userId of coordinatorIds) {
    const payload = {
      title: "Event Reminder",
      body: "Your event is coming up!",
      data: { url: `/events/${eventId}/timeline` },
    };

    // Only create reminders that are in the future
    if (reminder24h > now) {
      await createNotification({
        eventId,
        type: "EVENT_REMINDER_24H",
        channel: "PUSH",
        recipient: userId,
        payload,
        idempotencyKey: buildIdempotencyKey(
          "EVENT_REMINDER_24H",
          eventId,
          userId,
        ),
        scheduledAt: reminder24h,
      });
      await createNotification({
        eventId,
        type: "EVENT_REMINDER_24H",
        channel: "SMS",
        recipient: userId,
        payload: { body: `Reminder: your event is in 24 hours.` },
        idempotencyKey: buildIdempotencyKey(
          "EVENT_REMINDER_24H",
          eventId,
          `sms-${userId}`,
        ),
        scheduledAt: reminder24h,
      });
    }

    if (reminder2h > now) {
      await createNotification({
        eventId,
        type: "EVENT_REMINDER_2H",
        channel: "PUSH",
        recipient: userId,
        payload,
        idempotencyKey: buildIdempotencyKey(
          "EVENT_REMINDER_2H",
          eventId,
          userId,
        ),
        scheduledAt: reminder2h,
      });
      await createNotification({
        eventId,
        type: "EVENT_REMINDER_2H",
        channel: "SMS",
        recipient: userId,
        payload: { body: `Reminder: your event is in 2 hours!` },
        idempotencyKey: buildIdempotencyKey(
          "EVENT_REMINDER_2H",
          eventId,
          `sms-${userId}`,
        ),
        scheduledAt: reminder2h,
      });
    }
  }
}
