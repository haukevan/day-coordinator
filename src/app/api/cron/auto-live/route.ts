import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { emitEventUpdate } from "@/lib/realtime";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const dueEvents = await prisma.event.findMany({
    where: {
      status: "SCHEDULED",
      eventDate: { lte: now },
    },
    select: { id: true, title: true },
  });

  if (dueEvents.length === 0) {
    return NextResponse.json({ transitioned: 0 });
  }

  const results = await Promise.allSettled(
    dueEvents.map(async (event) => {
      await prisma.event.update({
        where: { id: event.id },
        data: { status: "LIVE", liveStartedAt: now },
      });

      await prisma.activityLog.create({
        data: {
          eventId: event.id,
          action: "event.live_started",
          metadata: { from: "SCHEDULED", to: "LIVE", trigger: "auto-cron" },
        },
      });

      await emitEventUpdate(event.id, "event.live_started", {
        eventId: event.id,
        status: "LIVE",
      });
    }),
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ transitioned: succeeded, failed });
}
