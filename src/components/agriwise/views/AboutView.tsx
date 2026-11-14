"use client";

import { useLang } from "@/lib/i18n/LanguageContext";
import { navHref } from "../useHashRouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Globe2,
  Satellite,
  Sprout,
} from "lucide-react";

export function AboutView() {
  const { t, lang } = useLang();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        {t.about.title}
      </h1>

      <Card className="mt-8 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <Sprout className="h-5 w-5 text-primary" aria-hidden />
            {t.about.missionTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 leading-relaxed text-muted-foreground">
          <p>{t.about.missionBody}</p>
          <p>{t.about.missionBody2}</p>
        </CardContent>
      </Card>

      <Card className="mt-6 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <Satellite className="h-5 w-5 text-primary" aria-hidden />
            {t.about.nasaTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="leading-relaxed text-muted-foreground">
          {t.about.nasaBody}
        </CardContent>
      </Card>

      <Card className="mt-6 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <Globe2 className="h-5 w-5 text-primary" aria-hidden />
            {t.about.methodTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="leading-relaxed text-muted-foreground">
          {t.about.methodBody}
        </CardContent>
      </Card>

      <Card className="mt-6 border-amber-300/60 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" aria-hidden />
            {t.about.limitationsTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2.5">
            {t.about.limitations.map((lim, i) => (
              <li key={i} className="flex gap-2.5 leading-relaxed text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                {lim}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="mt-6 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-bold">
            {t.about.benefitsTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {t.about.benefits.map((b, i) => (
              <li
                key={i}
                className="flex gap-2.5 rounded-xl border bg-secondary/30 p-3.5 leading-relaxed"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                <span className="text-sm">{b}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild size="lg" className="font-bold">
          <a href={navHref("analyze")}>{t.nav.analyzeCta}</a>
        </Button>
        <Button asChild size="lg" variant="outline" className="font-bold">
          <a href={navHref("sources")}>{t.sources.title}</a>
        </Button>
      </div>
    </div>
  );
}
