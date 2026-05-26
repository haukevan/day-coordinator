import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { TimelineView } from "@/components/timeline/timeline-view";
import type { SerializedTask } from "@/lib/types";

export default async function TimelinePage({
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
    select: { id: true, timezone: true },
  });

  if (!event) notFound();

  const tasks = await prisma.task.findMany({
    where: { eventId },
    orderBy: [{ scheduledStart: "asc" }, { createdAt: "asc" }],
  });

  const serializedTasks: SerializedTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    scheduledStart: t.scheduledStart ? t.scheduledStart.toISOString() : null,
    scheduledEnd: t.scheduledEnd ? t.scheduledEnd.toISOString() : null,
    actualStart: t.actualStart ? t.actualStart.toISOString() : null,
    actualEnd: t.actualEnd ? t.actualEnd.toISOString() : null,
    durationMins: t.durationMins,
    manualOverride: t.manualOverride,
    parentTaskId: t.parentTaskId,
    publicVisibility: t.publicVisibility,
    eventId: t.eventId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return (
    <TimelineView
      eventId={eventId}
      tasks={serializedTasks}
      timezone={event.timezone}
    />
  );
}
