import { useCallback, useState } from "react";
import type { Feature, Polygon } from "geojson";
import type { PlotChangeKind } from "@/components/map-view";
import { FRAME, type SiteInputs } from "@/hooks/use-analysis";
import { plotRing, ringEdges, type Edge } from "@/lib/local-frame";
import type { BuildingType } from "@/lib/rules";
import { SAMPLE_FRONTAGE_EDGE, SAMPLE_PLOT } from "@/lib/sample-plot";
import { guessFrontage, MAIN_ROAD_WIDTH_M, roadForEdge, type SiteData } from "@/lib/site";

export const INITIAL_INPUTS: SiteInputs = {
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
  const length = old.lengthM || 1;
  const ux = (old.b[0] - old.a[0]) / length;
  const uy = (old.b[1] - old.a[1]) / length;
  const offset = (p: [number, number]) => Math.abs((p[0] - old.a[0]) * uy - (p[1] - old.a[1]) * ux);
  const onOldLine = (e: Edge) => offset(e.a) < 1 && offset(e.b) < 1;
  const candidates = edges.filter(onOldLine).sort((a, b) => b.lengthM - a.lengthM);
  return candidates[0]?.index ?? null;
}

/** The user's inputs (plot, road, building type) and the handlers that change them. */
export function useSiteInputs(data: SiteData | null) {
  const [inputs, setInputs] = useState<SiteInputs>(INITIAL_INPUTS);
  const [drawing, setDrawing] = useState(false);

  const handlePlotChange = useCallback(
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
        const guess = guessFrontage(plot, data.roads, FRAME);
        return {
          ...prev,
          plot,
          frontageEdge: guess.edge,
          roadName: guess.roadName,
          roadWidthM: guess.defaultWidthM,
        };
      });
    },
    [data],
  );

  // Stable handlers (useCallback), so memoised cards and panels that take them do
  // not re-render on every frame of a drag.
  const handleFrontageEdge = useCallback(
    (edge: number) => {
      if (!data) return;
      setInputs((prev) => {
        const road = roadForEdge(prev.plot, edge, data.roads, FRAME);
        return {
          ...prev,
          frontageEdge: edge,
          roadName: road.roadName,
          roadWidthM: road.defaultWidthM,
        };
      });
    },
    [data],
  );
  const handleRoadWidth = useCallback(
    (roadWidthM: number) => setInputs((prev) => ({ ...prev, roadWidthM })),
    [],
  );
  const handleBuildingType = useCallback(
    (buildingType: BuildingType) => setInputs((prev) => ({ ...prev, buildingType })),
    [],
  );
  const handleDrawToggle = useCallback(() => setDrawing((isDrawing) => !isDrawing), []);
  const handleDrawingEnd = useCallback(() => setDrawing(false), []);
  const resetInputs = useCallback(() => {
    setDrawing(false);
    setInputs(INITIAL_INPUTS);
  }, []);

  return {
    inputs,
    drawing,
    handlePlotChange,
    handleFrontageEdge,
    handleRoadWidth,
    handleBuildingType,
    handleDrawToggle,
    handleDrawingEnd,
    resetInputs,
  };
}
