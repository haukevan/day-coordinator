import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { VendorsList } from "@/components/dashboard/vendors-list";

export default async function VendorsPage() {
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

  const vendors = await prisma.vendorContact.findMany({
    where: { ownerId: dbUser.id },
    include: {
      eventVendors: {
        include: {
          event: { select: { id: true, title: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { eventVendors: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const serialized = JSON.parse(JSON.stringify(vendors)).map(
    (v: Record<string, unknown>) => ({
      id: v.id,
      email: v.email,
      firstName: v.firstName,
      lastName: v.lastName,
      phone: v.phone,
      company: v.company,
      jobTitle: v.jobTitle,
      events: (
        v.eventVendors as
          | Array<{ event: { id: string; title: string; status: string } }>
          | undefined
      )?.map((ev) => ev.event),
      _count: v._count,
    }),
  );

  return (
    <div className="flex min-h-full flex-col">
      {/* Page header */}
      <div className="border-b border-border bg-card px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold text-foreground">Vendors</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Manage your vendor contacts across all events.
        </p>
      </div>

      {/* Vendor list (client component) */}
      <div className="flex-1 px-4 py-4 pb-20 sm:px-6 sm:pb-6">
        <VendorsList initialVendors={serialized} userEmail={dbUser.email} />
      </div>
    </div>
  );
}
