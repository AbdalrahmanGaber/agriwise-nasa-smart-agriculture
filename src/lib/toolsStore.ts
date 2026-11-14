"use client";

/**
 * Tools session store — location + latest results of the smart tools
 * (Planting Time Advisor, Irrigation Advisor, Yield tool, Satellite
 * monitoring). Persisted to sessionStorage so the Farmer Action Center
 * can aggregate REAL results from tools the farmer actually ran.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { FarmLocation } from "./types";
import type { PlantingResult } from "./planting";
import type { IrrigationResult } from "./irrigation";
import type { YieldResult } from "./yield";

export interface SatelliteVisit {
  layerId: string;
  /** the imagery date actually displayed */
  date: string;
  /** layer title at visit time */
  label: string;
  resolutionM: number;
  visitedAt: string;
}

interface ToolsState {
  location: FarmLocation | null;
  planting: PlantingResult | null;
  irrigation: IrrigationResult | null;
  yieldResult: YieldResult | null;
  satellite: SatelliteVisit | null;
  /** actual planting date "YYYY-MM-DD" entered by the farmer (optional; shared with the crop calendar) */
  plantingDate: string | null;
  setLocation: (loc: FarmLocation | null) => void;
  setPlanting: (r: PlantingResult | null) => void;
  setIrrigation: (r: IrrigationResult | null) => void;
  setYieldResult: (r: YieldResult | null) => void;
  setSatellite: (s: SatelliteVisit | null) => void;
  setPlantingDate: (d: string | null) => void;
  clearAll: () => void;
}

export const useToolsStore = create<ToolsState>()(
  persist(
    (set) => ({
      location: null,
      planting: null,
      irrigation: null,
      yieldResult: null,
      satellite: null,
      plantingDate: null,
      setLocation: (location) => set({ location }),
      setPlanting: (planting) => set({ planting }),
      setIrrigation: (irrigation) => set({ irrigation }),
      setYieldResult: (yieldResult) => set({ yieldResult }),
      setSatellite: (satellite) => set({ satellite }),
      setPlantingDate: (plantingDate) => set({ plantingDate }),
      clearAll: () =>
        set({
          location: null,
          planting: null,
          irrigation: null,
          yieldResult: null,
          satellite: null,
          plantingDate: null,
        }),
    }),
    {
      name: "agriwise-tools",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
