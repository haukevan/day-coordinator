import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sendNotification } from "@/lib/notifications";

/**
 * GET /api/cron/send-notifications
 *
 * Unified dispatch cron — sends all PENDING notifications that are due.
 * Designed to be hit every 1 minute by an external cron service (cron-job.org).
 *
 * Protected by CRON_SECRET bearer token.
 *
 * Logic:
 * 1. Find all PENDING notifications where scheduledAt is null or ≤ now
 * 2. Call sendNotification(id) for each (idempotent — safe to re-run)
 * 3. Return counts
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

  // Find all PENDING notifications that are due now
  const due = await prisma.notification.findMany({
    where: {
      status: "PENDING",
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
    },
    select: { id: true },
  });

  if (due.length === 0) {
    return NextResponse.json({ dispatched: 0 });
  }

  const results = await Promise.allSettled(
    due.map((n) => sendNotification(n.id)),
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ dispatched: succeeded, failed });
}
