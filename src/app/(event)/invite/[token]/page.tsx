import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { VendorJoinForm } from "./_form";

export default async function InvitePage({
  params,
}: {
  readonly params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/invite/${token}`);

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      onboarded: true,
    },
  });
  if (!dbUser) redirect("/login");

  const eventVendor = await prisma.eventVendor.findUnique({
    where: { inviteToken: token },
    include: {
      vendorContact: true,
      event: {
        select: {
          id: true,
          title: true,
          eventDate: true,
          venue: {
            select: { name: true, address: true, lat: true, lng: true },
          },
        },
      },
    },
  });

  if (!eventVendor) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 bg-background">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-foreground">
            Invite not found
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            This invite link is invalid or has already been used.
          </p>
        </div>
      </div>
    );
  }

  if (
    eventVendor.inviteTokenExpiresAt &&
    eventVendor.inviteTokenExpiresAt < new Date()
  ) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 bg-background">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-foreground">
            Invite expired
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            This invite link has expired. Ask your event coordinator to resend
            it.
          </p>
        </div>
      </div>
    );
  }

  // Already accepted — redirect to vendor event view
  if (eventVendor.status === "ACCEPTED") {
    redirect(`/vendor/${eventVendor.event.id}/timeline`);
  }

  const initialPhoneDigits = dbUser.phone?.startsWith("+1")
    ? dbUser.phone.slice(2)
    : "";

  return (
    <VendorJoinForm
      token={token}
      eventId={eventVendor.event.id}
      eventTitle={eventVendor.event.title}
      eventDate={eventVendor.event.eventDate?.toISOString() ?? null}
      eventVenue={
        eventVendor.event.venue
          ? {
              name: eventVendor.event.venue.name,
              address: eventVendor.event.venue.address,
              lat: eventVendor.event.venue.lat,
              lng: eventVendor.event.venue.lng,
            }
          : null
      }
      onboarded={dbUser.onboarded}
      userEmail={dbUser.email}
      inviteEmail={eventVendor.vendorContact.email}
      initialFirstName={
        dbUser.onboarded
          ? (dbUser.firstName ?? eventVendor.vendorContact.firstName ?? "")
          : (eventVendor.vendorContact.firstName ?? "")
      }
      initialLastName={
        dbUser.onboarded
          ? (dbUser.lastName ?? eventVendor.vendorContact.lastName ?? "")
          : (eventVendor.vendorContact.lastName ?? "")
      }
      initialPhoneDigits={dbUser.onboarded ? initialPhoneDigits : ""}
      initialCompany={
        eventVendor.company ?? eventVendor.vendorContact.company ?? ""
      }
      initialJobTitle={
        eventVendor.jobTitle ?? eventVendor.vendorContact.jobTitle ?? ""
      }
    />
  );
}
