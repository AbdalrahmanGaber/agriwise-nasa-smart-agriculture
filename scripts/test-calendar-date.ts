/**
 * Validation for the actual-planting-date support added to calendar.ts.
 * Run: bun scripts/test-calendar-date.ts
 */
import { buildCropCalendar } from "../src/lib/calendar";
import { CROPS } from "../src/lib/crops";
import type { AnalysisResult } from "../src/lib/types";
import * as fs from "fs";

const result = JSON.parse(
  fs.readFileSync("/tmp/analyze_test.json", "utf-8")
) as AnalysisResult;

const wheat = CROPS.find((c) => c.id === "wheat")!;
const monthly = result.monthly;
const farm = result.farm;

const todayIso = new Date().toISOString().slice(0, 10);

// 1. planning estimate (no date)
const planning = buildCropCalendar(wheat, monthly, farm, null);
console.log(
  "planning basis:",
  planning.basis,
  "| plantMonth:",
  planning.plantMonth,
  "| plantDate:",
  planning.plantDate,
  "| todayStageKey:",
  planning.todayStageKey
);
if (planning.basis !== "planning" || planning.plantDate !== null || planning.todayStageKey !== null) {
  throw new Error("FAIL: planning calendar should have no actual date / today marker");
}

// 2. actual date = today → should be in the "planting" stage (day 0)
const today = buildCropCalendar(wheat, monthly, farm, todayIso);
console.log(
  "actual (today) basis:",
  today.basis,
  "| plantMonth:",
  today.plantMonth,
  "| plantDate:",
  today.plantDate,
  "| todayStageKey:",
  today.todayStageKey,
  "| dayOffset:",
  today.todayDayOffset
);
if (today.basis !== "actual" || today.plantDate !== todayIso) {
  throw new Error("FAIL: actual calendar basis/plantDate wrong");
}
if (today.todayStageKey !== "planting" || today.todayDayOffset !== 0) {
  throw new Error(`FAIL: expected planting/day 0, got ${today.todayStageKey}/${today.todayDayOffset}`);
}

// 3. actual date 100 days ago → stage should be a mid-cycle stage
const past = new Date(Date.now() - 100 * 86400000).toISOString().slice(0, 10);
const mid = buildCropCalendar(wheat, monthly, farm, past);
const elapsedExpected = 100;
console.log(
  "actual (100d ago): stage:",
  mid.todayStageKey,
  "| dayOffset:",
  mid.todayDayOffset,
  "(wheat cycle:",
  mid.cycleDays,
  "d)"
);
if (mid.todayDayOffset !== elapsedExpected) {
  throw new Error(`FAIL: day offset ${mid.todayDayOffset} != ${elapsedExpected}`);
}
const stage = mid.stages.find((s) => s.key === mid.todayStageKey);
if (!stage || mid.todayDayOffset! < stage.startDay || mid.todayDayOffset! >= stage.endDay) {
  throw new Error("FAIL: todayDayOffset not inside the returned stage span");
}

// 4. future date → no today marker
const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
const fut = buildCropCalendar(wheat, monthly, farm, future);
if (fut.todayStageKey !== null || fut.todayDayOffset !== null) {
  throw new Error("FAIL: future date must not produce a today marker");
}
console.log("future date → no today marker: OK");

// 5. invalid date → falls back to planning
const bad = buildCropCalendar(wheat, monthly, farm, "2026-02-30");
if (bad.basis !== "planning") throw new Error("FAIL: invalid date should fall back to planning");
console.log("invalid date (2026-02-30) → planning fallback: OK");

// 6. date far in the past (> cycle) → no marker
const old = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10);
const oldCal = buildCropCalendar(wheat, monthly, farm, old);
if (oldCal.todayStageKey !== null) throw new Error("FAIL: cycle-over date must not produce a marker");
console.log("400d-old date → no today marker: OK");

console.log("\nALL CALENDAR DATE CHECKS PASSED");
