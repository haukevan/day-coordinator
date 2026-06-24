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
import { Calendar, Users, Bell, Lock } from "lucide-react";

type Props = {
  eventId: string;
  open: boolean;
  onClose: () => void;
  onUpgraded?: () => void;
};

export function UpgradeModal({ eventId, open, onClose, onUpgraded }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");

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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm sm:max-w-md">
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

        {/* Access code — placeholder for Stripe payment */}
        <form onSubmit={handleUpgrade} className="space-y-3">
          <div>
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

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter className="flex-col gap-2 sm:flex-row pt-2">
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={loading || !password.trim()}
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
      </DialogContent>
    </Dialog>
  );
}
