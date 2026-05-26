"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

function buildGroups(): [string, string[]][] {
  let tzList: string[];
  try {
    tzList = Intl.supportedValuesOf("timeZone");
  } catch {
    tzList = [
      "UTC",
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "America/Anchorage",
      "Pacific/Honolulu",
      "Europe/London",
      "Europe/Paris",
      "Europe/Berlin",
      "Asia/Tokyo",
      "Asia/Shanghai",
      "Australia/Sydney",
    ];
  }
  const groups: Record<string, string[]> = {};
  for (const tz of tzList) {
    const region = tz.includes("/") ? tz.split("/")[0] : "Other";
    if (!groups[region]) groups[region] = [];
    groups[region].push(tz);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

export function TimezoneSelect({
  value,
  onChange,
  disabled,
  className,
}: Props) {
  const [groups, setGroups] = useState<[string, string[]][] | null>(null);

  useEffect(() => {
    setGroups(buildGroups());
  }, []);

  const selectClass = cn(
    "w-full appearance-none rounded-md border border-input bg-background py-2 pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
    className,
  );

  // Before client mount: render only the current value to match SSR output exactly
  if (!groups) {
    return (
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={selectClass}
        >
          <option value={value}>{value.replace(/_/g, " ")}</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 opacity-50" />
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={selectClass}
      >
        {groups.map(([region, tzs]) => (
          <optgroup key={region} label={region}>
            {tzs.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 opacity-50" />
    </div>
  );
}
