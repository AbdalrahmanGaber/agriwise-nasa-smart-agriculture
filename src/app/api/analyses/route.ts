import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCrop } from "@/lib/crops";
import type { AnalysisResult } from "@/lib/types";

/**
 * GET  /api/analyses        — latest 10 saved analyses (metadata only)
 * POST /api/analyses        — save a full analysis result (result JSON)
 *
 * Saving is optional: the app works entirely without it.
 */

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  try {
    if (id) {
      const row = await db.savedAnalysis.findUnique({ where: { id } });
      if (!row) {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      return NextResponse.json({ result: JSON.parse(row.resultJson) });
    }
    const rows = await db.savedAnalysis.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return NextResponse.json({
      analyses: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        label: r.label,
        lat: r.lat,
        lng: r.lng,
        soilType: r.soilType,
        waterAvailability: r.waterAvailability,
        season: r.season,
        bestCrop: r.bestCrop,
        bestCropEn: r.bestCropEn,
        bestCropAr: r.bestCropAr,
        bestScore: r.bestScore,
      })),
    });
  } catch (err) {
    console.error("[analyses GET]", err);
    return NextResponse.json({ analyses: [] });
  }
}

// The saved payload is the FULL analysis result produced by /api/analyze.
// Validation is intentionally non-destructive: zod object schemas strip
// unknown keys, which would corrupt the bilingual factor explanations on
// reload — so we only sanity-check the outer shape and keep the original.
const SaveSchema = z.object({
  result: z.unknown(),
});

function isAnalysisResult(v: unknown): v is AnalysisResult {
  const r = v as AnalysisResult;
  return (
    !!r &&
    typeof r === "object" &&
    typeof r.location?.lat === "number" &&
    typeof r.location?.lng === "number" &&
    Array.isArray(r.crops) &&
    r.crops.length > 0 &&
    !!r.farm?.soilType
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SaveSchema.safeParse(body);
    if (!parsed.success || !isAnalysisResult(parsed.data.result)) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }
    const result = parsed.data.result;
    const best = result.crops?.[0];
    const crop = best ? getCrop(best.cropId) : undefined;

    const row = await db.savedAnalysis.create({
      data: {
        lat: result.location.lat,
        lng: result.location.lng,
        label: result.location.label || `${result.location.lat.toFixed(4)}, ${result.location.lng.toFixed(4)}`,
        soilType: result.farm.soilType,
        waterAvailability: result.farm.waterAvailability,
        season: result.farm.season,
        bestCrop: best?.cropId ?? "",
        bestCropEn: crop?.name.en ?? "",
        bestCropAr: crop?.name.ar ?? "",
        bestScore: Math.round(best?.score ?? 0),
        resultJson: JSON.stringify(result),
      },
    });
    return NextResponse.json({ id: row.id, ok: true });
  } catch (err) {
    console.error("[analyses POST]", err);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
