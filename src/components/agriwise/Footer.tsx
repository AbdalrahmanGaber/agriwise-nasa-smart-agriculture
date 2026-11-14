"use client";

import { Sprout } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageContext";
import { navHref } from "./useHashRouter";

export function Footer() {
  const { t } = useLang();
  return (
    <footer className="mt-auto border-t bg-secondary/40 no-print">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sprout className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-base font-extrabold">{t.brand.name}</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {t.footer.tagline}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t.footer.madeFor}
              </p>
            </div>
          </div>
          <nav className="flex flex-col gap-2 text-sm font-semibold" aria-label="Footer">
            <a className="text-muted-foreground hover:text-foreground" href={navHref("analyze")}>
              {t.nav.analyze}
            </a>
            <a className="text-muted-foreground hover:text-foreground" href={navHref("about")}>
              {t.nav.about}
            </a>
            <a className="text-muted-foreground hover:text-foreground" href={navHref("sources")}>
              {t.nav.sources}
            </a>
            <a
              className="text-muted-foreground hover:text-foreground"
              href="https://power.larc.nasa.gov/"
              target="_blank"
              rel="noreferrer"
            >
              NASA POWER ↗
            </a>
          </nav>
        </div>
        <div className="mt-6 border-t pt-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t.footer.disclaimer}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{t.footer.credits}</p>
        </div>
      </div>
    </footer>
  );
}
