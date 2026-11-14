/** Shared bilingual UI labels for enums used across engine + views. */

import type { Bilingual, FactorKey, IrrigationMethod, Season, SoilType, WaterAvailability } from "./types";
import { L } from "./types";

export const SOIL_LABELS: Record<SoilType, Bilingual> = {
  clay: L("Clay soil", "تربة طينية"),
  sandy: L("Sandy soil", "تربة رملية"),
  loam: L("Loamy soil", "تربة طميية (متوازنة)"),
  other: L("Other", "أخرى"),
  unknown: L("Unknown", "غير معروف"),
};

export const WATER_LABELS: Record<WaterAvailability, Bilingual> = {
  limited: L("Limited", "محدود"),
  moderate: L("Moderate", "متوسط"),
  abundant: L("Abundant", "وفير"),
};

export const SEASON_LABELS: Record<Season, Bilingual> = {
  summer: L("Summer", "الصيفي"),
  winter: L("Winter", "الشتوي"),
  spring: L("Spring", "الربيعي"),
  autumn: L("Autumn", "الخريفي"),
};

export const IRRIGATION_LABELS: Record<IrrigationMethod, Bilingual> = {
  flood: L("Flood irrigation", "الري بالغمر"),
  drip: L("Drip irrigation", "الري بالتنقيط"),
  sprinkler: L("Sprinkler irrigation", "الري بالرش"),
  other: L("Other", "أخرى"),
  "": L("Not specified", "غير محدد"),
};

export const WATER_CATEGORY_LABELS: Record<
  "low" | "medium" | "high" | "very-high",
  Bilingual
> = {
  low: L("Low", "منخفض"),
  medium: L("Medium", "متوسط"),
  high: L("High", "مرتفع"),
  "very-high": L("Very high", "مرتفع جدًا"),
};

export const FACTOR_LABELS: Record<FactorKey, Bilingual> = {
  temperature: L("Temperature suitability", "ملاءمة درجات الحرارة"),
  water: L("Water & irrigation", "الماء والري"),
  solar: L("Solar radiation", "الإشعاع الشمسي"),
  soil: L("Soil compatibility", "ملاءمة التربة"),
  season: L("Planting season", "موسم الزراعة"),
  humidity: L("Relative humidity", "الرطوبة النسبية"),
  wind: L("Wind exposure", "التعرض للرياح"),
};
