"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FarmMap } from "./FarmMap";
import { useLang } from "@/lib/i18n/LanguageContext";
import { useToolsStore } from "@/lib/toolsStore";
import { useAnalysisStore } from "@/lib/store";
import type { FarmLocation } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Check, LocateFixed, MapPin, Search } from "lucide-react";

/**
 * Compact shared location picker used by the smart tools:
 * GPS · place search · interactive map. Writes the confirmed position
 * into the tools store (session) so every tool shares one farm location.
 */

interface SearchHit {
  lat: number;
  lng: number;
  label: string;
  name?: string;
}

export function LocationPicker({ title, hint }: { title: string; hint?: string }) {
  const { t, lang } = useLang();
  const tools = useToolsStore();
  const analysis = useAnalysisStore();

  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(
    tools.location ?? analysis.location
  );
  const [label, setLabel] = useState(
    tools.location?.label ?? analysis.location?.label ?? ""
  );
  const [source, setSource] = useState<FarmLocation["source"]>(
    tools.location?.source ?? analysis.location?.source ?? "map"
  );
  const [flyKey, setFlyKey] = useState(0);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [gpsBusy, setGpsBusy] = useState<"idle" | "locating" | "denied">("idle");
  const reverseAbort = useRef<AbortController | null>(null);

  /* follow the shared tools location (rehydration / other views) */
  useEffect(() => {
    if (tools.location && !pos) {
      setPos({ lat: tools.location.lat, lng: tools.location.lng });
      setLabel(tools.location.label);
      setSource(tools.location.source);
      setFlyKey((k) => k + 1);
    }
  }, [tools.location]);

  const commit = useCallback(
    (lat: number, lng: number, src: FarmLocation["source"], lbl?: string) => {
      setPos({ lat, lng });
      setSource(src);
      setFlyKey((k) => k + 1);
      if (lbl) {
        setLabel(lbl);
        tools.setLocation({ lat, lng, label: lbl, source: src });
      } else {
        setLabel(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        tools.setLocation({
          lat,
          lng,
          label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          source: src,
        });
      }
    },
    [tools]
  );

  /* reverse geocode for map/gps picks */
  const reverseGeocode = useCallback(
    async (lat: number, lng: number, src: FarmLocation["source"]) => {
      reverseAbort.current?.abort();
      const ac = new AbortController();
      reverseAbort.current = ac;
      try {
        const res = await fetch(
          `/api/geocode?lat=${lat}&lon=${lng}&lang=${lang}`,
          { signal: ac.signal }
        );
        const data = await res.json();
        const lbl = data.label ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        setLabel(lbl);
        tools.setLocation({ lat, lng, label: lbl, source: src });
      } catch {
        /* keep coordinates label */
      }
    },
    [lang, tools]
  );

  /* debounced search */
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
        setSearchResults(res.ok ? (data.results ?? []) : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [searchQ, lang]);

  const detectGPS = () => {
    if (!("geolocation" in navigator)) {
      setGpsBusy("denied");
      return;
    }
    setGpsBusy("locating");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGpsBusy("idle");
        const lat = p.coords.latitude;
        const lng = p.coords.longitude;
        commit(lat, lng, "gps");
        reverseGeocode(lat, lng, "gps");
      },
      () => setGpsBusy("denied"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" aria-hidden />
          <h3 className="text-base font-bold">{title}</h3>
        </div>
        {pos && (
          <Badge variant="secondary" className="gap-1 font-semibold">
            <Check className="h-3 w-3" aria-hidden />
            {label || `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`}
          </Badge>
        )}
      </div>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={detectGPS}
            disabled={gpsBusy === "locating"}
            className="gap-2"
          >
            <LocateFixed className="h-4 w-4" aria-hidden />
            {gpsBusy === "locating" ? t.common.loading : t.analyze.detectBtn}
          </Button>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Search className="h-4 w-4" aria-hidden />
                {t.analyze.searchPlaceholder}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  value={searchQ}
                  onValueChange={setSearchQ}
                  placeholder={t.analyze.searchPlaceholder}
                />
                <CommandList>
                  <CommandEmpty>
                    {searching
                      ? t.analyze.searching
                      : t.analyze.searchNoResults}
                  </CommandEmpty>
                  {searchResults && searchResults.length > 0 && (
                    <CommandGroup>
                      {searchResults.map((r) => (
                        <CommandItem
                          key={`${r.lat},${r.lng}`}
                          value={`${r.label}`}
                          onSelect={() => {
                            commit(r.lat, r.lng, "search", r.label);
                            setOpen(false);
                            setSearchQ("");
                            setSearchResults(null);
                          }}
                        >
                          <MapPin className="h-4 w-4 text-primary" aria-hidden />
                          <span className="truncate">{r.label}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {gpsBusy === "denied" && (
            <span className="text-xs font-medium text-destructive">
              {t.analyze.gpsDeniedTitle}
            </span>
          )}
        </div>
        {pos && (
          <p className="text-xs font-mono text-muted-foreground">
            {pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}
          </p>
        )}
        <div dir="ltr">
          <FarmMap
            position={pos}
            flyKey={flyKey}
            onPositionChange={(lat, lng, src) => {
              commit(lat, lng, src);
              reverseGeocode(lat, lng, src);
            }}
          />
        </div>
      </div>
    </div>
  );
}
