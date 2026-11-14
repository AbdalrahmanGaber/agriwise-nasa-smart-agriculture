/**
 * NASA GIBS satellite imagery catalog (client-side).
 *
 * Real imagery from NASA's Global Imagery Browse Services (GIBS /
 * EOSDIS Worldview) — no API key required, CORS open (verified:
 * access-control-allow-origin: *).
 *
 * Layer identifiers verified against the WMTS GetCapabilities document
 * AND live tile requests (https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/...):
 *   - VIIRS_SNPP_CorrectedReflectance_TrueColor (daily, 375 m) ✓
 *   - MODIS_Terra_CorrectedReflectance_TrueColor (daily, 250 m) ✓
 *   - MODIS_Terra_L3_NDVI_16Day (16-day NDVI composite) ✓
 * (Landsat WELD layers are advertised in GetCapabilities but returned no
 * tiles for any tested date — excluded rather than shown broken.)
 *
 * Sentinel-2 is NOT available through this open service — connecting it
 * requires Copernicus Data Space Ecosystem credentials, which this
 * deployment does not have. The UI states this plainly.
 */

import type { Bilingual } from "./types";
import { L } from "./types";

export interface GibsLayer {
  id: string;
  /** which feature group this layer belongs to */
  group: "truecolor" | "ndvi";
  title: Bilingual;
  description: Bilingual;
  /** native spatial resolution, metres */
  resolutionM: number;
  /** temporal behaviour */
  temporal: "daily" | "16day" | "monthly";
  temporalLabel: Bilingual;
  fileExt: "jpg" | "png";
  /** GoogleMapsCompatible_Level{N} tile matrix */
  maxNativeZoom: number;
  attribution: string;
}

export const GIBS_LAYERS: GibsLayer[] = [
  {
    id: "VIIRS_SNPP_CorrectedReflectance_TrueColor",
    group: "truecolor",
    title: L("VIIRS true colour (daily)", "ألوان حقيقية VIIRS (يومي)"),
    description: L(
      "Suomi NPP VIIRS corrected reflectance — the closest daily view of your fields (375 m per pixel).",
      "انعكاس مصحح من VIIRS على قمر Suomi NPP — أقرب رؤية يومية لحقولك (375 م لكل بكسل)."
    ),
    resolutionM: 375,
    temporal: "daily",
    temporalLabel: L("Daily", "يومي"),
    fileExt: "jpg",
    maxNativeZoom: 9,
    attribution: "NASA EOSDIS GIBS / Suomi NPP VIIRS",
  },
  {
    id: "MODIS_Terra_CorrectedReflectance_TrueColor",
    group: "truecolor",
    title: L("MODIS Terra true colour (daily)", "ألوان حقيقية MODIS تيرا (يومي)"),
    description: L(
      "Terra MODIS corrected reflectance at 250 m per pixel — daily since 2000.",
      "انعكاس مصحح من MODIS على قمر تيرا بدقة 250 م لكل بكسل — يومي منذ عام 2000."
    ),
    resolutionM: 250,
    temporal: "daily",
    temporalLabel: L("Daily", "يومي"),
    fileExt: "jpg",
    maxNativeZoom: 9,
    attribution: "NASA EOSDIS GIBS / Terra MODIS",
  },
  {
    id: "MODIS_Terra_L3_NDVI_16Day",
    group: "ndvi",
    title: L("MODIS NDVI (16-day)", "NDVI من MODIS (16 يومًا)"),
    description: L(
      "Normalized Difference Vegetation Index composite — vegetation health and density. Green = dense active vegetation; yellow/brown = sparse or dormant; grey/no data = clouds or missing observation.",
      "تركيبة مؤشر الغطاء النباتي (NDVI) — كثافة وصحة الغطاء النباتي. الأخضر = غطاء كثيف نشِط؛ الأصفر/البني = غطاء متناثر أو ساكن؛ الرمادي/بلا بيانات = سحب أو مشاهدة مفقودة."
    ),
    resolutionM: 250,
    temporal: "16day",
    temporalLabel: L("16-day composite", "تركيبة 16 يومًا"),
    fileExt: "png",
    maxNativeZoom: 9,
    attribution: "NASA EOSDIS GIBS / Terra MODIS L3 NDVI",
  },
];

export const getGibsLayer = (id: string) =>
  GIBS_LAYERS.find((l) => l.id === id);

/** Build the WMTS URL for a layer + date. */
export const gibsUrl = (
  layerId: string,
  date: string,
  ext: "jpg" | "png",
  maxNativeZoom: number
) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layerId}/default/${date}/GoogleMapsCompatible_Level${maxNativeZoom}/{z}/{y}/{x}.${ext}`;

/** MODIS 16-day composites start on Jan 1 + k*16 each year. */
export function snapToComposite16(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const start = new Date(Date.UTC(y, 0, 1));
  const cur = new Date(Date.UTC(y, m - 1, d));
  const k = Math.floor((cur.getTime() - start.getTime()) / (16 * 86400000));
  const snapped = new Date(start.getTime() + k * 16 * 86400000);
  return `${snapped.getUTCFullYear()}-${String(snapped.getUTCMonth() + 1).padStart(2, "0")}-${String(snapped.getUTCDate()).padStart(2, "0")}`;
}

/** Latest date for which a daily GIBS layer usually has data (UTC). */
export function latestLikelyAvailable(daysBack = 3): string {
  const d = new Date(Date.now() - daysBack * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Availability probe: fetch the single tile covering the coordinates and
 * compare its byte size — near-empty GIBS tiles (~200 bytes) mean
 * "no observation" for that date/location. Uses CORS-enabled fetch.
 */
export async function probeTileAvailability(
  layer: GibsLayer,
  date: string,
  lat: number,
  lng: number
): Promise<{ available: boolean; tileUrl: string }> {
  const z = layer.maxNativeZoom;
  const n = Math.pow(2, z);
  const latRad = (lat * Math.PI) / 180;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  const url = gibsUrl(layer.id, date, layer.fileExt, layer.maxNativeZoom)
    .replace("{z}", String(z))
    .replace("{y}", String(y))
    .replace("{x}", String(x));
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { available: false, tileUrl: url };
    const blob = await res.blob();
    // real imagery tiles are several KB; empty "no data" tiles ~200 bytes
    return { available: blob.size > 1024, tileUrl: url };
  } catch {
    return { available: false, tileUrl: url };
  }
}
