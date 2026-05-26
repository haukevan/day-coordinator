import Link from "next/link";
import { Calendar, ArrowRight } from "lucide-react";
import { EventStatusBadge } from "./event-status-badge";

type EventWithCount = {
  id: string;
  title: string;
  eventDate: Date | null;
  status: "DRAFT" | "SCHEDULED" | "LIVE" | "COMPLETED" | "ARCHIVED";
  _count: { tasks: number };
};

export function EventCard({ event }: { event: EventWithCount }) {
  return (
    <Link
      href={`/events/${event.id}/timeline`}
      className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="line-clamp-1 font-semibold text-foreground transition-colors group-hover:text-primary">
          {event.title}
        </h3>
        <EventStatusBadge status={event.status} />
      </div>
      <div className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Calendar className="size-3.5" />
        <span>
          {event.eventDate
            ? new Date(event.eventDate).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
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
    </Link>
  );
}
