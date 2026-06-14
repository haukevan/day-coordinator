"use client";

import { useState, useCallback } from "react";
import {
  Check,
  Circle,
  CircleCheck,
  CircleDot,
  GripVertical,
  Loader2,
  Trash2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type {
  SerializedSubTask,
  SerializedVendor,
  SubTaskVendorRef,
} from "@/lib/types";

type SubTaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

const STATUS_CONFIG: Record<
  string,
  { icon: typeof Circle; label: string; className: string }
> = {
  NOT_STARTED: {
    icon: Circle,
    label: "Not started",
    className: "text-muted-foreground/30 hover:text-foreground/50",
  },
  IN_PROGRESS: {
    icon: CircleDot,
    label: "In Progress",
    className: "text-warning",
  },
  COMPLETED: {
    icon: CircleCheck,
    label: "Complete",
    className: "text-success",
  },
};

const STATUS_CYCLE: SubTaskStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
];

// ── Vendor chip (shows initials, tappable for full name on mobile) ───────────

function VendorChips({
  subTaskVendors,
  parentTaskVendors,
}: {
  subTaskVendors: SubTaskVendorRef[];
  parentTaskVendors: SerializedVendor[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-1 shrink-0">
      {subTaskVendors.slice(0, 3).map((sv) => {
        const vendor = parentTaskVendors.find((v) => v.id === sv.eventVendorId);
        const fullName = vendor
          ? [vendor.firstName, vendor.lastName].filter(Boolean).join(" ") ||
            vendor.email
          : "Unknown";
        const initials =
          vendor?.firstName?.[0] ||
          vendor?.lastName?.[0] ||
          vendor?.email?.[0]?.toUpperCase() ||
          "?";
        const isExpanded = expandedId === sv.eventVendorId;

        return (
          <button
            key={sv.eventVendorId}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedId(isExpanded ? null : sv.eventVendorId);
            }}
            onBlur={() => setExpandedId(null)}
            className={cn(
              "inline-flex items-center rounded-full bg-primary/10 text-[10px] font-medium text-primary transition-all focus:outline-none focus:ring-2 focus:ring-ring",
              isExpanded
                ? "px-2 py-0.5 max-w-[120px]"
                : "size-5 justify-center",
            )}
            title={fullName}
            aria-label={fullName}
          >
            {isExpanded ? (
              <span className="truncate text-[10px]">{fullName}</span>
            ) : (
              initials
            )}
          </button>
        );
      })}
      {subTaskVendors.length > 3 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="text-[10px] font-medium text-muted-foreground hover:text-foreground rounded-full px-1.5 py-0.5 hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label={`Show all ${subTaskVendors.length} assigned vendors`}
            >
              +{subTaskVendors.length - 3}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-1.5" align="end" sideOffset={4}>
            <p className="px-1.5 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              All vendors
            </p>
            <div className="flex flex-col gap-0.5">
              {subTaskVendors.map((sv) => {
                const vendor = parentTaskVendors.find(
                  (v) => v.id === sv.eventVendorId,
                );
                const fullName = vendor
                  ? [vendor.firstName, vendor.lastName]
                      .filter(Boolean)
                      .join(" ") || vendor.email
                  : "Unknown";
                return (
                  <div
                    key={sv.eventVendorId}
                    className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs"
                  >
                    <span className="inline-flex items-center justify-center size-5 rounded-full bg-primary/10 text-[10px] font-medium text-primary shrink-0">
                      {vendor?.firstName?.[0] ||
                        vendor?.lastName?.[0] ||
                        vendor?.email?.[0]?.toUpperCase() ||
                        "?"}
                    </span>
                    <span className="truncate text-foreground">{fullName}</span>
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

interface SubtaskItemProps {
  subTask: SerializedSubTask;
  userRole: "admin" | "vendor";
  parentTaskVendors: SerializedVendor[];
  /** All event vendors for the admin vendor picker (constrained subset shown in UI) */
  allEventVendors: SerializedVendor[];
  /** Whether the current user can toggle this subtask's status (vendor must be assigned) */
  canToggleStatus?: boolean;
  onStatusChange: (
    subTaskId: string,
    status: SubTaskStatus,
  ) => Promise<SerializedSubTask | null>;
  onTitleChange: (
    subTaskId: string,
    title: string,
  ) => Promise<SerializedSubTask | null>;
  onVendorsChange: (
    subTaskId: string,
    vendorIds: string[],
  ) => Promise<SerializedSubTask | null>;
  onDelete: (subTaskId: string) => Promise<boolean>;
  // Drag-and-drop props (admin only)
  isDragging?: boolean;
  dropIndicator?: "above" | "below" | null;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  itemId?: string;
}

export function SubtaskItem({
  subTask,
  userRole,
  parentTaskVendors,
  allEventVendors,
  canToggleStatus = true,
  onStatusChange,
  onTitleChange,
  onVendorsChange,
  onDelete,
  isDragging,
  dropIndicator,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onTouchStart,
  itemId,
}: SubtaskItemProps) {
  const status = subTask.status as SubTaskStatus;
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.NOT_STARTED;
  const Icon = config.icon;

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(subTask.title);

  // Track pending async operations to disable button during API call
  const [pending, setPending] = useState(false);

  // ── Status toggle ───────────────────────────────────────────────────────

  const handleStatusToggle = useCallback(async () => {
    if (pending) return;
    setPending(true);
    const idx = STATUS_CYCLE.indexOf(status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    // Optimistic update handled by parent via callback — UI updates instantly
    await onStatusChange(subTask.id, next);
    setPending(false);
  }, [subTask.id, status, pending, onStatusChange]);

  // ── Title edit (admin only) ─────────────────────────────────────────────

  const handleTitleBlur = useCallback(async () => {
    setEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== subTask.title) {
      await onTitleChange(subTask.id, trimmed);
    } else {
      setTitleDraft(subTask.title);
    }
  }, [titleDraft, subTask.id, subTask.title, onTitleChange]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "Escape") {
        setTitleDraft(subTask.title);
        setEditingTitle(false);
      }
    },
    [subTask.title],
  );

  // ── Vendor management (admin only) ──────────────────────────────────────

  const assignedVendorIds = new Set(
    subTask.subTaskVendors?.map((sv) => sv.eventVendorId) ?? [],
  );

  const handleToggleVendor = useCallback(
    async (eventVendorId: string) => {
      const next = assignedVendorIds.has(eventVendorId)
        ? [...assignedVendorIds].filter((id) => id !== eventVendorId)
        : [...assignedVendorIds, eventVendorId];
      await onVendorsChange(subTask.id, next);
    },
    [subTask.id, assignedVendorIds, onVendorsChange],
  );

  // ── Delete (admin only) ─────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    await onDelete(subTask.id);
  }, [subTask.id, onDelete]);

  // ── Last-changed-by display ─────────────────────────────────────────────

  const changedByUser =
    (status === "COMPLETED" || status === "IN_PROGRESS") && subTask.completedBy
      ? subTask.completedBy
      : null;
  const changedByName =
    status === "COMPLETED" || status === "IN_PROGRESS"
      ? subTask.completedByName || null
      : null;
  const changedByLabel =
    status === "COMPLETED" ? "Completed by" : "In progress by";

  // ── Status hover/tap info ───────────────────────────────────────────────

  const [showStatusInfo, setShowStatusInfo] = useState(false);
  const changedByNameDisplay =
    status === "COMPLETED" || status === "IN_PROGRESS"
      ? subTask.completedByName || subTask.completedBy?.email || null
      : null;

  return (
    <div
      data-item-id={itemId}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "flex flex-col rounded-lg px-3 py-2 min-h-[44px] transition-colors relative border-b border-border last:border-b-0",
        status === "COMPLETED" && "opacity-60",
        isDragging && "opacity-30 bg-muted",
        dropIndicator === "above" &&
          "before:absolute before:top-0 before:left-2 before:right-2 before:h-0.5 before:rounded-full before:bg-primary",
        dropIndicator === "below" &&
          "after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-primary",
      )}
    >
      {/* ── Row 1: grip · circle · status text · vendor chips · actions ── */}
      <div className="flex items-center gap-2.5 min-h-[28px]">
        {/* Drag grip handle (admin only) */}
        {userRole === "admin" && (
          <div
            draggable
            onDragStart={onDragStart}
            onTouchStart={onTouchStart}
            className="shrink-0 cursor-grab active:cursor-grabbing touch-none text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            aria-label="Drag to reorder"
          >
            <GripVertical className="size-4" />
          </div>
        )}

        {/* Status circle — only the circle toggles; restricted to assigned vendors */}
        <button
          type="button"
          onClick={canToggleStatus ? handleStatusToggle : undefined}
          disabled={pending || !canToggleStatus}
          aria-label={
            canToggleStatus
              ? `Status: ${config.label}. Tap to change.`
              : `Status: ${config.label}. Only assigned vendors can change.`
          }
          title={
            !canToggleStatus && userRole === "vendor"
              ? "Only vendors assigned to this checklist item can update its status"
              : undefined
          }
          className={cn(
            "flex shrink-0 items-center justify-center size-5 rounded-full transition-colors",
            canToggleStatus
              ? "focus:outline-none focus:ring-2 focus:ring-ring"
              : "cursor-not-allowed opacity-40",
          )}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : (
            <Icon
              className={cn(
                "size-5 transition-colors",
                canToggleStatus ? config.className : "text-muted-foreground/30",
              )}
            />
          )}
        </button>

        {/* Status label */}
        {status === "NOT_STARTED" ? (
          <span className="text-[11px] font-medium whitespace-nowrap text-muted-foreground/50">
            Not started
          </span>
        ) : (
          <Popover open={showStatusInfo} onOpenChange={setShowStatusInfo}>
            <PopoverTrigger asChild>
              <span
                onMouseEnter={() => setShowStatusInfo(true)}
                onMouseLeave={() => setShowStatusInfo(false)}
                onClick={() => setShowStatusInfo(!showStatusInfo)}
                className={cn(
                  "text-[11px] font-medium whitespace-nowrap cursor-default select-none",
                  "hover:underline decoration-dotted underline-offset-2",
                  status === "IN_PROGRESS" && "text-warning",
                  status === "COMPLETED" && "text-success",
                )}
              >
                {status === "IN_PROGRESS" ? "In progress" : "Done"}
              </span>
            </PopoverTrigger>
            {changedByNameDisplay && (
              <PopoverContent
                className="w-auto px-2.5 py-1.5 text-xs"
                side="top"
                sideOffset={4}
              >
                <span className="text-muted-foreground">Updated by </span>
                <span className="font-medium text-foreground">
                  {changedByNameDisplay}
                </span>
              </PopoverContent>
            )}
          </Popover>
        )}

        {/* Spacer to push vendor chips and actions to the right */}
        <div className="flex-1" />

        {/* Vendor chips */}
        {subTask.subTaskVendors && subTask.subTaskVendors.length > 0 && (
          <VendorChips
            subTaskVendors={subTask.subTaskVendors}
            parentTaskVendors={parentTaskVendors}
          />
        )}

        {/* Admin actions */}
        {userRole === "admin" && (
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Vendor assign popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Assign vendors"
                >
                  <User className="size-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1.5" align="end" sideOffset={4}>
                <p className="px-1.5 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Assign to vendor
                </p>
                <div className="max-h-48 overflow-y-auto">
                  {parentTaskVendors.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-muted-foreground">
                      No vendors assigned to this task. Add vendors to the
                      parent task first.
                    </p>
                  ) : (
                    parentTaskVendors.map((vendor) => {
                      const isSelected = assignedVendorIds.has(vendor.id);
                      const displayName =
                        [vendor.firstName, vendor.lastName]
                          .filter(Boolean)
                          .join(" ") || vendor.email;
                      return (
                        <button
                          key={vendor.id}
                          type="button"
                          onClick={() => handleToggleVendor(vendor.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left transition-colors hover:bg-accent",
                            isSelected && "bg-primary/10",
                          )}
                        >
                          <span
                            className={cn(
                              "size-3.5 rounded border flex items-center justify-center shrink-0",
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border",
                            )}
                          >
                            {isSelected && <Check className="size-2.5" />}
                          </span>
                          <span className="truncate">{displayName}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Delete button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Delete checklist item"
              onClick={handleDelete}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* ── Row 2: Title (full width, wraps) ──────────────────────────── */}
      <div className="pl-[30px]">
        {userRole === "admin" && editingTitle ? (
          <input
            type="text"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            maxLength={200}
            autoFocus
            className="w-full bg-transparent text-sm text-foreground border-b border-primary pb-0.5 outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              if (userRole === "admin") {
                setTitleDraft(subTask.title);
                setEditingTitle(true);
              }
            }}
            className={cn(
              "text-sm text-left w-full whitespace-normal break-words",
              status === "COMPLETED" && "line-through text-muted-foreground",
              userRole === "admin" && "cursor-text hover:text-foreground",
            )}
          >
            {subTask.title}
          </button>
        )}
      </div>
    </div>
  );
}
