import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { EventStatusButton } from "@/components/event/event-status-button";
import { DraftBanner, DraftWarningIcon } from "@/components/event/draft-banner";
import { EventTabs } from "@/components/dashboard/event-tabs";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type EventStatus = "DRAFT" | "SCHEDULED" | "LIVE" | "COMPLETED" | "ARCHIVED";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
  });
  if (!dbUser) redirect("/login");

  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId: dbUser.id },
    select: { id: true, title: true, status: true },
  });

  if (!event) notFound();

  const status = event.status as EventStatus;

  return (
    <div className="flex min-h-full flex-col">
      {/* Event header */}
      <div className="border-b border-border bg-card px-4 py-4 sm:px-6">
        <Link
          href="/dashboard"
          className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          Events
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-foreground">
            {event.title}
          </h1>
          <EventStatusButton eventId={event.id} status={status} />
          {status === "DRAFT" && <DraftWarningIcon eventId={event.id} />}
        </div>
        <div className="mt-3">
          <EventTabs eventId={event.id} />
        </div>
      </div>

      {status === "DRAFT" && <DraftBanner eventId={event.id} status={status} />}

      <div className="flex-1">{children}</div>
    </div>
  );
}
