"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { queryKeys } from "@/lib/query/keys";
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
  currentUserId?: string;
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
  currentUserId,
}: Readonly<Props>) {
  const [showEdit, setShowEdit] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const displayName =
    [vendor.firstName, vendor.lastName].filter(Boolean).join(" ") ||
    vendor.email;
  const status = getVendorStatus(vendor);
  const resendLabel = getInviteButtonLabel(vendor, resending);
  const isCoordinator = vendor.isEventOwner || vendor.role === "COORDINATOR";
  const isSelf = currentUserId != null && vendor.userId === currentUserId;

  async function handleRemove() {
    if (!confirmingRemove) {
      setConfirmingRemove(true);
      setRemoveError("");
      return;
    }

    setRemoving(true);
    setRemoveError("");

    try {
      const res = await fetch(`/api/events/${eventId}/vendors/${vendor.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        addToast({
          title: "Vendor removed",
          body: `${displayName} was removed from this event.`,
          variant: "success",
        });
        onRemoved(vendor.id);
        void queryClient.invalidateQueries({ queryKey: queryKeys.vendors });
        return;
      }

      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      const message = data?.error ?? "Failed to remove vendor.";
      setRemoveError(message);
      setConfirmingRemove(false);
      addToast({
        title: "Could not remove vendor",
        body: message,
        variant: "destructive",
      });
    } catch {
      const message = "Network error. Please try again.";
      setRemoveError(message);
      setConfirmingRemove(false);
      addToast({
        title: "Could not remove vendor",
        body: message,
        variant: "destructive",
      });
    } finally {
      setRemoving(false);
    }
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

      {/* Self-edit: always available when viewing your own card (vendor or coordinator) */}
      {isSelf && !vendor.isEventOwner && (
        <div className="mt-3 border-t border-border pt-3">
          <Button size="sm" variant="outline" onClick={() => setShowEdit(true)}>
            Edit my info
          </Button>
        </div>
      )}

      {/* Admin actions: edit, resend, remove — only for other vendors, not self */}
      {userRole === "admin" && !vendor.isEventOwner && !isSelf && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setConfirmingRemove(false);
              setShowEdit(true);
            }}
          >
            Edit
          </Button>
          {eventStatus !== "DRAFT" && (
            <Button
              size="sm"
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
          <div className="ml-auto flex items-center gap-2">
            {confirmingRemove && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmingRemove(false)}
                disabled={removing}
              >
                Cancel
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={handleRemove}
              disabled={removing}
              aria-label={
                confirmingRemove
                  ? `Confirm removing ${displayName}`
                  : `Remove ${displayName}`
              }
            >
              {removing && <Loader2 className="size-4 animate-spin" />}
              {confirmingRemove ? "Confirm remove" : "Remove"}
            </Button>
          </div>
          {removeError && (
            <p className="w-full text-xs text-destructive">{removeError}</p>
          )}
        </div>
      )}

      {showEdit && (
        <EditVendorDialog
          key={vendor.updatedAt}
          eventId={eventId}
          vendor={vendor}
          isSelf={isSelf}
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
