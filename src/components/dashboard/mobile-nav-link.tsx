"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Props {
  href: string;
  icon: LucideIcon;
  label: string;
}

export function MobileNavLink({ href, icon: Icon, label }: Props) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 px-4 py-2 transition-colors",
        isActive ? "text-primary" : "text-muted-foreground"
      )}
    >
      <Icon className="size-5" />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}
