import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";

export const metadata: Metadata = {
  title: "AgriWise – Smart Crop Advisor | NASA-Powered Crop Recommendations",
  description:
    "AgriWise helps farmers identify the most suitable crops for their land using real NASA POWER climate data, interactive maps, and a transparent agricultural recommendation engine. Bilingual (Arabic/English).",
  keywords: [
    "AgriWise",
    "smart agriculture",
    "crop recommendation",
    "NASA POWER",
    "Egypt agriculture",
    "Luxor farming",
    "crop suitability",
  ],
  authors: [{ name: "AgriWise Team" }],
  openGraph: {
    title: "AgriWise – Smart Crop Advisor",
    description:
      "Grow smarter with NASA data. Identify the most suitable crops for your land.",
    siteName: "AgriWise",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF9F3" },
    { media: "(prefers-color-scheme: dark)", color: "#12211A" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Pre-hydration: apply saved language direction before React paints (avoids RTL flash)
const langInit = `(function(){try{var l=localStorage.getItem("agriwise-lang");if(l==="ar"||l==="en"){document.documentElement.lang=l;document.documentElement.dir=l==="ar"?"rtl":"ltr";}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: langInit }} />
      </head>
      <body className="antialiased bg-background text-foreground min-h-screen flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
