"use client";

import { useMemo, useState } from "react";
import { useLang } from "@/lib/i18n/LanguageContext";
import { CROPS } from "@/lib/crops";
import { searchCrops } from "@/lib/planting";
import type { YieldResult } from "@/lib/yield";
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
  BarChart,
  Bar,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import {
  AlertTriangle,
  ChevronRight,
  Info,
  Loader2,
  Scale,
  Sprout,
  TrendingUp,
  XCircle,
} from "lucide-react";

const fmt = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined ? "—" : v.toFixed(digits);

export function YieldView() {
  const { t, L, lang } = useLang();
  const tools = useToolsStore();

  const [cropQ, setCropQ] = useState("");
  const [selectedCropId, setSelectedCropId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [area, setArea] = useState("");
  const [areaUnit, setAreaUnit] = useState("feddan");
  const [variety, setVariety] = useState("");
  const [plantingMonth, setPlantingMonth] = useState("none");
  const [soil, setSoil] = useState("unknown");
  const [water, setWater] = useState("unknown");
  const [method, setMethod] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notSupported, setNotSupported] = useState<string | null>(null);
  const [result, setResult] = useState<YieldResult | null>(null);

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
    try {
      const res = await fetch("/api/yield", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crop: selectedCropId ?? cropQ.trim(),
          lat: tools.location.lat,
          lng: tools.location.lng,
          label: tools.location.label,
          area: area.trim() ? Number(area) : undefined,
          areaUnit: areaUnit as "acres" | "hectares" | "feddan",
          variety: variety.trim() || undefined,
          plantingMonth:
            plantingMonth !== "none" ? Number(plantingMonth) : undefined,
          soilType: soil === "unknown" ? undefined : soil,
          waterAvailability: water === "unknown" ? undefined : water,
          irrigationMethod: method || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        tools.setYieldResult(data);
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

  const chartData = result
    ? Object.entries(result.reference.values.byYear).map(([year, v]) => ({
        year,
        yield: v,
      }))
    : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="max-w-3xl">
        <p className="inline-flex items-center gap-2 rounded-full border bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">
          <Scale className="h-3.5 w-3.5" aria-hidden />
          {t.nav.tools}
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t.yield.title}
        </h1>
        <p className="mt-3 text-muted-foreground">{t.yield.subtitle}</p>
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

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold" htmlFor="area">
                  {t.yield.areaLabel}
                </label>
                <Input
                  id="area"
                  type="number"
                  min="0"
                  step="0.1"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder={t.yield.areaPlaceholder}
                  className="h-11 w-32"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold" htmlFor="area-unit">
                  {t.yield.areaUnit}
                </label>
                <Select value={areaUnit} onValueChange={setAreaUnit}>
                  <SelectTrigger id="area-unit" className="h-11 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feddan">{t.yield.unitFeddan}</SelectItem>
                    <SelectItem value="acres">{t.yield.unitAcre}</SelectItem>
                    <SelectItem value="hectares">{t.yield.unitHectare}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold" htmlFor="yvariety">
                {t.yield.varietyLabel}
              </label>
              <Input
                id="yvariety"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                placeholder={t.planting.varietyPlaceholder}
                className="h-11"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold" htmlFor="pm">
                  {t.yield.plantingMonthLabel}
                </label>
                <Select value={plantingMonth} onValueChange={setPlantingMonth}>
                  <SelectTrigger id="pm" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {monthName(m, lang)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold" htmlFor="ysoil">
                  {t.yield.soilLabel}
                </label>
                <Select value={soil} onValueChange={setSoil}>
                  <SelectTrigger id="ysoil" className="h-11">
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
                <label className="text-sm font-bold" htmlFor="ywater">
                  {t.yield.waterLabel}
                </label>
                <Select value={water} onValueChange={setWater}>
                  <SelectTrigger id="ywater" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["unknown", "limited", "moderate", "abundant"] as const).map(
                      (w) => (
                        <SelectItem key={w} value={w}>
                          {w === "unknown"
                            ? L(SOIL_LABELS.unknown)
                            : L(WATER_LABELS[w])}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold" htmlFor="ymethod">
                  {t.yield.methodLabel}
                </label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger id="ymethod" className="h-11">
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
              {t.yield.analyzing}
            </>
          ) : (
            <>
              <Scale className="h-5 w-5" aria-hidden />
              {t.yield.analyzeBtn}
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
              <h3 className="font-bold text-destructive">{t.yield.errorTitle}</h3>
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
          <p className="font-semibold">{t.yield.analyzing}</p>
        </div>
      )}

      {result && (
        <div className="mt-10 flex flex-col gap-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-primary" aria-hidden />
                  {t.yield.referenceTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <Stat
                    label={t.yield.referenceMean}
                    value={`${fmt(result.reference.values.mean)} ${t.yield.perHa}`}
                    big
                  />
                  <Stat
                    label={t.yield.referenceRange}
                    value={`${fmt(result.reference.values.range[0], 1)}–${fmt(
                      result.reference.values.range[1],
                      1
                    )} ${t.yield.perHa}`}
                    big
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.reference.values.byYear).map(([y, v]) => (
                    <Badge key={y} variant="secondary" className="font-semibold">
                      {y}: {fmt(v)} {t.yield.perHa}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.yield.sourceLabel}: {result.reference.source} ·{" "}
                  {t.yield.retrievedLabel}: {result.reference.retrievedAt}
                </p>
              </CardContent>
            </Card>

            {result.reference.areaProduction && (
              <Card className="border-primary/40 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">
                    {t.yield.areaProductionTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-4xl font-extrabold text-primary">
                    {fmt(result.reference.areaProduction.tonnage, 1)}{" "}
                    <span className="text-base font-bold text-muted-foreground">
                      {t.yield.tonnageUnit}
                    </span>
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {L(result.reference.areaProduction.label)}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {chartData.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl">{t.yield.chartTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <div dir="ltr" className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--popover)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <ReferenceLine
                        y={result.reference.values.mean}
                        stroke="var(--primary)"
                        strokeDasharray="4 4"
                      />
                      <Bar
                        dataKey="yield"
                        name={t.yield.perHa}
                        fill="var(--chart-4)"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{t.yield.factorsTitle}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {result.factors.map((f, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-lg border bg-background/60 p-3"
                >
                  {f.kind === "risk" ? (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden />
                  ) : f.kind === "positive" ? (
                    <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                  ) : (
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" aria-hidden />
                  )}
                  <div>
                    <Badge variant="outline" className="mb-1 text-[10px] font-bold">
                      {f.kind === "risk"
                        ? t.yield.factorRisk
                        : f.kind === "positive"
                          ? t.yield.factorPositive
                          : t.yield.factorNote}
                    </Badge>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {L(f.text)}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{t.yield.uncertaintyTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {result.uncertainty.map((u: Bilingual, i: number) => (
                    <li key={i} className="text-sm leading-relaxed text-muted-foreground">
                      • {L(u)}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{t.yield.missingTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {result.missingInformation.map((m: Bilingual, i: number) => (
                    <li key={i} className="text-sm leading-relaxed text-muted-foreground">
                      • {L(m)}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{t.yield.dataUsedTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {result.dataUsed.map((d: Bilingual, i: number) => (
                    <li key={i} className="text-sm leading-relaxed text-muted-foreground">
                      • {L(d)}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card className="border-amber-300/60 shadow-sm dark:border-amber-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />
                  {t.yield.disclaimerTitle}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {L(result.disclaimer)}
                </p>
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
  }: {
    label: string;
    value: string;
    big?: boolean;
  }) {
    return (
      <div className="rounded-lg bg-background/70 p-3">
        <dt className="text-[11px] text-muted-foreground">{label}</dt>
        <dd className={`mt-0.5 font-bold ${big ? "text-xl" : "text-base"}`}>
          {value}
        </dd>
      </div>
    );
  }
}
