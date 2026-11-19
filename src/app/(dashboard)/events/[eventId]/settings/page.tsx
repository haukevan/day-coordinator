import { notFound, redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { EventSettingsForm } from "@/components/dashboard/event-settings-form";

export default async function EventSettingsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const dbUser = await getCurrentDbUser();
  if (!dbUser) redirect("/login");

  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId: dbUser.id },
    select: {
      id: true,
      title: true,
      description: true,
      eventDate: true,
      timezone: true,
      slug: true,
      status: true,
      publicTimeline: true,
      venueId: true,
      updatedAt: true,
    },
  });

  if (!event) notFound();

  const serialized = {
    id: event.id,
    title: event.title,
    description: event.description,
    eventDate: event.eventDate ? event.eventDate.toISOString() : null,
    timezone: event.timezone,
    slug: event.slug,
    status: event.status as
      | "DRAFT"
      | "SCHEDULED"
      | "LIVE"
      | "COMPLETED"
      | "ARCHIVED",
    publicTimeline: event.publicTimeline,
    venueId: event.venueId,
  };

  return (
    <EventSettingsForm key={event.updatedAt.toISOString()} event={serialized} />
  );
}
