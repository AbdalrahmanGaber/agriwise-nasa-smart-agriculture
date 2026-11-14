/**
 * Logic test for the two new feature engines (risk.ts, calendar.ts)
 * using REAL NASA POWER data fetched for Luxor (25.6998, 32.6476).
 */
import * as fs from "fs";
import { assessCropRisk, assessForecastWarnings } from "../src/lib/risk";
import { buildCropCalendar } from "../src/lib/calendar";
import { getCrop } from "../src/lib/crops";
import type { AnalysisResult, FarmInput, MonthlyValue } from "../src/lib/types";

const raw = JSON.parse(
  fs.readFileSync("/tmp/analyze_test.json", "utf-8")
) as AnalysisResult;

const farm: FarmInput = raw.farm;
const monthly = raw.monthly as MonthlyValue[];
const summary = raw.summary;

console.log("=== RISK ENGINE (Luxor, real NASA data) ===");
for (const id of ["sugarcane", "tomato", "wheat"]) {
  const crop = getCrop(id)!;
  const cr = raw.crops.find((c) => c.cropId === id)!;
  const report = assessCropRisk(monthly, summary, farm, crop, cr.windowMonths);
  console.log(`\n--- ${id} (overall: ${report.overall}) counts:`, report.counts);
  for (const f of report.findings) {
    console.log(
      `  [${f.level.padEnd(8)}] ${f.type.padEnd(15)} value=${f.value.padEnd(24)} thr=${f.threshold.en.slice(0, 46)}`
    );
  }
  if (report.unavailable.length)
    console.log("  unavailable:", report.unavailable.join(", "));
}

console.log("\n=== FORECAST WARNINGS (real 7-day forecast) ===");
const forecastDays = [
  { date: "2026-11-14", tmax: 32.1, tmin: 14.3, precip: 0, windMax: 1.4 },
  { date: "2026-11-15", tmax: 35.8, tmin: 15.0, precip: 0, windMax: 2.4 },
  { date: "2026-11-16", tmax: 37.2, tmin: 12.4, precip: 0, windMax: 9.7 },
  { date: "2026-11-17", tmax: 30.8, tmin: 4.2, precip: 0, windMax: 2.7 },
  { date: "2026-11-18", tmax: 28.5, tmin: 12.5, precip: 12.0, windMax: 5.3 },
];
for (const id of ["sugarcane", "wheat"]) {
  const crop = getCrop(id)!;
  const w = assessForecastWarnings(forecastDays, crop);
  console.log(`\n--- ${id}: ${w.length} warnings`);
  for (const x of w)
    console.log(
      `  [${x.level}] ${x.type} dates=${x.dates.join(",")} value=${x.value}`
    );
}

console.log("\n=== CROP CALENDAR (Luxor, real NASA data) ===");
const seasons = ["spring", "autumn", "winter"] as const;
for (const [id, season] of [
  ["sugarcane", "spring"],
  ["wheat", "winter"],
  ["tomato", "spring"],
] as const) {
  const crop = getCrop(id)!;
  const cal = buildCropCalendar(crop, monthly, { ...farm, season });
  console.log(
    `\n--- ${id}: plantMonth=${cal.plantMonth} seasonMatch=${cal.seasonMatch} cycle=${cal.cycleDays}d water=${cal.waterNeedMm.join("-")}mm`
  );
  for (const s of cal.stages) {
    console.log(
      `  ${s.key.padEnd(12)} D${s.startDay}-${s.endDay} (${String(s.months).padEnd(24)}) water=${s.waterSharePct}% note=${s.climateNote ? s.climateNote.en.slice(0, 60) : "—"}`
    );
  }
  console.log(
    "  locationNotes:",
    cal.locationNotes.map((n) => n.en.slice(0, 72))
  );
}

console.log("\nDONE");
