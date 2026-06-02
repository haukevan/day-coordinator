import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { EventCard } from "@/components/dashboard/event-card";
import { VendorEventCard } from "@/components/dashboard/vendor-event-card";
import { PendingInviteCard } from "@/components/dashboard/pending-invite-card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
  });
  if (!dbUser) redirect("/login");

  const events = await prisma.event.findMany({
    where: { ownerId: dbUser.id },
    include: {
      _count: { select: { tasks: true } },
      venue: {
        select: {
          id: true,
          name: true,
          address: true,
          description: true,
          ownerName: true,
          ownerPhone: true,
          ownerEmail: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const vendorMemberships = await prisma.eventVendor.findMany({
    where: {
      userId: dbUser.id,
      status: "ACCEPTED",
      event: {
        ownerId: { not: dbUser.id },
      },
    },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          eventDate: true,
          status: true,
          owner: {
            select: {
              firstName: true,
              lastName: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const pendingInvites = await prisma.eventVendor.findMany({
    where: {
      status: "PENDING",
      inviteToken: { not: null },
      inviteSentAt: { not: null },
      vendorContact: {
        email: { equals: dbUser.email ?? "", mode: "insensitive" },
      },
    },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          eventDate: true,
          owner: {
            select: {
              firstName: true,
              lastName: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: { inviteSentAt: "desc" },
  });

  return (
    <div className="px-4 py-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground sm:text-xl">
            Your events
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {events.length === 0
              ? "Create your first event to get started."
              : `${events.length} ${events.length === 1 ? "event" : "events"}`}
          </p>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link href="/events/new">
            <Plus className="size-4" />
            <span className="hidden sm:inline">New event</span>
            <span className="sm:hidden">New event</span>
          </Link>
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center sm:py-24">
          <p className="mb-1 text-sm font-medium text-foreground">
            No events yet
          </p>
          <p className="mb-5 text-xs text-muted-foreground">
            Plan your first event in minutes.
          </p>
          <Button asChild size="sm">
            <Link href="/events/new">
              <Plus className="size-4" />
              Create event
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {pendingInvites.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-1 text-base font-semibold text-foreground">
            Pending invitations
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            You&apos;ve been invited to these events.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {pendingInvites.map((invite) => (
              <PendingInviteCard key={invite.id} invite={invite} />
            ))}
          </div>
        </div>
      )}

      {vendorMemberships.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-base font-semibold text-foreground">
            Events you&apos;re part of
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {vendorMemberships.map((m) => (
              <VendorEventCard key={m.id} membership={m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
