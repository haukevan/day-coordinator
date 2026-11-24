"use client";

import { useProfileQuery } from "@/lib/query/hooks";
import { VendorsList } from "@/components/dashboard/vendors-list";

/**
 * Cache-first vendors page: the list renders from the shared query cache on
 * repeat navigation; the dashboard warms it on first load.
 */
export default function VendorsPage() {
  const { data: profile } = useProfileQuery();

  return (
    <div className="flex min-h-full flex-col">
      {/* Page header */}
      <div className="border-b border-border bg-card px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold text-foreground">Vendors</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Manage your vendor contacts across all events.
        </p>
      </div>

      {/* Vendor list (client component) */}
      <div className="flex-1 px-4 py-4 pb-20 sm:px-6 sm:pb-6">
        <VendorsList userEmail={profile?.email ?? ""} />
      </div>
    </div>
  );
}
