/**
 * The one panel open on the right of the map, if any. Only one at a time, so
 * the details drawer, the layers card and the help card never stack.
 */
export type SidePanel = "details" | "layers" | "help" | null;

/** What the map shows. */
export interface MapLayers {
  /** Tilted 3D view (true) or flat top-down 2D view, handy for drawing. */
  view3d: boolean;
  envelope: boolean;
  /** The selected concept design, drawn as massing. */
  design: boolean;
  neighbours: boolean;
}

export const DEFAULT_LAYERS: MapLayers = {
  view3d: true,
  envelope: true,
  design: true,
  neighbours: true,
};
