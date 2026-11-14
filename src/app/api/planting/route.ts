import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CROPS, getCrop } from "@/lib/crops";
import { resolveCrop, runPlantingAdvisor } from "@/lib/planting";
import {
  fetchNasaClimatology,
  fetchNasaMultiYearDaily,
  fetchNasaRecent,
  NasaError,
} from "@/lib/nasa";
import type { ForecastDayLite } from "@/lib/planting";

/**
 * POST /api/planting
 * Body: { crop: string (crop id or free text), lat, lng, label?,
 *         currentMonth: 1-12, variety? }
 *
 * Server flow:
 *  1. resolve the crop (free text → documented crop database record)
 *  2. fetch NASA POWER 25-year climatology + ~3 years of daily data
 *     + recent ~60-day observations, in parallel
 *  3. optionally fetch a real 7-day forecast (Open-Meteo) — forecast data
 *     is clearly labelled and never confused with observations
 *  4. run the planting advisor and return the full explainable result
 */

const BodySchema = z.object({
  crop: z.string().min(1).max(80),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().max(500).optional().default(""),
  currentMonth: z.number().int().min(1).max(12),
  variety: z.string().max(80).optional(),
});

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const USER_AGENT =
  "AgriWise/1.0 (Smart crop advisor; educational decision-support project)";

/** Real 7-day forecast (Open-Meteo, no API key). Returns null on failure. */
async function fetchForecast(
  lat: number,
  lng: number
): Promise<{ days: ForecastDayLite[]; retrievedAt: string } | null> {
  try {
    const url =
      `${FORECAST_URL}?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max` +
      `&timezone=auto&forecast_days=7`;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    const d = json?.daily;
    if (!d || !Array.isArray(d.time)) return null;
    const days: ForecastDayLite[] = (d.time as string[]).map((date, i) => {
      const num = (v: unknown) =>
        v === null || v === undefined ||
        (typeof v === "number" && v <= -900) ? null : Number(v);
      return {
        date,
        tmax: num(d.temperature_2m_max?.[i]),
        tmin: num(d.temperature_2m_min?.[i]),
        precip: num(d.precipitation_sum?.[i]),
        // Open-Meteo wind is km/h → m/s
        windMax:
          d.wind_speed_10m_max?.[i] === null || d.wind_speed_10m_max?.[i] === undefined
            ? null
            : Math.round((Number(d.wind_speed_10m_max[i]) / 3.6) * 10) / 10,
      };
    });
    return { days, retrievedAt: new Date().toISOString() };
  } catch {
    return null; // forecast is optional — never fabricated
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const { crop: cropQuery, lat, lng, label, currentMonth, variety } =
    parsed.data;

  // resolve crop by id first, then by free text
  const crop = getCrop(cropQuery.trim().toLowerCase()) ?? resolveCrop(cropQuery);
  if (!crop) {
    return NextResponse.json(
      {
        error: "crop_not_supported",
        message: `Reliable planting information for "${cropQuery}" is not currently available in the AgriWise database. Supported crops: ${CROPS.map((c) => c.name.en).join(", ")}.`,
        supportedCrops: CROPS.map((c) => ({ id: c.id, en: c.name.en, ar: c.name.ar })),
      },
      { status: 404 }
    );
  }

  try {
    const [climatology, multiYear, recent, forecast] = await Promise.all([
      fetchNasaClimatology(lat, lng),
      fetchNasaMultiYearDaily(lat, lng, 3),
      fetchNasaRecent(lat, lng, 60).catch(() => null),
      fetchForecast(lat, lng),
    ]);

    const result = runPlantingAdvisor({
      crop,
      lat,
      lng,
      label,
      currentMonth,
      variety: variety?.trim() || undefined,
      climatology,
      multiYear,
      recent,
      forecast: forecast?.days ?? null,
      forecastProvider: forecast ? "Open-Meteo (icon global forecast)" : undefined,
      forecastRetrievedAt: forecast?.retrievedAt,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof NasaError) {
      console.error("[planting] nasa:", err.message);
      return NextResponse.json(
        { error: "nasa_failed", message: err.message },
        { status: err.status >= 400 && err.status < 600 ? err.status : 502 }
      );
    }
    console.error("[planting] unexpected:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
