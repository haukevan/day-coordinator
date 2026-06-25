"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";
import { MapPin, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Fix Leaflet default marker icon paths for bundled apps
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// ─── types ──────────────────────────────────────────────────────────────────

interface NominatimResult {
  place_id: number;
  osm_type: string;
  osm_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

export interface LocationValue {
  name: string;
  address: string;
  lat: number;
  lng: number;
  placeId: string;
}

interface Props {
  readonly value: LocationValue | null;
  readonly onChange: (value: LocationValue | null) => void;
  readonly className?: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function searchAddress(query: string): Promise<NominatimResult[]> {
  const res = await fetch(`/api/venues/geocode?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<NominatimResult | null> {
  const res = await fetch(
    `/api/venues/geocode?lat=${encodeURIComponent(lat.toString())}&lng=${encodeURIComponent(lng.toString())}`,
  );
  if (!res.ok) return null;
  return res.json();
}

/** Build a human-readable name from Nominatim parts (first 3 comma segments). */
function buildDisplayName(parts: string[]): string {
  return parts.slice(0, 3).join(", ").trim();
}

/** Extract city + state from display_name for disambiguation. */
function buildSubtitle(parts: string[], r: NominatimResult): string {
  const city = parts[2]?.trim() ?? "";
  const state = parts[3]?.trim() ?? "";
  const type = r.type ? r.type.replaceAll("_", " ") : "";
  const segments = [city, state].filter(Boolean);
  if (type) segments.push(`· ${type}`);
  return segments.join(", ");
}

/** Build a clean address from Nominatim's structured address object. */
function buildCleanAddress(r: NominatimResult): string {
  const a = r.address;
  if (!a) return r.display_name; // fallback

  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const city = a.city ?? a.town ?? a.village ?? "";
  const parts = [street, city, a.state, a.postcode, a.country].filter(Boolean);
  return parts.join(", ");
}

function resultToLocation(r: NominatimResult): LocationValue {
  const parts = r.display_name.split(",").map((s) => s.trim());
  return {
    name: buildDisplayName(parts),
    address: buildCleanAddress(r),
    lat: Number.parseFloat(r.lat),
    lng: Number.parseFloat(r.lon),
    placeId: `${r.osm_type}/${r.osm_id}`,
  };
}

/** Short readable summary for the "selected" pill — just city + state. */
function shortSummary(addr: string): string {
  const parts = addr.split(",").map((s) => s.trim());
  // parts[0] = street/building, parts[2] = city, parts[3] = state
  const city = parts[2] ?? "";
  const state = parts[3] ?? "";
  if (city && state) return `${city}, ${state}`;
  return parts.slice(1, 3).join(", ").trim() || addr;
}

// ─── component ───────────────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50";

export function LocationPicker({ value, onChange, className }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [query, setQuery] = useState(value?.address ?? "");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [mapReady, setMapReady] = useState(false);

  // ── init map ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [value?.lat ?? 49.2827, value?.lng ?? -123.1207],
      zoom: value ? 15 : 4,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Click on map to place pin and reverse-geocode
    map.on("click", async (e: L.LeafletMouseEvent) => {
      try {
        const result = await reverseGeocode(e.latlng.lat, e.latlng.lng);
        if (result) {
          const loc = resultToLocation(result);
          setQuery(loc.address);
          onChange(loc);
        }
      } catch {
        // silently fail
      }
    });

    mapRef.current = map;
    setMapReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── sync marker with value ────────────────────────────────────────────────

  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const map = mapRef.current;

    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }

    if (value?.lat && value?.lng) {
      const marker = L.marker([value.lat, value.lng], {
        draggable: true,
      }).addTo(map);

      marker.on("dragend", async () => {
        const pos = marker.getLatLng();
        try {
          const result = await reverseGeocode(pos.lat, pos.lng);
          if (result) {
            const loc = resultToLocation(result);
            setQuery(loc.address);
            onChange(loc);
          }
        } catch {
          // silently fail
        }
      });

      markerRef.current = marker;
      map.setView([value.lat, value.lng], map.getZoom());
    }
  }, [value, mapReady, onChange]);

  // ── search ────────────────────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q || q.length < 3) return;

    setSearching(true);
    setError("");
    try {
      const data = await searchAddress(q);
      setResults(data);
      setShowResults(true);
      if (data.length === 0) {
        setError("No results found. Try a different search.");
      }
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  }, [query]);

  const selectResult = useCallback(
    (r: NominatimResult) => {
      const loc = resultToLocation(r);
      setQuery(loc.address);
      setShowResults(false);
      setResults([]);
      onChange(loc);
      // Zoom into the selected location
      if (mapRef.current) {
        mapRef.current.setView([loc.lat, loc.lng], 15);
      }
    },
    [onChange],
  );

  const clearLocation = useCallback(() => {
    setQuery("");
    setResults([]);
    setShowResults(false);
    setError("");
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    onChange(null);
  }, [onChange]);

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className={cn("space-y-3", className)}>
      {/* Search bar */}
      <div className="relative z-10">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="Search for a venue or address..."
              className={cn(inputClass, "!pl-9")}
            />
          </div>
          <Button
            type="button"
            size="lg"
            className="h-auto py-2"
            onClick={handleSearch}
            disabled={searching || query.trim().length < 3}
          >
            {searching ? "…" : "Search"}
          </Button>
        </div>

        {/* Results dropdown */}
        {showResults && results.length > 0 && (
          <>
            {/* Click-away backdrop */}
            <button
              type="button"
              className="fixed inset-0 z-20 cursor-default"
              onClick={() => setShowResults(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowResults(false);
              }}
              aria-label="Close search results"
            />
            <div className="absolute z-30 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
              <ul className="max-h-48 overflow-auto py-1">
                {results.map((r) => {
                  const parts = r.display_name.split(",").map((s) => s.trim());
                  return (
                    <li key={r.place_id}>
                      <button
                        type="button"
                        onClick={() => selectResult(r)}
                        className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-hover"
                        style={{ minHeight: "44px" }}
                      >
                        <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            {buildDisplayName(parts)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {buildSubtitle(parts, r)}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Map — always render container so Leaflet can mount; overlay loading */}
      <div className="relative z-0">
        <div className="overflow-hidden rounded-lg border border-border">
          <div
            ref={mapContainerRef}
            className="h-[280px] w-full sm:h-[320px]"
          />
          {!mapReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/40">
              <p className="text-sm text-muted-foreground">Loading map…</p>
            </div>
          )}
        </div>
        {value && mapReady && (
          <button
            type="button"
            onClick={clearLocation}
            className="absolute right-3 top-3 z-20 rounded-full bg-background/90 p-1.5 text-muted-foreground shadow-sm hover:bg-background hover:text-foreground"
            aria-label="Clear location"
          >
            <X className="size-4" />
          </button>
        )}
        {/* Promote Leaflet zoom controls above tile GPU layer */}
        <style>{`
          .leaflet-control-zoom {
            z-index: 1000 !important;
            transform: translateZ(0);
          }
        `}</style>
      </div>

      {/* Selected location summary */}
      {value && (
        <div className="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-accent" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{value.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {shortSummary(value.address)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
