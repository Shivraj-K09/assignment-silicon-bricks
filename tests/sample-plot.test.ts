import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  area,
  booleanIntersects,
  booleanPointInPolygon,
  centroid,
  distance,
  kinks,
} from "@turf/turf";
import type { FeatureCollection, LineString, Polygon } from "geojson";
import { findBuildingOverlaps } from "../src/lib/building-overlap.ts";
import { SAMPLE_FRONTAGE_EDGE, SAMPLE_PLOT } from "../src/lib/sample-plot.ts";

// The real static data the tool ships with.
const load = <T>(name: string): T =>
  JSON.parse(readFileSync(new URL(`../public/data/${name}`, import.meta.url), "utf8")) as T;
const buildings = load<FeatureCollection<Polygon>>("thonglo-buildings.geojson");
const roads =
  load<FeatureCollection<LineString, { highway: string; name: string | null }>>(
    "thonglo-roads.geojson",
  );
const zoning = load<FeatureCollection<Polygon, { zone: string }>>("bkk-zoning.geojson");

const ring = SAMPLE_PLOT.geometry.coordinates[0];
const PUBLIC_ROADS = [
  "primary",
  "secondary",
  "tertiary",
  "residential",
  "unclassified",
  "living_street",
];

describe("sample plot on the real Thong Lo data", () => {
  it("is a closed polygon that does not cross itself", () => {
    assert.deepEqual(ring[0], ring.at(-1));
    assert.equal(kinks(SAMPLE_PLOT).features.length, 0);
  });

  it("is about 3,670 m²", () => {
    const m2 = area(SAMPLE_PLOT);
    assert.ok(m2 > 3600 && m2 < 3750, `area ${m2}`);
  });

  it("cuts no existing building", () => {
    const colliding = findBuildingOverlaps(SAMPLE_PLOT, buildings).filter(
      (o) => o.status === "colliding",
    );
    assert.deepEqual(colliding, []);
  });

  it("has 6 existing buildings on it, to be demolished", () => {
    const onPlot = findBuildingOverlaps(SAMPLE_PLOT, buildings).filter(
      (o) => o.status === "on-plot",
    );
    assert.equal(onPlot.length, 6);
  });

  it("lies entirely in zone ย.9", () => {
    const touched = zoning.features.filter((z) => booleanIntersects(z, SAMPLE_PLOT));
    assert.deepEqual(
      touched.map((z) => z.properties.zone),
      ["ย.9"],
    );
    const home = zoning.features.find((z) => booleanPointInPolygon(centroid(SAMPLE_PLOT), z));
    assert.equal(home?.properties.zone, "ย.9");
  });

  it("is not crossed by any public road", () => {
    const crossing = roads.features.filter(
      (r) => PUBLIC_ROADS.includes(r.properties.highway) && booleanIntersects(r, SAMPLE_PLOT),
    );
    assert.deepEqual(
      crossing.map((r) => r.properties.name),
      [],
    );
  });

  it("has a frontage edge of about 62 m", () => {
    const a = ring[SAMPLE_FRONTAGE_EDGE];
    const b = ring[SAMPLE_FRONTAGE_EDGE + 1];
    const m = distance(a, b, { units: "meters" });
    assert.ok(Math.abs(m - 62) < 1, `frontage ${m}`);
  });
});
