/**
 * AgriWise Climate Risk Alert System (Feature 3).
 *
 * Assesses agricultural climate risks for a selected location and crop from:
 *  - the real NASA POWER monthly climatology (365-day observations), and
 *  - the documented crop requirement ranges in the crop database (crops.ts).
 *
 * Honesty rules (mirroring the recommendation engine):
 *  - every "measured value" comes from the actual NASA data, never fabricated;
 *  - every threshold is a DOCUMENTED range from the crop database;
 *  - when a variable is missing the risk is listed as unavailable — never guessed;
 *  - forecast-based early warnings are marked as forecasts, not observations.
 *
 * Risk types evaluated:
 *  heat · cold · drought · rainfall-pattern · crop-range · radiation · wind
 * Each finding carries: type, level (low/moderate/high), measured value,
 * suitable reference range, agricultural impact and practical recommendations.
 */

import type { CropRecord } from "./crops";
import {
  L,
  monthName,
  type Bilingual,
  type ClimateSummary,
  type FarmInput,
  type MonthlyValue,
} from "./types";

/* ---------------- types ---------------- */

export type RiskLevel = "low" | "moderate" | "high";

export type RiskType =
  | "heat"
  | "cold"
  | "drought"
  | "rainfall-pattern"
  | "crop-range"
  | "radiation"
  | "wind";

export interface RiskFinding {
  type: RiskType;
  level: RiskLevel;
  /** language-neutral measured value, e.g. "41.2 °C" */
  value: string;
  /** what the value describes, e.g. "hottest-month mean daily maximum" */
  valueLabel: Bilingual;
  /** documented suitable range / threshold for this crop */
  threshold: Bilingual;
  /** potential agricultural impact of this risk */
  impact: Bilingual;
  /** practical recommendations for the farmer */
  recommendations: Bilingual[];
  /** where the measured value comes from */
  provenance: "nasa" | "user-input" | "documented";
}

export interface CropRiskReport {
  cropId: string;
  overall: RiskLevel;
  counts: { low: number; moderate: number; high: number };
  findings: RiskFinding[];
  /** risks that could not be evaluated because NASA data is missing */
  unavailable: RiskType[];
}

export const RISK_TYPE_LABELS: Record<RiskType, Bilingual> = {
  heat: L("Extreme heat", "الحرارة المفرطة"),
  cold: L("Cold stress", "إجهاد البرودة"),
  drought: L("Drought & water deficit", "الجفاف ونقص المياه"),
  "rainfall-pattern": L("Unusual rainfall patterns", "أنماط هطول غير معتادة"),
  "crop-range": L("Conditions outside the crop's range", "ظروف خارج نطاق المحصول"),
  radiation: L("Solar radiation balance", "توازن الإشعاع الشمسي"),
  wind: L("Wind exposure", "التعرض للرياح"),
};

/* ---------------- helpers ---------------- */

const round1 = (v: number) => Math.round(v * 10) / 10;
const lvlIdx = (l: RiskLevel) => (l === "high" ? 2 : l === "moderate" ? 1 : 0);
const idxLvl = (i: number): RiskLevel => (i >= 2 ? "high" : i === 1 ? "moderate" : "low");

const monthsLabel = (months: number[], lang: "en" | "ar") => {
  const uniq = [...new Set(months)].sort((a, b) => a - b);
  return uniq.map((m) => monthName(m, lang)).join("، ");
};

function windowMean(
  monthly: MonthlyValue[],
  months: number[],
  key: "t2m" | "t2mMax" | "t2mMin" | "solar" | "ws10m"
): number | null {
  const vals = months
    .map((m) => monthly[m - 1]?.[key])
    .filter((v): v is number => v !== null && v !== undefined);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function windowRain(monthly: MonthlyValue[], months: number[]): number | null {
  const vals = months
    .map((m) => monthly[m - 1]?.precip)
    .filter((v): v is number => v !== null && v !== undefined);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0);
}

/* ---------------- individual risk checks ---------------- */

function checkHeat(
  monthly: MonthlyValue[],
  summary: ClimateSummary,
  crop: CropRecord
): RiskFinding | "unavailable" {
  const withMax = monthly.filter((m) => m.t2mMax !== null);
  if (!withMax.length || summary.extremeMaxC === null) return "unavailable";
  const hottest = withMax.reduce((a, b) =>
    (b.t2mMax as number) > (a.t2mMax as number) ? b : a
  );
  const hottestMax = hottest.t2mMax as number;
  const extreme = summary.extremeMaxC as number;
  const { optMax, absMax } = crop.temp;

  const idx =
    hottestMax >= absMax || extreme >= absMax + 2
      ? 2
      : hottestMax >= optMax || extreme >= absMax
        ? 1
        : 0;

  const impact =
    idx === 2
      ? L(
          `Mean daily maxima of ${round1(hottestMax)}°C in ${monthName(hottest.month, "en")} reach the absolute tolerance of this crop (${absMax}°C). Photosynthesis declines sharply, pollen viability and flower set fail, and yield potential is lost even if the plant survives.`,
          `متوسط الحرارة القصوى ${round1(hottestMax)}°م في ${monthName(hottest.month, "ar")} يبلغ حد التحمل المطلق لهذا المحصول (${absMax}°م). يتراجع البناء الضوئي بشدة، وتفشل حيوية حبوب اللقاح وعقد الأزهار، ويُفقد إنتاج المحصول حتى لو بقيت النبتة حية.`
        )
      : idx === 1
        ? L(
            `Daily maxima above the documented optimum (${optMax}°C) accelerate development, raise transpiration and water demand, and can cause flower drop or poor fruit set when they coincide with sensitive stages.`,
            `الحرارة القصوى فوق المدى الأمثل الموثق (${optMax}°م) تُسرّع النمو، وترفع النتح واحتياج الماء، وقد تسبب تساقط الأزهار أو ضعف عقد الثمار إذا تزامنت مع المراحل الحساسة.`
          )
        : L(
            `Hottest-month maxima stay within the documented tolerance — extreme heat is not the limiting factor for this crop at your location.`,
            `تبقى الحرارة القصوى في أشد الشهور ضمن حد التحمل الموثق — الحرارة المفرطة ليست العامل المحدد لهذا المحصول في موقعك.`
          );

  const recommendations = [
    L(
      "Time planting so the most sensitive stages (flowering, fruit set, grain filling) miss the hottest weeks — see the Smart Crop Calendar below.",
      "اضبط موعد الزراعة بحيث تمر المراحل الأشد حساسية (التزهير وعقد الثمار وامتلاء الحبوب) بعيدًا عن أسابيع الذروة الحرارية — انظر تقويم المحصول الذكي أدناه."
    ),
    L(
      "Irrigate early morning or late evening and keep the soil moist ahead of heat peaks — moist soil buffers canopy temperature.",
      "اسقِ في الصباح الباكر أو المساء وحافظ على رطوبة التربة قبل الذروات الحرارية — فالتربة الرطبة تخفف حرارة النبات."
    ),
  ];
  if (idx >= 1) {
    recommendations.push(
      L(
        "For vegetables, ask your extension office about 30–50% shading nets during heat waves; for field crops ask about heat-tolerant varieties.",
        "بالنسبة للخضر اسأل مكتب الإرشاد عن شبكات التظليل بنسبة 30–50% أثناء موجات الحر؛ وللمحاصيل الحقلية اسأل عن الأصناف المتحملة للحرارة."
      )
    );
  }
  if (idx === 2) {
    recommendations.push(
      L(
        "When maxima persistently exceed the absolute tolerance, consider one of the alternative crops ranked on this page.",
        "عندما تتجاوز الحرارة القصوى حد التحمل باستمرار، فكّر في أحد المحاصيل البديلة المرتبة في هذه الصفحة."
      )
    );
  }

  return {
    type: "heat",
    level: idxLvl(idx),
    value: `${round1(hottestMax)} °C · ${round1(extreme)} °C`,
    valueLabel: L(
      `Hottest-month mean daily max (${monthName(hottest.month, "en")}) · extreme recorded in 365 days`,
      `متوسط اليومي القصوى في أشد الشهور (${monthName(hottest.month, "ar")}) · القيمة القصوى المسجلة خلال 365 يومًا`
    ),
    threshold: L(
      `Optimum maximum ${optMax}°C · absolute tolerance ${absMax}°C`,
      `الحد الأقصى الأمثل ${optMax}°م · حد التحمل المطلق ${absMax}°م`
    ),
    impact,
    recommendations,
    provenance: "nasa",
  };
}

function checkCold(
  monthly: MonthlyValue[],
  summary: ClimateSummary,
  crop: CropRecord
): RiskFinding | "unavailable" {
  const withMin = monthly.filter((m) => m.t2mMin !== null);
  if (!withMin.length || summary.extremeMinC === null) return "unavailable";
  const coldest = withMin.reduce((a, b) =>
    (b.t2mMin as number) < (a.t2mMin as number) ? b : a
  );
  const coldestMin = coldest.t2mMin as number;
  const extreme = summary.extremeMinC as number;
  const { optMin, absMin } = crop.temp;

  const idx =
    coldestMin <= absMin - 2 || extreme <= absMin - 3
      ? 2
      : coldestMin <= absMin || extreme <= absMin
        ? 1
        : 0;

  const impact =
    idx === 2
      ? L(
          `Winter minima of ${round1(coldestMin)}°C (extreme ${round1(extreme)}°C) fall well below the survival limit (${absMin}°C) — risk of chilling injury, failed germination and establishment loss in young plants.`,
          `الحرارة الدنيا الشتوية ${round1(coldestMin)}°م (والقصوى المنخفضة ${round1(extreme)}°م) تهبط كثيرًا دون حد البقاء (${absMin}°م) — خطر إصابة بالبرودة وفشل الإنبات وفقد الشتلات في النباتات الفتية.`
        )
      : idx === 1
        ? L(
            `Nights at or below the survival minimum (${absMin}°C) stall growth and development during establishment — the crop survives but loses early vigour.`,
            `الليالي عند حد البقاء أو دونه (${absMin}°م) توقف النمو والتطور أثناء الإنشاء — يبقى المحصول حيًا لكنه يفقد قوته المبكرة.`
          )
        : L(
            `Coldest-month minima remain within the documented tolerance — cold stress is unlikely to limit this crop at your location.`,
            `تبقى الحرارة الدنيا في أبرد الشهور ضمن حد التحمل الموثق — إجهاد البرودة غير مرجّح أن يحدّ هذا المحصول في موقعك.`
          );

  return {
    type: "cold",
    level: idxLvl(idx),
    value: `${round1(coldestMin)} °C · ${round1(extreme)} °C`,
    valueLabel: L(
      `Coldest-month mean daily min (${monthName(coldest.month, "en")}) · extreme recorded in 365 days`,
      `متوسط اليومي الدنيا في أبرد الشهور (${monthName(coldest.month, "ar")}) · القيمة الدنيا القصوى المسجلة خلال 365 يومًا`
    ),
    threshold: L(
      `Optimum minimum ${optMin}°C · survival limit ${absMin}°C`,
      `الحد الأدنى الأمثل ${optMin}°م · حد البقاء ${absMin}°م`
    ),
    impact,
    recommendations: [
      L(
        "Follow the planting window in the Smart Crop Calendar so establishment misses the coldest weeks.",
        "اتبع نافذة الزراعة في تقويم المحصول الذكي بحيث يمر الإنشاء بعيدًا عن أبرد الأسابيع."
      ),
      L(
        "Avoid establishing cold-sensitive crops in December–January in Upper Egypt.",
        "تجنّب إنشاء المحاصيل الحساسة للبرودة في ديسمبر–يناير في الصعيد."
      ),
      ...(idx >= 1
        ? [
            L(
              "For high-value crops use low tunnels or row covers on cold nights; they lift night temperature around the plants.",
              "للمحاصيل عالية القيمة استخدم الأنفاق المنخفضة أو أغطية الصفوف في الليالي الباردة؛ فهي ترفع حرارة الليل حول النباتات."
            ),
          ]
        : []),
    ],
    provenance: "nasa",
  };
}

function checkDrought(
  monthly: MonthlyValue[],
  summary: ClimateSummary,
  farm: FarmInput,
  crop: CropRecord,
  windowMonths: number[]
): RiskFinding | "unavailable" {
  const annual = summary.annualRainfallMm;
  const winRain = windowRain(monthly, windowMonths);
  if (winRain === null) return "unavailable";
  const [needMin, needMax] = crop.water.seasonNeedMm;

  // rainfall deficit relative to the documented seasonal requirement
  const f = winRain / needMin;
  const deficitIdx = f < 0.05 ? 2 : f < 0.25 ? 1 : 0;

  // mismatch between the farmer's reported water availability and the crop need level
  const mismatch =
    crop.water.category === "very-high"
      ? { limited: 2, moderate: 1, abundant: 0 }
      : crop.water.category === "high"
        ? { limited: 2, moderate: 1, abundant: 0 }
        : crop.water.category === "medium"
          ? { limited: 1, moderate: 0, abundant: 0 }
          : { limited: 0, moderate: 0, abundant: 0 };
  const supplyIdx = mismatch[farm.waterAvailability];

  // abundant irrigation relieves one notch of the rainfall deficit
  const relief = farm.waterAvailability === "abundant" ? 1 : 0;
  const idx = Math.max(lvlIdx(idxLvl(deficitIdx)) - relief, supplyIdx);
  const pct = Math.round((winRain / needMin) * 100);

  const impact =
    idx === 2
      ? L(
          `Rainfall inside the growing window (${round1(winRain)} mm) supplies only ${pct}% of the documented seasonal requirement (${needMin}–${needMax} mm), and your reported water supply is below what this crop needs. Water stress here means direct yield loss and, for perennial crops, stand failure.`,
          `الهطول داخل نافذة النمو (${round1(winRain)} مم) يوفر ${pct}% فقط من الاحتياج الموسمي الموثق (${needMin}–${needMax} مم)، ومياهك المعلنة أقل من احتياج هذا المحصول. الإجهاد المائي هنا يعني نقصًا مباشرًا في المحصول، ولمحاصيل الأعوام المتعددة فقدان المزرعة نفسها.`
        )
      : idx === 1
        ? L(
            `Rainfall covers only ${pct}% of the documented seasonal requirement (${needMin}–${needMax} mm) — irrigation must reliably close the gap, and any interruption during heat peaks turns into visible water stress.`,
            `يغطي الهطول ${pct}% فقط من الاحتياج الموسمي الموثق (${needMin}–${needMax} مم) — يجب أن يغطي الري هذه الفجوة باطمئنان، وأي انقطاع أثناء الذروات الحرارية يتحول إلى إجهاد مائي ظاهر.`
          )
        : L(
            `Rainfall is negligible (${round1(winRain)} mm in the window) as expected in an arid climate — the documented requirement (${needMin}–${needMax} mm) must come from irrigation, and your reported supply matches this crop's need level.`,
            `الهطول منعدم تقريبًا (${round1(winRain)} مم في النافذة) كما هو متوقع في مناخ جاف — يجب أن يأتي الاحتياج الموثق (${needMin}–${needMax} مم) من الري، ومياهك المعلنة تناسب مستوى احتياج هذا المحصول.`
          );

  return {
    type: "drought",
    level: idxLvl(idx),
    value: `${round1(winRain)} mm / ${needMin}–${needMax} mm`,
    valueLabel: L(
      `Rainfall in the growing window vs documented seasonal need (annual rainfall ${round1(annual)} mm)`,
      `الهطول داخل نافذة النمو مقابل الاحتياج الموسمي الموثق (الهطول السنوي ${round1(annual)} مم)`
    ),
    threshold: L(
      `Documented seasonal requirement ${needMin}–${needMax} mm · your reported availability: see Farm Analysis`,
      `الاحتياج الموسمي الموثق ${needMin}–${needMax} مم · توفرك المعلن للمياه: انظر تحليل المزرعة`
    ),
    impact,
    recommendations: [
      L(
        "Match the crop to your reliable water supply — compare the irrigation gap shown for every alternative on this page.",
        "طابق المحصول مع مياهك الموثوقة — قارن فجوة الري المعروضة لكل بديل في هذه الصفحة."
      ),
      L(
        "Follow the stage water shares in the Smart Crop Calendar: give priority to the critical stages marked there.",
        "اتبع حصص الماء لكل مرحلة في تقويم المحصول الذكي: أعطِ الأولية للمراحل الحرجة المعلّمة هناك."
      ),
      L(
        "Mulch the surface and keep weeds out — both cut evaporation losses from the topsoil.",
        "غطِّ سطح التربة وأزل الأعشاب — كلاهما يقلل فواقد التبخر من سطح التربة."
      ),
    ],
    provenance: "user-input",
  };
}

function checkRainfallPattern(
  monthly: MonthlyValue[]
): RiskFinding | "unavailable" {
  const withRain = monthly.filter((m) => m.precip !== null);
  if (!withRain.length) return "unavailable";
  const annual = withRain.reduce((a, m) => a + (m.precip as number), 0);
  const peak = withRain.reduce((a, b) =>
    (b.precip as number) > (a.precip as number) ? b : a
  );
  const share = annual > 0 ? (peak.precip as number) / annual : 0;
  const dryMonths = withRain.filter((m) => (m.precip as number) < 5).length;

  let idx = 0;
  if (annual >= 60) {
    if ((peak.precip as number) >= 50 || share > 0.8) idx = 2;
    else if (share > 0.6) idx = 1;
  }

  const impact =
    annual < 60
      ? L(
          `Annual rainfall is only ${round1(annual)} mm — effectively a fully irrigated climate. Unusual rainfall events are not a significant constraint at this location; water risk is covered by the drought indicator.`,
          `الهطول السنوي ${round1(annual)} مم فقط — مناخ يعتمد على الري كليًا. أنماط الهطول غير المعتادة ليست قيدًا مهمًا في هذا الموقع؛ خطر الماء مغطى بمؤشر الجفاف.`
        )
      : idx === 2
        ? L(
            `${Math.round(share * 100)}% of the annual rain falls in ${monthName(peak.month, "en")} (${round1(peak.precip as number)} mm). Concentrated bursts damage seedlings, leach fertilizer, and can flood low-lying fields; the rest of the year stays dry.`,
            `${Math.round(share * 100)}% من مطر السنة ينزل في ${monthName(peak.month, "ar")} (${round1(peak.precip as number)} مم). الدفعات المركزة تضر الشتلات وتغسل السماد وقد تغمر الأراضي المنخفضة؛ ويبقى بقية العام جافًا.`
          )
        : L(
            `Rainfall is reasonably distributed across ${12 - dryMonths} rain-bearing months — no dominant flood month detected in the NASA record.`,
            `الهطول موزّع بشكل معقول على ${12 - dryMonths} أشهر ممطرة — لا شهر غمر مسيطر في سجل ناسا.`
          );

  return {
    type: "rainfall-pattern",
    level: idxLvl(idx),
    value:
      annual < 60
        ? `${round1(annual)} mm`
        : `${round1(peak.precip as number)} mm (${Math.round(share * 100)}%)`,
    valueLabel: L(
      `Peak monthly rainfall (${monthName(peak.month, "en")}) and its share of the annual total`,
      `ذروة الهطول الشهري (${monthName(peak.month, "ar")}) ونسبتها من المجموع السنوي`
    ),
    threshold: L(
      "Reference: a balanced pattern spreads rainfall across months; one month above ~70% of the annual total signals concentration and flash-flood risk",
      "مرجع: النمط المتوازن يوزع الهطول على الشهور؛ وسيطرة شهر واحد على ~70% من المجموع السنوي تشير إلى تركز وخطر سيول"
    ),
    impact,
    recommendations:
      idx >= 1
        ? [
            L(
              `Check field drainage and bunds before ${monthName(peak.month, "en")}; avoid low spots where water ponds.`,
              `افحص صرف الحقل والجسوز قبل ${monthName(peak.month, "ar")}؛ وتجنب البقع المنخفضة حيث يتجمع الماء.`
            ),
            L(
              "After a heavy rainfall event: re-aerate the soil, top up the leached fertilizer and inspect for fungal outbreaks.",
              "بعد حدث مطري غزير: أعد تهوية التربة، وعوّض السماد المغسول، وافحص ظهور الفطريات."
            ),
          ]
        : [
            L(
              "No rainfall-pattern action needed — plan your irrigation calendar instead (see the Smart Crop Calendar).",
              "لا إجراء مطلوبًا بشأن نمط الهطول — خطط لجدول الري بدلًا من ذلك (انظر تقويم المحصول الذكي)."
            ),
          ],
    provenance: "nasa",
  };
}

function checkCropRange(
  monthly: MonthlyValue[],
  crop: CropRecord,
  windowMonths: number[],
  lang: "en" | "ar"
): RiskFinding | "unavailable" {
  const meanT = windowMean(monthly, windowMonths, "t2m");
  if (meanT === null) return "unavailable";
  const { absMin, optMin, optMax, absMax } = crop.temp;
  const outsideOpt = windowMonths.filter((m) => {
    const t = monthly[m - 1]?.t2m;
    return t !== null && t !== undefined && (t < optMin || t > optMax);
  });

  const idx =
    meanT <= absMin || meanT >= absMax
      ? 2
      : meanT < optMin || meanT > optMax || outsideOpt.length >= 2
        ? 1
        : 0;

  const impact =
    idx === 2
      ? L(
          `The mean temperature over the growing window (${round1(meanT)}°C) falls outside the crop's absolute tolerance (${absMin}–${absMax}°C) — the crop cannot complete its cycle reliably under these conditions.`,
          `متوسط الحرارة داخل نافذة النمو (${round1(meanT)}°م) يقع خارج حد التحمل المطلق للمحصول (${absMin}–${absMax}°م) — لا يستطيع المحصول إكمال دورته باطمئنان في هذه الظروف.`
        )
      : idx === 1
        ? L(
            `The window mean of ${round1(meanT)}°C and ${outsideOpt.length} month(s) sit outside the documented optimum (${optMin}–${optMax}°C) — the crop completes its cycle but with reduced vigour and yield potential in those months (${monthsLabel(outsideOpt, lang)}).`,
            `متوسط النافذة ${round1(meanT)}°م و${outsideOpt.length} شهرًا خارج المدى الأمثل الموثق (${optMin}–${optMax}°م) — يكمل المحصول دورته لكن بقوة وإنتاجية أقل في تلك الشهور (${monthsLabel(outsideOpt, lang)}).`
        )
        : L(
            `Window mean of ${round1(meanT)}°C stays inside the documented optimum (${optMin}–${optMax}°C) — thermal conditions suit this crop's cycle.`,
            `متوسط النافذة ${round1(meanT)}°م يبقى داخل المدى الأمثل الموثق (${optMin}–${optMax}°م) — الظروف الحرارية تناسب دورة هذا المحصول.`
        );

  return {
    type: "crop-range",
    level: idxLvl(idx),
    value: `${round1(meanT)} °C`,
    valueLabel: L(
      "Mean air temperature over the evaluated growing window",
      "متوسط درجة حرارة الهواء خلال نافذة النمو المقيَّمة"
    ),
    threshold: L(
      `Documented optimum ${optMin}–${optMax}°C · tolerance ${absMin}–${absMax}°C`,
      `المدى الأمثل الموثق ${optMin}–${optMax}°م · حد التحمل ${absMin}–${absMax}°م`
    ),
    impact,
    recommendations:
      idx >= 1
        ? [
            L(
              "Shift planting by a few weeks so the sensitive stages move inside the optimum band — compare with the calendar below.",
              "زحزح موعد الزراعة بضعة أسابيع بحيث تنتقل المراحل الحساسة داخل المدى الأمثل — قارن مع التقويم أدناه."
            ),
            L(
              "If the whole window is off-range, weigh the alternative crops for this season on this page.",
              "إن كانت النافذة كلها خارج المدى، فوازن بدائل المحاصيل لهذا الموسم في هذه الصفحة."
            ),
          ]
        : [
            L(
              "No adjustment needed — the selected window already sits in the crop's optimum range.",
              "لا تعديل مطلوبًا — النافذة المختارة تقع أصلًا داخل المدى الأمثل للمحصول."
            ),
          ],
    provenance: "nasa",
  };
}

function checkRadiation(
  monthly: MonthlyValue[],
  crop: CropRecord,
  windowMonths: number[]
): RiskFinding | "unavailable" {
  const meanSolar = windowMean(monthly, windowMonths, "solar");
  if (meanSolar === null) return "unavailable";
  const { optMin, optMax } = crop.solar;

  const idx =
    meanSolar < optMin - 1.5 || meanSolar > optMax + 1.5
      ? 1
      : meanSolar < optMin || meanSolar > optMax
        ? 1
        : 0;

  const impact =
    meanSolar < optMin
      ? L(
          `Mean solar radiation in the window (${round1(meanSolar)} kWh/m²/day) is below the documented optimum (${optMin}–${optMax}) — photosynthesis-driven growth slows and yields decline.`,
          `متوسط الإشعاع الشمسي في النافذة (${round1(meanSolar)} كيلوواط·س/م²/يوم) دون الأمثل الموثق (${optMin}–${optMax}) — يتباطأ النمو المدفوع بالبناء الضوئي وتتراجع الإنتاجية.`
        )
      : meanSolar > optMax
        ? L(
            `Mean solar radiation (${round1(meanSolar)} kWh/m²/day) exceeds the documented optimum (${optMin}–${optMax}) — radiation itself is rarely harmful, but it amplifies heat and evaporation stress.`,
            `متوسط الإشعاع الشمسي (${round1(meanSolar)} كيلوواط·س/م²/يوم) يتجاوز الأمثل الموثق (${optMin}–${optMax}) — الإشعاع ذاته نادرًا ما يكون ضارًا، لكنه يضاعف إجهاد الحرارة والتبخر.`
          )
        : L(
            `Radiation of ${round1(meanSolar)} kWh/m²/day sits inside the documented optimum (${optMin}–${optMax}) — a genuine asset for this crop's yield.`,
            `الإشعاع ${round1(meanSolar)} كيلوواط·س/م²/يوم يقع داخل المدى الأمثل الموثق (${optMin}–${optMax}) — ميزة حقيقية لإنتاجية هذا المحصول.`
          );

  return {
    type: "radiation",
    level: idxLvl(idx),
    value: `${round1(meanSolar)} kWh/m²/day`,
    valueLabel: L(
      "Mean solar radiation over the growing window",
      "متوسط الإشعاع الشمسي خلال نافذة النمو"
    ),
    threshold: L(
      `Documented optimum ${optMin}–${optMax} kWh/m²/day`,
      `المدى الأمثل الموثق ${optMin}–${optMax} كيلوواط·س/م²/يوم`
    ),
    impact,
    recommendations: [
      L(
        "High radiation goes with high evaporation — keep the irrigation schedule from the crop calendar.",
        "الإشعاع العالي يعني تبخرًا عاليًا — حافظ على جدول الري من تقويم المحصول."
      ),
    ],
    provenance: "nasa",
  };
}

function checkWind(
  monthly: MonthlyValue[],
  crop: CropRecord
): RiskFinding | "unavailable" {
  const withWind = monthly.filter((m) => m.ws10m !== null);
  if (!withWind.length) return "unavailable";
  const windiest = withWind.reduce((a, b) =>
    (b.ws10m as number) > (a.ws10m as number) ? b : a
  );
  const windiestVal = windiest.ws10m as number;
  const tol = crop.windTolerance;

  const idx =
    windiestVal >= tol + 1.5 ? 2 : windiestVal >= tol ? 1 : 0;

  const impact =
    idx === 2
      ? L(
          `The windiest month averages ${round1(windiestVal)} m/s — above the documented problem level (${tol} m/s) for this crop. Expect stronger lodging (stems breaking) for tall crops, leaf physical damage, and markedly higher evaporation.`,
          `أكثر الشهور رياحًا يسجل متوسطًا ${round1(windiestVal)} م/ث — فوق مستوى المشكلات الموثق (${tol} م/ث) لهذا المحصول. توقع رقودًا أشد (انكسار السيقان) للمحاصيل الطويلة، وتلفًا ميكانيكيًا للأوراق، وتبخرًا أعلى بوضوح.`
        )
      : idx === 1
        ? L(
            `Winds in the windiest month (${round1(windiestVal)} m/s) reach the documented caution level (${tol} m/s) — lodging risk rises for tall crops and evaporation increases.`,
            `الرياح في أكثر الشهور (${round1(windiestVal)} م/ث) تبلغ مستوى الحذر الموثق (${tol} م/ث) — يرتفع خطر الرقود للمحاصيل الطويلة ويزيد التبخر.`
          )
        : L(
            `Windiest-month mean of ${round1(windiestVal)} m/s stays below the crop's caution level (${tol} m/s) — wind is not a limiting factor.`,
            `متوسط أكثر الشهور رياحًا (${round1(windiestVal)} م/ث) يبقى دون مستوى الحذر للمحصول (${tol} م/ث) — الرياح ليست عاملًا محددًا.`
          );

  return {
    type: "wind",
    level: idxLvl(idx),
    value: `${round1(windiestVal)} m/s`,
    valueLabel: L(
      `Windiest-month mean wind speed (${monthName(windiest.month, "en")})`,
      `متوسط سرعة الرياح في أكثر الشهور رياحًا (${monthName(windiest.month, "ar")})`
    ),
    threshold: L(
      `Documented caution level for this crop: sustained means above ${tol} m/s`,
      `مستوى الحذر الموثق لهذا المحصول: متوسطات مستمرة فوق ${tol} م/ث`
    ),
    impact,
    recommendations:
      idx >= 1
        ? [
            L(
              "Plant windbreak rows (Casuarina and similar trees are used in Egyptian farms) on the windward side; they protect for roughly 10–20 times their height.",
              "ازرع صفوف مصدفات الرياح (الكازورينا وأشباهها مستخدمة في المزارع المصرية) في الجهة القبلية للرياح؛ فهي تحمي مسافة تعادل نحو 10–20 ضعف ارتفاعها."
            ),
            L(
              "Avoid over-irrigating into wind-stressed days — water is lost to evaporation before the crop uses it.",
              "تجنب الإفراط في الري في أيام إجهاد الرياح — يفقد الماء بالتبخر قبل أن يستفيد منه المحصول."
            ),
          ]
        : [
            L(
              "No wind action needed for this crop at this location.",
              "لا إجراء مطلوبًا بشأن الرياح لهذا المحصول في هذا الموقع."
            ),
          ],
    provenance: "nasa",
  };
}

/* ---------------- main assessment ---------------- */

export function assessCropRisk(
  monthly: MonthlyValue[],
  summary: ClimateSummary,
  farm: FarmInput,
  crop: CropRecord,
  windowMonths: number[]
): CropRiskReport {
  const findings: RiskFinding[] = [];
  const unavailable: RiskType[] = [];

  const push = (type: RiskType, r: RiskFinding | "unavailable") => {
    if (r === "unavailable") unavailable.push(type);
    else findings.push(r);
  };

  push("heat", checkHeat(monthly, summary, crop));
  push("cold", checkCold(monthly, summary, crop));
  push("drought", checkDrought(monthly, summary, farm, crop, windowMonths));
  push("rainfall-pattern", checkRainfallPattern(monthly));
  push("crop-range", checkCropRange(monthly, crop, windowMonths, "en"));
  push("radiation", checkRadiation(monthly, crop, windowMonths));
  push("wind", checkWind(monthly, crop));

  const order: RiskType[] = [
    "heat",
    "cold",
    "drought",
    "rainfall-pattern",
    "crop-range",
    "radiation",
    "wind",
  ];
  findings.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

  const counts = { low: 0, moderate: 0, high: 0 };
  for (const f of findings) counts[f.level] += 1;
  const overall: RiskLevel = counts.high
    ? "high"
    : counts.moderate
      ? "moderate"
      : "low";

  return { cropId: crop.id, overall, counts, findings, unavailable };
}

/* ---------------- forecast early warnings ---------------- */

export interface ForecastDay {
  date: string; // YYYY-MM-DD
  tmax: number | null;
  tmin: number | null;
  precip: number | null;
  windMax: number | null; // m/s
}

export type WarningType = "heat" | "cold" | "rain" | "wind";

export interface EarlyWarning {
  type: WarningType;
  level: RiskLevel;
  dates: string[];
  value: string;
  valueLabel: Bilingual;
  threshold: Bilingual;
  impact: Bilingual;
  recommendations: Bilingual[];
}

const fmtDateShort = (iso: string) => iso; // UI localizes with toLocaleDateString

export function assessForecastWarnings(
  days: ForecastDay[],
  crop: CropRecord
): EarlyWarning[] {
  const warnings: EarlyWarning[] = [];
  if (!days.length) return warnings;
  const { absMax, optMax, absMin, optMin } = crop.temp;
  const tol = crop.windTolerance;

  // heat
  const heatDates = days.filter(
    (d) => d.tmax !== null && (d.tmax >= absMax || d.tmax >= optMax)
  );
  if (heatDates.length) {
    const high = heatDates.some((d) => (d.tmax as number) >= absMax);
    const maxT = Math.max(...heatDates.map((d) => d.tmax as number));
    warnings.push({
      type: "heat",
      level: high ? "high" : "moderate",
      dates: heatDates.map((d) => fmtDateShort(d.date)),
      value: `${round1(maxT)} °C`,
      valueLabel: L(
        `Highest forecast daily maximum in the next ${days.length} days`,
        `أعلى حرارة قصوى متوقعة خلال ${days.length} أيام قادمة`
      ),
      threshold: L(
        `Optimum max ${optMax}°C · absolute tolerance ${absMax}°C`,
        `الحد الأقصى الأمثل ${optMax}°م · حد التحمل المطلق ${absMax}°م`
      ),
      impact: L(
        high
          ? "Forecast maxima reach the crop's absolute heat tolerance — vulnerable stages can suffer flower drop, failed fruit set or pollen death within days."
          : "Forecast maxima exceed the crop's optimum — expect faster development, higher water demand and possible flower drop in sensitive stages.",
        high
          ? "الحرارة القصوى المتوقعة تبلغ حد التحمل المطلق — قد تتضرر المراحل الحساسة بتساقط الأزهار وضعف العقد أو موت حبوب اللقاح خلال أيام."
          : "الحرارة القصوى المتوقعة تتجاوز المدى الأمثل — توقع نموًا أسرع واحتياجًا مائيًا أعلى واحتمال تساقط الأزهار في المراحل الحساسة."
      ),
      recommendations: [
        L(
          "Pre-irrigate before the flagged days so the soil is moist — moist soil buffers canopy temperature.",
          "اسقِ مسبقًا قبل الأيام المعلّمة بحيث تكون التربة رطبة — التربة الرطبة تخفف حرارة النبات."
        ),
        L(
          "Avoid spraying or fertilizing on the peak-heat days; do field work in the early morning.",
          "تجنب الرش أو التسميد في أيام ذروة الحرارة؛ ونفذ الأعمال الحقلية في الصباح الباكر."
        ),
      ],
    });
  }

  // cold
  const coldDates = days.filter(
    (d) => d.tmin !== null && (d.tmin <= absMin || d.tmin <= optMin)
  );
  if (coldDates.length) {
    const high = coldDates.some((d) => (d.tmin as number) <= absMin);
    const minT = Math.min(...coldDates.map((d) => d.tmin as number));
    warnings.push({
      type: "cold",
      level: high ? "high" : "moderate",
      dates: coldDates.map((d) => fmtDateShort(d.date)),
      value: `${round1(minT)} °C`,
      valueLabel: L(
        `Lowest forecast daily minimum in the next ${days.length} days`,
        `أدنى حرارة دنيا متوقعة خلال ${days.length} أيام قادمة`
      ),
      threshold: L(
        `Optimum min ${optMin}°C · survival limit ${absMin}°C`,
        `الحد الأدنى الأمثل ${optMin}°م · حد البقاء ${absMin}°م`
      ),
      impact: L(
        high
          ? "Forecast minima reach the crop's survival limit — young plants and flowers can suffer chilling injury on these nights."
          : "Forecast nights fall below the crop's optimum — growth and establishment slow on the flagged days.",
        high
          ? "الحرارة الدنيا المتوقعة تبلغ حد البقاء — قد تتعرض النباتات الفتية والأزهار لإصابة البرودة في تلك الليالي."
          : "الليالي المتوقعة تهبط دون المدى الأمثل — يتباطأ النمو والإنشاء في الأيام المعلّمة."
      ),
      recommendations: [
        L(
          "Cover high-value beds with fleece or low tunnels on the flagged nights.",
          "غطِّ الأحواض عالية القيمة بالفليس أو الأنفاق المنخفضة في الليالي المعلّمة."
        ),
      ],
    });
  }

  // rainfall event
  const totalRain = days.reduce((a, d) => a + (d.precip ?? 0), 0);
  const rainDates = days.filter((d) => (d.precip ?? 0) >= 10);
  if (totalRain >= 10 || rainDates.length) {
    const burst = Math.max(...days.map((d) => d.precip ?? 0));
    warnings.push({
      type: "rain",
      level: burst >= 25 ? "high" : "moderate",
      dates: rainDates.length
        ? rainDates.map((d) => fmtDateShort(d.date))
        : days.map((d) => fmtDateShort(d.date)),
      value: `${round1(totalRain)} mm`,
      valueLabel: L(
        `Total forecast precipitation over ${days.length} days (peak day ${round1(burst)} mm)`,
        `إجمالي الهطول المتوقع خلال ${days.length} أيام (ذروة يوم واحد ${round1(burst)} مم)`
      ),
      threshold: L(
        "Reference for arid Upper Egypt: a single day ≥ 25 mm can run off and pond; 10 mm already interrupts field operations",
        "مرجع للصعيد الجاف: يوم واحد ≥ 25 مم قد يجري على السطح ويتجمع؛ و10 مم تكفي لتعطيل الأعمال الحقلية"
      ),
      impact: L(
        "Rain events in an arid region wet leaves and topsoil — fungal spores activate, fertilizer leaches and irrigation demand pauses only briefly.",
        "الأمطار في المناطق الجافة تبتل الأوراق وسطح التربة — تنشط جراثيم الفطريات، ويُغسل السماد، ويتوقف احتياج الري توقفًا قصيرًا فقط."
      ),
      recommendations: [
        L(
          "Pause irrigation on the rainy days and resume only after the topsoil dries.",
          "أوقف الري في الأيام الممطرة واستأنف بعد جفاف سطح التربة."
        ),
        L(
          "After the event, check drainage, top-up leached fertilizer and scout for fungal spots on leaves.",
          "بعد الحدث افحص الصرف، وعوّض السماد المغسول، وافحص الأوراق بحثًا عن بقع فطرية."
        ),
      ],
    });
  }

  // wind
  const windDates = days.filter(
    (d) => d.windMax !== null && d.windMax >= tol
  );
  if (windDates.length) {
    const high = windDates.some((d) => (d.windMax as number) >= tol + 3);
    const maxW = Math.max(...windDates.map((d) => d.windMax as number));
    warnings.push({
      type: "wind",
      level: high ? "high" : "moderate",
      dates: windDates.map((d) => fmtDateShort(d.date)),
      value: `${round1(maxW)} m/s`,
      valueLabel: L(
        `Peak forecast gusts (daily max) in the next ${days.length} days`,
        `ذروة الرياح المتوقعة (القصوى اليومية) خلال ${days.length} أيام قادمة`
      ),
      threshold: L(
        `Documented caution level for this crop: above ${tol} m/s`,
        `مستوى الحذر الموثق لهذا المحصول: فوق ${tol} م/ث`
      ),
      impact: L(
        high
          ? "Forecast wind peaks are well above the crop's caution level — lodging of tall stems, leaf tearing and heavy evaporation losses are likely."
          : "Forecast winds reach the crop's caution level — lodging risk for tall crops and higher evaporation.",
        high
          ? "ذروة الرياح المتوقعة أعلى بكثير من مستوى الحذر — يُرجّح رقود السيقان الطويلة وتمزق الأوراق وفواقد تبخر كبيرة."
          : "الرياح المتوقعة تبلغ مستوى الحذر — خطر رقود للمحاصيل الطويلة وتبخر أعلى."
      ),
      recommendations: [
        L(
          "Postpone spraying and transplanting to calmer days — drift wastes product and young plants whip.",
          "أجّل الرش والشتلات إلى أيام أهدأ — الانجراف يهدر المنتج والشتلات الفتية تتأذى."
        ),
        L(
          "Irrigate the morning before windy days rather than during them.",
          "اسقِ صباح اليوم السابق للأيام العاصفة لا أثناءها."
        ),
      ],
    });
  }

  return warnings;
}
