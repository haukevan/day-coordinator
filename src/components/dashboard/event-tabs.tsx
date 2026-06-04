"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, Users, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_TABS = [
  { label: "Timeline", segment: "timeline", icon: Clock },
  { label: "Vendors", segment: "vendors", icon: Users },
  { label: "Settings", segment: "settings", icon: Settings },
];

const VENDOR_TABS = [
  { label: "Timeline", segment: "timeline", icon: Clock },
  { label: "Vendors", segment: "vendors", icon: Users },
];

export function EventTabs({
  eventId,
  userRole,
  rightContent,
}: {
  eventId: string;
  userRole: "admin" | "vendor";
  rightContent?: React.ReactNode;
}) {
  const pathname = usePathname();
  const tabs = userRole === "vendor" ? VENDOR_TABS : ADMIN_TABS;
  const baseHref =
    userRole === "vendor" ? `/vendor/${eventId}` : `/events/${eventId}`;

  return (
    <div className="flex items-center justify-between gap-2">
      <nav className="flex gap-1">
        {tabs.map((tab) => {
          const href = `${baseHref}/${tab.segment}`;
          const isActive = pathname.endsWith(`/${tab.segment}`);
          const Icon = tab.icon;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors min-h-[36px] sm:px-3 sm:py-1.5 sm:text-sm",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              aria-label={tab.label}
            >
              <Icon className="size-4 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
      {rightContent}
    </div>
  );
}
