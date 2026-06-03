"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarIcon, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { VenueSelector } from "@/components/ui/venue-selector";
import { cn } from "@/lib/utils";

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
  venueId: string | null;
};

export function EventSettingsForm({ event }: { event: EventData }) {
  const router = useRouter();
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  // Parse event date as local noon so it survives timezone round-trips.
  // event.eventDate comes from the API as an ISO string like "2026-06-03T12:00:00.000Z"
  // We extract the date portion and construct a local-noon Date so that
  // date-fns format() in the user's local timezone always yields the correct date.
  const [eventDate, setEventDate] = useState<Date | undefined>(() => {
    if (!event.eventDate) return undefined;
    // Extract just the date part from the ISO string (handles both midnight and noon UTC)
    const datePart = event.eventDate.split("T")[0];
    // Construct as local noon — preserves the date regardless of timezone
    return new Date(datePart + "T12:00:00");
  });
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timezone, setTimezone] = useState(event.timezone);
  const [slug, setSlug] = useState(event.slug ?? "");
  const [publicTimeline, setPublicTimeline] = useState(event.publicTimeline);
  const [venueId, setVenueId] = useState<string | null>(event.venueId);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [appOrigin, setAppOrigin] = useState("https://daycoordinator.com");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

  async function handleDelete() {
    setDeleting(true);
    setDeleteError("");
    const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      const text = await res.text();
      let message = "Failed to delete event.";
      try {
        message = (JSON.parse(text) as { error?: string }).error ?? message;
      } catch {
        // non-JSON error body — keep default message
      }
      setDeleteError(message);
    }
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
        // Send only the date portion — server will store at UTC noon
        eventDate: eventDate ? format(eventDate, "yyyy-MM-dd") : null,
        timezone,
        slug: slug || null,
        venueId: venueId || null,
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
            <div className="mb-1.5 flex items-baseline justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Title <span className="text-destructive">*</span>
              </label>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  title.length >= 90
                    ? "text-warning-foreground"
                    : "text-muted-foreground/50",
                )}
              >
                {title.length}/100
              </span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLive}
              required
              maxLength={100}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="sm:col-span-2">
            <div className="mb-1.5 flex items-baseline justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Description
              </label>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  description.length >= 450
                    ? "text-warning-foreground"
                    : "text-muted-foreground/50",
                )}
              >
                {description.length}/500
              </span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isLive}
              maxLength={500}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Event date
            </label>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={isLive}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
                    !eventDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="size-4 shrink-0" />
                  {eventDate ? format(eventDate, "MMM d, yyyy") : "Pick a date"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={eventDate}
                  onSelect={(date) => {
                    setEventDate(date);
                    setDatePickerOpen(false);
                  }}
                  disabled={{
                    before: new Date(new Date().setHours(0, 0, 0, 0)),
                  }}
                />
              </PopoverContent>
            </Popover>
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
          {/* Event location */}
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Event location
            </label>
            <VenueSelector
              venueId={venueId}
              onChange={setVenueId}
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

      {/* Danger zone */}
      {event.status !== "LIVE" && (
        <div className="rounded-xl border border-destructive/30 p-5">
          <h2 className="mb-1 text-sm font-semibold text-destructive">
            Danger zone
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Permanently delete this event and all its data. This cannot be
            undone.
          </p>
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Type{" "}
                <span className="font-semibold text-foreground">
                  {event.title}
                </span>{" "}
                to confirm
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={event.title}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-destructive/50"
              />
            </div>
            {deleteError && (
              <p className="text-xs text-destructive">{deleteError}</p>
            )}
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteConfirm !== event.title || deleting}
              onClick={handleDelete}
            >
              <Trash2 className="size-3.5" />
              {deleting ? "Deleting…" : "Delete event"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
