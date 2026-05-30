import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { EventTabs } from "@/components/dashboard/event-tabs";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function VendorEventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } });
  if (!dbUser) redirect("/login");

  // Check vendor membership — user must be an ACCEPTED vendor for this event
  const eventVendor = await prisma.eventVendor.findFirst({
    where: { eventId, userId: dbUser.id, status: "ACCEPTED" },
    include: { event: { select: { id: true, title: true } } },
  });

  if (!eventVendor) notFound();

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-border bg-card px-4 py-4 sm:px-6">
        <Link
          href="/dashboard"
          className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          Dashboard
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-foreground">
            {eventVendor.event.title}
          </h1>
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Vendor
          </span>
        </div>
        <div className="mt-3">
          <EventTabs eventId={eventId} userRole="vendor" />
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
