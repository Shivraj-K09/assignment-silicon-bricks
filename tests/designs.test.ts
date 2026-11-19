import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { area, centroid } from "@turf/turf";
import {
  generateDesigns,
  hotelRoomSpaces,
  parkingRequired,
  type Design,
  type DesignInput,
} from "../src/lib/designs.ts";
import { makeFrame, plotRing, ringEdges, type XY } from "../src/lib/local-frame.ts";
import { computeRules, type BuildingType } from "../src/lib/rules.ts";
import { SAMPLE_PLOT } from "../src/lib/sample-plot.ts";

const frame = makeFrame(centroid(SAMPLE_PLOT).geometry.coordinates as [number, number]);
const SAMPLE_RING = plotRing(SAMPLE_PLOT, frame);
const SAMPLE_AREA = area(SAMPLE_PLOT);
const STATION = { name: "Thong Lo", distanceM: 1500 };

function designsFor(
  opts: { ring?: XY[]; areaM2?: number; roadWidthM?: number; type?: BuildingType } = {},
): [Design, Design] {
  const ring = opts.ring ?? SAMPLE_RING;
  const areaM2 = opts.areaM2 ?? SAMPLE_AREA;
  const roadWidthM = opts.roadWidthM ?? 25;
  const buildingType = opts.type ?? "condo";
  const frontageM = ringEdges(ring)[0].lengthM;
  const rules = computeRules({
    zone: "ย.9",
    zonesTouched: ["ย.9"],
    plotAreaM2: areaM2,
    frontageM,
    roadName: "Thong Lo",
    roadWidthM,
    buildingType,
    station: STATION,
    plannedRoads: [],
  });
  const input: DesignInput = {
    ring,
    frontageEdge: 0,
    roadWidthM,
    frontageM,
    buildingType,
    areaM2,
    rules,
    station: STATION,
    plotIssues: { collidingBuildings: 0, crossingRoads: [], outsideData: false },
  };
  return generateDesigns(input);
}

const row = (d: Design, id: string) => {
  const r = d.checklist.find((c) => c.id === id);
  assert.ok(r, `${d.id}: checklist row ${id} missing`);
  return r;
};
const fails = (d: Design) => d.checklist.filter((c) => c.status === "fail").map((c) => c.id);

describe("design floor tables add up", () => {
  for (const type of ["condo", "hotel", "office"] as BuildingType[]) {
    it(`${type}: sum of the floor table equals total floor area, for A and B`, () => {
      for (const d of designsFor({ type })) {
        const sum = d.floorTable.reduce((s, r) => s + r.totalM2, 0);
        assert.ok(Math.abs(sum - d.totals.gfaM2) < 0.01, `${d.id}: ${sum} vs ${d.totals.gfaM2}`);
        const storeys = d.floorTable.reduce((s, r) => s + r.floors, 0);
        assert.equal(storeys, d.totals.storeys);
      }
    });
  }
});

describe("sample plot on Thong Lo (25 m), condo", () => {
  const [a, b] = designsFor();

  it("A is a high-rise using the full FAR and passes every rule", () => {
    assert.equal(a.feasible, true);
    assert.ok(a.totals.roofM >= 23, `roof ${a.totals.roofM}`);
    assert.ok(a.totals.gfaM2 <= 7 * SAMPLE_AREA + 0.5);
    assert.ok(a.totals.gfaM2 > 0.95 * 7 * SAMPLE_AREA, `uses ${a.totals.far} of FAR 7`);
    assert.deepEqual(fails(a), []);
    assert.equal(row(a, "eia").status, "flag"); // a flag, not a fail
  });

  it("A keeps 6 m fire-truck access to every side boundary", () => {
    assert.equal(row(a, "fire-road").status, "pass");
  });

  it("A's parking podium holds the spaces it needs", () => {
    assert.ok(a.totals.parkingProvided >= a.totals.parkingRequired);
  });

  it("A's unit count follows 1 unit per 50 m² of residential floor, 70/30 mix", () => {
    const u = a.totals.units!;
    const residential = a.floorTable
      .filter((r) => r.use === "residential")
      .reduce((s, r) => s + r.totalM2, 0);
    assert.equal(u.total, Math.floor(residential / 50));
    assert.equal(u.oneBed + u.twoBed, u.total);
    assert.equal(u.oneBed, Math.round(u.total * 0.7));
  });

  it("B stays a mid-rise: roof under 23 m and floor area under 10,000 m²", () => {
    assert.equal(b.feasible, true);
    assert.ok(b.totals.roofM < 23, `roof ${b.totals.roofM}`);
    assert.ok(b.totals.gfaM2 < 10_000, `gfa ${b.totals.gfaM2}`);
    assert.deepEqual(fails(b), []);
  });

  it("A gives much more floor area than B (the trade-off the two designs show)", () => {
    assert.ok(a.totals.gfaM2 > 2 * b.totals.gfaM2);
  });
});

describe("road and type changes", () => {
  it("on an 8 m soi, A fails road access for a high-rise; B still passes", () => {
    const [a, b] = designsFor({ roadWidthM: 8 });
    assert.equal(row(a, "highrise-access").status, "fail");
    assert.deepEqual(fails(b), []);
  });

  it("an office B on this plot fails parking (1 space per 60 m²) and shows it", () => {
    const [, b] = designsFor({ type: "office" });
    assert.equal(row(b, "parking").status, "fail");
  });

  it("a hotel A reports rooms and passes the hotel road rule on Thong Lo", () => {
    const [a] = designsFor({ type: "hotel" });
    assert.ok((a.totals.rooms ?? 0) > 80);
    assert.equal(row(a, "use").status, "pass");
  });
});

describe("tiny plot", () => {
  it("shows failing rows instead of hiding the designs", () => {
    const tiny: XY[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    for (const d of designsFor({ ring: tiny, areaM2: 100 })) {
      assert.equal(d.feasible, false);
      assert.ok(fails(d).length > 0);
    }
  });
});

describe("parking rules (Bangkok ordinance cl. 84–85)", () => {
  it("hotel room rule: 10 for the first 30 rooms, 1 per 5 to 100, then 1 per 10", () => {
    assert.equal(hotelRoomSpaces(20), 10);
    assert.equal(hotelRoomSpaces(100), 24);
    assert.equal(hotelRoomSpaces(150), 29);
  });

  it("the higher figure wins, fractions round up", () => {
    assert.equal(parkingRequired("condo", 12_001, 0), 101);
    assert.equal(parkingRequired("office", 6_001, 0), 101);
    // 100 rooms on 3,000 m²: room rule 24 beats 25 by area? 3,000/120 = 25 -> 25.
    assert.equal(parkingRequired("hotel", 3_000, 100), 25);
  });
});
