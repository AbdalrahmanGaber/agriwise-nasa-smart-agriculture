import { NextRequest, NextResponse } from "next/server";

/**
 * Nominatim (OpenStreetMap) proxy — server-side only.
 *
 * Search:   GET /api/geocode?q=<query>&lang=en|ar
 * Reverse:  GET /api/geocode?lat=..&lon=..&lang=en|ar
 *
 * Nominatim usage policy requires an identified User-Agent and at most
 * 1 request/second — we enforce both here on the server.
 */

const UA = "AgriWise/1.0 (agricultural decision support)";

let lastCall = 0;
async function politeFetch(url: string) {
  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  return fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lang = sp.get("lang") === "ar" ? "ar,en" : "en,ar";
  const q = sp.get("q");
  const lat = sp.get("lat");
  const lon = sp.get("lon");

  try {
    if (q) {
      const query = q.trim();
      if (query.length < 3)
        return NextResponse.json({ results: [] });
      const url =
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6` +
        `&addressdetails=1&accept-language=${encodeURIComponent(lang)}` +
        `&q=${encodeURIComponent(query)}`;
      const res = await politeFetch(url);
      if (!res.ok) throw new Error(`nominatim ${res.status}`);
      const data = (await res.json()) as Array<{
        lat: string;
        lon: string;
        display_name: string;
        type?: string;
        name?: string;
      }>;
      return NextResponse.json({
        results: data.map((d) => ({
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lon),
          label: d.display_name,
          name: d.name,
        })),
      });
    }

    if (lat && lon) {
      const la = parseFloat(lat);
      const lo = parseFloat(lon);
      if (Number.isNaN(la) || Number.isNaN(lo))
        return NextResponse.json({ error: "invalid coordinates" }, { status: 400 });
      const url =
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14` +
        `&accept-language=${encodeURIComponent(lang)}` +
        `&lat=${la}&lon=${lo}`;
      const res = await politeFetch(url);
      if (!res.ok) throw new Error(`nominatim ${res.status}`);
      const data = (await res.json()) as {
        display_name?: string;
        address?: Record<string, string>;
        error?: string;
      };
      if (data.error || !data.display_name) {
        return NextResponse.json({ label: null });
      }
      // build a compact, farmer-friendly label
      const a = data.address ?? {};
      const parts = [
        a.village ?? a.hamlet ?? a.town ?? a.suburb ?? a.city ?? a.county,
        a.state,
        a.country,
      ].filter(Boolean) as string[];
      return NextResponse.json({
        label: parts.length ? parts.join(", ") : data.display_name,
        full: data.display_name,
      });
    }

    return NextResponse.json({ error: "missing q or lat/lon" }, { status: 400 });
  } catch (err) {
    console.error("[geocode]", err);
    return NextResponse.json(
      { error: "geocode_failed" },
      { status: 502 }
    );
  }
}
