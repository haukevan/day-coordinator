import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentDbUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  reanchorTasksToEventDate,
  tasksNeedReanchor,
} from "@/lib/scheduler/reanchor";
import { TimelineView } from "@/components/timeline/timeline-view";
import { TaskRowSkeletonList } from "@/components/ui/skeletons";
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

  // Self-heal legacy tasks that were anchored to a different day (for example
  // tasks created before the event date was set). Anchored events skip this.
  let tasks = initialTasks;
  if (
    event.eventDate &&
    tasksNeedReanchor(tasks, event.eventDate, event.timezone)
  ) {
    await reanchorTasksToEventDate(eventId, event.eventDate, event.timezone);
    tasks = await loadTasks();
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
      <Suspense fallback={<TimelineSkeleton />}>
        <TimelineView
          eventId={eventId}
          tasks={serializedTasks}
          timezone={event.timezone}
          eventDate={event.eventDate ? event.eventDate.toISOString() : null}
          eventStatus={event.status}
          userRole="admin"
          currentUserId={dbUser.id}
        />
      </Suspense>
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="px-3 py-2 sm:p-6">
      <TaskRowSkeletonList count={6} />
    </div>
  );
}
