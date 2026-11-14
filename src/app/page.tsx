"use client";

import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { AppShell } from "@/components/agriwise/AppShell";

export default function AgriWiseApp() {
  return (
    <LanguageProvider>
      <AppShell />
    </LanguageProvider>
  );
}
