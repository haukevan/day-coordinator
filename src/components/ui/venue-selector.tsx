"use client";

import { useState, useEffect, useCallback } from "react";
import { MapPin, Plus, ChevronsUpDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateVenueDialog } from "./create-venue-dialog";
import type { SerializedVenue } from "@/lib/types";

interface Props {
  readonly venueId: string | null;
  readonly disabled?: boolean;
  readonly onChange: (venueId: string | null) => void;
}

export function VenueSelector({ venueId, onChange, disabled = false }: Props) {
  const [venues, setVenues] = useState<SerializedVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // ── fetch user's venues ───────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/venues");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setVenues(data.venues);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── derived ────────────────────────────────────────────────────────────────

  const selectedVenue = venues.find((v) => v.id === venueId) ?? null;

  let displayLabel: string;
  if (loading) {
    displayLabel = "Loading venues…";
  } else if (selectedVenue) {
    displayLabel = selectedVenue.name;
  } else {
    displayLabel = "No venue selected";
  }

  // ── handlers ──────────────────────────────────────────────────────────────

  const handleSelectExisting = useCallback(
    (id: string) => {
      onChange(id);
      setShowDropdown(false);
    },
    [onChange],
  );

  const handleVenueCreated = useCallback(
    (venue: SerializedVenue) => {
      setVenues((prev) => [venue, ...prev]);
      onChange(venue.id);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange(null);
  }, [onChange]);

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Venue selector button / dropdown trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            if (!disabled) setShowDropdown(!showDropdown);
          }}
          disabled={disabled}
          className={cn(
            "flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/50",
            disabled && "cursor-not-allowed opacity-50",
            !selectedVenue && !loading && "text-muted-foreground",
          )}
          style={{ minHeight: "44px" }}
        >
          <MapPin className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-left">{displayLabel}</span>
          {selectedVenue && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClear();
                }
              }}
              className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              aria-label="Clear venue selection"
            >
              <X className="size-3.5" />
            </span>
          )}
        </button>

        {/* Dropdown */}
        {showDropdown && !disabled && (
          <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
            <ul className="max-h-56 overflow-auto py-1">
              {/* Create new — always visible at top */}
              <li className="border-b border-border">
                <button
                  type="button"
                  onClick={() => {
                    setShowDropdown(false);
                    setShowCreateDialog(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-primary hover:bg-hover"
                  style={{ minHeight: "44px" }}
                >
                  <Plus className="size-4" />
                  Create new venue
                </button>
              </li>
              {venues.length === 0 && !loading && (
                <li>
                  <p className="px-3 py-2.5 text-sm text-muted-foreground">
                    No saved venues yet.
                  </p>
                </li>
              )}
              {venues.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectExisting(v.id)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-hover"
                    style={{ minHeight: "44px" }}
                  >
                    <MapPin className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {v.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {v.address}
                      </p>
                    </div>
                    {v.id === venueId && (
                      <Check className="size-4 shrink-0 text-primary" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Click-away backdrop */}
      {showDropdown && (
        <button
          type="button"
          className="fixed inset-0 z-10 cursor-default"
          onClick={() => setShowDropdown(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowDropdown(false);
          }}
          aria-label="Close venue dropdown"
        />
      )}

      {/* Create venue dialog (reusable popup) */}
      <CreateVenueDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={handleVenueCreated}
      />
    </div>
  );
}
