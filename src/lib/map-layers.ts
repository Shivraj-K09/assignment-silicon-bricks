/**
 * MapLibre sources and layers for the site, one function per group, plus small
 * helpers to update them. No React here: map-view.tsx calls these.
 */
import * as maplibregl from "maplibre-gl";
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from "geojson";
import type { MultiPolygon as PcMultiPolygon } from "polygon-clipping";
import { COLOURS } from "./colours.ts";
import { edgeLabelPoint } from "./edge-picking.ts";
import type { Edge, Frame } from "./local-frame.ts";
import { DATA_AREA_POLYGON, type RoadCrossing, type SiteData } from "./site.ts";

/** Free vector basemap, no API key. */
export const BASEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

const ZONE_COLOURS: Record<string, string> = {
  residential_low: "#f5d76e",
  residential_medium: "#f0a54a",
  residential_high: "#a0522d",
  commercial: "#d9534f",
  industrial: "#9b59b6",
  warehouse: "#8e7cc3",
  agriculture: "#6aa84f",
  conservation: "#c8a2c8",
};

/** Layer ids the rest of the app refers to. */
export const LAYER = {
  buildingsReal: "buildings-real",
  buildingsEstimated: "buildings-estimated",
  buildingsDemolished: "buildings-demolished",
  buildable: "buildable-line",
  roadCrossings: "road-crossings-line",
  frontage: "frontage-line",
  edgeLabels: "edge-labels",
} as const;

export function featureCollection<G extends Geometry>(
  features: Feature<G>[],
): FeatureCollection<G> {
  return { type: "FeatureCollection", features };
}

function setSourceData(map: maplibregl.Map, sourceId: string, data: FeatureCollection) {
  (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(data);
}

/** First symbol (label) layer of the basemap: our layers go below it, so labels stay on top. */
export function firstLabelLayerId(map: maplibregl.Map): string | undefined {
  return map.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
}

/** The basemap's flat building footprints would double up with our 3D buildings. */
export function hideBasemapBuildings(map: maplibregl.Map) {
  for (const layer of map.getStyle().layers) {
    if (layer.id.includes("building")) map.setLayoutProperty(layer.id, "visibility", "none");
  }
}

/** 2013 Comprehensive Plan zones: tint, dashed borders and zone labels. */
export function addZoningLayers(
  map: maplibregl.Map,
  zoning: SiteData["zoning"],
  beforeId?: string,
) {
  map.addSource("zoning", { type: "geojson", data: zoning });
  const zoneColour = [
    "match",
    ["get", "category"],
    ...Object.entries(ZONE_COLOURS).flat(),
    "#cccccc",
  ] as unknown as maplibregl.ExpressionSpecification;
  map.addLayer(
    {
      id: "zoning-fill",
      type: "fill",
      source: "zoning",
      paint: { "fill-color": zoneColour, "fill-opacity": 0.12 },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: "zoning-line",
      type: "line",
      source: "zoning",
      paint: { "line-color": "#7a5230", "line-width": 1.2, "line-dasharray": [3, 2] },
    },
    beforeId,
  );
  map.addLayer({
    id: "zoning-label",
    type: "symbol",
    source: "zoning",
    layout: { "text-field": ["get", "zone"], "text-font": ["Noto Sans Regular"], "text-size": 13 },
    paint: { "text-color": "#7a5230", "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
  });
}

/** Lines drawn on the plot: the setback line, public roads through it, the road edge. */
export function addPlotOverlayLayers(map: maplibregl.Map, beforeId?: string) {
  map.addSource("buildable", { type: "geojson", data: featureCollection([]) });
  map.addLayer(
    {
      id: LAYER.buildable,
      type: "line",
      source: "buildable",
      paint: { "line-color": COLOURS.envelope, "line-width": 2, "line-dasharray": [2, 1.5] },
    },
    beforeId,
  );
  map.addSource("road-crossings", { type: "geojson", data: featureCollection([]) });
  map.addLayer(
    {
      id: LAYER.roadCrossings,
      type: "line",
      source: "road-crossings",
      layout: { "line-cap": "round" },
      paint: { "line-color": COLOURS.colliding, "line-width": 7, "line-opacity": 0.85 },
    },
    beforeId,
  );
  map.addSource("frontage", { type: "geojson", data: featureCollection([]) });
  map.addLayer(
    {
      id: LAYER.frontage,
      type: "line",
      source: "frontage",
      layout: { "line-cap": "round" },
      paint: { "line-color": COLOURS.frontage, "line-width": 6 },
    },
    beforeId,
  );
}

/** Feature-state "colliding" → red. */
function buildingColour(base: string): maplibregl.ExpressionSpecification {
  return ["case", ["boolean", ["feature-state", "colliding"], false], COLOURS.colliding, base];
}

const isEstimated: maplibregl.ExpressionSpecification = [
  "==",
  ["get", "heightSource"],
  "estimated",
];
const isMeasured: maplibregl.ExpressionSpecification = ["!=", ["get", "heightSource"], "estimated"];

/**
 * Existing buildings in 3D: measured heights darker, estimated lighter, red when
 * the plot line cuts them (feature-state). Demolished ones get a dashed outline.
 */
export function addBuildingLayers(
  map: maplibregl.Map,
  buildings: SiteData["buildings"],
  beforeId?: string,
) {
  map.addSource("buildings", { type: "geojson", data: buildings });
  map.addLayer(
    {
      id: LAYER.buildingsReal,
      type: "fill-extrusion",
      source: "buildings",
      filter: isMeasured,
      paint: {
        "fill-extrusion-color": buildingColour(COLOURS.realHeight),
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-opacity": 0.95,
      },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: LAYER.buildingsEstimated,
      type: "fill-extrusion",
      source: "buildings",
      filter: isEstimated,
      paint: {
        "fill-extrusion-color": buildingColour(COLOURS.estimatedHeight),
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-opacity": 0.85,
      },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: LAYER.buildingsDemolished,
      type: "line",
      source: "buildings",
      paint: {
        "line-color": COLOURS.demolished,
        "line-width": 1.5,
        "line-dasharray": [2, 2],
        "line-opacity": ["case", ["boolean", ["feature-state", "onPlot"], false], 1, 0],
      },
    },
    beforeId,
  );
}

/** Edge of the area our OSM extract covers: outside it there are no buildings or roads. */
export function addDataAreaLayer(map: maplibregl.Map, beforeId?: string) {
  map.addSource("data-area", { type: "geojson", data: DATA_AREA_POLYGON });
  map.addLayer(
    {
      id: "data-area-line",
      type: "line",
      source: "data-area",
      paint: { "line-color": COLOURS.dataArea, "line-width": 2, "line-dasharray": [4, 3] },
    },
    beforeId,
  );
}

/** Numbers next to each plot edge; the road edge's number in orange. */
export function addEdgeLabelLayer(map: maplibregl.Map) {
  map.addSource("edge-labels", { type: "geojson", data: featureCollection([]) });
  map.addLayer({
    id: LAYER.edgeLabels,
    type: "symbol",
    source: "edge-labels",
    layout: {
      "text-field": ["get", "label"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 13,
      "text-allow-overlap": true,
    },
    paint: {
      "text-color": ["case", ["get", "frontage"], COLOURS.frontage, COLOURS.plot],
      "text-halo-color": "#ffffff",
      "text-halo-width": 2,
    },
  });
}

/** terra-draw adds its layers on top; keep the road edge and edge numbers above them. */
export function raisePlotOverlays(map: maplibregl.Map) {
  map.moveLayer(LAYER.frontage);
  map.moveLayer(LAYER.edgeLabels);
  map.moveLayer(LAYER.roadCrossings, LAYER.frontage);
}

// ---- Updates ------------------------------------------------------------------------------

export function showFrontage(
  map: maplibregl.Map,
  frame: Frame,
  edges: Edge[],
  frontageEdge: number,
) {
  const front = edges[frontageEdge];
  const line: Feature[] = front
    ? [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [frame.toLngLat(front.a), frame.toLngLat(front.b)],
          },
        },
      ]
    : [];
  setSourceData(map, "frontage", featureCollection(line));

  const labels: Feature[] = edges.map((edge) => ({
    type: "Feature",
    properties: { label: String(edge.index + 1), frontage: edge.index === frontageEdge },
    geometry: { type: "Point", coordinates: frame.toLngLat(edgeLabelPoint(edge, edges)) },
  }));
  setSourceData(map, "edge-labels", featureCollection(labels));
}

export function showRoadCrossings(map: maplibregl.Map, crossings: RoadCrossing[]) {
  setSourceData(map, "road-crossings", featureCollection(crossings.flatMap((c) => c.pieces)));
}

/** The setback line: outline of the buildable footprint, converted to lon/lat. */
export function showBuildableOutline(map: maplibregl.Map, frame: Frame, footprint: PcMultiPolygon) {
  const geometry: MultiPolygon = {
    type: "MultiPolygon",
    coordinates: footprint.map((polygon) =>
      polygon.map((ring) => ring.map((point) => frame.toLngLat(point as [number, number]))),
    ),
  };
  setSourceData(
    map,
    "buildable",
    featureCollection([{ type: "Feature", properties: {}, geometry }]),
  );
}

/** Leave demolished buildings out of the 3D layers (their dashed outline stays). */
export function hideDemolishedBuildings(map: maplibregl.Map, demolishedIds: number[]) {
  const notDemolished: maplibregl.ExpressionSpecification = [
    "!",
    ["in", ["id"], ["literal", demolishedIds]],
  ];
  map.setFilter(LAYER.buildingsReal, ["all", isMeasured, notDemolished]);
  map.setFilter(LAYER.buildingsEstimated, ["all", isEstimated, notDemolished]);
}

export function setLayerVisible(map: maplibregl.Map, layerId: string, visible: boolean) {
  map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
}

export function toPlotFeature(geometry: Polygon): Feature<Polygon> {
  return { type: "Feature", properties: {}, geometry };
}
