"use client";

import { useMemo, useState } from "react";
import { useLang } from "@/lib/i18n/LanguageContext";
import { CROPS } from "@/lib/crops";
import { searchCrops } from "@/lib/planting";
import type { IrrigationResult } from "@/lib/irrigation";
import { useToolsStore } from "@/lib/toolsStore";
import { IRRIGATION_LABELS, SOIL_LABELS, WATER_LABELS } from "@/lib/labels";
import { monthName } from "@/lib/types";
import type { Bilingual } from "@/lib/types";
import { LocationPicker } from "../LocationPicker";
import { CropIcon } from "../icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  AreaChart,
  Area,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  AlertTriangle,
  ChevronRight,
  Droplets,
  Info,
  Loader2,
  Sprout,
  TrendingDown,
  TrendingUp,
  Waves,
} from "lucide-react";

const fmt = (v: number | null | undefined, digits = 2, suffix = "") =>
  v === null || v === undefined ? "—" : `${v.toFixed(digits)}${suffix}`;

const STAGE_VALUES = ["initial", "development", "mid", "late"] as const;
type StageValue = (typeof STAGE_VALUES)[number];

export function IrrigationView() {
  const { t, L, lang } = useLang();
  const tools = useToolsStore();

  const [cropQ, setCropQ] = useState("");
  const [selectedCropId, setSelectedCropId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<StageValue>("mid");
  const [soil, setSoil] = useState<string>("unknown");
  const [water, setWater] = useState<string>("moderate");
  const [method, setMethod] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notSupported, setNotSupported] = useState<string | null>(null);
  const [result, setResult] = useState<IrrigationResult | null>(null);

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
    const now = new Date();
    const dayOfYear =
      Math.floor(
        (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) /
          86400000
      ) || 1;
    try {
      const res = await fetch("/api/irrigation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crop: selectedCropId ?? cropQ.trim(),
          lat: tools.location.lat,
          lng: tools.location.lng,
          label: tools.location.label,
          growthStage: stage,
          soilType: soil === "unknown" ? undefined : soil,
          waterAvailability: water === "unknown" ? undefined : water,
          irrigationMethod: method || undefined,
          currentMonth: now.getMonth() + 1,
          currentDayOfYear: dayOfYear,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        tools.setIrrigation(data);
      } else if (res.status === 404 && data.error === "crop_not_supported") {
        setNotSupported(data.message ?? t.planting.notSupportedTitle);
      } else {
        setError(data.message ?? t.errors.nasaFailed);
      }
    } catch {
      setError(t.errors.generic);
    } finally {
      setLoading(false);
    }
  };

  const stageLabel = (v: StageValue) =>
    v === "initial"
      ? t.irrigation.stageInitial
      : v === "development"
        ? t.irrigation.stageDevelopment
        : v === "mid"
          ? t.irrigation.stageMid
          : t.irrigation.stageLate;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="max-w-3xl">
        <p className="inline-flex items-center gap-2 rounded-full border bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">
          <Droplets className="h-3.5 w-3.5" aria-hidden />
          {t.nav.tools}
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t.irrigation.title}
        </h1>
        <p className="mt-3 text-muted-foreground">{t.irrigation.subtitle}</p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sprout className="h-5 w-5 text-primary" aria-hidden />
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
                      <CommandEmpty>{t.planting.notSupportedTitle}</CommandEmpty>
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
              <p className="text-xs text-muted-foreground">{t.planting.cropHelp}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold" htmlFor="stage">
                {t.irrigation.stageLabel}
              </label>
              <Select value={stage} onValueChange={(v) => setStage(v as StageValue)}>
                <SelectTrigger id="stage" className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGE_VALUES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {stageLabel(v)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t.irrigation.stageHelp}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold" htmlFor="soil">
                  {t.irrigation.soilLabel}
                </label>
                <Select value={soil} onValueChange={setSoil}>
                  <SelectTrigger id="soil" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["clay", "sandy", "loam", "unknown"] as const).map((s) => (
                      <SelectItem key={s} value={s}>
                        {L(SOIL_LABELS[s])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold" htmlFor="water">
                  {t.irrigation.waterLabel}
                </label>
                <Select value={water} onValueChange={setWater}>
                  <SelectTrigger id="water" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["limited", "moderate", "abundant"] as const).map((w) => (
                      <SelectItem key={w} value={w}>
                        {L(WATER_LABELS[w])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold" htmlFor="method">
                  {t.irrigation.methodLabel}
                </label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger id="method" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["", "flood", "drip", "sprinkler"] as const).map((m) => (
                      <SelectItem key={m} value={m}>
                        {m === "" ? "—" : L(IRRIGATION_LABELS[m])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <LocationPicker title={t.analyze.stepLocation} hint={t.planting.locationHint} />
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
              {t.irrigation.analyzing}
            </>
          ) : (
            <>
              <Droplets className="h-5 w-5" aria-hidden />
              {t.irrigation.analyzeBtn}
            </>
          )}
        </Button>
      </div>

      {notSupported && (
        <Card className="mt-8 border-amber-300/70 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
          <CardContent className="flex items-start gap-3 p-6">
            <Info className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
            <div>
              <h3 className="font-bold text-amber-800 dark:text-amber-300">
                {t.planting.notSupportedTitle}
              </h3>
              <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/90">
                {notSupported}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="mt-8 border-destructive/50">
          <CardContent className="flex items-start gap-3 p-6">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" aria-hidden />
            <div>
              <h3 className="font-bold text-destructive">{t.irrigation.errorTitle}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={submit}>
                {t.common.retry}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          <p className="font-semibold">{t.irrigation.analyzing}</p>
        </div>
      )}

      {result && (
        <div className="mt-10 flex flex-col gap-8">
          {/* crop + stage header */}
          <div className="flex flex-wrap items-center gap-3">
            <CropIcon
              name={CROPS.find((c) => c.id === result.crop.id)?.icon ?? "Sprout"}
              className="h-6 w-6 text-primary"
            />
            <h2 className="text-2xl font-extrabold">{L(result.crop.name)}</h2>
            <span className="italic text-muted-foreground">
              {result.crop.scientificName}
            </span>
            <Badge variant="secondary" className="font-semibold">
              {stageLabel(result.stage)}
            </Badge>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* ETo card */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Waves className="h-5 w-5 text-primary" aria-hidden />
                  {t.irrigation.etoTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {result.eto ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Stat
                        label={t.irrigation.etoCurrent}
                        value={fmt(result.eto.currentMonth, 2, ` ${t.irrigation.mmDay}`)}
                        big
                      />
                      <Stat
                        label={t.irrigation.etoRecent}
                        value={fmt(result.eto.recent, 2, ` ${t.irrigation.mmDay}`)}
                        big
                      />
                      <Stat
                        label={t.irrigation.elevation}
                        value={`${result.eto.elevationM} m`}
                      />
                      <Stat label={t.irrigation.etoMethod} value="FAO-56 PM" small />
                    </div>
                    <div className="rounded-lg border bg-background/60 p-3">
                      <p className="text-xs font-bold text-muted-foreground">
                        {t.irrigation.etoInputs}
                      </p>
                      <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground sm:grid-cols-3">
                        <div>lat: {result.eto.inputsUsed.lat}°</div>
                        <div>J: {result.eto.inputsUsed.dayOfYear}</div>
                        <div>z: {result.eto.elevationM} m</div>
                        <div>Tmax: {fmt(result.eto.inputsUsed.tMax, 1, "°C")}</div>
                        <div>Tmin: {fmt(result.eto.inputsUsed.tMin, 1, "°C")}</div>
                        <div>RH: {fmt(result.eto.inputsUsed.rhMean, 0, "%")}</div>
                        <div>u10: {fmt(result.eto.inputsUsed.wind10, 1, " m/s")}</div>
                        <div>Rs: {fmt(result.eto.inputsUsed.rsMj, 1, " MJ/m²/d")}</div>
                      </dl>
                    </div>
                    {result.meta.recent && (
                      <p className="text-xs text-muted-foreground">
                        {t.planting.latestObs}:{" "}
                        {result.meta.recent.latestObservationDate}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    {t.irrigation.etoUnavailable}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* ETc card */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Droplets className="h-5 w-5 text-primary" aria-hidden />
                  {t.irrigation.etcTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <Stat
                    label={t.irrigation.etcNow}
                    value={fmt(result.etc.etcMmDay, 2, ` ${t.irrigation.mmDay}`)}
                    big
                  />
                  <Stat
                    label={t.irrigation.etcPeak}
                    value={fmt(result.etc.peakMmDay, 2, ` ${t.irrigation.mmDay}`)}
                    big
                  />
                  <Stat label={t.irrigation.kcLabel} value={String(result.etc.kc)} />
                  <Stat
                    label={t.irrigation.stageLengths}
                    value={`${result.etc.stageLengths.lengths.join("/")}${lang === "ar" ? " يوم" : " d"}`}
                    small
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.irrigation.kcSource}: {L(result.etc.kcSource)}
                </p>
                {result.etc.kcNote && (
                  <p className="text-xs italic text-muted-foreground">
                    {L(result.etc.kcNote)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  FAO-56 Table 11: {result.etc.stageLengths.row}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ETo chart */}
          {result.eto && result.eto.monthly.some((m) => m.eto !== null) && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl">{t.irrigation.etoChartTitle}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t.irrigation.etoChartSubtitle}
                </p>
              </CardHeader>
              <CardContent>
                <div dir="ltr" className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={result.eto.monthly.map((m) => ({
                        month: monthName(m.month, lang),
                        eto: m.eto,
                      }))}
                      margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        label={{
                          value: t.irrigation.mmDay,
                          angle: -90,
                          position: "insideLeft",
                          fontSize: 10,
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="eto"
                        stroke="var(--chart-1)"
                        fill="var(--chart-1)"
                        fillOpacity={0.2}
                        strokeWidth={2.5}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* factors */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-amber-600" aria-hidden />
                  {t.irrigation.factorsIncreasing}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {result.factors.increasing.map((f: Bilingual, i: number) => (
                    <li key={i} className="text-sm leading-relaxed text-muted-foreground">
                      • {L(f)}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingDown className="h-5 w-5 text-sky-600" aria-hidden />
                  {t.irrigation.factorsReducing}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.factors.reducing.length ? (
                  <ul className="flex flex-col gap-2">
                    {result.factors.reducing.map((f: Bilingual, i: number) => (
                      <li key={i} className="text-sm leading-relaxed text-muted-foreground">
                        • {L(f)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* guidance */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{t.irrigation.generalGuidance}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {result.guidance.general.map((g: Bilingual, i: number) => (
                    <li key={i} className="text-sm leading-relaxed text-muted-foreground">
                      • {L(g)}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{t.irrigation.waterManagement}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {result.guidance.waterManagement.map((g: Bilingual, i: number) => (
                    <li key={i} className="text-sm leading-relaxed text-muted-foreground">
                      • {L(g)}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* explanation + disclosures */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{t.irrigation.explanation}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {L(result.guidance.explanation)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-amber-300/60 shadow-sm dark:border-amber-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />
                  {t.irrigation.disclosures}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {result.disclosures.map((d: Bilingual, i: number) => (
                    <li key={i} className="text-sm leading-relaxed text-muted-foreground">
                      • {L(d)}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );

  function Stat({
    label,
    value,
    big,
    small,
  }: {
    label: string;
    value: string;
    big?: boolean;
    small?: boolean;
  }) {
    return (
      <div className="rounded-lg bg-background/70 p-3">
        <dt className="text-[11px] text-muted-foreground">{label}</dt>
        <dd
          className={`mt-0.5 font-bold ${
            big ? "text-xl" : small ? "font-mono text-xs" : "text-base"
          }`}
        >
          {value}
        </dd>
      </div>
    );
  }
}
