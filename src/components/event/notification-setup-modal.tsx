"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function formatPhone(digits: string): string {
  const d = digits.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

interface Props {
  eventId: string;
  /** User's current phone number (digits only, or empty string) */
  initialPhone: string;
  /** Whether the owner has already set up notification preferences */
  prefsAlreadySet: boolean;
}

const STORAGE_KEY_PREFIX = "dc-notification-setup-dismissed";

/**
 * One-time notification setup modal shown to event owners
 * after they schedule their event.
 *
 * Only appears when:
 * - Event is SCHEDULED
 * - Owner hasn't set up notification preferences yet
 * - Owner hasn't dismissed this modal before (localStorage)
 */
export function NotificationSetupModal({
  eventId,
  initialPhone,
  prefsAlreadySet,
}: Props) {
  const [open, setOpen] = useState(false);
  const [phoneDigits, setPhoneDigits] = useState(initialPhone);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  // Check if we should show the modal (not dismissed, not already set up)
  useEffect(() => {
    if (prefsAlreadySet) return;
    const dismissed = localStorage.getItem(
      `${STORAGE_KEY_PREFIX}-${eventId}`,
    );
    if (!dismissed) {
      // Small delay so the page renders first, then the modal appears
      const timer = setTimeout(() => setOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [eventId, prefsAlreadySet]);

  const dismiss = () => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}-${eventId}`, "1");
    setOpen(false);
  };

  const handlePhoneChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
      setPhoneDigits(digits);
      setPhoneError(
        digits.length > 0 && digits.length < 10
          ? "Please enter a valid 10-digit phone number."
          : "",
      );
    },
    [],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const phone = phoneDigits.length === 10 ? `+1${phoneDigits}` : null;

      // Save user profile (phone)
      if (phoneDigits.length === 10) {
        await fetch("/api/user/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        });
      }

      // Save event notification preferences
      await fetch(`/api/events/${eventId}/notification-prefs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pushEnabled,
          smsEnabled: smsEnabled && phoneDigits.length === 10,
        }),
      });

      dismiss();
    } catch (err) {
      console.error("[notification-setup] Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Notification preferences</DialogTitle>
          <DialogDescription>
            Your event is scheduled! Set up how you&apos;d like to be notified
            about task updates, delays, and reminders.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Phone */}
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Phone number
            </label>
            <div className="flex items-center gap-2">
              <span className="flex h-10 items-center rounded-lg border border-border bg-muted px-3 text-sm text-muted-foreground select-none">
                +1
              </span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={formatPhone(phoneDigits)}
                onChange={handlePhoneChange}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="(555) 123-4567"
                maxLength={14}
              />
            </div>
            {phoneError && (
              <p className="mt-1 text-xs text-destructive">{phoneError}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Used for SMS notifications during your event.
            </p>
          </div>

          {/* Preferences */}
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-foreground">
                  Push notifications
                </span>
                <p className="text-xs text-muted-foreground">
                  Instant alerts in your browser.
                </p>
              </div>
              <Switch
                checked={pushEnabled}
                onCheckedChange={setPushEnabled}
                aria-label="Enable push notifications"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-foreground">
                  SMS notifications
                </span>
                <p className="text-xs text-muted-foreground">
                  Text messages for urgent updates.
                  {phoneDigits.length < 10 &&
                    " Add your phone number to enable."}
                </p>
              </div>
              <Switch
                checked={smsEnabled}
                onCheckedChange={setSmsEnabled}
                disabled={phoneDigits.length < 10}
                aria-label="Enable SMS notifications"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={dismiss}>
              Skip for now
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={saving || !!phoneError}
            >
              {saving ? "Saving…" : "Save preferences"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
