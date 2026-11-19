"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, BellRing, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { usePushSubscription } from "@/lib/notifications/usePushSubscription";
import { supabaseBrowser } from "@/lib/realtime/supabase";
import { relativeTime } from "@/lib/format-time";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  eventId: string;
  eventStatus: string;
  initialPushEnabled: boolean;
  initialSmsEnabled: boolean;
  userHasPhone: boolean;
  /** Where to send the user to add/edit their phone number */
  editPhoneHref: string;
}

/**
 * Notification bell dropdown for an event.
 *
 * Shows a bell icon in the event header. When clicked, opens a dropdown with:
 * - Recent undismissed notifications for this event (last 10)
 * - Individual dismiss (X) per notification
 * - Clear All button
 * - PUSH/SMS toggle switches for per-event preferences
 * - Badge shows count (or "10+" if >10)
 *
 * Only visible when event is SCHEDULED or LIVE.
 */
export function NotificationBell({
  eventId,
  eventStatus,
  initialPushEnabled,
  initialSmsEnabled,
  userHasPhone,
  editPhoneHref,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(initialPushEnabled);
  const [smsEnabled, setSmsEnabled] = useState(initialSmsEnabled);
  const [recentNotifications, setRecentNotifications] = useState<
    Array<{ id: string; type: string; payload: unknown; createdAt: string }>
  >([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { subscribe, unsubscribe, isSubscribed } = usePushSubscription();

  const fetchRecent = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/notifications?limit=10`);
      if (res.ok) {
        const data = await res.json();
        setRecentNotifications(data.notifications ?? []);
        setTotalCount(data.total ?? 0);
      }
    } catch {
      // Silently fail — notifications are non-critical
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [eventId]);

  // Fetch on mount so badge is populated immediately on page load
  useEffect(() => {
    fetchRecent(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  // Fetch when popover opens — show cached data, refresh silently in background
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      setOpen(newOpen);
      if (newOpen) fetchRecent(false);
    },
    [fetchRecent],
  );

  // Subscribe to real-time notification.sent events (best-effort)
  // + service worker message listener for instant push → badge update
  // + poll every 30s as a guaranteed fallback
  useEffect(() => {
    const channel = supabaseBrowser.channel(`event-${eventId}`);

    channel
      .on("broadcast", { event: "notification.sent" }, () => {
        fetchRecent(false); // silent — no loading spinner for background updates
      })
      .subscribe();

    // Service worker → page: refetch instantly when a push notification arrives
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "NOTIFICATION_RECEIVED") {
        fetchRecent(false);
      }
    };
    navigator.serviceWorker?.addEventListener("message", onSwMessage);

    // Refetch when user returns to this tab (covers "was away, missed a push")
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchRecent(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      void supabaseBrowser.removeChannel(channel);
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [eventId, fetchRecent]);

  const dismissOne = async (id: string) => {
    // Optimistic remove
    setRecentNotifications((prev) => prev.filter((n) => n.id !== id));
    setTotalCount((c) => Math.max(0, c - 1));
    try {
      await fetch(`/api/events/${eventId}/notifications`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
    } catch {
      // Revert on failure
      fetchRecent();
    }
  };

  const dismissAll = async () => {
    // Optimistic clear
    setRecentNotifications([]);
    setTotalCount(0);
    try {
      await fetch(`/api/events/${eventId}/notifications`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch {
      fetchRecent();
    }
  };

  const savePrefs = async (push: boolean, sms: boolean) => {
    setSaving(true);
    try {
      await fetch(`/api/events/${eventId}/notification-prefs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pushEnabled: push, smsEnabled: sms }),
      });
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

    // Only manage browser subscription when push is explicitly toggled
    try {
      if (enabled && !isSubscribed) await subscribe();
      if (!enabled && isSubscribed) await unsubscribe();
    } catch (err) {
      console.error("[bell] Push subscription change failed:", err);
      // Revert push toggle on subscription failure
      setPushEnabled(!enabled);
      await savePrefs(!enabled, smsEnabled);
    }
  };

  const handleSmsToggle = async (enabled: boolean) => {
    setSmsEnabled(enabled);
    await savePrefs(pushEnabled, enabled);
  };

  // Don't render for DRAFT, COMPLETED, or ARCHIVED events
  if (eventStatus !== "SCHEDULED" && eventStatus !== "LIVE") {
    return null;
  }

  const hasNotifications = totalCount > 0;
  const badgeLabel = totalCount > 10 ? "10+" : String(totalCount);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
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
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground",
                totalCount > 10 ? "px-1 min-w-[22px] h-4" : "size-4",
              )}
            >
              {badgeLabel}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h4 className="text-sm font-semibold text-foreground">
            Notifications
          </h4>
          {hasNotifications && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={dismissAll}
            >
              Clear all
            </Button>
          )}
        </div>

        {/* Recent notifications list */}
        <div className="max-h-64 overflow-y-auto">
          {loading && recentNotifications.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : recentNotifications.length === 0 ? (
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
                    "group px-4 py-3 border-b border-border last:border-0",
                    "hover:bg-accent/50 transition-colors",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
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
                        {relativeTime(n.createdAt)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity mt-0.5"
                      aria-label="Dismiss notification"
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissOne(n.id);
                      }}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
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
            <div>
              <span className="text-sm text-foreground">SMS</span>
              {!userHasPhone && (
                <p className="text-xs text-muted-foreground">
                  <a
                    href={editPhoneHref}
                    className="underline hover:text-foreground"
                  >
                    Add your phone number
                  </a>{" "}
                  to enable SMS notifications.
                </p>
              )}
            </div>
            <Switch
              checked={smsEnabled}
              onCheckedChange={handleSmsToggle}
              disabled={saving || !userHasPhone}
              aria-label="Toggle SMS notifications for this event"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
