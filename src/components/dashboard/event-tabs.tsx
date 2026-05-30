"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ADMIN_TABS = [
  { label: "Timeline", segment: "timeline" },
  { label: "Vendors", segment: "vendors" },
  { label: "Settings", segment: "settings" },
];

const VENDOR_TABS = [
  { label: "Timeline", segment: "timeline" },
  { label: "Vendors", segment: "vendors" },
];

export function EventTabs({
  eventId,
  userRole,
}: {
  eventId: string;
  userRole: "admin" | "vendor";
}) {
  const pathname = usePathname();
  const tabs = userRole === "vendor" ? VENDOR_TABS : ADMIN_TABS;
  const baseHref =
    userRole === "vendor" ? `/vendor/${eventId}` : `/events/${eventId}`;

  return (
    <nav className="flex gap-1">
      {tabs.map((tab) => {
        const href = `${baseHref}/${tab.segment}`;
        const isActive = pathname.endsWith(`/${tab.segment}`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
