"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { cn } from "@/lib/utils";
import {
  MapPin,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from "lucide-react";

// ─── tile styles (theme-aware vector tiles) ─────────────────────────────────

const MAP_STYLES = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
} as const;

function resolveTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

// ─── constants ──────────────────────────────────────────────────────────────

const DEFAULT_CENTER: [number, number] = [-98.5795, 39.8283];
const DEFAULT_ZOOM = 3;
const PINNED_ZOOM = 13;
const PREVIEW_ZOOM = 12;
const TOOLTIP_DELAY = 800;

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

async function forwardGeocode(
  query: string,
  signal?: AbortSignal,
): Promise<NominatimResult[]> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
    {
      headers: { "User-Agent": "DayCoordinator/1.0" },
      signal,
    },
  );
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<NominatimResult | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { "User-Agent": "DayCoordinator/1.0" } },
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function buildDisplayName(parts: string[]): string {
  return parts.slice(0, 3).join(", ").trim();
}

function buildSubtitle(parts: string[], r: NominatimResult): string {
  const city = parts[2]?.trim() ?? "";
  const state = parts[3]?.trim() ?? "";
  const type = r.type ? r.type.replaceAll("_", " ") : "";
  const segments = [city, state].filter(Boolean);
  if (type) segments.push(`· ${type}`);
  return segments.join(", ");
}

function buildCleanAddress(r: NominatimResult): string {
  const a = r.address;
  if (!a) return r.display_name;
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

function shortSummary(addr: string): string {
  const parts = addr.split(",").map((s) => s.trim());
  const city = parts[2] ?? "";
  const state = parts[3] ?? "";
  if (city && state) return `${city}, ${state}`;
  return parts.slice(1, 3).join(", ").trim() || addr;
}

function getLocationDisplayName(value: LocationValue | null): string | null {
  if (value?.name) return value.name.split(",")[0];
  if (value) return "Loading address...";
  return null;
}

/** Returns true if the coordinates are not both ~0 (e.g. existing venues with no geodata). */
function hasValidCoords(value: LocationValue | null): boolean {
  if (!value) return false;
  return Math.abs(value.lat) >= 0.0001 || Math.abs(value.lng) >= 0.0001;
}

// ─── component ───────────────────────────────────────────────────────────────

export function LocationPicker({ value, onChange, className }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const previewMapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const previewMapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const previewMarkerRef = useRef<maplibregl.Marker | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState(value?.address ?? "");
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showMapTooltip, setShowMapTooltip] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs to avoid stale closures in event handlers
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  // Sync refs in effect — React 19 forbids ref writes during render
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // ── init full map (lazy, only when expanded) ──────────────────────────────

  useEffect(() => {
    if (!isExpanded) return;
    if (mapRef.current) return;
    if (!mapContainerRef.current) return;

    const theme = resolveTheme();
    const currentValue = valueRef.current;
    const valid = hasValidCoords(currentValue);

    const center: [number, number] = valid
      ? [currentValue!.lng, currentValue!.lat]
      : DEFAULT_CENTER;
    const zoom = valid ? PINNED_ZOOM : DEFAULT_ZOOM;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES[theme],
      center,
      zoom,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      const attributionControl = new maplibregl.AttributionControl({
        compact: true,
      });
      map.addControl(attributionControl, "bottom-right");

      // Collapse attribution
      const attribEl =
        mapContainerRef.current?.querySelector<HTMLDetailsElement>(
          ".maplibregl-ctrl-attrib",
        );
      if (attribEl) {
        attribEl.removeAttribute("open");
        attribEl.classList.remove("maplibregl-compact-show");
      }

      requestAnimationFrame(() => {
        setIsMapLoaded(true);
      });

      // Place existing marker if value exists with valid coords
      if (valid && currentValue?.lat && currentValue?.lng) {
        const marker = new maplibregl.Marker({
          color: "hsl(var(--primary))",
          draggable: true,
        })
          .setLngLat([currentValue.lng, currentValue.lat])
          .addTo(map);

        marker.on("dragend", async () => {
          const pos = marker.getLngLat();
          const result = await reverseGeocode(pos.lat, pos.lng);
          if (result) {
            const loc = resultToLocation(result);
            setSearchQuery(loc.address);
            onChangeRef.current(loc);
          }
        });

        markerRef.current = marker;
      }
    });

    // Click to place / move pin
    map.on("click", async (e) => {
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      if (markerRef.current) {
        markerRef.current.remove();
      }

      const marker = new maplibregl.Marker({
        color: "hsl(var(--primary))",
        draggable: true,
      })
        .setLngLat(lngLat)
        .addTo(map);

      marker.on("dragend", async () => {
        const pos = marker.getLngLat();
        const result = await reverseGeocode(pos.lat, pos.lng);
        if (result) {
          const loc = resultToLocation(result);
          setSearchQuery(loc.address);
          onChangeRef.current(loc);
        }
      });

      markerRef.current = marker;

      const result = await reverseGeocode(lngLat[1], lngLat[0]);
      if (result) {
        const loc = resultToLocation(result);
        setSearchQuery(loc.address);
        onChangeRef.current(loc);
      }
    });

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        setIsMapLoaded(false);
      }
    };
  }, [isExpanded]);

  // ── auto-focus search input when map loads ────────────────────────────────

  useEffect(() => {
    if (isExpanded && isMapLoaded && searchInputRef.current) {
      const id = setTimeout(() => searchInputRef.current?.focus(), 100);
      return () => clearTimeout(id);
    }
  }, [isExpanded, isMapLoaded]);

  // ── init preview map (when collapsed + value exists, coords valid) ────────

  useEffect(() => {
    if (isExpanded) return;

    const valid = hasValidCoords(value);

    if (!value || !valid) {
      if (previewMapRef.current) {
        previewMapRef.current.remove();
        previewMapRef.current = null;
        previewMarkerRef.current = null;
      }
      return;
    }

    if (!previewMapContainerRef.current) return;

    // Update existing preview
    if (previewMapRef.current) {
      previewMapRef.current.setCenter([value.lng, value.lat]);
      if (previewMarkerRef.current) {
        previewMarkerRef.current.setLngLat([value.lng, value.lat]);
      } else {
        const marker = new maplibregl.Marker({
          color: "hsl(var(--primary))",
          draggable: false,
        })
          .setLngLat([value.lng, value.lat])
          .addTo(previewMapRef.current);
        previewMarkerRef.current = marker;
      }
      return;
    }

    const theme = resolveTheme();
    const previewMap = new maplibregl.Map({
      container: previewMapContainerRef.current,
      style: MAP_STYLES[theme],
      center: [value.lng, value.lat],
      zoom: PREVIEW_ZOOM,
      attributionControl: false,
      interactive: false,
    });

    previewMap.on("load", () => {
      const marker = new maplibregl.Marker({
        color: "hsl(var(--primary))",
        draggable: false,
      })
        .setLngLat([value.lng, value.lat])
        .addTo(previewMap);

      previewMarkerRef.current = marker;
    });

    previewMapRef.current = previewMap;
  }, [isExpanded, value]);

  // ── theme change observer ─────────────────────────────────────────────────

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "class") {
          const theme = resolveTheme();
          if (mapRef.current) {
            mapRef.current.setStyle(MAP_STYLES[theme]);
          }
          if (previewMapRef.current) {
            previewMapRef.current.setStyle(MAP_STYLES[theme]);
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  // ── cleanup preview on unmount ────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (previewMapRef.current) {
        previewMapRef.current.remove();
        previewMapRef.current = null;
        previewMarkerRef.current = null;
      }
    };
  }, []);

  // ── search (debounced 300ms, direct Nominatim) ────────────────────────────

  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSearching(true);
    try {
      const data = await forwardGeocode(trimmed, controller.signal);
      setSearchResults(data);
      setShowResults(data.length > 0);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = useCallback(
    (newQuery: string) => {
      setSearchQuery(newQuery);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }

      if (!newQuery.trim()) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      searchTimeoutRef.current = setTimeout(() => {
        doSearch(newQuery);
      }, 300);
    },
    [doSearch],
  );

  const selectSearchResult = useCallback(
    (r: NominatimResult) => {
      const loc = resultToLocation(r);
      setSearchQuery(loc.address);
      setSearchResults([]);
      setShowResults(false);
      onChange(loc);

      if (mapRef.current) {
        mapRef.current.flyTo({
          center: [loc.lng, loc.lat],
          zoom: PINNED_ZOOM,
          duration: 1000,
        });

        // Update marker
        if (markerRef.current) {
          markerRef.current.remove();
        }
        const marker = new maplibregl.Marker({
          color: "hsl(var(--primary))",
          draggable: true,
        })
          .setLngLat([loc.lng, loc.lat])
          .addTo(mapRef.current);

        marker.on("dragend", async () => {
          const pos = marker.getLngLat();
          const result = await reverseGeocode(pos.lat, pos.lng);
          if (result) {
            const loc2 = resultToLocation(result);
            setSearchQuery(loc2.address);
            onChange(loc2);
          }
        });

        markerRef.current = marker;
      }
    },
    [onChange],
  );

  const clearLocation = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
    setIsExpanded(false);
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    onChange(null);
  }, [onChange]);

  // ── computed values ───────────────────────────────────────────────────────

  const locationDisplayName = getLocationDisplayName(value);
  const coordsValid = hasValidCoords(value);
  const showPreviewMap = !!(value && coordsValid && !isExpanded);
  const isTextOnlyVenue = !!(value && !coordsValid);

  const buttonLabel = (() => {
    if (isExpanded) return "Hide map";
    if (isTextOnlyVenue)
      return `${locationDisplayName ?? "Location"} (text only)`;
    return locationDisplayName ?? "Select location";
  })();

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className={cn("w-full", className)}>
      {/* ── toggle button / preview ──────────────────────────────────────── */}
      <div className={`relative ${showPreviewMap ? "h-16" : ""}`}>
        {/* Preview map background — only when coords are valid */}
        {coordsValid && (
          <div
            ref={previewMapContainerRef}
            className={`absolute inset-0 w-full h-full rounded-lg overflow-hidden transition-opacity duration-300 ${
              showPreviewMap ? "opacity-60" : "opacity-0 pointer-events-none"
            }`}
          />
        )}

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors ${
            showPreviewMap
              ? "absolute inset-0 h-full bg-transparent"
              : "relative bg-background"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="size-4 shrink-0" />
            {showPreviewMap ? (
              <span className="text-xs font-medium truncate bg-background px-2 py-0.5 rounded-md text-foreground shadow-sm">
                {buttonLabel}
              </span>
            ) : (
              <span className="text-xs truncate">{buttonLabel}</span>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp
              className={`size-4 shrink-0 ${showPreviewMap ? "bg-background rounded p-0.5" : ""}`}
            />
          ) : (
            <ChevronDown
              className={`size-4 shrink-0 ${showPreviewMap ? "bg-background rounded p-0.5" : ""}`}
            />
          )}
        </button>
      </div>

      {/* ── expanded map ──────────────────────────────────────────────────── */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          isExpanded ? "mt-3 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="rounded-xl overflow-hidden border border-border bg-card">
          {/* Search bar */}
          <div className="px-3 py-2 border-b border-border bg-background relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setShowResults(false);
                  }
                }}
                placeholder="Search for a location..."
                className="w-full pl-9 pr-8 py-2 text-sm rounded-lg bg-surface border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/50"
              />
              {(searchQuery || isSearching) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setShowResults(false);
                    if (markerRef.current) {
                      markerRef.current.remove();
                      markerRef.current = null;
                    }
                    onChange(null);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded"
                  aria-label="Clear search"
                >
                  {isSearching ? (
                    <div className="size-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <X className="size-3.5" />
                  )}
                </button>
              )}
            </div>

            {/* Search results dropdown */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto">
                {searchResults.map((r) => {
                  const parts = r.display_name.split(",").map((s) => s.trim());
                  return (
                    <button
                      key={r.place_id}
                      type="button"
                      onClick={() => {
                        selectSearchResult(r);
                      }}
                      className="w-full px-3 py-2.5 text-left text-sm hover:bg-hover transition-colors border-b border-border last:border-b-0 flex items-start gap-2"
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
                  );
                })}
              </div>
            )}
          </div>

          {/* Map container */}
          <div
            ref={mapContainerRef}
            className="w-full h-[350px] relative"
            style={{ minHeight: "350px" }}
            onMouseEnter={() => {
              tooltipTimeoutRef.current = setTimeout(() => {
                setShowMapTooltip(true);
              }, TOOLTIP_DELAY);
            }}
            onMouseLeave={() => {
              if (tooltipTimeoutRef.current) {
                clearTimeout(tooltipTimeoutRef.current);
                tooltipTimeoutRef.current = null;
              }
              setShowMapTooltip(false);
            }}
            onMouseDown={() => {
              if (tooltipTimeoutRef.current) {
                clearTimeout(tooltipTimeoutRef.current);
                tooltipTimeoutRef.current = null;
              }
              setShowMapTooltip(false);
            }}
          >
            {/* Loading overlay */}
            {isExpanded && !isMapLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-surface">
                <div className="flex flex-col items-center gap-2">
                  <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-muted-foreground">
                    Loading map...
                  </span>
                </div>
              </div>
            )}

            {/* Coordinates display — only for valid coords */}
            {coordsValid && isMapLoaded && value && (
              <div className="absolute bottom-2 left-2 z-10 bg-background/90 backdrop-blur-sm px-2 py-1 rounded text-[10px] text-muted-foreground font-mono flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={async () => {
                    const coords = `${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}`;
                    await navigator.clipboard.writeText(coords);
                    setCopiedCoords(true);
                    setTimeout(() => setCopiedCoords(false), 1500);
                  }}
                  className="p-0.5 hover:text-foreground transition-colors"
                  title="Copy coordinates"
                >
                  {copiedCoords ? (
                    <Check className="size-3 text-success" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </button>
                <span>
                  {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
                </span>
              </div>
            )}

            {/* Tooltip */}
            {showMapTooltip && isMapLoaded && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 bg-popover/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border border-border pointer-events-none">
                <p className="text-xs text-foreground whitespace-nowrap">
                  Drag pin to adjust or click to move
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected location summary (shown when collapsed) */}
      {!isExpanded && value && (
        <div className="flex items-start gap-2 mt-2 rounded-md bg-muted/40 px-3 py-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{value.name}</p>
            {coordsValid ? (
              <p className="truncate text-xs text-muted-foreground">
                {shortSummary(value.address)}
              </p>
            ) : (
              <p className="truncate text-xs text-muted-foreground">
                {value.address || "Text-only location"}
              </p>
            )}
            {isTextOnlyVenue && (
              <p className="text-[10px] text-muted-foreground mt-0.5 italic">
                No map coordinates — search to update
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={clearLocation}
            className="ml-auto p-1 text-muted-foreground hover:text-destructive rounded shrink-0"
            aria-label="Remove location"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
