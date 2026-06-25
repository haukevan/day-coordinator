"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { VenueSelector } from "@/components/ui/venue-selector";
import { cn } from "@/lib/utils";

type SubmitEvent = Parameters<
  NonNullable<React.ComponentProps<"form">["onSubmit"]>
>[0];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function NewEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [eventDate, setEventDate] = useState<Date | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [slug, setSlug] = useState("");
  const [venueId, setVenueId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleTitleChange(v: string) {
    setTitle(v);
    setSlug(slugify(v));
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || undefined,
        company,
        jobTitle,
        eventDate: eventDate ? format(eventDate, "yyyy-MM-dd") : undefined,
        timezone,
        slug: slug || undefined,
        venueId: venueId || undefined,
      }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (res.ok) {
      router.push(`/events/${data.event.id}/timeline`);
    } else {
      setError(data.error ?? "Failed to create event.");
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">New event</h1>
        <p className="text-sm text-muted-foreground">
          Start planning — you can always update the details later.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label
              htmlFor="event-title"
              className="text-xs font-medium text-muted-foreground"
            >
              Event title <span className="text-destructive">*</span>
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
            id="event-title"
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            required
            maxLength={100}
            placeholder="Smith–Johnson Wedding"
            className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label
              htmlFor="event-description"
              className="text-xs font-medium text-muted-foreground"
            >
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
            id="event-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Optional overview for your team."
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="event-date"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Event date <span className="text-destructive">*</span>
            </label>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <button
                  id="event-date"
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring/50",
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
            <label
              htmlFor="event-timezone"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Timezone
            </label>
            <TimezoneSelect
              id="event-timezone"
              value={timezone}
              onChange={setTimezone}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="owner-company"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Your company <span className="text-destructive">*</span>
            </label>
            <input
              id="owner-company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required
              maxLength={128}
              placeholder="Evergreen Events"
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50"
            />
          </div>

          <div>
            <label
              htmlFor="owner-role"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Your role <span className="text-destructive">*</span>
            </label>
            <input
              id="owner-role"
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              required
              maxLength={128}
              placeholder="Lead Planner"
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50"
            />
          </div>
        </div>

        {/* Event location */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Event location
          </label>
          <VenueSelector venueId={venueId} onChange={setVenueId} />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={
              submitting ||
              !title.trim() ||
              !eventDate ||
              !company.trim() ||
              !jobTitle.trim()
            }
          >
            {submitting ? "Creating…" : "Create event"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/dashboard")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
