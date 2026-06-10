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
