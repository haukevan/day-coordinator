import { prisma } from "./prisma";

/**
 * Check if the authenticated user can manage an event's tasks and vendors.
 * Returns true if the user is the event owner OR an accepted coordinator.
 */
export async function canManageEvent(
  eventId: string,
  userId: string,
): Promise<boolean> {
  // Check owner
  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId: userId },
    select: { id: true },
  });
  if (event) return true;

  // Check coordinator
  const coordinator = await prisma.eventVendor.findFirst({
    where: { eventId, userId, status: "ACCEPTED", role: "COORDINATOR" },
    select: { id: true },
  });
  return Boolean(coordinator);
}

/**
 * Check if a user is an accepted vendor assigned to a specific task.
 * Used for sub-task visibility — only vendors on the parent task can see sub-tasks.
 */
export async function isVendorAssignedToTask(
  taskId: string,
  userId: string,
): Promise<boolean> {
  const taskVendor = await prisma.taskVendor.findFirst({
    where: {
      taskId,
      eventVendor: { userId, status: "ACCEPTED" },
    },
    select: { taskId: true },
  });
  return Boolean(taskVendor);
}

/**
 * Check if a user is an accepted vendor assigned to a specific sub-task.
 * Used for checklist item status changes — only assigned vendors can toggle.
 */
export async function isVendorAssignedToSubTask(
  subTaskId: string,
  userId: string,
): Promise<boolean> {
  const assignment = await prisma.subTaskVendor.findFirst({
    where: {
      subTaskId,
      eventVendor: { userId, status: "ACCEPTED" },
    },
    select: { subTaskId: true },
  });
  return Boolean(assignment);
}

/**
 * Get the EventVendor id for an accepted vendor user in an event.
 * Returns null if the user is not an accepted vendor.
 */
export async function getAcceptedEventVendorId(
  eventId: string,
  userId: string,
): Promise<string | null> {
  const ev = await prisma.eventVendor.findFirst({
    where: { eventId, userId, status: "ACCEPTED" },
    select: { id: true },
  });
  return ev?.id ?? null;
}
