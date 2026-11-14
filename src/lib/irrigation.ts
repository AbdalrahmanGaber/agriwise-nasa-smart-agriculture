/**
 * Smart Irrigation Advisor engine (server-side).
 *
 * Computes reference evapotranspiration (ETo) with the FAO-56
 * Penman–Monteith method — applied ONLY when all required inputs are
 * available (temperature, humidity, wind, solar radiation, latitude,
 * elevation) — and derives crop evapotranspiration (ETc = Kc × ETo)
 * using crop coefficients quoted from FAO-56 Table 12.
 *
 * Data: NASA POWER monthly climatology + multi-year daily means +
 * recent ~60-day observations; elevation from the Open-Meteo elevation
 * service. Rainfall is real. No soil moisture is claimed — NASA POWER
 * does not measure it.
 *
 * The engine deliberately does NOT output exact irrigation application
 * depths: those require soil water-holding capacity, rooting depth and
 * management-allowed depletion data that satellite climate services do
 * not measure. It reports atmospheric crop water demand (ETc) and
 * qualitative, documented guidance instead.
 */

import { getCrop, type CropRecord } from "./crops";
import {
  etoFAO56,
  etoMonthly,
  FAO56_KC,
  FAO56_STAGES,
  kcForStage,
  MID_MONTH_DAY,
  type GrowthStage,
} from "./fao56";
import { L, type Bilingual, type SoilType, type WaterAvailability } from "./types";
import type { ClimatologyInfo, MultiYearInfo, RecentConditions } from "./types";

const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;

export interface IrrigationResult {
  crop: {
    id: string;
    name: Bilingual;
    scientificName: string;
    water: CropRecord["water"];
  };
  location: { lat: number; lng: number; label: string };
  stage: GrowthStage;
  eto: {
    method: string;
    /** ETo from the last ~30 days of real observations (mm/day) */
    recent: number | null;
    /** ETo of the current calendar month from 25-yr climatology (mm/day) */
    currentMonth: number | null;
    monthly: Array<{ month: number; eto: number | null }>;
    elevationM: number | null;
    elevationSource: Bilingual;
    /** the exact inputs used (transparency) */
    inputsUsed: {
      lat: number;
      dayOfYear: number;
      tMax: number | null;
      tMin: number | null;
      rhMean: number | null;
      wind10: number | null;
      rsMj: number | null;
    };
  } | null;
  etc: {
    kc: number;
    kcSource: Bilingual;
    kcNote: Bilingual | null;
    /** ETc for the current month & selected stage, mm/day */
    etcMmDay: number | null;
    /** ETc annual peak (max monthly ETc × Kc mid), mm/day */
    peakMmDay: number | null;
    stageLengths: {
      lengths: [number, number, number, number];
      total: number;
      row: string;
    };
  };
  factors: {
    increasing: Bilingual[];
    reducing: Bilingual[];
  };
  guidance: {
    general: Bilingual[];
    waterManagement: Bilingual[];
    explanation: Bilingual;
  };
  disclosures: Bilingual[];
  meta: {
    climatology: ClimatologyInfo;
    multiYear: MultiYearInfo;
    recent: RecentConditions | null;
    generatedAt: string;
  };
}

export interface IrrigationInput {
  crop: CropRecord;
  lat: number;
  lng: number;
  label: string;
  stage: GrowthStage;
  currentMonth: number;
  currentDayOfYear: number;
  soilType?: SoilType;
  waterAvailability?: WaterAvailability;
  climatology: ClimatologyInfo;
  multiYear: MultiYearInfo;
  recent: RecentConditions | null;
  elevationM: number | null;
}

const SEASONAL_FACTORS = (crop: CropRecord) => ({
  heat: crop.temp.optMax,
  wind: crop.windTolerance,
  rhLow: crop.humidity.optMin,
  rhHigh: crop.humidity.optMax,
});

export function runIrrigationAdvisor(input: IrrigationInput): IrrigationResult {
  const { crop, climatology, multiYear, recent } = input;

  /* ---------- ETo (FAO-56 Penman–Monteith) ---------- */

  const merged = multiYear.months.map((m) => {
    const c = climatology.months.find((x) => x.month === m.month);
    return {
      month: m.month,
      t2mMean: c?.t2mMean ?? m.t2mMean ?? null,
      tMaxMean: m.tMaxMean ?? null,
      tMinMean: m.tMinMean ?? null,
      rhMean: c?.rhMean ?? m.rhMean ?? null,
      windMean: c?.windMean ?? m.windMean ?? null,
      // convert kWh/m²/day back to MJ for the FAO-56 function
      solarMj:
        (c?.solarMean ?? m.solarMean ?? null) === null
          ? null
          : (c?.solarMean ?? m.solarMean ?? null)! * 3.6,
    };
  });

  let etoBlock: IrrigationResult["eto"] = null;
  let monthlyEto: Array<{ month: number; eto: number | null }> = [];
  let recentEto: number | null = null;

  if (input.elevationM !== null) {
    monthlyEto = etoMonthly(input.lat, input.elevationM, merged);
    const cur = merged.find((m) => m.month === input.currentMonth);
    const curEto = monthlyEto.find((x) => x.month === input.currentMonth)?.eto ?? null;

    // ETo from the last ~30 days of real observations (daily basis, G=0)
    if (
      recent &&
      recent.tMaxMean !== null && recent.tMinMean !== null &&
      recent.rhMean !== null && recent.windMean !== null && recent.solarMean !== null
    ) {
      const r = etoFAO56({
        lat: input.lat,
        elevation: input.elevationM,
        dayOfYear: input.currentDayOfYear,
        tMax: recent.tMaxMean,
        tMin: recent.tMinMean,
        rhMean: recent.rhMean,
        wind10: recent.windMean,
        rs: recent.solarMean * 3.6,
      });
      recentEto = r.eto;
    }

    etoBlock = {
      method: "FAO-56 Penman–Monteith (Allen et al., 1998) — Eq. 6 with all required inputs available",
      recent: recentEto,
      currentMonth: curEto,
      monthly: monthlyEto,
      elevationM: input.elevationM,
      elevationSource: L(
        "Open-Meteo elevation service",
        "خدمة الارتفاعات Open-Meteo"
      ),
      inputsUsed: {
        lat: round2(input.lat),
        dayOfYear: input.currentDayOfYear,
        tMax: cur?.tMaxMean ?? null,
        tMin: cur?.tMinMean ?? null,
        rhMean: cur?.rhMean ?? null,
        wind10: cur?.windMean ?? null,
        rsMj: cur?.solarMj ?? null,
      },
    };
  }

  /* ---------- ETc via FAO-56 Table 12 ---------- */

  const kcEntry = FAO56_KC[crop.id];
  const kc = kcForStage(crop.id, input.stage);
  const curEtoVal = etoBlock?.currentMonth ?? null;
  const etcMmDay =
    curEtoVal !== null ? round2(curEtoVal * kc) : null;
  const peakMonthlyEto = monthlyEto.length
    ? Math.max(...monthlyEto.map((x) => x.eto ?? -1))
    : null;
  const peakMmDay =
    peakMonthlyEto !== null && peakMonthlyEto >= 0 && kcEntry
      ? round2(peakMonthlyEto * kcEntry.mid)
      : null;

  const stages = FAO56_STAGES[crop.id];

  /* ---------- demand factors from real data ---------- */

  const f = SEASONAL_FACTORS(crop);
  const cur = merged.find((m) => m.month === input.currentMonth);
  const increasing: Bilingual[] = [];
  const reducing: Bilingual[] = [];

  if (cur?.tMaxMean != null && cur.tMaxMean > f.heat) {
    increasing.push(
      L(
        `High daytime temperatures (mean daily maximum ${round1(cur.tMaxMean)}°C this month vs the crop optimum ${f.heat}°C) raise evapotranspiration and plant water stress.`,
        `ارتفاع حرارة النهار (متوسط الأقصى اليومي ${round1(cur.tMaxMean)}°م هذا الشهر مقابل المدى الأمثل ${f.heat}°م) يرفع التبخر-نتح وإجهاد المحصول المائي.`
      )
    );
  }
  if (cur?.rhMean != null && cur.rhMean < f.rhLow) {
    increasing.push(
      L(
        `Low relative humidity (${round1(cur.rhMean)}% vs the crop's documented optimum ${f.rhLow}–${f.rhHigh}%) increases the vapour-pressure deficit and water demand.`,
        `انخفاض الرطوبة النسبية (${round1(cur.rhMean)}% مقابل المدى الأمثل الموثق ${f.rhLow}–${f.rhHigh}%) يزيد عجز بخار الماء والاحتياج المائي.`
      )
    );
  }
  if (cur?.windMean != null && cur.windMean >= 3.5) {
    increasing.push(
      L(
        `Persistent wind (monthly mean ${round1(cur.windMean)} m/s) accelerates evaporation; windbreaks reduce losses.`,
        `استمرار الرياح (متوسط شهري ${round1(cur.windMean)} م/ث) يسرّع التبخر؛ مصدات الرياح تقلل الفقد.`
      )
    );
  }
  if (recent && recent.rainTotal !== null && recent.rainTotal > 5) {
    reducing.push(
      L(
        `Recent rainfall (${round1(recent.rainTotal)} mm over the last ~60 days) partially offsets irrigation demand.`,
        `أمطار حديثة (${round1(recent.rainTotal)} مم خلال آخر 60 يومًا تقريبًا) تعوض جزءًا من احتياج الري.`
      )
    );
  }
  if (cur?.rhMean != null && cur.rhMean > f.rhHigh) {
    reducing.push(
      L(
        `High humidity (${round1(cur.rhMean)}% above the crop optimum band) lowers the vapour-pressure deficit and slows water loss.`,
        `ارتفاع الرطوبة (${round1(cur.rhMean)}% فوق المدى الأمثل) يقلل عجز بخار الماء ويبطئ فقد الماء.`
      )
    );
  }
  if (cur?.t2mMean != null && cur.t2mMean < crop.temp.optMin) {
    reducing.push(
      L(
        `Cool temperatures (monthly mean ${round1(cur.t2mMean)}°C below the crop optimum) slow growth and evapotranspiration.`,
        `برودة الجو (متوسط شهري ${round1(cur.t2mMean)}°م دون المدى الأمثل) تُبطئ النمو والتبخر-نتح.`
      )
    );
  }
  if (!increasing.length)
    increasing.push(
      L(
        "Current climatic conditions are near the crop's documented optimum band — water demand follows the normal seasonal curve.",
        "الظروف المناخية الحالية قريبة من المدى الأمثل الموثق للمحصول — الاحتياج المائي يتبع المنحنى الموسمي الطبيعي."
      )
    );

  /* ---------- guidance (documented, qualitative) ---------- */

  const general: Bilingual[] = [];
  if (etcMmDay !== null) {
    general.push(
      L(
        `Atmospheric water demand (ETc) for ${crop.name.en} in the selected stage this month is about ${etcMmDay} mm/day, computed as Kc ${kc} × ETo ${round2(curEtoVal ?? 0)} mm/day.`,
        `الاحتياج المائي الجوي (ETc) لـ${crop.name.ar} في المرحلة المختارة هذا الشهر نحو ${etcMmDay} مم/يوم، محسوبًا كـ Kc ${kc} × ETo ${round2(curEtoVal ?? 0)} مم/يوم.`
      )
    );
  } else {
    general.push(
      L(
        "ETo could not be computed (elevation or climate data unavailable) — see the disclosure below.",
        "تعذر حساب ETo (بيانات الارتفاع أو المناخ غير متاحة) — انظر الملاحظة أدناه."
      )
    );
  }
  general.push(
    L(
      `${crop.name.en} is a ${crop.water.category.replace("-", " ")} water-requirement crop: the documented seasonal need is ${crop.water.seasonNeedMm[0]}–${crop.water.seasonNeedMm[1]} mm over the growing cycle (${crop.water.rainfedPossible ? "rainfed possible in suitable climates" : "irrigation is essential"}).`,
      `${crop.name.ar} محصول باحتياج مائي ${CATEGORIES_AR[crop.water.category]}: الاحتياج الموسمي الموثق هو ${crop.water.seasonNeedMm[0]}–${crop.water.seasonNeedMm[1]} مم خلال دورة النمو (${crop.water.rainfedPossible ? "الزراعة المطرة ممكنة في مناخات مناسبة" : "الري ضروري"}).`
    )
  );

  const waterManagement: Bilingual[] = [];
  if (input.soilType === "sandy") {
    waterManagement.push(
      L(
        "Sandy soil holds little water: irrigate more frequently with smaller applications, and split fertilizer doses to avoid leaching.",
        "التربة الرملية تحتفظ بماء قليل: ري متكرر بجرعات صغيرة مع تقسيم التسميد لتجنب الغسيل."
      )
    );
  } else if (input.soilType === "clay") {
    waterManagement.push(
      L(
        "Clay soil holds more water but infiltrates slowly: longer intervals with larger applications, and avoid waterlogging.",
        "التربة الطينية تحتفظ بماء أكثر لكنها بطيئة الرشح: فواصل أطول بجرعات أكبر مع تجنب تشبع الجذور."
      )
    );
  } else if (input.soilType === "loam") {
    waterManagement.push(
      L(
        "Loamy soil balances water holding and drainage — the most forgiving soil for scheduling.",
        "التربة الطميية توازن بين حفظ الماء والتصريف — الأسهل في جدولة الري."
      )
    );
  } else if (input.soilType === "unknown" || input.soilType === undefined) {
    waterManagement.push(
      L(
        "Soil type not specified: exact scheduling intervals cannot be derived — provide your soil type for tailored interval guidance.",
        "نوع التربة غير محدد: لا يمكن اشتقاق فواصل جدولة دقيقة — أدخل نوع التربة للحصول على إرشادات أدق."
      )
    );
  }
  if (input.waterAvailability === "limited") {
    waterManagement.push(
      L(
        "With limited water, prioritise the crop's most sensitive stages (establishment and flowering) and consider deficit-irrigation advice from your extension office.",
        "مع محدودية الماء، أعطِ الأولوية للمراحل الأكثر حساسية (الإنشاء والتزهير) واستشر مكتب الإرشاد عن الري الناقص."
      )
    );
  } else if (input.waterAvailability === "abundant") {
    waterManagement.push(
      L(
        "Even with abundant water, avoid over-irrigation: it wastes water, leaches nutrients and can spread root disease.",
        "حتى مع توافر الماء، تجنب الإفراط في الري: يهدر الماء ويغسل العناصر وقد ينشر أمراض الجذور."
      )
    );
  }
  if (input.stage === "mid") {
    waterManagement.push(
      L(
        "The mid-season stage carries the highest Kc — water stress here causes the largest documented yield losses.",
        "منتصف الموسم يحمل أعلى معامل Kc — إجهاد الماء هنا يسبب أكبر خسائر موثقة في المحصول."
      )
    );
  }

  const explanation = L(
    `ETo (reference evapotranspiration) was computed with the FAO-56 Penman–Monteith equation using real monthly climate data for your coordinates (25-year means, with 3-year daily maximum/minimum means) and real recent observations${recent ? ` (through ${recent.latestObservationDate})` : ""}. ETc multiplies ETo by the crop coefficient of the selected stage from FAO-56 Table 12. This is atmospheric demand — NOT a prescription of litres to apply.`,
    `حُسِب ETo (التبخر-نتح المرجعي) بمعادلة FAO-56 بنمان-مونتيث باستخدام بيانات مناخية شهرية حقيقية لإحداثياتك (متوسطات 25 عامًا مع متوسطات القصوى/الدنيا اليومية لثلاثة أعوام) ومشاهدات حديثة حقيقية${recent ? ` (حتى ${recent.latestObservationDate})` : ""}. ويُضرب ETo في معامل المحصول للمرحلة المختارة من جدول 12 في FAO-56. هذا هو الطلب الجوي — وليس وصفة بكمية ماء تُضاف.`
  );

  const disclosures: Bilingual[] = [
    L(
      "NASA POWER does not measure soil moisture. Satellite climate data describe atmospheric demand only.",
      "NASA POWER لا يقيس رطوبة التربة. بيانات المناخ الفضائية تصف الطلب الجوي فقط."
    ),
    L(
      "Exact application depths and irrigation schedules require soil water-holding capacity, rooting depth and allowed-depletion data, which are not measured here — consult your local agricultural extension office for a field schedule.",
      "أعماق الجرعات وجداول الري الدقيقة تحتاج سعة التربة المائية وعُمق الجذور ونسبة الاستنزاف المسموح، وهي غير مقاسة هنا — استشر مكتب الإرشاد الزراعي لجدول ميداني."
    ),
  ];
  if (input.elevationM === null) {
    disclosures.push(
      L(
        "The elevation service was unreachable, so ETo was not computed (FAO-56 requires atmospheric pressure, which depends on elevation). All other guidance is unaffected.",
        "تعذر الوصول لخدمة الارتفاعات فلم يُحسب ETo (تطلب معادلة FAO-56 الضغط الجوي المتوقف على الارتفاع). باقي الإرشادات لا تتأثر."
      )
    );
  }

  return {
    crop: {
      id: crop.id,
      name: crop.name,
      scientificName: crop.scientificName,
      water: crop.water,
    },
    location: { lat: input.lat, lng: input.lng, label: input.label },
    stage: input.stage,
    eto: etoBlock,
    etc: {
      kc,
      kcSource: L(
        `FAO-56 Table 12 (single crop coefficient, subhumid reference) — ${crop.name.en}: Kc ini ${kcEntry?.ini ?? "—"}, Kc mid ${kcEntry?.mid ?? "—"}, Kc end ${kcEntry ? (kcEntry.endRange ? kcEntry.endRange.join("–") : kcEntry.end) : "—"}`,
        `جدول 12 في FAO-56 (معامل محصول مفرد، مرجع شبه رطب) — ${crop.name.ar}: Kc أولي ${kcEntry?.ini ?? "—"}، Kc منتصف ${kcEntry?.mid ?? "—"}، Kc نهائي ${kcEntry ? (kcEntry.endRange ? kcEntry.endRange.join("–") : kcEntry.end) : "—"}`
      ),
      kcNote: kcEntry?.note
        ? L(kcEntry.note, kcEntry.note)
        : null,
      etcMmDay,
      peakMmDay,
      stageLengths: stages
        ? { lengths: stages.lengths, total: stages.total, row: stages.row }
        : { lengths: [0, 0, 0, 0], total: 0, row: "not documented" },
    },
    factors: { increasing, reducing },
    guidance: { general, waterManagement, explanation },
    disclosures,
    meta: {
      climatology,
      multiYear,
      recent,
      generatedAt: new Date().toISOString(),
    },
  };
}

const CATEGORIES_AR: Record<string, string> = {
  low: "منخفض",
  medium: "متوسط",
  high: "مرتفع",
  "very-high": "مرتفع جدًا",
};

export { getCrop };
