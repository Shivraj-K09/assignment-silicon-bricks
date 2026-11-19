import {
  bbox,
  booleanIntersects,
  booleanPointInPolygon,
  centroid,
  distance,
  length,
  lineSplit,
  nearestPointOnLine,
  point,
  polygonToLine,
} from "@turf/turf";
import type { Feature, FeatureCollection, LineString, MultiPolygon, Point, Polygon } from "geojson";
import { plotRing, ringEdges, type Frame } from "./local-frame.ts";

export type ZoneFeature = Feature<Polygon | MultiPolygon, { zone: string; category: string }>;
export type RoadFeature = Feature<
  LineString,
  { name: string | null; nameEn: string | null; highway: string; width: number | null }
>;
export type PlannedRoadFeature = Feature<
  LineString,
  { code: string; widthM: number; name: string }
>;
export type StationFeature = Feature<Point, { name: string | null; network: string | null }>;

export interface SiteData {
  zoning: FeatureCollection<Polygon | MultiPolygon, ZoneFeature["properties"]>;
  buildings: FeatureCollection<Polygon>;
  roads: FeatureCollection<LineString, RoadFeature["properties"]>;
  plannedRoads: FeatureCollection<LineString, PlannedRoadFeature["properties"]>;
  stations: FeatureCollection<Point, StationFeature["properties"]>;
}

/**
 * The box our OpenStreetMap buildings and roads extract covers
 * (scripts/fetch-osm.mjs): [west, south, east, north]. Outside it the map has no
 * neighbouring buildings or roads, so the building check and road detection fail.
 */
export const DATA_AREA: [number, number, number, number] = [100.576, 13.73, 100.59, 13.745];

export const DATA_AREA_POLYGON: Feature<Polygon> = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [DATA_AREA[0], DATA_AREA[1]],
        [DATA_AREA[2], DATA_AREA[1]],
        [DATA_AREA[2], DATA_AREA[3]],
        [DATA_AREA[0], DATA_AREA[3]],
        [DATA_AREA[0], DATA_AREA[1]],
      ],
    ],
  },
};

export type DataCoverage = "inside" | "partly" | "outside";

/** Is the plot inside the area with building and road data? */
export function dataCoverage(plot: Feature<Polygon>): DataCoverage {
  const [w, s, e, n] = DATA_AREA;
  const pts = plot.geometry.coordinates[0];
  const inside = pts.filter(([x, y]) => x >= w && x <= e && y >= s && y <= n).length;
  if (inside === pts.length) return "inside";
  return booleanIntersects(plot, DATA_AREA_POLYGON) ? "partly" : "outside";
}

const boxesTouch = (a: number[], b: number[]) =>
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

export interface ZoneInfo {
  /** Zone at the plot's centre, e.g. "ย.9". Null if outside the zoning map. */
  zone: string | null;
  /** Every zone the plot touches. More than one means the plot crosses a zone line. */
  touched: string[];
}

export function findZone(plot: Feature<Polygon>, zoning: SiteData["zoning"]): ZoneInfo {
  const box = bbox(plot);
  const c = centroid(plot);
  const near = zoning.features.filter((z) => boxesTouch(box, bbox(z)));
  const home = near.find((z) => booleanPointInPolygon(c, z));
  const touched = [
    ...new Set(near.filter((z) => booleanIntersects(z, plot)).map((z) => z.properties.zone)),
  ];
  return { zone: home?.properties.zone ?? null, touched };
}

/** Road classes that are public roads a plot can front onto. */
const PUBLIC_ROADS: Record<string, number> = {
  primary: 0,
  secondary: 1,
  tertiary: 2,
  unclassified: 3,
  residential: 3,
  living_street: 4,
};

export interface FrontageGuess {
  edge: number;
  roadName: string;
  /** True for a main road (secondary or above), false for a soi. */
  isMainRoad: boolean;
  /** Default legal width for the road: 25 m for Thong Lo / main roads, 8 m for a soi. */
  defaultWidthM: number;
}

/** Thong Lo's legal width (Thai Wikipedia: widened to 25 m). Sois default to 8 m. */
export const MAIN_ROAD_WIDTH_M = 25;
export const SOI_WIDTH_M = 8;

/**
 * Guesses which plot edge faces a public road: the edge whose midpoint is closest
 * to a public road, preferring bigger roads when distances are similar.
 */
export function guessFrontage(
  plot: Feature<Polygon>,
  roads: SiteData["roads"],
  frame: Frame,
): FrontageGuess {
  const edges = ringEdges(plotRing(plot, frame));
  const box = bbox(plot);
  const pad = 0.0005; // ~50 m
  const near = roads.features.filter(
    (r) =>
      r.properties.highway in PUBLIC_ROADS &&
      boxesTouch([box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad], bbox(r)),
  );

  let best: { score: number; edge: number; road: RoadFeature | null } = {
    score: Infinity,
    edge: 0,
    road: null,
  };
  for (const e of edges) {
    if (e.lengthM < 3) continue;
    const mid = point(frame.toLngLat([(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2]));
    for (const r of near) {
      const d = distance(mid, nearestPointOnLine(r, mid), { units: "meters" });
      // A bigger road wins over a soi up to ~10 m further away.
      const score = d + PUBLIC_ROADS[r.properties.highway] * 5 - Math.min(e.lengthM, 40) / 10;
      if (score < best.score) best = { score, edge: e.index, road: r };
    }
  }
  const isMainRoad = best.road ? PUBLIC_ROADS[best.road.properties.highway] <= 1 : false;
  const name = best.road?.properties.nameEn ?? best.road?.properties.name ?? "Unnamed road";
  return {
    edge: best.edge,
    roadName: name === "Soi Sukhumvit 55" ? "Thong Lo (Sukhumvit Soi 55)" : name,
    isMainRoad,
    defaultWidthM: isMainRoad ? MAIN_ROAD_WIDTH_M : SOI_WIDTH_M,
  };
}

/** The public road nearest to one plot edge, with its default legal width. */
export function roadForEdge(
  plot: Feature<Polygon>,
  edge: number,
  roads: SiteData["roads"],
  frame: Frame,
): Omit<FrontageGuess, "edge"> & { distanceM: number } {
  const e = ringEdges(plotRing(plot, frame))[edge];
  const mid = point(frame.toLngLat([(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2]));
  let best: { d: number; road: RoadFeature | null } = { d: Infinity, road: null };
  for (const r of roads.features) {
    if (!(r.properties.highway in PUBLIC_ROADS)) continue;
    const d = distance(mid, nearestPointOnLine(r, mid), { units: "meters" });
    if (d < best.d) best = { d, road: r };
  }
  const isMainRoad = best.road ? PUBLIC_ROADS[best.road.properties.highway] <= 1 : false;
  const name = best.road?.properties.nameEn ?? best.road?.properties.name ?? "Unnamed road";
  return {
    roadName: name === "Soi Sukhumvit 55" ? "Thong Lo (Sukhumvit Soi 55)" : name,
    isMainRoad,
    defaultWidthM: isMainRoad ? MAIN_ROAD_WIDTH_M : SOI_WIDTH_M,
    distanceM: best.d,
  };
}

export interface NearestStation {
  name: string;
  distanceM: number;
}

export function nearestStation(
  plot: Feature<Polygon>,
  stations: SiteData["stations"],
): NearestStation | null {
  const c = centroid(plot);
  let best: NearestStation | null = null;
  for (const s of stations.features) {
    const d = distance(c, s, { units: "meters" });
    if (!best || d < best.distanceM) best = { name: s.properties.name ?? "Station", distanceM: d };
  }
  return best;
}

/** Planned road-widening lines (Comprehensive Plan, roads ก/ข) within 15 m of the frontage edge. */
export function plannedRoadsNearFrontage(
  plot: Feature<Polygon>,
  frontageEdge: number,
  plannedRoads: SiteData["plannedRoads"],
  frame: Frame,
): PlannedRoadFeature[] {
  const e = ringEdges(plotRing(plot, frame))[frontageEdge];
  if (!e) return [];
  const a = point(frame.toLngLat(e.a));
  const b = point(frame.toLngLat(e.b));
  return plannedRoads.features.filter((r) => {
    const da = distance(a, nearestPointOnLine(r, a), { units: "meters" });
    const db = distance(b, nearestPointOnLine(r, b), { units: "meters" });
    return da < 15 && db < 15;
  });
}

export interface RoadCrossing {
  name: string;
  highway: string;
  /** Length of the road centreline inside the plot, m. */
  insideM: number;
  /** The road pieces that lie inside the plot, for drawing. */
  pieces: Feature<LineString>[];
}

/** A road must run at least this far inside the plot to count (ignores touching corners). */
export const ROAD_CROSSING_MIN_M = 2;

/**
 * Public roads whose centreline runs through the plot. A plot cannot include a
 * public road, so this flags a plot drawn across a street. Private driveways
 * (OSM "service") are not public roads and are ignored: they belong to the site.
 * Limit: OSM gives centrelines only, so a plot pushed partly into a road
 * without reaching its centreline is not caught.
 */
export function findCrossingRoads(
  plot: Feature<Polygon>,
  roads: SiteData["roads"],
): RoadCrossing[] {
  const box = bbox(plot);
  const outline = polygonToLine(plot) as Feature<LineString>;
  const byName = new Map<string, RoadCrossing>();

  for (const r of roads.features) {
    if (!(r.properties.highway in PUBLIC_ROADS)) continue;
    if (!boxesTouch(box, bbox(r)) || !booleanIntersects(r, plot)) continue;

    const pieces = lineSplit(r, outline).features;
    const inside = (pieces.length ? pieces : [r]).filter((p) => {
      const c = p.geometry.coordinates;
      const mid =
        c.length > 2
          ? c[Math.floor(c.length / 2)]
          : [(c[0][0] + c[1][0]) / 2, (c[0][1] + c[1][1]) / 2];
      return booleanPointInPolygon(point(mid), plot, { ignoreBoundary: true });
    });
    const insideM = inside.reduce((s, p) => s + length(p, { units: "meters" }), 0);
    if (insideM < ROAD_CROSSING_MIN_M) continue;

    const name = r.properties.nameEn ?? r.properties.name ?? `Unnamed ${r.properties.highway} road`;
    const shown = name === "Soi Sukhumvit 55" ? "Thong Lo (Sukhumvit Soi 55)" : name;
    const prev = byName.get(shown);
    if (prev) {
      prev.insideM += insideM;
      prev.pieces.push(...inside);
    } else {
      byName.set(shown, { name: shown, highway: r.properties.highway, insideM, pieces: inside });
    }
  }
  return [...byName.values()];
}
