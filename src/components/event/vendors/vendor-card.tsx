"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { EditVendorDialog } from "./edit-vendor-dialog";
import type { SerializedVendor } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  eventId: string;
  vendor: SerializedVendor;
  userRole: "admin" | "vendor";
  eventStatus?: string;
  onUpdated: (v: SerializedVendor) => void;
  onRemoved: (id: string) => void;
}

function getVendorStatus(vendor: SerializedVendor): {
  label: string;
  className: string;
  showPendingHint: boolean;
} {
  if (vendor.isEventOwner) {
    return {
      label: "Event owner",
      className: "bg-accent text-accent-foreground",
      showPendingHint: false,
    };
  }

  if (vendor.status === "ACCEPTED") {
    return {
      label: "Accepted",
      className: "bg-success/10 text-success",
      showPendingHint: false,
    };
  }

  if (vendor.status === "DECLINED") {
    return {
      label: "Declined",
      className: "bg-destructive/10 text-destructive",
      showPendingHint: false,
    };
  }

  if (vendor.inviteSentAt) {
    return {
      label: "Invited",
      className: "bg-primary/10 text-primary",
      showPendingHint: false,
    };
  }

  return {
    label: "Pending",
    className: "bg-warning/10 text-warning",
    showPendingHint: true,
  };
}

function getInviteButtonLabel(
  vendor: SerializedVendor,
  resending: boolean,
): string {
  if (resending) return "Sending…";
  if (vendor.status === "ACCEPTED") return "Send event link";
  if (vendor.inviteSentAt) return "Resend invite";
  return "Send invite";
}

export function VendorCard({
  eventId,
  vendor,
  userRole,
  eventStatus,
  onUpdated,
  onRemoved,
}: Readonly<Props>) {
  const [showEdit, setShowEdit] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  const displayName =
    [vendor.firstName, vendor.lastName].filter(Boolean).join(" ") ||
    vendor.email;
  const status = getVendorStatus(vendor);
  const resendLabel = getInviteButtonLabel(vendor, resending);
  const isCoordinator = vendor.isEventOwner || vendor.role === "COORDINATOR";

  async function handleRemove() {
    if (!confirm(`Remove ${displayName} from this event?`)) return;
    const res = await fetch(`/api/events/${eventId}/vendors/${vendor.id}`, {
      method: "DELETE",
    });
    if (res.ok) onRemoved(vendor.id);
  }

  async function handleResend() {
    setResending(true);
    setResendMsg("");
    const res = await fetch(
      `/api/events/${eventId}/vendors/${vendor.id}/resend`,
      { method: "POST" },
    );
    setResending(false);
    setResendMsg(res.ok ? "Sent!" : "Failed to send.");
    setTimeout(() => setResendMsg(""), 3000);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{displayName}</p>
          <p className="text-sm text-muted-foreground">{vendor.email}</p>
          {(vendor.company || vendor.jobTitle) && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[vendor.jobTitle, vendor.company].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isCoordinator && (
            <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
              Coordinator
            </span>
          )}
          {status.showPendingHint ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "inline-flex cursor-default items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    status.className,
                  )}
                >
                  {status.label}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                Invite will be sent automatically when the event is scheduled.
              </TooltipContent>
            </Tooltip>
          ) : (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                status.className,
              )}
            >
              {status.label}
            </span>
          )}
        </div>
      </div>

      {userRole === "admin" && !vendor.isEventOwner && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button size="xs" variant="outline" onClick={() => setShowEdit(true)}>
            Edit
          </Button>
          {eventStatus !== "DRAFT" && (
            <Button
              size="xs"
              variant="outline"
              onClick={handleResend}
              disabled={resending}
            >
              {resendLabel}
            </Button>
          )}
          {resendMsg && (
            <span className="text-xs text-muted-foreground">{resendMsg}</span>
          )}
          <Button
            size="xs"
            variant="destructive"
            className="ml-auto"
            onClick={handleRemove}
          >
            Remove
          </Button>
        </div>
      )}

      {showEdit && (
        <EditVendorDialog
          eventId={eventId}
          vendor={vendor}
          onClose={() => setShowEdit(false)}
          onUpdated={(updated) => {
            onUpdated(updated);
            setShowEdit(false);
          }}
        />
      )}
    </div>
  );
}
