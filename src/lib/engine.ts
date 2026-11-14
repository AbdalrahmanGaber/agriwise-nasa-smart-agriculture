/**
 * AgriWise crop suitability engine.
 *
 * Transparent weighted scoring (0-100 per crop):
 *   temperature 30 · water 20 · solar 15 · soil 15 · season 10 · humidity 5 · wind 5
 *
 * Every factor produces an explainable, bilingual justification built from the
 * actual NASA monthly climatology and the farmer's own inputs. When a factor's
 * data is unavailable (e.g. soil type "unknown" or a missing NASA parameter),
 * the factor is marked unavailable, its weight is redistributed across the
 * remaining factors, and the analysis confidence is lowered — no value is ever
 * assumed. Scores are decision support only; they do not guarantee yield or
 * profitability.
 */

import { CROPS, type CropRecord } from "./crops";
import {
  FACTOR_LABELS,
  SEASON_LABELS,
  SOIL_LABELS,
  WATER_LABELS,
} from "./labels";
import {
  L,
  MONTHS_AR,
  MONTHS_EN,
  SEASON_PLANTING_MONTHS,
  type Bilingual,
  type CropResult,
  type EngineInfo,
  type FactorKey,
  type FactorScore,
  type FarmInput,
  type MonthlyValue,
  type ClimateSummary,
} from "./types";

/* ---------------- helpers ---------------- */

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Piecewise suitability: 0 at/beyond absolute limits, 100 inside the optimum,
 * linear ramps between limit and optimum (10 pts at the absolute limit).
 */
export function rangeFit(
  v: number,
  absMin: number,
  optMin: number,
  optMax: number,
  absMax: number
): number {
  if (v <= absMin || v >= absMax) return 0;
  if (v < optMin) return 10 + (90 * (v - absMin)) / (optMin - absMin);
  if (v > optMax) return 100 - (90 * (v - optMax)) / (absMax - optMax);
  return 100;
}

const monthRangeLabel = (months: number[]): Bilingual => {
  if (months.length === 0) return L("the growing window", "فترة النمو");
  const fmt = (m: number) => MONTHS_EN[m - 1];
  const fmtAr = (m: number) => MONTHS_AR[m - 1];
  const start = months[0];
  const end = months[months.length - 1];
  if (months.length === 1) return L(fmt(start), fmtAr(start));
  return L(`${fmt(start)}–${fmt(end)}`, `${fmtAr(start)}–${fmtAr(end)}`);
};

const BASE_WEIGHTS: Record<FactorKey, number> = {
  temperature: 30,
  water: 20,
  solar: 15,
  soil: 15,
  season: 10,
  humidity: 5,
  wind: 5,
};

const FACTOR_ORDER: FactorKey[] = [
  "temperature",
  "water",
  "solar",
  "soil",
  "season",
  "humidity",
  "wind",
];

/* ---------------- window selection ---------------- */

/** Growing window: planting month inside the farmer's season when possible,
 *  otherwise the crop's primary documented planting month. */
function pickWindow(
  crop: CropRecord,
  userSeason: FarmInput["season"]
): { startMonth: number; months: number[] } {
  const seasonMonths = SEASON_PLANTING_MONTHS[userSeason];
  const inSeason = crop.plantingMonths.find((m) => seasonMonths.includes(m));
  const start = inSeason ?? crop.plantingMonths[0];
  const midDuration =
    (crop.durationDays[0] + crop.durationDays[1]) / 2;
  const len = Math.max(2, Math.round(midDuration / 30));
  const months = Array.from(
    { length: len },
    (_, i) => ((start - 1 + i) % 12) + 1
  );
  return { startMonth: start, months };
}

/* ---------------- factor scorers ---------------- */

interface Ctx {
  monthly: MonthlyValue[];
  farm: FarmInput;
}

function windowMean(
  monthly: MonthlyValue[],
  months: number[],
  key: "t2m" | "t2mMax" | "t2mMin" | "rh2m" | "solar" | "ws10m"
): number | null {
  const vals = months
    .map((m) => monthly[m - 1]?.[key])
    .filter((v): v is number => v !== null && v !== undefined);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function windowRain(monthly: MonthlyValue[], months: number[]): number | null {
  const vals = months
    .map((m) => monthly[m - 1]?.precip)
    .filter((v): v is number => v !== null && v !== undefined);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0);
}

function scoreTemperature(
  ctx: Ctx,
  crop: CropRecord,
  months: number[]
): FactorScore {
  const range = monthRangeLabel(months);
  const reasons: Bilingual[] = [];
  const limitations: Bilingual[] = [];

  const meanT = windowMean(ctx.monthly, months, "t2m");
  if (meanT === null) {
    return {
      key: "temperature",
      weight: BASE_WEIGHTS.temperature,
      effectiveWeight: BASE_WEIGHTS.temperature,
      score: null,
      status: "unavailable",
      reasons: [],
      limitations: [
        L(
          "NASA POWER temperature data unavailable for this location/period.",
          "بيانات درجات الحرارة من NASA POWER غير متاحة لهذا الموقع/الفترة."
        ),
      ],
    };
  }

  const fits = months.map((m) => {
    const t = ctx.monthly[m - 1]?.t2m;
    return t === null || t === undefined
      ? null
      : rangeFit(t, crop.temp.absMin, crop.temp.optMin, crop.temp.optMax, crop.temp.absMax);
  });
  const validFits = fits.filter((f): f is number => f !== null);
  const meanFit = validFits.length
    ? validFits.reduce((a, b) => a + b, 0) / validFits.length
    : 0;

  // heat & cold stress from monthly mean maxima/minima
  // 5 penalty points per °C beyond the tolerance, per affected month
  let heatPenalty = 0;
  let coldPenalty = 0;
  for (const m of months) {
    const mv = ctx.monthly[m - 1];
    if (!mv) continue;
    if (mv.t2mMax !== null && mv.t2mMax > crop.temp.absMax) {
      heatPenalty += (mv.t2mMax - crop.temp.absMax) * 5;
      limitations.push(
        L(
          `Daytime maxima in ${MONTHS_EN[m - 1]} average ${round1(mv.t2mMax)}°C, above the ${crop.temp.absMax}°C tolerance limit — heat stress expected.`,
          `متوسط الحرارة القصوى نهارًا في ${MONTHS_AR[m - 1]} ${round1(mv.t2mMax)}°م، أعلى من حد التحمل ${crop.temp.absMax}°م — يُتوقع إجهاد حراري.`
        )
      );
    }
    if (mv.t2mMin !== null && mv.t2mMin < crop.temp.absMin) {
      coldPenalty += (crop.temp.absMin - mv.t2mMin) * 5;
      limitations.push(
        L(
          `Night minima in ${MONTHS_EN[m - 1]} average ${round1(mv.t2mMin)}°C, below the ${crop.temp.absMin}°C minimum — cold stress expected.`,
          `متوسط الحرارة الدنيا ليلًا في ${MONTHS_AR[m - 1]} ${round1(mv.t2mMin)}°م، أقل من الحد الأدنى ${crop.temp.absMin}°م — يُتوقع إجهاد بارد.`
        )
      );
    }
  }

  const score = clamp(meanFit - heatPenalty - coldPenalty);

  if (meanT >= crop.temp.optMin && meanT <= crop.temp.optMax) {
    reasons.push(
      L(
        `Mean temperature during ${range.en} is ${round1(meanT)}°C — inside the documented optimum of ${crop.temp.optMin}–${crop.temp.optMax}°C.`,
        `متوسط الحرارة خلال ${range.ar} هو ${round1(meanT)}°م — داخل المدى الأمثل الموثق ${crop.temp.optMin}–${crop.temp.optMax}°م.`
      )
    );
  } else if (meanT > crop.temp.optMax && meanT < crop.temp.absMax) {
    reasons.push(
      L(
        `Mean temperature during ${range.en} is ${round1(meanT)}°C — above the ${crop.temp.optMin}–${crop.temp.optMax}°C optimum but within tolerance.`,
        `متوسط الحرارة خلال ${range.ar} هو ${round1(meanT)}°م — أعلى من المدى الأمثل ${crop.temp.optMin}–${crop.temp.optMax}°م لكنه داخل حد التحمل.`
      )
    );
    limitations.push(
      L(
        `Temperatures run warmer than the documented optimum for most of the window.`,
        `الحرارة أعلى من المدى الأمثل الموثق خلال معظم الفترة.`
      )
    );
  } else if (meanT < crop.temp.optMin && meanT > crop.temp.absMin) {
    reasons.push(
      L(
        `Mean temperature during ${range.en} is ${round1(meanT)}°C — below the ${crop.temp.optMin}–${crop.temp.optMax}°C optimum but within tolerance.`,
        `متوسط الحرارة خلال ${range.ar} هو ${round1(meanT)}°م — أقل من المدى الأمثل ${crop.temp.optMin}–${crop.temp.optMax}°م لكنه داخل حد التحمل.`
      )
    );
    limitations.push(
      L(
        `Temperatures run cooler than the documented optimum for most of the window.`,
        `الحرارة أقل من المدى الأمثل الموثق خلال معظم الفترة.`
      )
    );
  } else {
    limitations.push(
      L(
        `Mean temperature during ${range.en} (${round1(meanT)}°C) is outside the crop's documented tolerance range of ${crop.temp.absMin}–${crop.temp.absMax}°C.`,
        `متوسط الحرارة خلال ${range.ar} (${round1(meanT)}°م) خارج مدى التحمل الموثق للمحصول ${crop.temp.absMin}–${crop.temp.absMax}°م.`
      )
    );
  }

  return {
    key: "temperature",
    weight: BASE_WEIGHTS.temperature,
    effectiveWeight: BASE_WEIGHTS.temperature,
    score,
    status: heatPenalty + coldPenalty > 15 ? "limited" : "ok",
    reasons,
    limitations,
  };
}

const WATER_SUPPLY: Record<
  CropRecord["water"]["category"],
  Record<FarmInput["waterAvailability"], number>
> = {
  low: { limited: 70, moderate: 95, abundant: 100 },
  medium: { limited: 45, moderate: 80, abundant: 100 },
  high: { limited: 25, moderate: 60, abundant: 95 },
  "very-high": { limited: 10, moderate: 40, abundant: 85 },
};

function scoreWater(
  ctx: Ctx,
  crop: CropRecord,
  months: number[]
): { factor: FactorScore; gap: number | null } {
  const reasons: Bilingual[] = [];
  const limitations: Bilingual[] = [];
  const [needMin, needMax] = crop.water.seasonNeedMm;
  const needMid = (needMin + needMax) / 2;
  const rain = windowRain(ctx.monthly, months);
  const effRain = rain === null ? 0 : rain;
  const gap = Math.max(0, needMid - effRain);
  const waterLabel = WATER_LABELS[ctx.farm.waterAvailability];

  reasons.push(
    L(
      `Documented seasonal water requirement: ${needMin}–${needMax} mm per cycle.`,
      `الاحتياج المائي الموسمي الموثق: ${needMin}–${needMax} مم لكل دورة.`
    )
  );

  if (rain !== null) {
    reasons.push(
      L(
        `Local rainfall during the growing window contributes only about ${round1(effRain)} mm; irrigation must supply the remaining ≈${Math.round(gap)} mm.`,
        `أمطار المنطقة خلال فترة النمو تسهم بنحو ${round1(effRain)} مم فقط؛ وعلى الري تأمين الباقي ≈${Math.round(gap)} مم.`
      )
    );
  } else {
    reasons.push(
      L(
        "NASA rainfall data unavailable for this window; irrigation requirement estimated from crop needs only.",
        "بيانات الأمطار غير متاحة لهذه الفترة؛ قُدِّر الاحتياج من الري وفق احتياج المحصول فقط."
      )
    );
  }

  const supply = WATER_SUPPLY[crop.water.category][ctx.farm.waterAvailability];
  const rainBonus = rain === null ? 0 : Math.min(10, effRain / 20);
  const score = clamp(supply + rainBonus);

  if (ctx.farm.waterAvailability === "abundant") {
    reasons.push(
      L(
        `Your reported water availability (${waterLabel.en}) can cover this crop's demand.`,
        `توفر المياه الذي ذكرته (${waterLabel.ar}) يمكنه تغطية احتياج هذا المحصول.`
      )
    );
  } else if (ctx.farm.waterAvailability === "moderate") {
    if (crop.water.category === "high" || crop.water.category === "very-high") {
      limitations.push(
        L(
          `Moderate water availability is tight for a ${crop.water.category === "very-high" ? "very-high" : "high"} requirement crop — plan irrigation carefully.`,
          `التوفر المتوسط للمياه ضيّق لمحصول ذي احتياج ${crop.water.category === "very-high" ? "مرتفع جدًا" : "مرتفع"} — خطّط للري بعناية.`
        )
      );
    } else {
      reasons.push(
        L(
          `Your reported water availability (${waterLabel.en}) is adequate for this requirement level.`,
          `توفر المياه الذي ذكرته (${waterLabel.ar}) كافٍ لمستوى هذا الاحتياج.`
        )
      );
    }
  } else {
    limitations.push(
      L(
        `Limited water availability is a major constraint for this crop (documented need ${needMin}–${needMax} mm).`,
        `محدودية المياه قيد رئيسي لهذا المحصول (الاحتياج الموثق ${needMin}–${needMax} مم).`
      )
    );
  }

  return {
    factor: {
      key: "water",
      weight: BASE_WEIGHTS.water,
      effectiveWeight: BASE_WEIGHTS.water,
      score,
      status: score < 45 ? "limited" : "ok",
      reasons,
      limitations,
    },
    gap: rain === null ? null : gap,
  };
}

function scoreSolar(
  ctx: Ctx,
  crop: CropRecord,
  months: number[]
): FactorScore {
  const reasons: Bilingual[] = [];
  const limitations: Bilingual[] = [];
  const s = windowMean(ctx.monthly, months, "solar");
  if (s === null) {
    return {
      key: "solar",
      weight: BASE_WEIGHTS.solar,
      effectiveWeight: BASE_WEIGHTS.solar,
      score: null,
      status: "unavailable",
      reasons: [],
      limitations: [
        L(
          "NASA solar radiation data unavailable for this location/period.",
          "بيانات الإشعاع الشمسي من NASA POWER غير متاحة لهذا الموقع/الفترة."
        ),
      ],
    };
  }
  const absMin = crop.solar.optMin - 2;
  const absMax = crop.solar.optMax + 2;
  const score = clamp(rangeFit(s, absMin, crop.solar.optMin, crop.solar.optMax, absMax));
  if (s >= crop.solar.optMin && s <= crop.solar.optMax) {
    reasons.push(
      L(
        `Average solar radiation of ${round1(s)} kWh/m²/day during the window is inside the documented optimum of ${crop.solar.optMin}–${crop.solar.optMax}.`,
        `متوسط الإشعاع الشمسي ${round1(s)} كيلوواط·س/م²/يوم خلال الفترة داخل المدى الأمثل الموثق ${crop.solar.optMin}–${crop.solar.optMax}.`
      )
    );
  } else if (s < crop.solar.optMin) {
    limitations.push(
      L(
        `Average solar radiation of ${round1(s)} kWh/m²/day is below the documented optimum of ${crop.solar.optMin}–${crop.solar.optMax}.`,
        `متوسط الإشعاع الشمسي ${round1(s)} كيلوواط·س/م²/يوم أقل من المدى الأمثل الموثق ${crop.solar.optMin}–${crop.solar.optMax}.`
      )
    );
  } else {
    limitations.push(
      L(
        `Average solar radiation of ${round1(s)} kWh/m²/day exceeds the documented optimum of ${crop.solar.optMin}–${crop.solar.optMax} (higher evaporation and heat load).`,
        `متوسط الإشعاع الشمسي ${round1(s)} كيلوواط·س/م²/يوم أعلى من المدى الأمثل الموثق ${crop.solar.optMin}–${crop.solar.optMax} (تبخّر وحِمل حراري أعلى).`
      )
    );
  }
  return {
    key: "solar",
    weight: BASE_WEIGHTS.solar,
    effectiveWeight: BASE_WEIGHTS.solar,
    score,
    status: "ok",
    reasons,
    limitations,
  };
}

function scoreSoil(ctx: Ctx, crop: CropRecord): FactorScore {
  const soil = ctx.farm.soilType;
  const label = SOIL_LABELS[soil];
  if (soil === "unknown") {
    return {
      key: "soil",
      weight: BASE_WEIGHTS.soil,
      effectiveWeight: BASE_WEIGHTS.soil,
      score: null,
      status: "unavailable",
      reasons: [],
      limitations: [
        L(
          "Soil type was not provided — this factor is excluded and its weight redistributed. The final score is less certain.",
          "لم يُحدَّد نوع التربة — استُبعد هذا العامل وأُعيد توزيع وزنه، فدرجة الملاءمة النهائية أقل يقينًا."
        ),
      ],
    };
  }
  const match =
    soil === "other" ? 50 : (crop.soil[soil as "clay" | "sandy" | "loam"] ?? 40);
  const reasons: Bilingual[] = [];
  const limitations: Bilingual[] = [];
  if (soil === "other") {
    limitations.push(
      L(
        "Soil reported as “other”: a generic compatibility of 50/100 is assumed — verify with your local agricultural extension office.",
        "التربة المُبلغ عنها «أخرى»: افترضنا ملاءمة عامة 50/100 — يُرجى التحقق من مكتب الإرشاد الزراعي المحلي."
      )
    );
  } else if (match >= 85) {
    reasons.push(
      L(
        `${label.en} matches the crop's documented soil preference well (${match}/100).`,
        `${label.ar} تناسب تمامًا تفضيل التربة الموثق للمحصول (${match}/100).`
      )
    );
  } else if (match >= 60) {
    reasons.push(
      L(
        `${label.en} is acceptable for this crop (${match}/100 compatibility).`,
        `${label.ar} مقبولة لهذا المحصول (ملاءمة ${match}/100).`
      )
    );
  } else {
    limitations.push(
      L(
        `${label.en} is a weak match for this crop (${match}/100).`,
        `${label.ar} ملاءمة ضعيفة لهذا المحصول (${match}/100).`
      )
    );
  }
  reasons.push(crop.soilNote);
  return {
    key: "soil",
    weight: BASE_WEIGHTS.soil,
    effectiveWeight: BASE_WEIGHTS.soil,
    score: match,
    status: match < 60 ? "limited" : "ok",
    reasons,
    limitations,
  };
}

function scoreSeason(ctx: Ctx, crop: CropRecord): FactorScore {
  const userSeason = ctx.farm.season;
  const seasonLabel = SEASON_LABELS[userSeason];
  const planting = crop.plantingMonths;
  const plantingLabel = L(
    planting.map((m) => MONTHS_EN[m - 1]).join(", "),
    planting.map((m) => MONTHS_AR[m - 1]).join("، ")
  );
  const match = crop.seasons.includes(userSeason);
  if (match) {
    return {
      key: "season",
      weight: BASE_WEIGHTS.season,
      effectiveWeight: BASE_WEIGHTS.season,
      score: 100,
      status: "ok",
      reasons: [
        L(
          `Your ${seasonLabel.en} planting season matches the documented Egyptian calendar for this crop (${plantingLabel.en}).`,
          `موسم الزراعة ${seasonLabel.ar} الذي اخترته يطابق التقويم المصري الموثق لهذا المحصول (${plantingLabel.ar}).`
        ),
      ],
      limitations: [],
    };
  }
  return {
    key: "season",
    weight: BASE_WEIGHTS.season,
    effectiveWeight: BASE_WEIGHTS.season,
    score: 25,
    status: "limited",
    reasons: [],
    limitations: [
      L(
        `You selected the ${seasonLabel.en} season, but this crop is planted in ${plantingLabel.en} in Egypt.`,
        `اخترت الموسم ${seasonLabel.ar}، بينما يُزرع هذا المحصول في ${plantingLabel.ar} في مصر.`
      ),
    ],
  };
}

function scoreHumidity(
  ctx: Ctx,
  crop: CropRecord,
  months: number[]
): FactorScore {
  const rh = windowMean(ctx.monthly, months, "rh2m");
  if (rh === null) {
    return {
      key: "humidity",
      weight: BASE_WEIGHTS.humidity,
      effectiveWeight: BASE_WEIGHTS.humidity,
      score: null,
      status: "unavailable",
      reasons: [],
      limitations: [
        L(
          "NASA relative humidity data unavailable for this location/period.",
          "بيانات الرطوبة النسبية من NASA POWER غير متاحة لهذا الموقع/الفترة."
        ),
      ],
    };
  }
  const absMin = crop.humidity.optMin - 15;
  const absMax = crop.humidity.optMax + 15;
  const score = clamp(
    rangeFit(rh, absMin, crop.humidity.optMin, crop.humidity.optMax, absMax)
  );
  const reasons: Bilingual[] = [];
  const limitations: Bilingual[] = [];
  if (rh > crop.humidity.optMax) {
    limitations.push(
      L(
        `Mean relative humidity of ${Math.round(rh)}% exceeds the documented comfort range (up to ${crop.humidity.optMax}%) — foliar disease pressure rises.`,
        `متوسط الرطوبة النسبية ${Math.round(rh)}% يتجاوز مدى الراحة الموثق (حتى ${crop.humidity.optMax}%) — يرتفع ضغط أمراض المجموع الخضري.`
      )
    );
  } else if (rh < crop.humidity.optMin) {
    limitations.push(
      L(
        `Mean relative humidity of ${Math.round(rh)}% is below the documented range (from ${crop.humidity.optMin}%) — dry-air stress.`,
        `متوسط الرطوبة النسبية ${Math.round(rh)}% أقل من المدى الموثق (من ${crop.humidity.optMin}%) — إجهاد جفاف الهواء.`
      )
    );
  } else {
    reasons.push(
      L(
        `Mean relative humidity of ${Math.round(rh)}% during the window is inside the documented range of ${crop.humidity.optMin}–${crop.humidity.optMax}%.`,
        `متوسط الرطوبة النسبية ${Math.round(rh)}% خلال الفترة داخل المدى الموثق ${crop.humidity.optMin}–${crop.humidity.optMax}%.`
      )
    );
  }
  return {
    key: "humidity",
    weight: BASE_WEIGHTS.humidity,
    effectiveWeight: BASE_WEIGHTS.humidity,
    score,
    status: "ok",
    reasons,
    limitations,
  };
}

function scoreWind(ctx: Ctx, crop: CropRecord, months: number[]): FactorScore {
  const w = windowMean(ctx.monthly, months, "ws10m");
  if (w === null) {
    return {
      key: "wind",
      weight: BASE_WEIGHTS.wind,
      effectiveWeight: BASE_WEIGHTS.wind,
      score: null,
      status: "unavailable",
      reasons: [],
      limitations: [
        L(
          "NASA wind speed data unavailable for this location/period.",
          "بيانات سرعة الرياح من NASA POWER غير متاحة لهذا الموقع/الفترة."
        ),
      ],
    };
  }
  const tol = crop.windTolerance;
  const score = w <= tol ? 100 : clamp(100 - 15 * (w - tol), 30, 100);
  const reasons: Bilingual[] = [];
  const limitations: Bilingual[] = [];
  if (w <= tol) {
    reasons.push(
      L(
        `Mean wind speed of ${round1(w)} m/s is below the ≈${tol} m/s problem threshold for this crop.`,
        `متوسط سرعة الرياح ${round1(w)} م/ث أقل من عتبة المشاكل ≈${tol} م/ث لهذا المحصول.`
      )
    );
  } else {
    limitations.push(
      L(
        `Mean wind speed of ${round1(w)} m/s exceeds the ≈${tol} m/s threshold — higher lodging, evaporation and mechanical damage risk.`,
        `متوسط سرعة الرياح ${round1(w)} م/ث يتجاوز عتبة ≈${tol} م/ث — ارتفاع خطر الرقود والتبخر والتلف الميكانيكي.`
      )
    );
  }
  return {
    key: "wind",
    weight: BASE_WEIGHTS.wind,
    effectiveWeight: BASE_WEIGHTS.wind,
    score,
    status: score < 100 ? "limited" : "ok",
    reasons,
    limitations,
  };
}

/* ---------------- classification & summary ---------------- */

export function classify(score: number): Bilingual {
  if (score >= 80) return L("Highly suitable", "ملائم جدًا");
  if (score >= 65) return L("Suitable", "ملائم");
  if (score >= 50) return L("Moderately suitable", "ملائم بشكل متوسط");
  if (score >= 35) return L("Marginally suitable", "ملاءمة محدودة");
  return L("Not recommended", "غير موصى به");
}

function buildSummary(
  crop: CropRecord,
  factors: FactorScore[],
  seasonMatch: boolean
): Bilingual {
  const positives = factors
    .filter((f) => f.score !== null && f.score >= 70 && f.reasons.length > 0)
    .sort((a, b) => b.effectiveWeight - a.effectiveWeight);
  const negatives = factors
    .filter((f) => f.score !== null && f.score < 50 && f.limitations.length > 0)
    .sort((a, b) => b.effectiveWeight - a.effectiveWeight);

  const posEn = positives.slice(0, 2).map((f) => f.reasons[0].en);
  const posAr = positives.slice(0, 2).map((f) => f.reasons[0].ar);
  const negEn = negatives[0]?.limitations[0]?.en;
  const negAr = negatives[0]?.limitations[0]?.ar;

  let en = `We recommend growing ${crop.name.en} because `;
  let ar = `نوصي بزراعة ${crop.name.ar} لأن `;
  if (posEn.length === 0) {
    en += "no factor strongly favors it under the current conditions";
    ar += "لا يوجد عامل قوي يرجّحه في الظروف الحالية";
  } else {
    en += posEn.join(", and ");
    ar += posAr.join("، و");
  }
  en += ".";
  ar += ".";
  if (negEn) {
    en += ` Main limitation: ${negEn}`;
    ar += ` القيد الرئيسي: ${negAr}`;
  }
  if (!seasonMatch) {
    const pl = L(
      crop.plantingMonths.map((m) => MONTHS_EN[m - 1]).join(", "),
      crop.plantingMonths.map((m) => MONTHS_AR[m - 1]).join("، ")
    );
    en += ` Note: in Egypt this crop is planted around ${pl.en}, not in your selected season — treat it as planning information for another season.`;
    ar += ` ملاحظة: يُزرع هذا المحصول في مصر حول ${pl.ar} وليس في الموسم الذي اخترته — تعامَل معه كمعلومة تخطيط لموسم آخر.`;
  }
  return L(en, ar);
}

/* ---------------- main entry ---------------- */

export function runEngine(
  monthly: MonthlyValue[],
  climateSummary: ClimateSummary,
  farm: FarmInput
): { crops: CropResult[]; engine: EngineInfo } {
  const ctx: Ctx = { monthly, farm };
  const results: CropResult[] = [];

  for (const crop of CROPS) {
    const { months } = pickWindow(crop, farm.season);
    const seasonMatch = crop.seasons.includes(farm.season);

    const temperature = scoreTemperature(ctx, crop, months);
    const { factor: water, gap } = scoreWater(ctx, crop, months);
    const solar = scoreSolar(ctx, crop, months);
    const soil = scoreSoil(ctx, crop);
    const season = scoreSeason(ctx, crop);
    const humidity = scoreHumidity(ctx, crop, months);
    const wind = scoreWind(ctx, crop, months);

    const factors = [temperature, water, solar, soil, season, humidity, wind];

    // redistribute weight of unavailable factors
    const available = factors.filter((f) => f.score !== null);
    const totalBase = available.reduce((a, f) => a + f.weight, 0);
    for (const f of factors) {
      f.effectiveWeight =
        f.score === null ? 0 : Math.round((f.weight / totalBase) * 1000) / 10;
    }

    const score =
      available.length === 0
        ? 0
        : Math.round(
            available.reduce((a, f) => a + (f.score as number) * f.weight, 0) /
              totalBase
          );

    results.push({
      cropId: crop.id,
      score,
      classification: classify(score),
      rank: 0,
      seasonMatch,
      factors,
      windowMonths: months,
      irrigationGapMm: gap,
      summary: buildSummary(crop, factors, seasonMatch),
    });
  }

  // Crops plantable in the farmer's selected season rank first,
  // then off-season crops (clearly labeled in the UI as planning info).
  results.sort((a, b) =>
    a.seasonMatch === b.seasonMatch ? b.score - a.score : a.seasonMatch ? -1 : 1
  );
  results.forEach((r, i) => (r.rank = i + 1));

  // confidence
  const unavailableClimate = results[0]?.factors.filter(
    (f) => f.status === "unavailable" && f.key !== "soil"
  );
  const soilUnknown = farm.soilType === "unknown";
  const coverage = climateSummary.coverageOverall;
  let confidence: EngineInfo["confidence"] = "high";
  const notes: Bilingual[] = [];
  if (coverage < 0.85) {
    confidence = "low";
    notes.push(
      L(
        `NASA data coverage for the analyzed period is only ${Math.round(coverage * 100)}%.`,
        `تغطية بيانات NASA للفترة المحللة ${Math.round(coverage * 100)}% فقط.`
      )
    );
  } else if (coverage < 0.95 || soilUnknown || (unavailableClimate?.length ?? 0) > 0) {
    confidence = "medium";
  }
  if (soilUnknown) {
    notes.push(
      L(
        "Soil type was not provided, so the soil factor was excluded from scoring.",
        "لم يُحدَّد نوع التربة، لذا استُبعد عامل التربة من التقييم."
      )
    );
  }
  if ((unavailableClimate?.length ?? 0) > 0) {
    notes.push(
      L(
        "Some NASA parameters were unavailable and their factors were excluded.",
        "بعض متغيرات NASA لم تكن متاحة واستُبعدت عواملها."
      )
    );
  }
  if (notes.length === 0) {
    notes.push(
      L(
        "All factors were evaluated with complete NASA POWER data and farm inputs.",
        "قُيِّمت جميع العوامل ببيانات NASA POWER كاملة ومدخلات المزرعة."
      )
    );
  }

  const engine: EngineInfo = {
    weights: FACTOR_ORDER.map((key) => ({ key, weight: BASE_WEIGHTS[key] })),
    methodology: L(
      "Each factor is scored 0-100 by comparing NASA POWER monthly climatology and your farm inputs with the documented requirements of each crop (FAO EcoCrop, FAO I&D Paper 33, Egyptian MALR extension data). The final score is the weighted average: temperature 30%, water 20%, solar radiation 15%, soil 15%, season 10%, humidity 5%, wind 5%. Unavailable factors are excluded and their weight redistributed. Scores support decisions; they do not guarantee yield or profit.",
      "يُحسب لكل عامل درجة من 0 إلى 100 بمقارنة المناخ الشهري من NASA POWER ومدخلات مزرعتك بالاحتياجات الموثقة لكل محصول (FAO EcoCrop وورقة FAO رقم 33 وإرشادات وزارة الزراعة المصرية). الدرجة النهائية هي المتوسط المرجّح: الحرارة 30%، والماء 20%، والإشعاع الشمسي 15%، والتربة 15%، والموسم 10%، والرطوبة 5%، والرياح 5%. العوامل غير المتاحة تُستبعد ويُعاد توزيع وزنها. الدرجات لدعم القرار ولا تضمن المحصول أو الربح."
    ),
    confidence,
    confidenceNote: L(notes.map((n) => n.en).join(" "), notes.map((n) => n.ar).join(" ")),
  };

  return { crops: results, engine };
}
