"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UpgradeModal } from "@/components/event/upgrade-modal";
import { cn } from "@/lib/utils";

type Props = {
  eventId: string;
  status: string;
};

function storageKey(eventId: string) {
  return `dc-draft-dismissed-${eventId}`;
}

export function DraftBanner({ eventId, status }: Props) {
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
          "flex items-start gap-3 border-b border-warning/30 bg-warning/10 px-4 py-3 sm:px-6",
        )}
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            This event is in draft mode
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Vendors and guests won&apos;t be notified or invited until you
            upgrade to Scheduled.
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2 h-auto px-0 text-xs text-primary hover:text-primary/80 hover:bg-transparent"
            onClick={() => setUpgradeOpen(true)}
          >
            Upgrade to Scheduled →
          </Button>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring/50"
          aria-label="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <UpgradeModal
        eventId={eventId}
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
    <button
      onClick={reopen}
      className="rounded p-0.5 text-warning transition-colors hover:text-warning/80 focus:outline-none focus:ring-1 focus:ring-ring/50"
      aria-label="View draft mode notice"
      title="This event is in draft mode"
    >
      <AlertTriangle className="size-4" />
    </button>
  );
}
