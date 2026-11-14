"use client";

import dynamic from "next/dynamic";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { useHashRouter } from "./useHashRouter";
import { HomeView } from "./views/HomeView";
import { AboutView } from "./views/AboutView";
import { SourcesView } from "./views/SourcesView";

// Map + charts are client-heavy; load lazily to keep first paint fast.
// The views use named exports, so map them to the `default` shape that
// next/dynamic (React.lazy) requires.
const AnalyzeView = dynamic(
  () => import("./views/AnalyzeView").then((m) => ({ default: m.AnalyzeView })),
  { ssr: false, loading: () => <ViewSkeleton /> }
);
const ResultsView = dynamic(
  () => import("./views/ResultsView").then((m) => ({ default: m.ResultsView })),
  { ssr: false, loading: () => <ViewSkeleton /> }
);
const PlantingView = dynamic(
  () => import("./views/PlantingView").then((m) => ({ default: m.PlantingView })),
  { ssr: false, loading: () => <ViewSkeleton /> }
);
const IrrigationView = dynamic(
  () => import("./views/IrrigationView").then((m) => ({ default: m.IrrigationView })),
  { ssr: false, loading: () => <ViewSkeleton /> }
);
const SatelliteView = dynamic(
  () => import("./views/SatelliteView").then((m) => ({ default: m.SatelliteView })),
  { ssr: false, loading: () => <ViewSkeleton /> }
);
const YieldView = dynamic(
  () => import("./views/YieldView").then((m) => ({ default: m.YieldView })),
  { ssr: false, loading: () => <ViewSkeleton /> }
);
const ActionCenterView = dynamic(
  () => import("./views/ActionCenterView").then((m) => ({ default: m.ActionCenterView })),
  { ssr: false, loading: () => <ViewSkeleton /> }
);

function ViewSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
      <div className="mt-6 h-40 w-full max-w-2xl animate-pulse rounded-xl bg-muted" />
      <div className="mt-4 h-40 w-full max-w-2xl animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

export function AppShell() {
  const { view } = useHashRouter();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar current={view} />
      <main id="main" className="flex-1">
        <div key={view} className="view-enter">
          {view === "home" && <HomeView />}
          {view === "analyze" && <AnalyzeView />}
          {view === "results" && <ResultsView />}
          {view === "planting" && <PlantingView />}
          {view === "irrigation" && <IrrigationView />}
          {view === "satellite" && <SatelliteView />}
          {view === "yield" && <YieldView />}
          {view === "action" && <ActionCenterView />}
          {view === "about" && <AboutView />}
          {view === "sources" && <SourcesView />}
        </div>
      </main>
      <Footer />
    </div>
  );
}
