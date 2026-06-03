import Link from "next/link";

interface EventOwner {
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string;
}

interface VendorEvent {
  id: string;
  title: string;
  eventDate: Date | null;
  status: string;
  owner: EventOwner;
}

interface VendorMembership {
  id: string;
  event: VendorEvent;
}

export function VendorEventCard({
  membership,
}: {
  membership: VendorMembership;
}) {
  const { event } = membership;
  const ownerName =
    [event.owner.firstName, event.owner.lastName].filter(Boolean).join(" ") ||
    event.owner.name ||
    event.owner.email;

  return (
    <Link
      href={`/vendor/${event.id}/timeline`}
      className="block rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"
    >
      <p className="font-medium text-foreground">{event.title}</p>
      {event.eventDate && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {new Date(event.eventDate).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Coordinator: <span className="text-foreground">{ownerName}</span>
      </p>
    </Link>
  );
}
