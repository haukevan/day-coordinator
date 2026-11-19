"use client";

import { useState, useCallback, useMemo } from "react";
import { MapPin, Plus, CalendarDays, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VenueFormDialog } from "@/components/dashboard/venue-form-dialog";
import type { SerializedVenue } from "@/lib/types";

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  readonly initialVenues: SerializedVenue[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VenuesList({ initialVenues }: Props) {
  const [venues, setVenues] = useState<SerializedVenue[]>(initialVenues);
  const [showCreate, setShowCreate] = useState(false);
  const [editingVenue, setEditingVenue] = useState<SerializedVenue | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name-asc" | "updated-desc" | "usage-desc">(
    "name-asc",
  );

  const visibleVenues = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = venues.filter((venue) => {
      if (!needle) return true;
      return [
        venue.name,
        venue.address,
        venue.description ?? "",
        venue.ownerName ?? "",
        venue.ownerEmail ?? "",
        venue.ownerPhone ?? "",
      ].some((value) => value.toLowerCase().includes(needle));
    });

    return [...filtered].sort((a, b) => {
      if (sort === "updated-desc") {
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      }
      if (sort === "usage-desc") {
        const aCount = a._count?.events ?? 0;
        const bCount = b._count?.events ?? 0;
        return bCount - aCount;
      }
      return a.name.localeCompare(b.name);
    });
  }, [venues, query, sort]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreated = useCallback((venue: SerializedVenue) => {
    setVenues((prev) => [venue, ...prev]);
  }, []);

  const handleUpdated = useCallback((updated: SerializedVenue) => {
    setVenues((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setVenues((prev) => prev.filter((v) => v.id !== id));
  }, []);

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
            placeholder="Search venues…"
            aria-label="Search venues"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px]"
          />
        </div>
        <select
          value={sort}
          onChange={(e) =>
            setSort(
              e.target.value as "name-asc" | "updated-desc" | "usage-desc",
            )
          }
          aria-label="Sort venues"
          className="w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px] sm:w-auto"
        >
          <option value="name-asc">Name A–Z</option>
          <option value="updated-desc">Recently updated</option>
          <option value="usage-desc">Most used</option>
        </select>
        <Button
          onClick={() => setShowCreate(true)}
          size="sm"
          className="w-full sm:w-auto"
        >
          <Plus className="size-4" />
          Add venue
        </Button>
      </div>

      {/* Empty state */}
      {venues.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <MapPin className="size-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No venues saved yet.</p>
          <p className="text-xs text-muted-foreground/70">
            Add a venue to reuse it across your events.
          </p>
        </div>
      )}

      {venues.length > 0 && visibleVenues.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <p className="text-sm font-medium text-foreground">No venues match</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try a different search term.
          </p>
        </div>
      )}

      {/* Venue cards */}
      {visibleVenues.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleVenues.map((venue) => (
            <VenueCard
              key={venue.id}
              venue={venue}
              onClick={() => setEditingVenue(venue)}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      {showCreate && (
        <VenueFormDialog
          open
          onOpenChange={setShowCreate}
          onSaved={handleCreated}
          onDeleted={handleDeleted}
        />
      )}

      {/* Edit dialog */}
      {editingVenue && (
        <VenueFormDialog
          open
          onOpenChange={(open) => {
            if (!open) setEditingVenue(null);
          }}
          venue={editingVenue}
          onSaved={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}

// ─── VenueCard ───────────────────────────────────────────────────────────────

function VenueCard({
  venue,
  onClick,
}: {
  venue: SerializedVenue;
  onClick: () => void;
}) {
  const linkedCount = venue._count?.events ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30 hover:bg-hover/50 active:bg-hover cursor-pointer"
      style={{ minHeight: "44px" }}
    >
      {/* Top row: name */}
      <div className="mb-2 flex items-start gap-2">
        <MapPin className="size-4 shrink-0 text-primary mt-0.5" />
        <div className="min-w-0">
          <h3 className="line-clamp-1 text-sm font-semibold text-foreground">
            {venue.name}
          </h3>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {venue.address}
          </p>
        </div>
      </div>

      {/* Description */}
      {venue.description && (
        <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
          {venue.description}
        </p>
      )}

      {/* Contact info row */}
      {(venue.ownerName || venue.ownerPhone || venue.ownerEmail) && (
        <div className="mb-3 space-y-0.5 text-xs text-muted-foreground">
          {venue.ownerName && <p>{venue.ownerName}</p>}
          {venue.ownerPhone && <p>{venue.ownerPhone}</p>}
          {venue.ownerEmail && <p className="truncate">{venue.ownerEmail}</p>}
        </div>
      )}

      {/* Footer: linked events */}
      <div className="mt-auto flex items-center gap-1.5 pt-3 border-t border-border">
        <CalendarDays className="size-3 shrink-0 text-muted-foreground" />
        {linkedCount > 0 ? (
          <span className="text-xs text-muted-foreground">
            Used in{" "}
            <span className="font-medium text-foreground">{linkedCount}</span>{" "}
            event{linkedCount !== 1 ? "s" : ""}
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
