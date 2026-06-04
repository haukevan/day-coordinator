import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { EventStatusButton } from "@/components/event/event-status-button";
import { DraftBanner, DraftWarningIcon } from "@/components/event/draft-banner";
import { VenueChipPopup } from "@/components/event/venue-chip-popup";
import { EventTabs } from "@/components/dashboard/event-tabs";
import { TimelineToolbar } from "@/components/timeline/timeline-toolbar";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, CalendarDays } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { cn } from "@/lib/utils";

type EventStatus = "DRAFT" | "SCHEDULED" | "LIVE" | "COMPLETED" | "ARCHIVED";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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
    select: {
      id: true,
      title: true,
      status: true,
      eventDate: true,
      timezone: true,
      venue: {
        select: {
          name: true,
          address: true,
          description: true,
          ownerName: true,
          ownerPhone: true,
          ownerEmail: true,
        },
      },
    },
  });

  if (!event) notFound();

  const status = event.status as EventStatus;

  const eventDateInfo = (() => {
    if (!event.eventDate) return null;
    // eventDate is stored as midnight UTC (calendar date only — no timezone conversion)
    const d = event.eventDate;
    const formatted = formatInTimeZone(d, "UTC", "EEE, MMM d, yyyy");
    const now = new Date();
    // Compare UTC date parts only
    const eventDay = Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
    );
    const todayDay = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    const diff = eventDay - todayDay;
    let dateStatus: "today" | "upcoming" | "past";
    if (diff === 0) {
      dateStatus = "today";
    } else if (diff > 0) {
      dateStatus = "upcoming";
    } else {
      dateStatus = "past";
    }
    return { formatted, dateStatus };
  })();

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden sm:h-dvh">
      {/* Event header */}
      <div className="border-b border-border bg-card px-3 py-2 sm:px-6 sm:py-3">
        {/* Title row — back link merged inline */}
        <div className="flex items-center gap-1.5">
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center justify-center size-7 -ml-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Back to events"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">
            {event.title}
          </h1>
          {status === "DRAFT" && <DraftWarningIcon eventId={event.id} />}
        </div>

        {/* Metadata row — status, date, venue */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <EventStatusButton eventId={event.id} status={status} />
          {eventDateInfo && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                eventDateInfo.dateStatus === "today" &&
                  "bg-warning/15 text-warning",
                eventDateInfo.dateStatus === "upcoming" &&
                  "bg-info/15 text-info",
                eventDateInfo.dateStatus === "past" &&
                  "bg-muted text-muted-foreground",
              )}
            >
              <CalendarDays className="size-3" />
              <span className="sm:hidden">
                {eventDateInfo.dateStatus === "today"
                  ? "Today"
                  : eventDateInfo.formatted}
              </span>
              <span className="hidden sm:inline">
                {eventDateInfo.dateStatus === "today"
                  ? `Today · ${eventDateInfo.formatted}`
                  : eventDateInfo.formatted}
              </span>
            </span>
          )}
          {event.venue && (
            <VenueChipPopup
              name={event.venue.name}
              address={event.venue.address}
              description={event.venue.description}
              ownerName={event.venue.ownerName}
              ownerPhone={event.venue.ownerPhone}
              ownerEmail={event.venue.ownerEmail}
            />
          )}
        </div>

        <div className="mt-2">
          <EventTabs
            eventId={event.id}
            userRole="admin"
            rightContent={
              <Suspense fallback={null}>
                <TimelineToolbar />
              </Suspense>
            }
          />
        </div>
      </div>

      {status === "DRAFT" && <DraftBanner eventId={event.id} status={status} />}

      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
}
