"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UpgradeModal } from "@/components/event/upgrade-modal";
import { cn } from "@/lib/utils";

type Props = {
  eventId: string;
  status: string;
  eventDate: string | null;
};

function storageKey(eventId: string) {
  return `dc-draft-dismissed-${eventId}`;
}

export function DraftBanner({ eventId, status, eventDate }: Props) {
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid hydration flash
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  useEffect(() => {
    if (status !== "DRAFT") return;
    const saved = localStorage.getItem(storageKey(eventId));
    setDismissed(saved === "true");
  }, [eventId, status]);

  if (status !== "DRAFT") return null;

  // ── Slim banner (dismissed) ──────────────────────────────────────────
  if (dismissed) {
    return (
      <>
        <div className="flex items-center gap-2 border-b border-warning/20 bg-warning/5 px-3 py-1.5 sm:px-6">
          <AlertTriangle className="size-3.5 shrink-0 text-warning/70" />
          <span className="min-w-0 text-xs text-warning/80">
            <span className="font-medium">Draft</span>
            {" — "}
            <button
              onClick={() => setUpgradeOpen(true)}
              className="text-xs hover:text-warning transition-colors"
            >
              Upgrade to go Live
            </button>
          </span>
          <button
            onClick={() => {
              localStorage.removeItem(storageKey(eventId));
              setDismissed(false);
            }}
            className="ml-auto shrink-0 rounded p-0.5 text-muted-foreground/50 hover:text-foreground transition-colors"
            aria-label="Show full draft notice"
          >
            <ChevronDown className="size-3.5" />
          </button>
        </div>

        <UpgradeModal
          eventId={eventId}
          eventDate={eventDate}
          open={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
        />
      </>
    );
  }

  // ── Full banner ──────────────────────────────────────────────────────

  function dismiss() {
    localStorage.setItem(storageKey(eventId), "true");
    setDismissed(true);
  }

  return (
    <>
      <div
        className={cn(
          "flex items-start gap-2 border-b border-warning/30 bg-warning/10 px-3 py-2 sm:px-6 sm:py-3",
        )}
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-foreground truncate">
            This event is in draft mode
          </p>
          <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground">
            Vendors and guests won&apos;t be notified or invited until you
            upgrade to Scheduled.
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-1 h-auto px-0 text-[11px] sm:text-xs text-primary hover:text-primary/80 hover:bg-transparent"
            onClick={() => setUpgradeOpen(true)}
          >
            Upgrade to Scheduled →
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={dismiss}
          className="shrink-0"
          aria-label="Dismiss"
        >
          <X />
        </Button>
      </div>

      <UpgradeModal
        eventId={eventId}
        eventDate={eventDate}
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
      />
    </>
  );
}
