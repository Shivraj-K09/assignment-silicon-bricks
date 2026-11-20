import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BuildingOverlap } from "../src/lib/building-overlap.ts";
import { listPlotChecks } from "../src/lib/plot-checks.ts";

const onPlot = { status: "on-plot", overlapM2: 120 } as BuildingOverlap;
const cut = { status: "colliding", overlapM2: 40 } as BuildingOverlap;
const problems = (checks: ReturnType<typeof listPlotChecks>) =>
  (checks ?? []).filter((check) => !check.ok).map((check) => check.id);

describe("plot checks", () => {
  it("waits for the building data", () => {
    assert.equal(listPlotChecks(null, [], "inside", false), null);
  });

  it("passes a clean plot, and says how many buildings it replaces", () => {
    const checks = listPlotChecks([onPlot, onPlot], [], "inside", false);
    assert.deepEqual(problems(checks), []);
    const buildings = checks?.find((check) => check.id === "buildings");
    assert.match(buildings?.detail ?? "", /2 existing buildings/);
  });

  it("puts an outline that crosses itself first, with a fix", () => {
    const checks = listPlotChecks([onPlot], [], "inside", true);
    assert.deepEqual(problems(checks), ["outline"]);
    assert.equal(checks?.[0].id, "outline");
    assert.ok(checks?.[0].fix);
  });

  it("lists every problem at once", () => {
    const road = { name: "Soi 23", insideM: 30 } as never;
    const checks = listPlotChecks([cut], [road], "partly", true);
    assert.deepEqual(problems(checks), ["outline", "buildings", "roads", "coverage"]);
  });

  it("does not call a plot outside the data area clear", () => {
    const checks = listPlotChecks([], [], "outside", false);
    assert.deepEqual(problems(checks), ["coverage"]);
  });
});
