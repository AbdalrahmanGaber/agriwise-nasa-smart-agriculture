"use client";

import { useMemo, useState } from "react";
import { useLang, fill } from "@/lib/i18n/LanguageContext";
import { useAnalysisStore } from "@/lib/store";
import { getCrop, type CropRecord } from "@/lib/crops";
import {
  FACTOR_LABELS,
  IRRIGATION_LABELS,
  SEASON_LABELS,
  SOIL_LABELS,
  WATER_CATEGORY_LABELS,
  WATER_LABELS,
} from "@/lib/labels";
import { monthName, type AnalysisResult, type CropResult, type FactorScore, type Lang } from "@/lib/types";
import { CropIcon } from "../icons";
import { ClimateCharts } from "../ClimateCharts";
import { RiskDashboard } from "../RiskDashboard";
import { CropCalendarSection } from "../CropCalendarSection";
import { navHref } from "../useHashRouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  CloudRain,
  Droplets,
  Gauge,
  Info,
  Leaf,
  MapPin,
  Printer,
  Save,
  Sprout,
  Sun,
  Thermometer,
  Wind,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/* ---------------- helpers ---------------- */

const FACTOR_ICONS: Record<string, typeof Thermometer> = {
  temperature: Thermometer,
  water: Droplets,
  solar: Sun,
  soil: Leaf,
  season: Sprout,
  humidity: CloudRain,
  wind: Wind,
};

const DRIP_CROPS = new Set(["tomato", "potato", "onion"]);
const FLOOD_CROPS = new Set(["wheat", "rice", "sugarcane"]);
const SPRINKLER_CROPS = new Set(["wheat", "maize", "potato"]);

/** documented irrigation practice notes (bilingual) */
const IRRIGATION_ADVISORY: Record<string, { en: string; ar: string }> = {
  sugarcane: {
    en: "Normally surface/border irrigation with frequent applications; drip systems are increasingly adopted to save water on this very high-requirement crop.",
    ar: "الري السطحي/بالحوض مع دفعات متكررة هو المعتاد؛ وتُستخدم أنظمة التنقيط بشكل متزايد لترشيد الماء في هذا المحصول مرتفع الاحتياج جدًا.",
  },
  wheat: {
    en: "Surface (flood/furrow) irrigation is standard in Egypt; sprinkler also works. Avoid waterlogging in heavy soils.",
    ar: "الري السطحي (الغمر/الأحواض) هو المعيار في مصر؛ والرش ممكن أيضًا. تجنّب تشبّع الأرض في التربة الثقيلة.",
  },
  maize: {
    en: "Furrow or sprinkler irrigation; ensure reliable water at tasseling–silking, the most sensitive stage.",
    ar: "الري بالأحواض أو الرش؛ اضمن ماءً موثوقًا وقت طرد الذكور–قبول الإناث، وهي أشد المراحل حساسية.",
  },
  rice: {
    en: "Lowland rice is grown flooded — clay basins with abundant water. Drip-grown rice exists only in special water-saving systems.",
    ar: "يُزرع الأرز المنخفض غمرًا — أحواض طينية بماء وفير. والأرز بالتنقيط موجود فقط في أنظمة خاصة لترشيد الماء.",
  },
  tomato: {
    en: "Drip irrigation with mulching is the modern standard: it halves water use and reduces foliar disease.",
    ar: "الري بالتنقيط مع التغطية هو المعيار الحديث: يخفض استهلاك الماء ويقلل أمراض المجموع الخضري.",
  },
  potato: {
    en: "Drip or sprinkler with careful timing during tuber bulking; avoid wet–dry swings that deform tubers.",
    ar: "التنقيط أو الرش مع توقيت دقيق أثناء تكوين الدرنات؛ تجنّب التذبذب بين البلل والجفاف الذي يشوّه الدرنات.",
  },
  onion: {
    en: "Drip or furrow irrigation; stop irrigation 2–3 weeks before harvest so bulbs cure and store well.",
    ar: "الري بالتنقيط أو الأحواض؛ أوقف الري قبل الحصاد بأسبوعين إلى ثلاثة كي تنضج البصلة وتخزّن جيدًا.",
  },
};

const fmtMonths = (months: number[], lang: Lang) =>
  months.map((m) => monthName(m, lang)).join(", ");

function ScoreRing({ score, size = 132 }: { score: number; size?: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={`${clamped}/100`}
      style={{ ["--ring-circ" as string]: `${circ}` }}
    >
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--secondary)" strokeWidth="10" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - clamped / 100)}
        transform="rotate(-90 60 60)"
        style={{ animation: "ringFill 1s ease-out both" }}
      />
      <text
        x="60"
        y="56"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--foreground)"
        fontSize="30"
        fontWeight="800"
      >
        {Math.round(clamped)}
      </text>
      <text
        x="60"
        y="78"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--muted-foreground)"
        fontSize="12"
        fontWeight="700"
      >
        / 100
      </text>
    </svg>
  );
}

function FactorBar({
  factor,
  lang,
}: {
  factor: FactorScore;
  lang: Lang;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-muted-foreground">{FACTOR_LABELS[factor.key][lang]}</span>
        <span>{factor.score === null ? "—" : Math.round(factor.score)}</span>
      </div>
      <Progress
        className="mt-1 h-2"
        value={factor.score ?? 0}
        aria-label={FACTOR_LABELS[factor.key][lang]}
      />
    </div>
  );
}

/* ---------------- view ---------------- */

export function ResultsView() {
  const { t, lang, L } = useLang();
  const { toast } = useToast();
  const result = useAnalysisStore((s) => s.result);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!result) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-20 text-center sm:px-6">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Gauge className="h-8 w-8" aria-hidden />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold sm:text-3xl">
          {t.results.noAnalysisTitle}
        </h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          {t.results.noAnalysisDesc}
        </p>
        <Button asChild size="lg" className="mt-6 font-bold">
          <a href={navHref("analyze")}>{t.results.noAnalysisCta}</a>
        </Button>
      </div>
    );
  }

  return <ResultsBody result={result} t={t} lang={lang} L={L} saving={saving} saved={saved}
    onSave={async () => {
      setSaving(true);
      try {
        const res = await fetch("/api/analyses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ result }),
        });
        if (!res.ok) throw new Error();
        setSaved(true);
        toast({ description: t.results.saveOk });
      } catch {
        toast({ description: t.results.saveFail });
      } finally {
        setSaving(false);
      }
    }}
  />;
}

function ResultsBody({
  result,
  t,
  lang,
  L,
  saving,
  saved,
  onSave,
}: {
  result: AnalysisResult;
  t: ReturnType<typeof useLang>["t"];
  lang: "en" | "ar";
  L: (b: { en: string; ar: string }) => string;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
}) {
  const best = result.crops[0];
  const bestCrop = getCrop(best.cropId) as CropRecord;
  const inSeason = result.crops.filter((c) => c.seasonMatch);
  const alternatives = inSeason.slice(1).filter((c) => c.score >= 40);
  const offSeason = result.crops.filter((c) => !c.seasonMatch);
  const lessSuitable = inSeason.filter((c) => c.score < 40);

  const meta = result.meta;
  const coverage = Math.round(result.summary.coverageOverall * 100);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB", {
      dateStyle: "medium",
    });

  const rainInWindow = (c: CropResult) => {
    const vals = c.windowMonths
      .map((m) => result.monthly[m - 1]?.precip)
      .filter((v): v is number => v !== null && v !== undefined);
    return vals.length ? vals.reduce((a, b) => a + b, 0) : 0;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t.results.title}
          </h1>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" aria-hidden />
            {result.location.label || `${result.location.lat.toFixed(4)}, ${result.location.lng.toFixed(4)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            {t.results.printBtn}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onSave}
            disabled={saving || saved}
          >
            <Save className="h-4 w-4" />
            {saved ? t.analyze.saved : t.results.saveBtn}
          </Button>
          <Button asChild size="sm" className="font-bold">
            <a href={navHref("analyze")}>{t.results.backToAnalyze}</a>
          </Button>
        </div>
      </div>

      {/* metadata + farm summary */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <BookOpen className="h-4 w-4 text-primary" aria-hidden />
              {t.results.metaTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <MetaRow label={t.results.metaSource} value={t.results.metaSourceValue} />
              <MetaRow
                label={t.results.metaRetrieved}
                value={fmtDate(meta.retrievedAt)}
              />
              <MetaRow
                label={t.results.metaPeriod}
                value={`${fmtDate(meta.periodStart)} → ${fmtDate(meta.periodEnd)}`}
              />
              <MetaRow
                label={t.results.metaCoords}
                value={`${meta.coordinates.lat.toFixed(4)}, ${meta.coordinates.lng.toFixed(4)}`}
                mono
              />
              <MetaRow label={t.results.metaParams} value={meta.parameters.join(", ")} mono />
              <MetaRow
                label={t.results.metaCoverage}
                value={`${coverage}%`}
              />
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              {t.sources.nasaNote}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">
              {t.results.farmSummaryTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <FarmChip
              icon={<MapPin className="h-3.5 w-3.5" aria-hidden />}
              label={t.analyze.selectedLocation}
              value={result.location.label}
            />
            <FarmChip
              icon={<Leaf className="h-3.5 w-3.5" aria-hidden />}
              label={t.analyze.soilTitle}
              value={L(SOIL_LABELS[result.farm.soilType])}
            />
            <FarmChip
              icon={<Droplets className="h-3.5 w-3.5" aria-hidden />}
              label={t.analyze.waterTitle}
              value={L(WATER_LABELS[result.farm.waterAvailability])}
            />
            <FarmChip
              icon={<Sprout className="h-3.5 w-3.5" aria-hidden />}
              label={t.analyze.seasonTitle}
              value={L(SEASON_LABELS[result.farm.season])}
            />
            {result.farm.irrigationMethod && (
              <FarmChip
                icon={<Gauge className="h-3.5 w-3.5" aria-hidden />}
                label={t.analyze.irrigationTitle}
                value={L(IRRIGATION_LABELS[result.farm.irrigationMethod])}
              />
            )}
            {result.farm.farmSize ? (
              <FarmChip
                icon={<Gauge className="h-3.5 w-3.5" aria-hidden />}
                label={t.analyze.sizeTitle}
                value={`${result.farm.farmSize} ${
                  result.farm.sizeUnit === "hectares"
                    ? t.analyze.unitHectares
                    : t.analyze.unitAcres
                }`}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* ---------- BEST CROP ---------- */}
      <section className="mt-10">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {t.results.bestTitle}
        </h2>
        <p className="mt-1 text-muted-foreground">{t.results.bestSubtitle}</p>

        <Card className="mt-5 overflow-hidden border-primary/30 shadow-lg">
          <div className="grid gap-0 md:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center justify-center gap-3 border-b bg-primary/5 p-8 md:border-b-0 md:border-e">
              <ScoreRing score={best.score} />
              <Badge className="text-sm font-bold">{L(best.classification)}</Badge>
            </div>
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow"
                  style={{ backgroundColor: bestCrop.color }}
                >
                  <CropIcon name={bestCrop.icon} className="h-7 w-7" />
                </span>
                <div>
                  <h3 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                    {L(bestCrop.name)}
                  </h3>
                  <p className="text-sm italic text-muted-foreground">
                    {bestCrop.scientificName}
                  </p>
                </div>
                <span className="ms-auto rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">
                  #{best.rank}
                </span>
              </div>

              {/* quick facts */}
              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Fact label={t.results.windowLabel} value={fmtMonths(best.windowMonths, lang)} />
                <Fact
                  label={t.results.durationLabel}
                  value={`${bestCrop.durationDays[0]}–${bestCrop.durationDays[1]} ${
                    lang === "ar" ? "يوم" : "days"
                  }`}
                />
                <Fact
                  label={t.results.tempRangeLabel}
                  value={`${bestCrop.temp.optMin}–${bestCrop.temp.optMax}°C (${bestCrop.temp.absMin}–${bestCrop.temp.absMax}°C tol.)`}
                />
                <Fact
                  label={t.results.waterNeedLabel}
                  value={`${bestCrop.water.seasonNeedMm[0]}–${bestCrop.water.seasonNeedMm[1]} mm · ${L(
                    WATER_CATEGORY_LABELS[bestCrop.water.category]
                  )}`}
                />
                <Fact label={t.results.soilPrefLabel} value={L(bestCrop.soilNote)} />
                <Fact
                  label={t.results.seasonLabel}
                  value={fmtMonths(bestCrop.plantingMonths, lang)}
                />
              </dl>

              <Separator className="my-5" />

              {/* why */}
              <h4 className="text-base font-bold">{t.results.whyTitle}</h4>
              <p className="mt-2 leading-relaxed">{L(best.summary)}</p>

              <h4 className="mt-5 flex items-center gap-2 text-base font-bold">
                <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
                {t.results.reasonsTitle}
              </h4>
              <ul className="mt-2 space-y-1.5">
                {best.factors
                  .filter((f) => f.score !== null && f.score >= 70 && f.reasons.length)
                  .sort((a, b) => b.effectiveWeight - a.effectiveWeight)
                  .slice(0, 4)
                  .map((f) => (
                    <li key={f.key} className="flex gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <span>{L(f.reasons[0])}</span>
                    </li>
                  ))}
              </ul>

              {best.factors.some((f) => f.limitations.length) && (
                <>
                  <h4 className="mt-5 flex items-center gap-2 text-base font-bold">
                    <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
                    {t.results.limitationsTitle}
                  </h4>
                  <ul className="mt-2 space-y-1.5">
                    {best.factors
                      .flatMap((f) => f.limitations)
                      .slice(0, 5)
                      .map((lim, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <AlertTriangle
                            className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                            aria-hidden
                          />
                          <span>{L(lim)}</span>
                        </li>
                      ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          {/* factor transparency for the best crop */}
          <div className="border-t bg-secondary/30 p-6 sm:p-8">
            <h4 className="text-sm font-bold">{t.results.transparencyTitle}</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              {t.results.transparencySubtitle}
            </p>
            <div className="agri-scroll mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b text-start">
                    <th className="py-2 text-start font-bold">{t.results.factorCol}</th>
                    <th className="py-2 text-start font-bold">{t.results.weightCol}</th>
                    <th className="py-2 text-start font-bold">{t.results.scoreCol}</th>
                    <th className="py-2 text-start font-bold">{t.results.statusCol}</th>
                  </tr>
                </thead>
                <tbody>
                  {best.factors.map((f) => {
                    const Icon = FACTOR_ICONS[f.key];
                    return (
                      <tr key={f.key} className="border-b last:border-0">
                        <td className="py-2.5">
                          <span className="flex items-center gap-2 font-semibold">
                            <Icon className="h-4 w-4 text-primary" aria-hidden />
                            {L(FACTOR_LABELS[f.key])}
                          </span>
                        </td>
                        <td className="py-2.5 font-mono text-xs">
                          {f.score === null
                            ? `${f.weight} → 0`
                            : f.effectiveWeight === f.weight
                              ? `${f.weight}%`
                              : `${f.weight}% → ${f.effectiveWeight}%`}
                        </td>
                        <td className="py-2.5 font-bold">
                          {f.score === null ? "—" : Math.round(f.score)}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              f.status === "ok"
                                ? "bg-primary/10 text-primary"
                                : f.status === "limited"
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                  : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {f.status === "ok"
                              ? t.results.statusOk
                              : f.status === "limited"
                                ? t.results.statusLimited
                                : t.results.statusUnavailable}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td className="py-2.5 font-bold">
                      {t.results.scoreLabel}
                    </td>
                    <td className="py-2.5 font-mono text-xs">100%</td>
                    <td className="py-2.5 text-base font-extrabold text-primary">
                      {best.score}
                    </td>
                    <td className="py-2.5">
                      <span className="text-xs font-bold text-muted-foreground">
                        {L(best.classification)}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </section>

      {/* ---------- ALTERNATIVES ---------- */}
      {alternatives.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t.results.alternativesTitle}
          </h2>
          <p className="mt-1 text-muted-foreground">
            {t.results.alternativesSubtitle}
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {alternatives.map((c) => {
              const crop = getCrop(c.cropId) as CropRecord;
              return (
                <Card key={c.cropId} className="flex h-full flex-col shadow-sm transition-shadow hover:shadow-md">
                  <CardContent className="flex h-full flex-col p-5">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                        style={{ backgroundColor: crop.color }}
                      >
                        <CropIcon name={crop.icon} className="h-6 w-6" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-bold">{L(crop.name)}</h3>
                        <span className="text-xs text-muted-foreground">
                          {L(c.classification)}
                        </span>
                      </div>
                      <span className="text-2xl font-extrabold text-primary">
                        {c.score}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2.5">
                      {c.factors
                        .filter((f) =>
                          ["temperature", "water", "soil"].includes(f.key)
                        )
                        .map((f) => (
                          <FactorBar key={f.key} factor={f} lang={lang} />
                        ))}
                    </div>

                    <dl className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex justify-between gap-2">
                        <dt>{t.results.seasonLabel}</dt>
                        <dd className="font-semibold text-foreground">
                          {fmtMonths(crop.plantingMonths, lang)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>{t.results.durationLabel}</dt>
                        <dd className="font-semibold text-foreground">
                          {crop.durationDays[0]}–{crop.durationDays[1]}{" "}
                          {lang === "ar" ? "يوم" : "days"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>{t.results.waterNeedLabel}</dt>
                        <dd className="font-semibold text-foreground">
                          {crop.water.seasonNeedMm[0]}–{crop.water.seasonNeedMm[1]} mm
                        </dd>
                      </div>
                    </dl>

                    {(() => {
                      const worst = c.factors
                        .filter((f) => f.score !== null && f.score < 60)
                        .sort((a, b) => (a.score as number) - (b.score as number))[0];
                      return worst ? (
                        <p className="mt-3 flex gap-1.5 rounded-lg bg-amber-500/10 p-2.5 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                          {L(worst.limitations[0] ?? worst.reasons[0])}
                        </p>
                      ) : null;
                    })()}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------- OFF-SEASON CROPS ---------- */}
      {offSeason.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-extrabold sm:text-2xl">
            {lang === "ar" ? "أفضل الخيارات في مواسم أخرى" : "Best options in other seasons"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.results.offSeasonNote}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {offSeason.map((c) => {
              const crop = getCrop(c.cropId) as CropRecord;
              return (
                <Card key={c.cropId} className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                          style={{ backgroundColor: crop.color }}
                        >
                          <CropIcon name={crop.icon} className="h-4 w-4" />
                        </span>
                        <span className="text-sm font-bold">{L(crop.name)}</span>
                      </span>
                      <span className="text-lg font-extrabold text-muted-foreground">
                        {c.score}
                      </span>
                    </div>
                    <Badge variant="outline" className="mt-2 text-[11px]">
                      {t.results.offSeasonBadge}: {fmtMonths(crop.plantingMonths, lang)}
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------- LESS SUITABLE ---------- */}
      {lessSuitable.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t.results.lessTitle}
          </h2>
          <p className="mt-1 text-muted-foreground">{t.results.lessSubtitle}</p>
          <Accordion type="multiple" className="mt-5 space-y-3">
            {lessSuitable.map((c) => {
              const crop = getCrop(c.cropId) as CropRecord;
              const worst = c.factors
                .filter((f) => f.score !== null)
                .sort((a, b) => (a.score as number) - (b.score as number))
                .slice(0, 2);
              return (
                <AccordionItem
                  key={c.cropId}
                  value={c.cropId}
                  className="rounded-xl border px-4 shadow-sm"
                >
                  <AccordionTrigger className="gap-3 py-4 hover:no-underline">
                    <span className="flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
                        style={{ backgroundColor: crop.color }}
                      >
                        <CropIcon name={crop.icon} className="h-5 w-5" />
                      </span>
                      <span className="text-start">
                        <span className="block text-sm font-bold">{L(crop.name)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {L(c.classification)} · {c.score}/100
                        </span>
                      </span>
                    </span>
                    <XCircle className="ms-auto h-5 w-5 shrink-0 text-destructive" />
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <p className="text-sm font-bold">{t.results.risksTitle}</p>
                    <ul className="mt-2 space-y-1.5">
                      {worst.flatMap((f) => f.limitations).slice(0, 3).map((lim, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <AlertTriangle
                            className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
                            aria-hidden
                          />
                          <span>{L(lim)}</span>
                        </li>
                      ))}
                      {crop.limitationNotes.map((lim, i) => (
                        <li key={`n${i}`} className="flex gap-2 text-sm text-muted-foreground">
                          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                          <span>{L(lim)}</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </section>
      )}

      {/* ---------- CLIMATE CHARTS ---------- */}
      <section className="mt-12">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {t.results.climateTitle}
        </h2>
        <p className="mt-1 text-muted-foreground">{t.results.climateSubtitle}</p>
        <div className="mt-5">
          <ClimateCharts result={result} />
        </div>
      </section>

      {/* ---------- CLIMATE RISK MONITORING (Feature 3) ---------- */}
      <section className="mt-12">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {t.risk.title}
        </h2>
        <p className="mt-1 max-w-3xl text-muted-foreground">
          {t.risk.subtitle}
        </p>
        <div className="mt-5">
          <RiskDashboard result={result} />
        </div>
      </section>

      {/* ---------- SMART CROP CALENDAR (Feature 4) ---------- */}
      <section className="mt-12">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {t.calendar.title}
        </h2>
        <p className="mt-1 max-w-3xl text-muted-foreground">
          {t.calendar.subtitle}
        </p>
        <div className="mt-5">
          <CropCalendarSection result={result} />
        </div>
      </section>

      {/* ---------- WATER MANAGEMENT ---------- */}
      <section className="section-beige mt-12 rounded-2xl border p-6 sm:p-8">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {t.results.waterTitle}
        </h2>
        <p className="mt-1 text-muted-foreground">{t.results.waterSubtitle}</p>

        <p className="mt-4 rounded-xl border bg-card p-4 text-sm leading-relaxed">
          {fill(t.results.waterRainRelationBody, {
            rain: result.summary.annualRainfallMm.toFixed(1),
          })}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {inSeason.slice(0, 3).map((c) => {
            const crop = getCrop(c.cropId) as CropRecord;
            const rain = rainInWindow(c);
            return (
              <Card key={c.cropId} className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: crop.color }}
                    >
                      <CropIcon name={crop.icon} className="h-4 w-4" />
                    </span>
                    {L(crop.name)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-secondary/60 p-2">
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        {t.results.waterCropNeed}
                      </p>
                      <p className="mt-0.5 text-sm font-bold">
                        {crop.water.seasonNeedMm[0]}–{crop.water.seasonNeedMm[1]}
                        <span className="text-xs font-normal"> mm</span>
                      </p>
                    </div>
                    <div className="rounded-lg bg-secondary/60 p-2">
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        {t.results.waterRainfall}
                      </p>
                      <p className="mt-0.5 text-sm font-bold">
                        {rain.toFixed(1)}
                        <span className="text-xs font-normal"> mm</span>
                      </p>
                    </div>
                    <div className="rounded-lg bg-primary/10 p-2">
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        {t.results.waterIrrigationGap}
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-primary">
                        ≈{Math.round(c.irrigationGapMm ?? 0)}
                        <span className="text-xs font-normal"> mm</span>
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground">
                      {t.results.waterMethodTitle}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed">
                      {L(IRRIGATION_ADVISORY[c.cropId] ?? IRRIGATION_ADVISORY.wheat)}
                    </p>
                  </div>
                  {result.farm.irrigationMethod && (
                    <IrrigationMatch
                      cropId={c.cropId}
                      method={result.farm.irrigationMethod}
                      t={t}
                      lang={lang}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm font-bold">{t.results.waterAvailabilityTitle}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {fill(t.results.waterSuitabilityNote, {
                availability: L(WATER_LABELS[result.farm.waterAvailability]),
              })}
            </p>
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
              {t.results.waterDisclaimer}
            </p>
          </div>
        </div>
      </section>

      {/* ---------- METHODOLOGY ---------- */}
      <section className="mt-12">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold">
              {t.results.methodologyTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {L(result.engine.methodology)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold">{t.results.confidenceLabel}:</span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  result.engine.confidence === "high"
                    ? "bg-primary/10 text-primary"
                    : result.engine.confidence === "medium"
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      : "bg-destructive/10 text-destructive"
                }`}
              >
                {result.engine.confidence === "high"
                  ? lang === "ar" ? "مرتفع" : "High"
                  : result.engine.confidence === "medium"
                    ? lang === "ar" ? "متوسط" : "Medium"
                    : lang === "ar" ? "منخفض" : "Low"}
              </span>
              <span className="text-xs text-muted-foreground">
                {L(result.engine.confidenceNote)}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {result.engine.weights.map((w) => (
                <span
                  key={w.key}
                  className="rounded-full border bg-secondary/50 px-3 py-1 text-xs font-semibold"
                >
                  {L(FACTOR_LABELS[w.key])} · {w.weight}%
                </span>
              ))}
            </div>
            <p className="rounded-xl border-l-4 border-amber-500 bg-amber-500/5 p-4 text-sm leading-relaxed text-muted-foreground">
              {t.results.disclaimer}
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

/* ---------------- small pieces ---------------- */

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd
        className={`mt-0.5 break-words text-sm font-semibold ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background/60 p-2.5">
      <dt className="text-[11px] font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-bold leading-snug">{value}</dd>
    </div>
  );
}

function FarmChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border bg-secondary/40 px-3 py-2">
      <span className="text-primary">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-bold">{value}</p>
      </div>
    </div>
  );
}

function IrrigationMatch({
  cropId,
  method,
  t,
  lang,
}: {
  cropId: string;
  method: string;
  t: ReturnType<typeof useLang>["t"];
  lang: "en" | "ar";
}) {
  let match = false;
  if (method === "drip") match = DRIP_CROPS.has(cropId);
  else if (method === "flood") match = FLOOD_CROPS.has(cropId);
  else if (method === "sprinkler") match = SPRINKLER_CROPS.has(cropId);
  return (
    <p
      className={`flex gap-1.5 rounded-lg p-2 text-xs leading-relaxed ${
        match
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {match ? (
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      {match
        ? lang === "ar"
          ? "طريقة الري التي اخترتها مناسبة لهذا المحصول."
          : "Your selected irrigation method suits this crop."
        : lang === "ar"
          ? "تحقق من ملاءمة طريقة الري المختارة لهذا المحصول مع مرشدك الزراعي."
          : "Check with your advisor whether your selected irrigation method fits this crop."}
    </p>
  );
}

export default ResultsView;
