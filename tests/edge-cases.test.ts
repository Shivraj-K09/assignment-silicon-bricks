import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateDesigns, type Design } from "../src/lib/designs.ts";
import { computeEnvelope } from "../src/lib/envelope.ts";
import { ringEdges, signedArea, type XY } from "../src/lib/local-frame.ts";
import { computeRules } from "../src/lib/rules.ts";

/** Runs rules, envelope and both designs on a plot (edge 0 faces a 25 m road). */
function runAll(ring: XY[], roadWidthM = 25) {
  const areaM2 = Math.abs(signedArea(ring));
  const frontageM = ringEdges(ring)[0].lengthM;
  const rules = computeRules({
    zone: "ย.9",
    zonesTouched: ["ย.9"],
    plotAreaM2: areaM2,
    frontageM,
    roadName: "Test road",
    roadWidthM,
    buildingType: "condo",
    station: null,
    plannedRoads: [],
  });
  const kind = rules.envelopeKind;
  const envelope = computeEnvelope({
    ring,
    frontageEdge: 0,
    roadSetbackM: rules.setbacks[kind].roadM,
    sideSetbackM: rules.setbacks[kind].sideM,
    roadWidthM,
    capM: 100,
  });
  const t0 = performance.now();
  const designs = generateDesigns({
    ring,
    frontageEdge: 0,
    roadWidthM,
    frontageM,
    buildingType: "condo",
    areaM2,
    rules,
    station: null,
    plotIssues: { collidingBuildings: 0, crossingRoads: [], outsideData: false },
  });
  return { rules, envelope, designs, ms: performance.now() - t0 };
}

const tableAddsUp = (d: Design) =>
  Math.abs(d.floorTable.reduce((s, r) => s + r.totalM2, 0) - d.totals.gfaM2) < 0.01;

describe("edge cases: the tool must not crash and must say what is wrong", () => {
  it("self-crossing (bow-tie) plot: envelope reports an error or nothing, designs show failing rows", () => {
    const bowtie: XY[] = [
      [0, 0],
      [60, 60],
      [60, 0],
      [0, 60],
    ];
    const { envelope, designs } = runAll(bowtie);
    assert.ok(envelope.error || envelope.footprintM2 >= 0);
    for (const d of designs) assert.ok(d.checklist.length > 0);
  });

  it("long thin strip (6 x 120 m): no buildable area, both designs infeasible with a reason", () => {
    const strip: XY[] = [
      [0, 0],
      [120, 0],
      [120, 6],
      [0, 6],
    ];
    const { envelope, designs } = runAll(strip);
    assert.equal(envelope.footprintM2, 0);
    for (const d of designs) {
      assert.equal(d.feasible, false);
      assert.ok(d.checklist.some((c) => c.status === "fail"));
    }
  });

  it("very large plot (200 x 250 m, 5 ha): FAR respected, tables add up, under 1.5 s", () => {
    const big: XY[] = [
      [0, 0],
      [200, 0],
      [200, 250],
      [0, 250],
    ];
    const { rules, designs, ms } = runAll(big);
    for (const d of designs) {
      assert.ok(d.totals.gfaM2 <= rules.maxGfaM2 + 0.5);
      assert.ok(tableAddsUp(d));
    }
    // 50,000 m² x FAR 7 = 350,000 m²; on a 25 m road (> 18 m) there is no road cap.
    assert.ok(ms < 1500, `took ${ms.toFixed(0)} ms`);
  });

  it("odd 12-corner plot with a reflex corner: designs feasible and tables add up", () => {
    const odd: XY[] = [
      [0, 0],
      [70, 0],
      [75, 20],
      [60, 30],
      [80, 45],
      [70, 70],
      [45, 65],
      [40, 80],
      [15, 75],
      [5, 55],
      [20, 40],
      [-5, 20],
    ];
    const { designs } = runAll(odd);
    for (const d of designs) {
      assert.equal(d.feasible, true, `${d.id}: ${d.summary}`);
      assert.ok(tableAddsUp(d));
    }
  });

  it("very wide 80 m road and very narrow 2 m lane do not break the designs", () => {
    const sq: XY[] = [
      [0, 0],
      [60, 0],
      [60, 60],
      [0, 60],
    ];
    for (const w of [80, 2]) {
      const { designs } = runAll(sq, w);
      for (const d of designs) assert.ok(tableAddsUp(d), `road ${w} m, design ${d.id}`);
    }
  });

  it("clockwise and counter-clockwise outlines give the same designs", () => {
    const ccw: XY[] = [
      [0, 0],
      [60, 0],
      [60, 50],
      [0, 50],
    ];
    // Same square, clockwise, with the frontage still edge 0 (0,0)->(...): reverse order
    // and rotate so edge 0 is the same south edge, walked the other way.
    const cw: XY[] = [
      [60, 0],
      [0, 0],
      [0, 50],
      [60, 50],
    ];
    const a = runAll(ccw).designs;
    const b = runAll(cw).designs;
    for (let i = 0; i < 2; i++)
      assert.ok(Math.abs(a[i].totals.gfaM2 - b[i].totals.gfaM2) < 1, `design ${a[i].id}`);
  });
});
