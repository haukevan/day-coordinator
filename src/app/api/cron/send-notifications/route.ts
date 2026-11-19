import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sendNotification } from "@/lib/notifications";
import {
  createNotification,
  resolveCoordinatorUserIds,
  buildIdempotencyKey,
} from "@/lib/notifications/helpers";

/**
 * GET /api/cron/send-notifications
 *
 * Unified notification cron — runs every 1 minute via external cron service.
 * Protected by CRON_SECRET bearer token.
 *
 * Three phases, executed in order:
 *
 *   Phase A — Dispatch due scheduled notifications
 *     Finds all PENDING rows where scheduledAt ≤ now (or null, for retries)
 *     and dispatches them via sendNotification().
 *
 *   Phase B — Overdue task notifications
 *     Scans LIVE events for tasks past their scheduledEnd that are still
 *     PENDING or IN_PROGRESS. Creates + immediately dispatches TASK_OVERDUE
 *     notifications (PUSH + SMS) for assignees and coordinators.
 *     Idempotent via 5-minute time buckets.
 *
 *   Phase C — All-complete event notifications
 *     Scans LIVE events where every task is COMPLETED or SKIPPED.
 *     Creates + immediately dispatches EVENT_ALL_COMPLETE (PUSH).
 *     Idempotent via 5-minute time buckets.
 *
 * Setup (cron-job.org, free tier):
 *   URL: https://<your-domain>/api/cron/send-notifications
 *   Method: GET
 *   Interval: Every 1 minute
 *   Headers → Custom: Authorization = Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const bucket = Math.floor(now.getTime() / 300000).toString();

  // ── Phase A: Dispatch due scheduled notifications ────────────────────
  const due = await prisma.notification.findMany({
    where: {
      status: "PENDING",
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
    },
    select: { id: true },
  });

  let scheduledSent = 0;
  let scheduledSkipped = 0;
  let scheduledFailed = 0;
  const dispatchErrors: string[] = [];

  if (due.length > 0) {
    const results = await Promise.allSettled(
      due.map((n) => sendNotification(n.id)),
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        if (r.value === "SENT") scheduledSent++;
        else scheduledSkipped++;
      } else {
        scheduledFailed++;
        const err = (r as PromiseRejectedResult).reason;
        dispatchErrors.push(err instanceof Error ? err.message : String(err));
      }
    }
  }

  // ── Phase B: Overdue task notifications ──────────────────────────────
  const liveEvents = await prisma.event.findMany({
    where: { status: "LIVE" },
    select: { id: true, title: true },
  });

  let overdueCreated = 0;
  let overdueSent = 0;

  for (const event of liveEvents) {
    const overdueTasks = await prisma.task.findMany({
      where: {
        eventId: event.id,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        scheduledEnd: { lt: now },
      },
      select: { id: true, title: true, assignedToId: true },
    });

    if (overdueTasks.length === 0) continue;

    const coordinatorIds = await resolveCoordinatorUserIds(event.id);

    for (const task of overdueTasks) {
      const pushPayload = {
        title: "Task Overdue",
        body: `"${task.title}" is past its scheduled end time.`,
        data: { url: `/events/${event.id}/timeline` },
        requireInteraction: true,
      };

      // PUSH + SMS to assignee
      if (task.assignedToId) {
        const nid = await createNotification({
          eventId: event.id,
          type: "TASK_OVERDUE",
          channel: "PUSH",
          recipient: task.assignedToId,
          payload: pushPayload,
          idempotencyKey: buildIdempotencyKey(
            "TASK_OVERDUE",
            event.id,
            task.id,
            bucket,
          ),
        });
        if (nid) {
          await sendNotification(nid).catch(() => {});
          overdueSent++;
        }
        overdueCreated++;

        const smsNid = await createNotification({
          eventId: event.id,
          type: "TASK_OVERDUE",
          channel: "SMS",
          recipient: task.assignedToId,
          payload: {
            body: `[Day Coordinator] "${task.title}" is overdue in "${event.title}".`,
          },
          idempotencyKey: buildIdempotencyKey(
            "TASK_OVERDUE",
            event.id,
            `sms-${task.id}`,
            bucket,
          ),
        });
        if (smsNid) {
          await sendNotification(smsNid).catch(() => {});
          overdueSent++;
        }
        overdueCreated++;
      }

      // PUSH + SMS to coordinators
      for (const cid of coordinatorIds) {
        const nid = await createNotification({
          eventId: event.id,
          type: "TASK_OVERDUE",
          channel: "PUSH",
          recipient: cid,
          payload: pushPayload,
          idempotencyKey: buildIdempotencyKey(
            "TASK_OVERDUE",
            event.id,
            `coordinator-${cid}-${task.id}`,
            bucket,
          ),
        });
        if (nid) {
          await sendNotification(nid).catch(() => {});
          overdueSent++;
        }
        overdueCreated++;

        const smsNid = await createNotification({
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
        if (smsNid) {
          await sendNotification(smsNid).catch(() => {});
          overdueSent++;
        }
        overdueCreated++;
      }
    }

    // ── Phase C: All-complete check (per event) ────────────────────────
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
      const payload = {
        title: "All Tasks Complete",
        body: `Every task in "${event.title}" has been completed!`,
        data: { url: `/events/${event.id}/timeline` },
      };

      for (const cid of coordinatorIds) {
        const nid = await createNotification({
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
        if (nid) {
          await sendNotification(nid).catch(() => {});
          overdueSent++;
        }
        overdueCreated++;
      }
    }
  }

  // ── Response ─────────────────────────────────────────────────────────
  const uniqueErrors = [...new Set(dispatchErrors)];
  if (scheduledFailed > 0) {
    console.error(
      `[send-notifications] Phase A: ${scheduledFailed} dispatch failures:`,
      uniqueErrors.join(" | "),
    );
  }

  return NextResponse.json({
    scheduled: {
      total: due.length,
      sent: scheduledSent,
      skipped: scheduledSkipped,
      failed: scheduledFailed,
      errors: uniqueErrors,
    },
    overdue: {
      eventsScanned: liveEvents.length,
      created: overdueCreated,
      sent: overdueSent,
    },
  });
}
