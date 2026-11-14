import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  aggregateMonthly,
  fetchNasaDaily,
  NASA_UNITS,
  NasaError,
  summarize,
} from "@/lib/nasa";
import { runEngine } from "@/lib/engine";
import { NASA_PARAMETERS } from "@/lib/types";

/**
 * POST /api/analyze
 * Body: { location: { lat, lng, label, source }, farm: { ... } }
 *
 * Server-side flow:
 *  1. validate input
 *  2. fetch 365 days of NASA POWER agroclimatology for the coordinates
 *  3. aggregate into a monthly climatology + summary
 *  4. run the explainable recommendation engine
 *  5. return the full AnalysisResult (never fabricated data)
 */

const FarmSchema = z.object({
  soilType: z.enum(["clay", "sandy", "loam", "other", "unknown"]),
  waterAvailability: z.enum(["limited", "moderate", "abundant"]),
  season: z.enum(["summer", "winter", "spring", "autumn"]),
  farmSize: z.number().positive().nullable().optional(),
  sizeUnit: z.enum(["acres", "hectares", ""]).default(""),
  irrigationMethod: z.enum(["flood", "drip", "sprinkler", "other", ""]).default(""),
  notes: z.string().max(2000).optional(),
});

const BodySchema = z.object({
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    label: z.string().max(500).optional().default(""),
    source: z.enum(["gps", "search", "map"]),
    accuracy: z.number().optional(),
  }),
  farm: FarmSchema,
});

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
  const { location, farm } = parsed.data;

  try {
    const { daily, periodStart, periodEnd } = await fetchNasaDaily(
      location.lat,
      location.lng
    );
    const monthly = aggregateMonthly(daily);
    const summary = summarize(daily, monthly);
    const { crops, engine } = runEngine(monthly, summary, farm);

    const result = {
      meta: {
        provider: "NASA POWER",
        url: "https://power.larc.nasa.gov/",
        community: "AG (Agroclimatology)",
        retrievedAt: new Date().toISOString(),
        periodStart,
        periodEnd,
        parameters: [...NASA_PARAMETERS],
        coordinates: { lat: location.lat, lng: location.lng },
        units: NASA_UNITS,
      },
      location,
      farm,
      monthly,
      summary,
      crops,
      engine,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof NasaError) {
      console.error("[analyze] nasa:", err.message);
      return NextResponse.json(
        { error: "nasa_failed", message: err.message },
        { status: err.status >= 400 && err.status < 600 ? err.status : 502 }
      );
    }
    console.error("[analyze] unexpected:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
