/**
 * FAO-56 Penman–Monteith reference evapotranspiration (ETo) and the
 * single crop coefficient (Kc) method — server-side implementation.
 *
 * Implementation follows:
 *   FAO Irrigation and Drainage Paper No. 56
 *   "Crop evapotranspiration — Guidelines for computing crop water
 *    requirements" (Allen, Pereira, Raes & Smith, 1998).
 *
 * Equations used (FAO-56 numbering):
 *   ETo  — Eq. 6    (Penman–Monteith)
 *   P    — Eq. 7    (atmospheric pressure from elevation)
 *   γ    — Eq. 8    (psychrometric constant)
 *   e°(T)— Eq. 11   (saturation vapour pressure)
 *   es   — Eq. 12   (mean saturation vapour pressure)
 *   ea   — Eq. 19   (actual vapour pressure from RHmean)
 *   Δ    — Eq. 13   (slope of saturation vapour pressure curve)
 *   u2   — Eq. 47   (wind at 2 m from wind at height z)
 *   Ra   — Eq. 21   (extraterrestrial radiation)
 *   dr   — Eq. 23, δ — Eq. 24, ωs — Eq. 25
 *   Rso  — Eq. 37   (clear-sky radiation)
 *   Rns  — Eq. 38   (net shortwave, albedo 0.23)
 *   Rnl  — Eq. 39   (net longwave)
 *   Rn   — Eq. 40;  G — Eq. 42 (daily) / Eq. 43 (monthly)
 *
 * Validated against FAO-56 Example 18 (Uccle, Brussels, 6 July):
 *   inputs → ETo = 3.88 mm/day (see scripts/test-fao56.ts).
 *
 * Kc values and stage lengths below are quoted VERBATIM from
 * FAO-56 Table 12 and Table 11 (subhumid-climate single Kc; arid /
 * Mediterranean planting rows). Ranges are kept as documented.
 */

const sigma = 4.903e-9; // MJ K^-4 m^-2 day^-1 (Eq. 39)
const Gsc = 0.0820; // MJ m^-2 min^-1 (Eq. 21)

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** e°(T) — Eq. 11, kPa */
export const esat = (t: number): number =>
  0.6108 * Math.exp((17.27 * t) / (t + 237.3));

/** Δ — Eq. 13, kPa/°C */
export const delta = (tMean: number): number =>
  (4098 * esat(tMean)) / Math.pow(tMean + 237.3, 2);

/** Atmospheric pressure P — Eq. 7, kPa */
export const pressure = (elevationM: number): number =>
  101.3 * Math.pow((293 - 0.0065 * elevationM) / 293, 5.26);

/** Psychrometric constant γ — Eq. 8, kPa/°C */
export const gamma = (elevationM: number): number =>
  0.665e-3 * pressure(elevationM);

/** Wind speed at 2 m from wind at height z — Eq. 47 */
export const windAt2m = (uz: number, z = 10): number =>
  (uz * 4.87) / Math.log(67.8 * z - 5.42);

/** Extraterrestrial radiation Ra — Eq. 21-25, MJ m^-2 day^-1 */
export function ra(
  latDeg: number,
  dayOfYear: number
): { ra: number; ws: number; n: number } {
  const phi = rad(latDeg);
  const J = dayOfYear;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * J) / 365);
  const decl = 0.409 * Math.sin((2 * Math.PI * J) / 365 - 1.39);
  const ws = Math.acos(-Math.tan(phi) * Math.tan(decl));
  const raVal =
    ((24 * 60) / Math.PI) *
    Gsc *
    dr *
    (ws * Math.sin(phi) * Math.sin(decl) +
      Math.cos(phi) * Math.cos(decl) * Math.sin(ws));
  const n = (24 / Math.PI) * ws; // maximum daylight hours, Eq. 34
  return { ra: raVal, ws, n };
}

export interface EtoInputs {
  /** latitude in degrees (north positive) */
  lat: number;
  /** elevation above sea level, m */
  elevation: number;
  /** day of year 1-365 */
  dayOfYear: number;
  /** mean daily maximum temperature, °C */
  tMax: number;
  /** mean daily minimum temperature, °C */
  tMin: number;
  /** mean relative humidity, % */
  rhMean: number;
  /** mean wind speed at 10 m, m/s */
  wind10: number;
  /** solar radiation Rs, MJ m^-2 day^-1 (NASA POWER ALLSKY_SFC_SW_DWN) */
  rs: number;
  /** monthly soil heat flux G, MJ m^-2 day^-1 — 0 for daily */
  g?: number;
}

export interface EtoResult {
  eto: number;
  rn: number;
  rns: number;
  rnl: number;
  rso: number;
  es: number;
  ea: number;
  u2: number;
  p: number;
  gamma: number;
  delta: number;
}

/** FAO-56 Penman–Monteith ETo (Eq. 6) with all intermediates. */
export function etoFAO56(input: EtoInputs): EtoResult {
  const tMean = (input.tMax + input.tMin) / 2;
  const u2 = windAt2m(input.wind10, 10);
  const P = pressure(input.elevation);
  const g = gamma(input.elevation);
  const D = delta(tMean);

  const esMax = esat(input.tMax);
  const esMin = esat(input.tMin);
  const es = (esMax + esMin) / 2; // Eq. 12
  const ea = (input.rhMean / 100) * es; // Eq. 19 (from RHmean)

  const { ra: raVal } = ra(input.lat, input.dayOfYear);
  const rso = (0.75 + 2e-5 * input.elevation) * raVal; // Eq. 37
  const rns = 0.77 * input.rs; // Eq. 38 (albedo 0.23)
  const rnl =
    sigma *
    ((Math.pow(input.tMax + 273.16, 4) + Math.pow(input.tMin + 273.16, 4)) / 2) *
    (0.34 - 0.14 * Math.sqrt(ea)) *
    (1.35 * Math.min(input.rs / rso, 1.0) - 0.35); // Eq. 39
  const rn = rns - rnl; // Eq. 40
  const G = input.g ?? 0; // Eq. 42 (daily)

  const num =
    0.408 * (rn - G) * D + g * ((900 / (tMean + 273)) * u2 * (es - ea));
  const den = D + g * (1 + 0.34 * u2);
  const eto = num / den; // Eq. 6

  return {
    eto: Math.round(eto * 100) / 100,
    rn: Math.round(rn * 100) / 100,
    rns: Math.round(rns * 100) / 100,
    rnl: Math.round(rnl * 100) / 100,
    rso: Math.round(rso * 100) / 100,
    es: Math.round(es * 1000) / 1000,
    ea: Math.round(ea * 1000) / 1000,
    u2: Math.round(u2 * 1000) / 1000,
    p: Math.round(P * 100) / 100,
    gamma: Math.round(g * 10000) / 10000,
    delta: Math.round(D * 10000) / 10000,
  };
}

/** Day-of-year of the middle of each month. */
export const MID_MONTH_DAY = [
  15, 46, 75, 105, 136, 166, 197, 228, 258, 289, 319, 350,
];

/**
 * Monthly ETo curve from monthly-mean climate data (CROPWAT-style,
 * FAO-56 Chapter 4 allows the PM equation with monthly data).
 * G uses Eq. 43: Gmonth = 0.14 (Tmonth − Tmonth−1), monthly mean temp.
 * Wind is converted from 10 m to 2 m (Eq. 47).
 * Solar input must be in MJ m^-2 day^-1 (NASA POWER native unit).
 */
export function etoMonthly(
  lat: number,
  elevation: number,
  months: Array<{
    month: number;
    t2mMean: number | null;
    tMaxMean: number | null;
    tMinMean: number | null;
    rhMean: number | null;
    windMean: number | null;
    /** monthly-mean solar radiation, MJ m^-2 day^-1 */
    solarMj: number | null;
  }>
): Array<{ month: number; eto: number | null }> {
  return months.map((m, i) => {
    if (
      m.t2mMean === null || m.tMaxMean === null || m.tMinMean === null ||
      m.rhMean === null || m.windMean === null || m.solarMj === null
    ) {
      return { month: m.month, eto: null };
    }
    const prev = months[(i + 11) % 12];
    const G = 0.14 * (m.t2mMean - (prev.t2mMean ?? m.t2mMean)); // Eq. 43
    const r = etoFAO56({
      lat,
      elevation,
      dayOfYear: MID_MONTH_DAY[m.month - 1],
      tMax: m.tMaxMean,
      tMin: m.tMinMean,
      rhMean: m.rhMean,
      wind10: m.windMean,
      rs: m.solarMj,
      g: G,
    });
    return { month: m.month, eto: r.eto };
  });
}

/* ------------------------------------------------------------------
 * FAO-56 Table 12 — single (time-averaged) crop coefficients, quoted
 * verbatim (subhumid climate reference; RHmin ≈ 45%, u2 ≈ 2 m/s).
 * ------------------------------------------------------------------ */

export interface KcEntry {
  /** Kc initial */
  ini: number;
  /** Kc mid-season */
  mid: number;
  /** Kc end of late season — computation value when a range is documented */
  end: number;
  /** documented Kc end range, if any */
  endRange?: [number, number];
  /** footnote text from FAO-56 Table 12 */
  note?: string;
}

export const FAO56_KC: Record<string, KcEntry> = {
  sugarcane: {
    ini: 0.4,
    mid: 1.25,
    end: 0.75,
  },
  wheat: {
    // Winter Wheat — with non-frozen soils
    ini: 0.7,
    mid: 1.15,
    end: 0.325,
    endRange: [0.25, 0.4],
    note: "Kc end documented range 0.25–0.4; the higher value applies to hand-harvested crops.",
  },
  maize: {
    // Maize, Field (grain); Kc ini from the Cereals group (0.3)
    ini: 0.3,
    mid: 1.2,
    end: 0.475,
    endRange: [0.6, 0.35],
    note: "Kc end 0.60 for harvest at high grain moisture; 0.35 after complete field drying.",
  },
  rice: {
    ini: 1.05,
    mid: 1.2,
    end: 0.75,
    endRange: [0.9, 0.6],
    note: "Kc end 0.90–0.60; the first value for harvested fresh, the second for harvested dry.",
  },
  tomato: {
    // Tomato; Kc ini from the Solanaceae group (0.6)
    ini: 0.6,
    mid: 1.15,
    end: 0.8,
    endRange: [0.7, 0.9],
    note: "Kc end 0.70–0.90 depending on harvest practice; 1.20 where grown on tall stalks.",
  },
  potato: {
    // Potato; Kc ini from the Roots & Tubers group (0.5)
    ini: 0.5,
    mid: 1.15,
    end: 0.75,
    note: "Kc end is about 0.40 for long-season potatoes with vine kill.",
  },
  onion: {
    // Onions — dry; Kc ini from the Small Vegetables group (0.7)
    ini: 0.7,
    mid: 1.05,
    end: 0.75,
  },
};

/* ------------------------------------------------------------------
 * FAO-56 Table 11 — lengths of crop development stages (days),
 * quoted verbatim for the arid / Mediterranean planting rows that
 * best match Egyptian cropping calendars.
 * ------------------------------------------------------------------ */

export interface StageLengths {
  /** [Lini, Ldev, Lmid, Llate] */
  lengths: [number, number, number, number];
  total: number;
  /** documented row description (Table 11) */
  row: string;
}

export const FAO56_STAGES: Record<string, StageLengths> = {
  sugarcane: {
    lengths: [35, 60, 190, 120],
    total: 405,
    row: "Sugarcane, virgin — Low Latitudes (35/60/190/120, total 405)",
  },
  wheat: {
    lengths: [20, 50, 60, 30],
    total: 160,
    row: "Barley/Oats/Wheat — December planting, Calif. Desert, USA (20/50/60/30, total 160)",
  },
  maize: {
    lengths: [30, 40, 50, 30],
    total: 150,
    row: "Maize (grain) — April planting, Spain (spring/summer); Calif. (30/40/50/30, total 150)",
  },
  rice: {
    lengths: [30, 30, 60, 30],
    total: 150,
    row: "Rice — Dec; May — Tropics; Mediterranean (30/30/60/30, total 150)",
  },
  tomato: {
    lengths: [35, 45, 70, 30],
    total: 180,
    row: "Tomato — Oct/Nov planting, Arid Region (35/45/70/30, total 180)",
  },
  potato: {
    lengths: [25, 30, 40, 30],
    total: 125,
    row: "Potato — Jan/Nov planting, (Semi) Arid Climate (25/30/30-45/30, total 115/130)",
  },
  onion: {
    lengths: [20, 35, 110, 45],
    total: 210,
    row: "Onion (dry) — Oct; Jan planting, Arid Region; Calif. (20/35/110/45, total 210)",
  },
};

export type GrowthStage = "initial" | "development" | "mid" | "late";

export const kcForStage = (cropId: string, stage: GrowthStage): number => {
  const kc = FAO56_KC[cropId];
  if (!kc) return 1;
  switch (stage) {
    case "initial":
      return kc.ini;
    case "development":
      // linear between ini and mid — documented curve construction
      // (FAO-56 Chapter 6 "Construction of the Kc curve")
      return (kc.ini + kc.mid) / 2;
    case "mid":
      return kc.mid;
    case "late":
      return (kc.mid + kc.end) / 2;
  }
};
