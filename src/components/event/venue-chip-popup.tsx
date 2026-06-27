"use client";

import { useState, useCallback } from "react";
import {
  MapPin,
  Phone,
  Mail,
  Copy,
  Check,
  ChevronDown,
  User,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface Props {
  readonly name: string;
  readonly address: string;
  readonly description: string | null;
  readonly ownerName: string | null;
  readonly ownerPhone: string | null;
  readonly ownerEmail: string | null;
}

function mapsUrl(name: string, address: string): string {
  // Build a destination query that includes both the venue name and a
  // cleaned address so Google Maps can disambiguate rural/highway locations.
  const parts = address.split(",").map((s) => s.trim());
  const cleanAddress =
    parts.length > 5
      ? [parts[0], parts.at(-4), parts.at(-3), parts.at(-2), parts.at(-1)]
          .filter(Boolean)
          .join(", ")
      : address;
  const destination = `${name}, ${cleanAddress}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export function VenueChipPopup({
  name,
  address,
  description,
  ownerName,
  ownerPhone,
  ownerEmail,
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      // Copy the full location: venue name + address so it's pasteable as a
      // complete reference (e.g. into a text message or calendar invite).
      await navigator.clipboard.writeText(`${name}\n${address}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API not available — silently ignore
    }
  }, [name, address]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 truncate rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground max-w-[120px] sm:max-w-[180px] hover:bg-hover hover:text-foreground active:bg-active active:scale-[0.97] transition-all focus:outline-none focus:ring-1 focus:ring-ring/50"
          style={{ minHeight: "28px" }}
        >
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">{name}</span>
          <ChevronDown className="size-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-72 p-4">
        <div className="space-y-3">
          {/* Venue name */}
          <div>
            <h4 className="text-sm font-semibold text-foreground">{name}</h4>
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>

          {/* Address with directions link + copy button */}
          <div className="flex items-start gap-2">
            <a
              href={mapsUrl(name, address)}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex min-w-0 flex-1 items-start gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span className="group-hover:underline">
                <span className="font-medium text-foreground">{name}</span>
                <br />
                {address}
              </span>
            </a>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleCopy}
              aria-label={copied ? "Address copied" : "Copy address"}
            >
              {copied ? <Check className="text-success" /> : <Copy />}
            </Button>
          </div>

          {/* Contact info */}
          {(ownerName || ownerPhone || ownerEmail) && (
            <div className="space-y-1.5 border-t border-border pt-3">
              {ownerName && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="size-3.5 shrink-0" />
                  <span>{ownerName}</span>
                </div>
              )}
              {ownerPhone && (
                <a
                  href={`tel:${ownerPhone.replace(/\D/g, "")}`}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Phone className="size-3.5 shrink-0" />
                  <span>{ownerPhone}</span>
                </a>
              )}
              {ownerEmail && (
                <a
                  href={`mailto:${ownerEmail}`}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Mail className="size-3.5 shrink-0" />
                  <span>{ownerEmail}</span>
                </a>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
