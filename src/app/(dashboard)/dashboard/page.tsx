"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useDashboardQuery, useSessionPrefetch } from "@/lib/query/hooks";
import { DashboardPageSkeleton } from "@/components/ui/skeletons";
import { EventsList } from "@/components/dashboard/events-list";
import { VendorEventCard } from "@/components/dashboard/vendor-event-card";
import { PendingInviteCard } from "@/components/dashboard/pending-invite-card";
import { Button } from "@/components/ui/button";

/**
 * Dashboard is cache-first: the events list renders from the shared React
 * Query cache on repeat navigation, then refreshes silently in the
 * background. A skeleton only appears when there is no cached data at all.
 */
export default function DashboardPage() {
  // Warm vendors, venues, and profile on the first dashboard load.
  useSessionPrefetch();

  const { data, isPending } = useDashboardQuery();

  if (isPending) {
    return <DashboardPageSkeleton />;
  }

  const events = data?.events ?? [];
  const pendingInvites = data?.pendingInvites ?? [];
  const vendorMemberships = data?.vendorMemberships ?? [];

  return (
    <div className="px-4 py-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground sm:text-xl">
            Your events
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {events.length === 0
              ? "Create your first event to get started."
              : "Search, filter, and open your events."}
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/events/new">
            <Plus className="size-4" />
            <span className="hidden sm:inline">New event</span>
            <span className="sm:hidden">New event</span>
          </Link>
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center sm:py-24">
          <p className="mb-1 text-sm font-medium text-foreground">
            No events yet
          </p>
          <p className="mb-5 text-xs text-muted-foreground">
            Plan your first event in minutes.
          </p>
          <Button asChild>
            <Link href="/events/new">
              <Plus className="size-4" />
              Create event
            </Link>
          </Button>
        </div>
      ) : (
        <EventsList events={events} />
      )}

      {pendingInvites.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-1 text-base font-semibold text-foreground">
            Pending invitations
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            You&apos;ve been invited to these events.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {pendingInvites.map((invite) => (
              <PendingInviteCard key={invite.id} invite={invite} />
            ))}
          </div>
        </div>
      )}

      {vendorMemberships.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-base font-semibold text-foreground">
            Events you&apos;re part of
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {vendorMemberships.map((m) => (
              <VendorEventCard key={m.id} membership={m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
