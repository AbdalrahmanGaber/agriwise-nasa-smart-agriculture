import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/forecast?lat=..&lng=..
 *
 * Early-warning support for the Climate Risk Alert System.
 * Fetches a real 7-day weather forecast from Open-Meteo (no API key
 * required) for the farm coordinates. Wind is converted from km/h to m/s.
 *
 * This is FORECAST data — clearly distinct from the NASA POWER historical
 * observations used by the analysis. The response carries an explicit
 * provenance note. If the service is unreachable we return an error —
 * we never substitute estimates.
 */

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const USER_AGENT =
  "AgriWise/1.0 (Smart crop advisor; educational decision-support project)";

interface CacheEntry {
  days: ForecastDay[];
  retrievedAt: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface ForecastDay {
  date: string;
  tmax: number | null;
  tmin: number | null;
  precip: number | null;
  windMax: number | null; // m/s
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return NextResponse.json({
      days: hit.days,
      provider: "Open-Meteo",
      model: "icon global forecast (via api.open-meteo.com)",
      retrievedAt: hit.retrievedAt,
      provenance: "forecast",
    });
  }

  const url =
    `${FORECAST_URL}?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max` +
    `&timezone=auto&forecast_days=7`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Open-Meteo responded with HTTP ${res.status}`);
    }
    const json = await res.json();
    const daily = json?.daily;
    if (!daily || !Array.isArray(daily.time)) {
      throw new Error("unexpected response format");
    }

    const isFill = (v: unknown) =>
      v === null || v === undefined ||
      (typeof v === "number" && v <= -900);

    const days: ForecastDay[] = (daily.time as string[]).map((date, i) => ({
      date,
      tmax: isFill(daily.temperature_2m_max?.[i]) ? null : Number(daily.temperature_2m_max[i]),
      tmin: isFill(daily.temperature_2m_min?.[i]) ? null : Number(daily.temperature_2m_min[i]),
      precip: isFill(daily.precipitation_sum?.[i]) ? null : Number(daily.precipitation_sum[i]),
      // Open-Meteo returns km/h; the crop database uses m/s
      windMax:
        isFill(daily.wind_speed_10m_max?.[i])
          ? null
          : Math.round((Number(daily.wind_speed_10m_max[i]) / 3.6) * 10) / 10,
    }));

    const retrievedAt = new Date().toISOString();
    cache.set(key, {
      days,
      retrievedAt,
      expiresAt: Date.now() + TTL_MS,
    });

    return NextResponse.json({
      days,
      provider: "Open-Meteo",
      model: "icon global forecast (via api.open-meteo.com)",
      retrievedAt,
      provenance: "forecast",
    });
  } catch (err) {
    console.error("[forecast] fetch failed:", err);
    return NextResponse.json(
      {
        error: "forecast_unavailable",
        message:
          "The forecast service is unreachable right now. Historical NASA POWER observations below are unaffected.",
      },
      { status: 502 }
    );
  }
}
