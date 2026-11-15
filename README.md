# Field Shift — NASA-Powered Smart Agriculture Platform

link of website:- https://agriwise.space-z.ai/

*Internal application name: AgriWise (established by the existing codebase and preserved).*

A complete, bilingual (English/Arabic) agricultural decision-support platform for
farmers in **Luxor, Egypt**, built for **NASA Space Apps Challenge 2026 —
Challenge 7: "Adapting Farms with NASA Data"**.

Field Shift answers seven practical questions from real satellite data:

| # | Tool | What it answers |
|---|------|-----------------|
| 1 | **Farm Analysis** | Which crops are most suitable for my land? (explainable, weighted engine) |
| 2 | **Smart Planting Time Advisor** | Plant now, or wait? (12-month suitability + decision) |
| 3 | **Climate Risk Monitoring** | Which climate risks affect my crop? (crop-specific thresholds, early warnings) |
| 4 | **Smart Irrigation Advisor** | How much water does my crop need now? (FAO-56 Penman–Monteith ETo/ETc) |
| 5 | **Smart Crop Calendar** | What should I do at each growth stage? (interactive timeline anchored to my planting date) |
| 6 | **Satellite Field Monitoring** | How does my field look from space? (NASA GIBS imagery + NDVI composites) |
| 7 | **Expected Yield Reference** | What yield do Egyptian farms like mine achieve? (FAOSTAT reference + climate factors) |
| — | **Farmer Action Center** | One dashboard combining the real results of every tool above |

## Data honesty (project principle)

Every number shown in the app is either:

- **Live NASA POWER observation** (daily/climatology/multi-year, fill value −999 excluded),
- **NASA GIBS satellite imagery** (verified WMTS layers),
- **A real 7-day forecast** from Open-Meteo (always labelled *FORECAST*),
- **A documented agricultural reference** (FAO EcoCrop, FAO I&D Paper 33, FAO-56
  Tables 11/12, Brouwer & Heibloem, FAOSTAT Egypt, Egyptian MALR calendars), or
- **Farmer input**.

Missing data is reported as *unavailable* — never fabricated, never interpolated.
Historical climate data is never presented as current weather or a forecast.
Model-generated estimates are always labelled as estimates.

## Data sources

| Source | Used for |
|---|---|
| [NASA POWER](https://power.larc.nasa.gov/) (`temporal/daily/point`, `temporal/climatology/point`, community AG) | 7 parameters: T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, RH2M, ALLSKY_SFC_SW_DWN, WS10M |
| [NASA GIBS / Worldview](https://worldview.earthdata.nasa.gov/) (WMTS, no key) | VIIRS SNPP true colour (daily, 375 m), MODIS Terra true colour (daily, 250 m), MODIS Terra L3 NDVI (16-day composite) |
| [Open-Meteo](https://open-meteo.com/) (no key) | 7-day forecast (early warnings) + elevation (FAO-56 pressure term) |
| [Nominatim / OpenStreetMap](https://nominatim.org/) | Place search + reverse geocoding |
| FAO / FAOSTAT / Egyptian MALR | Documented crop requirements, Kc values, stage lengths, reference yields |

No API keys are required for any integration.

## Tech stack

- **Next.js 16** (App Router, standalone output) + **React 19** + **TypeScript 5** (strict)
- **Tailwind CSS 4** + shadcn/ui (Radix primitives), light/dark theme
- **Leaflet** + react-leaflet (OSM + NASA GIBS tile layers)
- **Recharts** (climate/risk/water charts)
- **Zustand** (session-persisted stores) + typed bilingual dictionary (EN/AR, RTL)
- **Prisma 6 + SQLite** (optional saved analyses — the app works fully without it)
- **Bun** as the package manager/runtime

## Requirements

- Bun (recommended; a `bun.lock` is included)
- A Node.js version compatible with the installed Next.js

## Setup

```bash
# 1. install dependencies
bun install

# 2. create your local environment file (no real secrets involved)
cp .env.example .env

# 3. generate the Prisma client and create the local SQLite database
bun run db:generate
bun run db:push

# 4. start the development server
bun run dev
```

Open <http://localhost:3000>.

## Development

```bash
bun run dev          # dev server on :3000 (dev.log)
bun run lint         # eslint
bunx tsc --noEmit    # strict type check (0 errors expected)
```

## Testing

```bash
bun scripts/test-fao56.ts          # FAO-56 ETo vs the standard Example 18 (offline)
bun scripts/test-engine.ts         # recommendation engine against live NASA POWER data
bun scripts/test-planting.ts       # planting advisor logic against live data
bun scripts/test-risk-calendar.ts  # risk + crop calendar engines (needs /tmp/analyze_test.json fixture)
bun scripts/test-calendar-date.ts  # crop-calendar date anchoring (needs /tmp/analyze_test.json fixture)
```

The two fixture-based tests read `/tmp/analyze_test.json` — a saved `/api/analyze`
response. Generate one, for example:

```bash
bun run dev &
curl -s -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"location":{"lat":25.6872,"lng":32.6396,"label":"Luxor","source":"search"},"farm":{"soilType":"loam","waterAvailability":"abundant","season":"winter"}}' \
  > /tmp/analyze_test.json
```

## Production build

```bash
bun run build
bun run start    # serves .next/standalone on :3000
```

## Deployment notes

- The app is a single Next.js route (hash-based SPA views) + API routes.
- NASA POWER, GIBS, Open-Meteo and Nominatim are called **server-side** (API
  routes) with a custom User-Agent, timeouts, retries and in-memory caching —
  deploy behind HTTPS on any Node 20+/Bun host. `bun run build` produces a
  standalone server in `.next/standalone`.
- The SQLite database (`db/custom.db`) is optional; point `DATABASE_URL` at any
  SQLite file path. `bun run db:push` creates the single `SavedAnalysis` table.
- In-memory caches (6 h for NASA data, 30 min for forecasts, process-lifetime
  for elevation) are per-instance — fine for single-instance deploys.

## API overview

All endpoints are zod-validated. Full request/response contracts:
[`docs/API.md`](docs/API.md).

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/analyze` | POST | Full farm analysis → ranked crop recommendation |
| `/api/planting` | POST | Planting-time advisor (plant now / wait / not recommended) |
| `/api/irrigation` | POST | FAO-56 ETo/ETc irrigation guidance |
| `/api/yield` | POST | FAOSTAT yield reference + climate factors |
| `/api/forecast` | GET | Real 7-day forecast for early warnings |
| `/api/geocode` | GET | Nominatim search / reverse proxy |
| `/api/analyses` | GET/POST | Optional saved analyses (Prisma) |

## Project structure

```
src/
├─ app/
│  ├─ layout.tsx, page.tsx, globals.css     # single-route shell + providers
│  └─ api/{analyze,planting,irrigation,yield,forecast,geocode,analyses}/route.ts
├─ components/
│  ├─ agriwise/                             # application components
│  │  ├─ AppShell, Navbar, Footer, useHashRouter
│  │  ├─ LocationPicker, FarmMap, ClimateCharts, RiskDashboard, CropCalendarSection
│  │  └─ views/                             # HomeView, AnalyzeView, ResultsView, PlantingView,
│  │                                        # IrrigationView, SatelliteView, YieldView,
│  │                                        # ActionCenterView, AboutView, SourcesView
│  └─ ui/                                   # shadcn/ui kit
└─ lib/
   ├─ nasa.ts        # NASA POWER fetchers + aggregation + caching
   ├─ engine.ts      # weighted crop recommendation engine
   ├─ crops.ts       # documented crop requirement database (7 crops)
   ├─ planting.ts    # planting-time advisor engine
   ├─ risk.ts        # climate risk assessment + forecast early warnings
   ├─ fao56.ts       # FAO-56 Penman–Monteith ETo + Kc tables
   ├─ irrigation.ts  # irrigation advisor engine
   ├─ calendar.ts    # smart crop calendar engine
   ├─ satellite.ts   # NASA GIBS layer catalog + tile probing
   ├─ yield.ts       # FAOSTAT yield reference
   ├─ types.ts, labels.ts, store.ts, toolsStore.ts
   └─ i18n/          # typed EN/AR dictionary + language context (RTL)
```

## Extending the crop database

Supported crops live in `src/lib/crops.ts` (sugarcane, wheat, maize, rice,
tomato, potato, onion). Adding a crop means appending one `CropRecord` **plus**
the matching entries in: `src/lib/fao56.ts` (Kc + stage lengths),
`src/lib/calendar.ts` (stage templates), `src/lib/yield.ts` (FAOSTAT rows),
`src/lib/planting.ts` (name aliases) and the Data Sources view if a new
reference key is used. Every threshold must have a traceable source — do not
invent values.

## Notes

- `.env` and local database files are intentionally excluded from the repo.
  Do not commit credentials or private data.
- Configure any required values in your local `.env`; `.env.example` documents
  the safe variable names.
- Satellite imagery uses NASA GIBS (no key). Sentinel-2 access requires
  Copernicus Data Space Ecosystem credentials — the Satellite view states this
  openly rather than faking imagery.
