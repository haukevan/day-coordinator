import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { EventTabs } from "@/components/dashboard/event-tabs";
import { VenueChipPopup } from "@/components/event/venue-chip-popup";
import { TimelineToolbar } from "@/components/timeline/timeline-toolbar";
import { TimelineViewProvider } from "@/components/timeline/timeline-view-context";
import { EventHeaderSkeleton } from "@/components/ui/skeletons";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, CalendarDays } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { cn } from "@/lib/utils";

export default async function VendorEventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  // Auth check — fast, remains blocking
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
  });
  if (!dbUser) redirect("/login");

  return (
    <TimelineViewProvider>
      <div className="flex min-h-full flex-col">
        <Suspense fallback={<EventHeaderSkeleton />}>
          <VendorHeaderContent eventId={eventId} userId={dbUser.id} />
        </Suspense>
        <div className="flex-1">{children}</div>
      </div>
    </TimelineViewProvider>
  );
}

async function VendorHeaderContent({
  eventId,
  userId,
}: {
  eventId: string;
  userId: string;
}) {
  const eventVendor = await prisma.eventVendor.findFirst({
    where: { eventId, userId, status: "ACCEPTED" },
    include: {
      event: {
        select: {
          id: true,
          title: true,
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
      },
    },
  });

  if (!eventVendor) notFound();

  const eventDateInfo = (() => {
    if (!eventVendor.event.eventDate) return null;
    const d = eventVendor.event.eventDate;
    const formatted = formatInTimeZone(d, "UTC", "EEE, MMM d, yyyy");
    const now = new Date();
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
    <div className="border-b border-border bg-card px-4 py-4 sm:px-6">
      <Link
        href="/dashboard"
        className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        Dashboard
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold text-foreground">
          {eventVendor.event.title}
        </h1>
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          Vendor
        </span>
      </div>

      {/* Date + Venue row */}
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {eventDateInfo && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
              eventDateInfo.dateStatus === "today" &&
                "bg-warning/15 text-warning",
              eventDateInfo.dateStatus === "upcoming" && "bg-info/15 text-info",
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
        {eventVendor.event.venue && (
          <VenueChipPopup
            name={eventVendor.event.venue.name}
            address={eventVendor.event.venue.address}
            description={eventVendor.event.venue.description}
            ownerName={eventVendor.event.venue.ownerName}
            ownerPhone={eventVendor.event.venue.ownerPhone}
            ownerEmail={eventVendor.event.venue.ownerEmail}
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <EventTabs eventId={eventId} userRole="vendor" />
        <TimelineToolbar userRole="vendor" />
      </div>
    </div>
  );
}
