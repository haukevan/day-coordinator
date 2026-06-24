"use client";

import { useState, useEffect } from "react";
import { Clock, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESETS = [5, 10, 15, 30, 45, 60];

interface DelayDialogProps {
  open: boolean;
  taskTitle: string;
  scheduledEnd: string | null;
  /** If already delayed, the current delay amount for adjust mode */
  currentDelayMinutes?: number;
  onConfirm: (delayMinutes: number) => void;
  /** If already delayed, allows removing the delay entirely */
  onRemove?: () => void;
  onCancel: () => void;
}

export function DelayDialog({
  open,
  taskTitle,
  scheduledEnd,
  currentDelayMinutes,
  onConfirm,
  onRemove,
  onCancel,
}: DelayDialogProps) {
  const [customValue, setCustomValue] = useState("");

  const isAdjusting = currentDelayMinutes !== undefined;

  // Pre-fill with current delay when adjusting
  useEffect(() => {
    if (open && isAdjusting) {
      setCustomValue(String(currentDelayMinutes));
    }
  }, [open, isAdjusting, currentDelayMinutes]);

  function handleConfirm() {
    const minutes = parseInt(customValue, 10);
    if (minutes && minutes > 0) {
      onConfirm(minutes);
      setCustomValue("");
      onCancel();
    }
  }

  function handlePresetClick(minutes: number) {
    onConfirm(minutes);
    setCustomValue("");
    onCancel();
  }

  function handleCustomChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCustomValue(e.target.value);
  }

  const readyToConfirm = customValue !== "" && parseInt(customValue, 10) > 0;

  function handleOpenChange(open: boolean) {
    if (!open) {
      setCustomValue("");
      onCancel();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isAdjusting ? "Adjust delay" : "Delay"}: {taskTitle}
          </DialogTitle>
          <DialogDescription>
            {isAdjusting
              ? `Currently delayed by ${currentDelayMinutes} min. Adjust or remove below.`
              : "How long should this task be delayed? Blocking tasks will be pushed by the same amount."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Scheduled end info */}
          {scheduledEnd && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-4" />
              <span>
                Scheduled end:{" "}
                {new Date(scheduledEnd).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              {isAdjusting && (
                <span className="text-warning">
                  (+{currentDelayMinutes}m delay)
                </span>
              )}
            </div>
          )}

          {/* Presets */}
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((mins) => (
              <Button
                key={mins}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePresetClick(mins)}
                className="min-h-[44px]"
              >
                {mins} min
              </Button>
            ))}
          </div>

          {/* Custom */}
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="delay-custom"
              className="text-xs text-muted-foreground"
            >
              Custom delay (minutes)
            </Label>
            <Input
              id="delay-custom"
              type="number"
              min={1}
              max={1440}
              placeholder="e.g. 20"
              value={customValue}
              onChange={handleCustomChange}
              className="min-h-[44px]"
            />
          </div>

          <div className="flex justify-between gap-2 pt-2">
            {/* Remove delay button (only when adjusting) */}
            {isAdjusting && onRemove && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onRemove()}
                className="gap-1.5"
              >
                <Trash2 className="size-4" />
                Remove delay
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={!readyToConfirm}
              >
                {isAdjusting ? "Update" : "Apply delay"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
