"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, BriefcaseBusiness, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Events", href: "/dashboard", icon: CalendarDays },
  { label: "Vendors", href: "/dashboard/vendors", icon: BriefcaseBusiness },
  { label: "Venues", href: "/dashboard/venues", icon: MapPin },
];

function isNavActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // Events tab (/dashboard) also highlights when browsing event detail pages
  if (href === "/dashboard") return pathname.startsWith("/dashboard/events");
  // Other tabs highlight for any sub-route
  return pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
      {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
        const isActive = isNavActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 flex-shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
