/** Quick engine test with real NASA POWER data (Luxor). Run: bun scripts/test-engine.ts */
import { fetchNasaDaily, aggregateMonthly, summarize } from "../src/lib/nasa";
import { runEngine } from "../src/lib/engine";
import type { FarmInput } from "../src/lib/types";

async function main() {
  const lat = 25.6872, lng = 32.6395;
  const { daily, periodStart, periodEnd } = await fetchNasaDaily(lat, lng);
  const monthly = aggregateMonthly(daily);
  const summary = summarize(daily, monthly);
  console.log("Period:", periodStart, "→", periodEnd);
  console.log("Annual rain mm:", summary.annualRainfallMm.toFixed(1));
  console.log("Mean annual T:", summary.meanAnnualTempC.toFixed(1));
  console.log("Hottest month:", summary.hottestMonth, summary.hottestMonthMeanC.toFixed(1));
  console.log("Coldest month:", summary.coldestMonth, summary.coldestMonthMeanC.toFixed(1));
  console.log("Extreme max:", summary.extremeMaxC, "Extreme min:", summary.extremeMinC);
  console.log("Coverage:", (summary.coverageOverall * 100).toFixed(1) + "%");
  console.log("Monthly T2M:", monthly.map(m => `${m.month}:${m.t2m?.toFixed(1) ?? "x"}`).join(" "));

  for (const farm of [
    { soilType: "loam", waterAvailability: "moderate", season: "winter", sizeUnit: "", irrigationMethod: "flood" },
    { soilType: "clay", waterAvailability: "abundant", season: "summer", sizeUnit: "", irrigationMethod: "flood" },
    { soilType: "sandy", waterAvailability: "limited", season: "spring", sizeUnit: "", irrigationMethod: "drip" },
    { soilType: "unknown", waterAvailability: "moderate", season: "autumn", sizeUnit: "", irrigationMethod: "" },
  ] as FarmInput[]) {
    const { crops, engine } = runEngine(monthly, summary, farm);
    console.log(`\n=== farm: ${farm.soilType}/${farm.waterAvailability}/${farm.season} — confidence ${engine.confidence}`);
    for (const c of crops) {
      const win = c.windowMonths.join(",");
      console.log(
        `#${c.rank} ${c.cropId.padEnd(10)} ${String(c.score).padStart(3)} ${c.classification.en.padEnd(22)} win=[${win}] gap=${c.irrigationGapMm ?? "-"}mm`
      );
    }
    const top = crops[0];
    console.log("TOP summary EN:", top.summary.en);
    console.log("TOP summary AR:", top.summary.ar);
    console.log("Factors:", top.factors.map(f => `${f.key}:${f.score ?? "x"}(${f.effectiveWeight}%)`).join(" "));
    const topLimitations = top.factors.flatMap(f => f.limitations.map(l => l.en));
    if (topLimitations.length) console.log("TOP limitations:", topLimitations.slice(0, 3));
  }
}

main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
