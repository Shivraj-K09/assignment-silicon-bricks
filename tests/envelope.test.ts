import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeEnvelope, highRiseDisplayCap, type EnvelopeInput } from "../src/lib/envelope.ts";
import type { XY } from "../src/lib/local-frame.ts";

const near = (a: number, b: number, tol: number) =>
  assert.ok(Math.abs(a - b) <= tol, `expected ${a} to be within ${tol} of ${b}`);

// 50 x 50 m square; edge 0 (south, y = 0) faces the road.
const SQUARE: XY[] = [
  [0, 0],
  [50, 0],
  [50, 50],
  [0, 50],
];
const base: EnvelopeInput = {
  ring: SQUARE,
  frontageEdge: 0,
  roadSetbackM: 6,
  sideSetbackM: 6,
  roadWidthM: 25,
  capM: 1000,
};
const env = (over: Partial<EnvelopeInput> = {}) => computeEnvelope({ ...base, ...over });

/** Highest z among mesh vertices with this (x, y). */
const zAt = (e: ReturnType<typeof env>, x: number, y: number) => {
  let z = -1;
  const p = e.mesh.positions;
  for (let i = 0; i < p.length; i += 3)
    if (Math.abs(p[i] - x) < 1e-6 && Math.abs(p[i + 1] - y) < 1e-6) z = Math.max(z, p[i + 2]);
  return z;
};

describe("computeEnvelope: setbacks", () => {
  it("shrinks a 50 m square by 6 m on every side to 38 x 38 m", () => {
    near(env().footprintM2, 38 * 38, 0.5);
  });

  it("applies the road setback to the frontage edge only", () => {
    // Road side 2 m, other sides 3 m: x 3..47 (44 m), y 2..47 (45 m).
    near(env({ roadSetbackM: 2, sideSetbackM: 3 }).footprintM2, 44 * 45, 0.5);
  });

  it("works for a clockwise ring the same way", () => {
    const cw: XY[] = [
      [0, 0],
      [0, 50],
      [50, 50],
      [50, 0],
    ];
    // Edge 3 of this ring is the south edge (50,0) -> (0,0).
    const e = env({ ring: cw, frontageEdge: 3, roadSetbackM: 2, sideSetbackM: 3 });
    near(e.footprintM2, 44 * 45, 0.5);
    near(e.frontHeightM, 2 * (2 + 25), 1e-6);
  });

  it("follows a non-convex L-shaped plot", () => {
    // 50 x 50 with the north-east 25 x 25 removed; 3 m setbacks all round.
    const L: XY[] = [
      [0, 0],
      [50, 0],
      [50, 25],
      [25, 25],
      [25, 50],
      [0, 50],
    ];
    const e = env({ ring: L, roadSetbackM: 3, sideSetbackM: 3 });
    // Inner L: x 3..47 by y 3..22, plus x 3..22 by y 22..47.
    // Near the inner (reflex) corner (25,25) the setback is a quarter-circle of radius 3 m,
    // not a square notch: the 3 x 3 m square at x,y in 22..25 keeps 9 - 9π/4 m² outside the circle.
    near(e.footprintM2, 44 * 19 + 19 * 25 + (9 - (9 * Math.PI) / 4), 0.2);
  });

  it("returns nothing when the setbacks eat the whole plot", () => {
    const e = env({
      ring: [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
      roadSetbackM: 6,
      sideSetbackM: 6,
    });
    assert.equal(e.footprintM2, 0);
    assert.equal(e.mesh.positions.length, 0);
  });
});

describe("computeEnvelope: road height plane", () => {
  it("allows 2 x (distance to the far side of the road)", () => {
    const e = env();
    // Building line 6 m back on a 25 m road: 2 x (6 + 25) = 62 m.
    near(e.frontHeightM, 62, 1e-6);
    near(zAt(e, 6, 6), 62, 1e-6);
    // Back of the envelope, 44 m from the road edge: 2 x (44 + 25) = 138 m.
    near(e.maxHeightM, 138, 1e-6);
    near(zAt(e, 44, 44), 138, 1e-6);
  });

  it("is much lower on a narrow soi", () => {
    // 8 m soi, mid-rise setback 2 m: 2 x (2 + 8) = 20 m at the building line.
    near(env({ roadWidthM: 8, roadSetbackM: 2, sideSetbackM: 3 }).frontHeightM, 20, 1e-6);
  });

  it("is cut flat at the cap, with the slope kept below it", () => {
    const e = env({ capM: 100 });
    near(e.maxHeightM, 100, 1e-6);
    near(e.frontHeightM, 62, 1e-6);
    // The plane reaches 100 m at 2 x (d + 25) = 100 -> d = 25 m from the road edge.
    near(zAt(e, 6, 25), 100, 1e-6);
  });

  it("gives a flat 23 m box for a mid-rise cap", () => {
    const e = env({ capM: 23, roadSetbackM: 2, sideSetbackM: 3 });
    near(e.frontHeightM, 23, 1e-6);
    near(e.maxHeightM, 23, 1e-6);
  });
});

describe("computeEnvelope: mesh", () => {
  it("produces triangles and outline lines", () => {
    const e = env({ capM: 100 });
    assert.ok(e.mesh.indices.length > 0 && e.mesh.indices.length % 3 === 0);
    assert.ok(e.mesh.lines.length > 0 && e.mesh.lines.length % 6 === 0);
    const maxIndex = Math.max(...e.mesh.indices);
    assert.ok(maxIndex < e.mesh.positions.length / 3);
  });

  it("reports a self-crossing plot instead of crashing", () => {
    const bowtie: XY[] = [
      [0, 0],
      [50, 50],
      [50, 0],
      [0, 50],
    ];
    const e = env({ ring: bowtie });
    assert.ok(e.error || e.footprintM2 >= 0);
  });
});

describe("computeEnvelope: rule switches", () => {
  it("is a flat box at the cap when the road height plane is switched off", () => {
    const e = env({ capM: 100, heightPlane: false });
    near(e.frontHeightM, 100, 1e-6);
    near(e.maxHeightM, 100, 1e-6);
  });

  it("grows back to the plot when both setbacks are switched off (set to 0)", () => {
    near(env({ roadSetbackM: 0, sideSetbackM: 0 }).footprintM2, 50 * 50, 0.5);
  });

  it("shows each setback's effect: road only, then sides only", () => {
    // Road setback 6 m only: 50 x 44. Sides only (6 m on 3 edges): 38 x 44.
    near(env({ roadSetbackM: 6, sideSetbackM: 0 }).footprintM2, 50 * 44, 0.5);
    near(env({ roadSetbackM: 0, sideSetbackM: 6 }).footprintM2, 38 * 44, 0.5);
  });
});

describe("highRiseDisplayCap", () => {
  it("keeps the road plane's slope visible: building-line height + 30 m, to 10 m", () => {
    // Sample plot on Thong Lo: full FAR on 2,301 m² needs ~42 m; the plane is 62 m at the line.
    assert.equal(
      highRiseDisplayCap({ gfaM2: 25_682, usableFootprintM2: 2_301, frontPlaneM: 62 }),
      100,
    );
  });

  it("goes higher when full FAR on a small footprint needs it", () => {
    // 25,000 m² on 500 m²: 50 floors x 3 m x 1.25 = 187.5 -> 190 m.
    assert.equal(
      highRiseDisplayCap({ gfaM2: 25_000, usableFootprintM2: 500, frontPlaneM: 62 }),
      190,
    );
  });

  it("never goes below 30 m", () => {
    assert.equal(highRiseDisplayCap({ gfaM2: 0, usableFootprintM2: 0, frontPlaneM: 0 }), 30);
  });
});
