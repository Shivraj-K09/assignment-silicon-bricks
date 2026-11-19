import * as pcModule from "polygon-clipping";
import type { MultiPolygon, Polygon as PcPolygon, Ring } from "polygon-clipping";
import { triangulate } from "./triangulate.ts";
import { signedArea, type XY } from "./local-frame.ts";

// polygon-clipping's CommonJS build (used by Node) only has a default export;
// its ESM build (used by Vite) has both. This works in both.
export const pc = ((pcModule as unknown as { default?: typeof pcModule }).default ??
  pcModule) as typeof pcModule;

export interface EnvelopeInput {
  /** Plot outline in local metres, open ring, any orientation. */
  ring: XY[];
  /** Index of the edge that faces the road (corner i -> i+1). */
  frontageEdge: number;
  /** Setback from the road edge, m. */
  roadSetbackM: number;
  /** Setback from every other edge, m. */
  sideSetbackM: number;
  /** Legal road width, m. The height plane is measured to the far side of the road. */
  roadWidthM: number;
  /** Flat cap on top of the height plane, m (mid-rise limit, or a display limit). */
  capM: number;
  /**
   * Apply the road height plane (MR 55 cl. 44). Off = flat top at capM, to show
   * what the plane takes away. Default on.
   */
  heightPlane?: boolean;
}

export interface EnvelopeMesh {
  /** xyz triples, metres. */
  positions: number[];
  /** Triangle indices into positions. */
  indices: number[];
  /** Line segments for the outline, xyz pairs. */
  lines: number[];
}

export interface Envelope {
  /** Buildable area after setbacks, as polygons in local metres. */
  footprint: MultiPolygon;
  footprintM2: number;
  /** Allowed height at the front (building line) and at the highest point, m. */
  frontHeightM: number;
  maxHeightM: number;
  mesh: EnvelopeMesh;
  error?: string;
}

const EMPTY: EnvelopeMesh = { positions: [], indices: [], lines: [] };

/** Rounds to 0.1 mm, so the clipping library never sees near-identical points. */
export const snap = (v: number) => Math.round(v * 1e4) / 1e4;

/**
 * Polygon for a segment buffered by r: a "stadium" (two half-circles joined by
 * straight sides). Built as one convex ring, not a rectangle unioned with two
 * discs: their touching edges trip up polygon-clipping's sweep line.
 */
export function segmentBuffer(a: XY, b: XY, r: number): PcPolygon {
  const phi = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const STEPS = 12; // per half-circle
  const step = Math.PI / STEPS;
  // The arc is drawn just OUTSIDE the true circle (vertices at mid-angles, radius
  // r / cos(step/2)), so a setback is never less than r anywhere. The straight
  // sides stay exactly r. An inscribed polygon would leave setbacks ~0.1 m short.
  const R = r / Math.cos(step / 2);
  const ring: Ring = [];
  const arc = (c: XY, start: number) => {
    ring.push([snap(c[0] + r * Math.cos(start)), snap(c[1] + r * Math.sin(start))]);
    for (let i = 0; i < STEPS; i++) {
      const t = start + (i + 0.5) * step;
      ring.push([snap(c[0] + R * Math.cos(t)), snap(c[1] + R * Math.sin(t))]);
    }
    const end = start + Math.PI;
    ring.push([snap(c[0] + r * Math.cos(end)), snap(c[1] + r * Math.sin(end))]);
  };
  // Half-circle around b (the far end), then around a.
  arc(b, phi - Math.PI / 2);
  arc(a, phi + Math.PI / 2);
  ring.push(ring[0]);
  return [ring];
}

/** How sharply the outline turns at b, in degrees (0 = straight on). */
function turnDeg(a: [number, number], b: [number, number], c: [number, number]): number {
  const a1 = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
  let d = Math.abs(a2 - a1);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return (d * 180) / Math.PI;
}

const ringArea = (r: Ring) => Math.abs(signedArea(r.slice(0, -1) as XY[]));
export const polygonArea = (p: PcPolygon) =>
  ringArea(p[0]) - p.slice(1).reduce((s, h) => s + ringArea(h), 0);

/**
 * The plot minus a strip along each edge: the road setback along the frontage
 * edge, the side setback along the others. Throws on a self-crossing outline.
 * Cheap: always built from the plot's own few edges.
 */
export function buildableFootprint(
  ring: XY[],
  frontageEdge: number,
  roadSetbackM: number,
  sideSetbackM: number,
): MultiPolygon {
  const n = ring.length;
  const closed = [...ring, ring[0]].map(([x, y]) => [snap(x), snap(y)] as [number, number]);
  const plot: PcPolygon = [closed];
  const strips: PcPolygon[] = [];
  for (let i = 0; i < n; i++) {
    const s = i === frontageEdge % n ? roadSetbackM : sideSetbackM;
    if (s > 0) strips.push(segmentBuffer(ring[i], ring[(i + 1) % n], s));
  }
  return (strips.length ? pc.difference(plot, ...strips) : [plot]).filter(
    (p) => polygonArea(p) >= 1,
  );
}

/**
 * The space a building may fill: the plot shrunk by its setbacks, topped by the
 * road height plane (height <= 2 x distance to the far side of the road), capped.
 */
export function computeEnvelope(input: EnvelopeInput): Envelope {
  const { ring, frontageEdge, roadSetbackM, sideSetbackM, roadWidthM: W, capM } = input;
  const usePlane = input.heightPlane ?? true;
  const n = ring.length;
  if (n < 3) return { footprint: [], footprintM2: 0, frontHeightM: 0, maxHeightM: 0, mesh: EMPTY };

  // Signed distance from the frontage line, positive into the plot.
  const fa = ring[frontageEdge % n];
  const fb = ring[(frontageEdge + 1) % n];
  const orient = signedArea(ring) >= 0 ? 1 : -1;
  const flen = Math.hypot(fb[0] - fa[0], fb[1] - fa[1]) || 1;
  const ux = (fb[0] - fa[0]) / flen;
  const uy = (fb[1] - fa[1]) / flen;
  // Inward normal: left of the edge for a counter-clockwise ring.
  const nx = -uy * orient;
  const ny = ux * orient;
  const dist = (x: number, y: number) => (x - fa[0]) * nx + (y - fa[1]) * ny;
  const heightAt = (x: number, y: number) =>
    usePlane ? Math.min(capM, 2 * (Math.max(0, dist(x, y)) + W)) : capM;

  let footprint: MultiPolygon;
  try {
    footprint = buildableFootprint(ring, frontageEdge, roadSetbackM, sideSetbackM);
  } catch (e) {
    return {
      footprint: [],
      footprintM2: 0,
      frontHeightM: 0,
      maxHeightM: 0,
      mesh: EMPTY,
      error: `Could not compute the envelope: ${(e as Error).message}. Is the plot outline crossing itself?`,
    };
  }
  // Drop slivers under 1 m².
  footprint = footprint.filter((p) => polygonArea(p) >= 1);
  const footprintM2 = footprint.reduce((s, p) => s + polygonArea(p), 0);
  if (!footprint.length)
    return { footprint, footprintM2: 0, frontHeightM: 0, maxHeightM: 0, mesh: EMPTY };

  // Split at the contour where the plane reaches the cap: sloped part / flat part.
  // Without the plane the top is flat: no split needed.
  const dCap = usePlane ? capM / 2 - W : -Infinity;
  const BIG = 1e5;
  const halfPlane = (from: number, to: number): PcPolygon => {
    const p = (t: number, d: number): [number, number] => [
      fa[0] + ux * t + nx * d,
      fa[1] + uy * t + ny * d,
    ];
    return [[p(-BIG, from), p(BIG, from), p(BIG, to), p(-BIG, to), p(-BIG, from)]];
  };
  const parts: MultiPolygon =
    dCap <= -BIG / 2
      ? footprint
      : [
          ...pc.intersection(footprint, halfPlane(-BIG, dCap)),
          ...pc.intersection(footprint, halfPlane(dCap, BIG)),
        ];

  const mesh: EnvelopeMesh = { positions: [], indices: [], lines: [] };
  const onSplit = (p: [number, number]) => Math.abs(dist(p[0], p[1]) - dCap) < 1e-6;
  let maxH = 0;
  let frontH = Infinity;

  for (const poly of parts) {
    if (polygonArea(poly) < 0.01) continue;
    const contour = poly[0].slice(0, -1).map(([x, y]) => ({ x, y }));
    const holes = poly.slice(1).map((h) => h.slice(0, -1).map(([x, y]) => ({ x, y })));
    const base = mesh.positions.length / 3;
    const all = [...contour, ...holes.flat()];
    for (const v of all) {
      const h = heightAt(v.x, v.y);
      maxH = Math.max(maxH, h);
      frontH = Math.min(frontH, h);
      mesh.positions.push(v.x, v.y, h);
    }
    for (const tri of triangulate(contour, holes)) {
      mesh.indices.push(base + tri[0], base + tri[1], base + tri[2]);
    }

    // Walls and outlines, ring by ring; edges on the internal split line are skipped.
    for (const r of poly) {
      for (let i = 0; i < r.length - 1; i++) {
        const a = r[i];
        const b = r[i + 1];
        if (onSplit(a) && onSplit(b)) continue;
        const ha = heightAt(a[0], a[1]);
        const hb = heightAt(b[0], b[1]);
        const w = mesh.positions.length / 3;
        mesh.positions.push(a[0], a[1], 0, b[0], b[1], 0, b[0], b[1], hb, a[0], a[1], ha);
        mesh.indices.push(w, w + 1, w + 2, w, w + 2, w + 3);
        mesh.lines.push(a[0], a[1], ha, b[0], b[1], hb); // top edge
        mesh.lines.push(a[0], a[1], 0, b[0], b[1], 0); // ground edge
        // Corner post only at real corners, not along the rounded setback curves.
        const prev = r[i === 0 ? r.length - 2 : i - 1];
        if (!onSplit(a) && turnDeg(prev, a, b) > 20) {
          mesh.lines.push(a[0], a[1], 0, a[0], a[1], ha);
        }
      }
    }
  }

  return {
    footprint,
    footprintM2,
    frontHeightM: Number.isFinite(frontH) ? frontH : 0,
    maxHeightM: maxH,
    mesh,
  };
}

/** Assumed floor-to-floor height for the display cap, m (notes 5e: 3.0 m residential). */
const CAP_FLOOR_M = 3;

/**
 * How high to draw a high-rise envelope. There is no fixed height limit in ย.9;
 * FAR limits floor area. The plan: "the height needed for full FAR + margin, so it
 * reads on screen". Two parts, the larger wins, rounded up to 10 m:
 * - full FAR stacked on the usable footprint, plus 25%;
 * - the road plane's height at the building line plus 30 m, so the slope of the
 *   height rule stays visible above it.
 */
export function highRiseDisplayCap(input: {
  gfaM2: number;
  usableFootprintM2: number;
  frontPlaneM: number;
}): number {
  const { gfaM2, usableFootprintM2, frontPlaneM } = input;
  const forFar = usableFootprintM2 > 0 ? (gfaM2 / usableFootprintM2) * CAP_FLOOR_M * 1.25 : 0;
  const forSlope = frontPlaneM + 30;
  return Math.ceil(Math.max(forFar, forSlope, 30) / 10) * 10;
}
