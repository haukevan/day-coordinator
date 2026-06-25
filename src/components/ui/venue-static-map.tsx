"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// ─── tile styles ────────────────────────────────────────────────────────────

const MAP_STYLES = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
} as const;

function resolveTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

// ─── props ──────────────────────────────────────────────────────────────────

interface Props {
  readonly lat: number;
  readonly lng: number;
  readonly name: string;
  readonly address: string;
}

// ─── component ───────────────────────────────────────────────────────────────

export function VenueStaticMap({ lat, lng, name, address }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);

  // ── init map ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const theme = resolveTheme();

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES[theme],
      center: [lng, lat],
      zoom: 15,
      attributionControl: false,
      interactive: false,
    });

    map.on("load", () => {
      // Add attribution (collapsed)
      const attributionControl = new maplibregl.AttributionControl({
        compact: true,
      });
      map.addControl(attributionControl, "bottom-right");

      const attribEl =
        mapContainerRef.current?.querySelector<HTMLDetailsElement>(
          ".maplibregl-ctrl-attrib",
        );
      if (attribEl) {
        attribEl.removeAttribute("open");
        attribEl.classList.remove("maplibregl-compact-show");
      }

      // Add marker with popup
      new maplibregl.Marker({ color: "hsl(var(--primary))" })
        .setLngLat([lng, lat])
        .setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(
            `<strong>${name}</strong><br/><span style="font-size:12px">${address}</span>`,
          ),
        )
        .addTo(map);

      setReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng, name, address]);

  // ── theme change observer ─────────────────────────────────────────────────

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "class") {
          const theme = resolveTheme();
          if (mapRef.current) {
            mapRef.current.setStyle(MAP_STYLES[theme]);
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

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative overflow-hidden rounded-lg border border-border">
      <div ref={mapContainerRef} className="h-[200px] w-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/40">
          <div className="flex flex-col items-center gap-2">
            <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-muted-foreground">Loading map…</p>
          </div>
        </div>
      )}
    </div>
  );
}
