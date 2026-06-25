import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

/**
 * GET /api/venues/geocode
 * Proxies Nominatim geocoding calls server-side to avoid CSP violations.
 *
 * Query params:
 *   ?q=search+query      → forward geocode (search)
 *   ?lat=49.28&lng=-123  → reverse geocode
 */
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  let url: string;

  if (lat && lng) {
    // Reverse geocode
    url = `${NOMINATIM_BASE}/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&format=json&addressdetails=1`;
  } else if (q && q.trim().length >= 3) {
    // Forward geocode (search)
    url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(q.trim())}&format=json&limit=5&addressdetails=1`;
  } else {
    return NextResponse.json(
      { error: "Provide ?q=… or ?lat=…&lng=…" },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(url, {
      headers: {
        "Accept-Language": "en",
        // Nominatim requires a User-Agent identifying the app
        "User-Agent": "DayCoordinator/1.0",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Geocoding upstream error" },
        { status: 502 },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Geocoding service unavailable" },
      { status: 503 },
    );
  }
}
