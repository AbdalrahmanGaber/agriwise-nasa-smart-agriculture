"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FarmMap } from "../FarmMap";
import { useLang, fill } from "@/lib/i18n/LanguageContext";
import { useAnalysisStore, DEFAULT_FARM } from "@/lib/store";
import type { FarmLocation } from "@/lib/types";
import {
  SOIL_LABELS,
  SEASON_LABELS,
  WATER_LABELS,
} from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  Leaf,
  Loader2,
  LocateFixed,
  MapPin,
  RefreshCw,
  Search,
  Snowflake,
  Sprout,
  Sun,
  History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { navHref } from "../useHashRouter";
import type { SavedAnalysisMeta } from "@/lib/types";

/* ---------------- types & helpers ---------------- */

type Step = "location" | "confirm" | "form" | "analyzing";
type GpsState = "idle" | "locating" | "denied" | "error";

interface SearchResult {
  lat: number;
  lng: number;
  label: string;
  name?: string;
}

const soilOptions = (t: ReturnType<typeof useLang>["t"]) => [
  { value: "clay", title: t.analyze.soilClay, desc: t.analyze.soilClayDesc, icon: Droplets },
  { value: "loam", title: t.analyze.soilLoam, desc: t.analyze.soilLoamDesc, icon: Leaf },
  { value: "sandy", title: t.analyze.soilSandy, desc: t.analyze.soilSandyDesc, icon: Sun },
  { value: "other", title: t.analyze.soilOther, desc: t.analyze.soilOtherDesc, icon: MapPin },
  { value: "unknown", title: t.analyze.soilUnknown, desc: t.analyze.soilUnknownDesc, icon: AlertTriangle },
] as const;

const waterOptions = (t: ReturnType<typeof useLang>["t"]) => [
  { value: "abundant", title: t.analyze.waterAbundant, desc: t.analyze.waterAbundantDesc },
  { value: "moderate", title: t.analyze.waterModerate, desc: t.analyze.waterModerateDesc },
  { value: "limited", title: t.analyze.waterLimited, desc: t.analyze.waterLimitedDesc },
] as const;

const seasonOptions = (t: ReturnType<typeof useLang>["t"]) => [
  { value: "winter", title: t.analyze.seasonWinter, desc: t.analyze.seasonWinterDesc, icon: Snowflake },
  { value: "summer", title: t.analyze.seasonSummer, desc: t.analyze.seasonSummerDesc, icon: Sun },
  { value: "spring", title: t.analyze.seasonSpring, desc: t.analyze.seasonSpringDesc, icon: Sprout },
  { value: "autumn", title: t.analyze.seasonAutumn, desc: t.analyze.seasonAutumnDesc, icon: Leaf },
] as const;

const formSchema = z.object({
  soilType: z.enum(["clay", "sandy", "loam", "other", "unknown"]),
  waterAvailability: z.enum(["limited", "moderate", "abundant"]),
  season: z.enum(["summer", "winter", "spring", "autumn"]),
  farmSize: z
    .string()
    .refine((v) => v === "" || (Number(v) > 0 && Number.isFinite(Number(v))), {
      message: "positive",
    }),
  sizeUnit: z.enum(["acres", "hectares", ""]),
  irrigationMethod: z.enum(["flood", "drip", "sprinkler", "other", ""]),
  notes: z.string().max(2000),
});

type FormValues = z.infer<typeof formSchema>;

/* ---------------- main view ---------------- */

export function AnalyzeView() {
  const { t, lang, L } = useLang();
  const { toast } = useToast();
  const store = useAnalysisStore();

  const [step, setStep] = useState<Step>(
    store.locationConfirmed ? "form" : "location"
  );
  const [gpsState, setGpsState] = useState<GpsState>("idle");

  // pending location (not yet confirmed into the store)
  const [pending, setPending] = useState<FarmLocation | null>(
    store.location ?? null
  );
  const [flyKey, setFlyKey] = useState(0);
  const reverseAbort = useRef<AbortController | null>(null);

  // search
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  // saved analyses
  const [savedList, setSavedList] = useState<SavedAnalysisMeta[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // analysis
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzeStepIdx, setAnalyzeStepIdx] = useState(0);

  /* --- saved analyses (optional feature) --- */
  useEffect(() => {
    if (step !== "location") return;
    let alive = true;
    setLoadingSaved(true);
    fetch("/api/analyses")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setSavedList(d.analyses ?? []);
      })
      .catch(() => {})
      .finally(() => alive && setLoadingSaved(false));
    return () => {
      alive = false;
    };
  }, [step]);

  const openSaved = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/analyses?id=${encodeURIComponent(id)}`);
        const data = await res.json();
        if (data.result) {
          store.setResult(data.result);
          window.location.hash = navHref("results");
        }
      } catch {
        toast({ description: t.errors.generic });
      }
    },
    [store, toast, t]
  );

  /* --- debounced place search --- */
  useEffect(() => {
    const q = searchQ.trim();
    if (q.length < 3) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(q)}&lang=${lang}`
        );
        const data = await res.json();
        if (res.ok) setSearchResults(data.results ?? []);
        else setSearchResults([]);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [searchQ, lang]);

  /* --- reverse geocoding for map/gps picks --- */
  const reverseGeocode = useCallback(
    async (lat: number, lng: number, source: FarmLocation["source"], accuracy?: number) => {
      reverseAbort.current?.abort();
      const ac = new AbortController();
      reverseAbort.current = ac;
      try {
        const res = await fetch(
          `/api/geocode?lat=${lat}&lon=${lng}&lang=${lang}`,
          { signal: ac.signal }
        );
        const data = await res.json();
        const label =
          data.label ??
          `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        setPending((p) =>
          p && p.lat === lat && p.lng === lng
            ? { ...p, label, source, accuracy }
            : p
        );
      } catch {
        setPending((p) =>
          p && p.lat === lat && p.lng === lng
            ? { ...p, label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, source, accuracy }
            : p
        );
      }
    },
    [lang]
  );

  /* --- position updates --- */
  const applyPosition = useCallback(
    (
      lat: number,
      lng: number,
      source: FarmLocation["source"],
      accuracy?: number,
      knownLabel?: string
    ) => {
      const next: FarmLocation = {
        lat,
        lng,
        label: knownLabel ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        source,
        accuracy,
      };
      setPending(next);
      setFlyKey((k) => k + 1);
      setStep("confirm");
      if (!knownLabel && (source === "map" || source === "gps")) {
        reverseGeocode(lat, lng, source, accuracy);
      }
    },
    [reverseGeocode]
  );

  /* --- GPS --- */
  const detectLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGpsState("error");
      return;
    }
    setGpsState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsState("idle");
        applyPosition(
          pos.coords.latitude,
          pos.coords.longitude,
          "gps",
          pos.coords.accuracy
        );
      },
      (err) => {
        setGpsState(err.code === err.PERMISSION_DENIED ? "denied" : "error");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [applyPosition]);

  /* --- form --- */
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      soilType: store.farm.soilType,
      waterAvailability: store.farm.waterAvailability,
      season: store.farm.season,
      farmSize: store.farm.farmSize != null ? String(store.farm.farmSize) : "",
      sizeUnit: store.farm.sizeUnit,
      irrigationMethod: store.farm.irrigationMethod,
      notes: store.farm.notes ?? "",
    },
  });

  useEffect(() => {
    // keep the store in sync as the farmer fills the form (helps returning later)
    const sub = form.watch((values) => {
      store.setFarm({
        soilType: values.soilType as never,
        waterAvailability: values.waterAvailability as never,
        season: values.season as never,
        farmSize: values.farmSize ? Number(values.farmSize) : null,
        sizeUnit: (values.sizeUnit as never) ?? "",
        irrigationMethod: (values.irrigationMethod as never) ?? "",
        notes: values.notes ?? "",
      });
    });
    return () => sub.unsubscribe();
  }, [form, store]);

  const submitAnalysis = async (values: FormValues) => {
    if (!pending) return;
    setAnalyzeError(null);
    setStep("analyzing");
    setAnalyzeStepIdx(0);
    const ticker = setInterval(
      () => setAnalyzeStepIdx((i) => Math.min(i + 1, 2)),
      4000
    );
    try {
      // ensure the confirmed location is in the store
      store.setLocation(pending);
      store.confirmLocation();
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: {
            lat: pending.lat,
            lng: pending.lng,
            label: pending.label,
            source: pending.source,
            accuracy: pending.accuracy,
          },
          farm: {
            soilType: values.soilType,
            waterAvailability: values.waterAvailability,
            season: values.season,
            farmSize: values.farmSize ? Number(values.farmSize) : null,
            sizeUnit: values.sizeUnit,
            irrigationMethod: values.irrigationMethod,
            notes: values.notes,
          },
        }),
        signal: AbortSignal.timeout(120_000),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data?.error === "nasa_failed"
            ? t.errors.nasaFailed
            : data?.error === "invalid_input"
              ? t.errors.invalidInput
              : t.errors.generic
        );
      }
      store.setResult(data);
      window.location.hash = navHref("results");
    } catch (err) {
      setStep("form");
      setAnalyzeError(
        err instanceof Error && err.message !== "fetch failed"
          ? err.message
          : t.errors.nasaFailed
      );
    } finally {
      clearInterval(ticker);
    }
  };

  const soilOpts = useMemo(() => soilOptions(t), [t]);
  const waterOpts = useMemo(() => waterOptions(t), [t]);
  const seasonOpts = useMemo(() => seasonOptions(t), [t]);

  const stepIndex = step === "location" || step === "confirm" ? 0 : step === "form" ? 1 : 2;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {/* header + steps */}
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        {t.analyze.title}
      </h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
        {t.analyze.intro}
      </p>

      <ol className="mt-6 flex flex-wrap gap-2" aria-label="Progress">
        {[t.analyze.stepLocation, t.analyze.stepFarm, t.analyze.stepAnalysis].map(
          (label, i) => (
            <li
              key={label}
              className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold ${
                i === stepIndex
                  ? "border-primary bg-primary text-primary-foreground"
                  : i < stepIndex
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "text-muted-foreground"
              }`}
            >
              {i < stepIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
              {i + 1}. {label}
            </li>
          )
        )}
      </ol>

      {/* ---------------- STEP: LOCATION ---------------- */}
      {(step === "location" || step === "confirm") && (
        <section className="mt-8 space-y-6">
          {/* GPS card */}
          {step === "location" && (
            <Card className="border-primary/25 shadow-md">
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow">
                    <LocateFixed className="h-7 w-7" aria-hidden />
                  </span>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold sm:text-2xl">
                      {t.analyze.gpsTitle}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {t.analyze.gpsDesc}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t.analyze.gpsPrivacy}
                    </p>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <Button
                        size="lg"
                        className="font-bold"
                        onClick={detectLocation}
                        disabled={gpsState === "locating"}
                      >
                        {gpsState === "locating" ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <LocateFixed className="h-5 w-5" />
                        )}
                        {gpsState === "locating"
                          ? t.analyze.detecting
                          : t.analyze.detectBtn}
                      </Button>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {t.analyze.gpsNote}
                    </p>
                  </div>
                </div>

                {/* GPS failure explanations */}
                {gpsState === "denied" && (
                  <Alert className="mt-5" variant="destructive">
                    <AlertTriangle />
                    <AlertTitle>{t.analyze.gpsDeniedTitle}</AlertTitle>
                    <AlertDescription className="leading-relaxed">
                      {t.analyze.gpsDeniedDesc}
                    </AlertDescription>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={detectLocation}>
                        <RefreshCw className="h-4 w-4" />
                        {t.analyze.gpsRetry}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setGpsState("idle")}
                      >
                        {t.analyze.gpsManual}
                      </Button>
                    </div>
                  </Alert>
                )}
                {gpsState === "error" && (
                  <Alert className="mt-5" variant="destructive">
                    <AlertTriangle />
                    <AlertTitle>{t.analyze.gpsErrorTitle}</AlertTitle>
                    <AlertDescription className="leading-relaxed">
                      {t.analyze.gpsDeniedDesc}
                    </AlertDescription>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={detectLocation}>
                        <RefreshCw className="h-4 w-4" />
                        {t.analyze.gpsRetry}
                      </Button>
                    </div>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* search + map */}
          <Card className="shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder={t.analyze.searchPlaceholder}
                  className="ps-9"
                  aria-label={t.analyze.searchPlaceholder}
                />
                {searching && (
                  <span className="absolute end-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </span>
                )}
                {searchResults && (
                  <ul className="agri-scroll absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border bg-popover shadow-lg">
                    {searchResults.length === 0 && (
                      <li className="px-4 py-3 text-sm text-muted-foreground">
                        {t.analyze.searchNoResults}
                      </li>
                    )}
                    {searchResults.map((r, i) => (
                      <li key={`${r.lat}-${r.lng}-${i}`}>
                        <button
                          type="button"
                          className="flex w-full items-start gap-2 px-4 py-2.5 text-start text-sm hover:bg-secondary"
                          onClick={() => {
                            setSearchResults(null);
                            setSearchQ("");
                            applyPosition(r.lat, r.lng, "search", undefined, r.label);
                            toast({ description: r.label });
                          }}
                        >
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span className="line-clamp-2">{r.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t.analyze.searchHint}
              </p>

              <div className="mt-4">
                <FarmMap
                  position={pending ? { lat: pending.lat, lng: pending.lng } : null}
                  flyKey={flyKey}
                  onPositionChange={(lat, lng) => applyPosition(lat, lng, "map")}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{t.analyze.mapHint}</p>
                {pending && (
                  <p className="rounded-lg bg-secondary px-3 py-1.5 font-mono text-xs font-bold text-secondary-foreground">
                    {pending.lat.toFixed(5)}, {pending.lng.toFixed(5)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* saved analyses */}
          {step === "location" && !loadingSaved && savedList.length > 0 && (
            <Card className="shadow-sm">
              <CardContent className="p-4 sm:p-6">
                <h3 className="flex items-center gap-2 text-sm font-bold">
                  <History className="h-4 w-4 text-primary" aria-hidden />
                  {t.analyze.recentAnalyses}
                </h3>
                <ul className="agri-scroll mt-3 max-h-64 space-y-2 overflow-y-auto">
                  {savedList.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">
                          {s.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(s.createdAt).toLocaleString(
                            lang === "ar" ? "ar-EG" : "en-GB",
                            { dateStyle: "medium", timeStyle: "short" }
                          )}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openSaved(s.id)}
                      >
                        {t.analyze.loadSaved}
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* ---------------- STEP: CONFIRM ---------------- */}
      {step === "confirm" && pending && (
        <Card className="mt-8 border-primary/25 shadow-md">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow">
                <MapPin className="h-7 w-7" aria-hidden />
              </span>
              <div className="flex-1">
                <h2 className="text-xl font-bold sm:text-2xl">
                  {t.analyze.confirmTitle}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {fill(t.analyze.confirmDesc, {
                    source: t.analyze.locationSource[pending.source],
                  })}
                </p>
                <dl className="mt-4 grid gap-2 rounded-xl border bg-secondary/40 p-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold text-muted-foreground">
                      {t.analyze.selectedLocation}
                    </dt>
                    <dd className="mt-0.5 font-bold">{pending.label}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-muted-foreground">
                      {t.analyze.coordinates}
                    </dt>
                    <dd className="mt-0.5 font-mono font-bold">
                      {pending.lat.toFixed(5)}, {pending.lng.toFixed(5)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-muted-foreground">
                      {t.analyze.stepLocation}
                    </dt>
                    <dd className="mt-0.5 font-bold">
                      {t.analyze.locationSource[pending.source]}
                    </dd>
                  </div>
                  {typeof pending.accuracy === "number" && (
                    <div>
                      <dt className="text-xs font-semibold text-muted-foreground">
                        {t.analyze.accuracy}
                      </dt>
                      <dd className="mt-0.5 font-bold">
                        ± {Math.round(pending.accuracy)} m
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    size="lg"
                    className="font-bold"
                    onClick={() => {
                      store.setLocation(pending);
                      store.confirmLocation();
                      setStep("form");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    {t.analyze.yesConfirm}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="font-bold"
                    onClick={() => setStep("location")}
                  >
                    {t.analyze.noChange}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------------- STEP: FORM ---------------- */}
      {step === "form" && (
        <section className="mt-8 space-y-6">
          <Card className="shadow-sm">
            <CardContent className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MapPin className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-muted-foreground">
                  {t.analyze.confirmed}
                </p>
                <p className="truncate text-sm font-bold">
                  {store.location?.label}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {store.location?.lat.toFixed(5)}, {store.location?.lng.toFixed(5)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPending(store.location);
                  store.resetLocation();
                  setStep("location");
                }}
              >
                {t.analyze.changeLocation}
              </Button>
            </CardContent>
          </Card>

          <form
            onSubmit={form.handleSubmit(submitAnalysis)}
            className="space-y-6"
            noValidate
          >
            <Card className="shadow-sm">
              <CardContent className="space-y-7 p-6 sm:p-8">
                <header>
                  <h2 className="text-xl font-bold sm:text-2xl">
                    {t.analyze.formTitle}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.analyze.formIntro}
                  </p>
                </header>

                {/* soil */}
                <fieldset>
                  <legend className="text-sm font-bold">
                    {t.analyze.soilTitle} <span className="text-destructive">*</span>
                  </legend>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.analyze.soilHelp}
                  </p>
                  <RadioGroup
                    value={form.watch("soilType")}
                    onValueChange={(v) =>
                      form.setValue("soilType", v as FormValues["soilType"], {
                        shouldValidate: true,
                      })
                    }
                    className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                    aria-label={t.analyze.soilTitle}
                  >
                    {soilOpts.map((o) => (
                      <label
                        key={o.value}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors hover:border-primary/50 hover:bg-secondary/40 has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5"
                      >
                        <RadioGroupItem value={o.value} id={`soil-${o.value}`} className="mt-1" />
                        <div>
                          <span className="block text-sm font-bold">
                            {o.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {o.desc}
                          </span>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                  {form.formState.errors.soilType && (
                    <p className="mt-2 text-sm text-destructive" role="alert">
                      {t.analyze.validationRequired}
                    </p>
                  )}
                </fieldset>

                {/* water */}
                <fieldset>
                  <legend className="text-sm font-bold">
                    {t.analyze.waterTitle} <span className="text-destructive">*</span>
                  </legend>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.analyze.waterHelp}
                  </p>
                  <RadioGroup
                    value={form.watch("waterAvailability")}
                    onValueChange={(v) =>
                      form.setValue(
                        "waterAvailability",
                        v as FormValues["waterAvailability"],
                        { shouldValidate: true }
                      )
                    }
                    className="mt-3 grid gap-3 sm:grid-cols-3"
                    aria-label={t.analyze.waterTitle}
                  >
                    {waterOpts.map((o) => (
                      <label
                        key={o.value}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors hover:border-primary/50 hover:bg-secondary/40 has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5"
                      >
                        <RadioGroupItem value={o.value} id={`water-${o.value}`} className="mt-1" />
                        <div>
                          <span className="block text-sm font-bold">{o.title}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {o.desc}
                          </span>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                  {form.formState.errors.waterAvailability && (
                    <p className="mt-2 text-sm text-destructive" role="alert">
                      {t.analyze.validationRequired}
                    </p>
                  )}
                </fieldset>

                {/* season */}
                <fieldset>
                  <legend className="text-sm font-bold">
                    {t.analyze.seasonTitle} <span className="text-destructive">*</span>
                  </legend>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.analyze.seasonHelp}
                  </p>
                  <RadioGroup
                    value={form.watch("season")}
                    onValueChange={(v) =>
                      form.setValue("season", v as FormValues["season"], {
                        shouldValidate: true,
                      })
                    }
                    className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                    aria-label={t.analyze.seasonTitle}
                  >
                    {seasonOpts.map((o) => (
                      <label
                        key={o.value}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors hover:border-primary/50 hover:bg-secondary/40 has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5"
                      >
                        <RadioGroupItem value={o.value} id={`season-${o.value}`} className="mt-1" />
                        <div>
                          <span className="block text-sm font-bold">{o.title}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {o.desc}
                          </span>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                  {form.formState.errors.season && (
                    <p className="mt-2 text-sm text-destructive" role="alert">
                      {t.analyze.validationRequired}
                    </p>
                  )}
                </fieldset>

                {/* optional details */}
                <fieldset className="rounded-xl border border-dashed p-4 sm:p-5">
                  <legend className="px-2 text-sm font-bold text-muted-foreground">
                    {t.analyze.optionalSection}
                  </legend>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="farmSize">{t.analyze.sizeTitle}</Label>
                      <div className="mt-1.5 flex gap-2">
                        <Input
                          id="farmSize"
                          inputMode="decimal"
                          placeholder={t.analyze.sizePlaceholder}
                          {...form.register("farmSize")}
                        />
                        <Select
                          value={form.watch("sizeUnit")}
                          onValueChange={(v) =>
                            form.setValue("sizeUnit", v as FormValues["sizeUnit"])
                          }
                        >
                          <SelectTrigger className="w-36" aria-label={t.analyze.sizeTitle}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="acres">{t.analyze.unitAcres}</SelectItem>
                            <SelectItem value="hectares">{t.analyze.unitHectares}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.analyze.unitFeddan}
                      </p>
                      {form.formState.errors.farmSize && (
                        <p className="mt-1 text-xs text-destructive" role="alert">
                          {t.analyze.validationSizePositive}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="irrigationMethod">{t.analyze.irrigationTitle}</Label>
                      <Select
                        value={form.watch("irrigationMethod") || "none"}
                        onValueChange={(v) =>
                          form.setValue(
                            "irrigationMethod",
                            (v === "none" ? "" : v) as FormValues["irrigationMethod"]
                          )
                        }
                      >
                        <SelectTrigger id="irrigationMethod" className="mt-1.5 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t.analyze.irrigationNone}</SelectItem>
                          <SelectItem value="flood">{t.analyze.irrigationFlood}</SelectItem>
                          <SelectItem value="drip">{t.analyze.irrigationDrip}</SelectItem>
                          <SelectItem value="sprinkler">{t.analyze.irrigationSprinkler}</SelectItem>
                          <SelectItem value="other">{t.analyze.irrigationOther}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="notes">{t.analyze.notesTitle}</Label>
                      <Textarea
                        id="notes"
                        className="mt-1.5"
                        rows={3}
                        placeholder={t.analyze.notesPlaceholder}
                        {...form.register("notes")}
                      />
                    </div>
                  </div>
                </fieldset>

                {analyzeError && (
                  <Alert variant="destructive" role="alert">
                    <AlertTriangle />
                    <AlertTitle>{t.analyze.errorTitle}</AlertTitle>
                    <AlertDescription>{analyzeError}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="h-13 w-full text-base font-bold sm:w-auto sm:px-10"
                  disabled={form.formState.isSubmitting}
                >
                  <Sprout className="h-5 w-5" />
                  {t.analyze.analyzeBtn}
                </Button>
              </CardContent>
            </Card>
          </form>
        </section>
      )}

      {/* ---------------- STEP: ANALYZING ---------------- */}
      {step === "analyzing" && (
        <Card className="mt-8 border-primary/25 shadow-md">
          <CardContent className="p-8 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
            </span>
            <h2 className="mt-5 text-xl font-bold sm:text-2xl">
              {t.analyze.analyzingTitle}
            </h2>
            <ul className="mx-auto mt-6 max-w-md space-y-3 text-start">
              {[
                t.analyze.analyzingStep1,
                t.analyze.analyzingStep2,
                t.analyze.analyzingStep3,
              ].map((s, i) => (
                <li
                  key={s}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-sm font-medium transition-colors ${
                    i < analyzeStepIdx
                      ? "border-primary/30 bg-primary/5 text-primary"
                      : i === analyzeStepIdx
                        ? "border-primary bg-primary/5"
                        : "text-muted-foreground"
                  }`}
                >
                  {i < analyzeStepIdx ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                  ) : i === analyzeStepIdx ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  ) : (
                    <span className="h-4 w-4 shrink-0 rounded-full border-2" />
                  )}
                  {s}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs text-muted-foreground">
              {t.analyze.analyzingNote}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AnalyzeView;
