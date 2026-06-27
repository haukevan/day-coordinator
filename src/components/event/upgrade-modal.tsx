"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Bell, Lock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  eventId: string;
  /** ISO string or null if no date has been set. */
  eventDate: string | null;
  open: boolean;
  onClose: () => void;
  onUpgraded?: () => void;
};

function formatEventDate(iso: string | null): string {
  if (!iso) return "No date set";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function UpgradeModal({
  eventId,
  eventDate,
  open,
  onClose,
  onUpgraded,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  async function handleUpgrade(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch(`/api/events/${eventId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "SCHEDULED", password }),
    });

    setLoading(false);

    if (res.ok) {
      onClose();
      onUpgraded?.();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to schedule event.");
    }
  }

  const formattedDate = formatEventDate(eventDate);
  const hasDate = eventDate !== null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm sm:max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upgrade to Scheduled</DialogTitle>
          <DialogDescription>
            Scheduling your event unlocks vendor invitations, timeline sharing,
            and notifications.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
            <Users className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Invite vendors &amp; guests
              </p>
              <p className="text-xs text-muted-foreground">
                Share your timeline and coordinate in real time.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
            <Bell className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Automated notifications
              </p>
              <p className="text-xs text-muted-foreground">
                SMS &amp; email reminders sent automatically on event day.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
            <Calendar className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Auto-live on event day
              </p>
              <p className="text-xs text-muted-foreground">
                Your event goes live automatically at the start of the event
                date.
              </p>
            </div>
          </div>
        </div>

        {/* Event date confirmation */}
        <div
          className={cn(
            "rounded-lg border p-3",
            hasDate
              ? "border-warning/30 bg-warning/5"
              : "border-destructive/30 bg-destructive/5",
          )}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className={cn(
                "mt-0.5 size-4 shrink-0",
                hasDate ? "text-warning" : "text-destructive",
              )}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {hasDate ? "Confirm your event date" : "Event date required"}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-sm font-semibold",
                  hasDate ? "text-foreground" : "text-destructive",
                )}
              >
                {formattedDate}
              </p>
              <p className="mt-1 text-xs text-muted-foreground break-words">
                {hasDate
                  ? "You can update this date in settings before the event day. Once the event date arrives, the date will be locked and cannot be changed."
                  : "You must set an event date before scheduling. Your event can't go live without one."}
              </p>
              {!hasDate && (
                <Button asChild size="sm" variant="outline" className="mt-2">
                  <Link href={`/events/${eventId}/settings`}>
                    Go to settings →
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Access code — placeholder for Stripe payment */}
        {hasDate ? (
          <form onSubmit={handleUpgrade} className="space-y-3">
            <div>
              <label
                htmlFor="upgrade-password"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                We are currently in a closed{" "}
                <span className="inline-flex items-center rounded-full border border-accent/30 animate-shimmer px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                  Beta
                </span>
                . Please enter the access code provided to you or reach out to
                daycoordinator.org@gmail.com to request beta access.
              </label>
              <label
                htmlFor="upgrade-password"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Access code
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="upgrade-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter access code"
                  autoComplete="off"
                  className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50"
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                A payment step will be added here in the future.
              </p>
            </div>

            {/* Date confirmation checkbox */}
            <label className="flex items-start gap-2.5 rounded-md p-2 -mx-2 cursor-pointer hover:bg-muted/30 transition-colors">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary cursor-pointer"
              />
              <span className="text-xs text-muted-foreground leading-relaxed select-none">
                I confirm the event date shown above is correct. I understand I
                can change it before the event day, but the date will be locked
                once the event goes live.
              </span>
            </label>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <DialogFooter className="flex-col gap-2 sm:flex-row pt-2">
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={loading || !password.trim() || !confirmed}
              >
                {loading ? "Scheduling…" : "Schedule event"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted-foreground sm:w-auto"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground sm:w-auto"
              onClick={onClose}
            >
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
