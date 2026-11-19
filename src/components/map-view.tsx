import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import * as THREE from "three";
import { centroid } from "@turf/turf";
import type { FeatureCollection, Polygon } from "geojson";
import { findBuildingOverlaps, type BuildingOverlap } from "@/lib/building-overlap";
import { SAMPLE_PLOT } from "@/lib/sample-plot";
import { createThreeLayer } from "@/lib/three-layer";

// Map with zones, 3d building, plot and test the box
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

/** Buildings the plot line cuts through. */
export const COLLIDING_COLOUR = "#dc2626";

async function loadJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export interface BuildingCheck {
  /** Buildings inside the plot, demolished and hidden. */
  onPlot: number;
  /** Buildings the plot line cuts through. Should be none for a real plot. */
  colliding: BuildingOverlap[];
}

export default function MapView({
  onBuildingCheck,
}: {
  onBuildingCheck?: (check: BuildingCheck) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  // Kept in a ref so a new callback does not re-create the map.
  const onCheck = useRef(onBuildingCheck);
  onCheck.current = onBuildingCheck;

  useEffect(() => {
    const plotCentre = centroid(SAMPLE_PLOT).geometry.coordinates as [number, number];

    const map = new maplibregl.Map({
      container: container.current!,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: plotCentre,
      zoom: 17,
      pitch: 55,
      bearing: -20,
      maxPitch: 80,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    // "style.load", not "load": "load" waits for every basemap tile and can stall.
    map.once(
      "style.load",
      () => void addLayers().catch((e) => console.error("map setup failed", e)),
    );
    const addLayers = async () => {
      // Labels stay on top: insert our layers below the first symbol layer.
      const firstSymbol = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
      // The basemap's flat building footprints would double up with our 3D ones.
      for (const l of map.getStyle().layers) {
        if (l.id.includes("building")) map.setLayoutProperty(l.id, "visibility", "none");
      }

      const [zoning, buildings] = await Promise.all([
        loadJson<FeatureCollection>("/data/bkk-zoning.geojson"),
        loadJson<FeatureCollection<Polygon>>("/data/thonglo-buildings.geojson"),
      ]);

      // Buildings on the plot are demolished (the designs replace them) and hidden.
      // Buildings the plot line cuts through are kept and drawn in red.
      const overlaps = findBuildingOverlaps(SAMPLE_PLOT, buildings);
      const onPlot = new Set(overlaps.filter((o) => o.status === "on-plot").map((o) => o.feature));
      const colliding = new Set(
        overlaps.filter((o) => o.status === "colliding").map((o) => o.feature),
      );
      buildings.features = buildings.features
        .filter((f) => !onPlot.has(f))
        .map((f) => ({ ...f, properties: { ...f.properties, colliding: colliding.has(f) } }));
      onCheck.current?.({
        onPlot: onPlot.size,
        colliding: overlaps.filter((o) => o.status === "colliding"),
      });

      map.addSource("zoning", { type: "geojson", data: zoning });
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

      map.addSource("plot", { type: "geojson", data: SAMPLE_PLOT });
      map.addLayer(
        {
          id: "plot-fill",
          type: "fill",
          source: "plot",
          paint: { "fill-color": "#2563eb", "fill-opacity": 0.15 },
        },
        firstSymbol,
      );
      map.addLayer(
        {
          id: "plot-line",
          type: "line",
          source: "plot",
          paint: { "line-color": "#2563eb", "line-width": 2.5 },
        },
        firstSymbol,
      );

      map.addSource("buildings", { type: "geojson", data: buildings });
      map.addLayer(
        {
          id: "buildings-real",
          type: "fill-extrusion",
          source: "buildings",
          filter: ["!=", ["get", "heightSource"], "estimated"],
          paint: {
            "fill-extrusion-color": ["case", ["get", "colliding"], COLLIDING_COLOUR, "#6b7280"],
            "fill-extrusion-height": ["get", "height"],
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
            "fill-extrusion-color": ["case", ["get", "colliding"], COLLIDING_COLOUR, "#d6d3cc"],
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-opacity": 0.85,
          },
        },
        firstSymbol,
      );

      // M1 test: a 20 x 20 x 60 m box at the plot centre, drawn by Three.js.
      const three = createThreeLayer("three", plotCentre);
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(20, 20, 60),
        new THREE.MeshLambertMaterial({ color: 0xf97316, transparent: true, opacity: 0.85 }),
      );
      box.position.z = 30; // box is centred on its origin; lift it to sit on the ground
      three.root.add(box);
      map.addLayer(three.layer, firstSymbol);
    };

    return () => map.remove();
  }, []);

  // MapLibre CSS forces position:relative on the map element, so size it
  // through an absolutely positioned wrapper.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" />
    </div>
  );
}
