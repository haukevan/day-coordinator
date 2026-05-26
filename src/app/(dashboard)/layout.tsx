import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { Logo } from "@/components/ui/logo";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { UserMenu } from "@/components/dashboard/user-menu";

function buildAvatar(
  firstName: string | null,
  lastName: string | null,
  name: string | null,
  email: string,
) {
  const initials =
    firstName && lastName
      ? `${firstName[0]}${lastName[0]}`.toUpperCase()
      : name
        ? name.slice(0, 2).toUpperCase()
        : email.slice(0, 2).toUpperCase();

  const displayName = firstName
    ? `${firstName}${lastName ? ` ${lastName}` : ""}`
    : (name ?? email);

  return { initials, displayName };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      onboarded: true,
    },
  });

  if (!dbUser) redirect("/login");
  if (!dbUser.onboarded) redirect("/onboarding");

  const { initials, displayName } = buildAvatar(
    dbUser.firstName,
    dbUser.lastName,
    dbUser.name,
    dbUser.email,
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-border bg-card sm:flex">
        <div className="flex h-14 items-center border-b border-border px-4">
          <Link href="/dashboard">
            <Logo size="sm" />
          </Link>
        </div>

        <SidebarNav />

        <div className="border-t border-border px-3 py-3">
          <UserMenu
            initials={initials}
            displayName={displayName}
            email={dbUser.email}
            variant="sidebar"
          />
        </div>
      </aside>

      {/* ── Mobile top bar (hidden on desktop) ── */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card px-4 sm:hidden">
        <Link href="/dashboard">
          <Logo size="sm" iconOnly />
        </Link>
        <UserMenu
          initials={initials}
          displayName={displayName}
          email={dbUser.email}
        />
      </header>

      {/* ── Main content ── */}
      {/* Mobile: top bar (56px) padding */}
      {/* Desktop: left sidebar (224px / w-56) padding */}
      <main className="w-full min-h-screen pt-14 sm:pl-56 sm:pt-0">
        {children}
      </main>
    </div>
  );
}
