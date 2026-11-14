"use client";

/**
 * Smart Crop Calendar (Feature 4).
 *
 * - picks the recommended crops straight from the existing recommendation
 *   system and lets the farmer switch between them — the calendar rebuilds
 *   automatically (pure engine: calendar.ts);
 * - visual interactive timeline of all growth stages with month ruler;
 * - per-stage: expected period, environmental requirements, agricultural
 *   activities and water management (share of the seasonal need);
 * - adapted to the location via the real NASA POWER monthly climatology
 *   (climate note per stage + location notes);
 * - water allocation chart (Recharts) built from documented stage shares.
 */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLang, fill } from "@/lib/i18n/LanguageContext";
import { useToolsStore } from "@/lib/toolsStore";
import { getCrop, type CropRecord } from "@/lib/crops";
import {
  buildCropCalendar,
  STAGE_COLORS,
  type CalendarStage,
  type CropCalendar,
  type StageKey,
} from "@/lib/calendar";
import type { AnalysisResult } from "@/lib/types";
import { monthName } from "@/lib/types";
import { CropIcon } from "./icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  CheckCircle2,
  Droplets,
  Info,
  Leaf,
  MapPin,
  Radar,
  Sprout,
  Thermometer,
  Tractor,
  type LucideIcon,
} from "lucide-react";

const MONTH_LENS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const STAGE_ICONS: Record<StageKey, LucideIcon> = {
  planting: Tractor,
  germination: Sprout,
  vegetative: Leaf,
  development: Radar,
  maturation: CalendarDays,
  harvest: CheckCircle2,
};

/* ---------------- component ---------------- */

export function CropCalendarSection({ result }: { result: AnalysisResult }) {
  const { t, lang, L } = useLang();
  const tools = useToolsStore();

  const inSeason = useMemo(
    () => result.crops.filter((c) => c.seasonMatch),
    [result.crops]
  );
  const options = (inSeason.length ? inSeason : result.crops).slice(0, 5);
  const [cropId, setCropId] = useState(options[0]?.cropId ?? "wheat");
  const crop = getCrop(cropId) as CropRecord;

  // optional actual planting date entered by the farmer (shared via the
  // tools store so the Farmer Action Center can show the current stage)
  const [actualDate, setActualDate] = useState<string>(tools.plantingDate ?? "");
  useEffect(() => {
    tools.setPlantingDate(actualDate.trim() ? actualDate.trim() : null);
  }, [actualDate]);

  const cal: CropCalendar | null = useMemo(
    () =>
      crop
        ? buildCropCalendar(
            crop,
            result.monthly,
            result.farm,
            actualDate.trim() ? actualDate.trim() : null
          )
        : null,
    [crop, result.monthly, result.farm, actualDate]
  );

  const [selected, setSelected] = useState<StageKey | null>(null);

  if (!cal || !crop) return null;

  // when the calendar is anchored to an actual planting date, pre-select
  // the stage the crop is in today (the farmer can still click any stage)
  const activeKey = selected ?? cal.todayStageKey ?? cal.stages[0].key;
  const selectedStage: CalendarStage =
    cal.stages.find((s) => s.key === activeKey) ?? cal.stages[0];

  const cycleMonths = Math.max(1, Math.ceil(cal.cycleDays / 30));

  // month ruler: month boundaries as day-offsets from the planting month
  const monthTicks: { month: number; offset: number; width: number }[] = [];
  {
    let acc = 0;
    let m = cal.plantMonth;
    while (acc < cal.cycleDays) {
      const len = MONTH_LENS[m - 1];
      monthTicks.push({ month: m, offset: acc, width: len });
      acc += len;
      m = (m % 12) + 1;
    }
  }
  const totalRulerDays = monthTicks.reduce((a, b) => a + b.width, 0);

  const pos = (day: number): number =>
    (Math.min(day, totalRulerDays) / totalRulerDays) * 100;

  const stageBtnStyle = (startDay: number, endDay: number): CSSProperties => {
    const left = pos(startDay);
    const width = Math.max(2.2, pos(endDay) - pos(startDay));
    return {
      [lang === "ar" ? "right" : "left"]: `${left}%`,
      width: `${width}%`,
    } as CSSProperties;
  };

  const waterChart = cal.stages.map((s) => ({
    stage: L(s.name),
    share: s.waterSharePct,
    key: s.key,
    color: STAGE_COLORS[s.key],
  }));

  return (
    <div className="space-y-6">
      {/* crop switcher */}
      <div>
        <p className="text-sm font-bold text-muted-foreground">
          {t.calendar.cropSwitch}
        </p>
        <div
          className="mt-2 flex flex-wrap gap-2"
          role="group"
          aria-label={t.calendar.cropSwitch}
        >
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

      {/* summary header */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCell
          icon={<CalendarDays className="h-4 w-4" aria-hidden />}
          label={t.calendar.plantWindowLabel}
          value={monthName(cal.plantMonth, lang)}
          extra={cal.plantMonthsAvailable.map((m) => monthName(m, lang)).join("، ")}
        />
        <SummaryCell
          icon={<Sprout className="h-4 w-4" aria-hidden />}
          label={t.calendar.cycleLabel}
          value={`${cal.cycleDays} ${lang === "ar" ? "يومًا (نموذجي)" : "days (typical)"}`}
          extra={`${cycleMonths} ${lang === "ar" ? "شهورًا تقريبًا" : "months approx."}`}
        />
        <SummaryCell
          icon={<Droplets className="h-4 w-4" aria-hidden />}
          label={t.calendar.waterNeedLabel}
          value={`${cal.waterNeedMm[0]}–${cal.waterNeedMm[1]} mm`}
        />
        <SummaryCell
          icon={<MapPin className="h-4 w-4" aria-hidden />}
          label={t.calendar.locationLabel}
          value={result.location.label || `${result.location.lat.toFixed(3)}, ${result.location.lng.toFixed(3)}`}
        />
      </div>

      {/* season match badge */}
      <div
        className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold ${
          cal.seasonMatch
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
        }`}
      >
        {cal.seasonMatch ? (
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <Info className="h-4 w-4 shrink-0" aria-hidden />
        )}
        {cal.seasonMatch
          ? fill(t.calendar.seasonMatchOk, {
              season: L(cal.seasonLabel),
              month: monthName(cal.plantMonth, lang),
            })
          : fill(t.calendar.seasonMatchOff, {
              season: L(cal.seasonLabel),
              months: cal.plantMonthsAvailable
                .map((m) => monthName(m, lang))
                .join("، "),
            })}
      </div>

      {/* actual planting date + basis */}
      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <label
              className="text-sm font-bold"
              htmlFor="cal-plant-date"
            >
              {t.calendar.actualDateLabel}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="cal-plant-date"
                type="date"
                value={actualDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setActualDate(e.target.value)}
                className="h-10 rounded-lg border bg-card px-3 text-sm font-semibold"
              />
              {actualDate && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="font-bold"
                  onClick={() => setActualDate("")}
                >
                  {t.calendar.clearDate}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {t.calendar.actualDateHint}
            </p>
          </div>
          <div
            className={`flex items-start gap-2 rounded-xl border p-3 text-sm font-semibold sm:max-w-md ${
              cal.basis === "actual"
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
            }`}
          >
            {cal.basis === "actual" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>{L(cal.basisLabel)}</span>
          </div>
        </CardContent>
      </Card>

      {/* interactive timeline */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold sm:text-lg">
            {t.calendar.timelineTitle}
          </CardTitle>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t.calendar.timelineHint}
          </p>
        </CardHeader>
        <CardContent>
          <div className="agri-scroll overflow-x-auto">
            <div className="min-w-[560px]">
              {/* stage bar */}
              <div
                className="relative h-16 rounded-xl bg-secondary/50"
                role="group"
                aria-label={t.calendar.timelineTitle}
              >
                {cal.stages.map((s) => {
                  const active = s.key === selectedStage.key;
                  const isToday = cal.todayStageKey === s.key;
                  const SIcon = STAGE_ICONS[s.key];
                  return (
                    <button
                      key={s.key}
                      type="button"
                      title={`${L(s.name)} · ${s.dayLabel}`}
                      aria-pressed={active}
                      onClick={() => setSelected(s.key)}
                      className={`absolute top-1 flex h-14 flex-col items-center justify-center overflow-hidden rounded-lg text-white shadow transition-[filter,outline] outline-2 outline-offset-2 outline-transparent hover:brightness-110 focus-visible:outline-white ${
                        active ? "z-10 ring-2 ring-white brightness-110" : ""
                      } ${isToday && !active ? "z-10 ring-2 ring-amber-400" : ""}`}
                      style={{
                        ...stageBtnStyle(s.startDay, s.endDay),
                        backgroundColor: STAGE_COLORS[s.key],
                      }}
                    >
                      <SIcon className="h-4 w-4" aria-hidden />
                      <span className="px-1 text-[9px] font-bold leading-tight">
                        {L(s.name).split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* month ruler */}
              <div className="relative mt-1 h-5 border-t">
                {monthTicks.map((tick) => (
                  <span
                    key={`${tick.month}-${tick.offset}`}
                    className="absolute top-1 text-[9px] font-semibold text-muted-foreground"
                    style={{
                      [lang === "ar" ? "right" : "left"]: `${pos(tick.offset)}%`,
                    } as CSSProperties}
                  >
                    {monthName(tick.month, lang)}
                  </span>
                ))}
              </div>

              {/* "you are here" marker for an anchored calendar */}
              {cal.todayStageKey !== null && cal.todayDayOffset !== null && (
                <div className="relative mt-1 h-6">
                  <div
                    className="absolute top-0 flex items-center gap-1"
                    style={{
                      [lang === "ar" ? "right" : "left"]: `${pos(cal.todayDayOffset)}%`,
                    } as CSSProperties}
                  >
                    <span
                      className="h-4 w-0.5 bg-amber-500"
                      aria-hidden
                    />
                    <span className="whitespace-nowrap text-[10px] font-extrabold text-amber-600 dark:text-amber-400">
                      {fill(t.calendar.youAreHere, {
                        stage: L(
                          cal.stages.find((s) => s.key === cal.todayStageKey)
                            ?.name ?? { en: "", ar: "" }
                        ),
                        day: String(cal.todayDayOffset),
                      })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* stage chips */}
          <div className="mt-5 flex flex-wrap gap-2">
            {cal.stages.map((s) => {
              const active = s.key === selectedStage.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSelected(s.key)}
                  aria-pressed={active}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition-colors ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card hover:bg-secondary"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: STAGE_COLORS[s.key] }}
                    aria-hidden
                  />
                  {L(s.name)}
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {s.dayLabel}
                  </span>
                </button>
              );
            })}
          </div>

          {/* selected stage detail */}
          <div
            className="mt-4 rounded-2xl border-2 p-4 sm:p-5"
            style={{ borderColor: STAGE_COLORS[selectedStage.key] }}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow"
                style={{ backgroundColor: STAGE_COLORS[selectedStage.key] }}
                aria-hidden
              >
                {(() => {
                  const I = STAGE_ICONS[selectedStage.key];
                  return <I className="h-5 w-5" />;
                })()}
              </span>
              <div className="min-w-0 flex-1">
                <h4 className="text-lg font-extrabold">{L(selectedStage.name)}</h4>
                <p className="text-sm font-semibold text-muted-foreground">
                  {t.calendar.daysLabel} {selectedStage.startDay}–{selectedStage.endDay}
                  {" · "}
                  {L(selectedStage.monthLabel)}
                </p>
              </div>
              <Badge
                variant="outline"
                className="font-mono text-[10px]"
                style={{ borderColor: STAGE_COLORS[selectedStage.key] }}
              >
                {selectedStage.dayLabel}
              </Badge>
            </div>

            {selectedStage.climateNote && (
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm leading-relaxed">
                <Radar className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                {L(selectedStage.climateNote)}
              </p>
            )}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <Thermometer className="h-3.5 w-3.5" aria-hidden />
                  {t.calendar.envLabel}
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {selectedStage.env.map((e, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                      <span>{L(e)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <Tractor className="h-3.5 w-3.5" aria-hidden />
                  {t.calendar.activitiesLabel}
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {selectedStage.activities.map((a, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <span>{L(a)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* water management */}
            <div className="mt-4 rounded-xl border bg-secondary/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <Droplets className="h-3.5 w-3.5" aria-hidden />
                  {t.calendar.waterStageLabel}
                </p>
                <p className="text-sm font-extrabold text-primary">
                  ≈{selectedStage.waterSharePct}%{" "}
                  <span className="text-xs font-semibold text-muted-foreground">
                    (
                    {Math.round(
                      (selectedStage.waterSharePct / 100) * cal.waterNeedMm[0]
                    )}
                    –
                    {Math.round(
                      (selectedStage.waterSharePct / 100) * cal.waterNeedMm[1]
                    )}{" "}
                    mm)
                  </span>
                </p>
              </div>
              <Progress
                className="mt-2 h-2"
                value={selectedStage.waterSharePct}
                aria-label={t.calendar.waterStageLabel}
              />
              <p className="mt-2 text-sm leading-relaxed">
                {L(selectedStage.waterAdvice)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* water allocation chart */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-bold sm:text-lg">
            <Droplets className="h-4 w-4 text-primary" aria-hidden />
            {t.calendar.waterChartTitle}
          </CardTitle>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {fill(t.calendar.waterChartDesc, {
              min: cal.waterNeedMm[0],
              max: cal.waterNeedMm[1],
            })}
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={waterChart}
                margin={{ top: 8, right: 12, left: -12, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="stage"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={54}
                />
                <YAxis
                  unit="%"
                  width={48}
                  domain={[0, 55]}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--popover-foreground)",
                    fontSize: 13,
                  }}
                  formatter={(value) => [`${value}%`, t.calendar.waterChartSeries]}
                />
                <Bar dataKey="share" radius={[6, 6, 0, 0]}>
                  {waterChart.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* all stages overview */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cal.stages.map((s) => (
          <StageMiniCard
            key={s.key}
            s={s}
            active={s.key === selectedStage.key}
            onSelect={() => setSelected(s.key)}
            t={t}
            L={L}
          />
        ))}
      </div>

      {/* location notes */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-bold sm:text-lg">
            <MapPin className="h-4 w-4 text-primary" aria-hidden />
            {t.calendar.locationNotesTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {cal.locationNotes.map((n, i) => (
            <p key={i} className="flex items-start gap-2 text-sm leading-relaxed">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              {L(n)}
            </p>
          ))}
          <p className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">
            {L(cal.dataNote)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- small pieces ---------------- */

function SummaryCell({
  icon,
  label,
  value,
  extra,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  extra?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-extrabold leading-snug">{value}</p>
      {extra && <p className="text-[11px] text-muted-foreground">{extra}</p>}
    </div>
  );
}

function StageMiniCard({
  s,
  active,
  onSelect,
  t,
  L,
}: {
  s: CalendarStage;
  active: boolean;
  onSelect: () => void;
  t: ReturnType<typeof useLang>["t"];
  L: (b: { en: string; ar: string }) => string;
}) {
  const Icon = STAGE_ICONS[s.key];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`flex h-full w-full flex-col rounded-xl border p-4 text-start transition-shadow hover:shadow-md ${
        active ? "border-primary ring-1 ring-primary/40" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: STAGE_COLORS[s.key] }}
          aria-hidden
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold">{L(s.name)}</p>
          <p className="text-[11px] font-semibold text-muted-foreground">
            {t.calendar.daysLabel} {s.startDay}–{s.endDay}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {L(s.monthLabel)}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Droplets className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <span className="text-xs font-bold text-primary">
          ≈{s.waterSharePct}%
        </span>
        <span className="text-[10px] text-muted-foreground">
          {t.calendar.waterStageLabel}
        </span>
      </div>
    </button>
  );
}

export default CropCalendarSection;
