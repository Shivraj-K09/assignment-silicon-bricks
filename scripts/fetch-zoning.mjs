// Downloads the 2013 Bangkok Comprehensive Plan zoning map and planned roads
// (GeoJSON conversion of the BMA "LupDolWms" ArcGIS service) from
// github.com/Kanesuan/KNS.MAP PR #6, pinned to the PR head commit.
// Output: public/data/bkk-zoning.geojson, public/data/bkk-planned-roads.geojson

// Downlaod the zone map
import { mkdirSync, writeFileSync } from "node:fs";

const SHA = "b344ea63235d497c0e58823b5625b4d2ec23f085";
const BASE = `https://raw.githubusercontent.com/Kanesuan/KNS.MAP/${SHA}/public/data`;
const FILES = [
  ["bkk-zoning-current.geojson", "bkk-zoning.geojson"],
  ["bkk-planned-roads.geojson", "bkk-planned-roads.geojson"],
];

mkdirSync("public/data", { recursive: true });
for (const [src, dest] of FILES) {
  const res = await fetch(`${BASE}/${src}`);
  if (!res.ok) throw new Error(`${src}: HTTP ${res.status}`);
  const geojson = await res.json();
  if (geojson.type !== "FeatureCollection") throw new Error(`${src}: not a FeatureCollection`);
  // Round coordinates to 6 decimals (~10 cm): the source has 15+ digits, which
  // triples the download for no visible difference.
  const round = (c) =>
    typeof c[0] === "number" ? c.map((v) => Math.round(v * 1e6) / 1e6) : c.map(round);
  for (const feat of geojson.features) feat.geometry.coordinates = round(feat.geometry.coordinates);
  writeFileSync(`public/data/${dest}`, JSON.stringify(geojson));
  console.log(`${dest}: ${geojson.features.length} features`);
}
