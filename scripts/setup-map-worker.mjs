// Copies MapLibre's web worker into public/ so it is served as a plain file.
// (Vite's ?url import fails because the project path contains "#".)
// public/ may not exist in a fresh clone (git does not keep empty folders),
// so create it first.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public", { recursive: true });
copyFileSync(
  "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs",
  "public/maplibre-gl-worker.mjs",
);
