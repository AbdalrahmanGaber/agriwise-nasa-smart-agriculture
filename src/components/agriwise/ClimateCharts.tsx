"use client";

import { useTheme } from "next-themes";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLang, fill } from "@/lib/i18n/LanguageContext";
import { monthName } from "@/lib/types";
import type { AnalysisResult } from "@/lib/types";

const LIGHT = {
  mean: "#1E5B3C",
  max: "#D97706",
  min: "#7BAF8D",
  rain: "#2D6A4F",
  solar: "#C99A2E",
  humidity: "#5F8D6B",
  wind: "#8C7A4B",
  grid: "#DFE7E0",
  tick: "#5C6B5E",
};

const DARK = {
  mean: "#7FC08F",
  max: "#F0B35C",
  min: "#9DB89A",
  rain: "#7FC08F",
  solar: "#E3C878",
  humidity: "#9BD0AC",
  wind: "#C8BB8C",
  grid: "#2A382D",
  tick: "#93A596",
};

export function ClimateCharts({ result }: { result: AnalysisResult }) {
  const { t, lang } = useLang();
  const { resolvedTheme } = useTheme();
  const c = resolvedTheme === "dark" ? DARK : LIGHT;

  const data = result.monthly.map((m) => ({
    month: monthName(m.month, lang),
    t2m: m.t2m,
    t2mMax: m.t2mMax,
    t2mMin: m.t2mMin,
    precip: m.precip,
    rh2m: m.rh2m,
    solar: m.solar,
    ws10m: m.ws10m,
  }));

  const s = result.summary;
  const has = (key: string) => data.some((d) => d[key as keyof typeof d] !== null);

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
    direction: ("ltr" as const),
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 1. Temperature */}
      {has("t2m") && (
        <ChartCard title={t.charts.temperatureTitle}>
          <div className="h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} unit="°C" width={54} domain={["auto", "auto"]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: c.tick }} />
                <Line
                  name={t.charts.tempMax}
                  dataKey="t2mMax"
                  type="monotone"
                  stroke={c.max}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                <Line
                  name={t.charts.tempMean}
                  dataKey="t2m"
                  type="monotone"
                  stroke={c.mean}
                  strokeWidth={3}
                  dot={false}
                  connectNulls
                />
                <Line
                  name={t.charts.tempMin}
                  dataKey="t2mMin"
                  type="monotone"
                  stroke={c.min}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {fill(t.charts.temperatureDesc, {
              hottest: monthName(s.hottestMonth, lang),
              hottestVal: s.hottestMonthMeanC.toFixed(1),
              coldest: monthName(s.coldestMonth, lang),
              coldestVal: s.coldestMonthMeanC.toFixed(1),
              extremeMax: s.extremeMaxC?.toFixed(1) ?? "—",
              extremeMin: s.extremeMinC?.toFixed(1) ?? "—",
            })}
          </p>
        </ChartCard>
      )}

      {/* 2. Rainfall */}
      {has("precip") && (
        <ChartCard title={t.charts.rainfallTitle}>
          <div className="h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} unit=" mm" width={54} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: c.grid, opacity: 0.4 }} />
                <Bar dataKey="precip" fill={c.rain} radius={[6, 6, 0, 0]} name={t.common.mm} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {fill(t.charts.rainfallDesc, {
              annual: s.annualRainfallMm.toFixed(1),
            })}
          </p>
        </ChartCard>
      )}

      {/* 3. Solar radiation */}
      {has("solar") && (
        <ChartCard title={t.charts.solarTitle}>
          <div className="h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                <defs>
                  <linearGradient id="solarFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.solar} stopOpacity={0.7} />
                    <stop offset="100%" stopColor={c.solar} stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} width={54} domain={["auto", "auto"]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  dataKey="solar"
                  type="monotone"
                  stroke={c.solar}
                  strokeWidth={2.5}
                  fill="url(#solarFill)"
                  connectNulls
                  name={t.common.perDay}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {fill(t.charts.solarDesc, {
              annual: s.meanAnnualSolar.toFixed(1),
            })}
          </p>
        </ChartCard>
      )}

      {/* 4. Humidity */}
      {has("rh2m") && (
        <ChartCard title={t.charts.humidityTitle}>
          <div className="h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} unit="%" width={54} domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  dataKey="rh2m"
                  type="monotone"
                  stroke={c.humidity}
                  strokeWidth={2.5}
                  dot={{ r: 2.5, fill: c.humidity }}
                  connectNulls
                  name={t.common.percent}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {fill(t.charts.humidityDesc, { annual: s.meanAnnualRh.toFixed(0) })}
          </p>
        </ChartCard>
      )}

      {/* 5. Wind */}
      {has("ws10m") && (
        <ChartCard title={t.charts.windTitle}>
          <div className="h-72" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} unit=" m/s" width={54} domain={["auto", "auto"]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  dataKey="ws10m"
                  type="monotone"
                  stroke={c.wind}
                  strokeWidth={2.5}
                  dot={{ r: 2.5, fill: c.wind }}
                  connectNulls
                  name={t.common.ms}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {fill(t.charts.windDesc, { annual: s.meanAnnualWind.toFixed(1) })}
          </p>
        </ChartCard>
      )}

      {!has("t2m") && !has("precip") && !has("solar") && (
        <p className="text-sm text-muted-foreground">{t.charts.notEnoughData}</p>
      )}
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold sm:text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
