"use client";

import { useMemo, useState } from "react";
import { useLang } from "@/lib/i18n/LanguageContext";
import { CROPS, getCrop } from "@/lib/crops";
import { searchCrops } from "@/lib/planting";
import type { PlantingResult, MonthScore } from "@/lib/planting";
import { useToolsStore } from "@/lib/toolsStore";
import { SEASON_LABELS } from "@/lib/labels";
import {
  monthName,
  type Bilingual,
  type Season,
} from "@/lib/types";
import { LocationPicker } from "../LocationPicker";
import { CropIcon } from "../icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ComposedChart,
  Bar,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  CloudRain,
  Info,
  Leaf,
  Loader2,
  Moon,
  Sprout,
  Sun,
  Thermometer,
} from "lucide-react";

const fmt = (v: number | null | undefined, digits = 1, suffix = "") =>
  v === null || v === undefined
    ? "—"
    : `${v.toFixed(digits)}${suffix}`;

export function PlantingView() {
  const { t, L, lang } = useLang();
  const tools = useToolsStore();

  const [cropQ, setCropQ] = useState("");
  const [selectedCropId, setSelectedCropId] = useState<string | null>(null);
  const [variety, setVariety] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notSupported, setNotSupported] = useState<{
    message: string;
    crops: { id: string; en: string; ar: string }[];
  } | null>(null);
  const [result, setResult] = useState<PlantingResult | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const suggestions = useMemo(() => {
    const hits = cropQ.trim() ? searchCrops(cropQ) : CROPS;
    return hits.slice(0, 7);
  }, [cropQ]);

  const canSubmit =
    (selectedCropId !== null || cropQ.trim().length >= 2) &&
    tools.location !== null;

  const submit = async () => {
    if (!tools.location) return;
    setLoading(true);
    setError(null);
    setNotSupported(null);
    setResult(null);
    setSelectedMonth(null);
    try {
      const now = new Date();
      const res = await fetch("/api/planting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crop: selectedCropId ?? cropQ.trim(),
          lat: tools.location.lat,
          lng: tools.location.lng,
          label: tools.location.label,
          currentMonth: now.getMonth() + 1,
          variety: variety.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        tools.setPlanting(data);
        const cur = data?.decision?.targetMonth ?? data?.computed?.bestMonth;
        if (cur) setSelectedMonth(cur);
      } else if (res.status === 404 && data.error === "crop_not_supported") {
        setNotSupported({
          message: data.message ?? "",
          crops: data.supportedCrops ?? [],
        });
      } else {
        setError(data.message ?? t.errors.nasaFailed);
      }
    } catch {
      setError(t.errors.generic);
    } finally {
      setLoading(false);
    }
  };

  const monthLabel = (m: number) => monthName(m, lang);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {/* ---------- header ---------- */}
      <header className="max-w-3xl">
        <p className="inline-flex items-center gap-2 rounded-full border bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">
          <Sprout className="h-3.5 w-3.5" aria-hidden />
          {t.nav.tools}
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t.planting.title}
        </h1>
        <p className="mt-3 text-muted-foreground">{t.planting.subtitle}</p>
      </header>

      {/* ---------- form ---------- */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Leaf className="h-5 w-5 text-primary" aria-hidden />
              {t.planting.cropLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <div className="relative">
                    <Input
                      value={cropQ}
                      onChange={(e) => {
                        setCropQ(e.target.value);
                        setSelectedCropId(null);
                      }}
                      onFocus={() => setOpen(true)}
                      placeholder={t.planting.cropPlaceholder}
                      aria-label={t.planting.cropLabel}
                      className="h-12 text-base"
                    />
                    <ChevronRight className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-muted-foreground rtl:-rotate-90" aria-hidden />
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      value={cropQ}
                      onValueChange={(v) => {
                        setCropQ(v);
                        setSelectedCropId(null);
                      }}
                      placeholder={t.planting.cropPlaceholder}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {t.planting.notSupportedTitle}
                      </CommandEmpty>
                      <CommandGroup>
                        {suggestions.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={c.id}
                            onSelect={() => {
                              setSelectedCropId(c.id);
                              setCropQ(L(c.name));
                              setOpen(false);
                            }}
                            className="gap-2"
                          >
                            <span
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
                              style={{ backgroundColor: c.color }}
                            >
                              <CropIcon name={c.icon} className="h-4 w-4" />
                            </span>
                            <span className="font-semibold">{L(c.name)}</span>
                            <span className="text-xs italic text-muted-foreground">
                              {c.scientificName}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                {t.planting.cropHelp}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold" htmlFor="variety">
                {t.planting.varietyLabel}
              </label>
              <Input
                id="variety"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                placeholder={t.planting.varietyPlaceholder}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                {t.planting.varietyHelp}
              </p>
            </div>
          </CardContent>
        </Card>

        <LocationPicker
          title={t.analyze.stepLocation}
          hint={t.planting.locationHint}
        />
      </div>

      <div className="mt-6 flex flex-col items-stretch gap-2 sm:items-center">
        <Button
          size="lg"
          className="h-12 px-8 text-base font-bold"
          onClick={submit}
          disabled={loading || !canSubmit}
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              {t.planting.analyzing}
            </>
          ) : (
            <>
              <CalendarCheck className="h-5 w-5" aria-hidden />
              {t.planting.analyzeBtn}
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          {loading ? t.planting.analyzingNote : t.common.seeMethodology}
        </p>
      </div>

      {/* ---------- not supported ---------- */}
      {notSupported && (
        <Card className="mt-8 border-amber-300/70 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
          <CardContent className="flex flex-col gap-3 p-6">
            <div className="flex items-start gap-3">
              <Info
                className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden
              />
              <div>
                <h3 className="font-bold text-amber-800 dark:text-amber-300">
                  {t.planting.notSupportedTitle}
                </h3>
                <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/90">
                  {notSupported.message}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {notSupported.crops.map((c) => (
                <Badge key={c.id} variant="outline" className="font-semibold">
                  {lang === "ar" ? c.ar : c.en}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {t.planting.notSupportedBody}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ---------- error ---------- */}
      {error && (
        <Card className="mt-8 border-destructive/50">
          <CardContent className="flex items-start gap-3 p-6">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" aria-hidden />
            <div>
              <h3 className="font-bold text-destructive">
                {t.planting.errorTitle}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={submit}>
                {t.common.retry}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------- loading ---------- */}
      {loading && (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          <p className="font-semibold">{t.planting.analyzing}</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {t.planting.analyzingNote}
          </p>
        </div>
      )}

      {/* ---------- results ---------- */}
      {result && (
        <div className="mt-10 flex flex-col gap-8">
          <DecisionBanner result={result} />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              icon={CalendarCheck}
              label={t.planting.recommendedSeason}
              value={
                result.computed.recommendedSeason
                  ? L(SEASON_LABELS[result.computed.recommendedSeason as Season])
                  : "—"
              }
              accent={
                result.computed.recommendedSeason ? "green" : "muted"
              }
            />
            <SummaryCard
              icon={Sprout}
              label={t.planting.bestMonth}
              value={
                result.computed.bestMonth
                  ? monthLabel(result.computed.bestMonth)
                  : "—"
              }
              accent={result.computed.bestMonth ? "green" : "muted"}
            />
            <SummaryCard
              icon={Clock}
              label={t.planting.targetMonth}
              value={
                result.decision.targetMonth
                  ? monthLabel(result.decision.targetMonth)
                  : "—"
              }
              accent={result.decision.targetMonth ? "amber" : "muted"}
            />
            <SummaryCard
              icon={Thermometer}
              label={t.planting.cropTempRange}
              value={`${result.crop.documented.temp.optMin}–${result.crop.documented.temp.optMax}°C`}
              accent="muted"
            />
          </div>

          {(result.computed.alternativeMonths.length > 0 ||
            result.computed.cautionMonths.length > 0) && (
            <Card className="shadow-sm">
              <CardContent className="flex flex-col gap-3 p-5">
                {result.computed.alternativeMonths.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold">
                      {t.planting.alternativeMonths}:
                    </span>
                    {result.computed.alternativeMonths.map((m) => (
                      <Badge
                        key={m}
                        className="bg-emerald-100 font-semibold text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200"
                      >
                        {monthLabel(m)}
                      </Badge>
                    ))}
                  </div>
                )}
                {result.computed.cautionMonths.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold">
                      {t.planting.cautionMonths}:
                    </span>
                    {result.computed.cautionMonths.map((m) => (
                      <Badge
                        key={m}
                        variant="outline"
                        className="border-amber-400 font-semibold text-amber-700 dark:text-amber-300"
                      >
                        {monthLabel(m)}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <CurrentConditionsBlock result={result} />

          <MonthlySuitability
            result={result}
            selectedMonth={selectedMonth}
            onSelect={setSelectedMonth}
          />

          <TempVsRangeChart result={result} />

          <SeasonsTable result={result} />

          <DocumentedVsComputed result={result} />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Info className="h-5 w-5 text-primary" aria-hidden />
                  {t.planting.methodology}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {L(result.methodology)}
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sun className="h-5 w-5 text-primary" aria-hidden />
                  {t.planting.dataBasis}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">
                    {t.planting.basisHistorical}:
                  </strong>{" "}
                  {result.meta.climatology.baseline}
                </p>
                <p>
                  <strong className="text-foreground">
                    {t.planting.basisRecent}:
                  </strong>{" "}
                  {result.meta.multiYear.periodStart} →{" "}
                  {result.meta.multiYear.periodEnd} (
                  {result.meta.multiYear.years} {t.planting.monthsUnit === "أشهر" ? "أعوام" : "years"}
                  )
                  {result.current.recent
                    ? ` · ${t.planting.latestObs}: ${result.current.recent.latestObservationDate}`
                    : ""}
                </p>
                <p>
                  <strong className="text-foreground">
                    {t.planting.basisForecast}:
                  </strong>{" "}
                  {result.current.forecast
                    ? `${result.current.forecast.provider} — ${t.planting.forecastNote}`
                    : t.planting.noForecast}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );

  /* ================= subcomponents ================= */

  function DecisionBanner({ result }: { result: PlantingResult }) {
    const d = result.decision;
    const style =
      d.value === "plant_now"
        ? "border-emerald-400/70 bg-emerald-50 dark:bg-emerald-500/10"
        : d.value === "wait"
          ? "border-amber-400/70 bg-amber-50 dark:bg-amber-500/10"
          : "border-red-400/70 bg-red-50 dark:bg-red-500/10";
    const textCls =
      d.value === "plant_now"
        ? "text-emerald-700 dark:text-emerald-300"
        : d.value === "wait"
          ? "text-amber-700 dark:text-amber-300"
          : "text-red-700 dark:text-red-300";
    const icon =
      d.value === "plant_now" ? CheckCircle2 : d.value === "wait" ? Clock : AlertTriangle;
    const label =
      d.value === "plant_now"
        ? t.planting.decisionPlantNow
        : d.value === "wait"
          ? t.planting.decisionWait
          : t.planting.decisionNotRecommended;
    const Icon = icon;

    return (
      <section className={`rounded-2xl border-2 p-6 sm:p-8 ${style}`} role="status">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Icon className={`h-10 w-10 ${textCls}`} aria-hidden />
              <h2 className={`text-3xl font-extrabold tracking-tight sm:text-4xl ${textCls}`}>
                {label}
              </h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CropIcon
                name={getCrop(result.crop.id)?.icon ?? "Sprout"}
                className="h-4 w-4"
              />
              <span className="font-bold text-foreground">
                {L(result.crop.name)}
              </span>
              <span className="italic">{result.crop.scientificName}</span>
              {result.crop.variety && (
                <Badge variant="secondary" className="font-semibold">
                  {t.planting.varietyRecorded}: {result.crop.variety}
                </Badge>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-card/80 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {t.planting.basisLabel}
            </p>
            <p className="mt-1 text-sm leading-relaxed">{L(d.basis)}</p>
          </div>

          {d.reasons.length > 0 && (
            <div>
              <p className="text-sm font-bold">
                {t.planting.scientificReasons}
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {d.reasons.map((r: Bilingual, i: number) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    {L(r)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {d.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-300/70 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                {t.planting.warnings}
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {d.warnings.map((w: Bilingual, i: number) => (
                  <li
                    key={i}
                    className="text-sm leading-relaxed text-amber-800/90 dark:text-amber-200/90"
                  >
                    • {L(w)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    );
  }

  function SummaryCard({
    icon: Icon,
    label,
    value,
    accent,
  }: {
    icon: typeof Sprout;
    label: string;
    value: string;
    accent: "green" | "amber" | "muted";
  }) {
    const cls =
      accent === "green"
        ? "bg-primary/10 text-primary"
        : accent === "amber"
          ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
          : "bg-secondary text-secondary-foreground";
    return (
      <Card className="shadow-sm">
        <CardContent className="flex items-center gap-3 p-5">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${cls}`}>
            <Icon className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            <p className="truncate text-lg font-extrabold">{value}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  function CurrentConditionsBlock({ result }: { result: PlantingResult }) {
    const cur = result.current;
    const crop = result.crop;
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Thermometer className="h-5 w-5 text-primary" aria-hidden />
              {t.planting.currentConditions}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {cur.recent ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label={t.planting.meanTemp} value={fmt(cur.recent.t2mMean, 1, "°C")} />
                <Stat label={t.planting.meanDailyMax} value={fmt(cur.recent.tMaxMean, 1, "°C")} />
                <Stat label={t.planting.meanDailyMin} value={fmt(cur.recent.tMinMean, 1, "°C")} />
                <Stat
                  label={t.planting.latestObs}
                  value={cur.recent.latestObservationDate}
                  small
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t.common.notAvailable}
              </p>
            )}
            <p className="text-sm leading-relaxed text-muted-foreground">
              {L(cur.temperatureExplanation)}
            </p>

            {cur.forecast && (
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold">{t.planting.forecast}</p>
                  <Badge variant="outline" className="text-[11px] font-semibold">
                    {t.planting.forecastNote}
                  </Badge>
                </div>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[360px] text-sm">
                    <thead>
                      <tr className="border-b text-start text-xs text-muted-foreground">
                        <th className="py-1.5 text-start font-semibold">
                          {t.common.date}
                        </th>
                        <th className="py-1.5 text-end font-semibold">
                          Tmax
                        </th>
                        <th className="py-1.5 text-end font-semibold">
                          Tmin
                        </th>
                        <th className="py-1.5 text-end font-semibold">
                          {t.common.mm}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {cur.forecast.days.map((d) => (
                        <tr key={d.date} className="border-b last:border-0">
                          <td className="py-1.5 font-mono text-xs">{d.date}</td>
                          <td className="py-1.5 text-end font-bold">
                            {fmt(d.tmax, 1, "°C")}
                          </td>
                          <td className="py-1.5 text-end font-bold">
                            {fmt(d.tmin, 1, "°C")}
                          </td>
                          <td className="py-1.5 text-end">
                            {fmt(d.precip, 1, "")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {cur.forecast.provider}
                </p>
              </div>
            )}
            {!cur.forecast && (
              <p className="text-xs text-muted-foreground">
                {t.planting.noForecast}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {t.planting.cropTempRange}: {crop.documented.temp.optMin}–
              {crop.documented.temp.optMax}°C (abs {crop.documented.temp.absMin} /
              {crop.documented.temp.absMax}°C)
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CloudRain className="h-5 w-5 text-primary" aria-hidden />
                {t.planting.rainSuitability}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {L(cur.rainfallExplanation)}
              </p>
            </CardContent>
          </Card>
          {cur.heatStress && (
            <Card className="border-red-300/60 shadow-sm dark:border-red-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg text-red-700 dark:text-red-300">
                  <Sun className="h-5 w-5" aria-hidden />
                  {t.planting.heatStress}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {L(cur.heatStress)}
                </p>
              </CardContent>
            </Card>
          )}
          {cur.coldStress && (
            <Card className="border-sky-300/60 shadow-sm dark:border-sky-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg text-sky-700 dark:text-sky-300">
                  <Moon className="h-5 w-5" aria-hidden />
                  {t.planting.coldStress}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {L(cur.coldStress)}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  function MonthlySuitability({
    result,
    selectedMonth,
    onSelect,
  }: {
    result: PlantingResult;
    selectedMonth: number | null;
    onSelect: (m: number) => void;
  }) {
    const m = selectedMonth
      ? result.months[selectedMonth - 1]
      : null;
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">
            {t.planting.chartTitle}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t.planting.chartSubtitle}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {result.months.map((row) => (
              <button
                key={row.month}
                type="button"
                onClick={() => onSelect(row.month)}
                aria-pressed={selectedMonth === row.month}
                className={`flex flex-col items-center rounded-xl border-2 p-3 transition-all hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring ${
                  selectedMonth === row.month ? "ring-2 ring-ring" : ""
                } ${
                  row.classification === "suitable"
                    ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-500/15"
                    : row.classification === "caution"
                      ? "border-amber-400 bg-amber-50 dark:bg-amber-500/15"
                      : "border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10"
                }`}
              >
                <span className="text-sm font-bold">{monthLabel(row.month)}</span>
                <span className="mt-1 text-2xl font-extrabold">
                  {Math.round(row.plantingScore)}
                </span>
                <span className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
                  {row.classification === "suitable"
                    ? t.planting.monthSuitable
                    : row.classification === "caution"
                      ? t.planting.monthCaution
                      : t.planting.monthUnsuitable}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-emerald-400" aria-hidden />
              {t.planting.monthSuitable} (≥70)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-amber-400" aria-hidden />
              {t.planting.monthCaution} (45–69)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-red-300" aria-hidden />
              {t.planting.monthUnsuitable} (&lt;45)
            </span>
          </div>

          {m && <MonthDetails month={m} result={result} />}
        </CardContent>
      </Card>
    );
  }

  function MonthDetails({
    month,
    result,
  }: {
    month: MonthScore;
    result: PlantingResult;
  }) {
    const v = month.values;
    const crop = result.crop;
    const factors: [string, number | null][] = [
      [t.planting.factorTemp, month.factors.temperature],
      [t.planting.factorDayHeat, month.factors.dayHeat],
      [t.planting.factorNightCold, month.factors.nightCold],
      [t.planting.factorSolar, month.factors.solar],
      [t.planting.factorHumidity, month.factors.humidity],
      [t.planting.factorWind, month.factors.wind],
    ];
    return (
      <div className="rounded-xl border bg-background/60 p-4 sm:p-5">
        <h4 className="text-lg font-bold">
          {t.planting.monthDetails} — {monthLabel(month.month)}
        </h4>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-bold">{t.planting.climateConditions}</p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <Stat label={t.planting.meanTemp} value={fmt(v.t2mMean, 1, "°C")} />
              <Stat label={t.planting.meanDailyMax} value={fmt(v.tMaxMean, 1, "°C")} />
              <Stat label={t.planting.meanDailyMin} value={fmt(v.tMinMean, 1, "°C")} />
              <Stat label={t.planting.typicalHotDay} value={fmt(v.tMaxExtreme, 1, "°C")} />
              <Stat label={t.planting.typicalColdNight} value={fmt(v.tMinExtreme, 1, "°C")} />
              <Stat label={t.charts.solarLabel} value={fmt(v.solar, 1, " kWh/m²/d")} />
              <Stat label={t.charts.humidityLabel} value={fmt(v.rh, 0, "%")} />
              <Stat label={t.charts.windLabel} value={fmt(v.wind, 1, " m/s")} />
              <Stat label={t.planting.cycleRain} value={fmt(month.cycleRainfallMm, 1, " mm")} />
              <Stat
                label={t.planting.cycleScore}
                value={
                  month.cycleScore === null ? "—" : Math.round(month.cycleScore) + t.action.scoreUnit
                }
              />
            </dl>
          </div>
          <div>
            <p className="text-sm font-bold">{t.planting.cropRequirements}</p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <Stat
                label={t.planting.factorTemp}
                value={`${crop.documented.temp.optMin}–${crop.documented.temp.optMax}°C`}
              />
              <Stat
                label={t.planting.meanDailyMax}
                value={`< ${crop.documented.temp.optMax}°C`}
              />
              <Stat
                label={t.planting.meanDailyMin}
                value={`> ${crop.documented.temp.optMin}°C`}
              />
              <Stat
                label={t.planting.factorSolar}
                value={`${fmt(cropTempSolarMin(), 1, "")}–${fmt(cropTempSolarMax(), 1, " kWh/m²/d")}`}
              />
            </dl>
            <p className="mt-4 text-sm font-bold">{t.planting.whyRating}</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {factors.map(([label, score]) => (
                <div key={label} className="flex items-center gap-2 text-sm">
                  <span className="w-36 shrink-0 truncate text-muted-foreground">
                    {label}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${
                        (score ?? 0) >= 70
                          ? "bg-emerald-500"
                          : (score ?? 0) >= 45
                            ? "bg-amber-500"
                            : "bg-red-400"
                      }`}
                      style={{ width: `${score ?? 0}%` }}
                    />
                  </div>
                  <span className="w-10 text-end font-bold tabular-nums">
                    {score === null ? "—" : Math.round(score)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm font-bold">
              {t.planting.plantingScore}:{" "}
              <span className="text-lg">
                {Math.round(month.plantingScore)}
                {t.action.scoreUnit}
              </span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  function cropTempSolarMin() {
    return result ? (getCrop(result.crop.id)?.solar.optMin ?? null) : null;
  }
  function cropTempSolarMax() {
    return result ? (getCrop(result.crop.id)?.solar.optMax ?? null) : null;
  }

  function TempVsRangeChart({ result }: { result: PlantingResult }) {
    const crop = result.crop;
    const data = result.months.map((m) => ({
      month: monthLabel(m.month),
      t2m: m.values.t2mMean,
      score: Math.round(m.plantingScore),
    }));
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">{t.planting.tempChartTitle}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t.planting.tempChartSubtitle}
          </p>
        </CardHeader>
        <CardContent>
          <div dir="ltr" className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) =>
                    lang === "ar" ? v : v.slice(0, 3)
                  }
                />
                <YAxis
                  yAxisId="temp"
                  tick={{ fontSize: 11 }}
                  label={{
                    value: "°C",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 11,
                  }}
                />
                <YAxis
                  yAxisId="score"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <ReferenceArea
                  yAxisId="temp"
                  y1={crop.documented.temp.optMin}
                  y2={crop.documented.temp.optMax}
                  fill="var(--primary)"
                  fillOpacity={0.12}
                  label={{
                    value: `${crop.documented.temp.optMin}–${crop.documented.temp.optMax}°C`,
                    fontSize: 10,
                    fill: "var(--muted-foreground)",
                  }}
                />
                <ReferenceLine
                  yAxisId="temp"
                  y={crop.documented.temp.absMax}
                  stroke="var(--destructive)"
                  strokeDasharray="4 4"
                />
                <ReferenceLine
                  yAxisId="temp"
                  y={crop.documented.temp.absMin}
                  stroke="var(--destructive)"
                  strokeDasharray="4 4"
                />
                <Bar
                  yAxisId="score"
                  dataKey="score"
                  name={t.planting.plantingScore}
                  radius={[4, 4, 0, 0]}
                  fill="var(--chart-4)"
                  opacity={0.55}
                />
                <Line
                  yAxisId="temp"
                  type="monotone"
                  dataKey="t2m"
                  name={t.planting.meanTemp}
                  stroke="var(--chart-2)"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  }

  function SeasonsTable({ result }: { result: PlantingResult }) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">{t.planting.seasonsTable}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t.planting.seasonsNote}
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 text-start font-semibold">
                    {t.results.seasonLabel}
                  </th>
                  <th className="py-2 text-start font-semibold">
                    {t.planting.seasonBestMonth}
                  </th>
                  <th className="py-2 text-end font-semibold">
                    {t.planting.scoreLabel}
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.seasons.map((s) => (
                  <tr key={s.season} className="border-b last:border-0">
                    <td className="py-2.5 font-bold">
                      {L(SEASON_LABELS[s.season as Season])}
                    </td>
                    <td className="py-2.5">
                      {s.bestMonth ? monthLabel(s.bestMonth) : "—"}
                    </td>
                    <td className="py-2.5 text-end">
                      <Badge
                        className={
                          s.classification === "suitable"
                            ? "bg-emerald-100 font-bold text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200"
                            : s.classification === "caution"
                              ? "border-amber-400 font-bold text-amber-700 dark:text-amber-300"
                              : "border-red-300 font-bold text-red-700 dark:border-red-500/50 dark:text-red-300"
                        }
                        variant={
                          s.classification === "suitable" ? "default" : "outline"
                        }
                      >
                        {Math.round(s.bestScore)}
                        {t.action.scoreUnit}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  }

  function DocumentedVsComputed({ result }: { result: PlantingResult }) {
    const crop = result.crop;
    const documentedSeasons = crop.documented.seasons
      .map((s) => L(SEASON_LABELS[s as Season]))
      .join(" · ");
    const computedSeason = result.computed.recommendedSeason
      ? L(SEASON_LABELS[result.computed.recommendedSeason as Season])
      : "—";
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Info className="h-5 w-5 text-primary" aria-hidden />
              {t.planting.documentedCalendar}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">
                {t.results.seasonLabel}:
              </strong>{" "}
              {documentedSeasons}
            </p>
            <p>
              <strong className="text-foreground">
                {t.planting.bestMonth}:
              </strong>{" "}
              {crop.documented.plantingMonths
                .map((m) => monthLabel(m))
                .join(" · ")}
            </p>
            <p>
              <strong className="text-foreground">
                {t.results.durationLabel}:
              </strong>{" "}
              {crop.documented.durationDays[0]}–{crop.documented.durationDays[1]}{" "}
              {lang === "ar" ? "يوم" : "days"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-primary/40 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sprout className="h-5 w-5 text-primary" aria-hidden />
              {t.planting.computedFromClimate}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">
                {t.planting.recommendedSeason}:
              </strong>{" "}
              {computedSeason}
            </p>
            <p>
              <strong className="text-foreground">
                {t.planting.bestMonth}:
              </strong>{" "}
              {result.computed.bestMonth
                ? monthLabel(result.computed.bestMonth)
                : "—"}
            </p>
            <p>
              <strong className="text-foreground">
                {t.planting.alternativeMonths}:
              </strong>{" "}
              {result.computed.alternativeMonths
                .map((m) => monthLabel(m))
                .join(" · ") || "—"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  function Stat({
    label,
    value,
    small,
  }: {
    label: string;
    value: string;
    small?: boolean;
  }) {
    return (
      <div className="rounded-lg bg-background/70 p-2">
        <dt className="text-[11px] text-muted-foreground">{label}</dt>
        <dd
          className={`mt-0.5 font-bold ${small ? "font-mono text-xs" : "text-base"}`}
        >
          {value}
        </dd>
      </div>
    );
  }
}
