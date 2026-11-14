import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CROPS, getCrop } from "@/lib/crops";
import { resolveCrop } from "@/lib/planting";
import { runYieldEstimator } from "@/lib/yield";
import {
  fetchNasaMultiYearDaily,
  NasaError,
} from "@/lib/nasa";

/**
 * POST /api/yield
 * Body: { crop, lat, lng, label?, area?, areaUnit?, variety?,
 *         plantingMonth?, soilType?, waterAvailability?,
 *         irrigationMethod?, growthStage? }
 *
 * Returns FAOSTAT national reference yields + real climate risk factors.
 * No field-specific yield prediction is attempted or implied.
 */

const BodySchema = z.object({
  crop: z.string().min(1).max(80),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().max(500).optional().default(""),
  area: z.number().positive().max(100000).optional(),
  areaUnit: z.enum(["acres", "hectares", "feddan"]).optional(),
  variety: z.string().max(80).optional(),
  plantingMonth: z.number().int().min(1).max(12).optional(),
  soilType: z.enum(["clay", "sandy", "loam", "other", "unknown"]).optional(),
  waterAvailability: z.enum(["limited", "moderate", "abundant"]).optional(),
  irrigationMethod: z.enum(["flood", "drip", "sprinkler", "other", ""]).optional(),
  growthStage: z
    .enum(["initial", "development", "mid", "late"])
    .optional(),
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
  const b = parsed.data;
  const crop = getCrop(b.crop.trim().toLowerCase()) ?? resolveCrop(b.crop);
  if (!crop) {
    return NextResponse.json(
      {
        error: "crop_not_supported",
        message: `Reliable yield information for "${b.crop}" is not currently available in the AgriWise database. Supported crops: ${CROPS.map((c) => c.name.en).join(", ")}.`,
      },
      { status: 404 }
    );
  }

  try {
    const multiYear = await fetchNasaMultiYearDaily(b.lat, b.lng, 3);
    const result = runYieldEstimator({
      crop,
      lat: b.lat,
      lng: b.lng,
      area: b.area,
      areaUnit: b.areaUnit,
      variety: b.variety?.trim() || undefined,
      plantingMonth: b.plantingMonth,
      soilType: b.soilType,
      waterAvailability: b.waterAvailability,
      irrigationMethod: b.irrigationMethod || undefined,
      growthStage: b.growthStage,
      multiYear,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof NasaError) {
      console.error("[yield] nasa:", err.message);
      return NextResponse.json(
        { error: "nasa_failed", message: err.message },
        { status: err.status >= 400 && err.status < 600 ? err.status : 502 }
      );
    }
    console.error("[yield] unexpected:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
