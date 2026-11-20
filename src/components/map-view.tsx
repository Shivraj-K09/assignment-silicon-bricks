import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import type * as THREE from "three";
import type { TerraDraw } from "terra-draw";
import type { Feature, Polygon } from "geojson";
import type { MapLayers } from "@/lib/map-layer-options";
import MapLoading from "@/components/map-loading";
import type { BuildingOverlap } from "@/lib/building-overlap";
import type { Design } from "@/lib/designs";
import { pickEdge } from "@/lib/edge-picking";
import type { Envelope } from "@/lib/envelope";
import type { Edge, Frame } from "@/lib/local-frame";
import {
  addBuildingLayers,
  addDataAreaLayer,
  addEdgeLabelLayer,
  addPlotOverlayLayers,
  addZoningLayers,
  BASEMAP_STYLE_URL,
  firstLabelLayerId,
  hideBasemapBuildings,
  hideDemolishedBuildings,
  LAYER,
  raisePlotOverlays,
  setLayerVisible,
  showBuildableOutline,
  showFrontage,
  showRoadCrossings,
  toPlotFeature,
} from "@/lib/map-layers";
import { createPlotDraw, PLOT_ID, readPolygon, setPlotInDraw } from "@/lib/plot-draw";
import type { RoadCrossing, SiteData } from "@/lib/site";
import { createThreeLayer } from "@/lib/three-layer";
import {
  buildDesignGroup,
  buildEnvelopeGroup,
  disposeGroup,
  setEnvelopeGhosted,
} from "@/lib/three-meshes";

// Worker file is copied into public/ by scripts/setup-map-worker.mjs
// (Vite's ?url import fails because the project path contains "#").
maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

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
  /** Content pinned to the plot on the map (its checks), hidden while drawing. */
  plotPin?: ReactNode;
  /** Hands the map to the page once it is ready (and null when it goes), for our own controls. */
  onMapReady?: (map: maplibregl.Map | null) => void;
}

/** The plot corner nearest the viewer (the most southerly), where the pin hangs. */
function pinPoint(plot: Feature<Polygon>): [number, number] {
  const ring = plot.geometry.coordinates[0];
  let best = ring[0];
  for (const point of ring) if (point[1] < best[1]) best = point;
  return [best[0], best[1]];
}

const CAMERA_3D = { pitch: 55, bearing: -20 };
const CAMERA_2D = { pitch: 0, bearing: 0 };

/** Identifies a plot's outline, to tell our own edits from outside changes. */
const outlineKey = (plot: Feature<Polygon>) => JSON.stringify(plot.geometry.coordinates);

/** Which existing buildings are on the plot (demolished) or cut by its line. */
type MarkedBuildings = { onPlot: Set<number>; colliding: Set<number> };

function markBuildings(overlaps: BuildingOverlap[]): MarkedBuildings {
  const marked: MarkedBuildings = { onPlot: new Set(), colliding: new Set() };
  for (const overlap of overlaps) {
    const id = overlap.feature.id as number;
    (overlap.status === "on-plot" ? marked.onPlot : marked.colliding).add(id);
  }
  return marked;
}

const sameIds = (a: Set<number>, b: Set<number>) =>
  a.size === b.size && [...a].every((id) => b.has(id));

/** Update feature-state only for buildings whose state changed. */
function applyBuildingStates(map: maplibregl.Map, prev: MarkedBuildings, next: MarkedBuildings) {
  const setState = (id: number, state: Record<string, boolean>) =>
    map.setFeatureState({ source: "buildings", id }, state);
  for (const id of prev.onPlot) if (!next.onPlot.has(id)) setState(id, { onPlot: false });
  for (const id of prev.colliding) if (!next.colliding.has(id)) setState(id, { colliding: false });
  for (const id of next.onPlot) if (!prev.onPlot.has(id)) setState(id, { onPlot: true });
  for (const id of next.colliding) if (!prev.colliding.has(id)) setState(id, { colliding: true });
}

export default function MapView(props: MapViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const threeRef = useRef<ReturnType<typeof createThreeLayer> | null>(null);
  const envelopeGroupRef = useRef<THREE.Group | null>(null);
  const designGroupRef = useRef<THREE.Group | null>(null);
  /** Outline terra-draw currently holds. */
  const syncedOutlineRef = useRef("");
  /** The newest dragged outline, waiting for the next animation frame. */
  const pendingPlotRef = useRef<Feature<Polygon> | null>(null);
  const frameRef = useRef<number | null>(null);
  const markedRef = useRef<MarkedBuildings>({ onPlot: new Set(), colliding: new Set() });
  const view3dRef = useRef(true); // the map starts tilted
  // Latest props, for the map and terra-draw event handlers that are set up once.
  const latest = useRef(props);
  latest.current = props;
  const [ready, setReady] = useState(false);
  // The element the plot pin renders into; MapLibre keeps it on the plot as the map moves.
  const [pinElement] = useState(() => document.createElement("div"));

  // ---- Create the map once -----------------------------------------------------------
  useEffect(() => {
    const { data, frame } = latest.current;
    const map = new maplibregl.Map({
      container: container.current!,
      style: BASEMAP_STYLE_URL,
      center: frame.origin,
      zoom: 17,
      ...CAMERA_3D,
      maxPitch: 80,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

    const showPlotInDraw = (draw: TerraDraw, plot: Feature<Polygon>) => {
      setPlotInDraw(draw, plot);
      syncedOutlineRef.current = outlineKey(plot);
    };

    // A corner or the whole plot was dragged.
    const handleDrawChange = (ids: (string | number)[], type: string) => {
      const draw = drawRef.current;
      if (!draw || type !== "update" || !ids.includes(PLOT_ID) || draw.getMode() !== "select") {
        return;
      }
      const polygon = readPolygon(draw, PLOT_ID);
      if (!polygon) return;
      const plot = toPlotFeature(polygon);
      syncedOutlineRef.current = outlineKey(plot);
      // A drag sends a change on every pointer move (often 120+ a second). Pass on
      // only the latest one per animation frame, so the analysis runs once a frame.
      pendingPlotRef.current = plot;
      if (frameRef.current === null) frameRef.current = requestAnimationFrame(flushPlotChange);
    };

    const flushPlotChange = () => {
      frameRef.current = null;
      const plot = pendingPlotRef.current;
      pendingPlotRef.current = null;
      if (plot) latest.current.onPlotChange(plot, "edit");
    };

    // A new plot outline was finished in drawing mode.
    const handleDrawFinish = (id: string | number, context: { mode: string }) => {
      const draw = drawRef.current;
      if (!draw || context.mode !== "polygon") return;
      const polygon = readPolygon(draw, id);
      if (!polygon) return;
      const plot = toPlotFeature(polygon);
      draw.removeFeatures([id]);
      showPlotInDraw(draw, plot);
      latest.current.onPlotChange(plot, "new");
      latest.current.onDrawingEnd();
    };

    // There is only ever one plot, so keep it selected: its corners must stay
    // draggable after a click elsewhere on the map (for example to pick an edge).
    const handleDrawDeselect = () => {
      // Checked when the re-select runs, not now: starting "Draw new plot" also
      // deselects the plot, and re-selecting it then would leave drawing mode.
      const reselectPlot = () => {
        const draw = drawRef.current;
        if (!draw || latest.current.drawing || draw.getMode() !== "select") return;
        if (draw.hasFeature(PLOT_ID)) draw.selectFeature(PLOT_ID);
      };
      setTimeout(reselectPlot, 0);
    };

    // Click or tap a plot edge (or its number) to make it the edge facing the road.
    const handleMapClick = (event: maplibregl.MapMouseEvent) => {
      const { edges, frame: f, drawing } = latest.current;
      if (drawing) return;
      const edge = pickEdge(map, edges, f, event.point);
      if (edge !== null) latest.current.onEdgeClick(edge);
    };

    // Pointer cursor over an edge, so it is clear that edges can be clicked.
    const handleMapMouseMove = (event: maplibregl.MapMouseEvent) => {
      const { edges, frame: f, drawing } = latest.current;
      if (drawing) return;
      const overEdge = pickEdge(map, edges, f, event.point) !== null;
      map.getCanvas().style.cursor = overEdge ? "pointer" : "";
    };

    const handleStyleLoad = () => {
      const beforeLabels = firstLabelLayerId(map);
      hideBasemapBuildings(map);
      addZoningLayers(map, data.zoning, beforeLabels);
      addPlotOverlayLayers(map, beforeLabels);
      addBuildingLayers(map, data.buildings, beforeLabels);
      addDataAreaLayer(map, beforeLabels);

      // Envelope and designs, drawn by Three.js in the same depth buffer as the buildings.
      const three = createThreeLayer("three", frame.origin);
      threeRef.current = three;
      map.addLayer(three.layer, beforeLabels);
      addEdgeLabelLayer(map);

      const draw = createPlotDraw(map);
      drawRef.current = draw;
      raisePlotOverlays(map);
      showPlotInDraw(draw, latest.current.plot);
      draw.on("change", handleDrawChange);
      draw.on("finish", handleDrawFinish);
      draw.on("deselect", handleDrawDeselect);
      map.on("click", handleMapClick);
      map.on("mousemove", handleMapMouseMove);

      setReady(true);
      latest.current.onMapReady?.(map);
    };

    // "style.load", not "load": "load" waits for every basemap tile and can stall.
    map.once("style.load", handleStyleLoad);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      drawRef.current?.stop();
      drawRef.current = null;
      latest.current.onMapReady?.(null);
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // ---- Plot replaced from outside (reset to sample) -------------------------------------
  useEffect(() => {
    const draw = drawRef.current;
    if (!ready || !draw || outlineKey(props.plot) === syncedOutlineRef.current) return;
    setPlotInDraw(draw, props.plot);
    syncedOutlineRef.current = outlineKey(props.plot);
  }, [ready, props.plot]);

  // ---- Drawing mode -----------------------------------------------------------------------
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

  // ---- Road edge and edge numbers -----------------------------------------------------------
  const { frame, edges, frontageEdge } = props;
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    showFrontage(map, frame, edges, frontageEdge);
  }, [ready, frame, edges, frontageEdge]);

  // ---- Buildings on the plot (demolished) or cut by the plot line --------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const next = markBuildings(props.overlaps);
    const prev = markedRef.current;
    applyBuildingStates(map, prev, next);
    // Re-filtered only when the demolished set changes, not on every drag step.
    if (!sameIds(prev.onPlot, next.onPlot)) hideDemolishedBuildings(map, [...next.onPlot]);
    markedRef.current = next;
  }, [ready, props.overlaps]);

  // ---- Public roads through the plot ----------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    showRoadCrossings(map, props.roadCrossings);
  }, [ready, props.roadCrossings]);

  // ---- 2D / 3D camera -----------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || view3dRef.current === props.layers.view3d) return;
    view3dRef.current = props.layers.view3d;
    map.easeTo({ ...(props.layers.view3d ? CAMERA_3D : CAMERA_2D), duration: 700 });
  }, [ready, props.layers.view3d]);

  // ---- What to show ---------------------------------------------------------------------------
  const { neighbours, envelope: showEnvelope } = props.layers;
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const id of [LAYER.buildingsReal, LAYER.buildingsEstimated, LAYER.buildingsDemolished]) {
      setLayerVisible(map, id, neighbours);
    }
    setLayerVisible(map, LAYER.buildable, showEnvelope);
    if (envelopeGroupRef.current) envelopeGroupRef.current.visible = showEnvelope;
    threeRef.current?.repaint();
  }, [ready, neighbours, showEnvelope]);

  // ---- Concept design massing -------------------------------------------------------------
  useEffect(() => {
    const three = threeRef.current;
    if (!ready || !three) return;
    if (designGroupRef.current) {
      three.root.remove(designGroupRef.current);
      disposeGroup(designGroupRef.current);
      designGroupRef.current = null;
    }
    const shown = props.design?.feasible ? props.design : null;
    if (shown) {
      designGroupRef.current = buildDesignGroup(shown);
      three.root.add(designGroupRef.current);
    }
    setEnvelopeGhosted(shown !== null);
    three.repaint();
  }, [ready, props.design]);

  // ---- Allowed envelope ---------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    const three = threeRef.current;
    if (!ready || !map || !three) return;
    if (envelopeGroupRef.current) {
      three.root.remove(envelopeGroupRef.current);
      disposeGroup(envelopeGroupRef.current);
    }
    const group = buildEnvelopeGroup(props.envelope);
    group.visible = latest.current.layers.envelope;
    three.root.add(group);
    envelopeGroupRef.current = group;
    three.repaint();
    showBuildableOutline(map, frame, props.envelope?.footprint ?? []);
  }, [ready, props.envelope, frame]);

  // ---- Pin on the plot -----------------------------------------------------------------------
  const pinMarkerRef = useRef<maplibregl.Marker | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const marker = new maplibregl.Marker({ element: pinElement, anchor: "top", offset: [0, 14] })
      .setLngLat(pinPoint(latest.current.plot))
      .addTo(map);
    pinMarkerRef.current = marker;
    return () => {
      marker.remove();
      pinMarkerRef.current = null;
    };
  }, [ready, pinElement]);

  useEffect(() => {
    pinMarkerRef.current?.setLngLat(pinPoint(props.plot));
  }, [props.plot]);

  // MapLibre CSS forces position:relative on the map element, so size it
  // through an absolutely positioned wrapper.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" />
      {!ready && <MapLoading text="Loading the map…" />}
      {ready && !props.drawing && props.plotPin && createPortal(props.plotPin, pinElement)}
    </div>
  );
}
