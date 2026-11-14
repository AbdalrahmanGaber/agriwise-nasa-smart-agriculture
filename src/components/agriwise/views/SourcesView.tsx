"use client";

import { useLang } from "@/lib/i18n/LanguageContext";
import { CROPS } from "@/lib/crops";
import { NASA_PARAM_NAMES, NASA_UNITS } from "@/lib/nasa";
import { NASA_PARAMETERS } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  CloudSun,
  Database,
  LineChart,
  Map as MapIcon,
  Mountain,
  Satellite,
  ShieldCheck,
  Table2,
} from "lucide-react";

function UsedBy({
  features,
  lang,
}: {
  features: string[];
  lang: "en" | "ar";
}) {
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
      <span>{lang === "ar" ? "يُستخدم في:" : "Used by:"}</span>
      {features.map((f) => (
        <span
          key={f}
          className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground"
        >
          {f}
        </span>
      ))}
    </span>
  );
}

export function SourcesView() {
  const { t, lang } = useLang();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        {t.sources.title}
      </h1>
      <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">
        {t.sources.intro}
      </p>

      {/* NASA POWER */}
      <Card className="mt-8 shadow-sm">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg font-bold">
            <span className="flex items-center gap-2">
              <Satellite className="h-5 w-5 text-primary" aria-hidden />
              {t.sources.nasaTitle}
            </span>
            <UsedBy
              features={[t.nav.analyze, t.nav.results, t.nav.planting, t.nav.irrigation, t.nav.yield]}
              lang={lang}
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="leading-relaxed text-muted-foreground">
            {t.sources.nasaBody}
          </p>
          <div>
            <p className="text-sm font-bold">{t.sources.nasaParamsTitle}</p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {NASA_PARAMETERS.map((p) => (
                <li
                  key={p}
                  className="flex items-center justify-between gap-2 rounded-lg border bg-secondary/30 px-3 py-2"
                >
                  <span className="text-sm font-semibold">
                    {lang === "ar"
                      ? NASA_PARAM_NAMES[p].ar
                      : NASA_PARAM_NAMES[p].en}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {p}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold">{t.sources.nasaUnitsTitle}</p>
            <ul className="mt-2 space-y-1">
              {Object.entries(NASA_UNITS).map(([k, v]) => (
                <li key={k} className="text-sm text-muted-foreground">
                  <span className="font-mono text-xs font-bold text-foreground">{k}</span>{" "}
                  — {v}
                </li>
              ))}
            </ul>
          </div>
          <p className="rounded-lg border-l-4 border-primary bg-secondary/30 p-3 text-sm leading-relaxed text-muted-foreground">
            {t.sources.nasaNote}
          </p>
          <a
            href="https://power.larc.nasa.gov/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-primary underline-offset-4 hover:underline"
          >
            power.larc.nasa.gov ↗
          </a>
        </CardContent>
      </Card>

      {/* Weather forecast (early warnings + planting) */}
      <Card className="mt-6 shadow-sm">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg font-bold">
            <span className="flex items-center gap-2">
              <CloudSun className="h-5 w-5 text-primary" aria-hidden />
              {t.sources.openMeteoTitle}
            </span>
            <UsedBy features={[t.nav.results, t.nav.planting]} lang={lang} />
          </CardTitle>
        </CardHeader>
        <CardContent className="leading-relaxed text-muted-foreground">
          {t.sources.openMeteoBody}
          <a
            href="https://open-meteo.com/"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-primary underline-offset-4 hover:underline"
          >
            open-meteo.com ↗
          </a>
        </CardContent>
      </Card>

      {/* Elevation */}
      <Card className="mt-6 shadow-sm">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg font-bold">
            <span className="flex items-center gap-2">
              <Mountain className="h-5 w-5 text-primary" aria-hidden />
              {t.sources.elevationTitle}
            </span>
            <UsedBy features={[t.nav.irrigation]} lang={lang} />
          </CardTitle>
        </CardHeader>
        <CardContent className="leading-relaxed text-muted-foreground">
          {t.sources.elevationBody}
        </CardContent>
      </Card>

      {/* FAO-56 */}
      <Card className="mt-6 shadow-sm">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg font-bold">
            <span className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-primary" aria-hidden />
              {t.sources.fao56Title}
            </span>
            <UsedBy features={[t.nav.irrigation]} lang={lang} />
          </CardTitle>
        </CardHeader>
        <CardContent className="leading-relaxed text-muted-foreground">
          {t.sources.fao56Body}
          <a
            href="https://www.fao.org/4/x0490e/x0490e00.htm"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-primary underline-offset-4 hover:underline"
          >
            fao.org/4/x0490e ↗
          </a>
        </CardContent>
      </Card>

      {/* FAOSTAT */}
      <Card className="mt-6 shadow-sm">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg font-bold">
            <span className="flex items-center gap-2">
              <Table2 className="h-5 w-5 text-primary" aria-hidden />
              {t.sources.faostatTitle}
            </span>
            <UsedBy features={[t.nav.yield]} lang={lang} />
          </CardTitle>
        </CardHeader>
        <CardContent className="leading-relaxed text-muted-foreground">
          {t.sources.faostatBody}
          <a
            href="https://www.fao.org/faostat/en/#data/QCL"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-primary underline-offset-4 hover:underline"
          >
            fao.org/faostat ↗
          </a>
        </CardContent>
      </Card>

      {/* NASA GIBS */}
      <Card className="mt-6 shadow-sm">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg font-bold">
            <span className="flex items-center gap-2">
              <Satellite className="h-5 w-5 text-primary" aria-hidden />
              {t.sources.gibsTitle}
            </span>
            <UsedBy features={[t.nav.satellite]} lang={lang} />
          </CardTitle>
        </CardHeader>
        <CardContent className="leading-relaxed text-muted-foreground">
          {t.sources.gibsBody}
          <div className="mt-3 flex flex-wrap gap-4">
            <a
              href="https://worldview.earthdata.nasa.gov/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-primary underline-offset-4 hover:underline"
            >
              worldview.earthdata.nasa.gov ↗
            </a>
            <a
              href="https://nasa-gibs.github.io/gibs-api-docs/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-primary underline-offset-4 hover:underline"
            >
              GIBS API documentation ↗
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Agricultural references */}
      <Card className="mt-6 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <BookOpen className="h-5 w-5 text-primary" aria-hidden />
            {t.sources.refsTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t.sources.refsIntro}
          </p>
          <ul className="mt-4 space-y-3">
            {t.sources.refs.map((ref) => (
              <li key={ref.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold">{ref.name}</span>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {ref.id}
                  </Badge>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {ref.detail}
                </p>
                <p className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                  {lang === "ar" ? "يُستخدم في: " : "Used by: "}
                  {CROPS.filter((c) => c.references.includes(ref.id)).map((c) => (
                    <span
                      key={c.id}
                      className="rounded-full bg-secondary px-2 py-0.5 font-semibold text-secondary-foreground"
                    >
                      {lang === "ar" ? c.name.ar : c.name.en}
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Map data */}
      <Card className="mt-6 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <MapIcon className="h-5 w-5 text-primary" aria-hidden />
            {t.sources.osmTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="leading-relaxed text-muted-foreground">
          {t.sources.osmBody}
        </CardContent>
      </Card>

      {/* Scientific honesty */}
      <Card className="mt-6 border-primary/30 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
            {t.sources.disclaimerTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="leading-relaxed text-muted-foreground">
          {t.sources.disclaimerBody}
        </CardContent>
      </Card>

      {/* reference keys legend */}
      <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <Database className="h-4 w-4" aria-hidden />
        {lang === "ar"
          ? "مفاتيح المراجع مخزنة مع كل سجل محصول في قاعدة البيانات."
          : "Reference keys are stored with every crop record in the database."}
      </p>
    </div>
  );
}
