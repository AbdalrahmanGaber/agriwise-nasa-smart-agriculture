/**
 * AgriWise shared types.
 * Used by the crop database, the recommendation engine (server),
 * the API routes and the React views (client).
 */

export type Lang = "en" | "ar";

/** A bilingual string produced by the engine / database. */
export interface Bilingual {
  en: string;
  ar: string;
}

export const L = (en: string, ar: string): Bilingual => ({ en, ar });

export type SoilType = "clay" | "sandy" | "loam" | "other" | "unknown";
export type WaterAvailability = "limited" | "moderate" | "abundant";
export type Season = "summer" | "winter" | "spring" | "autumn";
export type IrrigationMethod = "flood" | "drip" | "sprinkler" | "other" | "";
export type SizeUnit = "acres" | "hectares" | "";

export interface FarmLocation {
  lat: number;
  lng: number;
  /** Reverse-geocoded / searched place name */
  label: string;
  /** How the location was obtained */
  source: "gps" | "search" | "map";
  /** GPS accuracy in meters when available */
  accuracy?: number;
}

export interface FarmInput {
  soilType: SoilType;
  waterAvailability: WaterAvailability;
  season: Season;
  farmSize?: number | null;
  sizeUnit: SizeUnit;
  irrigationMethod: IrrigationMethod;
  notes?: string;
}

export interface AnalyzeRequest {
  location: FarmLocation;
  farm: FarmInput;
}

/* ---------------- Climate data ---------------- */

export const NASA_PARAMETERS = [
  "T2M",
  "T2M_MAX",
  "T2M_MIN",
  "PRECTOTCORR",
  "RH2M",
  "ALLSKY_SFC_SW_DWN",
  "WS10M",
] as const;

export type NasaParameter = (typeof NASA_PARAMETERS)[number];

/** Monthly climatology derived from daily NASA POWER data. */
export interface MonthlyValue {
  /** 1-12 */
  month: number;
  /** Mean air temperature °C */
  t2m: number | null;
  /** Mean of daily maximum temperature °C */
  t2mMax: number | null;
  /** Mean of daily minimum temperature °C */
  t2mMin: number | null;
  /** Total corrected precipitation mm */
  precip: number | null;
  /** Mean relative humidity % */
  rh2m: number | null;
  /** Mean all-sky surface shortwave downward radiation kWh/m²/day */
  solar: number | null;
  /** Mean wind speed at 10 m, m/s */
  ws10m: number | null;
  /** Fraction of valid days used (0-1) */
  coverage: number;
}

export interface ClimateSummary {
  annualRainfallMm: number;
  meanAnnualTempC: number;
  meanAnnualSolar: number;
  meanAnnualRh: number;
  meanAnnualWind: number;
  hottestMonth: number;
  hottestMonthMeanC: number;
  coldestMonth: number;
  coldestMonthMeanC: number;
  /** Highest daily T2M_MAX observed in the period */
  extremeMaxC: number | null;
  /** Lowest daily T2M_MIN observed in the period */
  extremeMinC: number | null;
  /** Mean T2M for the hot season May-Sep */
  hotSeasonMeanC: number | null;
  /** Mean T2M for the cool season Nov-Mar */
  coolSeasonMeanC: number | null;
  /** Overall fraction of valid daily records */
  coverageOverall: number;
}

export interface DataSourceInfo {
  provider: string;
  url: string;
  community: string;
  retrievedAt: string; // ISO date
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  parameters: string[];
  coordinates: { lat: number; lng: number };
  units: Record<string, string>;
}

/* ---------------- Engine output ---------------- */

export type FactorKey =
  | "temperature"
  | "water"
  | "solar"
  | "soil"
  | "season"
  | "humidity"
  | "wind";

export interface FactorScore {
  key: FactorKey;
  /** Base weight (0-100 scale, before redistribution) */
  weight: number;
  /** Effective weight after redistribution of unavailable factors */
  effectiveWeight: number;
  /** 0-100, null when data unavailable */
  score: number | null;
  status: "ok" | "limited" | "unavailable";
  reasons: Bilingual[];
  limitations: Bilingual[];
}

export interface CropResult {
  cropId: string;
  score: number;
  classification: Bilingual;
  rank: number;
  /** true when the crop can be planted in the farmer's selected season */
  seasonMatch: boolean;
  factors: FactorScore[];
  /** Months (1-12) of the evaluated growing window, in order */
  windowMonths: number[];
  /** Documented seasonal water requirement minus effective rainfall (mm) */
  irrigationGapMm: number | null;
  /** Plain-language "why" explanation built from actual factor results */
  summary: Bilingual;
}

export interface EngineInfo {
  weights: { key: FactorKey; weight: number }[];
  methodology: Bilingual;
  confidence: "high" | "medium" | "low";
  confidenceNote: Bilingual;
}

export interface AnalysisResult {
  meta: DataSourceInfo;
  location: FarmLocation;
  farm: FarmInput;
  monthly: MonthlyValue[];
  summary: ClimateSummary;
  crops: CropResult[];
  engine: EngineInfo;
  generatedAt: string;
}

/* ---------------- Saved analyses (Prisma) ---------------- */

export interface SavedAnalysisMeta {
  id: string;
  createdAt: string;
  label: string;
  lat: number;
  lng: number;
  soilType: string;
  waterAvailability: string;
  season: string;
  bestCrop: string;
  bestCropEn: string;
  bestCropAr: string;
  bestScore: number;
}

/* ---------------- Multi-year climatology (Planting / Irrigation / Yield tools) ---------------- */

/** One month-of-year row from the 25-year NASA POWER climatology endpoint. */
export interface ClimatologyMonth {
  /** 1-12 */
  month: number;
  /** 25-yr mean of monthly mean air temperature, °C */
  t2mMean: number | null;
  /** 25-yr mean monthly total precipitation, mm */
  precipMean: number | null;
  /** 25-yr mean relative humidity, % */
  rhMean: number | null;
  /** 25-yr mean all-sky solar radiation, kWh/m²/day */
  solarMean: number | null;
  /** 25-yr mean wind speed at 10 m, m/s */
  windMean: number | null;
  /** 25-yr climatological monthly MAXIMUM (typical hottest day), °C */
  tMaxExtreme: number | null;
  /** 25-yr climatological monthly MINIMUM (typical coldest night), °C */
  tMinExtreme: number | null;
}

export interface ClimatologyInfo {
  months: ClimatologyMonth[];
  /** Baseline period reported by NASA POWER, e.g. "January 2001 - December 2025" */
  baseline: string;
  retrievedAt: string;
}

/** One month-of-year row aggregated from multiple years of NASA POWER daily data. */
export interface MultiYearMonth extends ClimatologyMonth {
  /** mean of daily maximum temperature over all years, °C */
  tMaxMean: number | null;
  /** mean of daily minimum temperature over all years, °C */
  tMinMean: number | null;
  /** highest daily maximum observed in this month across the years, °C */
  tMaxObserved: number | null;
  /** lowest daily minimum observed in this month across the years, °C */
  tMinObserved: number | null;
  /** number of valid daily records used */
  validDays: number;
}

export interface MultiYearInfo {
  months: MultiYearMonth[];
  /** number of full years fetched */
  years: number;
  periodStart: string;
  periodEnd: string;
  retrievedAt: string;
}

/** Recent daily observations (last ~60 days) used for "current conditions". */
export interface RecentConditions {
  /** ISO date of the latest valid NASA POWER observation */
  latestObservationDate: string;
  daysUsed: number;
  t2mMean: number | null;
  tMaxMean: number | null;
  tMinMean: number | null;
  tMaxObserved: number | null;
  tMinObserved: number | null;
  rhMean: number | null;
  solarMean: number | null;
  windMean: number | null;
  rainTotal: number | null;
  periodStart: string;
  periodEnd: string;
}

export const MONTHS_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export const monthName = (m: number, lang: Lang) =>
  lang === "ar" ? MONTHS_AR[m - 1] : MONTHS_EN[m - 1];

/** Season → typical Egyptian planting months (1-12) */
export const SEASON_PLANTING_MONTHS: Record<Season, number[]> = {
  winter: [11, 12],
  spring: [2, 3],
  summer: [5, 6],
  autumn: [9, 10],
};
