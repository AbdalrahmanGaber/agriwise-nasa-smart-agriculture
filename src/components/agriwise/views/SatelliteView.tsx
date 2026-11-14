"use client";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Circle } from "react-leaflet";
import { useLang } from "@/lib/i18n/LanguageContext";
import { useToolsStore } from "@/lib/toolsStore";
import {
  GIBS_LAYERS,
  getGibsLayer,
  gibsUrl,
  snapToComposite16,
  latestLikelyAvailable,
  probeTileAvailability,
} from "@/lib/satellite";
import type { FarmLocation } from "@/lib/types";
import { LocationPicker } from "../LocationPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Satellite,
  Scan,
} from "lucide-react";

const pinIcon = L.divIcon({
  className: "agri-pin",
  html: `<div class="agri-pin-inner"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 28],
});

const TRANSPARENT_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const MIN_DATES: Record<string, string> = {
  VIIRS_SNPP_CorrectedReflectance_TrueColor: "2016-01-01",
  MODIS_Terra_CorrectedReflectance_TrueColor: "2001-01-01",
  MODIS_Terra_L3_NDVI_16Day: "2001-01-01",
};

export function SatelliteView() {
  const { t, L } = useLang();
  const tools = useToolsStore();

  const [layerId, setLayerId] = useState(GIBS_LAYERS[0].id);
  const layer = getGibsLayer(layerId)!;
  const [date, setDate] = useState(latestLikelyAvailable(3));
  const [compare, setCompare] = useState(false);
  const [dateB, setDateB] = useState(latestLikelyAvailable(31));
  const [probe, setProbe] = useState<{ key: string; available: boolean | null }>({
    key: "",
    available: null,
  });

  const loc: FarmLocation | null = tools.location;

  /** the date actually used by the layer (NDVI snaps to composite starts) */
  const effectiveDate = useMemo(
    () => (layer.temporal === "16day" ? snapToComposite16(date) : date),
    [layer.temporal, date]
  );
  const effectiveDateB = useMemo(
    () => (layer.temporal === "16day" ? snapToComposite16(dateB) : dateB),
    [layer.temporal, dateB]
  );

  const probeKey = `${layer.id}|${effectiveDate}|${loc?.lat ?? 0},${loc?.lng ?? 0}`;
  const checking = probe.key !== probeKey;

  /* availability probe on any change (async result only — the
     "checking" flag is derived from the key mismatch, so no
     synchronous setState happens in the effect body) */
  useEffect(() => {
    if (!loc) return;
    let alive = true;
    const key = `${layer.id}|${effectiveDate}|${loc.lat},${loc.lng}`;
    probeTileAvailability(layer, effectiveDate, loc.lat, loc.lng).then((r) => {
      if (alive) setProbe({ key, available: r.available });
    });
    return () => {
      alive = false;
    };
  }, [layer, effectiveDate, loc?.lat, loc?.lng]);

  /* record the visit to the Action Center when imagery is confirmed */
  useEffect(() => {
    if (!loc || checking || probe.available !== true) return;
    tools.setSatellite({
      layerId: layer.id,
      date: effectiveDate,
      label: L(layer.title),
      resolutionM: layer.resolutionM,
      visitedAt: new Date().toISOString(),
    });
  }, [probe.available, probe.key, layerId, effectiveDate]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="max-w-3xl">
        <p className="inline-flex items-center gap-2 rounded-full border bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">
          <Satellite className="h-3.5 w-3.5" aria-hidden />
          {t.nav.tools}
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t.satellite.title}
        </h1>
        <p className="mt-3 text-muted-foreground">{t.satellite.subtitle}</p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Scan className="h-5 w-5 text-primary" aria-hidden />
              {t.satellite.layerLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-2 sm:grid-cols-3">
              {GIBS_LAYERS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLayerId(l.id)}
                  aria-pressed={layerId === l.id}
                  className={`rounded-xl border-2 p-3 text-start transition-all hover:shadow-md ${
                    layerId === l.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card"
                  }`}
                >
                  <span className="block text-sm font-bold">{L(l.title)}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {l.resolutionM} m · {L(l.temporalLabel)}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{L(layer.description)}</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t.satellite.dateLabel}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold" htmlFor="sat-date">
                  {compare ? t.satellite.dateA : t.satellite.dateLabel}
                </label>
                <Input
                  id="sat-date"
                  type="date"
                  value={date}
                  min={MIN_DATES[layerId] ?? "2001-01-01"}
                  max={latestLikelyAvailable(0)}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-11 w-44"
                />
              </div>
              {compare && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold" htmlFor="sat-date-b">
                    {t.satellite.dateB}
                  </label>
                  <Input
                    id="sat-date-b"
                    type="date"
                    value={dateB}
                    min={MIN_DATES[layerId] ?? "2001-01-01"}
                    max={latestLikelyAvailable(0)}
                    onChange={(e) => setDateB(e.target.value)}
                    className="h-11 w-44"
                  />
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="sat-compare"
                checked={compare}
                onCheckedChange={setCompare}
              />
              <Label htmlFor="sat-compare" className="text-sm font-bold">
                {t.satellite.compareLabel}
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">{t.satellite.dateHelp}</p>
            {layer.temporal === "16day" && (
              <Badge variant="secondary" className="w-fit font-semibold">
                {t.satellite.acquisition}: {effectiveDate} (16 d)
              </Badge>
            )}
            {checking && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t.satellite.loadingTiles}
              </p>
            )}
            {!checking && probe.available === true && (
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                {t.satellite.imageryAvailable} · {t.satellite.acquisition}:{" "}
                {effectiveDate}
              </p>
            )}
            {!checking && probe.available === false && (
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                {t.satellite.noImagery}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <LocationPicker
          title={t.analyze.stepLocation}
          hint={t.planting.locationHint}
        />
      </div>

      {/* ---------- imagery ---------- */}
      <div className="mt-6">
        {!loc ? (
          <Card className="shadow-sm">
            <CardContent className="p-10 text-center text-muted-foreground">
              {t.analyze.gpsManual}
            </CardContent>
          </Card>
        ) : compare ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <GibsMapBlock
              layerId={layerId}
              date={effectiveDate}
              loc={loc}
              caption={`${t.satellite.dateA}: ${effectiveDate}`}
            />
            <GibsMapBlock
              layerId={layerId}
              date={effectiveDateB}
              loc={loc}
              caption={`${t.satellite.dateB}: ${effectiveDateB}`}
            />
          </div>
        ) : (
          <GibsMapBlock
            layerId={layerId}
            date={effectiveDate}
            loc={loc}
            caption={L(layer.title)}
          />
        )}
      </div>

      {/* ---------- metadata & notes ---------- */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{t.satellite.source}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">
                {t.satellite.resolution}:
              </strong>{" "}
              {layer.resolutionM} m
            </p>
            <p>
              <strong className="text-foreground">
                {t.satellite.acquisition}:
              </strong>{" "}
              {effectiveDate}
              {layer.temporal === "16day" ? " (+16 days)" : ""}
            </p>
            <p>
              <strong className="text-foreground">Provider:</strong>{" "}
              {layer.attribution}
            </p>
            <p className="text-xs">{t.satellite.attribution}</p>
          </CardContent>
        </Card>

        {layer.group === "ndvi" ? (
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{t.satellite.ndviLegendTitle}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p className="flex items-center gap-2">
                <span className="h-4 w-8 rounded-sm bg-emerald-600" aria-hidden />
                {t.satellite.ndviLegendGreen}
              </p>
              <p className="flex items-center gap-2">
                <span
                  className="h-4 w-8 rounded-sm bg-amber-500"
                  aria-hidden
                />
                {t.satellite.ndviLegendYellow}
              </p>
              <p className="flex items-center gap-2">
                <span className="h-4 w-8 rounded-sm bg-zinc-300" aria-hidden />
                {t.satellite.ndviLegendGrey}
              </p>
              <p className="mt-2 rounded-lg border bg-background/60 p-3 text-xs leading-relaxed text-muted-foreground">
                {t.satellite.ndviNote}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{t.satellite.circleLabel}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {L(layer.description)}
            </CardContent>
          </Card>
        )}

        <Card className="border-amber-300/60 shadow-sm dark:border-amber-500/30 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />
              {t.satellite.sentinelTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t.satellite.sentinelBody}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GibsMapBlock({
  layerId,
  date,
  loc,
  caption,
}: {
  layerId: string;
  date: string;
  loc: FarmLocation;
  caption: string;
}) {
  const layer = getGibsLayer(layerId)!;
  const url = gibsUrl(layer.id, date, layer.fileExt, layer.maxNativeZoom);
  return (
    <figure className="overflow-hidden rounded-xl border shadow-sm">
      <div dir="ltr">
        <MapContainer
          center={[loc.lat, loc.lng]}
          zoom={11}
          scrollWheelZoom
          className="h-[360px] w-full sm:h-[440px]"
        >
          <TileLayer
            key={`${layerId}-${date}`}
            url={url}
            attribution={layer.attribution}
            maxNativeZoom={layer.maxNativeZoom}
            maxZoom={14}
            minZoom={3}
            errorTileUrl={TRANSPARENT_1PX}
            opacity={1}
          />
          <Marker position={[loc.lat, loc.lng]} icon={pinIcon} />
          <Circle
            center={[loc.lat, loc.lng]}
            radius={1000}
            pathOptions={{
              color: "var(--primary)",
              weight: 2,
              fillOpacity: 0.06,
            }}
          />
        </MapContainer>
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t bg-card px-4 py-2 text-xs font-semibold text-muted-foreground">
        <span>{caption}</span>
        <span>
          {layer.resolutionM} m · {date}
        </span>
      </figcaption>
    </figure>
  );
}
