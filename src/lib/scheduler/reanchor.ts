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

/** Tasks further than this from the event date are treated as misanchored. */
const MAX_ALIGNED_DAY_OFFSET = 7;

/**
 * Repair tasks whose event-local calendar dates sit far outside the event's
 * scheduling window.
 *
 * A duplicated event can keep task instants that were anchored to a different
 * date. Those instants are genuinely in daylight time, so a November or
 * December event renders them with a summer abbreviation (PDT) even though the
 * clock time looks right. Re-anchoring preserves every task's local clock time
 * and relative day offsets, so no displayed time changes — only the calendar
 * date (and therefore the timezone label) becomes correct for the event.
 *
 * Returns the number of tasks updated (0 when the set is already aligned).
 */
export async function alignTaskDatesToEvent(
  eventId: string,
  eventDate: Date,
  timeZone: string,
  tasks: Array<{ scheduledStart: Date | null }>,
): Promise<number> {
  const scheduled = tasks.filter((task) => task.scheduledStart);
  if (scheduled.length === 0) return 0;

  const eventDay = eventCalendarDate(eventDate);
  let farthest = 0;

  for (const task of scheduled) {
    const offset = Math.abs(
      dayOffsetBetween(eventDay, localDate(task.scheduledStart!, timeZone)),
    );
    farthest = Math.max(farthest, offset);
  }

  // Multi-day event windows stay untouched; only clearly stale anchors (for
  // example a set still sitting on a summer date) are repaired.
  if (farthest <= MAX_ALIGNED_DAY_OFFSET) return 0;

  return reanchorTasksToEventDate(eventId, eventDate, timeZone);
}
