import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentDbUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { TimelineView } from "@/components/timeline/timeline-view";
import type { SerializedTask } from "@/lib/types";

export default async function VendorTimelinePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const dbUser = await getCurrentDbUser();
  if (!dbUser) redirect("/login");

  // Verify vendor membership (layout also checks, but keep defense-in-depth)
  // and load tasks in parallel.
  const [eventVendor, tasks] = await Promise.all([
    prisma.eventVendor.findFirst({
      where: { eventId, userId: dbUser.id, status: "ACCEPTED" },
      include: {
        event: {
          select: { id: true, timezone: true, eventDate: true, status: true },
        },
      },
    }),
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
                userId: true,
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
    }),
  ]);
  if (!eventVendor) notFound();

  const isCoordinator = eventVendor.role === "COORDINATOR";

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
      eventVendor: {
        id: tv.eventVendor.id,
        company: tv.eventVendor.company,
        jobTitle: tv.eventVendor.jobTitle,
        vendorContact: tv.eventVendor.vendorContact,
      },
    })),
  }));

  return (
    <div>
      <Suspense fallback={null}>
        <TimelineView
          eventId={eventId}
          tasks={serializedTasks}
          timezone={eventVendor.event.timezone}
          eventDate={
            eventVendor.event.eventDate
              ? eventVendor.event.eventDate.toISOString()
              : null
          }
          userRole={isCoordinator ? "admin" : "vendor"}
          currentUserId={dbUser.id}
          eventStatus={eventVendor.event.status}
          vendorEventVendorId={isCoordinator ? undefined : eventVendor.id}
        />
      </Suspense>
    </div>
  );
}
