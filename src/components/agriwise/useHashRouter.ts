"use client";

/**
 * Hash-based SPA router. The sandbox exposes a single Next.js route ("/"),
 * so AgriWise's five "pages" are views switched via the URL hash
 * (#/home, #/analyze, #/results, #/about, #/sources). This keeps the
 * browser back button working while staying on one route.
 */

import { useCallback, useEffect, useState } from "react";

export type ViewName =
  | "home"
  | "analyze"
  | "results"
  | "planting"
  | "irrigation"
  | "satellite"
  | "yield"
  | "action"
  | "about"
  | "sources";

const VALID: ViewName[] = [
  "home",
  "analyze",
  "results",
  "planting",
  "irrigation",
  "satellite",
  "yield",
  "action",
  "about",
  "sources",
];

function parseHash(): ViewName {
  if (typeof window === "undefined") return "home";
  const h = window.location.hash.replace(/^#\/?/, "").split("?")[0];
  return (VALID as string[]).includes(h) ? (h as ViewName) : "home";
}

export function useHashRouter() {
  const [view, setView] = useState<ViewName>("home");

  useEffect(() => {
    const onHash = () => {
      setView(parseHash());
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onHash);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("popstate", onHash);
    };
  }, []);

  const navigate = useCallback((next: ViewName) => {
    if (window.location.hash !== `#/${next}`) {
      window.location.hash = `#/${next}`;
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  return { view, navigate };
}

export const navHref = (view: ViewName) => `#/${view}`;
