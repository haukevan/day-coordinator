import { notFound, redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { VendorList } from "@/components/event/vendors/vendor-list";
import type { SerializedVendor } from "@/lib/types";

export default async function VendorVendorsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const dbUser = await getCurrentDbUser();
  if (!dbUser) redirect("/login");

  const membership = await prisma.eventVendor.findFirst({
    where: { eventId, userId: dbUser.id, status: "ACCEPTED" },
  });
  if (!membership) notFound();

  const isCoordinator = membership.role === "COORDINATOR";

  const [eventVendors, event] = await Promise.all([
    prisma.eventVendor.findMany({
      where: { eventId },
      include: { vendorContact: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.event.findUnique({
      where: { id: eventId },
      select: { ownerId: true },
    }),
  ]);
  if (!event) notFound();

  const vendors: SerializedVendor[] = eventVendors.map((ev) => ({
    id: ev.id,
    eventId: ev.eventId,
    vendorContactId: ev.vendorContactId,
    userId: ev.userId,
    isEventOwner: ev.userId === event.ownerId,
    company: ev.company,
    jobTitle: ev.jobTitle,
    status: ev.status,
    role: ev.role,
    inviteSentAt: ev.inviteSentAt?.toISOString() ?? null,
    joinedAt: ev.joinedAt?.toISOString() ?? null,
    createdAt: ev.createdAt.toISOString(),
    updatedAt: ev.updatedAt.toISOString(),
    email: ev.vendorContact.email,
    firstName: ev.vendorContact.firstName,
    lastName: ev.vendorContact.lastName,
    phone: ev.vendorContact.phone,
  }));

  return (
    <VendorList
      eventId={eventId}
      vendors={vendors}
      userRole={isCoordinator ? "admin" : "vendor"}
      currentUserId={dbUser.id}
    />
  );
}
