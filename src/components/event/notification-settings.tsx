"use client";

import { useState } from "react";
import { Bell, BellOff, Smartphone, Monitor } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { usePushSubscription } from "@/lib/notifications/usePushSubscription";
import { cn } from "@/lib/utils";

interface NotificationSettingsProps {
  initialPushEnabled: boolean;
  initialSmsEnabled: boolean;
  className?: string;
}

/**
 * Notification preferences panel.
 *
 * Allows users to toggle push notifications on/off and SMS on/off.
 * Push toggle integrates with browser Push API via usePushSubscription hook.
 *
 * Preferences are saved to the user profile via PATCH /api/user/profile.
 */
export function NotificationSettings({
  initialPushEnabled,
  initialSmsEnabled,
  className,
}: NotificationSettingsProps) {
  const [pushEnabled, setPushEnabled] = useState(initialPushEnabled);
  const [smsEnabled, setSmsEnabled] = useState(initialSmsEnabled);
  const [saving, setSaving] = useState(false);
  const {
    subscribe,
    unsubscribe,
    isSubscribed,
    isLoading: pushLoading,
  } = usePushSubscription();

  const savePreferences = async (push: boolean, sms: boolean) => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pushEnabled: push, smsEnabled: sms }),
      });
      if (!res.ok) throw new Error("Failed to save");
    } catch (err) {
      // Revert on failure
      setPushEnabled(initialPushEnabled);
      setSmsEnabled(initialSmsEnabled);
      console.error("[settings] Failed to save notification prefs:", err);
    } finally {
      setSaving(false);
    }
  };

  const handlePushToggle = async (enabled: boolean) => {
    setPushEnabled(enabled);
    await savePreferences(enabled, smsEnabled);

    if (enabled && !isSubscribed) {
      await subscribe();
    } else if (!enabled && isSubscribed) {
      await unsubscribe();
    }
  };

  const handleSmsToggle = async (enabled: boolean) => {
    setSmsEnabled(enabled);
    await savePreferences(pushEnabled, enabled);
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            {pushEnabled ? (
              <Bell className="size-5 text-foreground" />
            ) : (
              <BellOff className="size-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Push Notifications
            </p>
            <p className="text-xs text-muted-foreground">
              Receive alerts even when the app is closed
            </p>
          </div>
        </div>
        <Switch
          checked={pushEnabled}
          onCheckedChange={handlePushToggle}
          disabled={pushLoading || saving}
          aria-label="Toggle push notifications"
        />
      </div>

      {pushEnabled && (
        <div className="ml-[52px] flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
          <Monitor className="size-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground flex-1">
            {isSubscribed
              ? "This device is subscribed to push notifications."
              : "Push is enabled but this device hasn't subscribed yet."}
          </p>
          {!isSubscribed && (
            <Button
              size="xs"
              variant="outline"
              onClick={subscribe}
              disabled={pushLoading}
            >
              Subscribe
            </Button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <Smartphone className="size-5 text-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              SMS Notifications
            </p>
            <p className="text-xs text-muted-foreground">
              Receive text messages for urgent updates
            </p>
          </div>
        </div>
        <Switch
          checked={smsEnabled}
          onCheckedChange={handleSmsToggle}
          disabled={saving}
          aria-label="Toggle SMS notifications"
        />
      </div>

      {saving && (
        <p className="text-xs text-muted-foreground text-center">Saving...</p>
      )}
    </div>
  );
}
