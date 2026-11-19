import { notFound, redirect } from "next/navigation";
import { getCurrentDbUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { reconcileEventStatus } from "@/lib/scheduler";
import { EventStatusButton } from "@/components/event/event-status-button";
import { EventDateBadge } from "@/components/event/event-date-badge";
import { DraftBanner } from "@/components/event/draft-banner";
import { ArchiveCountdownBanner } from "@/components/event/archive-countdown-banner";
import { VenueChipPopup } from "@/components/event/venue-chip-popup";
import { EventTabs } from "@/components/dashboard/event-tabs";
import { TimelineToolbar } from "@/components/timeline/timeline-toolbar";
import { TimelineViewProvider } from "@/components/timeline/timeline-view-context";
import { EventHeaderSkeleton } from "@/components/ui/skeletons";
import { NotificationBell } from "@/components/event/notification-bell";
import { NotificationSetupModal } from "@/components/event/notification-setup-modal";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";

type EventStatus = "DRAFT" | "SCHEDULED" | "LIVE" | "COMPLETED" | "ARCHIVED";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  // Auth check — fast (cached per request), remains blocking so redirects work
  const dbUser = await getCurrentDbUser();
  if (!dbUser) redirect("/login");

  return (
    <TimelineViewProvider>
      <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden sm:h-dvh">
        {/* Event header — data fetched async inside Suspense so layout shell renders instantly */}
        <Suspense fallback={<EventHeaderSkeleton />}>
          <EventHeaderContent
            eventId={eventId}
            userId={dbUser.id}
            userPhone={dbUser.phone ?? null}
          />
        </Suspense>

        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </TimelineViewProvider>
  );
}

/** Async component that fetches event data and renders the header.
 *  Wrapped in Suspense by the parent layout so navigation is instant. */
async function EventHeaderContent({
  eventId,
  userId,
  userPhone,
}: {
  eventId: string;
  userId: string;
  userPhone: string | null;
}) {
  // Fetch independent data in parallel
  const [event, vendorPref] = await Promise.all([
    prisma.event.findFirst({
      where: { id: eventId, ownerId: userId },
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
    }),
    // Per-event notification prefs for the current user (owner may not have a row)
    prisma.eventVendor.findFirst({
      where: { eventId, userId },
      select: { pushEnabled: true, smsEnabled: true },
    }),
  ]);

  if (!event) notFound();

  // Reconcile event status on page load — handles transitions that would
  // normally be triggered by cron, so things still work without a scheduler.
  // Reuse the already-fetched event instead of querying it again.
  const currentStatus = await reconcileEventStatus(event.id, {
    status: event.status,
    eventDate: event.eventDate,
  });

  const status = currentStatus as EventStatus;

  return (
    <>
      <div className="border-b border-border bg-card px-3 py-2 sm:px-6 sm:py-3">
        {/* Title row — back link merged inline */}
        <div className="flex items-center gap-1.5">
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center justify-center size-8 -ml-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Back to events"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">
            {event.title}
          </h1>
          <div className="ml-auto">
            <NotificationBell
              eventId={event.id}
              eventStatus={status}
              initialPushEnabled={vendorPref?.pushEnabled ?? true}
              initialSmsEnabled={vendorPref?.smsEnabled ?? false}
              userHasPhone={!!userPhone}
              editPhoneHref="/onboarding"
            />
          </div>
        </div>

        {/* Metadata row — status, date, venue */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <EventStatusButton
            eventId={event.id}
            status={status}
            eventDate={event.eventDate ? event.eventDate.toISOString() : null}
          />
          {event.eventDate && <EventDateBadge eventDate={event.eventDate} />}
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
                <TimelineToolbar userRole="admin" />
              </Suspense>
            }
          />
        </div>
      </div>

      {status === "DRAFT" && (
        <DraftBanner
          eventId={event.id}
          status={status}
          eventDate={event.eventDate ? event.eventDate.toISOString() : null}
        />
      )}
      <ArchiveCountdownBanner eventId={event.id} eventStatus={status} />

      {/* One-time notification setup prompt for owners after scheduling */}
      {status === "SCHEDULED" && (
        <NotificationSetupModal
          eventId={event.id}
          initialPhone={userPhone?.replace(/\+1/, "") ?? ""}
          prefsAlreadySet={
            vendorPref?.pushEnabled != null || vendorPref?.smsEnabled != null
          }
        />
      )}
    </>
  );
}
