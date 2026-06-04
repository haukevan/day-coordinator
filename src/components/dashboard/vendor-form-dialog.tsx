"use client";

import { useState, useCallback, useEffect } from "react";
import { AlertTriangle, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  SerializedVendorContactWithEvents,
  LinkedEvent,
} from "@/lib/types";

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly vendor?: SerializedVendorContactWithEvents | null;
  readonly isSelf?: boolean;
  readonly onSaved: (vendor: SerializedVendorContactWithEvents) => void;
  readonly onDeleted?: (id: string) => void;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50";

function formatLinkedEvents(events: LinkedEvent[]): string {
  if (events.length === 0) return "";
  if (events.length === 1) return `"${events[0].title}"`;
  if (events.length === 2)
    return `"${events[0].title}" and "${events[1].title}"`;
  return `"${events[0].title}" and ${events.length - 1} other event${events.length - 1 > 1 ? "s" : ""}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VendorFormDialog({
  open,
  onOpenChange,
  vendor,
  isSelf = false,
  onSaved,
  onDeleted,
}: Props) {
  const isEdit = !!vendor;

  // ── Form state ────────────────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // ── Delete state ──────────────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // ── Populate form when editing ────────────────────────────────────────────
  useEffect(() => {
    if (open && vendor) {
      setEmail(vendor.email ?? "");
      setFirstName(vendor.firstName ?? "");
      setLastName(vendor.lastName ?? "");
      setPhone(vendor.phone ?? "");
      setCompany(vendor.company ?? "");
      setJobTitle(vendor.jobTitle ?? "");
    } else if (open && !vendor) {
      resetForm();
    }
  }, [open, vendor]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setEmail("");
    setFirstName("");
    setLastName("");
    setPhone("");
    setCompany("");
    setJobTitle("");
    setSaveError("");
    setDeleteError("");
    setConfirmDelete(false);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        resetForm();
        setConfirmDelete(false);
      }
      onOpenChange(next);
    },
    [onOpenChange, resetForm],
  );

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!email.trim() && !isEdit) return;
    setSaving(true);
    setSaveError("");

    const body: Record<string, unknown> = {
      email: email.trim().toLowerCase(),
    };
    if (firstName.trim()) body.firstName = firstName.trim();
    if (lastName.trim()) body.lastName = lastName.trim();
    if (phone.trim()) body.phone = phone.trim();
    if (company.trim()) body.company = company.trim();
    if (jobTitle.trim()) body.jobTitle = jobTitle.trim();

    try {
      const url = isEdit
        ? `/api/user/vendor-contacts/${vendor!.id}`
        : "/api/user/vendor-contacts";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        // Merge existing events data from the original vendor so the card
        // still shows linked events after edit
        const merged = {
          ...(data.contact ?? data),
          events: vendor?.events,
          _count: vendor?._count,
        };
        onSaved(merged);
        handleOpenChange(false);
      } else {
        setSaveError(data.error ?? "Failed to save vendor.");
      }
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [
    email,
    firstName,
    lastName,
    phone,
    company,
    jobTitle,
    isEdit,
    vendor,
    onSaved,
    handleOpenChange,
  ]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!vendor) return;

    // Two-step confirm
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    setDeleteError("");

    try {
      const res = await fetch(`/api/user/vendor-contacts/${vendor.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        onDeleted?.(vendor.id);
        handleOpenChange(false);
      } else {
        const data = await res.json();
        setDeleteError(data.error ?? "Failed to delete vendor.");
        setConfirmDelete(false);
      }
    } catch {
      setDeleteError("Network error. Please try again.");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }, [vendor, confirmDelete, onDeleted, handleOpenChange]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const linkedCount = isEdit ? (vendor?._count?.eventVendors ?? 0) : 0;
  const linkedEvents = isEdit ? (vendor?.events ?? []) : [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto overflow-x-hidden sm:max-w-md min-w-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-foreground">
            {isEdit ? "Edit vendor" : "New vendor"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isEdit
              ? "Update this vendor's contact details."
              : "Add a vendor to your contact book."}
          </DialogDescription>
        </DialogHeader>

        {/* Linked events warning (edit only) */}
        {isEdit && linkedCount > 0 && (
          <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 min-w-0">
            <AlertTriangle className="size-4 shrink-0 text-warning" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-warning break-words">
                This vendor is linked to {linkedCount} event
                {linkedCount === 1 ? "" : "s"}
              </p>
              <ul className="mt-1 list-none space-y-0.5">
                {linkedEvents.map((e) => (
                  <li
                    key={e.id}
                    className="text-xs text-muted-foreground truncate"
                  >
                    • {e.title}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Changes you make here will affect how this vendor appears in the
                above events.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Email */}
          <div>
            <label
              htmlFor="vf-vendor-email"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Email <span className="text-destructive">*</span>
            </label>
            <input
              id="vf-vendor-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
              placeholder="vendor@example.com"
              className={inputClass}
              disabled={isEdit}
            />
            {isEdit && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Email cannot be changed after creation.
              </p>
            )}
          </div>

          {/* Name row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="vf-vendor-first-name"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                First name
              </label>
              <input
                id="vf-vendor-first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={128}
                placeholder="e.g. Jane"
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="vf-vendor-last-name"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Last name
              </label>
              <input
                id="vf-vendor-last-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                maxLength={128}
                placeholder="e.g. Smith"
                className={inputClass}
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label
              htmlFor="vf-vendor-phone"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Phone
            </label>
            <input
              id="vf-vendor-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
              placeholder="(555) 123-4567"
              className={inputClass}
            />
          </div>

          {/* Company & job title */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="vf-vendor-company"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Company
              </label>
              <input
                id="vf-vendor-company"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                maxLength={128}
                placeholder="e.g. ABC Catering"
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="vf-vendor-job-title"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Job title
              </label>
              <input
                id="vf-vendor-job-title"
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                maxLength={128}
                placeholder="e.g. Head Chef"
                className={inputClass}
              />
            </div>
          </div>

          {saveError && <p className="text-xs text-destructive">{saveError}</p>}
        </div>

        {/* Linked events delete warning — above actions so visible without scrolling */}
        {isEdit && linkedCount > 0 && confirmDelete && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 min-w-0">
            <AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-destructive break-words">
                This vendor will be removed from {linkedCount} event
                {linkedCount === 1 ? "" : "s"}
              </p>
              <ul className="mt-1 list-none space-y-0.5">
                {linkedEvents.map((e) => (
                  <li
                    key={e.id}
                    className="text-xs text-muted-foreground truncate"
                  >
                    • {e.title}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          {/* Delete — bottom left (edit only; hidden for self) */}
          <div>
            {isEdit && isSelf && (
              <p className="text-[11px] text-muted-foreground">
                You cannot delete your own vendor profile.
              </p>
            )}
            {isEdit && !isSelf && onDeleted && (
              <Button
                type="button"
                variant={confirmDelete ? "destructive" : "ghost"}
                size={linkedCount > 0 && confirmDelete ? "sm" : "icon"}
                aria-label={
                  confirmDelete ? "Confirm delete vendor" : "Delete vendor"
                }
                title={
                  confirmDelete
                    ? "Tap again to confirm delete"
                    : "Delete vendor"
                }
                onClick={handleDelete}
                disabled={saving || deleting}
              >
                {linkedCount > 0 && confirmDelete ? (
                  "Delete vendor"
                ) : confirmDelete ? (
                  <Check className="size-4" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            )}
          </div>

          {/* Save / Cancel — bottom right */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={saving || deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={(!email.trim() && !isEdit) || saving || deleting}
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Save vendor"}
            </Button>
          </div>
        </div>

        {deleteError && (
          <p className="text-xs text-destructive">{deleteError}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
