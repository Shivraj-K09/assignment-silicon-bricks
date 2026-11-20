import type { Use } from "./designs.ts";

/** Map colours, shared by the map and its legend (kept apart so the legend does not load the map code). */
export const COLOURS = {
  plot: "#2563eb",
  frontage: "#f97316",
  envelope: "#0d9488",
  colliding: "#dc2626",
  // Neighbours are muted so the plot, envelope and design stand out.
  realHeight: "#94a3b8",
  estimatedHeight: "#e2e8f0",
  demolished: "#64748b",
  dataArea: "#7c3aed",
} as const;

/** Colours per use, shared by the 3D massing and the floor table. */
export const USE_COLOURS: Record<Use, string> = {
  lobby: "#f59e0b",
  parking: "#94a3b8",
  residential: "#60a5fa",
  hotel: "#a78bfa",
  office: "#34d399",
};
