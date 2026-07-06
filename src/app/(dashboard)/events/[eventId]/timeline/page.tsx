import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { TimelineView } from "@/components/timeline/timeline-view";
import { TaskRowSkeletonList } from "@/components/ui/skeletons";
import { NotificationBell } from "@/components/event/notification-bell";
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
    select: { id: true, timezone: true, eventDate: true, status: true },
  });

  if (!event) notFound();

  // Fetch per-event notification prefs for the current user
  const vendorPref = await prisma.eventVendor.findFirst({
    where: { eventId, userId: dbUser.id },
    select: { pushEnabled: true, smsEnabled: true },
  });

  const tasks = await prisma.task.findMany({
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
      <div className="flex items-center justify-end px-4 py-2">
        <NotificationBell
          eventId={eventId}
          eventStatus={event.status}
          initialPushEnabled={vendorPref?.pushEnabled ?? true}
          initialSmsEnabled={vendorPref?.smsEnabled ?? true}
        />
      </div>
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
