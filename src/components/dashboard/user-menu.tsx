"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Moon, Sun, User, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProfileQuery } from "@/lib/query/hooks";
import { cn } from "@/lib/utils";

interface Props {
  initials: string;
  displayName: string;
  email: string;
  /** "icon" variant used in the mobile top bar (circle button, no text) */
  variant?: "icon" | "sidebar";
}

export function UserMenu({
  initials,
  displayName,
  email,
  variant = "icon",
}: Readonly<Props>) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  // Profile is fetched once per session and cached; server props are the
  // fallback until that first request resolves.
  const { data: profile } = useProfileQuery();

  const resolvedName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
      profile.name ||
      profile.email
    : displayName;
  const resolvedEmail = profile?.email ?? email;

  let resolvedInitials = initials;
  if (profile) {
    if (profile.firstName && profile.lastName) {
      resolvedInitials =
        `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase();
    } else {
      resolvedInitials = (profile.name ?? profile.email)
        .slice(0, 2)
        .toUpperCase();
    }
  }

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    // Session cache must not leak into the next signed-in user.
    queryClient.clear();
    router.push("/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "sidebar" ? (
          <button className="flex min-w-0 items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-muted w-full text-left">
            <div className="flex size-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {resolvedInitials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">
                {resolvedName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {resolvedEmail}
              </p>
            </div>
          </button>
        ) : (
          <button
            title={resolvedName}
            className="flex size-8 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {resolvedInitials}
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium text-foreground">
              {resolvedName}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {resolvedEmail}
            </p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <a
            href="/onboarding"
            className="flex items-center gap-2 cursor-pointer"
          >
            <User className="size-4" />
            Profile
          </a>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex items-center gap-2 cursor-pointer"
        >
          {theme === "dark" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={signOut}
          className={cn(
            "flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive",
          )}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
