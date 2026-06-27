import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { EventDateBadge } from "@/components/event/event-date-badge";
import { EventTabs } from "@/components/dashboard/event-tabs";
import { VenueChipPopup } from "@/components/event/venue-chip-popup";
import { TimelineToolbar } from "@/components/timeline/timeline-toolbar";
import { TimelineViewProvider } from "@/components/timeline/timeline-view-context";
import { EventHeaderSkeleton } from "@/components/ui/skeletons";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ShieldX } from "lucide-react";

function NoAccessMessage() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
        <ShieldX className="size-7 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">
        You don&apos;t have access to this event
      </h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        You may have been removed from this event, or your invitation may have
        expired. Contact the event owner if you believe this is a mistake.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <ChevronLeft className="size-4" />
        Back to dashboard
      </Link>
    </div>
  );
}

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

  // Verify vendor membership early so we can show a friendly message instead of a 404
  const membership = await prisma.eventVendor.findFirst({
    where: { eventId, userId: dbUser.id, status: "ACCEPTED" },
    select: { role: true },
  });

  if (!membership) {
    return <NoAccessMessage />;
  }

  const isCoordinator = membership.role === "COORDINATOR";

  return (
    <TimelineViewProvider>
      <div className="flex min-h-full flex-col">
        <Suspense fallback={<EventHeaderSkeleton />}>
          <VendorHeaderContent
            eventId={eventId}
            userId={dbUser.id}
            isCoordinator={isCoordinator}
          />
        </Suspense>
        <div className="flex-1">{children}</div>
      </div>
    </TimelineViewProvider>
  );
}

async function VendorHeaderContent({
  eventId,
  userId,
  isCoordinator,
}: {
  eventId: string;
  userId: string;
  isCoordinator: boolean;
}) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
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
  });

  if (!event) notFound();

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
        <h1 className="text-lg font-semibold text-foreground">{event.title}</h1>
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {isCoordinator ? "Coordinator" : "Vendor"}
        </span>
      </div>

      {/* Date + Venue row */}
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
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

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <EventTabs eventId={eventId} userRole="vendor" />
        <TimelineToolbar userRole={isCoordinator ? "admin" : "vendor"} />
      </div>
    </div>
  );
}
