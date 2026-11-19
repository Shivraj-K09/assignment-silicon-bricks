/** terra-draw set up for one editable plot: draw a new outline, drag corners. */
import type * as maplibregl from "maplibre-gl";
import type { Feature, Polygon } from "geojson";
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import { COLOURS } from "./colours.ts";

/** The id of the one plot feature terra-draw holds. */
export const PLOT_ID = "plot";

/**
 * How far (px) terra-draw reaches to grab a corner. Its default, 40 px, would
 * swallow clicks meant to pick an edge as the road side; 24 px is still easy to
 * hit with a finger.
 */
const POINTER_PX = 24;

const selectMode = () =>
  new TerraDrawSelectMode({
    pointerDistance: POINTER_PX,
    flags: {
      polygon: {
        feature: {
          draggable: true,
          // No midpoint dots: they clash with clicking an edge to pick the road
          // side. For a different number of corners, the user draws a new plot.
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
  });

const polygonMode = () =>
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
  });

export function createPlotDraw(map: maplibregl.Map): TerraDraw {
  let nextId = 0;
  const draw = new TerraDraw({
    adapter: new TerraDrawMapLibreGLAdapter({ map }),
    idStrategy: {
      isValidId: (id) => typeof id === "string",
      getId: () => `feature-${++nextId}`,
    },
    modes: [selectMode(), polygonMode()],
  });
  draw.start();
  return draw;
}

/** Replace the plot terra-draw holds, and select it so its corners can be dragged. */
export function setPlotInDraw(draw: TerraDraw, plot: Feature<Polygon>) {
  if (draw.hasFeature(PLOT_ID)) draw.removeFeatures([PLOT_ID]);
  draw.addFeatures([
    { id: PLOT_ID, type: "Feature", geometry: plot.geometry, properties: { mode: "polygon" } },
  ]);
  draw.setMode("select");
  draw.selectFeature(PLOT_ID);
}

/** The polygon terra-draw holds under an id, or null. */
export function readPolygon(draw: TerraDraw, id: string | number): Polygon | null {
  const feature = draw.getSnapshotFeature(id);
  return feature?.geometry.type === "Polygon" ? (feature.geometry as Polygon) : null;
}
