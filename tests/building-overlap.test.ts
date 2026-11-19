import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { destination, polygon } from "@turf/turf";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import { findBuildingOverlaps } from "../src/lib/building-overlap.ts";

/** Passes when |actual - expected| <= tolerance. */
const assertNear = (actual: number, expected: number, tolerance: number) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );

// Rectangles in metres around a fixed point in Bangkok, so the tests read in
// real units: rect(x0, y0, x1, y1) with x = east, y = north.
const ORIGIN: [number, number] = [100.584, 13.737];
const at = (x: number, y: number) =>
  destination(destination(ORIGIN, x / 1000, 90), y / 1000, 0).geometry.coordinates;
const rect = (x0: number, y0: number, x1: number, y1: number): Feature<Polygon> =>
  polygon([[at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1), at(x0, y0)]]);
const fc = (...features: Feature<Polygon>[]): FeatureCollection<Polygon> => ({
  type: "FeatureCollection",
  features,
});

// A 50 x 50 m plot.
const PLOT = rect(0, 0, 50, 50);

describe("findBuildingOverlaps", () => {
  it("marks a building fully inside the plot as on-plot", () => {
    const [o] = findBuildingOverlaps(PLOT, fc(rect(10, 10, 20, 20)));
    assert.equal(o.status, "on-plot");
    assertNear(o.share, 1, 0.005);
    assertNear(o.overlapM2, 100, 0.5);
  });

  it("marks a building the plot line cuts in half as colliding", () => {
    const [o] = findBuildingOverlaps(PLOT, fc(rect(45, 10, 55, 20)));
    assert.equal(o.status, "colliding");
    assertNear(o.share, 0.5, 0.005);
    assertNear(o.overlapM2, 50, 0.5);
  });

  it("counts a building at least 90% inside as on-plot (small overhang allowed)", () => {
    // 10 x 10 m building, 0.8 m over the edge: 92% inside.
    const [o] = findBuildingOverlaps(PLOT, fc(rect(40.8, 10, 50.8, 20)));
    assertNear(o.share, 0.92, 0.005);
    assert.equal(o.status, "on-plot");
  });

  it("flags a building under 90% inside as colliding", () => {
    // 1.5 m over the edge: 85% inside.
    const [o] = findBuildingOverlaps(PLOT, fc(rect(41.5, 10, 51.5, 20)));
    assertNear(o.share, 0.85, 0.005);
    assert.equal(o.status, "colliding");
  });

  it("ignores a building outside the plot", () => {
    assert.deepEqual(findBuildingOverlaps(PLOT, fc(rect(60, 10, 70, 20))), []);
  });

  it("ignores a building that only touches the plot line", () => {
    assert.deepEqual(findBuildingOverlaps(PLOT, fc(rect(50, 10, 60, 20))), []);
  });

  it("ignores overlaps under 1 m² as drawing noise", () => {
    // 10 m long building, 5 cm inside the plot: 0.5 m².
    assert.deepEqual(findBuildingOverlaps(PLOT, fc(rect(49.95, 10, 60, 20))), []);
  });

  it("classifies a mix of buildings independently", () => {
    const result = findBuildingOverlaps(
      PLOT,
      fc(rect(10, 10, 20, 20), rect(45, 30, 55, 40), rect(100, 100, 110, 110), rect(-5, -5, 5, 5)),
    );
    assert.deepEqual(result.map((o) => o.status).sort(), ["colliding", "colliding", "on-plot"]);
  });

  it("handles a non-convex (L-shaped) plot", () => {
    // L shape: the 25..50 x 25..50 corner is cut away.
    const L = polygon([
      [at(0, 0), at(50, 0), at(50, 25), at(25, 25), at(25, 50), at(0, 50), at(0, 0)],
    ]);
    // In the cut-away corner: outside, although inside the plot's bounding box.
    assert.deepEqual(findBuildingOverlaps(L, fc(rect(30, 30, 45, 45))), []);
    // Straddles the inner corner edge.
    assert.equal(findBuildingOverlaps(L, fc(rect(20, 30, 30, 40)))[0].status, "colliding");
  });
});
