"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VendorCard } from "./vendor-card";
import { AddVendorDialog } from "./add-vendor-dialog";
import { AddExistingVendorDialog } from "./add-existing-vendor-dialog";
import type { SerializedVendor } from "@/lib/types";
import { ChevronDown, Plus } from "lucide-react";

interface Props {
  eventId: string;
  vendors: SerializedVendor[];
  userRole: "admin" | "vendor";
  eventStatus?: string;
}

export function VendorList({ eventId, vendors: initialVendors, userRole, eventStatus }: Props) {
  const [vendors, setVendors] = useState(initialVendors);
  const [addMode, setAddMode] = useState<"new" | "existing" | null>(null);

  // Sync when the server re-renders (e.g. after a status transition sends invites)
  useEffect(() => {
    setVendors(initialVendors);
  }, [initialVendors]);

  function handleAdded(vendor: SerializedVendor) {
    setVendors((v) => [...v, vendor]);
  }

  function handleMultiAdded(added: SerializedVendor[]) {
    setVendors((v) => [...v, ...added]);
  }

  function handleUpdated(updated: SerializedVendor) {
    setVendors((v) => v.map((x) => (x.id === updated.id ? updated : x)));
  }

  function handleRemoved(vendorId: string) {
    setVendors((v) => v.filter((x) => x.id !== vendorId));
  }

  const existingEmails = new Set(vendors.map((v) => v.email.toLowerCase()));

  return (
    <div className="p-4 sm:p-6">
      {userRole === "admin" && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Vendors</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus className="size-4" />
                Add vendor
                <ChevronDown className="ml-0.5 size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setAddMode("existing")}>
                Add existing contact
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setAddMode("new")}>
                Add new contact
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {vendors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {userRole === "admin"
              ? "No vendors added yet. Use \u201cAdd vendor\u201d to get started."
              : "No vendors have been added to this event yet."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {vendors.map((vendor) => (
            <li key={vendor.id}>
              <VendorCard
                eventId={eventId}
                vendor={vendor}
                userRole={userRole}
                eventStatus={eventStatus}
                onUpdated={handleUpdated}
                onRemoved={handleRemoved}
              />
            </li>
          ))}
        </ul>
      )}

      {addMode === "new" && (
        <AddVendorDialog
          eventId={eventId}
          onClose={() => setAddMode(null)}
          onAdded={(v) => { handleAdded(v); setAddMode(null); }}
        />
      )}

      {addMode === "existing" && (
        <AddExistingVendorDialog
          eventId={eventId}
          existingVendorEmails={existingEmails}
          onClose={() => setAddMode(null)}
          onAdded={(vs) => { handleMultiAdded(vs); setAddMode(null); }}
        />
      )}
    </div>
  );
}
