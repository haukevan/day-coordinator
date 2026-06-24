import { prisma } from "@/lib/db/prisma";

/** Reusable result shape for resource limit checks. */
export interface LimitCheck {
  allowed: boolean;
  current: number;
  max: number;
}

// ─── Per-user limits ─────────────────────────────────────────────────────────

const MAX_EVENTS_PER_USER = 50;
const MAX_VENUES_PER_USER = 100;
const MAX_VENDOR_CONTACTS_PER_USER = 500;

export async function checkEventLimit(userId: string): Promise<LimitCheck> {
  const count = await prisma.event.count({ where: { ownerId: userId } });
  return {
    allowed: count < MAX_EVENTS_PER_USER,
    current: count,
    max: MAX_EVENTS_PER_USER,
  };
}

export async function checkVenueLimit(userId: string): Promise<LimitCheck> {
  const count = await prisma.venue.count({ where: { creatorId: userId } });
  return {
    allowed: count < MAX_VENUES_PER_USER,
    current: count,
    max: MAX_VENUES_PER_USER,
  };
}

export async function checkVendorContactLimit(
  userId: string,
): Promise<LimitCheck> {
  const count = await prisma.vendorContact.count({
    where: { ownerId: userId },
  });
  return {
    allowed: count < MAX_VENDOR_CONTACTS_PER_USER,
    current: count,
    max: MAX_VENDOR_CONTACTS_PER_USER,
  };
}

// ─── Per-event limits ────────────────────────────────────────────────────────

const MAX_TASKS_PER_EVENT = 500;
const MAX_VENDORS_PER_EVENT = 200;

export async function checkTaskLimit(eventId: string): Promise<LimitCheck> {
  const count = await prisma.task.count({ where: { eventId } });
  return {
    allowed: count < MAX_TASKS_PER_EVENT,
    current: count,
    max: MAX_TASKS_PER_EVENT,
  };
}

export async function checkVendorLimit(eventId: string): Promise<LimitCheck> {
  const count = await prisma.eventVendor.count({ where: { eventId } });
  return {
    allowed: count < MAX_VENDORS_PER_EVENT,
    current: count,
    max: MAX_VENDORS_PER_EVENT,
  };
}

// ─── Per-task limits ─────────────────────────────────────────────────────────

const MAX_SUBTASKS_PER_TASK = 100;

export async function checkSubtaskLimit(taskId: string): Promise<LimitCheck> {
  const count = await prisma.subTask.count({ where: { taskId } });
  return {
    allowed: count < MAX_SUBTASKS_PER_TASK,
    current: count,
    max: MAX_SUBTASKS_PER_TASK,
  };
}

// ─── Vendor invite throttle (per event, time-based) ──────────────────────────

const MAX_INVITES_PER_EVENT_PER_5MIN = 20;
const INVITE_THROTTLE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Check if an event has exceeded its vendor invite throttle.
 * Uses ActivityLog to count recent invites in the window.
 */
export async function checkVendorInviteThrottle(
  eventId: string,
): Promise<LimitCheck> {
  const windowStart = new Date(Date.now() - INVITE_THROTTLE_WINDOW_MS);
  const count = await prisma.activityLog.count({
    where: {
      eventId,
      action: "vendor.invite_sent",
      createdAt: { gte: windowStart },
    },
  });
  return {
    allowed: count < MAX_INVITES_PER_EVENT_PER_5MIN,
    current: count,
    max: MAX_INVITES_PER_EVENT_PER_5MIN,
  };
}
