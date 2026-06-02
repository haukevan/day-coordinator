import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { VenuesList } from "@/components/dashboard/venues-list";

export default async function VenuesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
  });
  if (!dbUser) redirect("/login");
  if (!dbUser.onboarded) redirect("/onboarding");

  const venues = await prisma.venue.findMany({
    where: { creatorId: dbUser.id },
    include: {
      events: {
        select: { id: true, title: true, status: true },
        orderBy: { eventDate: "desc" },
      },
      _count: { select: { events: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const serialized = JSON.parse(JSON.stringify(venues));

  return (
    <div className="flex min-h-full flex-col">
      {/* Page header */}
      <div className="border-b border-border bg-card px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold text-foreground">Venues</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Manage your saved venues across all events.
        </p>
      </div>

      {/* Venue list (client component) */}
      <div className="flex-1 px-4 py-4 pb-20 sm:px-6 sm:pb-6">
        <VenuesList initialVenues={serialized} />
      </div>
    </div>
  );
}
