"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { usePushSubscription } from "@/lib/notifications/usePushSubscription";
import { cn } from "@/lib/utils";
import type { Notification } from "@/generated/prisma/client";

interface NotificationBellProps {
  eventId: string;
  eventStatus: string;
  initialPushEnabled: boolean;
  initialSmsEnabled: boolean;
}

/**
 * Notification bell dropdown for an event.
 *
 * Shows a bell icon in the event header. When clicked, opens a dropdown with:
 * - Recent notifications for this event (last 10)
 * - PUSH/SMS toggle switches for per-event preferences
 *
 * Only visible when event is SCHEDULED or LIVE.
 */
export function NotificationBell({
  eventId,
  eventStatus,
  initialPushEnabled,
  initialSmsEnabled,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(initialPushEnabled);
  const [smsEnabled, setSmsEnabled] = useState(initialSmsEnabled);
  const [recentNotifications, setRecentNotifications] = useState<
    Array<{ id: string; type: string; payload: unknown; createdAt: string }>
  >([]);
  const [saving, setSaving] = useState(false);
  const { subscribe, unsubscribe, isSubscribed } = usePushSubscription();

  const fetchRecent = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/notifications?limit=10`);
      if (res.ok) {
        const data = await res.json();
        setRecentNotifications(data.notifications ?? []);
      }
    } catch {
      // Silently fail — notifications are non-critical
    }
  }, [eventId]);

  // Fetch recent notifications when dropdown opens
  useEffect(() => {
    if (open) fetchRecent();
  }, [open, fetchRecent]);

  const savePrefs = async (push: boolean, sms: boolean) => {
    setSaving(true);
    try {
      await fetch(`/api/events/${eventId}/notification-prefs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pushEnabled: push, smsEnabled: sms }),
      });

      if (push && !isSubscribed) await subscribe();
      if (!push && isSubscribed) await unsubscribe();
    } catch (err) {
      console.error("[bell] Failed to save prefs:", err);
      // Revert
      setPushEnabled(initialPushEnabled);
      setSmsEnabled(initialSmsEnabled);
    } finally {
      setSaving(false);
    }
  };

  const handlePushToggle = async (enabled: boolean) => {
    setPushEnabled(enabled);
    await savePrefs(enabled, smsEnabled);
  };

  const handleSmsToggle = async (enabled: boolean) => {
    setSmsEnabled(enabled);
    await savePrefs(pushEnabled, enabled);
  };

  // Don't render for DRAFT, COMPLETED, or ARCHIVED events
  if (eventStatus !== "SCHEDULED" && eventStatus !== "LIVE") {
    return null;
  }

  const hasNotifications = recentNotifications.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          {hasNotifications ? (
            <BellRing className="size-5" />
          ) : (
            <Bell className="size-5" />
          )}
          {hasNotifications && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {recentNotifications.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-4 border-b border-border">
          <h4 className="text-sm font-semibold text-foreground">
            Notifications
          </h4>
        </div>

        {/* Recent notifications list */}
        <div className="max-h-64 overflow-y-auto">
          {recentNotifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </p>
          ) : (
            recentNotifications.map((n) => {
              const p = n.payload as Record<string, unknown> | null;
              return (
                <div
                  key={n.id}
                  className={cn(
                    "px-4 py-3 border-b border-border last:border-0",
                    "hover:bg-accent/50 cursor-pointer transition-colors",
                  )}
                  onClick={() => {
                    const url =
                      p?.data &&
                      typeof p.data === "object" &&
                      "url" in (p.data as Record<string, unknown>)
                        ? (p.data as Record<string, string>).url
                        : undefined;
                    if (url) window.location.href = url;
                    setOpen(false);
                  }}
                >
                  <p className="text-sm font-medium text-foreground">
                    {typeof p?.title === "string" ? p.title : n.type}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {typeof p?.body === "string" ? p.body : ""}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Preference toggles */}
        <div className="border-t border-border p-4 space-y-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Preferences for this event
          </p>

          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Push</span>
            <Switch
              checked={pushEnabled}
              onCheckedChange={handlePushToggle}
              disabled={saving}
              aria-label="Toggle push notifications for this event"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">SMS</span>
            <Switch
              checked={smsEnabled}
              onCheckedChange={handleSmsToggle}
              disabled={saving}
              aria-label="Toggle SMS notifications for this event"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
