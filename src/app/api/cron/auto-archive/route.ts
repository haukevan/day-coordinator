import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { emitEventUpdate } from "@/lib/realtime";

/**
 * Cron: Auto-archive events that have been completed for > 24 hours.
 *
 * Invoked by an external scheduler (e.g. Vercel Cron, Trigger.dev).
 * Authorization: Bearer token matching CRON_SECRET env var.
 *
 * Rules:
 *  - Event must be LIVE.
 *  - All tasks must have a terminal status (COMPLETED or SKIPPED).
 *  - 24 hours must have elapsed since the latest task's actualEnd
 *    (falls back to scheduledEnd if actualEnd is null).
 */

const ARCHIVE_AFTER_HOURS = 24;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const archiveThreshold = new Date(
    now.getTime() - ARCHIVE_AFTER_HOURS * 60 * 60 * 1000,
  );

  // Find LIVE events where all tasks are terminal
  const liveEvents = await prisma.event.findMany({
    where: { status: "LIVE" },
    select: {
      id: true,
      title: true,
      tasks: {
        select: {
          id: true,
          status: true,
          actualEnd: true,
          scheduledEnd: true,
        },
      },
    },
  });

  const toArchive: string[] = [];

  for (const event of liveEvents) {
    const { tasks } = event;

    // Skip events with no tasks
    if (tasks.length === 0) continue;

    // All tasks must be COMPLETED or SKIPPED
    const allTerminal = tasks.every(
      (t) => t.status === "COMPLETED" || t.status === "SKIPPED",
    );
    if (!allTerminal) continue;

    // Find the latest end time (prefer actualEnd, fall back to scheduledEnd)
    let latestEndMs = 0;
    for (const task of tasks) {
      const endMs = task.actualEnd
        ? task.actualEnd.getTime()
        : task.scheduledEnd
          ? task.scheduledEnd.getTime()
          : 0;
      if (endMs > latestEndMs) latestEndMs = endMs;
    }

    if (latestEndMs === 0) continue;

    // Check if 24 hours have passed since the latest task ended
    if (latestEndMs <= archiveThreshold.getTime()) {
      toArchive.push(event.id);
    }
  }

  if (toArchive.length === 0) {
    return NextResponse.json({ archived: 0 });
  }

  const results = await Promise.allSettled(
    toArchive.map(async (eventId) => {
      await prisma.event.update({
        where: { id: eventId },
        data: { status: "ARCHIVED" },
      });

      await prisma.activityLog.create({
        data: {
          eventId,
          action: "event.archived",
          metadata: {
            from: "LIVE",
            to: "ARCHIVED",
            trigger: "auto-cron",
            reason: `${ARCHIVE_AFTER_HOURS}h after last task ended`,
          },
        },
      });

      await emitEventUpdate(eventId, "event.archived", {
        eventId,
        status: "ARCHIVED",
      });
    }),
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ archived: succeeded, failed });
}
