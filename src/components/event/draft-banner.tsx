"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
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

    function handleReopen(e: Event) {
      const detail = (e as CustomEvent<{ eventId: string }>).detail;
      if (detail.eventId === eventId) setDismissed(false);
    }
    globalThis.addEventListener("dc:draft-banner-reopen", handleReopen);
    return () =>
      globalThis.removeEventListener("dc:draft-banner-reopen", handleReopen);
  }, [eventId, status]);

  if (status !== "DRAFT" || dismissed) return null;

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
          <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground line-clamp-1 sm:line-clamp-none">
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

/** Icon shown in the header when the draft banner has been dismissed — re-opens it on click */
export function DraftWarningIcon({ eventId }: { eventId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey(eventId));
    setVisible(saved === "true");

    function handleReopen(e: Event) {
      const detail = (e as CustomEvent<{ eventId: string }>).detail;
      if (detail.eventId === eventId) setVisible(false);
    }
    globalThis.addEventListener("dc:draft-banner-reopen", handleReopen);
    return () =>
      globalThis.removeEventListener("dc:draft-banner-reopen", handleReopen);
  }, [eventId]);

  function reopen() {
    localStorage.removeItem(storageKey(eventId));
    setVisible(false);
    globalThis.dispatchEvent(
      new CustomEvent("dc:draft-banner-reopen", { detail: { eventId } }),
    );
  }

  if (!visible) return null;

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={reopen}
      aria-label="View draft mode notice"
      title="This event is in draft mode"
    >
      <AlertTriangle className="text-warning" />
    </Button>
  );
}
