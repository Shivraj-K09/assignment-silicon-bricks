import { useCallback, useState } from "react";
import type { Feature, Polygon } from "geojson";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import InputsPanel from "@/components/inputs-panel";
import MapLegend from "@/components/map-legend";
import MapView, { type PlotChangeKind } from "@/components/map-view";
import PlotCheckBadge, { RoadCrossingBadge } from "@/components/plot-check-badge";
import EnvelopePanel from "@/components/envelope-panel";
import MapControls, { DEFAULT_LAYERS, type MapLayers } from "@/components/map-controls";
import RulesPanel from "@/components/rules-panel";
import {
  DEFAULT_VIEW,
  FRAME,
  useAnalysis,
  type EnvelopeView,
  type SiteInputs,
} from "@/hooks/use-analysis";
import { useSiteData } from "@/hooks/use-site-data";
import { plotRing, ringEdges, type Edge } from "@/lib/local-frame";
import { SAMPLE_FRONTAGE_EDGE, SAMPLE_PLOT } from "@/lib/sample-plot";
import { guessFrontage, MAIN_ROAD_WIDTH_M, roadForEdge } from "@/lib/site";

const INITIAL: SiteInputs = {
  plot: SAMPLE_PLOT,
  frontageEdge: SAMPLE_FRONTAGE_EDGE,
  roadName: "Thong Lo (Sukhumvit Soi 55)",
  roadWidthM: MAIN_ROAD_WIDTH_M,
  buildingType: "condo",
};

/**
 * After corners are added or removed the edges are renumbered, so find the new
 * edge lying on the old frontage line (the longest one if it was split).
 */
function matchFrontage(old: Edge, edges: Edge[]): number | null {
  const len = old.lengthM || 1;
  const ux = (old.b[0] - old.a[0]) / len;
  const uy = (old.b[1] - old.a[1]) / len;
  const off = (p: [number, number]) => Math.abs((p[0] - old.a[0]) * uy - (p[1] - old.a[1]) * ux);
  const along = (e: Edge) => edges.indexOf(e) >= 0 && off(e.a) < 1 && off(e.b) < 1;
  const candidates = edges.filter(along).sort((a, b) => b.lengthM - a.lengthM);
  return candidates[0]?.index ?? null;
}

export default function App() {
  const { data, error } = useSiteData();
  const [inputs, setInputs] = useState<SiteInputs>(INITIAL);
  const [drawing, setDrawing] = useState(false);
  const [view, setView] = useState<EnvelopeView>(DEFAULT_VIEW);
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_LAYERS);
  const analysis = useAnalysis(data, inputs, view);
  const { geometry, site, rules, envelope, shown } = analysis;

  const onPlotChange = useCallback(
    (plot: Feature<Polygon>, kind: PlotChangeKind) => {
      setInputs((prev) => {
        const prevEdges = ringEdges(plotRing(prev.plot, FRAME));
        const edges = ringEdges(plotRing(plot, FRAME));
        if (kind === "edit" && edges.length === prevEdges.length) return { ...prev, plot };
        if (kind === "edit") {
          const kept = matchFrontage(prevEdges[prev.frontageEdge], edges);
          if (kept !== null) return { ...prev, plot, frontageEdge: kept };
        }
        if (!data) return { ...prev, plot, frontageEdge: 0 };
        const g = guessFrontage(plot, data.roads, FRAME);
        return {
          ...prev,
          plot,
          frontageEdge: g.edge,
          roadName: g.roadName,
          roadWidthM: g.defaultWidthM,
        };
      });
    },
    [data],
  );

  const onFrontageEdge = (edge: number) => {
    if (!data) return;
    const r = roadForEdge(inputs.plot, edge, data.roads, FRAME);
    setInputs((prev) => ({
      ...prev,
      frontageEdge: edge,
      roadName: r.roadName,
      roadWidthM: r.defaultWidthM,
    }));
  };

  return (
    <TooltipProvider>
      <div className="bg-background text-foreground flex h-dvh flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
          <h1 className="text-sm font-semibold">Bangkok Plot Tool</h1>
          <Badge variant="secondary">
            Thong Lo · {site?.zone.zone ?? "…"}
            {rules && rules.far ? ` · FAR ${rules.far}` : ""}
          </Badge>
          <PlotCheckBadge overlaps={site?.overlaps ?? null} coverage={geometry.coverage} />
          <RoadCrossingBadge crossings={site?.roadCrossings ?? []} />
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <main className="relative h-[55dvh] shrink-0 md:order-2 md:h-auto md:flex-1">
            {data ? (
              <MapView
                data={data}
                frame={FRAME}
                plot={inputs.plot}
                edges={geometry.edges}
                frontageEdge={inputs.frontageEdge}
                overlaps={site?.overlaps ?? []}
                roadCrossings={site?.roadCrossings ?? []}
                envelope={envelope}
                drawing={drawing}
                onPlotChange={onPlotChange}
                onDrawingEnd={() => setDrawing(false)}
                onEdgeClick={onFrontageEdge}
                layers={layers}
              />
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                {error ? `Could not load the site data: ${error}` : "Loading Thong Lo site data…"}
              </div>
            )}
            <MapControls layers={layers} onLayers={setLayers} />
            <MapLegend />
          </main>

          <aside className="bg-muted/30 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto border-t p-3 *:shrink-0 md:order-1 md:w-95 md:flex-none md:border-t-0 md:border-r">
            <InputsPanel
              areaM2={geometry.areaM2}
              edges={geometry.edges}
              frontageEdge={inputs.frontageEdge}
              roadName={inputs.roadName}
              roadWidthM={inputs.roadWidthM}
              buildingType={inputs.buildingType}
              drawing={drawing}
              selfCrossing={geometry.selfCrossing}
              demolishedCount={
                site ? site.overlaps.filter((o) => o.status === "on-plot").length : null
              }
              coverage={geometry.coverage}
              roadCrossings={site?.roadCrossings ?? []}
              onDrawToggle={() => setDrawing((d) => !d)}
              onReset={() => {
                setDrawing(false);
                setInputs(INITIAL);
                setView(DEFAULT_VIEW);
              }}
              onFrontageEdge={onFrontageEdge}
              onRoadWidth={(m) => setInputs((prev) => ({ ...prev, roadWidthM: m }))}
              onBuildingType={(t) => setInputs((prev) => ({ ...prev, buildingType: t }))}
            />
            {rules && (
              <>
                {shown && (
                  <EnvelopePanel rules={rules} shown={shown} view={view} onView={setView} />
                )}
                <RulesPanel rules={rules} />
              </>
            )}
          </aside>
        </div>
      </div>
    </TooltipProvider>
  );
}
