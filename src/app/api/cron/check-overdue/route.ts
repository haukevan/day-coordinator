import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  createNotification,
  resolveCoordinatorUserIds,
  buildIdempotencyKey,
} from "@/lib/notifications/helpers";

/**
 * GET /api/cron/check-overdue
 *
 * Scans all LIVE events for overdue tasks and creates TASK_OVERDUE
 * notifications. Also checks if all tasks are complete and creates
 * EVENT_ALL_COMPLETE notifications.
 *
 * Designed to be hit every 5 minutes by cron-job.org.
 * Protected by CRON_SECRET bearer token.
 *
 * Idempotent via 5-minute time buckets — won't re-notify for the
 * same task within the same window.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // 5-minute bucket for idempotency (prevents re-notification in same window)
  const bucket = Math.floor(now.getTime() / 300000).toString();

  // Find all LIVE events
  const liveEvents = await prisma.event.findMany({
    where: { status: "LIVE" },
    select: { id: true, title: true },
  });

  let overdueCreated = 0;
  let allCompleteCreated = 0;

  for (const event of liveEvents) {
    // ── Overdue tasks ──────────────────────────────────────────────────
    const overdueTasks = await prisma.task.findMany({
      where: {
        eventId: event.id,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        scheduledEnd: { lt: now },
      },
      select: { id: true, title: true, assignedToId: true },
    });

    if (overdueTasks.length > 0) {
      const coordinatorIds = await resolveCoordinatorUserIds(event.id);

      for (const task of overdueTasks) {
        const payload = {
          title: "Task Overdue",
          body: `"${task.title}" is past its scheduled end time.`,
          data: { url: `/events/${event.id}/timeline` },
          requireInteraction: true,
        };

        // PUSH to assignee
        if (task.assignedToId) {
          await createNotification({
            eventId: event.id,
            type: "TASK_OVERDUE",
            channel: "PUSH",
            recipient: task.assignedToId,
            payload,
            idempotencyKey: buildIdempotencyKey(
              "TASK_OVERDUE",
              event.id,
              task.id,
              bucket,
            ),
          });
        }

        // PUSH + SMS to coordinators
        for (const cid of coordinatorIds) {
          await createNotification({
            eventId: event.id,
            type: "TASK_OVERDUE",
            channel: "PUSH",
            recipient: cid,
            payload,
            idempotencyKey: buildIdempotencyKey(
              "TASK_OVERDUE",
              event.id,
              `coordinator-${cid}-${task.id}`,
              bucket,
            ),
          });
          await createNotification({
            eventId: event.id,
            type: "TASK_OVERDUE",
            channel: "SMS",
            recipient: cid,
            payload: {
              body: `[Day Coordinator] "${task.title}" is overdue in "${event.title}".`,
            },
            idempotencyKey: buildIdempotencyKey(
              "TASK_OVERDUE",
              event.id,
              `coordinator-sms-${cid}-${task.id}`,
              bucket,
            ),
          });
        }

        overdueCreated++;
      }
    }

    // ── All tasks complete ─────────────────────────────────────────────
    const taskCounts = await prisma.task.groupBy({
      by: ["status"],
      where: { eventId: event.id },
      _count: { status: true },
    });

    const total = taskCounts.reduce((sum, t) => sum + t._count.status, 0);
    if (total === 0) continue;

    const completedOrSkipped = taskCounts
      .filter((t) => t.status === "COMPLETED" || t.status === "SKIPPED")
      .reduce((sum, t) => sum + t._count.status, 0);

    if (completedOrSkipped === total) {
      const coordinatorIds = await resolveCoordinatorUserIds(event.id);
      const payload = {
        title: "All Tasks Complete",
        body: `Every task in "${event.title}" has been completed!`,
        data: { url: `/events/${event.id}/timeline` },
      };

      for (const cid of coordinatorIds) {
        await createNotification({
          eventId: event.id,
          type: "EVENT_ALL_COMPLETE",
          channel: "PUSH",
          recipient: cid,
          payload,
          idempotencyKey: buildIdempotencyKey(
            "EVENT_ALL_COMPLETE",
            event.id,
            cid,
            bucket,
          ),
        });
      }

      allCompleteCreated++;
    }
  }

  return NextResponse.json({
    eventsScanned: liveEvents.length,
    overdueCreated,
    allCompleteCreated,
  });
}
