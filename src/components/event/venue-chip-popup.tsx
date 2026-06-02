"use client";

import { MapPin, Phone, Mail, ExternalLink, User } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Props {
  readonly name: string;
  readonly address: string;
  readonly description: string | null;
  readonly ownerName: string | null;
  readonly ownerPhone: string | null;
  readonly ownerEmail: string | null;
}

function mapsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

export function VenueChipPopup({
  name,
  address,
  description,
  ownerName,
  ownerPhone,
  ownerEmail,
}: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 truncate rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground max-w-[180px] hover:bg-hover hover:text-foreground transition-colors"
        >
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">{name}</span>
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

          {/* Address with directions link */}
          <div>
            <a
              href={mapsUrl(address)}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-accent" />
              <span className="group-hover:underline">{address}</span>
              <ExternalLink className="mt-0.5 size-3 shrink-0 opacity-50 group-hover:opacity-100" />
            </a>
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
