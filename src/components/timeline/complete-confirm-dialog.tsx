"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CompleteConfirmDialogProps {
  open: boolean;
  taskTitle: string;
  onConfirm: (actualEnd: string) => void;
  onCancel: () => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,10,…,55

export function CompleteConfirmDialog({
  open,
  taskTitle,
  onConfirm,
  onCancel,
}: CompleteConfirmDialogProps) {
  const now = new Date();
  const currentHour12 = now.getHours() % 12 || 12;
  const currentMinute = Math.floor(now.getMinutes() / 5) * 5;
  const currentPeriod: "AM" | "PM" = now.getHours() < 12 ? "AM" : "PM";

  const [showCustomTime, setShowCustomTime] = useState(false);
  const [hour, setHour] = useState(currentHour12);
  const [minute, setMinute] = useState(currentMinute);
  const [period, setPeriod] = useState<"AM" | "PM">(currentPeriod);

  function buildISO(): string {
    let h24 = hour;
    if (period === "PM" && hour !== 12) h24 += 12;
    if (period === "AM" && hour === 12) h24 = 0;
    const d = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      h24,
      minute,
    );
    return d.toISOString();
  }

  function handleCompleteNow() {
    onConfirm(new Date().toISOString());
  }

  function handleCompleteEarlier() {
    setShowCustomTime(true);
  }

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    onConfirm(buildISO());
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setShowCustomTime(false);
      onCancel();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Complete: {taskTitle}</DialogTitle>
          <DialogDescription>
            This task was delayed. When was it actually completed?
          </DialogDescription>
        </DialogHeader>

        {!showCustomTime ? (
          <div className="flex flex-col gap-3">
            <Button onClick={handleCompleteNow} className="gap-2" size="sm">
              <Clock className="size-4" />
              Completed now
            </Button>
            <Button
              variant="outline"
              onClick={handleCompleteEarlier}
              className="gap-2"
              size="sm"
            >
              <Clock className="size-4" />
              Completed earlier…
            </Button>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        ) : (
          <form onSubmit={handleCustomSubmit} className="flex flex-col gap-4">
            {/* Hour / Minute / Period selectors */}
            <div className="flex items-center gap-2">
              {/* Hour */}
              <select
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
                className="flex-1 h-11 rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>

              <span className="text-muted-foreground">:</span>

              {/* Minute */}
              <select
                value={minute}
                onChange={(e) => setMinute(Number(e.target.value))}
                className="flex-1 h-11 rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, "0")}
                  </option>
                ))}
              </select>

              {/* AM/PM */}
              <div className="flex rounded-md border border-border">
                <button
                  type="button"
                  onClick={() => setPeriod("AM")}
                  className={`px-3 py-2 text-sm font-medium rounded-l-md min-h-[44px] ${
                    period === "AM"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod("PM")}
                  className={`px-3 py-2 text-sm font-medium rounded-r-md min-h-[44px] ${
                    period === "PM"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  PM
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCustomTime(false)}
              >
                Back
              </Button>
              <Button type="submit" size="sm">
                Confirm
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
