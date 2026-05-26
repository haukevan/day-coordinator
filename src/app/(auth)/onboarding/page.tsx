import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { OnboardingForm } from "./_form";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    select: {
      firstName: true,
      lastName: true,
      company: true,
      phone: true,
      onboarded: true,
    },
  });
  if (!dbUser) redirect("/login");

  // Strip +1 prefix to get the 10-digit string for the phone input
  const initialPhoneDigits = dbUser.phone?.startsWith("+1")
    ? dbUser.phone.slice(2)
    : (dbUser.phone ?? "");

  return (
    <OnboardingForm
      onboarded={dbUser.onboarded}
      initialFirstName={dbUser.firstName ?? ""}
      initialLastName={dbUser.lastName ?? ""}
      initialCompany={dbUser.company ?? ""}
      initialPhoneDigits={initialPhoneDigits}
    />
  );
}
