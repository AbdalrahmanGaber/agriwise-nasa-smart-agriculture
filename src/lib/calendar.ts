/**
 * AgriWise Smart Crop Calendar (Feature 4).
 *
 * Builds a dynamic crop calendar for the selected crop and location:
 *  - planting period, germination, vegetative growth, development,
 *    maturation and expected harvest — with day ranges and months;
 *  - per-stage environmental requirements, farm activities and water
 *    management advice (documented stage patterns);
 *  - adaptation to the LOCATION: each stage is cross-checked against the
 *    real NASA POWER monthly climatology for the months it spans.
 *
 * Honesty rules:
 *  - stage durations are DOCUMENTED ranges (FAO & MALR calendars);
 *  - climate notes are computed from the actual NASA monthly data;
 *  - stage months use standard month lengths and are labelled as typical
 *    timing, not predictions for a specific year.
 */

import type { CropRecord } from "./crops";
import {
  L,
  monthName,
  SEASON_PLANTING_MONTHS,
  type Bilingual,
  type FarmInput,
  type MonthlyValue,
} from "./types";
import { SEASON_LABELS as SEASON } from "./labels";

/* ---------------- types ---------------- */

export type StageKey =
  | "planting"
  | "germination"
  | "vegetative"
  | "development"
  | "maturation"
  | "harvest";

export interface StageTemplate {
  key: StageKey;
  name: Bilingual;
  /** fraction of the cycle, [start, end) */
  span: [number, number];
  /** main environmental requirements (documented) */
  env: Bilingual[];
  /** important agricultural activities */
  activities: Bilingual[];
  /** approximate share of the seasonal water need (documented pattern) */
  waterSharePct: number;
  /** water management recommendation for this stage */
  waterAdvice: Bilingual;
}

export interface CalendarStage {
  key: StageKey;
  name: Bilingual;
  startDay: number;
  endDay: number;
  /** e.g. "Days 30–90" */
  dayLabel: string;
  /** e.g. "April (early) – June (mid)" */
  monthLabel: Bilingual;
  months: number[];
  env: Bilingual[];
  activities: Bilingual[];
  waterSharePct: number;
  waterAdvice: Bilingual;
  /** computed from the actual NASA climatology for the spanned months */
  climateNote: Bilingual | null;
}

export interface CropCalendar {
  cropId: string;
  cropName: Bilingual;
  scientificName: string;
  color: string;
  icon: string;
  /** chosen planting month (actual date's month when provided, else recommended window) */
  plantMonth: number;
  plantWindowLabel: Bilingual;
  /** all documented planting months for this crop */
  plantMonthsAvailable: number[];
  seasonMatch: boolean;
  seasonLabel: Bilingual;
  /** typical cycle length, days (midpoint of documented range) */
  cycleDays: number;
  stages: CalendarStage[];
  waterNeedMm: [number, number];
  waterCategoryLabel: string;
  /** "actual" when the farmer entered a real planting date; "planning" otherwise */
  basis: "actual" | "planning";
  /** the actual planting date entered by the farmer (ISO YYYY-MM-DD), when provided */
  plantDate: string | null;
  /** bilingual basis note shown next to the timeline */
  basisLabel: Bilingual;
  /** key of the stage the crop is in TODAY (only when an actual planting date exists and today falls inside the cycle) */
  todayStageKey: StageKey | null;
  /** day offset of today from the planting date, when inside the cycle */
  todayDayOffset: number | null;
  /** location-adapted notes built from real NASA data + farm inputs */
  locationNotes: Bilingual[];
  /** data provenance note */
  dataNote: Bilingual;
}

/* ---------------- stage templates (documented) ---------------- */

const STAGE_TEMPLATES: Record<string, StageTemplate[]> = {
  sugarcane: [
    {
      key: "planting",
      name: L("Planting / establishment", "الزراعة والتأسيس"),
      span: [0, 0.09],
      env: [
        L("Soil temperature warm (≈ 20–30°C) for sett sprouting", "دفء التربة (≈ 20–30°م) لإنبات العيدان المغروسة"),
        L("Moist but not waterlogged seedbed", "مهد بذور رطب غير مشبع بالماء"),
      ],
      activities: [
        L("Deep ploughing, land levelling and furrow opening", "حراثة عميقة وتسوية الأرض وفتح الخطوط"),
        L("Plant certified setts (cane cuttings) with 3 buds each", "غرس عيدان معتمدة كل واحدة بـ 3 براعم"),
        L("Pre-planting fertilizer and full irrigation to settle the soil", "سماد قبل الزراعة وري كامل لتثبيت التربة"),
      ],
      waterSharePct: 10,
      waterAdvice: L(
        "Keep the seedbed continuously moist — missed irrigation here kills the sett before emergence.",
        "حافظ على رطوبة المهد باستمرار — أي ري متأخر هنا يقتل العود قبل ظهوره."
      ),
    },
    {
      key: "germination",
      name: L("Germination & tillering", "الإنبات والتفريع"),
      span: [0.09, 0.27],
      env: [
        L("Mean temperature above ~20°C for tillering", "متوسط الحرارة فوق ~20°م للتفريع"),
        L("Frequent light irrigation preferred", "تفضيل ري خفيف متكرر"),
      ],
      activities: [
        L("Gap filling: re-plant failed sett positions", "تسوية الغروس: إعادة زراعة المواقع الفاشلة"),
        L("Weed control — tillering is very sensitive to competition", "مكافحة الحشائش — التفريع حساس جدًا للمنافسة"),
        L("First nitrogen top-dressing with irrigation", "السماد النيتروجيني الأول مع الري"),
      ],
      waterSharePct: 15,
      waterAdvice: L(
        "Light frequent irrigations (every 8–12 days) — the root system is still shallow.",
        "ري خفيف متكرر (كل 8–12 يومًا) — الجذور ما تزال سطحية."
      ),
    },
    {
      key: "vegetative",
      name: L("Grand growth (vegetative)", "النمو الضخم (الخضري)"),
      span: [0.27, 0.64],
      env: [
        L("High solar radiation and warm temperatures drive cane elongation", "الإشعاع العالي والحرارة الدافئة تدفع استطالة العيدان"),
        L("This stage consumes ~half of the seasonal water", "هذه المرحلة تستهلك نصف المياه الموسمية"),
      ],
      activities: [
        L("Earthing-up rows with the final nitrogen dose", "تكبيش الخطوط مع الجرعة النهائية من النيتروجين"),
        L("Monitor for stem borer and rat damage", "متابعة ثاقبة السيقان وأضرار الفئران"),
        L("Maintain strict irrigation intervals — drought here costs cane weight", "المحافظة على فترات الري بدقة — الجفاف هنا يخسّر وزن القصب"),
      ],
      waterSharePct: 50,
      waterAdvice: L(
        "The peak water stage: never let this window coincide with interrupted irrigation.",
        "ذروة الاحتياج المائي: لا تدع هذه الفترة تتزامن مع انقطاع الري."
      ),
    },
    {
      key: "development",
      name: L("Elongation & cane formation", "الاستطالة وتكوين العيدان"),
      span: [0.64, 0.86],
      env: [
        L("Warm days and slightly cooler nights raise sucrose accumulation", "النهار الدافئ والليل الأبرد يرفع تراكم السكروز"),
      ],
      activities: [
        L("Last weed clean-up before canopy closes", "آخر تنظيف للحشائش قبل انغلاق المجموع"),
        L("Scout for fungal leaf spots in humid spells", "مراقبة البقع الفطرية على الأوراق في الفترات الرطبة"),
      ],
      waterSharePct: 15,
      waterAdvice: L(
        "Extend intervals gradually — water now manages cane weight rather than new growth.",
        "طوّل الفترات تدريجيًا — الماء الآن يدير وزن القصب لا النمو الجديد."
      ),
    },
    {
      key: "maturation",
      name: L("Ripening & sucrose accumulation", "النضج وتراكم السكر"),
      span: [0.86, 0.95],
      env: [
        L("Cooler, drier weather concentrates sugars in the stem", "الجو الأبرد والجاف يركّز السكريات في العيدان"),
      ],
      activities: [
        L("Reduce then stop irrigation (dry-off) before harvest", "تقليل ثم إيقاف الري (التجفيف) قبل الحصاد"),
        L("Take juice samples for pol/brix reading near the mill", "أخذ عينات العصير لقياس البريكس قرب المصنع"),
      ],
      waterSharePct: 8,
      waterAdvice: L(
        "Dry-off 30–60 days before harvest: stressed cane stores more sugar.",
        "التجفيف 30–60 يومًا قبل الحصاد: القصب المجهود مائيًا يختزن سكرًا أكثر."
      ),
    },
    {
      key: "harvest",
      name: L("Harvest", "الحصاد"),
      span: [0.95, 1],
      env: [L("Dry weather for burning-free clean harvest", "جو جاف لحصاد نظيف دون حرق")],
      activities: [
        L("Cut close to the ground — the basal buds sprout as ratoon", "قطع قريبًا من الأرض — البراعم القاعدية تنمي الخلف"),
        L("Plan the ratoon: fertilize immediately after cutting", "تخطيط الخلف: سمّد مباشرة بعد القطع"),
      ],
      waterSharePct: 2,
      waterAdvice: L(
        "Irrigate lightly right after harvest to trigger ratoon sprouting.",
        "ري خفيف مباشرة بعد الحصاد لتحفيز نمو الخلف."
      ),
    },
  ],

  wheat: [
    {
      key: "planting",
      name: L("Sowing", "البذر"),
      span: [0, 0.05],
      env: [
        L("Soil temperature moderate — sowing in the Egyptian winter window", "حرارة تربة معتدلة — البذر في نافذة الشتاء المصري"),
        L("Fine, levelled seedbed", "مهد ناعم مسوّى"),
      ],
      activities: [
        L("Land preparation and seedbed finishing", "إعداد الأرض وإنهاء المهد"),
        L("Sow certified seed at the recommended rate", "بذر تقاوي معتمدة بالمعدل الموصى"),
        L("Basal phosphorus and potassium fertilizer", "سماد فوسفوري وبوتاسي أساسي"),
      ],
      waterSharePct: 10,
      waterAdvice: L(
        "Light irrigation right after sowing to guarantee uniform emergence.",
        "ري خفيف مباشرة بعد البذر لضمان ظهور منتظم."
      ),
    },
    {
      key: "germination",
      name: L("Germination & emergence", "الإنبات والظهور"),
      span: [0.05, 0.15],
      env: [L("Cool, moist topsoil", "سطح تربة بارد رطب")],
      activities: [
        L("Watch for uniform emergence within ~7 days", "متابعة انتظام الظهور خلال ~7 أيام"),
        L("Protect against early weeds", "الحماية من الحشائش المبكرة"),
      ],
      waterSharePct: 8,
      waterAdvice: L(
        "Keep the top 10 cm moist; crust after irrigation blocks emergence.",
        "حافظ على رطوبة أول 10 سم؛ القشرة بعد الري تمنع الظهور."
      ),
    },
    {
      key: "vegetative",
      name: L("Tillering (vegetative)", "التفريع (النمو الخضري)"),
      span: [0.15, 0.4],
      env: [
        L("Mild winter temperatures drive tiller number", "اعتدال حرارة الشتاء يحدد عدد الفروع"),
        L("This is the stage that decides the ear count", "هذه المرحلة تحدد عدد السنابل"),
      ],
      activities: [
        L("First nitrogen dose 20–25 days after sowing", "الجرعة الأولى من النيتروجين بعد البذر بـ 20–25 يومًا"),
        L("Weed control before stem elongation", "مكافحة الحشائش قبل استطالة الساق"),
      ],
      waterSharePct: 15,
      waterAdvice: L(
        "Irrigate every 15–21 days in winter; stress here reduces tillers.",
        "الري كل 15–21 يومًا شتاءً؛ الإجهاد هنا يقلل الفروع."
      ),
    },
    {
      key: "development",
      name: L("Stem elongation & jointing", "استطالة الساق والفروع"),
      span: [0.4, 0.6],
      env: [L("Nights above ~4°C; no late frost", "الليالي فوق ~4°م؛ بلا صقيع متأخر")],
      activities: [
        L("Second nitrogen dose at jointing", "الجرعة الثانية من النيتروجين عند الفرق"),
        L("Scout for rust and aphids as stems rise", "مراقبة الصدأ والمن مع ارتفاع الساق"),
      ],
      waterSharePct: 20,
      waterAdvice: L(
        "Do not stress the crop: the future ear is already formed inside the stem.",
        "لا تجهد المحصول: السنبلة القادمة مكوّنة أصلًا داخل الساق."
      ),
    },
    {
      key: "maturation",
      name: L("Heading, flowering & grain filling", "طرد السنابل والتزهير وامتلاء الحبوب"),
      span: [0.6, 0.9],
      env: [
        L("Maxima below ~34°C during grain filling protect yield", "الحرارة القصوى دون ~34°م أثناء الامتلاء تحمي المحصول"),
        L("The most heat-sensitive stage of wheat", "أشد مراحل القمح حساسية للحرارة"),
      ],
      activities: [
        L("Final light nitrogen at heading", "جرعة نيتروجين خفيفة أخيرة عند الطرد"),
        L("Disease watch: yellow rust thrives in humid mornings", "مراقبة الأمراض: الصدأ الأصفر ينشط في الصباحات الرطبة"),
      ],
      waterSharePct: 40,
      waterAdvice: L(
        "Full irrigation through flowering and grain filling — the heaviest water stage.",
        "ري كامل عبر التزهير وامتلاء الحبوب — أثقل المراحل مائيًا."
      ),
    },
    {
      key: "harvest",
      name: L("Ripening & harvest", "النضج والحصاد"),
      span: [0.9, 1],
      env: [L("Dry finish for grain moisture below 14%", "نهاية جافة لرطوبة حبوب دون 14%")],
      activities: [
        L("Stop irrigation 2 weeks before harvest", "إيقاف الري قبل الحصاد بأسبوعين"),
        L("Combine harvest when grain is hard", "الحصاد الميكانيكي عند صلابة الحبوب"),
      ],
      waterSharePct: 7,
      waterAdvice: L(
        "Late water only delays harvest and raises grain moisture.",
        "الماء المتأخر يؤخر الحصاد ويرفع رطوبة الحبوب."
      ),
    },
  ],

  maize: [
    {
      key: "planting",
      name: L("Sowing", "البذر"),
      span: [0, 0.05],
      env: [
        L("Soil warm enough (≥ 18°C) for fast germination", "دفء التربة (≥ 18°م) لإنبات سريع"),
      ],
      activities: [
        L("Sow at 5–6 cm depth in warm soil", "بذر على عمق 5–6 سم في تربة دافئة"),
        L("Starter fertilizer beside the seed row", "سماد بادئ بجانب صف البذر"),
      ],
      waterSharePct: 5,
      waterAdvice: L(
        "Irrigate to settle soil around the seed, then wait for emergence.",
        "ري لتثبيت التربة حول البذرة ثم انتظار الظهور."
      ),
    },
    {
      key: "germination",
      name: L("Emergence & seedling", "الظهور والشتلة"),
      span: [0.05, 0.12],
      env: [L("Topsoil moist and crusted-free", "سطح رطب بلا قشرة")],
      activities: [
        L("Re-sow gaps within the first week", "إعادة بذر الفراغات في الأسبوع الأول"),
        L("Thin to one plant per hill", "خف إلى نبتة واحدة لكل جورة"),
      ],
      waterSharePct: 8,
      waterAdvice: L(
        "Light frequent irrigation; the seminal root is short.",
        "ري خفيف متكرر؛ الجذر البذري قصير."
      ),
    },
    {
      key: "vegetative",
      name: L("Leaf growth (vegetative)", "نمو الأوراق (الخضري)"),
      span: [0.12, 0.45],
      env: [
        L("Warm temperatures and full light drive leaf area", "الحرارة الدافئة والإضاءة الكاملة تدفع مساحة الأوراق"),
      ],
      activities: [
        L("Nitrogen split 1 at knee height", "الجرعة الأولى من النيتروجين عند ارتفاع الركبة"),
        L("Cultivate between rows for weeds and aeration", "خدمة بين الصفوف للحشائش والتهوية"),
      ],
      waterSharePct: 20,
      waterAdvice: L(
        "Regular irrigation builds the leaf factory that later fills the ear.",
        "الري المنتظم يبني المصنع الورقي الذي يملأ الكوز لاحقًا."
      ),
    },
    {
      key: "development",
      name: L("Tasseling & silking (critical)", "طرد الذكور وتبويب الإناث (الحرجة)"),
      span: [0.45, 0.6],
      env: [
        L("Days 21–30°C for viable pollen; days above ~35°C cause pollen death", "نهار 21–30°م لحبوب لقاح حية؛ فوق ~35°م يموت اللقاح"),
        L("The single most water-sensitive stage of maize", "أشد مراحل الذرة حساسية للماء"),
      ],
      activities: [
        L("Final nitrogen before tassels appear", "آخر نيتروجين قبل ظهور الطرز"),
        L("Do not spray insecticides on flowering fields when bees forage", "لا ترش مبيدات في حقول مزهره عند تردد النحل"),
      ],
      waterSharePct: 30,
      waterAdvice: L(
        "Never miss an irrigation here — 2–3 dry days at silking can cut yield by half.",
        "لا تفوّت أي ري هنا — يومان إلى ثلاثة جافة عند التبويب قد تُنصف المحصول."
      ),
    },
    {
      key: "maturation",
      name: L("Grain filling", "امتلاء الحبوب"),
      span: [0.6, 0.92],
      env: [L("Warm sunny days move sugar into the grain", "أيام مشمسة دافئة تنقل السكر إلى الحبوب")],
      activities: [
        L("Bird and fall-armyworm watch on the ears", "مراقبة الطيور ودودة الحرب الخريفية على الكوز"),
        L("Keep the canopy green as long as possible", "إبقاء المجموع أخضر أطول مدة ممكنة"),
      ],
      waterSharePct: 30,
      waterAdvice: L(
        "Stress now shows as light, chaffy ears — keep the schedule.",
        "الإجهاد الآن يظهر ككوزات خفيفة فارغة — حافظ على الجدول."
      ),
    },
    {
      key: "harvest",
      name: L("Dry-down & harvest", "الجفاف والحصاد"),
      span: [0.92, 1],
      env: [L("Grain moisture falls below 14% in dry air", "رطوبة الحبوب تهبط دون 14% في الجو الجاف")],
      activities: [
        L("Stop irrigation when kernels glaze", "إيقاف الري عند تزجّج الحبوب"),
        L("Harvest and store dry to avoid aflatoxin", "الحصاد والتخزين الجاف لتفادي الأفلاتوكسين"),
      ],
      waterSharePct: 7,
      waterAdvice: L(
        "No irrigation in the last two weeks — moisture only invites fungi.",
        "لا ري في آخر أسبوعين — الرطوبة تدعو الفطريات."
      ),
    },
  ],

  rice: [
    {
      key: "planting",
      name: L("Nursery & transplanting", "المشتل والشتل"),
      span: [0, 0.15],
      env: [
        L("Warm water (≥ 21°C) for nursery growth", "ماء دافئ (≥ 21°م) لنمو المشتل"),
        L("Clay basin puddled and levelled", "حوض طيني مثار ومسوّى"),
      ],
      activities: [
        L("Soak and pre-germinate seed; sow the nursery", "نقع البذور وإنباتها؛ بذر المشتل"),
        L("Puddle the field and level the basin", "إثارة الحوض وتسويته"),
        L("Transplant 25–30 day seedlings", "شتل شتلات عمر 25–30 يومًا"),
      ],
      waterSharePct: 12,
      waterAdvice: L(
        "Keep the nursery wet; flood the basin before transplanting.",
        "حافظ على بلل المشتل؛ واغمر الحوض قبل الشتل."
      ),
    },
    {
      key: "germination",
      name: L("Establishment & recovery", "التأسيس والاسترجاع"),
      span: [0.15, 0.25],
      env: [L("Standing shallow water after transplanting", "ماء ضحل راكد بعد الشتل")],
      activities: [
        L("Maintain 5 cm water depth", "الحفاظ على عمق ماء 5 سم"),
        L("First nitrogen dose 10 days after transplanting", "الجرعة الأولى من النيتروجين بعد الشتل بعشرة أيام"),
      ],
      waterSharePct: 10,
      waterAdvice: L(
        "Never let the basin dry — young rice cannot recover from drying.",
        "لا تدع الحوض يجف — الأرز الفتي لا يتعافى من الجفاف."
      ),
    },
    {
      key: "vegetative",
      name: L("Tillering (vegetative)", "التفريع (الخضري)"),
      span: [0.25, 0.55],
      env: [
        L("Warm days and warm nights speed tillering", "النهار والليل الدافئان يسرّعان التفريع"),
        L("Day temperatures above ~35°C reduce tiller survival", "حرارة النهار فوق ~35°م تقلل بقاء الفروع"),
      ],
      activities: [
        L("Second nitrogen dose at active tillering", "الجرعة الثانية عند التفريع النشط"),
        L("Weed control — aquatic weeds compete hard", "مكافحة الحشائش — الحشائش المائية تنافس بقوة"),
      ],
      waterSharePct: 25,
      waterAdvice: L(
        "Alternate 5 cm flooding with brief drying to boost root aeration.",
        "التناوب بين غمر 5 سم وجفاف قصير لتحفيز تهوية الجذور."
      ),
    },
    {
      key: "development",
      name: L("Panicle initiation & flowering", "بدء السنبلة والتزهير"),
      span: [0.55, 0.78],
      env: [
        L("Temperatures above ~35°C at flowering cause spikelet sterility", "الحرارة فوق ~35°م عند التزهير تسبب عقماً للسنابل"),
        L("The critical yield-forming stage", "المرحلة الحرجة المكوِّنة للمحصول"),
      ],
      activities: [
        L("Final nitrogen before panicle emergence", "آخر نيتروجين قبل ظهور السنابل"),
        L("Hold deeper water (10 cm) through flowering", "إبقاء ماء أعمق (10 سم) عبر التزهير"),
      ],
      waterSharePct: 35,
      waterAdvice: L(
        "Full flood without interruption — sterility from one dry day is permanent.",
        "غمر كامل دون انقطاع — العقم من يوم جاف واحد دائم."
      ),
    },
    {
      key: "maturation",
      name: L("Grain filling", "امتلاء الحبوب"),
      span: [0.78, 0.95],
      env: [L("Sunny warm days fill the grain quickly", "الأيام المشمسة الدافئة تملأ الحبوب بسرعة")],
      activities: [
        L("Drain gradually as grains harden", "تصريف تدريجي مع تصلب الحبوب"),
      ],
      waterSharePct: 15,
      waterAdvice: L(
        "Reduce water stepwise after full heading; complete drainage before harvest.",
        "تقليل الماء تدريجيًا بعد اكتمال الطرد؛ وتصريف تام قبل الحصاد."
      ),
    },
    {
      key: "harvest",
      name: L("Harvest", "الحصاد"),
      span: [0.95, 1],
      env: [L("Dry basin allows machines to enter", "الحوض الجاف يسمح بدخول الآلات")],
      activities: [
        L("Harvest at 20–22% grain moisture and dry promptly", "الحصاد عند رطوبة 20–22% وتجفيف فوري"),
        L("Plan the next crop quickly — rice fields lose structure when dry", "تخطيط المحصول التالي سريعًا — حقول الأرز تفقد بنيتها عند الجفاف"),
      ],
      waterSharePct: 3,
      waterAdvice: L(
        "No irrigation — field traffic needs a dry surface.",
        "لا ري — حركة الآلات تحتاج سطحًا جافًا."
      ),
    },
  ],

  tomato: [
    {
      key: "planting",
      name: L("Transplanting", "الشتل"),
      span: [0, 0.08],
      env: [
        L("Nursery seedlings 25–35 days old with 4–5 leaves", "شتلات مشتل عمر 25–35 يومًا بأربع إلى خمس أوراق"),
        L("Transplant in the cool part of the day", "الشتل في البرد النسبي من اليوم"),
      ],
      activities: [
        L("Raised beds with drip lines and mulch laid", "أحواض مرتفعة بخطوط تنقيط وتغطية جاهزة"),
        L("Transplant and drench with starter solution", "الشتل مع محلول بادئ"),
      ],
      waterSharePct: 10,
      waterAdvice: L(
        "Daily light irrigation until roots anchor — transplant shock is water stress.",
        "ري خفيف يوميًا حتى رسوخ الجذور — صدمة الشتل إجهاد مائي."
      ),
    },
    {
      key: "germination",
      name: L("Root establishment", "رسوخ الجذور"),
      span: [0.08, 0.2],
      env: [L("Days 21–29°C and nights 15–20°C favour establishment", "نهار 21–29°م وليل 15–20°م يناسبان الرسوخ")],
      activities: [
        L("Trellising: stakes and string lines up early", "التعريش: الأوتاد والخيوط مبكرًا"),
        L("First fertilizer through the drip", "أول تسميد عبر التنقيط"),
      ],
      waterSharePct: 12,
      waterAdvice: L(
        "Short frequent irrigations keep the root zone evenly moist.",
        "ريات قصيرة متكررة تُبقي منطقة الجذور رطبة بانتظام."
      ),
    },
    {
      key: "vegetative",
      name: L("Vine growth (vegetative)", "نموالنبات الخضري"),
      span: [0.2, 0.42],
      env: [
        L("Balanced growth: neither soft nor stunted vines", "نمو متوازن: لا نباتات طرية ولا متوقفة"),
        L("Humidity below ~70% keeps fungal pressure low", "رطوبة دون ~70% تبقي الضغط الفطري منخفضًا"),
      ],
      activities: [
        L("Prune side shoots and train stems", "تطويش الأفراز وتوجيه السيقان"),
        L("Scout whitefly and leaf miner", "مراقبة الذبابة البيضاء ونافقة الأوراق"),
      ],
      waterSharePct: 18,
      waterAdvice: L(
        "Steady moisture — alternating wet and dry splits fruit later.",
        "رطوبة ثابتة — تناوب البلل والجفاف يشقق الثمار لاحقًا."
      ),
    },
    {
      key: "development",
      name: L("Flowering & fruit set", "التزهير وعقد الثمار"),
      span: [0.42, 0.62],
      env: [
        L("Fruit set needs day 21–29°C, night 15–20°C", "عقد الثمار يحتاج نهارًا 21–29°م وليلًا 15–20°م"),
        L("Nights above ~24°C cause flower drop", "الليالي فوق ~24°م تسبب تساقط الأزهار"),
      ],
      activities: [
        L("Uniform weekly complete fertilizer", "تسميد أسبوعي منتظم ومتوازن"),
        L("Hive bees or hand vibrate trusses in closed houses", "نحل أو هزّ العناقيد يدويًا في البيوت المحمية"),
      ],
      waterSharePct: 25,
      waterAdvice: L(
        "Never stress the vines at flowering — one dry day drops the whole truss.",
        "لا تجهد النباتات عند التزهير — يوم جاف واحد يسقط العنقود كله."
      ),
    },
    {
      key: "maturation",
      name: L("Fruit growth & ripening", "نمو الثمار وتلوّنها"),
      span: [0.62, 0.9],
      env: [
        L("Avoid wetting the fruit — blossom-end rot and rot follow swings", "تجنب بلل الثمار — يتبعها التعفن القمي"),
      ],
      activities: [
        L("Support heavy trusses; pick at breaker stage for market", "دعم العناقيد الثقيلة؛ القطاف عند بدء التلوّن للتسويق"),
        L("Calcium feed to prevent blossom-end rot", "تغذية كالسيوم لتفادي تعفن الطرف الزهري"),
      ],
      waterSharePct: 28,
      waterAdvice: L(
        "Even moisture is the whole game — large swings crack and rot fruit.",
        "الرطوبة المنتظمة هي الأساس — التقلبات الكبيرة تشقق الثمار وتعفّنها."
      ),
    },
    {
      key: "harvest",
      name: L("Harvest rounds", "دورات الحصاد"),
      span: [0.9, 1],
      env: [L("Dry foliage at picking reduces post-harvest rot", "مجموع خضري جاف عند القطاف يقلل عفن ما بعد الحصاد")],
      activities: [
        L("Multiple picks every 3–5 days", "قطافات متعددة كل 3–5 أيام"),
        L("Grade and crate in shade", "الفرز والتعبئة في الظل"),
      ],
      waterSharePct: 7,
      waterAdvice: L(
        "Slightly reduce water near the end to raise soluble solids.",
        "خفض الماء قليلًا في النهاية لرفع المواد الصلبة الذائبة."
      ),
    },
  ],

  potato: [
    {
      key: "planting",
      name: L("Planting", "الزراعة"),
      span: [0, 0.08],
      env: [
        L("Sprouted seed tubers into cool soil", "درنات تقاوي مُنبتة في تربة باردة"),
        L("Soil temperature below ~25°C at planting depth", "حرارة التربة دون ~25°م عند عمق الزراعة"),
      ],
      activities: [
        L("Ridges formed and tubers placed 10 cm deep", "تكوين المصاطب ووضع الدرنات بعمق 10 سم"),
        L("Basal phosphorus in the ridge", "فوسفور أساسي في المصطبة"),
      ],
      waterSharePct: 8,
      waterAdvice: L(
        "Light irrigation to settle soil, then hold until emergence.",
        "ري خفيف لتثبيت التربة ثم انتظار الظهور."
      ),
    },
    {
      key: "germination",
      name: L("Emergence", "الظهور"),
      span: [0.08, 0.2],
      env: [L("Cool nights favour early leaf growth", "الليالي الباردة تناسب النمو الورقي المبكر")],
      activities: [
        L("Re-plant missing hills quickly", "إعادة زراعة الجور الفارغة سريعًا"),
        L("Pre-emergence weed control", "مكافحة حشائش قبل الظهور"),
      ],
      waterSharePct: 10,
      waterAdvice: L(
        "Moist but aerated soil — waterlogging rots the mother tuber.",
        "تربة رطبة ومهوّاة — الإشباع يُعفّن الدرنة الأم."
      ),
    },
    {
      key: "vegetative",
      name: L("Stolon & leaf growth", "نمو الأوراق والمدادات"),
      span: [0.2, 0.38],
      env: [
        L("Mean temperatures 15–20°C grow the best leaf canopy", "متوسطات 15–20°م تنمي أفضل مجموع ورقي"),
      ],
      activities: [
        L("First nitrogen split", "الجرعة الأولى من النيتروجين"),
        L("Earthing-up the ridges", "تكبيش المصاطب"),
      ],
      waterSharePct: 15,
      waterAdvice: L(
        "Build roots and leaves now — the tuber factory comes next.",
        "ابنِ الجذور والأوراق الآن — مصنع الدرنات قادم."
      ),
    },
    {
      key: "development",
      name: L("Tuber initiation & bulking", "بدء تكوين الدرنات وتضخّمها"),
      span: [0.38, 0.72],
      env: [
        L("Tuber bulking wants 15–25°C; declines above 25°C and stops near 29–30°C", "التضخّم يريد 15–25°م؛ يتراجع فوق 25°م ويتوقف قرب 29–30°م"),
        L("The yield-forming stage", "المرحلة المكوِّنة للمحصول"),
      ],
      activities: [
        L("Second nitrogen before bulking peaks", "الجرعة الثانية قبل ذروة التضخّم"),
        L("Monitor late blight after any humid spell", "مراقبة اللفحة المتأخرة بعد أي فترة رطبة"),
      ],
      waterSharePct: 45,
      waterAdvice: L(
        "The heaviest water stage — short dry spells here make knobbly, malformed tubers.",
        "أثقل المراحل مائيًا — جفاف قصير هنا يجعل درنات مشوهة ومتدرنة."
      ),
    },
    {
      key: "maturation",
      name: L("Maturation & skin set", "النضج وتصلب القشرة"),
      span: [0.72, 0.92],
      env: [L("Vines yellow as skins firm for storage", "اصفرار المجموع مع تصلب القشور للتخزين")],
      activities: [
        L("Reduce irrigation as vines senesce", "تقليل الري مع هرم المجموع"),
        L("Kill vines if market demands early", "إيقاف المجموع مبكرًا عند طلب السوق"),
      ],
      waterSharePct: 12,
      waterAdvice: L(
        "Taper water gradually — hard dry-off can crack growing tubers.",
        "خفض الماء تدريجيًا — التجفيف الحاد يشقق درنات نامية."
      ),
    },
    {
      key: "harvest",
      name: L("Lifting & curing", "القلع والمعالجة"),
      span: [0.92, 1],
      env: [L("Dry soil and dry weather for damage-free lifting", "تربة وجو جافان لقلع بلا تلف")],
      activities: [
        L("Stop irrigation 10–14 days before lifting", "إيقاف الري قبل القلع بـ 10–14 يومًا"),
        L("Cure tubers in shade then store cool and dark", "معالجة الدرنات في الظل ثم تخزينها باردة معتمة"),
      ],
      waterSharePct: 0,
      waterAdvice: L(
        "Zero water before lifting — wet tubers rot in storage.",
        "ماء صفر قبل القلع — الدرنات المبتلة تعفن في التخزين."
      ),
    },
  ],

  onion: [
    {
      key: "planting",
      name: L("Nursery sowing", "بذر المشتل"),
      span: [0, 0.15],
      env: [
        L("Cool establishment: September–October nurseries in Egypt", "إنشاء بارد: مشاتل سبتمبر–أكتوبر في مصر"),
        L("Fine moist nursery beds", "أحواض مشتل ناعمة رطبة"),
      ],
      activities: [
        L("Sow nursery seed densely", "بذر المشتل بكثافة"),
        L("Shade and mist the young seedlings", "تظليل ورشّ رقيق للشتلات الفتية"),
      ],
      waterSharePct: 5,
      waterAdvice: L(
        "Mist daily — onion seed is tiny and surface-sown.",
        "رشّ يومي — بذور البصل دقيقة وتُبذر سطحًا."
      ),
    },
    {
      key: "germination",
      name: L("Transplanting & establishment", "الشتل والتأسيس"),
      span: [0.15, 0.24],
      env: [L("Pencil-thick seedlings at 40–60 days", "شتلات بسماكة قلم عند 40–60 يومًا")],
      activities: [
        L("Transplant to final spacing in November", "الشتل بالمسافات النهائية في نوفمبر"),
        L("Light starter fertilizer with settling irrigation", "سماد بادئ خفيف مع ري التثبيت"),
      ],
      waterSharePct: 10,
      waterAdvice: L(
        "One settling irrigation, then hold — onion roots hate standing water.",
        "ري تثبيت واحد ثم انتظار — جذور البصل تكره الماء الراكد."
      ),
    },
    {
      key: "vegetative",
      name: L("Leaf development (vegetative)", "نمو الأوراق (الخضري)"),
      span: [0.24, 0.48],
      env: [
        L("Cool growing season builds the leaf factory", "موسم نمو بارد يبني المصنع الورقي"),
        L("Thrips pressure rises in hot dry windy weather", "ضغط التربس يرتفع في الجو الحار الجاف العاصف"),
      ],
      activities: [
        L("Nitrogen splits for leaf growth", "جرعات نيتروجين لنمو الأوراق"),
        L("Scout and control thrips weekly", "مراقبة ومكافحة أسبوعية للتربس"),
      ],
      waterSharePct: 20,
      waterAdvice: L(
        "Keep soil evenly moist — the shallow root zone dries fast.",
        "حافظ على رطوبة متوازنة — منطقة الجذور السطحية تجف سريعًا."
      ),
    },
    {
      key: "development",
      name: L("Bulbing (development)", "تكوين البصلة (التطوير)"),
      span: [0.48, 0.8],
      env: [
        L("Lengthening days trigger bulbing", "إطالة النهار تُحفّز تكوين البصلة"),
        L("Bulbing wants gradually warming 15–25°C", "التكوين يريد دفئًا متدرجًا 15–25°م"),
      ],
      activities: [
        L("Final nitrogen early — late N keeps bulbs thick-necked", "آخر نيتروجين مبكرًا — المتأخر يُبقي الرقبة سميكة"),
        L("Irrigate to swell bulbs steadily", "الري لتضخّم البصلات باستمرار"),
      ],
      waterSharePct: 45,
      waterAdvice: L(
        "Uniform moisture swells the bulb — swings split the skins.",
        "الرطوبة المنتظمة تضخّم البصلة — التقلبات تشقق الأغلفة."
      ),
    },
    {
      key: "maturation",
      name: L("Maturation & tops-down", "النضج وانبطاط القمم"),
      span: [0.8, 0.94],
      env: [L("Dry finish: necks soften and tops fall", "نهاية جافة: تلين الرقاب وتنبطح القمم")],
      activities: [
        L("Stop irrigation when 25–50% of tops fall", "إيقاف الري عند انبطاح 25–50% من القمم"),
        L("Undercut bulbs for skin set", "قلع سطحي للبصلات لتصلب القشرة"),
      ],
      waterSharePct: 12,
      waterAdvice: L(
        "Stop irrigation 2–3 weeks before harvest so bulbs cure and store well.",
        "إيقاف الري قبل الحصاد بأسبوعين–ثلاثة كي تنضج البصلة وتخزّن جيدًا."
      ),
    },
    {
      key: "harvest",
      name: L("Lifting & curing", "القلع والمعالجة"),
      span: [0.94, 1],
      env: [L("Dry weather for field curing", "جو جاف للمعالجة الحقلية")],
      activities: [
        L("Lift, field-cure 3–5 days, then bag or crate", "القلع والمعالجة الحقلية 3–5 أيام ثم التعبئة"),
        L("Grade by size for market", "الفرز حسب الحجم للتسويق"),
      ],
      waterSharePct: 0,
      waterAdvice: L(
        "No water at all — curing makes the storage skin.",
        "لا ماء إطلاقًا — المعالجة تصنع قشرة التخزين."
      ),
    },
  ],
};

export const STAGE_COLORS: Record<StageKey, string> = {
  planting: "#A98963",
  germination: "#C9A227",
  vegetative: "#3E8E5A",
  development: "#1E5B3C",
  maturation: "#7BAF8D",
  harvest: "#C0522F",
};

/* ---------------- month arithmetic ---------------- */

const MONTH_LENS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** day offset (0-based) from a start month → {month, third} with standard month lengths */
function offsetToMonth(
  startMonth: number,
  offsetDays: number
): { month: number; third: "early" | "mid" | "late" } {
  let m = startMonth;
  let d = 1 + offsetDays; // day within current month
  while (d > MONTH_LENS[m - 1]) {
    d -= MONTH_LENS[m - 1];
    m = (m % 12) + 1;
  }
  const third: "early" | "mid" | "late" =
    d <= 10 ? "early" : d <= 20 ? "mid" : "late";
  return { month: m, third };
}

const thirdLabel = (t: "early" | "mid" | "late", lang: "en" | "ar") =>
  lang === "ar"
    ? t === "early"
      ? "أوائل"
      : t === "mid"
        ? "منتصف"
        : "أواخر"
    : t === "early"
      ? "early"
      : t === "mid"
        ? "mid"
        : "late";

function monthsSpanned(
  startMonth: number,
  startDay: number,
  endDay: number
): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (let d = startDay; d < endDay; d += 7) {
    const { month } = offsetToMonth(startMonth, d);
    if (!seen.has(month)) {
      seen.add(month);
      out.push(month);
    }
  }
  // ensure the last month is included
  const { month: last } = offsetToMonth(startMonth, Math.max(0, endDay - 1));
  if (!seen.has(last)) out.push(last);
  return out;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/* ---------------- builder ---------------- */

export function buildCropCalendar(
  crop: CropRecord,
  monthly: MonthlyValue[],
  farm: FarmInput,
  /** optional actual planting date entered by the farmer, "YYYY-MM-DD" */
  actualPlantingDate?: string | null
): CropCalendar {
  const seasonMonths = SEASON_PLANTING_MONTHS[farm.season];
  const inSeasonMonth = crop.plantingMonths.find((m) =>
    seasonMonths.includes(m)
  );

  // validate an actual planting date (must parse and be a real calendar day);
  // anything invalid falls back to the recommended-window planning estimate
  let parsedDate: Date | null = null;
  if (actualPlantingDate) {
    const m = /^\d{4}-\d{2}-\d{2}$/.exec(actualPlantingDate.trim());
    if (m) {
      const d = new Date(`${actualPlantingDate.trim()}T00:00:00Z`);
      if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === actualPlantingDate.trim()) {
        parsedDate = d;
      }
    }
  }

  const plantMonth = parsedDate
    ? parsedDate.getUTCMonth() + 1
    : (inSeasonMonth ?? crop.plantingMonths[0]);
  const seasonMatch = inSeasonMonth !== undefined;
  const basis: "actual" | "planning" = parsedDate ? "actual" : "planning";
  const cycleDays = Math.round(
    (crop.durationDays[0] + crop.durationDays[1]) / 2
  );
  const templates = STAGE_TEMPLATES[crop.id] ?? STAGE_TEMPLATES.wheat;

  const stages: CalendarStage[] = templates.map((tpl) => {
    const startDay = Math.round(tpl.span[0] * cycleDays);
    const endDay = Math.round(tpl.span[1] * cycleDays);

    const from = offsetToMonth(plantMonth, startDay);
    const to = offsetToMonth(plantMonth, Math.max(0, endDay - 1));
    const monthLabel =
      startDay === 0 && tpl.key === "planting"
        ? L(
            `${monthName(from.month, "en")} — ${thirdLabel(from.third, "en")} planting window`,
            `${monthName(from.month, "ar")} — ${thirdLabel(from.third, "ar")} نافذة الزراعة`
          )
        : L(
            `${monthName(from.month, "en")} (${thirdLabel(from.third, "en")}) → ${monthName(to.month, "en")} (${thirdLabel(to.third, "en")})`,
            `${monthName(from.month, "ar")} (${thirdLabel(from.third, "ar")}) → ${monthName(to.month, "ar")} (${thirdLabel(to.third, "ar")})`
          );

    const months = monthsSpanned(plantMonth, startDay, endDay);

    // location-adapted climate note from the actual NASA climatology
    let climateNote: Bilingual | null = null;
    const maxes = months
      .map((m) => monthly[m - 1]?.t2mMax)
      .filter((v): v is number => v !== null && v !== undefined);
    const mins = months
      .map((m) => monthly[m - 1]?.t2mMin)
      .filter((v): v is number => v !== null && v !== undefined);
    const rains = months
      .map((m) => monthly[m - 1]?.precip)
      .filter((v): v is number => v !== null && v !== undefined);
    const means = months
      .map((m) => monthly[m - 1]?.t2m)
      .filter((v): v is number => v !== null && v !== undefined);

    if (maxes.length || mins.length) {
      const peakMax = maxes.length ? Math.max(...maxes) : null;
      const lowMin = mins.length ? Math.min(...mins) : null;
      const rainTotal = rains.length ? rains.reduce((a, b) => a + b, 0) : null;

      if (peakMax !== null && peakMax >= crop.temp.optMax) {
        climateNote = L(
          `NASA 365-day climatology for these months shows mean daily maxima peaking at ${round1(peakMax)}°C — above the documented optimum (${crop.temp.optMax}°C). Expect the highest water demand of the whole cycle here.`,
          `سجل ناسا لـ 365 يومًا لهذه الشهور يُظهر ذروة متوسطات اليومي القصوى ${round1(peakMax)}°م — فوق المدى الأمثل الموثق (${crop.temp.optMax}°م). توقّع أعلى احتياج مائي للدورة هنا.`
        );
      } else if (lowMin !== null && lowMin <= crop.temp.optMin - 3) {
        climateNote = L(
          `NASA climatology shows nights as low as ${round1(lowMin)}°C in these months — below the documented optimum minimum (${crop.temp.optMin}°C). Growth and establishment slow down.`,
          `سجل ناسا يُظهر ليالٍ تنزل إلى ${round1(lowMin)}°م في هذه الشهور — دون الحد الأدنى الأمثل الموثق (${crop.temp.optMin}°م). يتباطأ النمو والإنشاء.`
        );
      } else if (rainTotal !== null && rainTotal >= 20) {
        const rainMonth = months.find(
          (m) => (monthly[m - 1]?.precip ?? 0) >= 20
        );
        climateNote = L(
          `These months average about ${round1(rainTotal)} mm of rain${rainMonth ? ` (peak in ${monthName(rainMonth, "en")})` : ""} — check drainage and adjust irrigation timing.`,
          `تتوسط الأمطار في هذه الشهور نحو ${round1(rainTotal)} مم${rainMonth ? ` (الذروة في ${monthName(rainMonth, "ar")})` : ""} — افحص الصرف واضبط توقيت الري.`
        );
      } else if (means.length) {
        const meanT = means.reduce((a, b) => a + b, 0) / means.length;
        climateNote = L(
          `NASA 365-day climatology for these months: mean temperature ${round1(meanT)}°C — inside the documented range for this crop.`,
          `سجل ناسا لـ 365 يومًا لهذه الشهور: متوسط الحرارة ${round1(meanT)}°م — داخل المدى الموثق لهذا المحصول.`
        );
      }
    }

    return {
      key: tpl.key,
      name: tpl.name,
      startDay,
      endDay,
      dayLabel: `D ${startDay}–${endDay}`,
      monthLabel,
      months,
      env: tpl.env,
      activities: tpl.activities,
      waterSharePct: tpl.waterSharePct,
      waterAdvice: tpl.waterAdvice,
      climateNote,
    };
  });

  // ---------- location notes (from real data) ----------
  const notes: Bilingual[] = [];

  notes.push(
    seasonMatch
      ? L(
          `Planting month ${monthName(plantMonth, "en")} falls inside your selected ${SEASON[farm.season].en} season.`,
          `شهر الزراعة ${monthName(plantMonth, "ar")} يقع داخل موسمك المختار (${SEASON[farm.season].ar}).`
        )
      : L(
          `This crop is documented for planting in ${crop.plantingMonths.map((m) => monthName(m, "en")).join(", ")} — outside your selected ${SEASON[farm.season].en} season. The calendar below shows its typical cycle.`,
          `هذا المحصول موثق للزراعة في ${crop.plantingMonths.map((m) => monthName(m, "ar")).join("، ")} — خارج موسمك المختار (${SEASON[farm.season].ar}). يعرض التقويم أدناه دورته النموذجية.`
        )
  );

  const tMonths = monthly.filter((m) => m.t2mMax !== null);
  if (tMonths.length) {
    const hottest = tMonths.reduce((a, b) =>
      (b.t2mMax as number) > (a.t2mMax as number) ? b : a
    );
    const hotStages = stages.filter((s) => s.months.includes(hottest.month));
    notes.push(
        L(
          `The hottest month at your location is ${monthName(hottest.month, "en")} (mean daily max ${round1(hottest.t2mMax as number)}°C)${hotStages.length ? ` — it falls inside the ${hotStages.map((s) => s.name.en).join(" / ")} stage(s)` : ""}. Plan water and field work around it.`,
          `أشد شهور موقعك حرارة هو ${monthName(hottest.month, "ar")} (متوسط اليومي القصوى ${round1(hottest.t2mMax as number)}°م)${hotStages.length ? ` — ويقع داخل مرحلة ${hotStages.map((s) => s.name.ar).join(" / ")}` : ""}. خطّط الماء والأعمال الحقلية حوله.`
        )
    );
  }
  const cycleRain = stages
    .flatMap((s) => s.months)
    .reduce((acc, m) => {
      const v = monthly[m - 1]?.precip;
      return acc + (v ?? 0);
    }, 0) / 2; // months counted ~twice across overlapping stage boundaries
  notes.push(
    L(
      `Expected rainfall over the whole cycle ≈ ${round1(Math.max(0, cycleRain))} mm versus a documented requirement of ${crop.water.seasonNeedMm[0]}–${crop.water.seasonNeedMm[1]} mm — irrigation must supply the difference.`,
      `الهطول المتوقع عبر الدورة ≈ ${round1(Math.max(0, cycleRain))} مم مقابل احتياج موثق ${crop.water.seasonNeedMm[0]}–${crop.water.seasonNeedMm[1]} مم — يجب أن يغطي الري الفرق.`
    )
  );

  // "today" position within the cycle (only meaningful for an actual date)
  let todayStageKey: StageKey | null = null;
  let todayDayOffset: number | null = null;
  if (parsedDate) {
    const today = new Date();
    const todayUtc = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate()
    );
    const elapsed = Math.floor(
      (todayUtc - parsedDate.getTime()) / 86400000
    );
    if (elapsed >= 0 && elapsed < cycleDays) {
      todayDayOffset = elapsed;
      const stage = templates.find(
        (tpl) =>
          elapsed >= Math.round(tpl.span[0] * cycleDays) &&
          elapsed < Math.round(tpl.span[1] * cycleDays)
      );
      todayStageKey = stage?.key ?? null;
    }
  }

  const basisLabel: Bilingual = parsedDate
    ? L(
        `Calendar anchored to your actual planting date (${parsedDate
          .toISOString()
          .slice(0, 10)}) — stage timing below follows from that date.`,
        `التقويم مثبَّت على تاريخ زراعتك الفعلي (${parsedDate
          .toISOString()
          .slice(0, 10)}) — توقيت المراحل أدناه محسوب من هذا التاريخ.`
      )
    : L(
        "Planning estimate based on the recommended planting window and documented stage durations — enter your actual planting date to anchor the calendar to your field.",
        "تقدير تخطيطي مبني على نافذة الزراعة الموصى بها ومدد المراحل الموثقة — أدخل تاريخ زراعتك الفعلي لربط التقويم بحقلك."
      );

  const plantWindowLabel = parsedDate
    ? L(
        `Actual planting date entered: ${parsedDate.toISOString().slice(0, 10)}`,
        `تاريخ الزراعة الفعلي المُدخل: ${parsedDate.toISOString().slice(0, 10)}`
      )
    : L(
        `${monthName(plantMonth, "en")} (${crop.plantingMonths
          .map((m) => monthName(m, "en"))
          .join(" / ")} documented)`,
        `${monthName(plantMonth, "ar")} (${crop.plantingMonths
          .map((m) => monthName(m, "ar"))
          .join(" / ")} موثقة)`
      );

  return {
    cropId: crop.id,
    cropName: crop.name,
    scientificName: crop.scientificName,
    color: crop.color,
    icon: crop.icon,
    plantMonth,
    plantWindowLabel,
    plantMonthsAvailable: crop.plantingMonths,
    seasonMatch,
    seasonLabel: SEASON[farm.season],
    cycleDays,
    stages,
    waterNeedMm: crop.water.seasonNeedMm,
    waterCategoryLabel: crop.water.category,
    basis,
    plantDate: parsedDate ? parsedDate.toISOString().slice(0, 10) : null,
    basisLabel,
    todayStageKey,
    todayDayOffset,
    locationNotes: notes,
    dataNote: L(
      "Stage durations and activities are documented FAO/MALR crop-calendar patterns; climate notes are computed from the NASA POWER 365-day record retrieved for your coordinates. Timing is typical guidance, not a prediction for a specific year.",
      "مدد المراحل وأنشطتها أنماط موثقة من تقاويم FAO ووزارة الزراعة؛ والملاحظات المناخية محسوبة من سجل ناسا لـ 365 يومًا المجلوب لإحداثياتك. التوقيت إرشاد نموذجي لا تنبؤ بسنة بعينها."
    ),
  };
}
