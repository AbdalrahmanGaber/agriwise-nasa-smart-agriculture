/**
 * AgriWise crop database.
 *
 * REQUIREMENTS ARE DOCUMENTED RANGES synthesized from:
 *  - FAO EcoCrop database (ecocrop.fao.org) — temperature / rainfall / soil ranges
 *  - FAO Irrigation & Drainage Paper 33 "Crop Water Requirements"
 *    (Doorenbos & Pruitt, 1977; Doorenbos & Kassam, 1979) — seasonal water needs
 *  - FAO Irrigation Water Management, Training Manual 3
 *    (Brouwer & Heibloem, 1986) — crop water needs & sensitivity
 *  - FAO I&D Paper 56 (Allen et al., 1998) — reference ET methodology
 *  - Egyptian Ministry of Agriculture & Land Reclamation (MALR) extension
 *    crop calendars — planting seasons and durations for Egypt
 *
 * Values are expressed as documented RANGES, not precise field measurements.
 * Farmers should verify with their local agricultural extension office.
 * The database is designed to be expandable: append new records to CROPS.
 */

import type { Bilingual, Season, SoilType } from "./types";
import { L } from "./types";

export interface CropRecord {
  id: string;
  name: Bilingual;
  scientificName: string;
  /** lucide-react icon name used by the UI */
  icon: string;
  /** decorative accent color */
  color: string;
  /** Temperature requirements °C */
  temp: {
    /** absolute minimum mean temperature for survival */
    absMin: number;
    /** documented optimum range */
    optMin: number;
    optMax: number;
    /** absolute maximum mean temperature tolerance */
    absMax: number;
  };
  water: {
    category: "low" | "medium" | "high" | "very-high";
    /** documented seasonal water requirement, mm per growing cycle */
    seasonNeedMm: [number, number];
    /** whether the crop is commonly rainfed worldwide */
    rainfedPossible: boolean;
  };
  /** Solar radiation, kWh/m²/day */
  solar: { optMin: number; optMax: number };
  /** Soil match scores 0-100 per farmer-selected soil type */
  soil: Partial<Record<Exclude<SoilType, "unknown">, number>>;
  /** documented soil preference note */
  soilNote: Bilingual;
  /** suitable planting seasons in Egypt */
  seasons: Season[];
  /** typical Egyptian planting months (1-12) */
  plantingMonths: number[];
  /** growth duration, days */
  durationDays: [number, number];
  /** relative humidity preference, % */
  humidity: { optMin: number; optMax: number };
  /** mean wind speed above which problems (lodging, evaporation) rise, m/s */
  windTolerance: number;
  /** important growth conditions (documented) */
  growthNotes: Bilingual[];
  /** common environmental limitations (documented) */
  limitationNotes: Bilingual[];
  /** reference keys — see Data Sources view */
  references: string[];
}

export const CROPS: CropRecord[] = [
  {
    id: "sugarcane",
    name: L("Sugarcane", "قصب السكر"),
    scientificName: "Saccharum officinarum",
    icon: "Sprout",
    color: "#3E8E5A",
    temp: { absMin: 15, optMin: 22, optMax: 32, absMax: 40 },
    water: {
      category: "very-high",
      seasonNeedMm: [1500, 2500],
      rainfedPossible: false,
    },
    solar: { optMin: 5.5, optMax: 8 },
    soil: { loam: 100, clay: 85, sandy: 40, other: 55 },
    soilNote: L(
      "Deep, well-drained loam to clay-loam soils with good water holding capacity.",
      "أراضٍ طميية إلى طينية-طميية عميقة جيدة التصريف ذات قدرة عالية على حفظ الماء."
    ),
    seasons: ["spring", "autumn", "summer"],
    plantingMonths: [3, 9, 2],
    durationDays: [300, 360],
    humidity: { optMin: 45, optMax: 85 },
    windTolerance: 4,
    growthNotes: [
      L(
        "Long-duration perennial crop occupying the land for about a full year; solar radiation is the main yield driver.",
        "محصول معمّر طويل الموسم يشغل الأرض نحو سنة كاملة، والإشعاع الشمسي هو المحرك الرئيسي للمحصول."
      ),
      L(
        "Growth stops below about 15°C; high temperatures accelerate ripening.",
        "يتوقف النمو تحت نحو 15°م، ودرجات الحرارة المرتفعة تُسرّع النضج."
      ),
    ],
    limitationNotes: [
      L(
        "Very high water requirement — needs abundant, reliable irrigation across the whole year.",
        "احتياج مائي مرتفع جدًا — يحتاج ريًّا وفيرًا وموثوقًا طوال العام."
      ),
      L(
        "Susceptible to lodging under strong sustained winds.",
        "معرّض للانكسار (الرقود) مع الرياح القوية المستمرة."
      ),
    ],
    references: ["fao-ecocrop", "fao-33", "malr"],
  },
  {
    id: "wheat",
    name: L("Wheat", "القمح"),
    scientificName: "Triticum aestivum",
    icon: "Wheat",
    color: "#C9A227",
    temp: { absMin: 4, optMin: 15, optMax: 24, absMax: 35 },
    water: {
      category: "medium",
      seasonNeedMm: [450, 650],
      rainfedPossible: true,
    },
    solar: { optMin: 3.5, optMax: 7 },
    soil: { loam: 100, clay: 85, sandy: 45, other: 55 },
    soilNote: L(
      "Best on well-drained loam; medium-textured soils; tolerates clay if drainage is good.",
      "يُفضّل الأراضي الطميية جيدة التصريف؛ يتحمل الأراضي الطينية إذا كان التصريف جيدًا."
    ),
    seasons: ["winter"],
    plantingMonths: [11, 12],
    durationDays: [120, 160],
    humidity: { optMin: 40, optMax: 75 },
    windTolerance: 5,
    growthNotes: [
      L(
        "Cool-season cereal; Egyptian winter wheat is sown in November–December and harvested in April–May.",
        "محصول حبوب شتوي؛ يُزرع قمح مصر في نوفمبر–ديسمبر ويُحصد في أبريل–مايو."
      ),
      L(
        "Mild winter temperatures during tillering and grain filling are the key yield factors.",
        "اعتدال حرارة الشتاء أثناء التفريع وطرد السنابل هو العامل الحاسم للمحصول."
      ),
    ],
    limitationNotes: [
      L(
        "Terminal heat stress: maximum temperatures above ~34°C during grain filling sharply reduce yield.",
        "إجهاد حراري نهائي: درجات الحرارة القصوى فوق ~34°م أثناء امتلاء الحبوب تقلّل المحصول بشدة."
      ),
      L(
        "Sensitive to waterlogging in heavy soils.",
        "حساس لتشبّع الأرض بالماء في الأراضي الثقيلة."
      ),
    ],
    references: ["fao-ecocrop", "fao-33", "fao-brouwer", "malr"],
  },
  {
    id: "maize",
    name: L("Maize", "الذرة"),
    scientificName: "Zea mays",
    icon: "Leaf",
    color: "#E9A23B",
    temp: { absMin: 10, optMin: 21, optMax: 30, absMax: 38 },
    water: {
      category: "high",
      seasonNeedMm: [500, 800],
      rainfedPossible: true,
    },
    solar: { optMin: 4.5, optMax: 8 },
    soil: { loam: 100, clay: 70, sandy: 55, other: 55 },
    soilNote: L(
      "Well-drained loam with good fertility; sandy soils need split irrigation and fertilizer doses.",
      "أراضٍ طميية جيدة التصريف والخصوبة؛ الأراضي الرملية تحتاج تقسيم الري على دفعات وتقسيم التسميد."
    ),
    seasons: ["summer", "spring"],
    plantingMonths: [5, 6, 3],
    durationDays: [90, 120],
    humidity: { optMin: 40, optMax: 75 },
    windTolerance: 5,
    growthNotes: [
      L(
        "Summer C4 cereal; the critical period is tasseling–silking, about 50–60 days after sowing.",
        "حبوب صيفية (C4)؛ الفترة الحرجة هي طرد الذكور–قبول الإناث بعد البذر بنحو 50–60 يومًا."
      ),
      L(
        "High light and warm temperatures drive productivity.",
        "الإضاءة العالية والحرارة الدافئة تدفع الإنتاجية."
      ),
    ],
    limitationNotes: [
      L(
        "Pollination fails under heat: day temperatures above ~35°C at silking cause poor kernel set.",
        "يختل التلقيح بالحرارة: درجات النهار فوق ~35°م وقت قبول الإناث تُسبب ضعف عقد الحبوب."
      ),
      L(
        "Very sensitive to water shortage during flowering.",
        "حساس جدًا لنقص الماء أثناء التزهير."
      ),
    ],
    references: ["fao-ecocrop", "fao-33", "malr"],
  },
  {
    id: "rice",
    name: L("Rice", "الأرز"),
    scientificName: "Oryza sativa",
    icon: "Waves",
    color: "#5F8D6B",
    temp: { absMin: 15, optMin: 22, optMax: 32, absMax: 37 },
    water: {
      category: "very-high",
      seasonNeedMm: [900, 1600],
      rainfedPossible: false,
    },
    solar: { optMin: 5, optMax: 8 },
    soil: { clay: 100, loam: 60, sandy: 15, other: 40 },
    soilNote: L(
      "Heavy clay soils that hold ponded water; sandy soils are unsuitable for flooded culture.",
      "أراضٍ طينية ثقيلة تحتفظ بالماء الغمر؛ الأراضي الرملية غير مناسبة للزراعة الغمرية."
    ),
    seasons: ["summer"],
    plantingMonths: [5, 6],
    durationDays: [120, 150],
    humidity: { optMin: 55, optMax: 90 },
    windTolerance: 4,
    growthNotes: [
      L(
        "Semi-aquatic crop normally grown flooded; clay soils with abundant water are essential.",
        "محصول شبه مائي يُزرع غمرًا؛ الأراضي الطينية والماء الوفير شرط أساسي."
      ),
      L(
        "Warm nights and high humidity favor growth.",
        "الليالي الدافئة والرطوبة العالية تُناسب نموه."
      ),
    ],
    limitationNotes: [
      L(
        "Extreme water scarcity risk: flooded rice is the most water-demanding field crop.",
        "خطر شُحّ المياه الشديد: الأرز الغمري أكثر المحاصيل الحقلية استهلاكًا للماء."
      ),
      L(
        "Temperatures above ~35°C at flowering cause spikelet sterility; strong winds at flowering also reduce set.",
        "الحرارة فوق ~35°م وقت التزهير تسبب عقْدًا ضعيفًا للسنابل؛ والرياح القوية وقت التزهير تقلل العقد أيضًا."
      ),
    ],
    references: ["fao-ecocrop", "fao-33", "fao-brouwer", "malr"],
  },
  {
    id: "tomato",
    name: L("Tomatoes", "الطماطم"),
    scientificName: "Solanum lycopersicum",
    icon: "Apple",
    color: "#C0522F",
    temp: { absMin: 10, optMin: 18, optMax: 27, absMax: 35 },
    water: {
      category: "medium",
      seasonNeedMm: [400, 600],
      rainfedPossible: false,
    },
    solar: { optMin: 4, optMax: 7 },
    soil: { loam: 100, sandy: 70, clay: 55, other: 55 },
    soilNote: L(
      "Well-drained loam or sandy-loam; heavy clay raises disease and root problems.",
      "أراضٍ طميية أو رملية-طميية جيدة التصريف؛ الطين الثقيل يزيد أمراض الجذور."
    ),
    seasons: ["spring", "autumn", "winter"],
    plantingMonths: [2, 3, 9, 10],
    durationDays: [90, 150],
    humidity: { optMin: 50, optMax: 70 },
    windTolerance: 5,
    growthNotes: [
      L(
        "Fruit set requires moderate temperatures: day 21–29°C and night 15–20°C.",
        "عقد الثمار يحتاج حرارة معتدلة: نهار 21–29°م وليل 15–20°م."
      ),
      L(
        "Drip irrigation with mulching is the standard modern practice for water efficiency.",
        "الري بالتنقيط مع التغطية (المالش) هو الممارسة الحديثة القياسية لترشيد الماء."
      ),
    ],
    limitationNotes: [
      L(
        "Heat stress: days above ~32°C or nights above ~24°C cause flower drop and poor fruit set.",
        "إجهاد حراري: نهار فوق ~32°م أو ليل فوق ~24°م يسبب تساقط الأزهار وضعف عقد الثمار."
      ),
      L(
        "High humidity above ~70–75% sharply raises fungal disease pressure (early/late blight).",
        "الرطوبة العالية فوق ~70–75% ترفع بشدة ضغط الأمراض الفطرية (اللفحة المبكرة والمتأخرة)."
      ),
    ],
    references: ["fao-ecocrop", "fao-33", "fao-brouwer", "malr"],
  },
  {
    id: "potato",
    name: L("Potatoes", "البطاطس"),
    scientificName: "Solanum tuberosum",
    icon: "Carrot",
    color: "#A98963",
    temp: { absMin: 7, optMin: 15, optMax: 25, absMax: 32 },
    water: {
      category: "medium",
      seasonNeedMm: [400, 600],
      rainfedPossible: true,
    },
    solar: { optMin: 4, optMax: 6.5 },
    soil: { sandy: 90, loam: 85, clay: 50, other: 50 },
    soilNote: L(
      "Sandy loam is ideal for uniform tubers; heavy clay deforms tubers and retains disease.",
      "الأراضي الرملية-الطميية مثالية لدرنات منتظمة؛ الطين الثقيل يشوّه الدرنات ويحفظ الأمراض."
    ),
    seasons: ["winter", "spring", "autumn"],
    plantingMonths: [11, 12, 1, 2, 9],
    durationDays: [90, 120],
    humidity: { optMin: 55, optMax: 80 },
    windTolerance: 5,
    growthNotes: [
      L(
        "Tuber formation is strongly temperature-dependent: bulking declines above 25°C and essentially stops near 29–30°C.",
        "تكوين الدرنات يعتمد بشدة على الحرارة: النمو يتراجع فوق 25°م ويتوقف فعليًا قرب 29–30°م."
      ),
      L(
        "Egyptian calendar: winter planting Nov–Dec, spring planting Jan–Feb, autumn (Nili) September.",
        "التقويم المصري: الزراعة الشتوية نوفمبر–ديسمبر، والربيعية يناير–فبراير، والنيلية في سبتمبر."
      ),
    ],
    limitationNotes: [
      L(
        "Not suitable for the hot summer season in Upper Egypt — heat stops tuber formation.",
        "غير مناسب للموسم الصيفي في الصعيد — الحرارة توقف تكوين الدرنات."
      ),
      L(
        "Water stress during tuber bulking causes knobbly, malformed tubers.",
        "نقص الماء أثناء تكوين الدرنات يسبب درنات مشوهة."
      ),
    ],
    references: ["fao-ecocrop", "fao-33", "fao-brouwer", "malr"],
  },
  {
    id: "onion",
    name: L("Onions", "البصل"),
    scientificName: "Allium cepa",
    icon: "Citrus",
    color: "#8C7A4B",
    temp: { absMin: 7, optMin: 13, optMax: 25, absMax: 32 },
    water: {
      category: "low",
      seasonNeedMm: [350, 550],
      rainfedPossible: true,
    },
    solar: { optMin: 5, optMax: 7.5 },
    soil: { loam: 95, sandy: 85, clay: 55, other: 50 },
    soilNote: L(
      "Sandy-loam to loam with good drainage; compacted or crusty soils reduce bulb expansion.",
      "أراضٍ رملية-طميية إلى طميية جيدة التصريف؛ الأراضي المتماسكة تقلّل انتفاخ البصلة."
    ),
    seasons: ["winter", "autumn"],
    plantingMonths: [10, 11],
    durationDays: [150, 180],
    humidity: { optMin: 40, optMax: 70 },
    windTolerance: 6,
    growthNotes: [
      L(
        "Cool establishment then gradually warming, long days for bulb development.",
        "إنشاء بارد ثم إطالة النهار وارتفاع تدريجي للحرارة لنمو البصلة."
      ),
      L(
        "Egyptian calendar: nursery sowing September–October, transplanting November, harvest March–May.",
        "التقويم المصري: المشتل في سبتمبر–أكتوبر، والشتل في نوفمبر، والحصاد من مارس إلى مايو."
      ),
    ],
    limitationNotes: [
      L(
        "High temperatures during bulbing cause bolting risk and small bulbs; thrips pressure rises in hot dry windy weather.",
        "الحرارة المرتفعة أثناء تكوين البصلة تزيد خطر السرحان وصغر الحجم؛ ويرتفع ضغط التربس في الجو الحار الجاف العاصف."
      ),
      L(
        "Water shortage during bulb growth sharply reduces final bulb size.",
        "نقص الماء أثناء نمو البصلة يقلل حجمها النهائي بشدة."
      ),
    ],
    references: ["fao-ecocrop", "fao-33", "fao-brouwer", "malr"],
  },
];

export const getCrop = (id: string) => CROPS.find((c) => c.id === id);
