"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SerializedVendor } from "@/lib/types";

function formatPhone(digits: string): string {
  const d = digits.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

interface Props {
  eventId: string;
  vendor: SerializedVendor;
  onClose: () => void;
  onUpdated: (v: SerializedVendor) => void;
}

export function EditVendorDialog({
  eventId,
  vendor,
  onClose,
  onUpdated,
}: Props) {
  const [firstName, setFirstName] = useState(vendor.firstName ?? "");
  const [lastName, setLastName] = useState(vendor.lastName ?? "");
  const existingDigits = vendor.phone?.startsWith("+1")
    ? vendor.phone.slice(2)
    : "";
  const [phoneDigits, setPhoneDigits] = useState(existingDigits);
  const [company, setCompany] = useState(vendor.company ?? "");
  const [jobTitle, setJobTitle] = useState(vendor.jobTitle ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch(`/api/events/${eventId}/vendors/${vendor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: firstName.trim() || null,
        lastName: lastName.trim() || null,
        phone: phoneDigits.length === 10 ? `+1${phoneDigits}` : null,
        company: company.trim() || null,
        jobTitle: jobTitle.trim() || null,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      onUpdated(data.vendor);
    } else {
      setError(data.error ?? "Failed to update vendor.");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Edit vendor</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                First name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClass}
                placeholder="Jane"
                maxLength={64}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                Last name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputClass}
                placeholder="Doe"
                maxLength={64}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Phone
            </label>
            <div className="flex items-center gap-2">
              <span className="flex h-[38px] items-center rounded-lg border border-border bg-muted px-3 text-sm text-muted-foreground select-none">
                +1
              </span>
              <input
                type="tel"
                inputMode="numeric"
                value={formatPhone(phoneDigits)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setPhoneDigits(digits);
                  setPhoneError(
                    digits.length > 0 && digits.length < 10
                      ? "Please enter a valid 10-digit phone number."
                      : "",
                  );
                }}
                className={inputClass}
                placeholder="(555) 123-4567"
                maxLength={14}
              />
            </div>
            {phoneError && (
              <p className="mt-1 text-xs text-destructive">{phoneError}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Company
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className={inputClass}
              placeholder="Blooms & Co."
              maxLength={128}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Job title
            </label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className={inputClass}
              placeholder="Lead Florist"
              maxLength={128}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !!phoneError}>
              {loading ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
