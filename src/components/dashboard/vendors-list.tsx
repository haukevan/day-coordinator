"use client";

import { useState, useCallback } from "react";
import { BriefcaseBusiness, Plus, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VendorFormDialog } from "@/components/dashboard/vendor-form-dialog";
import type { SerializedVendorContactWithEvents } from "@/lib/types";

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  readonly initialVendors: SerializedVendorContactWithEvents[];
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

export function VendorsList({ initialVendors, userEmail }: Props) {
  const [vendors, setVendors] =
    useState<SerializedVendorContactWithEvents[]>(initialVendors);
  const [showCreate, setShowCreate] = useState(false);
  const [editingVendor, setEditingVendor] =
    useState<SerializedVendorContactWithEvents | null>(null);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreated = useCallback(
    (vendor: SerializedVendorContactWithEvents) => {
      setVendors((prev) => [vendor, ...prev]);
    },
    [],
  );

  const handleUpdated = useCallback(
    (updated: SerializedVendorContactWithEvents) => {
      setVendors((prev) =>
        prev.map((v) => (v.id === updated.id ? updated : v)),
      );
    },
    [],
  );

  const handleDeleted = useCallback((id: string) => {
    setVendors((prev) => prev.filter((v) => v.id !== id));
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Add vendor button */}
      <Button
        onClick={() => setShowCreate(true)}
        size="sm"
        className="w-full sm:w-auto"
      >
        <Plus className="size-4" />
        Add vendor
      </Button>

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

      {/* Vendor cards */}
      {vendors.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {vendors.map((vendor) => (
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
