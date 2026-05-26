import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { EventSettingsForm } from "@/components/dashboard/event-settings-form";

export default async function EventSettingsPage({
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

  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId: dbUser.id },
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
  };

  return <EventSettingsForm event={serialized} />;
}
