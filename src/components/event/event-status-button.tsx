"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { UpgradeModal } from "@/components/event/upgrade-modal";

type EventStatus = "DRAFT" | "SCHEDULED" | "LIVE" | "COMPLETED" | "ARCHIVED";

const statusConfig: Record<EventStatus, { label: string; badgeClass: string }> =
  {
    DRAFT: { label: "Draft", badgeClass: "bg-muted text-muted-foreground" },
    SCHEDULED: { label: "Scheduled", badgeClass: "bg-info/15 text-info" },
    LIVE: { label: "Live", badgeClass: "bg-success/15 text-success" },
    COMPLETED: {
      label: "Completed",
      badgeClass: "bg-muted text-muted-foreground",
    },
    ARCHIVED: {
      label: "Archived",
      badgeClass: "bg-muted/60 text-muted-foreground/60",
    },
  };

type Transition = {
  to: EventStatus;
  label: string;
  destructive?: boolean;
};

const transitions: Partial<Record<EventStatus, Transition[]>> = {
  DRAFT: [{ to: "SCHEDULED", label: "Upgrade to Scheduled" }],
  SCHEDULED: [
    { to: "LIVE", label: "Go Live" },
    { to: "DRAFT", label: "Back to Draft", destructive: true },
  ],
  LIVE: [{ to: "COMPLETED", label: "Mark Completed" }],
  COMPLETED: [{ to: "ARCHIVED", label: "Archive", destructive: true }],
};

type Props = {
  eventId: string;
  status: EventStatus;
};

export function EventStatusButton({ eventId, status }: Props) {
  const router = useRouter();
  const config = statusConfig[status] ?? statusConfig.DRAFT;
  const available = transitions[status] ?? [];
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  async function handleTransition(to: EventStatus) {
    if (to === "SCHEDULED" && status === "DRAFT") {
      setUpgradeOpen(true);
      return;
    }

    setTransitioning(true);
    const res = await fetch(`/api/events/${eventId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: to }),
    });
    setTransitioning(false);

    if (res.ok) {
      router.refresh();
    }
  }

  // Non-interactive for statuses with no transitions
  if (available.length === 0) {
    return (
      <span
        className={cn(
          "inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
          config.badgeClass,
        )}
      >
        {config.label}
      </span>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={transitioning}
          className={cn(
            "inline-flex flex-shrink-0 cursor-pointer items-center gap-1 rounded-full pl-2.5 pr-3 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 focus:outline-none",
            config.badgeClass,
          )}
        >
          {status === "LIVE" && (
            <span className="mr-0.5 inline-block size-1.5 animate-pulse rounded-full bg-success" />
          )}
          {config.label}
          <ChevronDown className="size-3 opacity-60" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[180px]">
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            Change status
          </div>
          <DropdownMenuSeparator />
          {available.map((t) => (
            <DropdownMenuItem
              key={t.to}
              onClick={() => handleTransition(t.to)}
              className={cn(
                t.destructive && "text-destructive focus:text-destructive",
              )}
            >
              {t.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <UpgradeModal
        eventId={eventId}
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
      />
    </>
  );
}
