"use client";

import { useLang } from "@/lib/i18n/LanguageContext";
import { CROPS } from "@/lib/crops";
import { NASA_PARAM_NAMES } from "@/lib/nasa";
import { NASA_PARAMETERS } from "@/lib/types";
import { navHref } from "../useHashRouter";
import { CropIcon } from "../icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  ArrowDown,
  CalendarCheck,
  ChartLine,
  CloudRain,
  Droplets,
  Gauge,
  Globe2,
  LayoutDashboard,
  LocateFixed,
  Radar,
  Satellite,
  Scale,
  Sprout,
  Sun,
  Thermometer,
  Wind,
} from "lucide-react";

const PARAM_ICONS: Record<string, typeof Thermometer> = {
  T2M: Thermometer,
  T2M_MAX: Thermometer,
  T2M_MIN: Thermometer,
  PRECTOTCORR: CloudRain,
  RH2M: Droplets,
  ALLSKY_SFC_SW_DWN: Sun,
  WS10M: Wind,
};

export function HomeView() {
  const { t, L, lang } = useLang();

  const stats = [
    { value: String(CROPS.length), label: t.home.statCrops },
    { value: String(NASA_PARAMETERS.length), label: t.home.statParams },
    { value: "365", label: t.home.statDays },
    { value: "2", label: t.home.statLangs },
  ];

  const steps = [
    { icon: LocateFixed, title: t.home.step1Title, desc: t.home.step1Desc },
    { icon: Gauge, title: t.home.step2Title, desc: t.home.step2Desc },
    { icon: Satellite, title: t.home.step3Title, desc: t.home.step3Desc },
    { icon: Globe2, title: t.home.step4Title, desc: t.home.step4Desc },
  ];

  return (
    <div>
      {/* ---------- HERO ---------- */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/images/hero-farm.jpg)" }}
          aria-hidden
        />
        <div className="hero-overlay absolute inset-0" aria-hidden />
        <div className="relative mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-20 text-white sm:px-6 sm:py-28 lg:py-36">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-xs font-bold backdrop-blur sm:text-sm">
            <Satellite className="h-4 w-4" aria-hidden />
            {t.home.heroKicker}
          </p>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight drop-shadow-sm sm:text-5xl lg:text-6xl">
            {t.home.heroTitle}
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
            {t.home.heroSubtitle}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="h-12 px-7 text-base font-bold shadow-lg"
            >
              <a href={navHref("analyze")}>{t.home.ctaAnalyze}</a>
            </Button>
            <Button
              asChild
              size="lg"
              className="h-12 border-2 border-primary bg-primary/10 px-7 text-base font-bold text-primary shadow-lg hover:bg-primary/15"
              variant="ghost"
            >
              <a href={navHref("planting")}>
                <CalendarCheck className="me-2 h-5 w-5" aria-hidden />
                {t.home.plantingCtaTitle}
              </a>
            </Button>
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/40 bg-white/10 px-6 text-base font-bold backdrop-blur transition-colors hover:bg-white/20"
            >
              {t.home.ctaHow}
              <ArrowDown className="h-4 w-4" aria-hidden />
            </a>
          </div>
          <dl className="mt-4 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-white/20 bg-white/10 px-3 py-3 backdrop-blur"
              >
                <dt className="sr-only">{s.label}</dt>
                <dd className="text-2xl font-extrabold sm:text-3xl">{s.value}</dd>
                <dd className="mt-0.5 text-[11px] font-medium leading-tight text-white/80 sm:text-xs">
                  {s.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------- SMART PLANTING TIME ADVISOR CTA ---------- */}
      <section className="border-y">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="grid items-center gap-8 rounded-2xl border bg-card p-6 shadow-md sm:p-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
                {t.home.toolPlantingTitle}
              </p>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                {t.home.plantingCtaTitle}
              </h2>
              <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
                {t.home.plantingCtaDesc}
              </p>
              <Button asChild size="lg" className="mt-6 h-12 px-8 text-base font-bold">
                <a href={navHref("planting")}>{t.home.plantingCtaBtn}</a>
              </Button>
            </div>
            <div className="grid gap-3">
              {CROPS.slice(0, 6).map((crop) => (
                <a
                  key={crop.id}
                  href={navHref("planting")}
                  className="flex items-center gap-3 rounded-xl border bg-background/70 p-3 transition-colors hover:border-primary/50 hover:bg-secondary"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: crop.color }}
                  >
                    <CropIcon name={crop.icon} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{L(crop.name)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {crop.scientificName}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section id="how-it-works" className="section-sage border-y">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t.home.howTitle}
            </h2>
            <p className="mt-3 text-muted-foreground">{t.home.howSubtitle}</p>
          </div>
          <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <li key={step.title}>
                <Card className="h-full border-border/80 bg-card shadow-sm transition-shadow hover:shadow-md">
                  <CardContent className="flex h-full flex-col gap-3 p-6">
                    <div className="flex items-center justify-between">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <step.icon className="h-6 w-6" aria-hidden />
                      </span>
                      <span className="text-4xl font-extrabold text-primary/15">
                        {i + 1}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {step.desc}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- SMART TOOLS ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t.home.toolsTitle}
          </h2>
          <p className="mt-3 text-muted-foreground">{t.home.toolsSubtitle}</p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              view: "planting" as const,
              icon: CalendarCheck,
              title: t.home.toolPlantingTitle,
              desc: t.home.toolPlantingDesc,
            },
            {
              view: "irrigation" as const,
              icon: Droplets,
              title: t.home.toolIrrigationTitle,
              desc: t.home.toolIrrigationDesc,
            },
            {
              view: "satellite" as const,
              icon: Satellite,
              title: t.home.toolSatelliteTitle,
              desc: t.home.toolSatelliteDesc,
            },
            {
              view: "yield" as const,
              icon: Scale,
              title: t.home.toolYieldTitle,
              desc: t.home.toolYieldDesc,
            },
            {
              view: "action" as const,
              icon: LayoutDashboard,
              title: t.home.toolActionTitle,
              desc: t.home.toolActionDesc,
            },
          ].map((f) => (
            <Card
              key={f.view}
              className="group h-full border-border/80 bg-card shadow-sm transition-shadow hover:shadow-md"
            >
              <a
                href={navHref(f.view)}
                className="flex h-full flex-col gap-3 p-6 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="h-6 w-6" aria-hidden />
                </span>
                <h3 className="text-lg font-bold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </a>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------- PLATFORM FEATURES ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t.home.featuresTitle}
          </h2>
          <p className="mt-3 text-muted-foreground">{t.home.featuresSubtitle}</p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Sprout,
              title: t.home.feature1Title,
              desc: t.home.feature1Desc,
            },
            {
              icon: ChartLine,
              title: t.home.feature2Title,
              desc: t.home.feature2Desc,
            },
            {
              icon: Radar,
              title: t.home.feature3Title,
              desc: t.home.feature3Desc,
            },
            {
              icon: CalendarCheck,
              title: t.home.feature4Title,
              desc: t.home.feature4Desc,
            },
          ].map((f) => (
            <Card
              key={f.title}
              className="h-full border-border/80 bg-card shadow-sm transition-shadow hover:shadow-md"
            >
              <CardContent className="flex h-full flex-col gap-3 p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="h-6 w-6" aria-hidden />
                </span>
                <h3 className="text-lg font-bold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ---------- NASA DATA ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t.home.nasaTitle}
            </h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              {t.home.nasaSubtitle}
            </p>
            <div className="mt-6 rounded-xl border bg-accent/40 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-accent-foreground">
                <Satellite className="h-4 w-4" aria-hidden />
                {t.home.nasaUrl}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t.home.nasaCardNote}
              </p>
            </div>
          </div>
          <div className="relative">
            <img
              src="/images/satellite.jpg"
              alt={lang === "ar" ? "قمر صناعي يرصد الأرض" : "Satellite observing Earth"}
              className="aspect-[16/9] w-full rounded-2xl border object-cover shadow-lg"
              loading="lazy"
            />
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {NASA_PARAMETERS.map((p) => {
            const Icon = PARAM_ICONS[p] ?? Gauge;
            return (
              <Card key={p} className="shadow-sm">
                <CardContent className="flex items-start gap-3 p-5">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-bold leading-snug">
                      {L(NASA_PARAM_NAMES[p])}
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {p}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ---------- SUPPORTED CROPS ---------- */}
      <section className="section-beige border-y">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t.home.cropsTitle}
            </h2>
            <p className="mt-3 text-muted-foreground">{t.home.cropsSubtitle}</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CROPS.map((crop) => (
              <Card
                key={crop.id}
                className="group overflow-hidden shadow-sm transition-shadow hover:shadow-md"
              >
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm"
                      style={{ backgroundColor: crop.color }}
                    >
                      <CropIcon name={crop.icon} className="h-6 w-6" />
                    </span>
                    <div>
                      <h3 className="text-base font-bold leading-tight">
                        {L(crop.name)}
                      </h3>
                      <p className="text-xs italic text-muted-foreground">
                        {crop.scientificName}
                      </p>
                    </div>
                  </div>
                  <dl className="mt-1 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-background/70 p-2">
                      <dt className="text-muted-foreground">
                        {t.results.tempRangeLabel}
                      </dt>
                      <dd className="mt-0.5 font-bold">
                        {crop.temp.optMin}–{crop.temp.optMax}°C
                      </dd>
                    </div>
                    <div className="rounded-lg bg-background/70 p-2">
                      <dt className="text-muted-foreground">
                        {t.results.durationLabel}
                      </dt>
                      <dd className="mt-0.5 font-bold">
                        {crop.durationDays[0]}–{crop.durationDays[1]}{" "}
                        {lang === "ar" ? "يوم" : "days"}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-background/70 p-2">
                      <dt className="text-muted-foreground">
                        {t.results.waterNeedLabel}
                      </dt>
                      <dd className="mt-0.5 font-bold">
                        {crop.water.seasonNeedMm[0]}–{crop.water.seasonNeedMm[1]} mm
                      </dd>
                    </div>
                    <div className="rounded-lg bg-background/70 p-2">
                      <dt className="text-muted-foreground">
                        {t.results.seasonLabel}
                      </dt>
                      <dd className="mt-0.5 font-bold">
                        {crop.seasons
                          .map((s) => L(SEASON_LABEL(s)))
                          .join(" · ")}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">{t.home.cropsNote}</p>
        </div>
      </section>

      {/* ---------- ABOUT / CTA ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="relative order-2 lg:order-1">
            <img
              src="/images/farmer-tech.jpg"
              alt={
                lang === "ar"
                  ? "مزارع يستخدم التقنية في حقل أخضر"
                  : "Farmer using technology in a green field"
              }
              className="aspect-[16/10] w-full rounded-2xl border object-cover shadow-lg"
              loading="lazy"
            />
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-sm font-bold uppercase tracking-wide text-primary">
              {t.home.regionLabel}: {t.home.regionValue}
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t.home.aboutTitle}
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              {t.home.aboutBody}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="font-bold">
                <a href={navHref("analyze")}>{t.home.ctaAnalyze}</a>
              </Button>
              <Button asChild size="lg" variant="outline" className="font-bold">
                <a href={navHref("sources")}>{t.sources.title}</a>
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-12 flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden
          />
          <div>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
              {t.home.disclaimerTitle}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-amber-800/90 dark:text-amber-200/90">
              {t.home.disclaimerBody}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function SEASON_LABEL(s: string): { en: string; ar: string } {
  switch (s) {
    case "summer":
      return { en: "Summer", ar: "صيفي" };
    case "winter":
      return { en: "Winter", ar: "شتوي" };
    case "spring":
      return { en: "Spring", ar: "ربيعي" };
    default:
      return { en: "Autumn", ar: "خريفي" };
  }
}
