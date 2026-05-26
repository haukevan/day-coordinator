"use client";

import { useRouter } from "next/navigation";
import { Moon, Sun, User, LogOut, Settings } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Props {
  initials: string;
  displayName: string;
  email: string;
  /** "icon" variant used in the mobile top bar (circle button, no text) */
  variant?: "icon" | "sidebar";
}

export function UserMenu({ initials, displayName, email, variant = "icon" }: Props) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "sidebar" ? (
          <button className="flex min-w-0 items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-muted w-full text-left">
            <div className="flex size-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          </button>
        ) : (
          <button
            title={displayName}
            className="flex size-8 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {initials}
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium text-foreground">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <a href="/onboarding" className="flex items-center gap-2 cursor-pointer">
            <User className="size-4" />
            Profile
          </a>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex items-center gap-2 cursor-pointer"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={signOut}
          className={cn("flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive")}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
