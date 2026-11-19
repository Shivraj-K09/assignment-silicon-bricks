// Finds the sample plot: a road-aligned outline on the east side of Thong Lo
// whose edges run along the gaps between existing buildings, so the plot line
// cuts no building (checked with the same rule the tool uses,
// src/lib/building-overlap.ts). Prints the best outline for src/lib/sample-plot.ts.
//
// Found a realistic sample plot that cuts no building
//
// Frame: u = metres along Thong Lo (north-north-east), v = metres east of the
// road centreline. The legal road edge is v = 12.5 (25 m road).
// Run: node scripts/make-sample-plot.mjs   (Node 24 runs the .ts import directly)
import * as turf from "@turf/turf";
import { readFileSync } from "node:fs";
import { findBuildingOverlaps } from "../src/lib/building-overlap.ts";
const roads = JSON.parse(readFileSync("public/data/thonglo-roads.geojson"));
const zones = JSON.parse(readFileSync("public/data/bkk-zoning.geojson"));
const blds = JSON.parse(readFileSync("public/data/thonglo-buildings.geojson"));
const a = roads.features.find((f) => f.id === 1415146682),
  b = roads.features.find((f) => f.id === 328943283);
const bearing = turf.bearing([100.5817291, 13.731646], [100.5842727, 13.7390453]);
const pr = turf.lineString([
  [100.57, 13.7372],
  [100.6, 13.7372],
]);
const pa = turf.lineIntersect(a, pr).features[0].geometry.coordinates,
  pb = turf.lineIntersect(b, pr).features[0].geometry.coordinates;
const c = [(pa[0] + pb[0]) / 2, 13.7372];
const at = (u, v) =>
  turf
    .destination(turf.destination(c, u / 1000, bearing), v / 1000, bearing + 90)
    .geometry.coordinates.map((x) => Math.round(x * 1e7) / 1e7);
const W = 12.5;
const res = [];
for (const uW of [8, 9, 10, 12])
  for (const uE1 of [69.5, 70, 70.5, 71])
    for (const uE2 of [71, 71.5, 72])
      for (const uE3 of [74, 75, 76])
        for (const vJ of [46.5, 47])
          for (const vB of [64, 66, 68]) {
            const local = [
              [uW, W],
              [uE1, W],
              [uE1, 28],
              [uE2, 28],
              [uE2, vJ],
              [uE3, vJ],
              [uE3, vB],
              [uW - 5, vB],
              [uW - 1, 47],
            ];
            const ring = local.map(([u, v]) => at(u, v));
            ring.push(ring[0]);
            const plot = turf.polygon([ring]);
            const ov = findBuildingOverlaps(plot, blds);
            const col = ov.filter((o) => o.status === "colliding");
            res.push({
              key: [uW, uE1, uE2, uE3, vJ, vB].join(","),
              col: col.length,
              colM2: col.reduce((s, o) => s + o.overlapM2, 0),
              worst: col
                .map((o) => `${o.overlapM2.toFixed(1)}m2/${(o.share * 100).toFixed(0)}%`)
                .join(" "),
              ar: turf.area(plot),
              ring,
            });
          }
res.sort((x, y) => x.col - y.col || x.colM2 - y.colM2 || y.ar - x.ar);
for (const r of res.slice(0, 8))
  console.log(r.col, r.colM2.toFixed(1), r.key, Math.round(r.ar), r.worst);
const best = res[0];
const plot = turf.polygon([best.ring]);
console.log(
  "zones",
  [
    ...new Set(
      zones.features.filter((z) => turf.booleanIntersects(z, plot)).map((z) => z.properties.zone),
    ),
  ],
  "public roads",
  roads.features
    .filter(
      (f) =>
        ["residential", "tertiary", "unclassified", "living_street"].includes(
          f.properties.highway,
        ) && turf.booleanIntersects(f, plot),
    )
    .map((f) => f.properties.name),
  "on-plot",
  findBuildingOverlaps(plot, blds).filter((o) => o.status === "on-plot").length,
);
console.log(JSON.stringify(best.ring));
