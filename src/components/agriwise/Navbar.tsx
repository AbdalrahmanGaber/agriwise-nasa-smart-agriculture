"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import {
  CalendarCheck,
  ChevronDown,
  Droplets,
  Languages,
  LayoutDashboard,
  Menu,
  Moon,
  Satellite,
  Scale,
  Sprout,
  Sun,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n/LanguageContext";
import { navHref, type ViewName } from "./useHashRouter";

export function Navbar({ current }: { current: ViewName }) {
  const { t, lang, toggleLang } = useLang();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const links: { view: ViewName; label: string }[] = [
    { view: "home", label: t.nav.home },
    { view: "analyze", label: t.nav.analyze },
    { view: "results", label: t.nav.results },
  ];

  const tools: { view: ViewName; label: string; icon: typeof Sprout }[] = [
    { view: "planting", label: t.nav.planting, icon: CalendarCheck },
    { view: "irrigation", label: t.nav.irrigation, icon: Droplets },
    { view: "satellite", label: t.nav.satellite, icon: Satellite },
    { view: "yield", label: t.nav.yield, icon: Scale },
    { view: "action", label: t.nav.action, icon: LayoutDashboard },
  ];

  const inTools = [
    "planting",
    "irrigation",
    "satellite",
    "yield",
    "action",
  ].includes(current);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75 no-print">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6">
        {/* Brand */}
        <a
          href={navHref("home")}
          className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
          aria-label="AgriWise"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Sprout className="h-5 w-5" aria-hidden />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-lg font-extrabold tracking-tight">
              {t.brand.name}
            </span>
            <span className="hidden text-[11px] font-medium text-muted-foreground sm:block">
              {t.brand.tagline}
            </span>
          </span>
        </a>

        {/* Desktop links */}
        <nav className="mx-auto hidden items-center gap-1 lg:flex" aria-label="Main">
          {links.map((l) => (
            <a
              key={l.view}
              href={navHref(l.view)}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                current === l.view &&
                  "bg-secondary text-foreground"
              )}
              aria-current={current === l.view ? "page" : undefined}
            >
              {l.label}
            </a>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                inTools && "bg-secondary text-foreground"
              )}
            >
              {t.nav.tools}
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-56">
              <DropdownMenuLabel className="text-xs font-bold text-muted-foreground">
                {t.nav.tools}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {tools.map((tool) => (
                <DropdownMenuItem key={tool.view} asChild>
                  <a
                    href={navHref(tool.view)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2.5",
                      current === tool.view && "font-bold text-primary"
                    )}
                  >
                    <tool.icon className="h-4 w-4" aria-hidden />
                    {tool.label}
                  </a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <a
            href={navHref("about")}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
              current === "about" && "bg-secondary text-foreground"
            )}
            aria-current={current === "about" ? "page" : undefined}
          >
            {t.nav.about}
          </a>
          <a
            href={navHref("sources")}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
              current === "sources" && "bg-secondary text-foreground"
            )}
            aria-current={current === "sources" ? "page" : undefined}
          >
            {t.nav.sources}
          </a>
        </nav>

        {/* Actions */}
        <div className="ms-auto flex items-center gap-1.5 lg:ms-0">
          <a
            href={navHref("action")}
            className={cn(
              "hidden h-9 items-center gap-1.5 rounded-lg border bg-card px-3 text-sm font-bold text-foreground transition-colors hover:bg-secondary md:inline-flex",
              current === "action" && "bg-secondary"
            )}
          >
            <LayoutDashboard className="h-4 w-4 text-primary" aria-hidden />
            {t.nav.action}
          </a>
          <button
            type="button"
            onClick={toggleLang}
            className="flex h-9 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-sm font-bold text-foreground transition-colors hover:bg-secondary"
            aria-label={t.nav.language}
            title={t.nav.language}
          >
            <Languages className="h-4 w-4 text-primary" aria-hidden />
            <span>{lang === "en" ? "العربية" : "English"}</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card text-foreground transition-colors hover:bg-secondary"
            aria-label={t.nav.theme}
          >
            <Sun className="h-4 w-4 dark:hidden" aria-hidden />
            <Moon className="hidden h-4 w-4 dark:block" aria-hidden />
          </button>
          <Button
            asChild
            className="hidden h-9 px-4 font-bold sm:inline-flex"
          >
            <a href={navHref("analyze")}>{t.nav.analyzeCta}</a>
          </Button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={t.nav.menu}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="border-t bg-background px-4 pb-4 pt-2 lg:hidden" aria-label="Mobile">
          <ul className="flex flex-col gap-1">
            {links.map((l) => (
              <li key={l.view}>
                <a
                  href={navHref(l.view)}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground",
                    current === l.view && "bg-secondary text-foreground"
                  )}
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li className="pt-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {t.nav.tools}
            </li>
            {tools.map((l) => (
              <li key={l.view}>
                <a
                  href={navHref(l.view)}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground",
                    current === l.view && "bg-secondary text-foreground"
                  )}
                >
                  <l.icon className="h-4 w-4 text-primary" aria-hidden />
                  {l.label}
                </a>
              </li>
            ))}
            <li className="pt-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {t.nav.about} · {t.nav.sources}
            </li>
            {(["about", "sources"] as ViewName[]).map((v) => (
              <li key={v}>
                <a
                  href={navHref(v)}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground",
                    current === v && "bg-secondary text-foreground"
                  )}
                >
                  {v === "about" ? t.nav.about : t.nav.sources}
                </a>
              </li>
            ))}
            <li className="pt-1">
              <Button asChild className="w-full font-bold">
                <a href={navHref("analyze")} onClick={() => setOpen(false)}>
                  {t.nav.analyzeCta}
                </a>
              </Button>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
