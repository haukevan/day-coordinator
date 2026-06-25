"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { CalendarDays, BriefcaseBusiness, MapPin, Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
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

export function MobileNavSheet() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="sm:hidden">
          <Menu className="size-5" />
          <span className="sr-only">Open navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-56 p-0">
        {/* Header */}
        <SheetHeader className="flex h-14 flex-row items-center justify-between border-b border-border px-4 py-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Logo size="sm" />
        </SheetHeader>

        {/* Nav items */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive = isNavActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
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
      </SheetContent>
    </Sheet>
  );
}
