import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import AnswerCard from "@/components/answer-card";
import DrawingHint from "@/components/drawing-hint";
import DetailsDrawer from "@/components/details-drawer";
import { DEFAULT_LAYERS, type MapLayers, type SidePanel } from "@/lib/map-layer-options";
import MapDock from "@/components/map-dock";
import MapTools from "@/components/map-tools";
import MapLoading from "@/components/map-loading";
import MapTopBar from "@/components/map-top-bar";
import PlotPin from "@/components/plot-checks";
import { listPlotChecks } from "@/lib/plot-checks";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DEFAULT_VIEW, FRAME, useAnalysis, type EnvelopeView } from "@/hooks/use-analysis";
import { SM_UP } from "@/hooks/use-media-query";
import { useSiteData } from "@/hooks/use-site-data";
import { useSiteInputs } from "@/hooks/use-site-inputs";
import { useSettledValue } from "@/hooks/use-settled-value";
import { useThrottledValue } from "@/hooks/use-throttled-value";
import type { BuildingOverlap } from "@/lib/building-overlap";
import type { Design } from "@/lib/designs";

// The map (MapLibre, Three.js, terra-draw: ~1.7 MB) loads on its own, so the page
// appears at once. Its download starts right away, alongside the site data.
const mapViewModule = import("@/components/map-view");
const MapView = lazy(() => mapViewModule);

/** How long the plot must stay still before the map restyles the buildings it touches. */
const BUILDING_STYLE_SETTLE_MS = 200;
const NO_OVERLAPS: BuildingOverlap[] = [];

/** About 8 analysis updates a second during a drag: smooth, and still live. */
const ANALYSIS_INTERVAL_MS = 120;

export default function App() {
  const { data, error } = useSiteData();
  const site = useSiteInputs(data);
  const { inputs, drawing } = site;
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_LAYERS);
  const [selectedDesign, setSelectedDesign] = useState<Design["id"]>("A");
  const [view, setView] = useState<EnvelopeView>(DEFAULT_VIEW);
  // The details panel starts open on larger screens; on phones it would cover the map.
  const [panel, setPanel] = useState<SidePanel>(() =>
    window.matchMedia(SM_UP).matches ? "details" : null,
  );
  const detailsOpen = panel === "details";
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);

  // The analysis (site checks, rules, envelope, the 3D mesh and every card) follows
  // the inputs on a steady beat while a corner is dragged, instead of on every
  // frame; the plot outline itself still follows the pointer every frame.
  const analysedInputs = useThrottledValue(inputs, ANALYSIS_INTERVAL_MS);
  const analysis = useAnalysis(data, analysedInputs, view);
  const { geometry, rules, shown, envelope, designs, designsStale } = analysis;
  const checks = analysis.site;
  const design = designs?.find((d) => d.id === selectedDesign) ?? null;

  const plotChecks = listPlotChecks(
    checks?.overlaps ?? null,
    checks?.roadCrossings ?? [],
    geometry.coverage,
    geometry.selfCrossing,
  );
  const demolished = checks
    ? checks.overlaps.filter((overlap) => overlap.status === "on-plot").length
    : 0;

  const { resetInputs, handleFrontageEdge, handleRoadWidth } = site;
  const handleOpenDetails = useCallback(
    () => setPanel((open) => (open === "details" ? null : "details")),
    [],
  );
  const handleCloseDetails = useCallback(() => setPanel(null), []);
  const handleReset = useCallback(() => {
    resetInputs();
    setView(DEFAULT_VIEW);
  }, [resetInputs]);
  // Hiding the demolished buildings re-filters the whole 3,119-building layer, which
  // MapLibre then rebuilds. While the plot is moved that set changes constantly, so
  // the map's building highlights follow the plot once it settles.
  const mapOverlaps = useSettledValue(checks?.overlaps ?? NO_OVERLAPS, BUILDING_STYLE_SETTLE_MS);

  const handleView3d = useCallback(
    (view3d: boolean) => setLayers((current) => ({ ...current, view3d })),
    [],
  );

  // One object for the drawer's road-side section, rebuilt only when it changes.
  const { frontageEdge, roadName, roadWidthM } = analysedInputs;
  const road = useMemo(
    () => ({
      edges: geometry.edges,
      frontageEdge,
      roadName,
      onFrontageEdge: handleFrontageEdge,
      roadWidthM,
      onRoadWidth: handleRoadWidth,
    }),
    [geometry.edges, frontageEdge, roadName, roadWidthM, handleFrontageEdge, handleRoadWidth],
  );

  const map = data ? (
    <Suspense fallback={<MapLoading text="Loading the map…" />}>
      <MapView
        data={data}
        frame={FRAME}
        plot={inputs.plot}
        edges={geometry.edges}
        frontageEdge={inputs.frontageEdge}
        overlaps={mapOverlaps}
        roadCrossings={checks?.roadCrossings ?? []}
        envelope={envelope}
        drawing={drawing}
        onPlotChange={site.handlePlotChange}
        onDrawingEnd={site.handleDrawingEnd}
        onEdgeClick={site.handleFrontageEdge}
        layers={layers}
        design={layers.design ? design : null}
        plotPin={<PlotPin checks={plotChecks} demolished={demolished} />}
        onMapReady={setMapInstance}
      />
    </Suspense>
  ) : (
    <MapLoading
      text={error ? `Could not load the site data: ${error}` : "Loading zoning and building data…"}
      failed={!!error}
    />
  );

  return (
    <TooltipProvider>
      <main className="relative h-dvh overflow-hidden bg-[#f3f4f1]">
        {map}
        <MapTopBar
          zone={checks?.zone.zone ?? null}
          far={rules?.far ?? null}
          areaM2={geometry.areaM2}
        />
        <DrawingHint drawing={drawing} />
        <AnswerCard
          rules={rules}
          envelopeKind={shown?.kind ?? null}
          areaM2={geometry.areaM2}
          designs={designs}
          designsStale={designsStale}
          selected={selectedDesign}
          onSelect={setSelectedDesign}
          onOpenDetails={handleOpenDetails}
          detailsOpen={detailsOpen}
        />
        <DetailsDrawer
          open={detailsOpen}
          onClose={handleCloseDetails}
          design={design}
          rules={rules}
          view={view}
          onView={setView}
          road={road}
        />
        <MapTools
          map={mapInstance}
          layers={layers}
          onLayers={setLayers}
          onView3d={handleView3d}
          onReset={handleReset}
          panel={panel}
          onPanel={setPanel}
        />
        <MapDock
          buildingType={inputs.buildingType}
          roadWidthM={inputs.roadWidthM}
          roadName={inputs.roadName}
          drawing={drawing}
          onBuildingType={site.handleBuildingType}
          onRoadWidth={site.handleRoadWidth}
          onDrawToggle={site.handleDrawToggle}
        />
      </main>
    </TooltipProvider>
  );
}
