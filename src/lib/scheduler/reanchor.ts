import { addDays, differenceInCalendarDays, format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/db/prisma";

function localDate(date: Date, timeZone: string): string {
  return format(toZonedTime(date, timeZone), "yyyy-MM-dd");
}

function localTime(date: Date, timeZone: string): string {
  return format(toZonedTime(date, timeZone), "HH:mm:ss");
}

function dayOffsetBetween(fromDay: string, toDay: string): number {
  return differenceInCalendarDays(
    new Date(`${toDay}T12:00:00`),
    new Date(`${fromDay}T12:00:00`),
  );
}

/** Event calendar date, stored as UTC noon. */
export function eventCalendarDate(eventDate: Date): string {
  return eventDate.toISOString().slice(0, 10);
}

function shiftedDay(eventDay: string, offset: number): string {
  return format(
    addDays(new Date(`${eventDay}T12:00:00`), offset),
    "yyyy-MM-dd",
  );
}

/**
 * Re-anchor task times so their event-local calendar dates sit on the event
 * date, preserving local times of day and the set's relative day offsets.
 *
 * Returns the number of tasks updated.
 */
export async function reanchorTasksToEventDate(
  eventId: string,
  eventDate: Date,
  timeZone: string,
): Promise<number> {
  const eventDay = eventCalendarDate(eventDate);

  const tasks = await prisma.task.findMany({
    where: { eventId },
    select: { id: true, scheduledStart: true, scheduledEnd: true },
  });

  const scheduled = tasks.filter((task) => task.scheduledStart);
  if (scheduled.length === 0) return 0;

  // The earliest task date anchors the set; later tasks keep their offset.
  const anchorDay = scheduled
    .map((task) => localDate(task.scheduledStart!, timeZone))
    .sort()[0];

  const updates: Array<{
    id: string;
    scheduledStart?: Date;
    scheduledEnd?: Date;
  }> = [];

  for (const task of tasks) {
    if (!task.scheduledStart) continue;

    const startOffset = dayOffsetBetween(
      anchorDay,
      localDate(task.scheduledStart, timeZone),
    );
    const targetStartDay = shiftedDay(eventDay, startOffset);

    const update: { id: string; scheduledStart?: Date; scheduledEnd?: Date } = {
      id: task.id,
    };

    if (localDate(task.scheduledStart, timeZone) !== targetStartDay) {
      update.scheduledStart = fromZonedTime(
        `${targetStartDay}T${localTime(task.scheduledStart, timeZone)}`,
        timeZone,
      );
    }

    if (task.scheduledEnd) {
      const endOffset = dayOffsetBetween(
        anchorDay,
        localDate(task.scheduledEnd, timeZone),
      );
      const targetEndDay = shiftedDay(eventDay, endOffset);

      if (localDate(task.scheduledEnd, timeZone) !== targetEndDay) {
        update.scheduledEnd = fromZonedTime(
          `${targetEndDay}T${localTime(task.scheduledEnd, timeZone)}`,
          timeZone,
        );
      }
    }

    if (update.scheduledStart || update.scheduledEnd) {
      updates.push(update);
    }
  }

  if (updates.length === 0) return 0;

  await prisma.$transaction(
    updates.map((update) =>
      prisma.task.update({
        where: { id: update.id },
        data: {
          ...(update.scheduledStart
            ? { scheduledStart: update.scheduledStart }
            : {}),
          ...(update.scheduledEnd ? { scheduledEnd: update.scheduledEnd } : {}),
        },
      }),
    ),
  );

  return updates.length;
}

/**
 * True when the earliest task date is neither the event day nor the following
 * day (the form's supported +1 day offset). Used to self-heal legacy tasks
 * that were anchored before the event date was known.
 */
export function tasksNeedReanchor(
  tasks: Array<{ scheduledStart: Date | string | null }>,
  eventDate: Date | string,
  timeZone: string,
): boolean {
  const scheduled = tasks.filter((task) => task.scheduledStart);
  if (scheduled.length === 0) return false;

  const eventDay =
    typeof eventDate === "string"
      ? eventDate.slice(0, 10)
      : eventCalendarDate(eventDate);
  const nextDay = shiftedDay(eventDay, 1);

  const anchorDay = scheduled
    .map((task) => localDate(new Date(task.scheduledStart!), timeZone))
    .sort()[0];

  return anchorDay !== eventDay && anchorDay !== nextDay;
}
