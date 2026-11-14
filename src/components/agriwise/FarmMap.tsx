"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { FarmLocation } from "@/lib/types";

/**
 * Interactive farm map (Leaflet + OpenStreetMap).
 * - marker is draggable; tapping the map moves it
 * - external position updates (GPS / search) recenter the map smoothly
 * - stays LTR internally so it works inside the Arabic RTL layout
 */

const pinIcon = L.divIcon({
  className: "agri-pin",
  html: `<div class="agri-pin-inner"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 28],
});

/** Follows external position changes and flies the view there. */
function MapFlyer({
  target,
  flyKey,
}: {
  target: { lat: number; lng: number };
  flyKey: number;
}) {
  const map = useMap();
  const lastKey = useRef(-1);
  useEffect(() => {
    if (flyKey !== lastKey.current) {
      lastKey.current = flyKey;
      map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 13), {
        duration: 0.8,
      });
    }
  }, [flyKey, target.lat, target.lng, map]);
  return null;
}

/** Reports map taps to the parent. */
function MapClickCatcher({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export interface FarmMapProps {
  position: { lat: number; lng: number } | null;
  /** increments every time an external update (GPS/search) should recenter */
  flyKey: number;
  onPositionChange: (lat: number, lng: number, source: "map") => void;
}

const LUXOR: [number, number] = [25.6872, 32.6395];

export function FarmMap({ position, flyKey, onPositionChange }: FarmMapProps) {
  return (
    <div dir="ltr" className="overflow-hidden rounded-xl border shadow-sm">
        <MapContainer
          center={position ? [position.lat, position.lng] : LUXOR}
          zoom={position ? 13 : 9}
          scrollWheelZoom
          className="h-[320px] w-full sm:h-[400px]"
          attributionControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          {position && (
            <Marker
              position={[position.lat, position.lng]}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const ll = (e.target as L.Marker).getLatLng();
                  onPositionChange(ll.lat, ll.lng, "map");
                },
              }}
            />
          )}
          <MapFlyer
            target={position ?? { lat: LUXOR[0], lng: LUXOR[1] }}
            flyKey={flyKey}
          />
          <MapClickCatcher
            onPick={(lat, lng) => onPositionChange(lat, lng, "map")}
          />
        </MapContainer>
    </div>
  );
}

export type { FarmLocation };
