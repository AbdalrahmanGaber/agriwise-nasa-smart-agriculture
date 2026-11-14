/** Generate /tmp/analyze_test.json fixture for test-risk-calendar.ts */
import { fetchNasaDaily, aggregateMonthly, summarize } from "../src/lib/nasa";
import { runEngine } from "../src/lib/engine";
import * as fs from "fs";
import type { AnalysisResult, FarmInput } from "../src/lib/types";

async function main() {
  const lat = 25.6998, lng = 32.6476; // Luxor
  const { daily, periodStart, periodEnd } = await fetchNasaDaily(lat, lng);
  const monthly = aggregateMonthly(daily);
  const summary = summarize(daily, monthly);
  const farm: FarmInput = {
    soilType: "clay",
    waterAvailability: "moderate",
    season: "winter",
    farmSize: null,
    sizeUnit: "",
    irrigationMethod: "",
    notes: "",
  };
  const { crops, engine } = runEngine(monthly, summary, farm);
  const result = {
    meta: { provider: "NASA POWER", url: "https://power.larc.nasa.gov/", community: "AG", retrievedAt: new Date().toISOString(), periodStart, periodEnd, parameters: ["T2M"], coordinates: { lat, lng }, units: {} },
    location: { lat, lng, label: "Luxor", source: "search" },
    farm,
    monthly,
    summary,
    crops,
    engine,
    generatedAt: new Date().toISOString(),
  } as unknown as AnalysisResult;
  fs.writeFileSync("/tmp/analyze_test.json", JSON.stringify(result));
  console.log("fixture written");
}
main();
