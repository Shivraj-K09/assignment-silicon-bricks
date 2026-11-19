// Fetches OSM buildings and roads around northern Thong Lo from Overpass, once,
// at build-prep time. The tool never calls Overpass while running (it was
// returning 502s during research). Tries several servers with retries.
// Output: scripts/raw/osm-thonglo.json (raw Overpass JSON, gitignored)
//
//
// Downloads building and roads from openstreet map
import { mkdirSync, writeFileSync } from "node:fs";

// south, west, north, east
const BBOX = [13.73, 100.576, 13.745, 100.59].join(",");
const QUERY = `[out:json][timeout:120];
(
  way["building"](${BBOX});
  relation["building"](${BBOX});
  way["highway"](${BBOX});
);
out body geom;`;

const SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

async function tryServer(url) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "bangkok-plot-tool-data-prep/0.1",
    },
    body: "data=" + encodeURIComponent(QUERY),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json.elements) || json.elements.length === 0) throw new Error("no elements");
  return json;
}

let data;
outer: for (let attempt = 1; attempt <= 3; attempt++) {
  for (const url of SERVERS) {
    try {
      console.log(`attempt ${attempt}: ${url}`);
      data = await tryServer(url);
      console.log(`  ok: ${data.elements.length} elements`);
      break outer;
    } catch (e) {
      console.log(`  failed: ${e.message}`);
    }
  }
  await new Promise((r) => setTimeout(r, 5000 * attempt));
}
if (!data) throw new Error("All Overpass servers failed");

mkdirSync("scripts/raw", { recursive: true });
writeFileSync("scripts/raw/osm-thonglo.json", JSON.stringify(data));
