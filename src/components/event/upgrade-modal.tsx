"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Bell } from "lucide-react";

type Props = {
  eventId: string;
  open: boolean;
  onClose: () => void;
};

export function UpgradeModal({ eventId, open, onClose }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleBypass() {
    setLoading(true);
    setError("");

    const res = await fetch(`/api/events/${eventId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "SCHEDULED" }),
    });

    setLoading(false);

    if (res.ok) {
      onClose();
      router.refresh();
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

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button className="w-full sm:w-auto" disabled>
            Upgrade — coming soon
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground sm:w-auto"
            onClick={handleBypass}
            disabled={loading}
          >
            {loading ? "Scheduling…" : "Skip for now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
