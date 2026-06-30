"use client";

import { useState, useCallback, useEffect } from "react";
import { AlertTriangle, ArrowUpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UpgradeModal } from "@/components/event/upgrade-modal";
import { cn } from "@/lib/utils";

interface Props {
  /** The current event status */
  eventStatus: string;
  /** The event ID for the upgrade modal */
  eventId: string;
  /** ISO date string — required for the upgrade button. If omitted, no upgrade action is shown. */
  eventDate?: string | null;
  /** Optional className for custom styling */
  className?: string;
  /** Variant: "banner" for page-level, "inline" for inside forms/dialogs */
  variant?: "banner" | "inline";
  /** Callback after a successful upgrade */
  onUpgraded?: () => void;
}

export function DraftVendorWarning({
  eventStatus,
  eventId,
  eventDate,
  className,
  variant = "inline",
  onUpgraded,
}: Props) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  // One-way latch: set to true on upgrade, only resets on full unmount/remount
  const [hidden, setHidden] = useState(false);

  const handleUpgraded = useCallback(() => {
    setHidden(true);
    setUpgradeOpen(false);
    onUpgraded?.();
  }, [onUpgraded]);

  // Sync with server prop — hide if status is no longer DRAFT
  useEffect(() => {
    if (eventStatus !== "DRAFT") {
      setHidden(true);
    }
  }, [eventStatus]);

  // Listen for upgrade events from any UpgradeModal on the page
  useEffect(() => {
    function onUpgrade(e: Event) {
      const detail = (e as CustomEvent).detail as { eventId: string };
      if (detail.eventId === eventId) {
        setHidden(true);
        onUpgraded?.();
      }
    }
    window.addEventListener("dc:event-upgraded", onUpgrade);
    return () => window.removeEventListener("dc:event-upgraded", onUpgrade);
  }, [eventId, onUpgraded]);

  // Hidden by local state (upgrade just happened) or by server prop
  if (hidden || eventStatus !== "DRAFT") return null;

  const upgradeButton =
    eventDate != null ? (
      variant === "banner" ? (
        <Button
          type="button"
          size="sm"
          className="shrink-0 gap-1"
          onClick={() => setUpgradeOpen(true)}
        >
          <ArrowUpCircle className="size-3.5" />
          Upgrade
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto px-0 text-xs text-primary hover:text-primary/80 hover:bg-transparent"
          onClick={() => setUpgradeOpen(true)}
        >
          Upgrade to Scheduled
        </Button>
      )
    ) : null;

  const upgradeModal = (
    <UpgradeModal
      eventId={eventId}
      eventDate={eventDate ?? null}
      open={upgradeOpen}
      onClose={() => setUpgradeOpen(false)}
      onUpgraded={handleUpgraded}
    />
  );

  if (variant === "banner") {
    return (
      <>
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/5 px-4 py-3",
            className,
          )}
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              Event is in draft mode
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Vendors won&apos;t receive invites until the event is scheduled.
              Upgrade to send invites and enable vendor access.
            </p>
          </div>
          {upgradeButton}
        </div>
        {upgradeModal}
      </>
    );
  }

  return (
    <>
      <div
        className={cn(
          "flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2",
          className,
        )}
      >
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Draft mode.</span>{" "}
            Vendors won&apos;t receive invites until the event is scheduled.{" "}
            {upgradeButton}
          </p>
        </div>
      </div>
      {upgradeModal}
    </>
  );
}
