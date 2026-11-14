import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CROPS, getCrop } from "@/lib/crops";
import { resolveCrop } from "@/lib/planting";
import { runIrrigationAdvisor } from "@/lib/irrigation";
import {
  fetchNasaClimatology,
  fetchNasaMultiYearDaily,
  fetchNasaRecent,
  NasaError,
} from "@/lib/nasa";
import type { GrowthStage } from "@/lib/fao56";

/**
 * POST /api/irrigation
 * Body: { crop, lat, lng, label?, growthStage, soilType?, waterAvailability?,
 *        irrigationMethod?, currentMonth, currentDayOfYear }
 *
 * Elevation (required by FAO-56 for atmospheric pressure) comes from the
 * Open-Meteo elevation service. If it is unreachable, ETo is skipped and
 * the response says so — no value is ever substituted.
 */

const BodySchema = z.object({
  crop: z.string().min(1).max(80),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().max(500).optional().default(""),
  growthStage: z.enum(["initial", "development", "mid", "late"]),
  soilType: z
    .enum(["clay", "sandy", "loam", "other", "unknown"])
    .optional(),
  waterAvailability: z.enum(["limited", "moderate", "abundant"]).optional(),
  irrigationMethod: z
    .enum(["flood", "drip", "sprinkler", "other", ""])
    .optional(),
  currentMonth: z.number().int().min(1).max(12),
  currentDayOfYear: z.number().int().min(1).max(366),
});

// Elevation never changes for a coordinate — cache it for the process
// lifetime so repeated irrigation calls do not re-hit the (rate-limited)
// Open-Meteo service, and so a single successful fetch outlives quota
// exhaustion windows.
const elevationCache = new Map<string, number>();

async function fetchElevation(
  lat: number,
  lng: number
): Promise<number | null> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const hit = elevationCache.get(key);
  if (hit !== undefined) return hit;
  try {
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}`;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "AgriWise/1.0 (Smart crop advisor; educational decision-support project)",
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(12_000),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`elevation HTTP ${res.status}`);
        const json = await res.json();
        const el = Array.isArray(json?.elevation) ? json.elevation[0] : undefined;
        if (typeof el === "number" && el > -450 && el < 9000) {
          const rounded = Math.round(el);
          elevationCache.set(key, rounded);
          return rounded;
        }
        return null;
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    console.error("[irrigation] elevation failed:", lastErr);
    return null;
  } catch {
    return null;
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
  const b = parsed.data;
  const crop = getCrop(b.crop.trim().toLowerCase()) ?? resolveCrop(b.crop);
  if (!crop) {
    return NextResponse.json(
      {
        error: "crop_not_supported",
        message: `Reliable irrigation information for "${b.crop}" is not currently available in the AgriWise database. Supported crops: ${CROPS.map((c) => c.name.en).join(", ")}.`,
      },
      { status: 404 }
    );
  }

  try {
    const [climatology, multiYear, recent, elevation] = await Promise.all([
      fetchNasaClimatology(b.lat, b.lng),
      fetchNasaMultiYearDaily(b.lat, b.lng, 3),
      fetchNasaRecent(b.lat, b.lng, 60).catch(() => null),
      fetchElevation(b.lat, b.lng),
    ]);

    const result = runIrrigationAdvisor({
      crop,
      lat: b.lat,
      lng: b.lng,
      label: b.label,
      stage: b.growthStage as GrowthStage,
      currentMonth: b.currentMonth,
      currentDayOfYear: b.currentDayOfYear,
      soilType: b.soilType,
      waterAvailability: b.waterAvailability,
      climatology,
      multiYear,
      recent,
      elevationM: elevation,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof NasaError) {
      console.error("[irrigation] nasa:", err.message);
      return NextResponse.json(
        { error: "nasa_failed", message: err.message },
        { status: err.status >= 400 && err.status < 600 ? err.status : 502 }
      );
    }
    console.error("[irrigation] unexpected:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
