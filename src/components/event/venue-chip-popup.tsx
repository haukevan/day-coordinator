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
import { cn } from "@/lib/utils";

interface Props {
  readonly name: string;
  readonly address: string;
  readonly description: string | null;
  readonly ownerName: string | null;
  readonly ownerPhone: string | null;
  readonly ownerEmail: string | null;
}

function mapsUrl(address: string): string {
  // Strip verbose Nominatim display_name down to a clean address for Google Maps.
  // display_name parts: [street, neighborhood?, city, district?, state, postcode, country]
  // Keep at most 5 parts: street, city, state, postcode, country.
  const parts = address.split(",").map((s) => s.trim());
  const clean =
    parts.length > 5
      ? [
          parts[0],
          parts[parts.length - 4],
          parts[parts.length - 3],
          parts[parts.length - 2],
          parts[parts.length - 1],
        ]
          .filter(Boolean)
          .join(", ")
      : address;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(clean)}`;
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
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API not available — silently ignore
    }
  }, [address]);

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
              href={mapsUrl(address)}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex min-w-0 flex-1 items-start gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span className="group-hover:underline">{address}</span>
            </a>
            <button
              type="button"
              onClick={handleCopy}
              className={cn(
                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-hover hover:text-foreground transition-colors",
                copied && "text-success",
              )}
              style={{ minHeight: "24px", minWidth: "24px" }}
              aria-label={copied ? "Address copied" : "Copy address"}
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
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
