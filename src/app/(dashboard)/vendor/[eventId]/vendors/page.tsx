import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { VendorList } from "@/components/event/vendors/vendor-list";
import type { SerializedVendor } from "@/lib/types";

export default async function VendorVendorsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
  });
  if (!dbUser) redirect("/login");

  const membership = await prisma.eventVendor.findFirst({
    where: { eventId, userId: dbUser.id, status: "ACCEPTED" },
  });
  if (!membership) notFound();

  const eventVendors = await prisma.eventVendor.findMany({
    where: { eventId },
    include: { vendorContact: true },
    orderBy: { createdAt: "asc" },
  });

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { ownerId: true },
  });
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
    inviteSentAt: ev.inviteSentAt?.toISOString() ?? null,
    joinedAt: ev.joinedAt?.toISOString() ?? null,
    createdAt: ev.createdAt.toISOString(),
    updatedAt: ev.updatedAt.toISOString(),
    email: ev.vendorContact.email,
    firstName: ev.vendorContact.firstName,
    lastName: ev.vendorContact.lastName,
    phone: ev.vendorContact.phone,
  }));

  return <VendorList eventId={eventId} vendors={vendors} userRole="vendor" />;
}
