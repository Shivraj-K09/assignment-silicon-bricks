import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeRules, roadLineSetback, type RulesInput } from "../src/lib/rules.ts";

/** The sample plot on Thong Lo, as a condo. */
const BASE: RulesInput = {
  zone: "ย.9",
  zonesTouched: ["ย.9"],
  plotAreaM2: 3670,
  frontageM: 62,
  roadName: "Thong Lo",
  roadWidthM: 25,
  buildingType: "condo",
  station: { name: "Thong Lo", distanceM: 1500 },
  plannedRoads: [],
};
const rules = (over: Partial<RulesInput> = {}) => computeRules({ ...BASE, ...over });
const item = (r: ReturnType<typeof rules>, id: string) => {
  const found = r.items.find((i) => i.id === id);
  assert.ok(found, `rule item ${id} missing`);
  return found;
};
const near = (a: number, b: number, tol = 1e-9) =>
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} ≈ ${b}`);

describe("road building line (MR 55 cl. 41, BMA cl. 50)", () => {
  it("is 2 m from the edge on a road over 20 m (Thong Lo, 25 m)", () => {
    near(roadLineSetback(25).m, 2);
  });
  it("is 1/10 of the width on a 10–20 m road", () => {
    near(roadLineSetback(10).m, 1);
    near(roadLineSetback(15).m, 1.5);
    near(roadLineSetback(20).m, 2);
  });
  it("is 6 m from the centreline on a road under 10 m (8 m soi: 2 m from the edge)", () => {
    near(roadLineSetback(8).m, 2);
    near(roadLineSetback(6).m, 3);
  });
  it("is 3 m from the centreline on a road under 6 m (4 m lane: 1 m from the edge)", () => {
    near(roadLineSetback(4).m, 1);
  });
});

describe("computeRules: sample plot, condo", () => {
  it("uses FAR 7 and OSR 4.5% in ย.9", () => {
    const r = rules();
    assert.equal(r.far, 7);
    assert.equal(r.osrPct, 4.5);
    near(r.maxGfaM2, 7 * 3670);
  });

  it("allows a high-rise on Thong Lo (25 m road, 62 m frontage)", () => {
    const r = rules();
    assert.equal(r.highRiseAllowed, true);
    assert.equal(r.envelopeKind, "high-rise");
    near(r.gfaCapM2, r.maxGfaM2); // 25,690 m² is under 30,000, so no road cap
    assert.equal(item(r, "mr33-access").status, "ok");
  });

  it("takes the larger road setback, never the sum: high-rise 6 m, mid-rise 2 m", () => {
    const r = rules();
    assert.deepEqual(r.setbacks["high-rise"], { roadM: 6, sideM: 6 });
    assert.deepEqual(r.setbacks["mid-rise"], { roadM: 2, sideM: 3 });
  });

  it("caps the footprint at 70% for a condo and 90% for an office", () => {
    near(rules().footprintMaxShare, 0.7);
    near(rules({ buildingType: "office" }).footprintMaxShare, 0.9);
  });

  it("finds the zone OSR binding at full FAR: 31.5% of the plot, just above 30%", () => {
    const r = rules();
    const open = item(r, "open-space");
    assert.equal(open.status, "limit");
    assert.match(open.value, /1,156 m²/); // 4.5% × 7 × 3,670 = 1,156.05
  });
});

describe("computeRules: road changes", () => {
  it("forbids a high-rise on an 8 m soi and switches to the mid-rise envelope", () => {
    const r = rules({ roadWidthM: 8 });
    assert.equal(r.highRiseAllowed, false);
    assert.equal(r.envelopeKind, "mid-rise");
    near(r.gfaCapM2, 10_000); // must stay under the extra-large threshold
    assert.equal(item(r, "height-class").status, "limit");
  });

  it("forbids a high-rise with under 12 m of frontage, even on a wide road", () => {
    assert.equal(rules({ frontageM: 10 }).highRiseAllowed, false);
  });

  it("caps floor area at 30,000 m² on a 10–18 m road", () => {
    const r = rules({ plotAreaM2: 5000, roadWidthM: 12 }); // FAR allows 35,000
    near(r.gfaCapM2, 30_000);
    assert.equal(item(r, "mr33-access").status, "limit");
  });

  it("has no road cap on an 18 m+ road", () => {
    const r = rules({ plotAreaM2: 5000, roadWidthM: 18 });
    near(r.gfaCapM2, 35_000);
  });
});

describe("computeRules: building types", () => {
  it("limits a hotel to 80 rooms on a narrow soi far from a station", () => {
    const r = rules({ buildingType: "hotel", roadWidthM: 8 });
    assert.equal(item(r, "hotel-road").value, "Max 80 rooms");
  });

  it("allows a big hotel within 500 m of a station, even on a narrow soi", () => {
    const r = rules({
      buildingType: "hotel",
      roadWidthM: 8,
      station: { name: "Thong Lo", distanceM: 300 },
    });
    assert.equal(item(r, "hotel-road").value, "Allowed");
  });

  it("allows an office over 10,000 m² on Thong Lo (road ≥ 16 m)", () => {
    assert.equal(item(rules({ buildingType: "office" }), "office-road").value, "Allowed");
  });

  it("limits an office on a 12 m road far from a station", () => {
    const r = rules({ buildingType: "office", roadWidthM: 12 });
    assert.equal(item(r, "office-road").status, "limit");
  });
});

describe("computeRules: zone flags", () => {
  it("warns when the plot crosses a zone line", () => {
    const r = rules({ zonesTouched: ["ย.9", "ย.10"] });
    assert.equal(item(r, "zone-crossing").status, "warn");
  });

  it("warns outside ย.9 but still uses that zone's FAR", () => {
    const r = rules({ zone: "ย.10", zonesTouched: ["ย.10"] });
    assert.equal(item(r, "zone").status, "warn");
    assert.equal(r.far, 8);
  });

  it("flags a planned road widening on the frontage", () => {
    const r = rules({ plannedRoads: [{ name: "ข12", widthM: 16 }] });
    assert.equal(item(r, "planned-road").status, "limit");
  });
});

describe("computeRules: extreme road widths", () => {
  it("handles a very narrow 0.5 m lane: no high-rise, building line 2.75 m from the edge", () => {
    const r = rules({ roadWidthM: 0.5 });
    assert.equal(r.highRiseAllowed, false);
    near(r.setbacks["mid-rise"].roadM, 2.75);
  });

  it("handles a very wide 80 m road: high-rise allowed, 6 m setback, no floor-area cap", () => {
    const r = rules({ roadWidthM: 80, plotAreaM2: 5000 });
    assert.equal(r.highRiseAllowed, true);
    near(r.setbacks["high-rise"].roadM, 6);
    near(r.gfaCapM2, 35_000);
  });
});
