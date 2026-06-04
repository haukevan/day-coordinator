"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { LocationPicker, type LocationValue } from "./location-picker";
import type { SerializedVenue } from "@/lib/types";

interface Props {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCreated: (venue: SerializedVenue) => void;
}

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50";

export function CreateVenueDialog({ open, onOpenChange, onCreated }: Props) {
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [venueName, setVenueName] = useState("");
  const [venueDescription, setVenueDescription] = useState("");
  const [venueOwnerName, setVenueOwnerName] = useState("");
  const [venueOwnerPhone, setVenueOwnerPhone] = useState("");
  const [venueOwnerEmail, setVenueOwnerEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const resetForm = useCallback(() => {
    setLocation(null);
    setVenueName("");
    setVenueDescription("");
    setVenueOwnerName("");
    setVenueOwnerPhone("");
    setVenueOwnerEmail("");
    setSaveError("");
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) resetForm();
      onOpenChange(next);
    },
    [onOpenChange, resetForm],
  );

  const handleSave = useCallback(async () => {
    if (!location) return;
    setSaving(true);
    setSaveError("");

    try {
      const res = await fetch("/api/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: venueName.trim() || location.name,
          address: location.address,
          lat: location.lat,
          lng: location.lng,
          placeId: location.placeId,
          description: venueDescription.trim() || undefined,
          ownerName: venueOwnerName.trim() || undefined,
          ownerPhone: venueOwnerPhone.trim() || undefined,
          ownerEmail: venueOwnerEmail.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onCreated(data.venue);
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
    venueName,
    venueDescription,
    venueOwnerName,
    venueOwnerPhone,
    venueOwnerEmail,
    onCreated,
    handleOpenChange,
  ]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90dvh] overflow-auto sm:max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <h2 className="text-base font-semibold text-foreground">New venue</h2>
          <p className="text-xs text-muted-foreground">
            Add a venue you can reuse across events.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Venue name */}
          <div>
            <label
              htmlFor="cv-venue-name"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Venue name <span className="text-destructive">*</span>
            </label>
            <input
              id="cv-venue-name"
              type="text"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              maxLength={200}
              placeholder="e.g. The Grand Ballroom"
              className={inputClass}
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
              htmlFor="cv-venue-description"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Description
            </label>
            <textarea
              id="cv-venue-description"
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
                htmlFor="cv-owner-name"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Venue contact name
              </label>
              <input
                id="cv-owner-name"
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
                htmlFor="cv-owner-phone"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Venue contact phone
              </label>
              <input
                id="cv-owner-phone"
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
                htmlFor="cv-owner-email"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Venue contact email
              </label>
              <input
                id="cv-owner-email"
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

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!location || saving}
          >
            {saving ? "Saving…" : "Save venue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
