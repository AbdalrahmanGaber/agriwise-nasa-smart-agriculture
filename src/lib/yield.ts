/**
 * Expected Crop Yield Estimation (server-side, optional feature).
 *
 * Scientifically responsible design:
 *  - The ONLY quantitative anchor is FAOSTAT national-average yields for
 *    Egypt, retrieved 2026-11-14 from the official bulk dataset
 *    (https://bulks-faostat.fao.org — Production_Crops_Livestock,
 *    element "Yield", kg/ha). These are real, published statistics.
 *  - NASA POWER climate data is used ONLY to list documented risk
 *    factors (heat / cold stress windows) — never to "predict" a yield.
 *  - No field-specific tonnage is invented. The tool says plainly what
 *    extra information a real field model would require.
 *
 * FAOSTAT values (Egypt, t/ha):
 *   wheat     2022 6.699 · 2023 6.777 · 2024 6.778
 *   maize     2022 7.508 · 2023 7.624 · 2024 7.585
 *   rice      2022 8.905 · 2023 9.153 · 2024 9.132
 *   sugarcane 2022 111.161 · 2023 107.309 · 2024 107.115
 *   tomatoes  2022 40.377 · 2023 42.899 · 2024 42.880
 *   potatoes  2022 29.343 · 2023 31.437 · 2024 30.094
 *   onions    2022 35.907 · 2023 35.948 · 2024 35.366
 */

import { getCrop, type CropRecord } from "./crops";
import { L, type Bilingual, type SoilType, type WaterAvailability } from "./types";
import type { MultiYearInfo } from "./types";

const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;

export interface FaostatYield {
  cropId: string;
  /** t/ha by year */
  byYear: Record<string, number>;
  /** 3-year mean, t/ha */
  mean: number;
  /** min–max across the three years, t/ha */
  range: [number, number];
  unit: string;
}

/** Verified FAOSTAT Egypt national yields (t/ha), retrieved 2026-11-14. */
export const FAOSTAT_EGYPT: FaostatYield[] = [
  {
    cropId: "wheat",
    byYear: { "2022": 6.699, "2023": 6.777, "2024": 6.778 },
    mean: 6.751,
    range: [6.699, 6.778],
    unit: "t/ha",
  },
  {
    cropId: "maize",
    byYear: { "2022": 7.508, "2023": 7.624, "2024": 7.585 },
    mean: 7.572,
    range: [7.508, 7.624],
    unit: "t/ha",
  },
  {
    cropId: "rice",
    byYear: { "2022": 8.905, "2023": 9.153, "2024": 9.132 },
    mean: 9.063,
    range: [8.905, 9.153],
    unit: "t/ha",
  },
  {
    cropId: "sugarcane",
    byYear: { "2022": 111.161, "2023": 107.309, "2024": 107.115 },
    mean: 108.528,
    range: [107.115, 111.161],
    unit: "t/ha",
  },
  {
    cropId: "tomato",
    byYear: { "2022": 40.377, "2023": 42.899, "2024": 42.880 },
    mean: 42.052,
    range: [40.377, 42.899],
    unit: "t/ha",
  },
  {
    cropId: "potato",
    byYear: { "2022": 29.343, "2023": 31.437, "2024": 30.094 },
    mean: 30.291,
    range: [29.343, 31.437],
    unit: "t/ha",
  },
  {
    cropId: "onion",
    byYear: { "2022": 35.907, "2023": 35.948, "2024": 35.366 },
    mean: 35.74,
    range: [35.366, 35.948],
    unit: "t/ha",
  },
];

/** Unit conversions — the Egyptian feddan is 0.42 ha (≈1.038 acres). */
export const AREA_TO_HA: Record<string, number> = {
  hectares: 1,
  acres: 0.404686,
  feddan: 0.42,
};

export interface YieldFactor {
  /** positive weight means the factor RAISES risk of falling below the average */
  kind: "risk" | "note" | "positive";
  text: Bilingual;
}

export interface YieldResult {
  crop: {
    id: string;
    name: Bilingual;
    scientificName: string;
    durationDays: [number, number];
  };
  reference: {
    source: string;
    sourceUrl: string;
    retrievedAt: string;
    values: FaostatYield;
    /** national-average production for the given area, labelled as such */
    areaProduction:
      | {
          areaInput: number;
          unit: string;
          areaHa: number;
          tonnage: number;
          label: Bilingual;
        }
      | null;
  };
  factors: YieldFactor[];
  uncertainty: Bilingual[];
  missingInformation: Bilingual[];
  dataUsed: Bilingual[];
  disclaimer: Bilingual;
  meta: {
    multiYear: MultiYearInfo;
    generatedAt: string;
    inputs: {
      variety?: string;
      plantingMonth?: number;
      soilType?: SoilType;
      waterAvailability?: WaterAvailability;
      irrigationMethod?: string;
      growthStage?: string;
    };
  };
}

export interface YieldInput {
  crop: CropRecord;
  lat: number;
  lng: number;
  area?: number;
  areaUnit?: string;
  variety?: string;
  plantingMonth?: number;
  soilType?: SoilType;
  waterAvailability?: WaterAvailability;
  irrigationMethod?: string;
  growthStage?: string;
  multiYear: MultiYearInfo;
}

export function runYieldEstimator(input: YieldInput): YieldResult {
  const { crop, multiYear } = input;
  const faostat = FAOSTAT_EGYPT.find((f) => f.cropId === crop.id);

  const areaHa =
    input.area && input.area > 0 && AREA_TO_HA[input.areaUnit ?? "hectares"]
      ? input.area * AREA_TO_HA[input.areaUnit ?? "hectares"]
      : null;

  const areaProduction =
    faostat && areaHa
      ? {
          areaInput: input.area!,
          unit: input.areaUnit ?? "hectares",
          areaHa: round2(areaHa),
          tonnage: round1(faostat.mean * areaHa),
          label: L(
            `If your whole field performed exactly at the national average, ${round2(areaHa)} ha would produce about ${round1(faostat.mean * areaHa)} tonnes of ${crop.name.en}. This is arithmetic on the national average — not a prediction for your field.`,
            `لو حقق حقلك تمامًا المتوسط الوطني، فسوف تنتج مساحة ${round2(areaHa)} هكتار نحو ${round1(faostat.mean * areaHa)} طنًا من ${crop.name.ar}. هذا حساب حسابي على المتوسط الوطني — وليس تنبؤًا لحقلك.`
          ),
        }
      : null;

  /* ---------- risk factors from real climate data ---------- */

  const factors: YieldFactor[] = [];

  const duration =
    Math.round((crop.durationDays[0] + crop.durationDays[1]) / 2);
  const durationMonths = Math.max(1, Math.round(duration / 30));
  const cycleMonths =
    input.plantingMonth !== undefined
      ? Array.from({ length: durationMonths }, (_, k) =>
          ((input.plantingMonth! - 1 + k) % 12) + 1
        )
      : null;

  const heatMonths = multiYear.months.filter(
    (m) => (m.tMaxMean ?? -99) > crop.temp.optMax + 3
  );
  if (heatMonths.length) {
    const inCycle =
      cycleMonths && heatMonths.some((m) => cycleMonths.includes(m.month));
    factors.push({
      kind: inCycle ? "risk" : "note",
      text: L(
        `Heat: in ${heatMonths.map((m) => m.month).join(", ")} the mean daily maximum exceeds ${crop.temp.optMax + 3}°C (documented optimum ${crop.temp.optMin}–${crop.temp.optMax}°C)${inCycle ? " — these months fall inside your crop cycle, a real yield-risk period" : " — outside the stated planting cycle"}.`,
        `الحرارة: في الأشهر ${heatMonths.map((m) => m.month).join("، ")} يتجاوز متوسط الأقصى اليومي ${crop.temp.optMax + 3}°م (المدى الأمثل الموثق ${crop.temp.optMin}–${crop.temp.optMax}°م)${inCycle ? " — تقع داخل دورة محصولك وهي فترة خطر حقيقية على المحصول" : " — خارج دورة الزراعة المذكورة"}.`
      ),
    });
  }

  const coldMonths = multiYear.months.filter(
    (m) => (m.tMinMean ?? 99) < crop.temp.optMin - 3
  );
  if (coldMonths.length) {
    const inCycle =
      cycleMonths && coldMonths.some((m) => cycleMonths.includes(m.month));
    factors.push({
      kind: inCycle ? "risk" : "note",
      text: L(
        `Cold: in ${coldMonths.map((m) => m.month).join(", ")} the mean daily minimum falls below ${crop.temp.optMin - 3}°C${inCycle ? " — inside your crop cycle" : " — outside the stated cycle"}.`,
        `البرد: في الأشهر ${coldMonths.map((m) => m.month).join("، ")} ينخفض متوسط الدنيا اليومية دون ${crop.temp.optMin - 3}°م${inCycle ? " — داخل دورة محصولك" : " — خارج الدورة المذكورة"}.`
      ),
    });
  }

  if (
    input.waterAvailability === "limited" &&
    (crop.water.category === "high" || crop.water.category === "very-high")
  ) {
    factors.push({
      kind: "risk",
      text: L(
        `Water: you reported limited irrigation water, while ${crop.name.en} has a ${crop.water.category.replace("-", " ")} documented requirement (${crop.water.seasonNeedMm[0]}–${crop.water.seasonNeedMm[1]} mm/season) — water shortage is the dominant risk to reaching the national average.`,
        `الماء: ذكرت أن مياه الري محدودة، بينما ${crop.name.ar} يحتاج احتياجًا موثقًا مرتفعًا (${crop.water.seasonNeedMm[0]}–${crop.water.seasonNeedMm[1]} مم/موسم) — نقص الماء هو الخطر الأكبر للوصول إلى المتوسط الوطني.`
      ),
    });
  } else if (
    input.waterAvailability === "abundant" &&
    crop.water.category !== "very-high"
  ) {
    factors.push({
      kind: "positive",
      text: L(
        "Water: your reported supply can meet this crop's documented requirement — water is unlikely to be the limiting factor.",
        "الماء: يمكن لما ذكرته من إمداد تغطية الاحتياج الموثق لهذا المحصول — الماء غير مرجّح أن يكون العامل المحدد."
      ),
    });
  }

  if (input.soilType && input.soilType !== "unknown" && crop.soil[input.soilType] !== undefined) {
    const s = crop.soil[input.soilType]!;
    if (s < 70) {
      factors.push({
        kind: "risk",
        text: L(
          `Soil: ${crop.name.en}'s documented soil preference scores ${s}/100 on your ${input.soilType} soil — expect below-average performance unless management compensates.`,
          `التربة: تفضيل ${crop.name.ar} الترابي الموثق يحصل على ${s}/100 على تربتك (${SOIL_AR[input.soilType] ?? input.soilType}) — توقّع أداءً دون المتوسط ما لم تعوّضه الإدارة.`
        ),
      });
    } else if (s >= 85) {
      factors.push({
        kind: "positive",
        text: L(
          `Soil: your ${input.soilType} soil is among the documented preferred soils for this crop (${s}/100).`,
          `التربة: تربتك ${SOIL_AR[input.soilType] ?? input.soilType} من الترب المفضلة الموثقة لهذا المحصول (${s}/100).`
        ),
      });
    }
  }

  if (input.irrigationMethod === "drip" && ["tomato", "onion", "potato", "maize"].includes(crop.id)) {
    factors.push({
      kind: "positive",
      text: L(
        "Drip irrigation is a documented water-efficient practice for this crop and supports stable yields under limited water.",
        "الري بالتنقيط ممارسة موثقة لترشيد الماء لهذا المحصول وتدعم غلالًا مستقرة مع محدودية الماء."
      ),
    });
  }

  const uncertainty: Bilingual[] = [
    L(
      "FAOSTAT figures are national averages across all Egyptian farms and years — individual fields commonly deviate substantially above or below them depending on variety, soil fertility, pest pressure and management.",
      "أرقام FAOSTAT متوسطات وطنية تشمل كل المزارع المصرية عبر السنوات — الحقول الفردية تنحرف كثيرًا أعلى أو أدنى بحسب الصنف وخصوبة التربة والآفات والإدارة."
    ),
    L(
      `The ${faostat ? "2022–2024" : ""} national year-to-year spread for this crop is ${faostat ? `${round1(faostat.range[0])}–${round1(faostat.range[1])} ${faostat.unit}` : "not shown"} — a measure of national variability, NOT of field-level uncertainty.`,
      `التباين الوطني بين السنوات ${faostat ? "لأعوام 2022–2024" : ""} لهذا المحصول هو ${faostat ? `${round1(faostat.range[0])}–${round1(faostat.range[1])} ${faostat.unit}` : "غير معروض"} — وهو مقياس التباين الوطني وليس عدم اليقين على مستوى الحقل.`
    ),
  ];

  const missing: Bilingual[] = [
    L(
      "A validated field-specific yield model needs: variety performance trials for your area, a soil fertility test (N-P-K, organic matter), salinity measurement, pest and disease history, and your management plan.",
      "نموذج غلة موثق على مستوى الحقل يحتاج: تجائل أداء الأصناف لمنطقتك، وتحليل خصوبة التربة (N-P-K والمادة العضوية)، وقياس الملوحة، وسجل الآفات والأمراض، وخطتك الإدارية."
    ),
    L(
      "NASA POWER climate data alone cannot estimate yield — that is why it is used here only to list documented climate risks, never to predict tonnage.",
      "بيانات مناخ NASA POWER وحدها لا تقدر الغلة — لذلك تُستخدم هنا فقط لسرد مخاطر المناخ الموثقة، لا للتنبؤ بالأطنان."
    ),
  ];
  if (!faostat) {
    missing.unshift(
      L(
        "This crop has no verified FAOSTAT reference yield in the database.",
        "لا يوجد مرجع غلة موثق من FAOSTAT لهذا المحصول في قاعدة البيانات."
      )
    );
  }

  const dataUsed: Bilingual[] = [
    L(
      "FAOSTAT — Production Crops and Livestock (Egypt, element 'Yield'), national official statistics, retrieved 2026-11-14.",
      "FAOSTAT — إنتاج المحاصيل والثروة الحيوانية (مصر، عنصر «الغلة»)، إحصاءات وطنية رسمية، استُرجعت في 14-11-2026."
    ),
    L(
      `NASA POWER multi-year daily data (${multiYear.periodStart} → ${multiYear.periodEnd}) for the heat/cold risk windows at your coordinates.`,
      `بيانات NASA POWER اليومية لعدة أعوام (${multiYear.periodStart} → ${multiYear.periodEnd}) لنوافذ خطر الحرارة والبرد عند إحداثياتك.`
    ),
  ];
  if (input.variety) {
    dataUsed.push(
      L(
        `Variety "${input.variety}" recorded — variety-specific requirements are not in the database; the analysis uses crop-level documented data.`,
        `سُجّل الصنف «${input.variety}» — اشتراطات خاصة بالصنف غير متوفرة في قاعدة البيانات؛ يستخدم التحليل بيانات المحصول الموثقة عمومًا.`
      )
    );
  }

  const disclaimer = L(
    "This tool does not present any unsupported number as a scientific prediction. It shows verified national reference statistics and documented climate risks; the gap to a real field prediction is stated explicitly.",
    "لا تعرض هذه الأداة أي رقم غير مسند بوصفه تنبؤًا علميًا. تعرض إحصاءات مرجعية وطنية موثقة ومخاطر مناخية موثقة، وتذكر صراحةً ما ينقصنا للتنبؤ الحقيقي على مستوى الحقل."
  );

  return {
    crop: {
      id: crop.id,
      name: crop.name,
      scientificName: crop.scientificName,
      durationDays: crop.durationDays,
    },
    reference: {
      source: "FAOSTAT (FAO)",
      sourceUrl: "https://www.fao.org/faostat/en/#data/QCL",
      retrievedAt: "2026-11-14",
      values:
        faostat ??
        ({
          cropId: crop.id,
          byYear: {},
          mean: 0,
          range: [0, 0],
          unit: "t/ha",
        } as FaostatYield),
      areaProduction,
    },
    factors,
    uncertainty,
    missingInformation: missing,
    dataUsed,
    disclaimer,
    meta: {
      multiYear,
      generatedAt: new Date().toISOString(),
      inputs: {
        variety: input.variety,
        plantingMonth: input.plantingMonth,
        soilType: input.soilType,
        waterAvailability: input.waterAvailability,
        irrigationMethod: input.irrigationMethod,
        growthStage: input.growthStage,
      },
    },
  };
}

const SOIL_AR: Record<string, string> = {
  clay: "طينية",
  sandy: "رملية",
  loam: "طميية",
  other: "أخرى",
  unknown: "غير معروفة",
};

export { getCrop };
