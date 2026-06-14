"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SerializedVendor, SerializedVendorContact } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Check, Search, Shield } from "lucide-react";

interface Props {
  eventId: string;
  existingVendorEmails: Set<string>;
  onClose: () => void;
  onAdded: (vendors: SerializedVendor[]) => void;
}

export function AddExistingVendorDialog({
  eventId,
  existingVendorEmails,
  onClose,
  onAdded,
}: Props) {
  const [contacts, setContacts] = useState<SerializedVendorContact[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set()); // Set of contact ids
  const [coordinatorIds, setCoordinatorIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/user/vendor-contacts")
      .then((r) => r.json())
      .then((data) => setContacts(data.contacts ?? []))
      .catch(() => setContacts([]))
      .finally(() => setFetching(false));
  }, []);

  const filtered = query
    ? contacts.filter((c) => {
        const name = `${c.firstName ?? ""} ${c.lastName ?? ""}`.toLowerCase();
        return (
          c.email.toLowerCase().includes(query.toLowerCase()) ||
          name.includes(query.toLowerCase()) ||
          (c.company ?? "").toLowerCase().includes(query.toLowerCase())
        );
      })
    : contacts;

  function toggleContact(id: string, email: string) {
    if (existingVendorEmails.has(email.toLowerCase())) return; // already added
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Also remove from coordinators when deselecting
        setCoordinatorIds((c) => {
          const updated = new Set(c);
          updated.delete(id);
          return updated;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleCoordinator(id: string) {
    setCoordinatorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    if (selected.size === 0) return;
    setError("");
    setLoading(true);

    const toAdd = contacts.filter((c) => selected.has(c.id));
    const results: SerializedVendor[] = [];
    const errors: string[] = [];

    for (const contact of toAdd) {
      const res = await fetch(`/api/events/${eventId}/vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: contact.email,
          firstName: contact.firstName ?? null,
          lastName: contact.lastName ?? null,
          phone: contact.phone ?? null,
          company: contact.company ?? null,
          jobTitle: contact.jobTitle ?? null,
          role: coordinatorIds.has(contact.id) ? "COORDINATOR" : "VENDOR",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        results.push(data.vendor);
      } else {
        errors.push(`${contact.email}: ${data.error ?? "Failed"}`);
      }
    }

    setLoading(false);

    if (results.length > 0) {
      onAdded(results);
    }
    if (errors.length > 0) {
      setError(errors.join("\n"));
    }
    if (errors.length === 0) {
      onClose();
    }
  }

  const selectedCount = selected.size;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[80vh] max-w-md flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add existing contacts</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative mt-1">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or company…"
            className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Contact list */}
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border">
          {fetching ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Loading contacts…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              {contacts.length === 0
                ? "No contacts in your address book yet."
                : "No contacts match your search."}
            </div>
          ) : (
            <ul>
              {filtered.map((contact, i) => {
                const isAdded = existingVendorEmails.has(
                  contact.email.toLowerCase(),
                );
                const isSelected = selected.has(contact.id);
                const displayName =
                  [contact.firstName, contact.lastName]
                    .filter(Boolean)
                    .join(" ") || contact.email;
                const subtitle = [contact.jobTitle, contact.company]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <li key={contact.id}>
                    <div
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                        i > 0 && "border-t border-border",
                        isAdded
                          ? "cursor-default opacity-50"
                          : isSelected
                            ? "bg-primary/5"
                            : "hover:bg-muted",
                      )}
                    >
                      <button
                        type="button"
                        disabled={isAdded}
                        onClick={() => toggleContact(contact.id, contact.email)}
                        className="flex flex-1 items-center gap-3 min-w-0"
                      >
                        {/* Checkbox */}
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded border",
                            isAdded
                              ? "border-border bg-muted"
                              : isSelected
                                ? "border-primary bg-primary"
                                : "border-border bg-background",
                          )}
                        >
                          {isAdded && (
                            <Check
                              className="size-2.5 text-muted-foreground"
                              strokeWidth={3}
                            />
                          )}
                          {isSelected && (
                            <Check
                              className="size-2.5 text-primary-foreground"
                              strokeWidth={3}
                            />
                          )}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {displayName}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {contact.email}
                            {subtitle && ` · ${subtitle}`}
                          </span>
                        </span>

                        {isAdded && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            Already added
                          </span>
                        )}
                      </button>

                      {/* Coordinator checkbox — appears when selected */}
                      {isSelected && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCoordinator(contact.id);
                          }}
                          className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <span
                            className={cn(
                              "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                              coordinatorIds.has(contact.id)
                                ? "border-primary bg-primary"
                                : "border-border bg-background",
                            )}
                          >
                            {coordinatorIds.has(contact.id) && (
                              <Check
                                className="size-2.5 text-primary-foreground"
                                strokeWidth={3}
                              />
                            )}
                          </span>
                          Coordinator
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive whitespace-pre-line">
            {error}
          </p>
        )}

        {/* Coordinator warning — shown when any contact is marked as coordinator */}
        {coordinatorIds.size > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2">
            <Shield className="mt-0.5 size-3.5 shrink-0 text-warning" />
            <p className="text-xs text-foreground">
              Coordinators can add, edit, and delete tasks and vendors for this
              event. They cannot access event settings.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-muted-foreground">
            {selectedCount > 0
              ? `${selectedCount} selected`
              : "Select contacts to add"}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || selectedCount === 0}
            >
              {loading
                ? "Adding…"
                : `Add ${selectedCount > 0 ? selectedCount : ""} vendor${selectedCount !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
