"use client";

/**
 * Analysis session store — survives in-page navigation and page reloads
 * (sessionStorage). Holds the confirmed farm location, the farm inputs and
 * the latest full analysis result.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  AnalysisResult,
  FarmInput,
  FarmLocation,
} from "@/lib/types";

export const DEFAULT_FARM: FarmInput = {
  soilType: "unknown",
  waterAvailability: "moderate",
  season: "winter",
  farmSize: null,
  sizeUnit: "acres",
  irrigationMethod: "",
  notes: "",
};

interface AnalysisState {
  location: FarmLocation | null;
  locationConfirmed: boolean;
  farm: FarmInput;
  result: AnalysisResult | null;
  setLocation: (loc: FarmLocation) => void;
  confirmLocation: () => void;
  resetLocation: () => void;
  setFarm: (farm: Partial<FarmInput>) => void;
  setResult: (result: AnalysisResult) => void;
  clearAll: () => void;
}

export const useAnalysisStore = create<AnalysisState>()(
  persist(
    (set) => ({
      location: null,
      locationConfirmed: false,
      farm: DEFAULT_FARM,
      result: null,
      setLocation: (location) =>
        set({ location, locationConfirmed: false, result: null }),
      confirmLocation: () => set({ locationConfirmed: true }),
      resetLocation: () =>
        set({ location: null, locationConfirmed: false, result: null }),
      setFarm: (farm) => set((s) => ({ farm: { ...s.farm, ...farm } })),
      setResult: (result) => set({ result }),
      clearAll: () =>
        set({
          location: null,
          locationConfirmed: false,
          farm: DEFAULT_FARM,
          result: null,
        }),
    }),
    {
      name: "agriwise-analysis",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
