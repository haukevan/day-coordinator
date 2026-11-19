"use client";

import Link from "next/link";
import { Calendar, ArrowRight, MapPin, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EventStatusBadge } from "./event-status-badge";
import { useDuplicateEvent } from "./use-duplicate-event";

type VenueChip = {
  id: string;
  name: string;
  address: string;
  description: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
};

export type DashboardEvent = {
  id: string;
  title: string;
  eventDate: Date | string | null;
  status: "DRAFT" | "SCHEDULED" | "LIVE" | "COMPLETED" | "ARCHIVED";
  createdAt?: Date | string;
  _count: { tasks: number };
  venue: VenueChip | null;
};

export function EventCard({ event }: Readonly<{ event: DashboardEvent }>) {
  const { duplicateEvent, duplicating } = useDuplicateEvent();

  return (
    <div className="group relative flex flex-col rounded-xl border border-border bg-card transition-colors hover:border-primary/30">
      {/* Full-card link sits underneath the content and action menu */}
      <Link
        href={`/events/${event.id}/timeline`}
        className="absolute inset-0 z-0 rounded-xl"
        aria-label={`Open ${event.title}`}
      />

      <div className="pointer-events-none relative z-10 flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-start justify-between gap-2 pr-10">
          <h3 className="min-w-0 flex-1 line-clamp-2 font-semibold text-foreground transition-colors group-hover:text-primary">
            {event.title}
          </h3>
          <EventStatusBadge status={event.status} />
        </div>

        {/* Venue chip */}
        {event.venue && (
          <div className="mb-2">
            <span className="inline-flex items-center gap-1 truncate max-w-full rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{event.venue.name}</span>
            </span>
          </div>
        )}

        <div className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="size-3.5" />
          <span>
            {event.eventDate
              ? new Date(event.eventDate).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                })
              : "Date TBD"}
          </span>
        </div>
        <div className="mt-auto flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {event._count.tasks} {event._count.tasks === 1 ? "task" : "tasks"}
          </span>
          <ArrowRight className="size-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
        </div>
      </div>

      {/* Per-card actions */}
      <div className="absolute right-3 top-3 z-20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Actions for ${event.title}`}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <MoreVertical className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/events/${event.id}/timeline`}>Open event</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={duplicating}
              onSelect={() => duplicateEvent(event.id)}
            >
              {duplicating ? "Duplicating…" : "Duplicate event"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
