// Converts the raw Overpass extract into two small static GeoJSON files.
// Input:  scripts/raw/osm-thonglo.json (from fetch-osm.mjs)
// Output: public/data/thonglo-buildings.geojson, public/data/thonglo-roads.geojson
//
// Cleaned that data and guessed missing building heights
//
// Building height, in order of preference:
//   1. `height` tag (metres)                 -> heightSource "osm-height"
//   2. `building:levels` x 3.2 m             -> heightSource "osm-levels"
//   3. estimate from footprint area           -> heightSource "estimated"
//      < 150 m2 -> 2 storeys, < 600 -> 4, < 2,000 -> 8, larger -> 12 (3.2 m each)
import { readFileSync, writeFileSync } from "node:fs";

const STOREY_M = 3.2;
const raw = JSON.parse(readFileSync("scripts/raw/osm-thonglo.json", "utf8"));

const round = (n) => Math.round(n * 1e7) / 1e7;
const ring = (geom) => geom.map((p) => [round(p.lon), round(p.lat)]);
const closed = (r) => r.length >= 4 && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1];

// Planar area in m2 (equirectangular around the ring's latitude; fine at this scale).
function areaM2(r) {
  const lat0 = (r[0][1] * Math.PI) / 180;
  const kx = 111320 * Math.cos(lat0);
  const ky = 110540;
  let a = 0;
  for (let i = 0; i < r.length - 1; i++) {
    a += r[i][0] * kx * r[i + 1][1] * ky - r[i + 1][0] * kx * r[i][1] * ky;
  }
  return Math.abs(a / 2);
}

function parseMetres(v) {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 && n < 500 ? n : null;
}

function height(tags, footprint) {
  const h = parseMetres(tags.height);
  if (h) return { height: h, heightSource: "osm-height" };
  const lv = parseMetres(tags["building:levels"]);
  if (lv) return { height: Math.round(lv * STOREY_M * 10) / 10, heightSource: "osm-levels" };
  const storeys = footprint < 150 ? 2 : footprint < 600 ? 4 : footprint < 2000 ? 8 : 12;
  return { height: storeys * STOREY_M, heightSource: "estimated" };
}

const buildings = [];
const roads = [];

for (const el of raw.elements) {
  const tags = el.tags ?? {};
  if (el.type === "way" && tags.building && el.geometry) {
    const r = ring(el.geometry);
    if (!closed(r)) continue;
    const footprint = areaM2(r);
    buildings.push({
      type: "Feature",
      id: el.id,
      properties: { name: tags.name ?? null, ...height(tags, footprint) },
      geometry: { type: "Polygon", coordinates: [r] },
    });
  } else if (el.type === "relation" && tags.building && el.members) {
    // Multipolygon buildings: keep closed outer rings (inner courtyards ignored).
    for (const m of el.members) {
      if (m.role !== "outer" || !m.geometry) continue;
      const r = ring(m.geometry);
      if (!closed(r)) continue;
      buildings.push({
        type: "Feature",
        properties: { name: tags.name ?? null, ...height(tags, areaM2(r)) },
        geometry: { type: "Polygon", coordinates: [r] },
      });
    }
  } else if (el.type === "way" && tags.highway && el.geometry) {
    roads.push({
      type: "Feature",
      id: el.id,
      properties: {
        name: tags.name ?? null,
        nameEn: tags["name:en"] ?? null,
        highway: tags.highway,
        width: parseMetres(tags.width),
        lanes: tags.lanes ? Number(tags.lanes) : null,
      },
      geometry: { type: "LineString", coordinates: ring(el.geometry) },
    });
  }
}

const fc = (features) => ({ type: "FeatureCollection", features });
writeFileSync("public/data/thonglo-buildings.geojson", JSON.stringify(fc(buildings)));
writeFileSync("public/data/thonglo-roads.geojson", JSON.stringify(fc(roads)));

const bySource = {};
for (const b of buildings)
  bySource[b.properties.heightSource] = (bySource[b.properties.heightSource] ?? 0) + 1;
console.log(`buildings: ${buildings.length}`, bySource);
console.log(`roads: ${roads.length}`);
