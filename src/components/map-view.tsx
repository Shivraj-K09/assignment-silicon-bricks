import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import * as THREE from "three";
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { MapLayers } from "@/components/map-controls";
import type { BuildingOverlap } from "@/lib/building-overlap";
import { USE_COLOURS } from "@/components/design-panel";
import type { Design, Use } from "@/lib/designs";
import type { Envelope } from "@/lib/envelope";
import { designMassing } from "@/lib/massing";
import { signedArea, type Edge, type Frame } from "@/lib/local-frame";
import { DATA_AREA_POLYGON, type RoadCrossing, type SiteData } from "@/lib/site";
import { createThreeLayer } from "@/lib/three-layer";

// Worker file is copied into public/ by scripts/setup-map-worker.mjs
// (Vite's ?url import fails because the project path contains "#").
maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

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

export const COLOURS = {
  plot: "#2563eb",
  frontage: "#f97316",
  envelope: "#0d9488",
  colliding: "#dc2626",
  realHeight: "#6b7280",
  estimatedHeight: "#d6d3cc",
  demolished: "#57534e",
  dataArea: "#7c3aed",
} as const;

const PLOT_ID = "plot";

export type PlotChangeKind = "edit" | "new";

interface MapViewProps {
  data: SiteData;
  frame: Frame;
  plot: Feature<Polygon>;
  edges: Edge[];
  frontageEdge: number;
  overlaps: BuildingOverlap[];
  roadCrossings: RoadCrossing[];
  envelope: Envelope | null;
  drawing: boolean;
  onPlotChange: (plot: Feature<Polygon>, kind: PlotChangeKind) => void;
  onDrawingEnd: () => void;
  /** A plot edge was clicked or tapped: make it the road side. */
  onEdgeClick: (edge: number) => void;
  layers: MapLayers;
  /** The concept design to draw as massing, or null. */
  design: Design | null;
}

const fc = <G extends GeoJSON.Geometry>(features: Feature<G>[]): FeatureCollection<G> => ({
  type: "FeatureCollection",
  features,
});
const geomKey = (p: Feature<Polygon>) => JSON.stringify(p.geometry.coordinates);

export default function MapView(props: MapViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const threeRef = useRef<ReturnType<typeof createThreeLayer> | null>(null);
  const envGroupRef = useRef<THREE.Group | null>(null);
  const designGroupRef = useRef<THREE.Group | null>(null);
  /** Geometry terra-draw currently holds, to tell our own edits from outside changes. */
  const syncedRef = useRef<string>("");
  const syncPlot = useRef<(plot: Feature<Polygon>) => void>(() => {});
  const markedRef = useRef<{ onPlot: Set<number>; colliding: Set<number> }>({
    onPlot: new Set(),
    colliding: new Set(),
  });
  // Latest props for the event handlers set up once in the init effect.
  const latest = useRef(props);
  latest.current = props;
  const [ready, setReady] = useState(false);

  // ---- Create the map once -----------------------------------------------------
  useEffect(() => {
    const { data, frame, plot } = latest.current;
    const map = new maplibregl.Map({
      container: container.current!,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: frame.origin,
      zoom: 17,
      pitch: 55,
      bearing: -20,
      maxPitch: 80,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

    function setPlotInDraw(draw: TerraDraw, next: Feature<Polygon>) {
      if (draw.hasFeature(PLOT_ID)) draw.removeFeatures([PLOT_ID]);
      draw.addFeatures([
        { id: PLOT_ID, type: "Feature", geometry: next.geometry, properties: { mode: "polygon" } },
      ]);
      draw.setMode("select");
      draw.selectFeature(PLOT_ID);
      syncedRef.current = geomKey(next);
    }
    syncPlot.current = (next) => drawRef.current && setPlotInDraw(drawRef.current, next);

    // "style.load", not "load": "load" waits for every basemap tile and can stall.
    map.once("style.load", () => {
      const firstSymbol = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
      // The basemap's flat building footprints would double up with our 3D ones.
      for (const l of map.getStyle().layers) {
        if (l.id.includes("building")) map.setLayoutProperty(l.id, "visibility", "none");
      }

      map.addSource("zoning", { type: "geojson", data: data.zoning });
      map.addLayer(
        {
          id: "zoning-fill",
          type: "fill",
          source: "zoning",
          paint: {
            "fill-color": [
              "match",
              ["get", "category"],
              ...Object.entries(ZONE_COLOURS).flat(),
              "#cccccc",
            ] as unknown as maplibregl.ExpressionSpecification,
            "fill-opacity": 0.12,
          },
        },
        firstSymbol,
      );
      map.addLayer(
        {
          id: "zoning-line",
          type: "line",
          source: "zoning",
          paint: { "line-color": "#7a5230", "line-width": 1.2, "line-dasharray": [3, 2] },
        },
        firstSymbol,
      );
      map.addLayer({
        id: "zoning-label",
        type: "symbol",
        source: "zoning",
        layout: {
          "text-field": ["get", "zone"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 13,
        },
        paint: { "text-color": "#7a5230", "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
      });

      // Setback line: the outline of the buildable area, on the ground.
      map.addSource("buildable", { type: "geojson", data: fc([]) });
      map.addLayer(
        {
          id: "buildable-line",
          type: "line",
          source: "buildable",
          paint: { "line-color": COLOURS.envelope, "line-width": 2, "line-dasharray": [2, 1.5] },
        },
        firstSymbol,
      );
      // Public roads running through the plot: a plot cannot include a public road.
      map.addSource("road-crossings", { type: "geojson", data: fc([]) });
      map.addLayer(
        {
          id: "road-crossings-line",
          type: "line",
          source: "road-crossings",
          layout: { "line-cap": "round" },
          paint: { "line-color": COLOURS.colliding, "line-width": 7, "line-opacity": 0.85 },
        },
        firstSymbol,
      );
      map.addSource("frontage", { type: "geojson", data: fc([]) });
      map.addLayer(
        {
          id: "frontage-line",
          type: "line",
          source: "frontage",
          layout: { "line-cap": "round" },
          paint: { "line-color": COLOURS.frontage, "line-width": 6 },
        },
        firstSymbol,
      );

      // Existing buildings. Those on the plot are flattened (demolished) and those
      // the plot line cuts are red, both through feature-state: no data re-upload.
      map.addSource("buildings", { type: "geojson", data: data.buildings });
      const height: maplibregl.ExpressionSpecification = [
        "case",
        ["boolean", ["feature-state", "onPlot"], false],
        0,
        ["get", "height"],
      ];
      const colour = (base: string): maplibregl.ExpressionSpecification => [
        "case",
        ["boolean", ["feature-state", "colliding"], false],
        COLOURS.colliding,
        base,
      ];
      map.addLayer(
        {
          id: "buildings-real",
          type: "fill-extrusion",
          source: "buildings",
          filter: ["!=", ["get", "heightSource"], "estimated"],
          paint: {
            "fill-extrusion-color": colour(COLOURS.realHeight),
            "fill-extrusion-height": height,
            "fill-extrusion-opacity": 0.95,
          },
        },
        firstSymbol,
      );
      map.addLayer(
        {
          id: "buildings-estimated",
          type: "fill-extrusion",
          source: "buildings",
          filter: ["==", ["get", "heightSource"], "estimated"],
          paint: {
            "fill-extrusion-color": colour(COLOURS.estimatedHeight),
            "fill-extrusion-height": height,
            "fill-extrusion-opacity": 0.85,
          },
        },
        firstSymbol,
      );
      // Buildings to be demolished: a dashed outline on the ground instead.
      map.addLayer(
        {
          id: "buildings-demolished",
          type: "line",
          source: "buildings",
          paint: {
            "line-color": COLOURS.demolished,
            "line-width": 1.5,
            "line-dasharray": [2, 2],
            "line-opacity": ["case", ["boolean", ["feature-state", "onPlot"], false], 1, 0],
          },
        },
        firstSymbol,
      );

      // Edge of the area our OSM extract covers: outside it there are no buildings or roads.
      map.addSource("data-area", { type: "geojson", data: DATA_AREA_POLYGON });
      map.addLayer(
        {
          id: "data-area-line",
          type: "line",
          source: "data-area",
          paint: { "line-color": COLOURS.dataArea, "line-width": 2, "line-dasharray": [4, 3] },
        },
        firstSymbol,
      );

      // Envelope, drawn by Three.js in the same depth buffer as the buildings.
      const three = createThreeLayer("three", frame.origin);
      threeRef.current = three;
      map.addLayer(three.layer, firstSymbol);

      map.addSource("edge-labels", { type: "geojson", data: fc([]) });
      map.addLayer({
        id: "edge-labels",
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

      // Plot drawing and editing.
      let nextId = 0;
      const draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map }),
        idStrategy: {
          isValidId: (id) => typeof id === "string",
          getId: () => `feature-${++nextId}`,
        },
        modes: [
          new TerraDrawSelectMode({
            // Corner grab radius. Default is 40 px, which would swallow clicks meant
            // to pick an edge as the road side; 24 px stays easy to hit with a finger.
            pointerDistance: TERRA_DRAW_POINTER_PX,
            flags: {
              polygon: {
                feature: {
                  draggable: true,
                  // No midpoint dots: they clash with clicking an edge to pick the
                  // road side. To change the number of corners, draw a new plot.
                  coordinates: { draggable: true, midpoints: false, deletable: true },
                },
              },
            },
            styles: {
              selectedPolygonColor: COLOURS.plot,
              selectedPolygonFillOpacity: 0.12,
              selectedPolygonOutlineColor: COLOURS.plot,
              selectedPolygonOutlineWidth: 2.5,
              selectionPointColor: "#ffffff",
              selectionPointOutlineColor: COLOURS.plot,
              selectionPointWidth: 6,
              selectionPointOutlineWidth: 2,
            },
          }),
          new TerraDrawPolygonMode({
            styles: {
              fillColor: COLOURS.plot,
              fillOpacity: 0.12,
              outlineColor: COLOURS.plot,
              outlineWidth: 2.5,
              closingPointColor: "#ffffff",
              closingPointOutlineColor: COLOURS.plot,
              closingPointWidth: 6,
            },
          }),
        ],
      });
      draw.start();
      // terra-draw adds its layers on top; keep the road edge and edge numbers above them.
      map.moveLayer("frontage-line");
      map.moveLayer("edge-labels");
      map.moveLayer("road-crossings-line", "frontage-line");
      drawRef.current = draw;
      setPlotInDraw(draw, plot);

      draw.on("change", (ids, type) => {
        if (type !== "update" || !ids.includes(PLOT_ID)) return;
        if (draw.getMode() !== "select") return;
        const f = draw.getSnapshotFeature(PLOT_ID);
        if (f?.geometry.type !== "Polygon") return;
        const next = toPlot(f.geometry as Polygon);
        syncedRef.current = geomKey(next);
        latest.current.onPlotChange(next, "edit");
      });
      // There is only ever one plot, so keep it selected: its corner handles must stay
      // draggable after a click elsewhere on the map (for example to pick an edge).
      draw.on("deselect", () => {
        if (draw.getMode() === "select" && draw.hasFeature(PLOT_ID)) {
          setTimeout(() => draw.hasFeature(PLOT_ID) && draw.selectFeature(PLOT_ID), 0);
        }
      });
      draw.on("finish", (id, ctx) => {
        if (ctx.mode !== "polygon") return;
        const f = draw.getSnapshotFeature(id);
        if (f?.geometry.type !== "Polygon") return;
        const next = toPlot(f.geometry as Polygon);
        draw.removeFeatures([id]);
        setPlotInDraw(draw, next);
        latest.current.onPlotChange(next, "new");
        latest.current.onDrawingEnd();
      });

      // Click or tap a plot edge to make it the edge facing the road.
      map.on("click", (e) => {
        const { edges, frame, drawing } = latest.current;
        if (drawing) return;
        const edge = nearestEdgePx(map, edges, frame, e.point, EDGE_CLICK_PX);
        if (edge !== null) latest.current.onEdgeClick(edge);
      });
      // Pointer cursor when hovering an edge, so it is clear edges can be clicked.
      map.on("mousemove", (e) => {
        const { edges, frame, drawing } = latest.current;
        if (drawing) return;
        const near = nearestEdgePx(map, edges, frame, e.point, EDGE_CLICK_PX) !== null;
        map.getCanvas().style.cursor = near ? "pointer" : "";
      });

      setReady(true);
    });

    return () => {
      drawRef.current?.stop();
      drawRef.current = null;
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // ---- Plot replaced from outside (reset to sample) ------------------------------
  useEffect(() => {
    if (!ready) return;
    if (geomKey(props.plot) !== syncedRef.current) syncPlot.current(props.plot);
  }, [ready, props.plot]);

  // ---- Drawing mode ----------------------------------------------------------------
  useEffect(() => {
    const draw = drawRef.current;
    if (!ready || !draw) return;
    if (props.drawing) {
      draw.setMode("polygon");
    } else if (draw.getMode() === "polygon") {
      draw.setMode("select");
      if (draw.hasFeature(PLOT_ID)) draw.selectFeature(PLOT_ID);
    }
  }, [ready, props.drawing]);

  // ---- Frontage edge and edge numbers -------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const { frame, edges, frontageEdge } = props;
    const front = edges[frontageEdge];
    (map.getSource("frontage") as maplibregl.GeoJSONSource).setData(
      fc(
        front
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
          : [],
      ),
    );
    (map.getSource("edge-labels") as maplibregl.GeoJSONSource).setData(
      fc(
        edges.map((e) => ({
          type: "Feature" as const,
          properties: { label: String(e.index + 1), frontage: e.index === frontageEdge },
          geometry: {
            type: "Point" as const,
            coordinates: frame.toLngLat(edgeLabelPoint(e, edges)),
          },
        })),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, props.edges, props.frontageEdge, props.frame]);

  // ---- Buildings on the plot / cut by the plot line ------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const next = { onPlot: new Set<number>(), colliding: new Set<number>() };
    for (const o of props.overlaps) {
      const id = o.feature.id as number;
      (o.status === "on-plot" ? next.onPlot : next.colliding).add(id);
    }
    const prev = markedRef.current;
    const set = (id: number, state: Record<string, boolean>) =>
      map.setFeatureState({ source: "buildings", id }, state);
    for (const id of prev.onPlot) if (!next.onPlot.has(id)) set(id, { onPlot: false });
    for (const id of prev.colliding) if (!next.colliding.has(id)) set(id, { colliding: false });
    for (const id of next.onPlot) if (!prev.onPlot.has(id)) set(id, { onPlot: true });
    for (const id of next.colliding) if (!prev.colliding.has(id)) set(id, { colliding: true });

    // Demolished buildings are left out of the 3D layers (only their dashed outline
    // stays). Re-filtered only when the set changes, not on every drag step.
    const sameOnPlot =
      prev.onPlot.size === next.onPlot.size && [...next.onPlot].every((id) => prev.onPlot.has(id));
    if (!sameOnPlot) {
      const notDemolished: maplibregl.ExpressionSpecification = [
        "!",
        ["in", ["id"], ["literal", [...next.onPlot]]],
      ];
      map.setFilter("buildings-real", [
        "all",
        ["!=", ["get", "heightSource"], "estimated"],
        notDemolished,
      ]);
      map.setFilter("buildings-estimated", [
        "all",
        ["==", ["get", "heightSource"], "estimated"],
        notDemolished,
      ]);
    }
    markedRef.current = next;
  }, [ready, props.overlaps]);

  // ---- Public roads through the plot ---------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    (map.getSource("road-crossings") as maplibregl.GeoJSONSource).setData(
      fc(props.roadCrossings.flatMap((c) => c.pieces)),
    );
  }, [ready, props.roadCrossings]);

  // ---- 2D / 3D camera ------------------------------------------------------------------
  const view3dRef = useRef(true); // the map starts tilted
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || view3dRef.current === props.layers.view3d) return;
    view3dRef.current = props.layers.view3d;
    map.easeTo(
      props.layers.view3d
        ? { pitch: 55, bearing: -20, duration: 700 }
        : { pitch: 0, bearing: 0, duration: 700 },
    );
  }, [ready, props.layers.view3d]);

  // ---- What to show ------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const vis = (on: boolean) => (on ? "visible" : "none");
    for (const id of ["buildings-real", "buildings-estimated", "buildings-demolished"]) {
      map.setLayoutProperty(id, "visibility", vis(props.layers.neighbours));
    }
    map.setLayoutProperty("buildable-line", "visibility", vis(props.layers.envelope));
    if (envGroupRef.current) envGroupRef.current.visible = props.layers.envelope;
    threeRef.current?.repaint();
  }, [ready, props.layers.neighbours, props.layers.envelope]);

  // ---- Concept design massing --------------------------------------------------------
  useEffect(() => {
    const three = threeRef.current;
    if (!ready || !three) return;
    if (designGroupRef.current) {
      three.root.remove(designGroupRef.current);
      designGroupRef.current.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose();
      });
      designGroupRef.current = null;
    }
    const design = props.design;
    if (design?.feasible) {
      const group = new THREE.Group();
      for (const part of designMassing(design)) {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(part.positions, 3));
        g.setIndex(part.indices);
        g.computeVertexNormals();
        group.add(new THREE.Mesh(g, useMaterial(part.use)));
        const lg = new THREE.BufferGeometry();
        lg.setAttribute("position", new THREE.Float32BufferAttribute(part.lines, 3));
        group.add(new THREE.LineSegments(lg, DESIGN_LINE_MATERIAL));
      }
      three.root.add(group);
      designGroupRef.current = group;
    }
    // With a design shown, the envelope becomes a faint ghost around it.
    ENVELOPE_MATERIAL.opacity = design?.feasible ? 0.1 : 0.28;
    ENVELOPE_LINE_MATERIAL.opacity = design?.feasible ? 0.35 : 1;
    three.repaint();
  }, [ready, props.design]);

  // ---- Envelope ---------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    const three = threeRef.current;
    if (!ready || !map || !three) return;
    const { envelope, frame } = props;

    if (envGroupRef.current) {
      three.root.remove(envGroupRef.current);
      envGroupRef.current.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose();
      });
    }
    const group = new THREE.Group();
    if (envelope && envelope.mesh.indices.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(envelope.mesh.positions, 3));
      g.setIndex(envelope.mesh.indices);
      g.computeVertexNormals();
      group.add(new THREE.Mesh(g, ENVELOPE_MATERIAL));
      const lg = new THREE.BufferGeometry();
      lg.setAttribute("position", new THREE.Float32BufferAttribute(envelope.mesh.lines, 3));
      group.add(new THREE.LineSegments(lg, ENVELOPE_LINE_MATERIAL));
    }
    three.root.add(group);
    group.visible = latest.current.layers.envelope;
    envGroupRef.current = group;
    three.repaint();

    const footprint: MultiPolygon = {
      type: "MultiPolygon",
      coordinates: (envelope?.footprint ?? []).map((poly) =>
        poly.map((ring) => ring.map((p) => frame.toLngLat(p as [number, number]))),
      ),
    };
    (map.getSource("buildable") as maplibregl.GeoJSONSource).setData(
      fc([{ type: "Feature", properties: {}, geometry: footprint }]),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, props.envelope, props.frame]);

  // MapLibre CSS forces position:relative on the map element, so size it
  // through an absolutely positioned wrapper.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" />
    </div>
  );
}

const ENVELOPE_MATERIAL = new THREE.MeshLambertMaterial({
  color: COLOURS.envelope,
  transparent: true,
  opacity: 0.28,
  side: THREE.DoubleSide,
  depthWrite: false,
});
const ENVELOPE_LINE_MATERIAL = new THREE.LineBasicMaterial({
  color: "#0f766e",
  transparent: true,
});
const DESIGN_LINE_MATERIAL = new THREE.LineBasicMaterial({
  color: "#1e293b",
  transparent: true,
  opacity: 0.45,
});
const useMaterials = new Map<Use, THREE.MeshLambertMaterial>();
/** One shared material per use, coloured like the floor table. */
function useMaterial(use: Use): THREE.MeshLambertMaterial {
  let m = useMaterials.get(use);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: USE_COLOURS[use], side: THREE.DoubleSide });
    useMaterials.set(use, m);
  }
  return m;
}

/** How close (screen pixels) a click must be to a plot edge to pick it. */
const EDGE_CLICK_PX = 14;
/** How far (px) terra-draw reaches to grab a corner. */
const TERRA_DRAW_POINTER_PX = 24;

/** Edge numbers sit this far outside the plot, so they do not cover the edge line. */
const EDGE_LABEL_OFFSET_M = 4;

/** Where an edge's number is drawn: its midpoint, pushed outward from the plot. */
function edgeLabelPoint(e: Edge, edges: Edge[]): [number, number] {
  const ring = edges.map((x) => x.a);
  const orient = signedArea(ring) >= 0 ? 1 : -1;
  const dx = (e.b[0] - e.a[0]) / (e.lengthM || 1);
  const dy = (e.b[1] - e.a[1]) / (e.lengthM || 1);
  // Outward normal: right of the edge for a counter-clockwise ring.
  const nx = dy * orient;
  const ny = -dx * orient;
  return [
    (e.a[0] + e.b[0]) / 2 + nx * EDGE_LABEL_OFFSET_M,
    (e.a[1] + e.b[1]) / 2 + ny * EDGE_LABEL_OFFSET_M,
  ];
}

/**
 * The plot edge a click or tap picks, if any. Measured in screen pixels, so it
 * feels the same at every zoom and tilt. Picks an edge when the click is on its
 * number, or on the edge line away from the corners (those are for dragging).
 */
function nearestEdgePx(
  map: maplibregl.Map,
  edges: Edge[],
  frame: Frame,
  p: { x: number; y: number },
  maxPx: number,
): number | null {
  let best: { d: number; edge: number } | null = null;
  const consider = (d: number, edge: number) => {
    if (d <= maxPx && (!best || d < best.d)) best = { d, edge };
  };
  for (const e of edges) {
    const label = map.project(frame.toLngLat(edgeLabelPoint(e, edges)));
    consider(Math.hypot(p.x - label.x, p.y - label.y), e.index);

    const a = map.project(frame.toLngLat(e.a));
    const b = map.project(frame.toLngLat(e.b));
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1) continue;
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    if (t < 0.15 || t > 0.85) continue;
    consider(Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)), e.index);
  }
  return (best as { edge: number } | null)?.edge ?? null;
}

function toPlot(geometry: Polygon): Feature<Polygon> {
  return { type: "Feature", properties: {}, geometry };
}
