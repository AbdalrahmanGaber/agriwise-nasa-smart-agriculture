"use client";

import { useLang, fill } from "@/lib/i18n/LanguageContext";
import { useAnalysisStore } from "@/lib/store";
import { useToolsStore } from "@/lib/toolsStore";
import { getCrop } from "@/lib/crops";
import {
  assessCropRisk,
  RISK_TYPE_LABELS,
  type CropRiskReport,
} from "@/lib/risk";
import { buildCropCalendar } from "@/lib/calendar";
import { SEASON_LABELS } from "@/lib/labels";
import { monthName, type Season } from "@/lib/types";
import { navHref } from "../useHashRouter";
import { CropIcon } from "../icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Droplets,
  Gauge,
  LayoutDashboard,
  Satellite,
  Scale,
  Sprout,
} from "lucide-react";

const timeAgo = (iso: string, lang: "en" | "ar") => {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return lang === "ar" ? "الآن" : "just now";
  if (mins < 60) return lang === "ar" ? `قبل ${mins} دقيقة` : `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return lang === "ar" ? `قبل ${hrs} ساعة` : `${hrs} h ago`;
  return lang === "ar" ? `قبل ${hrs / 24 | 0} يوم` : `${Math.floor(hrs / 24)} d ago`;
};

export function ActionCenterView() {
  const { t, L, lang } = useLang();
  const analysis = useAnalysisStore();
  const tools = useToolsStore();

  const planting = tools.planting;
  const irrigation = tools.irrigation;
  const yieldRef = tools.yieldResult;
  const satellite = tools.satellite;
  const bestCrop = analysis.result?.crops?.[0];
  const bestCropRecord = bestCrop ? getCrop(bestCrop.cropId) : null;

  // Risk snapshot + calendar derive from the REAL stored analysis result
  // using the same pure engines the Results view uses (no new calculations,
  // no hardcoded values). Rendered only when an analysis exists.
  const riskReport: CropRiskReport | null =
    analysis.result && bestCropRecord
      ? assessCropRisk(
          analysis.result.monthly,
          analysis.result.summary,
          analysis.result.farm,
          bestCropRecord,
          bestCrop?.windowMonths ?? []
        )
      : null;

  const calendar =
    analysis.result && bestCropRecord
      ? buildCropCalendar(
          bestCropRecord,
          analysis.result.monthly,
          analysis.result.farm,
          tools.plantingDate
        )
      : null;

  const anyResult =
    planting || irrigation || yieldRef || satellite || analysis.result;

  const riskLevelCls = (level: string) =>
    level === "high"
      ? "text-red-700 dark:text-red-400"
      : level === "moderate"
        ? "text-amber-700 dark:text-amber-400"
        : "text-emerald-700 dark:text-emerald-400";

  const decisionVisual =
    planting?.decision.value === "plant_now"
      ? { icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400" }
      : planting?.decision.value === "wait"
        ? { icon: Clock, cls: "text-amber-600 dark:text-amber-400" }
        : { icon: AlertTriangle, cls: "text-red-600 dark:text-red-400" };

  const DecisionIcon = decisionVisual?.icon ?? CalendarCheck;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="max-w-3xl">
        <p className="inline-flex items-center gap-2 rounded-full border bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">
          <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
          {t.nav.tools}
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t.action.title}
        </h1>
        <p className="mt-3 text-muted-foreground">{t.action.subtitle}</p>
      </header>

      {/* tools status */}
      <div className="mt-6 flex flex-wrap gap-2">
        {[
          { label: t.nav.analyze, active: !!analysis.result },
          { label: t.nav.planting, active: !!planting },
          { label: t.nav.irrigation, active: !!irrigation },
          { label: t.nav.satellite, active: !!satellite },
          { label: t.nav.yield, active: !!yieldRef },
        ].map((s) => (
          <Badge
            key={s.label}
            variant={s.active ? "default" : "outline"}
            className="gap-1.5 font-semibold"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                s.active ? "bg-primary-foreground" : "bg-muted-foreground/40"
              }`}
              aria-hidden
            />
            {s.label}
          </Badge>
        ))}
      </div>

      {!anyResult && (
        <Card className="mt-8 shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <Sprout className="h-12 w-12 text-primary/40" aria-hidden />
            <h2 className="text-xl font-bold">{t.action.emptyTitle}</h2>
            <p className="max-w-md text-muted-foreground">{t.action.emptyBody}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <Button asChild className="font-bold">
                <a href={navHref("analyze")}>{t.nav.analyzeCta}</a>
              </Button>
              <Button asChild variant="outline" className="font-bold">
                <a href={navHref("planting")}>{t.planting.analyzeBtn}</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* 1 — planting decision */}
        {planting && (
          <Card className="shadow-sm lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <DecisionIcon
                    className={`h-6 w-6 ${decisionVisual?.cls ?? ""}`}
                    aria-hidden
                  />
                  {t.action.cardPlanting} — {L(planting.crop.name)}
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {t.action.updated}: {timeAgo(planting.meta.generatedAt, lang)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p
                className={`text-2xl font-extrabold ${decisionVisual?.cls ?? ""}`}
              >
                {planting.decision.value === "plant_now"
                  ? t.planting.decisionPlantNow
                  : planting.decision.value === "wait"
                    ? t.planting.decisionWait
                    : t.planting.decisionNotRecommended}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniStat
                  label={t.planting.recommendedSeason}
                  value={
                    planting.computed.recommendedSeason
                      ? L(
                          SEASON_LABELS[
                            planting.computed.recommendedSeason as Season
                          ]
                        )
                      : "—"
                  }
                />
                <MiniStat
                  label={t.planting.bestMonth}
                  value={
                    planting.computed.bestMonth
                      ? monthName(planting.computed.bestMonth, lang)
                      : "—"
                  }
                />
                <MiniStat
                  label={t.planting.targetMonth}
                  value={
                    planting.decision.targetMonth
                      ? monthName(planting.decision.targetMonth, lang)
                      : "—"
                  }
                />
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {L(planting.current.temperatureExplanation)}
              </p>
              {planting.decision.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-300/70 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                  {planting.decision.warnings
                    .slice(0, 2)
                    .map((w, i: number) => (
                      <p
                        key={i}
                        className="text-sm text-amber-800/90 dark:text-amber-200/90"
                      >
                        • {L(w)}
                      </p>
                    ))}
                </div>
              )}
              <Button asChild variant="outline" size="sm" className="w-fit font-bold">
                <a href={navHref("planting")}>{t.action.openTool}</a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 2 — best crop recommendation */}
        {bestCrop && bestCropRecord && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Gauge className="h-6 w-6 text-primary" aria-hidden />
                  {t.action.cardCrop}
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {t.action.updated}:{" "}
                  {timeAgo(analysis.result?.generatedAt ?? "", lang)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
                  style={{ backgroundColor: bestCropRecord.color }}
                >
                  <CropIcon name={bestCropRecord.icon} className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-xl font-extrabold">{L(bestCropRecord.name)}</p>
                  <p className="text-xs italic text-muted-foreground">
                    {bestCropRecord.scientificName}
                  </p>
                </div>
                <Badge className="ms-auto self-start text-sm font-extrabold">
                  {Math.round(bestCrop.score)}
                  {t.action.scoreUnit}
                </Badge>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {L(bestCrop.summary)}
              </p>
              <Button asChild variant="outline" size="sm" className="w-fit font-bold">
                <a href={navHref("results")}>{t.action.openTool}</a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 3 — climate risk snapshot (from the stored analysis result) */}
        {riskReport && analysis.result && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle
                    className={`h-6 w-6 ${
                      riskReport.overall === "high"
                        ? "text-red-600 dark:text-red-400"
                        : riskReport.overall === "moderate"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                    }`}
                    aria-hidden
                  />
                  {t.action.cardRisk}
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {L(bestCropRecord?.name ?? { en: "", ar: "" })}
                </span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p
                className={`text-xl font-extrabold ${riskLevelCls(riskReport.overall)}`}
              >
                {t.risk.overallPrefix}:{" "}
                {riskReport.overall === "high"
                  ? t.risk.levelHigh
                  : riskReport.overall === "moderate"
                    ? t.risk.levelModerate
                    : t.risk.levelLow}
              </p>
              {riskReport.findings.length ? (
                <>
                  <p className="text-sm font-semibold text-muted-foreground">
                    {fill(t.action.riskCounts, {
                      high: riskReport.counts.high,
                      moderate: riskReport.counts.moderate,
                      low: riskReport.counts.low,
                    })}
                  </p>
                  <ul className="space-y-1.5">
                    {riskReport.findings
                      .filter((f) => f.level !== "low")
                      .slice(0, 3)
                      .map((f, i) => (
                        <li
                          key={i}
                          className="flex gap-2 text-sm leading-relaxed text-muted-foreground"
                        >
                          <span
                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                              f.level === "high"
                                ? "bg-red-500"
                                : "bg-amber-500"
                            }`}
                            aria-hidden
                          />
                          <span>
                            <strong className="text-foreground">
                              {L(RISK_TYPE_LABELS[f.type])}:
                            </strong>{" "}
                            {L(f.impact)}
                          </span>
                        </li>
                      ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t.action.riskNoFindings}
                </p>
              )}
              {riskReport.unavailable.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t.risk.unavailableNote}{" "}
                  {riskReport.unavailable
                    .map((u) => RISK_TYPE_LABELS[u] ? L(RISK_TYPE_LABELS[u]) : u)
                    .join("، ")}
                </p>
              )}
              <Button asChild variant="outline" size="sm" className="w-fit font-bold">
                <a href={navHref("results")}>{t.action.openTool}</a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 4 — crop calendar / current stage */}
        {calendar && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarDays className="h-6 w-6 text-primary" aria-hidden />
                  {t.action.cardCalendar}
                </CardTitle>
                <Badge
                  variant={calendar.basis === "actual" ? "default" : "outline"}
                  className="font-semibold"
                >
                  {calendar.basis === "actual"
                    ? L(calendar.plantWindowLabel)
                    : monthName(calendar.plantMonth, lang)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {tools.plantingDate ? (
                calendar.todayStageKey && calendar.todayDayOffset !== null ? (
                  <>
                    <div>
                      <p className="text-[11px] text-muted-foreground">
                        {t.action.currentStageLabel}
                      </p>
                      <p className="text-lg font-extrabold">
                        {L(
                          calendar.stages.find(
                            (s) => s.key === calendar.todayStageKey
                          )?.name ?? { en: "—", ar: "—" }
                        )}
                      </p>
                    </div>
                    <Progress
                      value={
                        (calendar.todayDayOffset / calendar.cycleDays) * 100
                      }
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      {fill(t.calendar.youAreHere, {
                        day: calendar.todayDayOffset,
                        stage: L(
                          calendar.stages.find(
                            (s) => s.key === calendar.todayStageKey
                          )?.name ?? { en: "", ar: "" }
                        ),
                      })}
                    </p>
                  </>
                ) : (
                  <p className="flex items-center gap-2 rounded-lg border border-amber-300/70 bg-amber-50 p-3 text-sm font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                    <Clock className="h-4 w-4 shrink-0" aria-hidden />
                    {calendar.plantDate && new Date(`${calendar.plantDate}T00:00:00Z`) > new Date()
                      ? t.action.calendarNotPlanted
                      : t.action.calendarCycleOver}
                  </p>
                )
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t.action.calendarNoDate}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <MiniStat
                  label={t.calendar.cycleLabel}
                  value={`${calendar.cycleDays} ${lang === "ar" ? "يومًا" : "days"}`}
                />
                <MiniStat
                  label={t.calendar.waterNeedLabel}
                  value={`${calendar.waterNeedMm[0]}–${calendar.waterNeedMm[1]} mm`}
                />
              </div>
              <Button asChild variant="outline" size="sm" className="w-fit font-bold">
                <a href={navHref("results")}>{t.action.openTool}</a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 5 — irrigation */}
        {irrigation && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Droplets className="h-6 w-6 text-primary" aria-hidden />
                  {t.action.cardIrrigation} — {L(irrigation.crop.name)}
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {t.action.updated}:{" "}
                  {timeAgo(irrigation.meta.generatedAt, lang)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat
                  label={t.irrigation.etcNow}
                  value={
                    irrigation.etc.etcMmDay !== null
                      ? `${irrigation.etc.etcMmDay} ${t.irrigation.mmDay}`
                      : "—"
                  }
                />
                <MiniStat
                  label={t.irrigation.etcPeak}
                  value={
                    irrigation.etc.peakMmDay !== null
                      ? `${irrigation.etc.peakMmDay} ${t.irrigation.mmDay}`
                      : "—"
                  }
                />
              </div>
              {irrigation.guidance.general[0] && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {L(irrigation.guidance.general[0])}
                </p>
              )}
              <Button asChild variant="outline" size="sm" className="w-fit font-bold">
                <a href={navHref("irrigation")}>{t.action.openTool}</a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 4 — satellite */}
        {satellite && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Satellite className="h-6 w-6 text-primary" aria-hidden />
                  {t.action.cardSatellite}
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {t.action.updated}: {timeAgo(satellite.visitedAt, lang)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label={t.satellite.acquisition} value={satellite.date} />
                <MiniStat
                  label={t.satellite.resolution}
                  value={`${satellite.resolutionM} m`}
                />
              </div>
              <p className="text-sm text-muted-foreground">{satellite.label}</p>
              <Button asChild variant="outline" size="sm" className="w-fit font-bold">
                <a href={navHref("satellite")}>{t.action.openTool}</a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 5 — yield reference */}
        {yieldRef && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Scale className="h-6 w-6 text-primary" aria-hidden />
                  {t.action.cardYield} — {L(yieldRef.crop.name)}
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {t.action.updated}: {timeAgo(yieldRef.meta.generatedAt, lang)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <MiniStat
                label={t.yield.referenceMean}
                value={`${yieldRef.reference.values.mean.toFixed(2)} ${t.yield.perHa}`}
              />
              <p className="text-sm leading-relaxed text-muted-foreground">
                {L(yieldRef.disclaimer)}
              </p>
              <Button asChild variant="outline" size="sm" className="w-fit font-bold">
                <a href={navHref("yield")}>{t.action.openTool}</a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  function MiniStat({ label, value }: { label: string; value: string }) {
    return (
      <div className="rounded-lg bg-background/70 p-3">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-base font-bold">{value}</p>
      </div>
    );
  }
}
