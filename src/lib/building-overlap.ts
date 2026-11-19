import { area, bbox, booleanIntersects, featureCollection, intersect } from "@turf/turf";
import type { Feature, FeatureCollection, Polygon } from "geojson";

// The logic behind that label from the @plot-check-badge.tsx file
/**
 * How an existing building relates to the plot:
 * - "on-plot":   (almost) entirely inside. It is demolished: the designs replace it.
 * - "colliding": the plot boundary cuts through it. A real plot line does not run
 *                through someone else's building, so this flags a plot drawn wrongly.
 * - "outside":   does not touch the plot (or only within the tolerance).
 */
export type OverlapStatus = "on-plot" | "colliding" | "outside";

/**
 * A building at least this share inside the plot counts as on the plot. Not 100%:
 * OSM outlines are traced from imagery and often overhang the road edge by a
 * metre or two, which is not a neighbour's land.
 */
export const ON_PLOT_SHARE = 0.9;
/** Overlaps smaller than this (m²) are drawing noise, not a collision. */
export const OVERLAP_TOLERANCE_M2 = 1;

export interface BuildingOverlap {
  feature: Feature<Polygon>;
  status: OverlapStatus;
  /** Area of the building inside the plot, m². */
  overlapM2: number;
  /** Share of the building's footprint inside the plot, 0..1. */
  share: number;
}

const boxesTouch = (a: number[], b: number[]) =>
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

/**
 * Classifies every building against the plot. Only buildings whose bounding box
 * touches the plot's are measured, so this stays fast with thousands of buildings.
 * Returns only buildings that are on the plot or colliding.
 */
export function findBuildingOverlaps(
  plot: Feature<Polygon>,
  buildings: FeatureCollection<Polygon>,
): BuildingOverlap[] {
  const plotBox = bbox(plot);
  const result: BuildingOverlap[] = [];

  for (const feature of buildings.features) {
    if (!boxesTouch(plotBox, bbox(feature))) continue;
    if (!booleanIntersects(feature, plot)) continue;

    const shared = intersect(featureCollection([feature, plot]));
    const overlapM2 = shared ? area(shared) : 0;
    if (overlapM2 < OVERLAP_TOLERANCE_M2) continue;

    const share = overlapM2 / area(feature);
    result.push({
      feature,
      status: share >= ON_PLOT_SHARE ? "on-plot" : "colliding",
      overlapM2,
      share,
    });
  }
  return result;
}
