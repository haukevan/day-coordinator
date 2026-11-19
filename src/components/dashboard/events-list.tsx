"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { EventCard, type DashboardEvent } from "./event-card";

type StatusFilter = "ALL" | DashboardEvent["status"];
type SortKey = "date-asc" | "date-desc" | "created-desc" | "title-asc";

const STATUS_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "LIVE", label: "Live" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ARCHIVED", label: "Archived" },
];

const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: "date-asc", label: "Date · soonest" },
  { value: "date-desc", label: "Date · latest" },
  { value: "created-desc", label: "Recently created" },
  { value: "title-asc", label: "Title A–Z" },
];

function eventDateMs(event: DashboardEvent): number | null {
  if (!event.eventDate) return null;
  const ms = new Date(event.eventDate).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function compareDates(
  a: DashboardEvent,
  b: DashboardEvent,
  direction: 1 | -1,
): number {
  const aMs = eventDateMs(a);
  const bMs = eventDateMs(b);

  if (aMs === null && bMs === null) return a.title.localeCompare(b.title);
  if (aMs === null) return 1;
  if (bMs === null) return -1;
  return (aMs - bMs) * direction;
}

export function EventsList({ events }: Readonly<{ events: DashboardEvent[] }>) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [sort, setSort] = useState<SortKey>("date-asc");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const filtered = events.filter((event) => {
      const matchesQuery =
        needle.length === 0 || event.title.toLowerCase().includes(needle);
      const matchesStatus = status === "ALL" || event.status === status;
      return matchesQuery && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "date-desc":
          return compareDates(a, b, -1);
        case "created-desc": {
          const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bCreated - aCreated;
        }
        case "title-asc":
          return a.title.localeCompare(b.title);
        case "date-asc":
        default:
          return compareDates(a, b, 1);
      }
    });
  }, [events, query, status, sort]);

  const controlClass =
    "w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px] sm:w-auto";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events…"
            aria-label="Search events"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px]"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            aria-label="Filter events by status"
            className={controlClass}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort events"
            className={controlClass}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            No events match your filters
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try a different search or status.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {visible.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
