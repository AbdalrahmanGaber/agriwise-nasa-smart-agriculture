"use client";

/**
 * Climate Risk Monitoring dashboard (Feature 3).
 *
 * - evaluates risks for the selected crop from the real NASA POWER monthly
 *   climatology already stored in the analysis result (pure engine: risk.ts);
 * - shows colored risk indicators, measured values vs documented thresholds,
 *   agricultural impacts and practical recommendations;
 * - draws historical trends with the crop's threshold bands;
 * - fetches a real 7-day forecast (Open-Meteo via /api/forecast) for early
 *   warnings — clearly labelled as forecast, never as observation;
 * - shows explicit "data unavailable" states when anything is missing.
 */

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLang, fill } from "@/lib/i18n/LanguageContext";
import { getCrop, type CropRecord } from "@/lib/crops";
import {
  assessCropRisk,
  assessForecastWarnings,
  RISK_TYPE_LABELS,
  type CropRiskReport,
  type EarlyWarning,
  type ForecastDay,
  type RiskFinding,
  type RiskLevel,
  type WarningType,
} from "@/lib/risk";
import { monthName, type AnalysisResult, type CropResult } from "@/lib/types";
import { CropIcon } from "./icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  BellRing,
  CalendarDays,
  CloudRain,
  Droplets,
  Flame,
  Gauge,
  Info,
  RefreshCw,
  Sprout,
  Sun,
  Thermometer,
  Snowflake,
  Wind,
  type LucideIcon,
} from "lucide-react";

/* ---------------- styling maps ---------------- */

const LEVEL_STYLE: Record<
  RiskLevel,
  { border: string; bg: string; text: string; dot: string; chart: string }
> = {
  high: {
    border: "border-red-500/60",
    bg: "bg-red-500/10",
    text: "text-red-700 dark:text-red-400",
    dot: "bg-red-500",
    chart: "#D93025",
  },
  moderate: {
    border: "border-amber-500/60",
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
    chart: "#E8A013",
  },
  low: {
    border: "border-primary/50",
    bg: "bg-primary/10",
    text: "text-primary",
    dot: "bg-primary",
    chart: "#1E5B3C",
  },
};

const RISK_ICONS: Record<string, LucideIcon> = {
  heat: Flame,
  cold: Snowflake,
  drought: Droplets,
  "rainfall-pattern": CloudRain,
  "crop-range": Sprout,
  radiation: Sun,
  wind: Wind,
};

const WARNING_ICONS: Record<WarningType, LucideIcon> = {
  heat: Flame,
  cold: Snowflake,
  rain: CloudRain,
  wind: Wind,
};

const PROVENANCE_STYLE: Record<string, string> = {
  nasa: "bg-primary/10 text-primary",
  "user-input": "bg-secondary text-secondary-foreground",
  documented: "bg-muted text-muted-foreground",
};

interface ForecastResponse {
  days: ForecastDay[];
  provider: string;
  model: string;
  retrievedAt: string;
  provenance: string;
}

/* ---------------- component ---------------- */

export function RiskDashboard({ result }: { result: AnalysisResult }) {
  const { t, lang, L } = useLang();

  // crops selectable in this dashboard: recommended (in-season) crops first
  const inSeason = useMemo(
    () => result.crops.filter((c) => c.seasonMatch),
    [result.crops]
  );
  const options = (inSeason.length ? inSeason : result.crops).slice(0, 5);
  const [cropId, setCropId] = useState(options[0]?.cropId ?? "sugarcane");
  const crop = getCrop(cropId) as CropRecord;
  const cropResult: CropResult | undefined = result.crops.find(
    (c) => c.cropId === cropId
  );

  const report: CropRiskReport | null = useMemo(
    () =>
      crop
        ? assessCropRisk(
            result.monthly,
            result.summary,
            result.farm,
            crop,
            cropResult?.windowMonths ?? []
          )
        : null,
    [result, crop, cropResult]
  );

  // ---- forecast (real Open-Meteo data through our server) ----
  // fetched per location key; state is only written from async callbacks
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [fcError, setFcError] = useState<string | null>(null);
  const [fcRefresh, setFcRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/forecast?lat=${result.location.lat}&lng=${result.location.lng}`
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as ForecastResponse;
        if (cancelled) return;
        setForecast(json);
        setFcError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setForecast(null);
        setFcError("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [result.location.lat, result.location.lng, fcRefresh]);

  const retryForecast = () => {
    setForecast(null);
    setFcError(null);
    setFcRefresh((r) => r + 1);
  };

  const fcState: "loading" | "ok" | "error" =
    fcError !== null ? "error" : forecast ? "ok" : "loading";

  const warnings: EarlyWarning[] = useMemo(
    () =>
      fcState === "ok" && forecast && crop
        ? assessForecastWarnings(forecast.days, crop)
        : [],
    [fcState, forecast, crop]
  );

  if (!report || !crop) return null;

  const levelName = (l: RiskLevel) => t.risk[`level${l[0].toUpperCase()}${l.slice(1)}` as keyof typeof t.risk] as string;
  const fmtDate = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(
      lang === "ar" ? "ar-EG" : "en-GB",
      { day: "numeric", month: "short" }
    );

  const warningForDate = (date: string): EarlyWarning[] =>
    warnings.filter((w) => w.dates.includes(date));

  return (
    <div className="space-y-6">
      {/* crop switcher */}
      <div>
        <p className="text-sm font-bold text-muted-foreground">
          {t.risk.cropSwitch}
        </p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t.risk.cropSwitch}>
          {options.map((c) => {
            const cRec = getCrop(c.cropId) as CropRecord;
            const active = c.cropId === cropId;
            return (
              <button
                key={c.cropId}
                type="button"
                onClick={() => setCropId(c.cropId)}
                aria-pressed={active}
                className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-bold transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow"
                    : "border-border bg-card hover:bg-secondary"
                }`}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: cRec.color }}
                >
                  <CropIcon name={cRec.icon} className="h-3.5 w-3.5" />
                </span>
                {L(cRec.name)}
                <span
                  className={`font-mono text-xs ${active ? "opacity-90" : "text-muted-foreground"}`}
                >
                  {c.score}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* overall banner */}
      <div
        className={`rounded-2xl border-2 p-5 sm:p-6 ${LEVEL_STYLE[report.overall].border} ${LEVEL_STYLE[report.overall].bg}`}
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-wrap items-center gap-4">
          <span
            className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white ${LEVEL_STYLE[report.overall].dot}`}
            aria-hidden
          >
            {report.overall === "high" ? (
              <AlertTriangle className="h-7 w-7" />
            ) : report.overall === "moderate" ? (
              <Gauge className="h-7 w-7" />
            ) : (
              <Sprout className="h-7 w-7" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-2xl font-extrabold ${LEVEL_STYLE[report.overall].text}`}>
              {t.risk.overallPrefix} · {levelName(report.overall)}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {fill(t.risk.overallDesc, { crop: L(crop.name) })}
            </p>
          </div>
          <div className="flex gap-2">
            {(["high", "moderate", "low"] as RiskLevel[]).map((l) => (
              <span
                key={l}
                className={`rounded-full border px-3 py-1 text-xs font-bold ${LEVEL_STYLE[l].border} ${LEVEL_STYLE[l].bg} ${LEVEL_STYLE[l].text}`}
              >
                {report.counts[l]} · {levelName(l)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* findings grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {report.findings.map((f) => (
          <RiskCard key={f.type} f={f} t={t} L={L} lang={lang} />
        ))}
      </div>

      {/* unavailable list */}
      {report.unavailable.length > 0 && (
        <div className="rounded-xl border bg-muted/40 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
            <Info className="h-4 w-4" aria-hidden />
            {t.risk.unavailableTitle}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {t.risk.unavailableNote}
            {report.unavailable.map((u) => ` · ${L(RISK_TYPE_LABELS[u])}`).join("")}
          </p>
        </div>
      )}

      {/* threshold trend charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ThresholdTempChart result={result} crop={crop} t={t} lang={lang} />
        <ThresholdWindChart result={result} crop={crop} t={t} />
      </div>

      {/* early warnings (forecast) */}
      <Card className="border-amber-400/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base font-bold sm:text-lg">
            <BellRing className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
            {t.risk.forecastTitle}
            <Badge
              variant="outline"
              className="border-amber-500/60 bg-amber-500/10 text-[10px] font-mono font-bold text-amber-700 dark:text-amber-400"
            >
              {t.risk.forecastBadge}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t.risk.forecastSubtitle}
          </p>

          {fcState === "loading" && (
            <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
              {t.risk.forecastLoading}
            </div>
          )}

          {fcState === "error" && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
              <div>
                <p className="text-sm font-bold text-destructive">
                  {t.risk.forecastUnavailableTitle}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {t.risk.forecastUnavailableBody}
                </p>
                <button
                  type="button"
                  onClick={retryForecast}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-secondary"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  {t.common.retry}
                </button>
              </div>
            </div>
          )}

          {fcState === "ok" && forecast && (
            <>
              {/* 7-day strip */}
              <div className="agri-scroll overflow-x-auto pb-2">
                <div className="flex min-w-max gap-2">
                  {forecast.days.map((d) => {
                    const flagged = warningForDate(d.date);
                    const worst = flagged.sort((a, b) =>
                      b.level.localeCompare(a.level)
                    )[0];
                    return (
                      <div
                        key={d.date}
                        className={`w-24 shrink-0 rounded-xl border p-2.5 text-center ${
                          worst
                            ? `${LEVEL_STYLE[worst.level].border} ${LEVEL_STYLE[worst.level].bg}`
                            : "border-border bg-card"
                        }`}
                      >
                        <p className="flex items-center justify-center gap-1 text-[11px] font-bold text-muted-foreground">
                          <CalendarDays className="h-3 w-3" aria-hidden />
                          {fmtDate(d.date)}
                        </p>
                        <p className="mt-1 text-lg font-extrabold leading-none">
                          {d.tmax === null ? "—" : Math.round(d.tmax)}°
                          <span className="ms-1 text-xs font-semibold text-muted-foreground">
                            {d.tmin === null ? "—" : Math.round(d.tmin)}°
                          </span>
                        </p>
                        <p className="mt-1 flex items-center justify-center gap-2 text-[10px] font-semibold text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <CloudRain className="h-3 w-3" aria-hidden />
                            {d.precip === null ? "—" : d.precip}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Wind className="h-3 w-3" aria-hidden />
                            {d.windMax === null ? "—" : d.windMax}
                          </span>
                        </p>
                        {worst && (
                          <p
                            className={`mt-1.5 flex items-center justify-center gap-1 text-[10px] font-bold ${LEVEL_STYLE[worst.level].text}`}
                          >
                            {(() => {
                              const I = WARNING_ICONS[worst.type];
                              return <I className="h-3 w-3" aria-hidden />;
                            })()}
                            {levelName(worst.level)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* warning cards */}
              {warnings.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {warnings.map((w) => (
                    <WarningCard key={w.type} w={w} t={t} L={L} lang={lang} />
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border bg-primary/5 p-4 text-sm leading-relaxed text-primary">
                  {fill(t.risk.noWarnings, { crop: L(crop.name) })}
                </p>
              )}

              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {fill(t.risk.forecastDisclaimer, {
                  provider: forecast.provider,
                  model: forecast.model,
                  retrieved: new Date(forecast.retrievedAt).toLocaleString(
                    lang === "ar" ? "ar-EG" : "en-GB"
                  ),
                })}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- finding card ---------------- */

function RiskCard({
  f,
  t,
  L,
  lang,
}: {
  f: RiskFinding;
  t: ReturnType<typeof useLang>["t"];
  L: (b: { en: string; ar: string }) => string;
  lang: "en" | "ar";
}) {
  const Icon = RISK_ICONS[f.type] ?? Gauge;
  const st = LEVEL_STYLE[f.level];
  return (
    <Card className={`h-full border-2 ${st.border} ${st.bg} shadow-sm`}>
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${st.dot}`}
            aria-hidden
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-extrabold leading-tight">
              {L(RISK_TYPE_LABELS[f.type])}
            </h3>
            <span
              className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${st.text}`}
            >
              {t.risk[
                `level${f.level[0].toUpperCase()}${f.level.slice(1)}` as keyof typeof t.risk
              ] as string}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border bg-card p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {t.risk.measuredLabel}
            </p>
            <p dir="ltr" className="mt-0.5 text-sm font-extrabold">{f.value}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {L(f.valueLabel)}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {t.risk.thresholdLabel}
            </p>
            <p className="mt-0.5 text-sm font-extrabold text-primary">
              {L(f.threshold)}
            </p>
          </div>
        </div>

        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            {t.risk.impactLabel}
          </p>
          <p className="mt-1 text-sm leading-relaxed">{L(f.impact)}</p>
        </div>

        <div className="mt-auto">
          <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <Info className="h-3.5 w-3.5" aria-hidden />
            {t.risk.recommendationsLabel}
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {f.recommendations.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${st.dot}`}
                  aria-hidden
                />
                <span>{L(r)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between gap-2 border-t pt-2.5">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${PROVENANCE_STYLE[f.provenance]}`}
          >
            {f.provenance === "nasa"
              ? t.risk.provenanceNasa
              : f.provenance === "user-input"
                ? t.risk.provenanceInput
                : t.risk.provenanceDocumented}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {lang === "ar" ? "المصدر: " : "Source: "}
            {f.provenance === "nasa"
              ? "NASA POWER 365-day record"
              : f.provenance === "user-input"
                ? lang === "ar"
                  ? "مدخل المزارع + ناسا"
                  : "farmer input + NASA"
                : lang === "ar"
                  ? "قاعدة بيانات المحاصيل"
                  : "crop database"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- warning card ---------------- */

function WarningCard({
  w,
  t,
  L,
  lang,
}: {
  w: EarlyWarning;
  t: ReturnType<typeof useLang>["t"];
  L: (b: { en: string; ar: string }) => string;
  lang: "en" | "ar";
}) {
  const Icon = WARNING_ICONS[w.type];
  const st = LEVEL_STYLE[w.level];
  const fmtDate = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(
      lang === "ar" ? "ar-EG" : "en-GB",
      { day: "numeric", month: "short" }
    );
  return (
    <div className={`rounded-xl border-2 p-4 ${st.border} ${st.bg}`}>
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${st.dot}`}
          aria-hidden
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-extrabold">
            {w.type === "heat"
              ? t.risk.warningHeat
              : w.type === "cold"
                ? t.risk.warningCold
                : w.type === "rain"
                  ? t.risk.warningRain
                  : t.risk.warningWind}
          </h4>
          <p
            className={`text-[11px] font-bold ${st.text}`}
          >
            {t.risk[
              `level${w.level[0].toUpperCase()}${w.level.slice(1)}` as keyof typeof t.risk
            ] as string}{" "}
            · {w.dates.map(fmtDate).join("، ")}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border bg-card p-2">
          <p className="font-bold uppercase text-muted-foreground">
            {t.risk.measuredLabel}
          </p>
          <p dir="ltr" className="mt-0.5 text-sm font-extrabold">{w.value}</p>
          <p className="text-[10px] leading-snug text-muted-foreground">
            {L(w.valueLabel)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-2">
          <p className="font-bold uppercase text-muted-foreground">
            {t.risk.thresholdLabel}
          </p>
          <p className="mt-0.5 text-sm font-extrabold text-primary">
            {L(w.threshold)}
          </p>
        </div>
      </div>
      <p className="mt-2.5 text-sm leading-relaxed">{L(w.impact)}</p>
      <ul className="mt-2 space-y-1">
        {w.recommendations.map((r, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${st.dot}`} aria-hidden />
            <span>{L(r)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- charts ---------------- */

const CHART_LIGHT = {
  mean: "#1E5B3C",
  max: "#D97706",
  min: "#7BAF8D",
  grid: "#DFE7E0",
  tick: "#5C6B5E",
  band: "rgba(62,142,90,0.14)",
  limit: "#D93025",
};
const CHART_DARK = {
  mean: "#7FC08F",
  max: "#F0B35C",
  min: "#9DB89A",
  grid: "#2A382D",
  tick: "#93A596",
  band: "rgba(127,192,143,0.12)",
  limit: "#F07B6A",
};

function ThresholdTempChart({
  result,
  crop,
  t,
  lang,
}: {
  result: AnalysisResult;
  crop: CropRecord;
  t: ReturnType<typeof useLang>["t"];
  lang: "en" | "ar";
}) {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === "dark" ? CHART_DARK : CHART_LIGHT;
  const hasT2mMax = result.monthly.some((m) => m.t2mMax !== null);
  const hasT2mMin = result.monthly.some((m) => m.t2mMin !== null);
  if (!hasT2mMax && !hasT2mMin) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-4 text-sm text-muted-foreground">
          {t.charts.notEnoughData}
        </CardContent>
      </Card>
    );
  }

  const data = result.monthly.map((m) => ({
    month: monthName(m.month, lang),
    t2mMax: m.t2mMax,
    t2m: m.t2m,
    t2mMin: m.t2mMin,
  }));

  const axisProps = {
    stroke: c.tick,
    tick: { fill: c.tick, fontSize: 12 },
    tickLine: { stroke: c.grid },
    axisLine: { stroke: c.grid },
  } as const;

  const tooltipStyle = {
    backgroundColor: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    color: "var(--popover-foreground)",
    fontSize: 13,
    direction: "ltr" as const,
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-bold sm:text-lg">
          <Thermometer className="h-4 w-4 text-primary" aria-hidden />
          {t.risk.chartTempTitle}
        </CardTitle>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t.risk.chartTempDesc}
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-72" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
              <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} unit="°C" width={54} domain={["auto", "auto"]} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, color: c.tick }} />
              {/* documented optimum band */}
              <ReferenceArea
                y1={crop.temp.optMin}
                y2={crop.temp.optMax}
                fill={c.band}
                strokeOpacity={0}
                label={{
                  value: `${t.risk.legendOptimal} ${crop.temp.optMin}–${crop.temp.optMax}°C`,
                  position: "insideTopRight",
                  fill: c.tick,
                  fontSize: 11,
                }}
              />
              {/* absolute limits */}
              <ReferenceLine
                y={crop.temp.absMax}
                stroke={c.limit}
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{
                  value: `${t.risk.legendAbsMax} ${crop.temp.absMax}°C`,
                  position: "insideTopLeft",
                  fill: c.limit,
                  fontSize: 11,
                }}
              />
              <ReferenceLine
                y={crop.temp.absMin}
                stroke={c.limit}
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{
                  value: `${t.risk.legendAbsMin} ${crop.temp.absMin}°C`,
                  position: "insideBottomRight",
                  fill: c.limit,
                  fontSize: 11,
                }}
              />
              {hasT2mMax && (
                <Line
                  name={t.charts.tempMax}
                  dataKey="t2mMax"
                  type="monotone"
                  stroke={c.max}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              )}
              <Line
                name={t.charts.tempMean}
                dataKey="t2m"
                type="monotone"
                stroke={c.mean}
                strokeWidth={3}
                dot={false}
                connectNulls
              />
              {hasT2mMin && (
                <Line
                  name={t.charts.tempMin}
                  dataKey="t2mMin"
                  type="monotone"
                  stroke={c.min}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {t.risk.chartLegendNote}
        </p>
      </CardContent>
    </Card>
  );
}

function ThresholdWindChart({
  result,
  crop,
  t,
}: {
  result: AnalysisResult;
  crop: CropRecord;
  t: ReturnType<typeof useLang>["t"];
}) {
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === "dark" ? CHART_DARK : CHART_LIGHT;
  const hasWind = result.monthly.some((m) => m.ws10m !== null);
  if (!hasWind) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-bold sm:text-lg">
            <Wind className="h-4 w-4 text-primary" aria-hidden />
            {t.risk.chartWindTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
            <Info className="h-4 w-4" aria-hidden />
            {t.risk.windDataUnavailable}
          </div>
        </CardContent>
      </Card>
    );
  }
  const data = result.monthly.map((m) => ({
    month: monthName(m.month, "en"),
    ws10m: m.ws10m,
  }));
  const axisProps = {
    stroke: c.tick,
    tick: { fill: c.tick, fontSize: 12 },
    tickLine: { stroke: c.grid },
    axisLine: { stroke: c.grid },
  } as const;
  const tooltipStyle = {
    backgroundColor: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    color: "var(--popover-foreground)",
    fontSize: 13,
    direction: "ltr" as const,
  };
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-bold sm:text-lg">
          <Wind className="h-4 w-4 text-primary" aria-hidden />
          {t.risk.chartWindTitle}
        </CardTitle>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {fill(t.risk.chartWindDesc, { tol: crop.windTolerance })}
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-72" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
              <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} unit=" m/s" width={54} domain={["auto", "auto"]} />
              <Tooltip contentStyle={tooltipStyle} />
              <ReferenceLine
                y={crop.windTolerance}
                stroke={c.limit}
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{
                  value: `${t.risk.legendWindTol} ${crop.windTolerance} m/s`,
                  position: "insideTopLeft",
                  fill: c.limit,
                  fontSize: 11,
                }}
              />
              <Line
                name={t.risk.legendWindMean}
                dataKey="ws10m"
                type="monotone"
                stroke={c.mean}
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: c.mean }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default RiskDashboard;
