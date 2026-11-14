/**
 * Smart Planting Time Advisor engine (server-side).
 *
 * Answers: "Plant now, or wait?" for a given crop + location.
 *
 * DATA BASIS (all real, all labelled):
 *  - 25-year NASA POWER climatology (monthly means; monthly extremes)
 *  - ~3 years of NASA POWER daily observations (mean daily max/min per month)
 *  - last ~60 days of NASA POWER daily observations ("current conditions")
 *  - optional 7-day Open-Meteo forecast (clearly marked as forecast)
 *  - documented crop requirements from the AgriWise crop database
 *    (FAO EcoCrop / FAO I&D 33 / FAO-56 / MALR references)
 *
 * METHOD:
 *  1. Every calendar month gets a 0–100 suitability score computed from
 *     the climatology against the crop's DOCUMENTED requirements
 *     (temperature envelope, daytime heat, night cold, solar, humidity,
 *     wind). Rainfall is reported but excluded from the score — in
 *     irrigated systems the planting WINDOW depends on thermal and
 *     light conditions, and water availability is a separate farmer
 *     input already handled by the crop recommendation engine.
 *  2. The growing-cycle experience is scored by averaging the monthly
 *     scores across the crop's documented duration starting at each
 *     month. Planting score = 0.4 × planting-month score + 0.6 ×
 *     cycle score.
 *  3. Seasons (Egyptian convention: winter Nov–Dec, spring Feb–Mar,
 *     summer May–Jun, autumn Sep–Oct) are assessed from their months —
 *     never from the crop name alone.
 *  4. The Plant Now / Wait / Not Recommended decision compares the
 *     CURRENT month's suitability with the coming months', adding
 *     imminent-stress checks from real recent observations and — when
 *     available — a real 7-day forecast.
 *
 * Thresholds (transparent methodology choices, shown in the UI):
 *   score ≥ 70 → suitable · 45–69 → caution · < 45 → unsuitable.
 */

import { CROPS, getCrop, type CropRecord } from "./crops";
import { rangeFit } from "./engine";
import { L, SEASON_PLANTING_MONTHS, type Bilingual, type Season } from "./types";
import type {
  ClimatologyInfo,
  MultiYearInfo,
  RecentConditions,
} from "./types";

/* ---------- crop search by free text (client + server) ---------- */

const ALIASES: Record<string, string[]> = {
  sugarcane: ["sugar cane", "cane", "قصب", "قصب السكر", "القصب", "sugarcanes"],
  wheat: ["قمح", "القمح", "قمح الخبز", "bread wheat", "wheats"],
  maize: ["corn", "ذرة", "الذرة", "corn crop", "maizes"],
  rice: ["أرز", "الارز", "الأرز", "أرز شعيرية", "paddy", "rices"],
  tomato: ["tomatoes", "طماطم", "الطماطم", "بندورة", "طماطيم", "tomatos"],
  potato: ["potatoes", "بطاطس", "البطاطس", "بطاطا", "potatos"],
  onion: ["onions", "بصل", "البصل", "بصلة", "oniones"],
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "") // Arabic diacritics + tatweel
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();

export function searchCrops(query: string): CropRecord[] {
  const q = normalize(query);
  if (!q) return [];
  const scored: { crop: CropRecord; rank: number }[] = [];
  for (const crop of CROPS) {
    const names = [
      crop.id,
      crop.name.en,
      crop.name.ar,
      ...(ALIASES[crop.id] ?? []),
    ].map(normalize);
    let rank = -1;
    for (const n of names) {
      if (n === q) rank = Math.max(rank, 3);
      else if (n.startsWith(q)) rank = Math.max(rank, 2);
      else if (q.length >= 3 && n.includes(q)) rank = Math.max(rank, 1);
    }
    if (rank > 0) scored.push({ crop, rank });
  }
  scored.sort((a, b) => b.rank - a.rank || a.crop.id.localeCompare(b.crop.id));
  return scored.map((s) => s.crop);
}

export function resolveCrop(query: string): CropRecord | null {
  const hits = searchCrops(query);
  return hits.length ? hits[0] : null;
}

/* ---------- scoring ---------- */

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Daytime heat: 100 at/below optimum; linear fall to 0 at absolute max. */
const dayHeatFit = (meanDailyMax: number, optMax: number, absMax: number) => {
  if (meanDailyMax <= optMax) return 100;
  if (meanDailyMax >= absMax) return 0;
  return clamp(((absMax - meanDailyMax) / (absMax - optMax)) * 100);
};

/** Night cold: 100 at/above optimum; linear fall to 0 at absolute min. */
const nightColdFit = (meanDailyMin: number, optMin: number, absMin: number) => {
  if (meanDailyMin >= optMin) return 100;
  if (meanDailyMin <= absMin) return 0;
  return clamp(((meanDailyMin - absMin) / (optMin - absMin)) * 100);
};

const solarFit = (solar: number, optMin: number, optMax: number) =>
  rangeFit(solar, optMin * 0.7, optMin, optMax, optMax * 1.35);

const humidityFit = (rh: number, optMin: number, optMax: number) =>
  rangeFit(rh, Math.max(0, optMin * 0.6), optMin, optMax, Math.min(100, optMax * 1.4));

const windFit = (wind: number, tolerance: number) => {
  if (wind <= tolerance) return 100;
  if (wind >= tolerance * 1.6) return 0;
  return clamp(((tolerance * 1.6 - wind) / (tolerance * 0.6)) * 100);
};

export type MonthClass = "suitable" | "caution" | "unsuitable";

export interface MonthValues {
  /** 25-yr mean monthly temperature, °C */
  t2mMean: number | null;
  /** 3-yr mean of daily maximum, °C */
  tMaxMean: number | null;
  /** 3-yr mean of daily minimum, °C */
  tMinMean: number | null;
  /** 25-yr climatological monthly maximum (typical hottest day), °C */
  tMaxExtreme: number | null;
  /** 25-yr climatological monthly minimum (typical coldest night), °C */
  tMinExtreme: number | null;
  /** 25-yr mean solar radiation, kWh/m²/day */
  solar: number | null;
  /** 25-yr mean relative humidity, % */
  rh: number | null;
  /** 25-yr mean wind, m/s */
  wind: number | null;
  /** 25-yr mean monthly precipitation, mm */
  precip: number | null;
}

export interface MonthScore {
  month: number;
  /** planting-window score 0-100 */
  score: number;
  /** cycle (growing-season) score 0-100 */
  cycleScore: number | null;
  /** combined planting score 0-100 */
  plantingScore: number;
  classification: MonthClass;
  factors: {
    temperature: number | null;
    dayHeat: number | null;
    nightCold: number | null;
    solar: number | null;
    humidity: number | null;
    wind: number | null;
  };
  values: MonthValues;
  /** documented rainfall contribution over the crop cycle, mm */
  cycleRainfallMm: number | null;
}

export interface SeasonAssessment {
  season: Season;
  months: number[];
  bestMonth: number | null;
  bestScore: number;
  classification: MonthClass;
}

export interface ForecastDayLite {
  date: string;
  tmax: number | null;
  tmin: number | null;
  precip: number | null;
  windMax: number | null;
}

export interface DecisionResult {
  value: "plant_now" | "wait" | "not_recommended";
  /** which data the decision is based on (bilingual, honest) */
  basis: Bilingual;
  reasons: Bilingual[];
  warnings: Bilingual[];
  /** when waiting: the recommended target month */
  targetMonth: number | null;
}

export interface PlantingResult {
  crop: {
    id: string;
    name: Bilingual;
    scientificName: string;
    variety?: string;
    /** documented reference info from the crop database */
    documented: {
      seasons: Season[];
      plantingMonths: number[];
      durationDays: [number, number];
      temp: CropRecord["temp"];
      water: CropRecord["water"];
      references: string[];
    };
  };
  location: { lat: number; lng: number; label: string };
  months: MonthScore[];
  seasons: SeasonAssessment[];
  computed: {
    recommendedSeason: Season | null;
    bestMonth: number | null;
    alternativeMonths: number[];
    cautionMonths: number[];
    unsuitableMonths: number[];
  };
  decision: DecisionResult;
  current: {
    month: number;
    recent: RecentConditions | null;
    forecast: {
      provider: string;
      days: ForecastDayLite[];
      retrievedAt: string;
    } | null;
    temperatureExplanation: Bilingual;
    rainfallExplanation: Bilingual;
    heatStress: Bilingual | null;
    coldStress: Bilingual | null;
  };
  methodology: Bilingual;
  meta: {
    climatology: ClimatologyInfo;
    multiYear: MultiYearInfo;
    generatedAt: string;
  };
}

/* ---------- helpers ---------- */

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const monthAfter = (m: number, k: number) => ((m - 1 + k) % 12) + 1;

const classify = (score: number): MonthClass =>
  score >= 70 ? "suitable" : score >= 45 ? "caution" : "unsuitable";

/* ---------- main engine ---------- */

export interface PlantingInput {
  crop: CropRecord;
  lat: number;
  lng: number;
  label: string;
  /** the farmer's current month, 1-12 (client local time) */
  currentMonth: number;
  variety?: string;
  climatology: ClimatologyInfo;
  multiYear: MultiYearInfo;
  recent: RecentConditions | null;
  forecast: ForecastDayLite[] | null;
  forecastProvider?: string;
  forecastRetrievedAt?: string;
}

export function runPlantingAdvisor(input: PlantingInput): PlantingResult {
  const { crop, climatology, multiYear } = input;

  // merge monthly data: 25-yr means + 3-yr daily max/min means
  const valuesByMonth = new Map<number, MonthValues>();
  for (const m of MONTHS) {
    const c = climatology.months.find((x) => x.month === m);
    const y = multiYear.months.find((x) => x.month === m);
    valuesByMonth.set(m, {
      t2mMean: c?.t2mMean ?? y?.t2mMean ?? null,
      tMaxMean: y?.tMaxMean ?? null,
      tMinMean: y?.tMinMean ?? null,
      tMaxExtreme: c?.tMaxExtreme ?? y?.tMaxObserved ?? null,
      tMinExtreme: c?.tMinExtreme ?? y?.tMinObserved ?? null,
      solar: c?.solarMean ?? y?.solarMean ?? null,
      rh: c?.rhMean ?? y?.rhMean ?? null,
      wind: c?.windMean ?? y?.windMean ?? null,
      precip: c?.precipMean ?? y?.precipMean ?? null,
    });
  }

  const duration =
    Math.round((crop.durationDays[0] + crop.durationDays[1]) / 2);
  const durationMonths = Math.max(1, Math.round(duration / 30));

  const factorScore = (m: number) => {
    const v = valuesByMonth.get(m)!;
    const temperature =
      v.t2mMean === null
        ? null
        : rangeFit(v.t2mMean, crop.temp.absMin, crop.temp.optMin, crop.temp.optMax, crop.temp.absMax);
    const dayHeat =
      v.tMaxMean === null
        ? null
        : dayHeatFit(v.tMaxMean, crop.temp.optMax, crop.temp.absMax);
    const nightCold =
      v.tMinMean === null
        ? null
        : nightColdFit(v.tMinMean, crop.temp.optMin, crop.temp.absMin);
    const solar =
      v.solar === null
        ? null
        : solarFit(v.solar, crop.solar.optMin, crop.solar.optMax);
    const humidity =
      v.rh === null
        ? null
        : humidityFit(v.rh, crop.humidity.optMin, crop.humidity.optMax);
    const wind =
      v.wind === null ? null : windFit(v.wind, crop.windTolerance);
    return { temperature, dayHeat, nightCold, solar, humidity, wind };
  };

  // weighted month score (weights sum to 1; rainfall excluded — see header)
  const W = { temperature: 0.35, dayHeat: 0.25, nightCold: 0.15, solar: 0.15, humidity: 0.05, wind: 0.05 };
  const monthScoreOf = (m: number): number | null => {
    const f = factorScore(m);
    const parts: [number, number | null][] = [
      [W.temperature, f.temperature],
      [W.dayHeat, f.dayHeat],
      [W.nightCold, f.nightCold],
      [W.solar, f.solar],
      [W.humidity, f.humidity],
      [W.wind, f.wind],
    ];
    let sum = 0;
    let wsum = 0;
    for (const [w, s] of parts) {
      if (s !== null) {
        sum += w * s;
        wsum += w;
      }
    }
    // renormalise over available factors
    return wsum >= 0.5 ? sum / wsum : null;
  };

  const rainOverCycle = (m: number): number | null => {
    let total = 0;
    let any = false;
    for (let k = 0; k < durationMonths; k++) {
      const p = valuesByMonth.get(monthAfter(m, k))?.precip ?? null;
      if (p !== null) {
        total += p;
        any = true;
      }
    }
    return any ? total : null;
  };

  const months: MonthScore[] = MONTHS.map((m) => {
    const f = factorScore(m);
    const score = monthScoreOf(m);
    // cycle score: mean month score across the documented duration
    const cycle: (number | null)[] = [];
    for (let k = 0; k < durationMonths; k++) {
      cycle.push(monthScoreOf(monthAfter(m, k)));
    }
    const validCycle = cycle.filter((c): c is number => c !== null);
    const cycleScore = validCycle.length
      ? validCycle.reduce((a, b) => a + b, 0) / validCycle.length
      : null;
    const plantingScore =
      score === null
        ? 0
        : cycleScore === null
          ? score
          : 0.4 * score + 0.6 * cycleScore;
    return {
      month: m,
      score: score === null ? 0 : round1(score),
      cycleScore: cycleScore === null ? null : round1(cycleScore),
      plantingScore: round1(plantingScore),
      classification: classify(plantingScore),
      factors: {
        temperature: f.temperature === null ? null : round1(f.temperature),
        dayHeat: f.dayHeat === null ? null : round1(f.dayHeat),
        nightCold: f.nightCold === null ? null : round1(f.nightCold),
        solar: f.solar === null ? null : round1(f.solar),
        humidity: f.humidity === null ? null : round1(f.humidity),
        wind: f.wind === null ? null : round1(f.wind),
      },
      values: valuesByMonth.get(m)!,
      cycleRainfallMm:
        rainOverCycle(m) === null ? null : round1(rainOverCycle(m)!),
    };
  });

  // season assessment — computed from climate, not from the crop name
  const seasons: SeasonAssessment[] = (Object.keys(SEASON_PLANTING_MONTHS) as Season[]).map(
    (season) => {
      const ms = SEASON_PLANTING_MONTHS[season];
      const scores = ms
        .map((m) => months[m - 1])
        .filter((row) => row.plantingScore !== undefined);
      const best = scores.reduce(
        (acc, cur) => (cur.plantingScore > acc.plantingScore ? cur : acc),
        scores[0]
      );
      return {
        season,
        months: ms,
        bestMonth: best ? best.month : null,
        bestScore: best ? best.plantingScore : 0,
        classification: best ? classify(best.plantingScore) : "unsuitable",
      };
    }
  );

  const rankedMonths = [...months].sort((a, b) => b.plantingScore - a.plantingScore);
  const best = rankedMonths[0];
  const suitableMonths = months.filter((m) => m.classification === "suitable");
  const cautionMonths = months.filter((m) => m.classification === "caution");
  const unsuitableMonths = months.filter((m) => m.classification === "unsuitable");

  // recommended season = best-scoring season whose best month is suitable
  const recommendedSeason =
    [...seasons]
      .sort((a, b) => b.bestScore - a.bestScore)[0]?.classification === "suitable"
      ? [...seasons].sort((a, b) => b.bestScore - a.bestScore)[0].season
      : null;

  /* ------- current-conditions explanations (real numbers) ------- */

  const cur = valuesByMonth.get(input.currentMonth)!;
  const curMonthRow = months[input.currentMonth - 1];

  const temperatureExplanation =
    cur.t2mMean === null
      ? L(
          "Temperature data for this month is unavailable from NASA POWER for this location.",
          "بيانات درجات الحرارة لهذا الشهر غير متاحة من NASA POWER لهذا الموقع."
        )
      : L(
          `The 25-year average temperature for month ${input.currentMonth} at this location is ${round1(cur.t2mMean)}°C; the documented optimum for ${crop.name.en} (${crop.scientificName}) is ${crop.temp.optMin}–${crop.temp.optMax}°C, with absolute limits ${crop.temp.absMin}°C to ${crop.temp.absMax}°C.`,
          `متوسط درجة الحرارة على مدى 25 عامًا لهذا الشهر في هذا الموقع هو ${round1(cur.t2mMean)}°م، والمدى الأمثل الموثق لـ${crop.name.ar} (${crop.scientificName}) هو ${crop.temp.optMin}–${crop.temp.optMax}°م، والحدود المطلقة من ${crop.temp.absMin} إلى ${crop.temp.absMax}°م.`
        );

  const annualRain = climatology.months.reduce(
    (a, m) => a + (m.precipMean ?? 0),
    0
  );
  const rainfallExplanation =
    L(
      `Rainfall here averages only ${round1(annualRain)} mm/year over 25 years (${round1(cur.precip ?? 0)} mm in the current month) — far below the documented seasonal need of ${crop.water.seasonNeedMm[0]}–${crop.water.seasonNeedMm[1]} mm. Farming at this location is irrigation-based: planting dates are governed by temperature, light and wind, and your irrigation water availability must cover the full requirement.`,
      `الهطل هنا يبلغ في المتوسط ${round1(annualRain)} مم/سنة فقط على مدى 25 عامًا (${round1(cur.precip ?? 0)} مم في الشهر الحالي) — أي أقل بكثير من الاحتياج الموسمي الموثق البالغ ${crop.water.seasonNeedMm[0]}–${crop.water.seasonNeedMm[1]} مم. الزراعة في هذا الموقع تعتمد على الري: مواعيد الزراعة تحكمها الحرارة والإضاءة والرياح، ويجب أن يغطي ماء الري لديك كامل الاحتياج.`
    );

  // heat stress: months where the typical day max is above the documented optimum
  const heatMonths = months.filter(
    (m) =>
      (m.values.tMaxMean ?? -99) > crop.temp.optMax ||
      (m.values.tMaxExtreme ?? -99) > crop.temp.absMax
  );
  const heatStress =
    heatMonths.length && heatMonths.some((m) => m.values.tMaxMean !== null)
      ? L(
          `Heat stress period: in ${heatMonths
            .map((m) => m.month)
            .sort((a, b) => a - b)
            .join(", ")} the mean daily maximum reaches ${round1(
            Math.max(...heatMonths.map((m) => m.values.tMaxMean ?? -99))
          )}°C and the typical hottest day about ${round1(
            Math.max(...heatMonths.map((m) => m.values.tMaxExtreme ?? -99))
          )}°C — beyond the documented optimum (${crop.temp.optMax}°C) and, on the hottest days, near or above the absolute limit (${crop.temp.absMax}°C). Avoid planting so that sensitive stages fall in these months.`,
          `فترة الإجهاد الحراري: في الأشهر ${heatMonths
            .map((m) => m.month)
            .sort((a, b) => a - b)
            .join(", ")} يبلغ متوسط الحرارة القصوى اليومية نحو ${round1(
            Math.max(...heatMonths.map((m) => m.values.tMaxMean ?? -99))
          )}°م وأعلى يوم نموذجي نحو ${round1(
            Math.max(...heatMonths.map((m) => m.values.tMaxExtreme ?? -99))
          )}°م — خارج المدى الأمثل الموثق (${crop.temp.optMax}°م) وقريب من الحد المطلق (${crop.temp.absMax}°م) أو فوقه في الأيام الأشد حرًا. تجنب أن تقع المراحل الحساسة في هذه الأشهر.`
        )
      : null;

  const coldMonths = months.filter(
    (m) =>
      (m.values.tMinMean ?? 99) < crop.temp.optMin ||
      (m.values.tMinExtreme ?? 99) < crop.temp.absMin
  );
  const coldStress =
    coldMonths.length
      ? L(
          `Cold stress period: in ${coldMonths
            .map((m) => m.month)
            .sort((a, b) => a - b)
            .join(", ")} the mean daily minimum falls to ${round1(
            Math.min(...coldMonths.map((m) => m.values.tMinMean ?? 99))
          )}°C and the typical coldest night to about ${round1(
            Math.min(...coldMonths.map((m) => m.values.tMinExtreme ?? 99))
          )}°C — below the documented optimum minimum (${crop.temp.optMin}°C)${" "}
          and potentially near the absolute limit (${crop.temp.absMin}°C).`,
          `فترة الإجهاد البارد: في الأشهر ${coldMonths
            .map((m) => m.month)
            .sort((a, b) => a - b)
            .join(", ")} ينخفض متوسط الحرارة الدنيا اليومية إلى نحو ${round1(
            Math.min(...coldMonths.map((m) => m.values.tMinMean ?? 99))
          )}°م وأبرد ليلة نموذجية إلى نحو ${round1(
            Math.min(...coldMonths.map((m) => m.values.tMinExtreme ?? 99))
          )}°م — دون الحد الأدنى الأمثل الموثق (${crop.temp.optMin}°م) وربما قريبًا من الحد المطلق (${crop.temp.absMin}°م).`
        )
      : null;

  /* ------- the decision ------- */

  const M = input.currentMonth;
  const nowScore = curMonthRow.plantingScore;
  const warnings: Bilingual[] = [];
  const reasons: Bilingual[] = [];

  // imminent stress from real recent observations
  if (input.recent) {
    if (
      input.recent.tMaxObserved !== null &&
      input.recent.tMaxObserved >= crop.temp.absMax
    ) {
      warnings.push(
        L(
          `Recent satellite observations show a daily maximum of ${round1(input.recent.tMaxObserved)}°C (data through ${input.recent.latestObservationDate}) — at/above the crop's documented absolute maximum of ${crop.temp.absMax}°C.`,
          `تُظهر مشاهدات الأقمار الصناعية الأخيرة حدًا يوميًا أقصى ${round1(input.recent.tMaxObserved)}°م (بيانات حتى ${input.recent.latestObservationDate}) — عند/فوق الحد الأقصى المطلق الموثق للمحصول (${crop.temp.absMax}°م).`
        )
      );
    }
    if (
      input.recent.tMinObserved !== null &&
      input.recent.tMinObserved <= crop.temp.absMin
    ) {
      warnings.push(
        L(
          `Recent observations show a daily minimum of ${round1(input.recent.tMinObserved)}°C — at/below the crop's documented absolute minimum of ${crop.temp.absMin}°C.`,
          `تُظهر المشاهدات الأخيرة حدًا يوميًا أدنى ${round1(input.recent.tMinObserved)}°م — عند/دون الحد الأدنى المطلق الموثق للمحصول (${crop.temp.absMin}°م).`
        )
      );
    }
  }

  // imminent stress from the real forecast (when available)
  let imminentForecastStress = false;
  if (input.forecast && input.forecast.length) {
    const hotDays = input.forecast.filter(
      (d) => d.tmax !== null && d.tmax >= crop.temp.absMax
    );
    const coldNights = input.forecast.filter(
      (d) => d.tmin !== null && d.tmin <= crop.temp.absMin
    );
    if (hotDays.length) {
      imminentForecastStress = true;
      warnings.push(
        L(
          `The 7-day forecast includes ${hotDays.length} day(s) reaching ${round1(Math.max(...hotDays.map((d) => d.tmax ?? -99)))}°C — at/above the crop's documented absolute maximum.`,
          `تشمل توقعات الأيام السبعة ${hotDays.length} يومًا تصل فيها الحرارة إلى ${round1(Math.max(...hotDays.map((d) => d.tmax ?? -99)))}°م — عند/فوق الحد الأقصى المطلق الموثق.`
        )
      );
    }
    if (coldNights.length) {
      imminentForecastStress = true;
      warnings.push(
        L(
          `The 7-day forecast includes ${coldNights.length} night(s) falling to ${round1(Math.min(...coldNights.map((d) => d.tmin ?? 99)))}°C — at/below the crop's documented absolute minimum.`,
          `تشمل توقعات الأيام السبعة ${coldNights.length} ليلة تنخفض فيها الحرارة إلى ${round1(Math.min(...coldNights.map((d) => d.tmin ?? 99)))}°م — عند/دون الحد الأدنى المطلق الموثق.`
        )
      );
    }
  }

  // next suitable month (searching forward from the month after current)
  let targetMonth: number | null = null;
  for (let k = 1; k <= 12; k++) {
    const m = monthAfter(M, k);
    if (months[m - 1].classification === "suitable") {
      targetMonth = m;
      break;
    }
  }

  const basisHistorical = L(
    "Based on a 25-year NASA POWER climatology for this location, ~3 years of daily observations and the documented crop requirements (FAO / Egyptian extension references).",
    "يعتمد على مناخ 25 عامًا من NASA POWER لهذا الموقع، ونحو 3 أعوام من المشاهدات اليومية، والاشتراطات الموثقة للمحصول (مراجع FAO والإرشاد المصري)."
  );
  const basisWithObs = L(
    "Based on the 25-year NASA POWER climatology, recent satellite observations (last ~60 days) and the documented crop requirements. The 7-day weather forecast was also checked (Open-Meteo).",
    "يعتمد على مناخ 25 عامًا من NASA POWER، والمشاهدات الفضائية الأخيرة (آخر 60 يومًا تقريبًا)، والاشتراطات الموثقة للمحصول، مع فحص توقعات الطقس لسبعة أيام (Open-Meteo)."
  );
  const obsNote = input.recent
    ? ` Latest NASA POWER observation available: ${input.recent.latestObservationDate}.`
    : "";

  let decision: DecisionResult;
  if (nowScore >= 70 && !imminentForecastStress) {
    decision = {
      value: "plant_now",
      basis: L(
        `The current month scores ${round1(nowScore)}/100 for planting suitability. ` +
          (input.forecast ? basisWithObs.en : basisHistorical.en) + obsNote,
        `الشهر الحالي يحصل على ${round1(nowScore)}/100 لملاءمة الزراعة. ` +
          (input.forecast ? basisWithObs.ar : basisHistorical.ar) + obsNote
      ),
      reasons: [
        L(
          `Month ${M} conditions sit inside the crop's documented temperature, radiation and humidity ranges at this location.`,
          `ظروف الشهر ${M} تقع داخل المداقات الموثقة للحرارة والإشعاع والرطوبة لهذا المحصول في هذا الموقع.`
        ),
      ],
      warnings,
      targetMonth: null,
    };
  } else if (nowScore >= 70 && imminentForecastStress) {
    decision = {
      value: "wait",
      basis: L(
        `The month is generally suitable (${round1(nowScore)}/100) but imminent extreme temperatures appear in the forecast; waiting a few days for the event to pass is safer.` +
          (input.forecast ? "" : "") + obsNote,
        `الشهر مناسب عمومًا (${round1(nowScore)}/100) لكن تظهر درجات حرارة قاسية وشيكة في التوقعات؛ الانتظار أيامًا حتى مرورها أكثر أمانًا.` + obsNote
      ),
      reasons: [
        L(
          "Planting immediately before a documented-limit heat or cold event risks crop failure at establishment.",
          "الزراعة مباشرة قبل موجة حرارة أو برد عند الحدود الموثقة تعرّض المحصول لخطر الفشل عند الإنشاء."
        ),
      ],
      warnings,
      targetMonth,
    };
  } else if (targetMonth !== null) {
    const tm = months[targetMonth - 1];
    const monthsAway = (targetMonth - M + 12) % 12 || 12;
    decision = {
      value: "wait",
      basis: L(
        `Current month scores ${round1(nowScore)}/100 (below the 70 suitability threshold); a better window opens in month ${targetMonth} (${round1(tm.plantingScore)}/100), about ${monthsAway} month(s) away. ` +
          basisHistorical.en + obsNote,
        `الشهر الحالي يحصل على ${round1(nowScore)}/100 (دون حد الملاءمة 70)؛ ويفتح نافذة أفضل في الشهر ${targetMonth} (${round1(tm.plantingScore)}/100)، أي بعد نحو ${monthsAway} شهر. ` +
          basisHistorical.ar + obsNote
      ),
      reasons: [
        L(
          `Month ${M}'s temperature pattern (mean ${round1(cur.t2mMean ?? NaN)}°C, mean daily max ${round1(cur.tMaxMean ?? NaN)}°C) falls outside the crop's documented optimum of ${crop.temp.optMin}–${crop.temp.optMax}°C.`,
          `نمط حرارة الشهر ${M} (متوسط ${round1(cur.t2mMean ?? NaN)}°م، متوسط الأقصى اليومي ${round1(cur.tMaxMean ?? NaN)}°م) يقع خارج المدى الأمثل الموثق ${crop.temp.optMin}–${crop.temp.optMax}°م.`
        ),
      ],
      warnings,
      targetMonth,
    };
  } else {
    // no suitable month at all
    decision = {
      value: "not_recommended",
      basis: L(
        `No month at this location reaches the 70 suitability threshold for the documented requirements of this crop; the best month scores ${round1(best.plantingScore)}/100. ` +
          basisHistorical.en,
        `لا يصل أي شهر في هذا الموقع إلى حد الملاءمة 70 وفق الاشتراطات الموثقة لهذا المحصول؛ أفضل شهر يحصل على ${round1(best.plantingScore)}/100. ` +
          basisHistorical.ar
      ),
      reasons: [
        L(
          `The crop's documented requirements (${crop.temp.optMin}–${crop.temp.optMax}°C optimum) do not fit this location's climate pattern for any planting month.`,
          `الاشتراطات الموثقة للمحصول (المدى الأمثل ${crop.temp.optMin}–${crop.temp.optMax}°م) لا تتوافق مع النمط المناخي لهذا الموقع في أي شهر زراعة.`
        ),
      ],
      warnings,
      targetMonth: null,
    };
  }

  const methodology = L(
    `Each month is scored 0–100 against the crop's documented requirements using the 25-year climatology (temperature 35%, daytime heat from multi-year mean daily maxima 25%, night cold 15%, solar radiation 15%, humidity 5%, wind 5%). The planting score blends the planting-month score (40%) with the growing-cycle score (60%) over the documented duration of ${duration} days. ≥70 suitable, 45–69 caution, <45 unsuitable. Rainfall is reported but excluded from the score — this is an irrigated system and water availability is captured separately.`,
    `يقيَّم كل شهر من 0 إلى 100 مقابل الاشتراطات الموثقة للمحصول باستخدام مناخ 25 عامًا (الحرارة 35%، حرارة النهار من متوسطات القصوى اليومية لعدة أعوام 25%، برد الليل 15%، الإشعاع الشمسي 15%، الرطوبة 5%، الرياح 5%). ثم يمزج تقدير الزراعة بين درجة شهر الزراعة (40%) ودرجة دورة النمو (60%) على مدى المدة الموثقة ${duration} يومًا. ≥70 مناسب، 45–69 حذر، <45 غير مناسب. يُعرض الهطل دون إدراجه في التقدير — فهذا نظام ريّ، وتوافر الماء يُقيَّم منفصلًا.`
  );

  return {
    crop: {
      id: crop.id,
      name: crop.name,
      scientificName: crop.scientificName,
      variety: input.variety,
      documented: {
        seasons: crop.seasons,
        plantingMonths: crop.plantingMonths,
        durationDays: crop.durationDays,
        temp: crop.temp,
        water: crop.water,
        references: crop.references,
      },
    },
    location: { lat: input.lat, lng: input.lng, label: input.label },
    months,
    seasons,
    computed: {
      recommendedSeason,
      bestMonth: best.plantingScore >= 45 ? best.month : null,
      alternativeMonths: suitableMonths
        .map((m) => m.month)
        .filter((m) => m !== (best.plantingScore >= 45 ? best.month : -1)),
      cautionMonths: cautionMonths.map((m) => m.month),
      unsuitableMonths: unsuitableMonths.map((m) => m.month),
    },
    decision,
    current: {
      month: M,
      recent: input.recent,
      forecast:
        input.forecast && input.forecast.length
          ? {
              provider: input.forecastProvider ?? "Open-Meteo",
              days: input.forecast,
              retrievedAt: input.forecastRetrievedAt ?? new Date().toISOString(),
            }
          : null,
      temperatureExplanation,
      rainfallExplanation,
      heatStress,
      coldStress,
    },
    methodology,
    meta: {
      climatology,
      multiYear,
      generatedAt: new Date().toISOString(),
    },
  };
}

export { getCrop };
