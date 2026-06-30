import Link from "next/link";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PendingInvite {
  id: string;
  inviteToken: string | null;
  invitedBy: {
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    email: string;
  } | null;
  event: {
    id: string;
    title: string;
    eventDate: Date | null;
    owner: {
      firstName: string | null;
      lastName: string | null;
      name: string | null;
      email: string | null;
    };
  };
}

interface Props {
  invite: PendingInvite;
}

function ownerDisplayName(owner: PendingInvite["event"]["owner"]): string {
  if (owner.firstName || owner.lastName) {
    return [owner.firstName, owner.lastName].filter(Boolean).join(" ");
  }
  return owner.name ?? owner.email ?? "Unknown";
}

function inviterDisplayName(
  invitedBy: NonNullable<PendingInvite["invitedBy"]>,
): string {
  if (invitedBy.firstName || invitedBy.lastName) {
    return [invitedBy.firstName, invitedBy.lastName].filter(Boolean).join(" ");
  }
  return invitedBy.name ?? invitedBy.email;
}

export function PendingInviteCard({ invite }: Props) {
  const ownerName = ownerDisplayName(invite.event.owner);
  const inviterName = invite.invitedBy
    ? inviterDisplayName(invite.invitedBy)
    : null;
  // Show inviter if it differs from the owner (e.g., a coordinator sent it)
  const showInviter = inviterName && inviterName !== ownerName;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Mail className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {invite.event.title}
          </p>
          {invite.event.eventDate && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {new Intl.DateTimeFormat("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              }).format(new Date(invite.event.eventDate))}
            </p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {showInviter ? (
              <>
                From <span className="text-foreground">{inviterName}</span>{" "}
                <span className="text-muted-foreground/70">
                  · Event by {ownerName}
                </span>
              </>
            ) : (
              <>
                From <span className="text-foreground">{ownerName}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {invite.inviteToken && (
        <Button asChild size="sm" variant="outline" className="w-full">
          <Link href={`/invite/${invite.inviteToken}`}>View invitation</Link>
        </Button>
      )}
    </div>
  );
}
