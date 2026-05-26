import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { emitEventUpdate } from "@/lib/realtime";
import { computeScheduledEnd, propagateSchedule } from "@/lib/scheduler";

type Params = { params: Promise<{ eventId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
  });
  if (!dbUser)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId: dbUser.id },
    select: { id: true },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tasks = await prisma.task.findMany({
    where: { eventId },
    orderBy: [{ scheduledStart: "asc" }, { createdAt: "asc" }],
    include: {
      parentTask: { select: { id: true, title: true } },
      _count: { select: { childTasks: true } },
    },
  });

  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
  });
  if (!dbUser)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId: dbUser.id },
    select: { id: true },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { title, description, durationMins, parentTaskId, scheduledStart } =
    body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  // Validate parentTaskId belongs to same event
  if (parentTaskId) {
    const parent = await prisma.task.findFirst({
      where: { id: parentTaskId, eventId },
    });
    if (!parent) {
      return NextResponse.json(
        { error: "Parent task not found in this event." },
        { status: 400 },
      );
    }
  }

  const task = await prisma.task.create({
    data: {
      eventId,
      title: title.trim(),
      description: description?.trim() || null,
      durationMins: durationMins ?? null,
      parentTaskId: parentTaskId ?? null,
      scheduledStart: scheduledStart ? new Date(scheduledStart) : null,
    },
  });

  // Compute scheduled end if we have start + duration
  if (task.scheduledStart && task.durationMins) {
    await computeScheduledEnd(task.id);
  }

  // Propagate schedule from parent
  if (parentTaskId) {
    await propagateSchedule(parentTaskId);
  }

  await prisma.activityLog.create({
    data: {
      eventId,
      userId: dbUser.id,
      action: "task.created",
      metadata: { taskId: task.id, title: task.title },
    },
  });

  await emitEventUpdate(eventId, "task.created", {
    eventId,
    taskId: task.id,
    title: task.title,
  });

  const fresh = await prisma.task.findUnique({ where: { id: task.id } });
  return NextResponse.json({ task: fresh }, { status: 201 });
}
