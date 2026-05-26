"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { ExternalLink } from "lucide-react";

type EventStatus = "DRAFT" | "SCHEDULED" | "LIVE" | "COMPLETED" | "ARCHIVED";

type EventData = {
  id: string;
  title: string;
  description: string | null;
  eventDate: string | null;
  timezone: string;
  slug: string | null;
  status: EventStatus;
  publicTimeline: boolean;
};

export function EventSettingsForm({ event }: { event: EventData }) {
  const router = useRouter();
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [eventDate, setEventDate] = useState(
    event.eventDate
      ? new Date(event.eventDate).toISOString().split("T")[0]
      : "",
  );
  const [timezone, setTimezone] = useState(event.timezone);
  const [slug, setSlug] = useState(event.slug ?? "");
  const [publicTimeline, setPublicTimeline] = useState(event.publicTimeline);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [appOrigin, setAppOrigin] = useState("https://daycoordinator.com");

  useEffect(() => {
    setAppOrigin(window.location.origin);
  }, []);

  const isLive =
    event.status === "LIVE" ||
    event.status === "COMPLETED" ||
    event.status === "ARCHIVED";

  async function handlePublicToggle(checked: boolean) {
    setPublicTimeline(checked);
    await fetch(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicTimeline: checked }),
    });
    router.refresh();
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSaveError("");

    const res = await fetch(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        eventDate: eventDate || null,
        timezone,
        slug: slug || null,
      }),
    });

    setSaving(false);

    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      setSaveError(data.error ?? "Failed to save.");
    }
  }

  return (
    <div className="space-y-8 p-6">
      {/* Edit form */}
      <form onSubmit={handleSave} className="space-y-5">
        <h2 className="text-sm font-semibold text-foreground">Event details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLive}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isLive}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Event date
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              disabled={isLive}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Timezone
            </label>
            <TimezoneSelect
              value={timezone}
              onChange={setTimezone}
              disabled={isLive}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Public link
            </label>
            {event.slug && event.status !== "DRAFT" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-md border border-input bg-muted/40 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Make timeline public
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Allow anyone with the link to view your event timeline
                    </p>
                  </div>
                  <Switch
                    checked={publicTimeline}
                    onCheckedChange={handlePublicToggle}
                  />
                </div>
                {publicTimeline && (
                  <div className="flex items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-2">
                    <span className="flex-1 truncate text-sm text-foreground">
                      {appOrigin}/e/{event.slug}
                    </span>
                    <a
                      href={`/e/${event.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-primary hover:text-primary/80 transition-colors"
                      aria-label="Open public link"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  disabled={isLive}
                  placeholder="my-wedding-day"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {event.status === "DRAFT"
                    ? "Shareable once your event is scheduled."
                    : `${appOrigin}/e/…`}
                </p>
              </>
            )}
          </div>
        </div>
        {saveError && <p className="text-xs text-destructive">{saveError}</p>}
        {isLive && (
          <p className="text-xs text-muted-foreground">
            Event details are locked while the event is live.
          </p>
        )}
        <Button type="submit" disabled={saving || isLive}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </div>
  );
}
