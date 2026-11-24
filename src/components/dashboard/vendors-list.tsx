"use client";

import { useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BriefcaseBusiness, Plus, CalendarDays, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VendorCardSkeletonGrid } from "@/components/ui/skeletons";
import { VendorFormDialog } from "@/components/dashboard/vendor-form-dialog";
import { queryKeys } from "@/lib/query/keys";
import { useVendorsQuery } from "@/lib/query/hooks";
import type { SerializedVendorContactWithEvents } from "@/lib/types";

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  readonly userEmail: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function displayName(v: SerializedVendorContactWithEvents): string {
  if (v.firstName && v.lastName) return `${v.firstName} ${v.lastName}`;
  if (v.firstName) return v.firstName;
  if (v.lastName) return v.lastName;
  return v.email;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VendorsList({ userEmail }: Props) {
  const queryClient = useQueryClient();
  const { data, isPending } = useVendorsQuery();
  const vendors = useMemo(() => data ?? [], [data]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingVendor, setEditingVendor] =
    useState<SerializedVendorContactWithEvents | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name-asc" | "name-desc" | "linked-desc">(
    "name-asc",
  );

  const visibleVendors = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = vendors.filter((vendor) => {
      if (!needle) return true;
      return [
        displayName(vendor),
        vendor.email,
        vendor.company ?? "",
        vendor.jobTitle ?? "",
      ].some((value) => value.toLowerCase().includes(needle));
    });

    return [...filtered].sort((a, b) => {
      if (sort === "name-desc") {
        return displayName(b).localeCompare(displayName(a));
      }
      if (sort === "linked-desc") {
        const aCount = a._count?.eventVendors ?? 0;
        const bCount = b._count?.eventVendors ?? 0;
        return bCount - aCount;
      }
      return displayName(a).localeCompare(displayName(b));
    });
  }, [vendors, query, sort]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreated = useCallback(
    (vendor: SerializedVendorContactWithEvents) => {
      queryClient.setQueryData<SerializedVendorContactWithEvents[]>(
        queryKeys.vendors,
        (prev) => (prev ? [vendor, ...prev] : [vendor]),
      );
    },
    [queryClient],
  );

  const handleUpdated = useCallback(
    (updated: SerializedVendorContactWithEvents) => {
      queryClient.setQueryData<SerializedVendorContactWithEvents[]>(
        queryKeys.vendors,
        (prev) =>
          prev
            ? prev.map((v) =>
                v.id === updated.id
                  ? {
                      ...v,
                      ...updated,
                      events: updated.events ?? v.events,
                      _count: updated._count ?? v._count,
                    }
                  : v,
              )
            : prev,
      );
    },
    [queryClient],
  );

  const handleDeleted = useCallback(
    (id: string) => {
      queryClient.setQueryData<SerializedVendorContactWithEvents[]>(
        queryKeys.vendors,
        (prev) => prev?.filter((v) => v.id !== id),
      );
    },
    [queryClient],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  // Skeleton only while the first request is in flight — navigations render
  // the cached list instantly.
  if (isPending) {
    return <VendorCardSkeletonGrid count={6} />;
  }
  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendors…"
            aria-label="Search vendors"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px]"
          />
        </div>
        <select
          value={sort}
          onChange={(e) =>
            setSort(e.target.value as "name-asc" | "name-desc" | "linked-desc")
          }
          aria-label="Sort vendors"
          className="w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px] sm:w-auto"
        >
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
          <option value="linked-desc">Most linked events</option>
        </select>
        <Button
          onClick={() => setShowCreate(true)}
          size="sm"
          className="w-full sm:w-auto"
        >
          <Plus className="size-4" />
          Add vendor
        </Button>
      </div>

      {/* Empty state */}
      {vendors.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <BriefcaseBusiness className="size-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No vendors saved yet.</p>
          <p className="text-xs text-muted-foreground/70">
            Add vendors to your contact book to reuse them across your events.
          </p>
        </div>
      )}

      {vendors.length > 0 && visibleVendors.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            No vendors match
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try a different search term.
          </p>
        </div>
      )}

      {/* Vendor cards */}
      {visibleVendors.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleVendors.map((vendor) => (
            <VendorCard
              key={vendor.id}
              vendor={vendor}
              isYou={vendor.email === userEmail}
              onClick={() => setEditingVendor(vendor)}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <VendorFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSaved={handleCreated}
        onDeleted={handleDeleted}
      />

      {/* Edit dialog */}
      <VendorFormDialog
        open={!!editingVendor}
        onOpenChange={(open) => {
          if (!open) setEditingVendor(null);
        }}
        vendor={editingVendor}
        isSelf={editingVendor?.email === userEmail}
        onSaved={handleUpdated}
        onDeleted={handleDeleted}
      />
    </div>
  );
}

// ─── VendorCard ──────────────────────────────────────────────────────────────

function VendorCard({
  vendor,
  isYou,
  onClick,
}: {
  readonly vendor: SerializedVendorContactWithEvents;
  readonly isYou: boolean;
  readonly onClick: () => void;
}) {
  const linkedCount = vendor._count?.eventVendors ?? 0;
  const name = displayName(vendor);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30 hover:bg-hover/50 active:bg-hover cursor-pointer"
      style={{ minHeight: "44px" }}
    >
      {/* Top row: name + email */}
      <div className="mb-2 flex items-start gap-2">
        <BriefcaseBusiness className="size-4 shrink-0 text-primary mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="line-clamp-1 text-sm font-semibold text-foreground">
              {name}
            </h3>
            {isYou && (
              <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                You
              </span>
            )}
          </div>
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {vendor.email}
          </p>
        </div>
      </div>

      {/* Phone */}
      {vendor.phone && (
        <p className="mb-0.5 text-xs text-muted-foreground">{vendor.phone}</p>
      )}

      {/* Company & job title */}
      {vendor.company && (
        <p className="text-xs text-muted-foreground">{vendor.company}</p>
      )}
      {vendor.jobTitle && (
        <p className="text-xs text-muted-foreground/70">{vendor.jobTitle}</p>
      )}

      {/* Footer: linked events */}
      <div className="mt-auto flex items-center gap-1.5 pt-3 border-t border-border">
        <CalendarDays className="size-3 shrink-0 text-muted-foreground" />
        {linkedCount > 0 ? (
          <span className="text-xs text-muted-foreground">
            Added to{" "}
            <span className="font-medium text-foreground">{linkedCount}</span>{" "}
            event{linkedCount === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            Not linked to any events
          </span>
        )}
      </div>
    </button>
  );
}
