import { notFound, redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { alignTaskDatesToEvent } from "@/lib/scheduler/reanchor";
import { TimelineView } from "@/components/timeline/timeline-view";
import type { SerializedTask } from "@/lib/types";

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const dbUser = await getCurrentDbUser();
  if (!dbUser) redirect("/login");

  const loadTasks = () =>
    prisma.task.findMany({
      where: { eventId },
      orderBy: [{ scheduledStart: "asc" }, { createdAt: "asc" }],
      include: {
        parentTask: { select: { id: true, title: true } },
        taskVendors: {
          include: {
            eventVendor: {
              select: {
                id: true,
                company: true,
                jobTitle: true,
                vendorContact: {
                  select: {
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

  const [event, initialTasks] = await Promise.all([
    prisma.event.findFirst({
      where: { id: eventId, ownerId: dbUser.id },
      select: { id: true, timezone: true, eventDate: true, status: true },
    }),
    loadTasks(),
  ]);

  if (!event) notFound();

  // Repair task instants that are still anchored far from the event date
  // (e.g. a duplicated event that kept a summer anchor). This keeps the
  // displayed clock times identical while making the timezone label correct.
  let tasks = initialTasks;
  if (event.eventDate) {
    const aligned = await alignTaskDatesToEvent(
      eventId,
      event.eventDate,
      event.timezone,
      tasks,
    );
    if (aligned > 0) tasks = await loadTasks();
  }

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
    delayAmountMins: t.delayAmountMins,
    manualOverride: t.manualOverride,
    sequenceLabel: t.sequenceLabel,
    parentTaskId: t.parentTaskId,
    parentTask: t.parentTask ?? null,
    publicVisibility: t.publicVisibility,
    eventId: t.eventId,
    assignedToId: t.assignedToId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    taskVendors: t.taskVendors.map((tv) => ({
      eventVendorId: tv.eventVendorId,
      eventVendor: tv.eventVendor,
    })),
  }));

  return (
    <div>
      <TimelineView
        eventId={eventId}
        tasks={serializedTasks}
        timezone={event.timezone}
        eventDate={event.eventDate ? event.eventDate.toISOString() : null}
        eventStatus={event.status}
        userRole="admin"
        currentUserId={dbUser.id}
      />
    </div>
  );
}
