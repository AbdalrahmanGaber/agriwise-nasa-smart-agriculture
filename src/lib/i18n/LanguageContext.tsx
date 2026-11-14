"use client";

/**
 * Language context: EN / AR with automatic html[dir] switching.
 * Persisted to localStorage ("agriwise-lang"); the pre-hydration script in
 * layout.tsx applies it before paint to avoid an RTL flash.
 *
 * The current language is read through useSyncExternalStore so React can
 * hydrate with the server snapshot ("en") and then switch to the persisted
 * client value without a hydration mismatch or cascading effect setState.
 */

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { DICT } from "./translations";
import type { Bilingual, Lang } from "@/lib/types";

const STORAGE_KEY = "agriwise-lang";

/* ---- tiny external store ---- */
let cached: Lang | null = null;
const listeners = new Set<() => void>();

function readLang(): Lang {
  if (cached) return cached;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    cached = saved === "ar" || saved === "en" ? saved : "en";
  } catch {
    cached = "en";
  }
  return cached;
}

function writeLang(next: Lang) {
  cached = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* private mode */
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

interface LanguageContextValue {
  lang: Lang;
  dir: "ltr" | "rtl";
  t: (typeof DICT)["en"];
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  /** pick the right side of a Bilingual object */
  L: (b: Bilingual) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, readLang, () => "en" as Lang);

  const setLang = useCallback((next: Lang) => writeLang(next), []);
  const toggleLang = useCallback(
    () => writeLang(readLang() === "en" ? "ar" : "en"),
    []
  );
  const L = useCallback((b: Bilingual) => (lang === "ar" ? b.ar : b.en), [lang]);

  const value: LanguageContextValue = {
    lang,
    dir: lang === "ar" ? "rtl" : "ltr",
    t: DICT[lang],
    setLang,
    toggleLang,
    L,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used inside <LanguageProvider>");
  return ctx;
}

/** Simple {placeholder} interpolation for dictionary strings. */
export function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{${k}}`
  );
}
