import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { formatDateInZone } from "@/lib/format-time";
import { Calendar, Clock } from "lucide-react";

type Props = { params: Promise<{ slug: string }> };

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Upcoming",
  LIVE: "Happening now",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-info/15 text-info",
  LIVE: "bg-success/15 text-success",
  COMPLETED: "bg-muted text-muted-foreground",
  ARCHIVED: "bg-muted/60 text-muted-foreground/60",
};

export default async function PublicEventPage({ params }: Props) {
  const { slug } = await params;

  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      description: true,
      eventDate: true,
      timezone: true,
      status: true,
    },
  });

  // Draft events and missing events both return not-found
  if (!event || event.status === "DRAFT") notFound();

  const label = STATUS_LABELS[event.status] ?? event.status;
  const badgeClass =
    STATUS_COLORS[event.status] ?? "bg-muted text-muted-foreground";

  const formattedDate = event.eventDate
    ? formatDateInZone(event.eventDate.toISOString(), event.timezone)
    : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md space-y-6">
        {/* Status badge */}
        <div className="flex justify-center">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${badgeClass}`}
          >
            {event.status === "LIVE" && (
              <span className="inline-block size-1.5 animate-pulse rounded-full bg-success" />
            )}
            {label}
          </span>
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {event.title}
          </h1>
          {event.description && (
            <p className="mt-2 text-sm text-muted-foreground">
              {event.description}
            </p>
          )}
        </div>

        {/* Event details */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          {formattedDate && (
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-foreground">{formattedDate}</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-sm">
            <Clock className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">{event.timezone}</span>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Powered by{" "}
          <a
            href="https://daycoordinator.com"
            className="text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Day Coordinator
          </a>
        </p>
      </div>
    </div>
  );
}
