"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import type { LocationValue } from "@/components/ui/location-picker";
import type { SerializedVenue, LinkedEvent } from "@/lib/types";

const LocationPicker = dynamic(
  () =>
    import("@/components/ui/location-picker").then((mod) => ({
      default: mod.LocationPicker,
    })),
  { ssr: false },
);

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly venue?: SerializedVenue | null;
  readonly onSaved: (venue: SerializedVenue) => void;
  readonly onDeleted?: (id: string) => void;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50";

function formatLinkedEvents(events: LinkedEvent[]): string {
  if (events.length === 0) return "";
  if (events.length === 1) return `"${events[0].title}"`;
  if (events.length === 2)
    return `"${events[0].title}" and "${events[1].title}"`;
  return `"${events[0].title}" and ${events.length - 1} other event${events.length - 1 > 1 ? "s" : ""}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VenueFormDialog({
  open,
  onOpenChange,
  venue,
  onSaved,
  onDeleted,
}: Props) {
  const isEdit = !!venue;

  // ── Form state ────────────────────────────────────────────────────────────
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [venueName, setVenueName] = useState("");
  const [venueDescription, setVenueDescription] = useState("");
  const [venueOwnerName, setVenueOwnerName] = useState("");
  const [venueOwnerPhone, setVenueOwnerPhone] = useState("");
  const [venueOwnerEmail, setVenueOwnerEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // ── Delete state ──────────────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // ── Populate form when editing ────────────────────────────────────────────
  useEffect(() => {
    if (open && venue) {
      setVenueName(venue.name ?? "");
      setVenueDescription(venue.description ?? "");
      setVenueOwnerName(venue.ownerName ?? "");
      setVenueOwnerPhone(venue.ownerPhone ?? "");
      setVenueOwnerEmail(venue.ownerEmail ?? "");
      setLocation(
        venue.lat != null && venue.lng != null
          ? {
              name: venue.name,
              address: venue.address,
              lat: venue.lat,
              lng: venue.lng,
              placeId: venue.placeId ?? "",
            }
          : {
              name: venue.name,
              address: venue.address,
              lat: 0,
              lng: 0,
              placeId: "",
            },
      );
    } else if (open && !venue) {
      resetForm();
    }
  }, [open, venue]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setLocation(null);
    setVenueName("");
    setVenueDescription("");
    setVenueOwnerName("");
    setVenueOwnerPhone("");
    setVenueOwnerEmail("");
    setSaveError("");
    setDeleteError("");
    setConfirmDelete(false);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        resetForm();
        setConfirmDelete(false);
      }
      onOpenChange(next);
    },
    [onOpenChange, resetForm],
  );

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!location && !isEdit) return;
    setSaving(true);
    setSaveError("");

    const body: Record<string, unknown> = {};
    if (location) {
      body.name = venueName.trim() || location.name;
      body.address = location.address;
      if (location.lat != null) body.lat = location.lat;
      if (location.lng != null) body.lng = location.lng;
      if (location.placeId?.trim()) body.placeId = location.placeId.trim();
    } else {
      body.name = venueName.trim();
      body.address = venue?.address ?? "";
    }
    if (venueDescription.trim()) body.description = venueDescription.trim();
    if (venueOwnerName.trim()) body.ownerName = venueOwnerName.trim();
    if (venueOwnerPhone.trim()) body.ownerPhone = venueOwnerPhone.trim();
    if (venueOwnerEmail.trim()) body.ownerEmail = venueOwnerEmail.trim();

    try {
      const url = isEdit ? `/api/venues/${venue!.id}` : "/api/venues";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        // Merge existing events data from the original venue so the card
        // still shows linked events after edit
        const merged = {
          ...(data.venue ?? data),
          events: venue?.events,
          _count: venue?._count,
        };
        onSaved(merged);
        handleOpenChange(false);
      } else {
        setSaveError(data.error ?? "Failed to save venue.");
      }
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [
    location,
    isEdit,
    venue,
    venueName,
    venueDescription,
    venueOwnerName,
    venueOwnerPhone,
    venueOwnerEmail,
    onSaved,
    handleOpenChange,
  ]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!venue) return;

    // Two-step confirm
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    setDeleteError("");

    try {
      const res = await fetch(`/api/venues/${venue.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        onDeleted?.(venue.id);
        handleOpenChange(false);
      } else {
        const data = await res.json();
        setDeleteError(data.error ?? "Failed to delete venue.");
        setConfirmDelete(false);
      }
    } catch {
      setDeleteError("Network error. Please try again.");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }, [venue, confirmDelete, onDeleted, handleOpenChange]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const linkedCount = isEdit ? (venue?._count?.events ?? 0) : 0;
  const linkedEvents = isEdit ? (venue?.events ?? []) : [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-auto sm:max-w-md">
        <DialogHeader>
          <h2 className="text-base font-semibold text-foreground">
            {isEdit ? "Edit venue" : "New venue"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isEdit
              ? "Update this venue's details."
              : "Add a venue you can reuse across events."}
          </p>
        </DialogHeader>

        {/* Linked events warning (edit only) */}
        {isEdit && linkedCount > 0 && (
          <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5">
            <AlertTriangle className="size-4 shrink-0 text-warning" />
            <div>
              <p className="text-xs font-medium text-warning">
                This venue is linked to {linkedCount} event
                {linkedCount !== 1 ? "s" : ""}
              </p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {linkedEvents.map((e) => (
                  <li key={e.id} className="text-xs text-muted-foreground">
                    {e.title}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Changes you make here will affect how this venue appears in the
                above events.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Venue name */}
          <div>
            <label
              htmlFor="vf-venue-name"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Venue name <span className="text-destructive">*</span>
            </label>
            <input
              id="vf-venue-name"
              type="text"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              maxLength={200}
              placeholder="e.g. The Grand Ballroom"
              className={inputClass}
              autoFocus={!isEdit}
            />
          </div>

          {/* Address via map */}
          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Address <span className="text-destructive">*</span>
            </span>
            <LocationPicker
              value={location}
              onChange={(loc) => {
                setLocation(loc);
                if (loc && !venueName.trim()) {
                  setVenueName(loc.name);
                }
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="vf-venue-description"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Description
            </label>
            <textarea
              id="vf-venue-description"
              value={venueDescription}
              onChange={(e) => setVenueDescription(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Brief description of the venue…"
              className={cn(inputClass, "resize-none")}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Owner name */}
            <div>
              <label
                htmlFor="vf-owner-name"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Venue contact name
              </label>
              <input
                id="vf-owner-name"
                type="text"
                value={venueOwnerName}
                onChange={(e) => setVenueOwnerName(e.target.value)}
                maxLength={128}
                placeholder="e.g. Jane Smith"
                className={inputClass}
              />
            </div>

            {/* Owner phone */}
            <div>
              <label
                htmlFor="vf-owner-phone"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Venue contact phone
              </label>
              <input
                id="vf-owner-phone"
                type="tel"
                value={venueOwnerPhone}
                onChange={(e) => setVenueOwnerPhone(e.target.value)}
                maxLength={20}
                placeholder="(555) 123-4567"
                className={inputClass}
              />
            </div>

            {/* Owner email */}
            <div className="sm:col-span-2">
              <label
                htmlFor="vf-owner-email"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Venue contact email
              </label>
              <input
                id="vf-owner-email"
                type="email"
                value={venueOwnerEmail}
                onChange={(e) => setVenueOwnerEmail(e.target.value)}
                maxLength={254}
                placeholder="manager@venue.com"
                className={inputClass}
              />
            </div>
          </div>

          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
        </div>

        {/* Linked events delete warning — above actions so visible without scrolling */}
        {isEdit && linkedCount > 0 && confirmDelete && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 max-w-full overflow-hidden">
            <AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-destructive break-words">
                This venue will be removed from {linkedCount} event
                {linkedCount !== 1 ? "s" : ""}
              </p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {linkedEvents.map((e) => (
                  <li
                    key={e.id}
                    className="text-xs text-muted-foreground truncate"
                  >
                    {e.title}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          {/* Delete — bottom left (edit only) */}
          <div>
            {isEdit && onDeleted && (
              <Button
                type="button"
                variant={confirmDelete ? "destructive" : "ghost"}
                size={linkedCount > 0 && confirmDelete ? "sm" : "icon"}
                aria-label={
                  confirmDelete ? "Confirm delete venue" : "Delete venue"
                }
                title={
                  confirmDelete ? "Tap again to confirm delete" : "Delete venue"
                }
                onClick={handleDelete}
                disabled={saving || deleting}
              >
                {linkedCount > 0 && confirmDelete ? (
                  "Delete from all events"
                ) : confirmDelete ? (
                  <Check className="size-4" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            )}
          </div>

          {/* Save / Cancel — bottom right */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={saving || deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={(!location && !isEdit) || saving || deleting}
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Save venue"}
            </Button>
          </div>
        </div>

        {deleteError && (
          <p className="text-xs text-destructive">{deleteError}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
