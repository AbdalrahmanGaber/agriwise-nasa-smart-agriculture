/**
 * Planting advisor engine test with REAL NASA POWER data for Luxor.
 * Validates: crop search, climatology/multi-year/recent fetch, monthly
 * scores, season assessment, and the Plant Now / Wait / Not Recommended
 * decision for several crops.
 */

import {
  fetchNasaClimatology,
  fetchNasaMultiYearDaily,
  fetchNasaRecent,
} from "../src/lib/nasa";
import { runPlantingAdvisor, resolveCrop, searchCrops } from "../src/lib/planting";
import { getCrop } from "../src/lib/crops";
import { MONTHS_EN } from "../src/lib/types";

let failures = 0;
const expect = (name: string, cond: boolean, detail = "") => {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

const LAT = 25.69, LNG = 32.64; // Luxor
const CURRENT_MONTH = 11; // November

async function main() {
  console.log("== crop search ==");
  expect("resolve 'sugarcane'", resolveCrop("sugarcane")?.id === "sugarcane");
  expect("resolve 'قصب السكر'", resolveCrop("قصب السكر")?.id === "sugarcane");
  expect("resolve 'corn'", resolveCrop("corn")?.id === "maize");
  expect("resolve 'طماطم'", resolveCrop("طماطم")?.id === "tomato");
  expect("resolve 'wheat'", resolveCrop("wheat")?.id === "wheat");
  expect("reject 'banana'", resolveCrop("banana") === null);
  expect(
    "autocomplete 'sug'",
    searchCrops("sug").some((c) => c.id === "sugarcane")
  );

  console.log("\n== NASA data fetch (Luxor) ==");
  const [clim, multi, recent] = await Promise.all([
    fetchNasaClimatology(LAT, LNG),
    fetchNasaMultiYearDaily(LAT, LNG, 3),
    fetchNasaRecent(LAT, LNG, 60),
  ]);
  expect("climatology baseline", /2001/.test(clim.baseline) || clim.baseline.length > 10, clim.baseline);
  expect("climatology 12 months", clim.months.length === 12);
  const july = clim.months.find((m) => m.month === 7)!;
  const jan = clim.months.find((m) => m.month === 1)!;
  expect("Luxor July mean ~30-34°C", (july.t2mMean ?? 0) > 30 && (july.t2mMean ?? 0) < 34, String(july.t2mMean));
  expect("Luxor January mean ~12-15°C", (jan.t2mMean ?? 0) > 11 && (jan.t2mMean ?? 0) < 16, String(jan.t2mMean));
  const july3 = multi.months.find((m) => m.month === 7)!;
  expect("3-yr July mean daily max 40-44°C", (july3.tMaxMean ?? 0) > 40 && (july3.tMaxMean ?? 0) < 44, String(july3.tMaxMean));
  expect("recent obs latest date exists", recent.latestObservationDate.length === 10, recent.latestObservationDate);
  console.log("   recent 60d: mean T2M =", recent.t2mMean?.toFixed(1), "°C; latest obs =", recent.latestObservationDate);

  const forecast = null; // decision must work without forecast too

  console.log("\n== sugarcane @ Luxor (Nov) ==");
  const cane = getCrop("sugarcane")!;
  const r1 = runPlantingAdvisor({
    crop: cane, lat: LAT, lng: LNG, label: "Luxor",
    currentMonth: CURRENT_MONTH, climatology: clim, multiYear: multi,
    recent, forecast,
  });
  console.log("   decision:", r1.decision.value, "| bestMonth:", r1.computed.bestMonth, "| target:", r1.decision.targetMonth);
  console.log("   months:", r1.months.map((m) => `${m.month}:${m.plantingScore}`).join(" "));
  console.log("   seasons:", r1.seasons.map((s) => `${s.season}:${s.bestScore}(${s.bestMonth})`).join(" "));
  expect("sugarcane decision is one of the three", ["plant_now","wait","not_recommended"].includes(r1.decision.value));
  expect("12 month rows", r1.months.length === 12);
  expect("recommended season exists", r1.computed.recommendedSeason !== null || r1.decision.value === "not_recommended");
  expect("heat stress text present", r1.current.heatStress !== null, r1.current.heatStress ? "yes" : "no");

  console.log("\n== potato @ Luxor (Jul) ==");
  const potato = getCrop("potato")!;
  const r2 = runPlantingAdvisor({
    crop: potato, lat: LAT, lng: LNG, label: "Luxor",
    currentMonth: 7, climatology: clim, multiYear: multi,
    recent, forecast,
  });
  console.log("   decision:", r2.decision.value, "| reasons[0]:", r2.decision.reasons[0]?.en?.slice(0, 90));
  console.log("   months:", r2.months.map((m) => `${MONTHS_EN[m.month-1]}:${m.plantingScore}`).join(" "));
  const julScore = r2.months[6].plantingScore;
  const novScore = r2.months[10].plantingScore;
  expect("potato July much worse than November", julScore < novScore - 15, `${julScore} vs ${novScore}`);
  expect("potato in July: wait or not_recommended", r2.decision.value !== "plant_now", r2.decision.value);

  console.log("\n== tomato @ Luxor (Sep) ==");
  const tomato = getCrop("tomato")!;
  const r3 = runPlantingAdvisor({
    crop: tomato, lat: LAT, lng: LNG, label: "Luxor",
    currentMonth: 9, climatology: clim, multiYear: multi,
    recent, forecast,
  });
  console.log("   decision:", r3.decision.value, "| bestMonth:", r3.computed.bestMonth);
  expect("tomato has at least one caution/suitable month", r3.months.some((m) => m.plantingScore >= 45));

  console.log("\n== wheat @ Luxor (Nov) ==");
  const wheat = getCrop("wheat")!;
  const r4 = runPlantingAdvisor({
    crop: wheat, lat: LAT, lng: LNG, label: "Luxor",
    currentMonth: 11, climatology: clim, multiYear: multi,
    recent, forecast,
  });
  console.log("   decision:", r4.decision.value, "| bestMonth:", r4.computed.bestMonth, "| recommended season:", r4.computed.recommendedSeason);
  expect("wheat best month in Nov-Feb window", [11, 12, 1, 2].includes(r4.computed.bestMonth ?? -1), String(r4.computed.bestMonth));

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("TEST CRASH:", e);
  process.exit(1);
});
