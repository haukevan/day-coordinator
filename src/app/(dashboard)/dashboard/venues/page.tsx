"use client";

import { VenuesList } from "@/components/dashboard/venues-list";

/**
 * Cache-first venues page: the list renders from the shared query cache on
 * repeat navigation; the dashboard warms it on first load.
 */
export default function VenuesPage() {
  return (
    <div className="flex min-h-full flex-col">
      {/* Page header */}
      <div className="border-b border-border bg-card px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold text-foreground">Venues</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Manage your saved venues across all events.
        </p>
      </div>

      {/* Venue list (client component) */}
      <div className="flex-1 px-4 py-4 pb-20 sm:px-6 sm:pb-6">
        <VenuesList />
      </div>
    </div>
  );
}
