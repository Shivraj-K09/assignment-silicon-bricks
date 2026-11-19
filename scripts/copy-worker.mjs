// Copies MapLibre's web worker into public/ so it is served as a plain file.
// (Vite's ?url import fails because the project path contains "#".)
import { copyFileSync } from "node:fs";
copyFileSync(
  "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs",
  "public/maplibre-gl-worker.mjs",
);
