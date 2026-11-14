/**
 * NASA POWER integration (server-side only).
 *
 * API: https://power.larc.nasa.gov/api/temporal/daily/point
 * Community: AG (Agroclimatology)
 * No API key required. We call it from Next.js API routes so the request
 * runs server-side with a proper User-Agent and controlled timeouts.
 *
 * The NASA POWER fill value is -999; those records are excluded.
 * No synthetic data is ever substituted when values are missing.
 */

import {
  NASA_PARAMETERS,
  type ClimateSummary,
  type ClimatologyInfo,
  type ClimatologyMonth,
  type MultiYearInfo,
  type MultiYearMonth,
  type MonthlyValue,
  type NasaParameter,
  type RecentConditions,
} from "./types";

const POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point";
const CLIMATOLOGY_URL =
  "https://power.larc.nasa.gov/api/temporal/climatology/point";

const USER_AGENT =
  "AgriWise/1.0 (Smart crop advisor; educational decision-support project)";

export interface NasaDaily {
  /** parameter -> YYYYMMDD -> value */
  parameter: Record<string, Record<string, number | null>>;
  /** human-readable period start (YYYYMMDD) */
  start: string;
  end: string;
}

export class NasaError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

const yyyymmdd = (d: Date) =>
  [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
  ].join("");

/**
 * Fetch one full year of daily agroclimatological data for a point.
 * Uses the last 365 complete days ending yesterday.
 * Cached in memory for 6 h per rounded coordinate (the underlying window
 * only advances once per day, so repeat analyses hit the cache instead of
 * refetching a full year of daily records).
 */
export async function fetchNasaDaily(
  lat: number,
  lng: number
): Promise<{ daily: NasaDaily; periodStart: string; periodEnd: string }> {
  return getCached(cacheKey("daily", lat, lng), () =>
    fetchNasaDailyUncached(lat, lng)
  );
}

async function fetchNasaDailyUncached(
  lat: number,
  lng: number
): Promise<{ daily: NasaDaily; periodStart: string; periodEnd: string }> {
  const today = new Date();
  const end = new Date(today.getTime() - 24 * 3600 * 1000); // yesterday
  const start = new Date(end.getTime() - 364 * 24 * 3600 * 1000);

  const url =
    `${POWER_URL}?parameters=${NASA_PARAMETERS.join(",")}` +
    `&community=AG&longitude=${lng.toFixed(4)}&latitude=${lat.toFixed(4)}` +
    `&start=${yyyymmdd(start)}&end=${yyyymmdd(end)}&format=JSON`;

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(45_000),
        cache: "no-store",
      });
      if (!res.ok) {
        throw new NasaError(
          `NASA POWER responded with HTTP ${res.status}`,
          res.status === 404 || res.status === 400 ? 400 : 502
        );
      }
      const json = await res.json();
      const params = json?.properties?.parameter;
      if (!params || typeof params !== "object") {
        throw new NasaError("NASA POWER returned an unexpected response format");
      }
      const hd = json?.header as Record<string, unknown> | undefined;
      return {
        daily: {
          parameter: params as NasaDaily["parameter"],
          start: String(hd?.dateRanges?.[0]?.start ?? yyyymmdd(start)),
          end: String(hd?.dateRanges?.[0]?.end ?? yyyymmdd(end)),
        },
        periodStart: `${yyyymmdd(start).slice(0, 4)}-${yyyymmdd(start).slice(4, 6)}-${yyyymmdd(start).slice(6, 8)}`,
        periodEnd: `${yyyymmdd(end).slice(0, 4)}-${yyyymmdd(end).slice(4, 6)}-${yyyymmdd(end).slice(6, 8)}`,
      };
    } catch (err) {
      lastErr = err;
      if (err instanceof NasaError && err.status === 400) throw err; // do not retry bad requests
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
  console.error("[nasa] fetch failed:", lastErr);
  throw new NasaError("Could not retrieve data from NASA POWER. Please try again.");
}

const isFill = (v: number | null | undefined) =>
  v === null || v === undefined || v <= -900;

/** Aggregate daily records into a 12-month climatology (month-of-year buckets). */
export function aggregateMonthly(daily: NasaDaily): MonthlyValue[] {
  // monthIndex(0-11) -> param -> values
  const buckets: Record<number, Record<string, number[]>> = {};
  const dayCounts: Record<number, Set<string>> = {};

  for (const param of NASA_PARAMETERS) {
    const series = daily.parameter[param];
    if (!series) continue;
    for (const [dateKey, raw] of Object.entries(series)) {
      const month = parseInt(dateKey.slice(4, 6), 10); // 1-12
      if (!(month >= 1 && month <= 12)) continue;
      const value = typeof raw === "number" ? raw : Number(raw);
      if (isFill(value)) continue;
      if (!buckets[month]) buckets[month] = {};
      if (!buckets[month][param]) buckets[month][param] = [];
      buckets[month][param].push(value);
      if (!dayCounts[month]) dayCounts[month] = new Set();
      dayCounts[month].add(dateKey);
    }
  }

  // expected number of days per month index within the 365-day window
  const expected: Record<number, number> = {};
  const today = new Date();
  const end = new Date(today.getTime() - 24 * 3600 * 1000);
  const start = new Date(end.getTime() - 364 * 24 * 3600 * 1000);
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 24 * 3600 * 1000)) {
    const m = d.getUTCMonth() + 1;
    expected[m] = (expected[m] ?? 0) + 1;
  }

  const mean = (arr: number[] | undefined) =>
    arr && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const monthly: MonthlyValue[] = [];
  // NASA POWER returns ALLSKY_SFC_SW_DWN in MJ/m²/day; convert to kWh/m²/day (1 kWh = 3.6 MJ).
  const toKwh = (arr: number[] | undefined) =>
    arr ? arr.map((v) => v / 3.6) : undefined;
  for (let m = 1; m <= 12; m++) {
    const b = buckets[m] ?? {};
    const expDays = expected[m] ?? 30;
    const solarKwh = toKwh(b["ALLSKY_SFC_SW_DWN"]);
    monthly.push({
      month: m,
      t2m: mean(b["T2M"]),
      t2mMax: mean(b["T2M_MAX"]),
      t2mMin: mean(b["T2M_MIN"]),
      precip: b["PRECTOTCORR"]?.length
        ? b["PRECTOTCORR"].reduce((a, c) => a + c, 0)
        : null,
      rh2m: mean(b["RH2M"]),
      solar: mean(solarKwh),
      ws10m: mean(b["WS10M"]),
      coverage: expDays ? (dayCounts[m]?.size ?? 0) / expDays : 0,
    });
  }
  return monthly;
}

/** Annual / seasonal summary + extremes from daily and monthly data. */
export function summarize(
  daily: NasaDaily,
  monthly: MonthlyValue[]
): ClimateSummary {
  const valid = (p: NasaParameter) => {
    const out: number[] = [];
    for (const v of Object.values(daily.parameter[p] ?? {})) {
      const n = typeof v === "number" ? v : Number(v);
      if (!isFill(n)) out.push(n);
    }
    return out;
  };

  const t2mSeries = valid("T2M");
  const maxSeries = valid("T2M_MAX");
  const minSeries = valid("T2M_MIN");
  const rhSeries = valid("RH2M");
  // convert MJ/m²/day → kWh/m²/day
  const solarSeries = valid("ALLSKY_SFC_SW_DWN").map((v) => v / 3.6);
  const windSeries = valid("WS10M");
  const rainSeries = valid("PRECTOTCORR");

  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const tMonths = monthly.filter((m) => m.t2m !== null);
  let hottest = tMonths[0];
  let coldest = tMonths[0];
  for (const m of tMonths) {
    if ((m.t2m ?? -99) > (hottest?.t2m ?? -99)) hottest = m;
    if ((m.t2m ?? 99) < (coldest?.t2m ?? 99)) coldest = m;
  }
  const seasonMean = (months: number[]) => {
    const sel = monthly.filter((m) => months.includes(m.month) && m.t2m !== null);
    return sel.length
      ? sel.reduce((a, m) => a + (m.t2m as number), 0) / sel.length
      : null;
  };

  const totalDays = Object.values(daily.parameter["T2M"] ?? {}).length;

  return {
    annualRainfallMm: rainSeries.reduce((a, b) => a + b, 0),
    meanAnnualTempC: mean(t2mSeries) ?? 0,
    meanAnnualSolar: mean(solarSeries) ?? 0,
    meanAnnualRh: mean(rhSeries) ?? 0,
    meanAnnualWind: mean(windSeries) ?? 0,
    hottestMonth: hottest?.month ?? 7,
    hottestMonthMeanC: hottest?.t2m ?? 0,
    coldestMonth: coldest?.month ?? 1,
    coldestMonthMeanC: coldest?.t2m ?? 0,
    extremeMaxC: maxSeries.length ? Math.max(...maxSeries) : null,
    extremeMinC: minSeries.length ? Math.min(...minSeries) : null,
    hotSeasonMeanC: seasonMean([5, 6, 7, 8, 9]),
    coolSeasonMeanC: seasonMean([11, 12, 1, 2, 3]),
    coverageOverall: totalDays ? t2mSeries.length / totalDays : 0,
  };
}

export const NASA_UNITS: Record<string, string> = {
  T2M: "°C",
  T2M_MAX: "°C",
  T2M_MIN: "°C",
  PRECTOTCORR: "mm/day (monthly totals shown in mm)",
  RH2M: "%",
  ALLSKY_SFC_SW_DWN: "kWh/m²/day (NASA provides MJ/m²/day; 1 kWh = 3.6 MJ)",
  WS10M: "m/s",
};

/* ====================================================================
 * Multi-year climate history for the Smart Planting Time Advisor,
 * Smart Irrigation Advisor and Yield tool.
 *
 * Two complementary sources, both clearly labelled in the UI:
 *  1. The official NASA POWER *climatology* endpoint — 25-year monthly
 *     climatologies. NOTE: for T2M_MAX / T2M_MIN this endpoint reports
 *     the climatological monthly MAXIMUM / MINIMUM (typical extremes),
 *     not the mean of daily values.
 *  2. Several years of *daily* data (multi-year), aggregated by the app
 *     into month-of-year statistics — this provides the mean of daily
 *     maximum / minimum temperature per month and observed extremes.
 *
 * All results are cached in memory per rounded coordinate for 6 hours.
 * ==================================================================== */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry<unknown>>();
const TTL_MS = 6 * 3600 * 1000;

const cacheKey = (prefix: string, lat: number, lng: number, extra = "") =>
  `${prefix}:${lat.toFixed(2)},${lng.toFixed(2)}:${extra}`;

async function getCached<T>(
  key: string,
  loader: () => Promise<T>
): Promise<T> {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await loader();
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

const MONTH_KEYS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
] as const;

/**
 * NASA POWER climatology endpoint (25-year baseline, e.g. 2001-2025).
 * Returns monthly climatologies for all 7 parameters.
 * T2M_MAX/T2M_MIN here are the climatological monthly extremes.
 */
export async function fetchNasaClimatology(
  lat: number,
  lng: number
): Promise<ClimatologyInfo> {
  return getCached(
    cacheKey("clim", lat, lng),
    async (): Promise<ClimatologyInfo> => {
      const url =
        `${CLIMATOLOGY_URL}?parameters=${NASA_PARAMETERS.join(",")}` +
        `&community=AG&longitude=${lng.toFixed(4)}&latitude=${lat.toFixed(4)}` +
        `&format=JSON`;
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch(url, {
            headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
            signal: AbortSignal.timeout(45_000),
            cache: "no-store",
          });
          if (!res.ok)
            throw new NasaError(
              `NASA POWER climatology responded with HTTP ${res.status}`,
              res.status === 400 || res.status === 404 ? 400 : 502
            );
          const json = await res.json();
          const p = json?.properties?.parameter;
          if (!p || typeof p !== "object")
            throw new NasaError(
              "NASA POWER climatology returned an unexpected response format"
            );
          const num = (obj: Record<string, number>, key: string) => {
            const v = obj?.[key];
            return typeof v === "number" && !isFill(v) ? v : null;
          };
          const months: ClimatologyMonth[] = MONTH_KEYS.map((mk, i) => ({
            month: i + 1,
            t2mMean: num(p.T2M ?? {}, mk),
            precipMean: num(p.PRECTOTCORR ?? {}, mk),
            rhMean: num(p.RH2M ?? {}, mk),
            // NASA provides MJ/m²/day; convert to kWh/m²/day
            solarMean:
              num(p.ALLSKY_SFC_SW_DWN ?? {}, mk) === null
                ? null
                : (num(p.ALLSKY_SFC_SW_DWN ?? {}, mk) as number) / 3.6,
            windMean: num(p.WS10M ?? {}, mk),
            tMaxExtreme: num(p.T2M_MAX ?? {}, mk),
            tMinExtreme: num(p.T2M_MIN ?? {}, mk),
          }));
          const baseline: string =
            json?.header?.range ??
            "25-year NASA POWER climatological baseline";
          return {
            months,
            baseline,
            retrievedAt: new Date().toISOString(),
          };
        } catch (err) {
          lastErr = err;
          if (err instanceof NasaError && err.status === 400) throw err;
          await new Promise((r) => setTimeout(r, 1200));
        }
      }
      console.error("[nasa] climatology failed:", lastErr);
      throw new NasaError(
        "Could not retrieve the 25-year climatology from NASA POWER. Please try again."
      );
    }
  );
}

/**
 * Fetch `years` full years (plus the current partial year) of daily data
 * and aggregate month-of-year statistics. Provides the mean of daily
 * maximum/minimum temperature per month — which the climatology endpoint
 * does NOT provide (it returns extremes there).
 */
export async function fetchNasaMultiYearDaily(
  lat: number,
  lng: number,
  years = 3
): Promise<MultiYearInfo> {
  return getCached(
    cacheKey("multi", lat, lng, String(years)),
    async (): Promise<MultiYearInfo> => {
      const today = new Date();
      const end = new Date(today.getTime() - 24 * 3600 * 1000); // yesterday
      const start = new Date(end.getTime() - years * 365 * 24 * 3600 * 1000);
      const url =
        `${POWER_URL}?parameters=${NASA_PARAMETERS.join(",")}` +
        `&community=AG&longitude=${lng.toFixed(4)}&latitude=${lat.toFixed(4)}` +
        `&start=${yyyymmdd(start)}&end=${yyyymmdd(end)}&format=JSON`;
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch(url, {
            headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
            signal: AbortSignal.timeout(60_000),
            cache: "no-store",
          });
          if (!res.ok)
            throw new NasaError(
              `NASA POWER responded with HTTP ${res.status}`,
              res.status === 400 || res.status === 404 ? 400 : 502
            );
          const json = await res.json();
          const p = json?.properties?.parameter;
          if (!p || typeof p !== "object")
            throw new NasaError("Unexpected NASA POWER response format");

          // month index -> parameter -> values
          const buckets: Record<number, Record<string, number[]>> = {};
          for (const param of NASA_PARAMETERS) {
            const series = p[param];
            if (!series || typeof series !== "object") continue;
            for (const [dateKey, raw] of Object.entries(
              series as Record<string, unknown>
            )) {
              const month = parseInt(dateKey.slice(4, 6), 10);
              if (!(month >= 1 && month <= 12)) continue;
              const v = typeof raw === "number" ? raw : null;
              if (v === null || isFill(v)) continue;
              if (!buckets[month]) buckets[month] = {};
              if (!buckets[month][param]) buckets[month][param] = [];
              buckets[month][param].push(v);
            }
          }
          const mean = (a?: number[]) =>
            a && a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
          const months: MultiYearMonth[] = [];
          for (let m = 1; m <= 12; m++) {
            const b = buckets[m] ?? {};
            const solar = b["ALLSKY_SFC_SW_DWN"]?.map((v) => v / 3.6);
            months.push({
              month: m,
              t2mMean: mean(b["T2M"]),
              tMaxMean: mean(b["T2M_MAX"]),
              tMinMean: mean(b["T2M_MIN"]),
              tMaxObserved:
                b["T2M_MAX"]?.length ? Math.max(...b["T2M_MAX"]) : null,
              tMinObserved:
                b["T2M_MIN"]?.length ? Math.min(...b["T2M_MIN"]) : null,
              precipMean: b["PRECTOTCORR"]?.length
                ? b["PRECTOTCORR"].reduce((x, y) => x + y, 0) / years
                : null,
              rhMean: mean(b["RH2M"]),
              solarMean: mean(solar),
              windMean: mean(b["WS10M"]),
              tMaxExtreme: null,
              tMinExtreme: null,
              validDays: b["T2M"]?.length ?? 0,
            });
          }
          return {
            months,
            years,
            periodStart: isoDate(start),
            periodEnd: isoDate(end),
            retrievedAt: new Date().toISOString(),
          };
        } catch (err) {
          lastErr = err;
          if (err instanceof NasaError && err.status === 400) throw err;
          await new Promise((r) => setTimeout(r, 1200));
        }
      }
      console.error("[nasa] multi-year failed:", lastErr);
      throw new NasaError(
        "Could not retrieve multi-year data from NASA POWER. Please try again."
      );
    }
  );
}

/** Latest valid observation date across all requested parameters. */
export function latestObservationDate(
  daily: NasaDaily
): string | null {
  let latest: string | null = null;
  for (const param of NASA_PARAMETERS) {
    const series = daily.parameter[param];
    if (!series) continue;
    for (const [dateKey, raw] of Object.entries(series)) {
      const v = typeof raw === "number" ? raw : null;
      if (v === null || isFill(v)) continue;
      if (!latest || dateKey > latest) latest = dateKey;
    }
  }
  if (!latest) return null;
  return `${latest.slice(0, 4)}-${latest.slice(4, 6)}-${latest.slice(6, 8)}`;
}

/**
 * Recent daily observations (default last 60 days) summarised as
 * "current conditions" — real observations only, with the latest
 * available observation date reported to the user.
 */
export async function fetchNasaRecent(
  lat: number,
  lng: number,
  days = 60
): Promise<RecentConditions> {
  const { daily } = await fetchNasaDailyRange(lat, lng, days);
  const series = (param: NasaParameter) => {
    const out: number[] = [];
    for (const v of Object.values(daily.parameter[param] ?? {})) {
      const n = typeof v === "number" ? v : null;
      if (n === null || isFill(n)) continue;
      out.push(n);
    }
    return out;
  };
  const mean = (a: number[]) =>
    a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const t2m = series("T2M");
  const tmax = series("T2M_MAX");
  const tmin = series("T2M_MIN");
  const rh = series("RH2M");
  const solar = series("ALLSKY_SFC_SW_DWN").map((v) => v / 3.6);
  const wind = series("WS10M");
  const rain = series("PRECTOTCORR");

  const dates = Object.keys(daily.parameter["T2M"] ?? {}).sort();
  const periodStart = dates.length ? isoDate(dates[0]) : "";
  const periodEnd = dates.length ? isoDate(dates[dates.length - 1]) : "";
  const latest = latestObservationDate(daily) ?? periodEnd;

  return {
    latestObservationDate: latest,
    daysUsed: t2m.length,
    t2mMean: mean(t2m),
    tMaxMean: mean(tmax),
    tMinMean: mean(tmin),
    tMaxObserved: tmax.length ? Math.max(...tmax) : null,
    tMinObserved: tmin.length ? Math.min(...tmin) : null,
    rhMean: mean(rh),
    solarMean: mean(solar),
    windMean: mean(wind),
    rainTotal: rain.length ? rain.reduce((x, y) => x + y, 0) : null,
    periodStart,
    periodEnd,
  };
}

/** Fetch an arbitrary recent window of daily data (used by fetchNasaRecent). */
export async function fetchNasaDailyRange(
  lat: number,
  lng: number,
  days: number
): Promise<{ daily: NasaDaily; periodStart: string; periodEnd: string }> {
  const today = new Date();
  const end = new Date(today.getTime() - 24 * 3600 * 1000);
  const start = new Date(end.getTime() - (days - 1) * 24 * 3600 * 1000);
  const url =
    `${POWER_URL}?parameters=${NASA_PARAMETERS.join(",")}` +
    `&community=AG&longitude=${lng.toFixed(4)}&latitude=${lat.toFixed(4)}` +
    `&start=${yyyymmdd(start)}&end=${yyyymmdd(end)}&format=JSON`;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(45_000),
        cache: "no-store",
      });
      if (!res.ok)
        throw new NasaError(
          `NASA POWER responded with HTTP ${res.status}`,
          res.status === 400 || res.status === 404 ? 400 : 502
        );
      const json = await res.json();
      const p = json?.properties?.parameter;
      if (!p || typeof p !== "object")
        throw new NasaError("Unexpected NASA POWER response format");
      return {
        daily: { parameter: p as NasaDaily["parameter"], start: "", end: "" },
        periodStart: isoDate(start),
        periodEnd: isoDate(end),
      };
    } catch (err) {
      lastErr = err;
      if (err instanceof NasaError && err.status === 400) throw err;
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
  console.error("[nasa] recent range failed:", lastErr);
  throw new NasaError(
    "Could not retrieve recent observations from NASA POWER. Please try again."
  );
}

const isoDate = (d: Date | string) => {
  if (typeof d === "string") return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return `${yyyymmdd(d).slice(0, 4)}-${yyyymmdd(d).slice(4, 6)}-${yyyymmdd(d).slice(6, 8)}`;
};

export const NASA_PARAM_NAMES: Record<NasaParameter, { en: string; ar: string }> = {
  T2M: { en: "Average air temperature", ar: "متوسط درجة حرارة الهواء" },
  T2M_MAX: { en: "Maximum air temperature", ar: "الحرارة القصوى للهواء" },
  T2M_MIN: { en: "Minimum air temperature", ar: "الحرارة الدنيا للهواء" },
  PRECTOTCORR: { en: "Corrected precipitation", ar: "الهطول المصحح" },
  RH2M: { en: "Relative humidity", ar: "الرطوبة النسبية" },
  ALLSKY_SFC_SW_DWN: { en: "Solar radiation", ar: "الإشعاع الشمسي" },
  WS10M: { en: "Wind speed at 10 m", ar: "سرعة الرياح على ارتفاع 10 م" },
};
