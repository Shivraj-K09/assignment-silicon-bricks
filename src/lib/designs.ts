/**
 * Two concept designs for a plot, each with a floor table that adds up and a
 * pass / fail checklist. Pure functions in local metres.
 *
 * A: tower on a parking podium (high-rise, maximum floor area).
 * B: mid-rise block under 23 m around a courtyard (simpler, faster permit).
 *
 * Design numbers are research-notes 5e / 5f: floor heights, unit mix, parking
 * ratios. Assumptions are labelled as such in the checklist.
 */
import type { MultiPolygon, Polygon as PcPolygon, Ring } from "polygon-clipping";
import { buildableFootprint, pc, polygonArea, snap } from "./envelope.ts";
import { signedArea, type XY } from "./local-frame.ts";
import {
  BUILDING_TYPES,
  EXTRA_LARGE_M2,
  HIGH_RISE_M,
  HOTEL_M2_PER_ROOM,
  VERY_LARGE_M2,
  type BuildingType,
  type Citation,
  type Rules,
} from "./rules.ts";

// ---- Design constants (research notes 5e, 5f) ------------------------------------

/** Floor-to-floor of the main use, m. */
export const FLOOR_M: Record<BuildingType, number> = { condo: 3.0, hotel: 3.2, office: 3.6 };
/** Ground-floor lobby, m. */
export const LOBBY_M = 4.5;
/** Parking podium floor, m. */
export const PARKING_FLOOR_M = 3.0;
/** Parapet above the roof slab, counted for the road height rule (notes 5a). Assumption. */
export const PARAPET_M = 1.0;
/** Parking area per space: bay plus its share of aisles and ramps, m² (notes 5e). */
export const M2_PER_SPACE = 30;
/** Condo: one unit per 50 m² of residential floor (75% sellable / 37.5 m² average). */
export const CONDO_M2_PER_UNIT = 50;
export const SELLABLE_SHARE = 0.75;
/** Unit mix by number of units: 70% 1-bed (30 m²), 30% 2-bed (55 m²). */
export const ONE_BED_SHARE = 0.7;
/** Tower floor plate depth: double-loaded slab, m (notes 5e: 18–22 m). */
export const TOWER_DEPTH_M = 20;
/** Longest tower plate, m. Longer is a wall, not a tower. */
export const TOWER_MAX_LENGTH_M = 60;
export const TOWER_MIN_LENGTH_M = 12;
/** Mid-rise block depth around the courtyard, m. */
export const SLAB_DEPTH_M = 18;
/** Courtyards smaller than this are filled in (too small to light flats). */
export const MIN_COURTYARD_M2 = 150;
/** Share of a mid-rise ground floor used for covered parking; the rest is lobby. */
export const GROUND_PARKING_SHARE = 0.85;
/** Narrowest buildable block, m: below this no flat or corridor fits. Assumption. */
export const MIN_BLOCK_WIDTH_M = 6;

// ---- Types -----------------------------------------------------------------------

export type Use = "lobby" | "parking" | "residential" | "hotel" | "office";

/** A stack of identical floors with one footprint. */
export interface DesignPart {
  id: string;
  use: Use;
  footprint: MultiPolygon;
  baseM: number;
  floors: number;
  floorM: number;
}

export interface FloorRow {
  label: string;
  use: Use;
  floors: number;
  areaPerFloorM2: number;
  totalM2: number;
  fromM: number;
  toM: number;
}

export type CheckStatus = "pass" | "fail" | "flag" | "info";

export interface CheckRow {
  id: string;
  label: string;
  value: string;
  status: CheckStatus;
  detail: string;
  cite: Citation[];
}

export interface DesignTotals {
  gfaM2: number;
  far: number;
  storeys: number;
  roofM: number;
  footprintM2: number;
  openSpaceM2: number;
  /** Condo only. */
  units?: { total: number; oneBed: number; twoBed: number; sellableM2: number };
  /** Hotel only. */
  rooms?: number;
  parkingRequired: number;
  parkingProvided: number;
}

export interface Design {
  id: "A" | "B";
  name: string;
  summary: string;
  parts: DesignPart[];
  floorTable: FloorRow[];
  totals: DesignTotals;
  checklist: CheckRow[];
  /** False when no building fits at all (tiny plot). */
  feasible: boolean;
}

export interface DesignInput {
  /** Plot outline in local metres, open ring. */
  ring: XY[];
  frontageEdge: number;
  roadWidthM: number;
  frontageM: number;
  buildingType: BuildingType;
  areaM2: number;
  rules: Rules;
  station: { name: string; distanceM: number } | null;
  plotIssues: { collidingBuildings: number; crossingRoads: string[]; outsideData: boolean };
}

// ---- Geometry helpers --------------------------------------------------------------

const areaOf = (mp: MultiPolygon) => mp.reduce((s, p) => s + polygonArea(p), 0);

/**
 * A footprint as a function of extra setback on every side. Always rebuilt from
 * the plot's own few edges (fast), never by shrinking an already-shrunk shape
 * (whose rounded corners would multiply).
 */
type FootprintAt = (extraM: number) => MultiPolygon;

const safe = (fn: () => MultiPolygon): MultiPolygon => {
  try {
    return fn();
  } catch {
    return [];
  }
};

/** Smallest extra setback whose measured area is at most target (binary search). */
function shrinkUntil(
  fromExtra: number,
  measure: (extraM: number) => number,
  target: number,
): number | null {
  if (measure(fromExtra) <= target) return fromExtra;
  let lo = fromExtra;
  let hi = fromExtra + 40;
  if (measure(hi) > target) return null;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (measure(mid) <= target) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Road-aligned frame: u along the frontage edge, v = distance into the plot. */
function frontageFrame(ring: XY[], edge: number) {
  const n = ring.length;
  const a = ring[edge % n];
  const b = ring[(edge + 1) % n];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  const o = signedArea(ring) >= 0 ? 1 : -1;
  const nx = -uy * o;
  const ny = ux * o;
  return {
    toUV: ([x, y]: XY): XY => [
      (x - a[0]) * ux + (y - a[1]) * uy,
      (x - a[0]) * nx + (y - a[1]) * ny,
    ],
    fromUV: ([u, v]: XY): [number, number] => [
      snap(a[0] + ux * u + nx * v),
      snap(a[1] + uy * u + ny * v),
    ],
    v: ([x, y]: XY) => (x - a[0]) * nx + (y - a[1]) * ny,
  };
}
type Frame = ReturnType<typeof frontageFrame>;

/** u-intervals where the horizontal line at v lies inside the shape (even-odd rule). */
function insideIntervals(uvRings: XY[][], v: number): [number, number][] {
  const xs: number[] = [];
  for (const r of uvRings) {
    for (let i = 0; i < r.length - 1; i++) {
      const [u1, v1] = r[i];
      const [u2, v2] = r[i + 1];
      // Half-open [min, max): a line through a vertex is counted once, not twice.
      if (v >= Math.min(v1, v2) && v < Math.max(v1, v2)) {
        xs.push(u1 + ((v - v1) * (u2 - u1)) / (v2 - v1));
      }
    }
  }
  xs.sort((p, q) => p - q);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
  return out;
}

function intersectIntervals(a: [number, number][], b: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const [a0, a1] of a)
    for (const [b0, b1] of b) {
      const lo = Math.max(a0, b0);
      const hi = Math.min(a1, b1);
      if (hi - lo > 1e-6) out.push([lo, hi]);
    }
  return out;
}

/**
 * Candidate tower plates: rectangles TOWER_DEPTH_M deep, parallel to the road,
 * fully inside the shape, one per depth position v0 (0.5 m steps).
 */
function towerCandidates(shape: MultiPolygon, f: Frame) {
  const uvRings = shape.flatMap((p) => p.map((r) => r.map((pt) => f.toUV(pt as XY))));
  if (!uvRings.length) return [];
  const vs = uvRings.flat().map((p) => p[1]);
  const vMin = Math.min(...vs);
  const vMax = Math.max(...vs);
  const out: { v0: number; u0: number; length: number }[] = [];
  const step = 0.5;
  for (let v0 = vMin + 0.01; v0 + TOWER_DEPTH_M <= vMax - 0.01; v0 += step) {
    let common: [number, number][] | null = null;
    for (let v = v0; v <= v0 + TOWER_DEPTH_M + 1e-9; v += step) {
      const iv = insideIntervals(uvRings, v);
      common = common ? intersectIntervals(common, iv) : iv;
      if (!common.length) break;
    }
    if (!common?.length) continue;
    const [lo, hi] = common.reduce((m, c) => (c[1] - c[0] > m[1] - m[0] ? c : m));
    const length = Math.min(hi - lo, TOWER_MAX_LENGTH_M);
    if (length < TOWER_MIN_LENGTH_M) continue;
    out.push({ v0, u0: (lo + hi) / 2 - length / 2, length });
  }
  return out;
}

function rectUV(f: Frame, u0: number, v0: number, length: number, depth: number): MultiPolygon {
  const p = (u: number, v: number) => f.fromUV([u, v]);
  return [
    [[p(u0, v0), p(u0 + length, v0), p(u0 + length, v0 + depth), p(u0, v0 + depth), p(u0, v0)]],
  ];
}

const minV = (mp: MultiPolygon, f: Frame) =>
  Math.min(...mp.flatMap((p) => p.flatMap((r) => r.map((pt) => f.v(pt as XY)))));

/** Smallest distance from any vertex/edge of `shape` to plot edges other than the frontage. */
function minSideGap(shape: MultiPolygon, ring: XY[], frontageEdge: number): number {
  const segDist = (p: XY, a: XY, b: XY) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };
  let best = Infinity;
  const pts = shape.flatMap((p) => p[0].map((pt) => pt as XY));
  const shapeSegs = shape.flatMap((p) =>
    p[0].slice(0, -1).map((pt, i) => [pt as XY, p[0][i + 1] as XY] as const),
  );
  for (let i = 0; i < ring.length; i++) {
    if (i === frontageEdge) continue;
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    for (const p of pts) best = Math.min(best, segDist(p, a, b));
    for (const [s0, s1] of shapeSegs) best = Math.min(best, segDist(a, s0, s1), segDist(b, s0, s1));
  }
  return best;
}

/** The road-facing face for the L/8 rule (Bangkok ordinance cl. 53). */
function frontFace(shape: MultiPolygon, f: Frame) {
  const outer = shape.map((p) => p[0]);
  const perimeter = outer.reduce(
    (s, r) =>
      s +
      r
        .slice(0, -1)
        .reduce((t, pt, i) => t + Math.hypot(r[i + 1][0] - pt[0], r[i + 1][1] - pt[1]), 0),
    0,
  );
  const vFront = minV(shape, f);
  let faceLen = 0;
  for (const r of outer)
    for (let i = 0; i < r.length - 1; i++) {
      const a = r[i] as XY;
      const b = r[i + 1] as XY;
      if (f.v(a) <= vFront + 1 && f.v(b) <= vFront + 1)
        faceLen += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
  return { perimeter, faceLen, distanceM: vFront };
}

/** Area of a shape lying outside the envelope footprint, m² (0 if it cannot be computed). */
function areaOutside(shape: MultiPolygon, envelopeFootprint: MultiPolygon): number {
  return areaOf(safe(() => pc.difference(shape, envelopeFootprint)));
}

// ---- Parking (Bangkok ordinance cl. 83–85) ----------------------------------------

/** Spaces for a hotel by room count, cl. 84(2). */
export function hotelRoomSpaces(rooms: number): number {
  if (rooms <= 30) return rooms > 0 ? 10 : 0;
  if (rooms <= 100) return 10 + Math.ceil((rooms - 30) / 5);
  return 24 + Math.ceil((rooms - 100) / 10);
}

/** Spaces required. Non-parking floor area excludes the parking floors (notes 5e). */
export function parkingRequired(type: BuildingType, nonParkingM2: number, rooms: number): number {
  if (type === "office") return Math.ceil(nonParkingM2 / 60);
  const byArea = Math.ceil(nonParkingM2 / 120);
  if (type === "hotel") return Math.max(byArea, hotelRoomSpaces(rooms));
  // Condo: all units are under 60 m², so the 1-per-unit rule never applies (notes 5e).
  return byArea;
}

// ---- Shared output builders ---------------------------------------------------------

const fmt = (n: number, dp = 0) => n.toLocaleString("en-US", { maximumFractionDigits: dp });

function floorTable(parts: DesignPart[]): FloorRow[] {
  let level = 1;
  const rows: FloorRow[] = [];
  for (const p of [...parts].sort((a, b) => a.baseM - b.baseM)) {
    if (p.floors <= 0) continue;
    const per = areaOf(p.footprint);
    const first = level;
    level += p.floors;
    rows.push({
      label: p.floors === 1 ? `Level ${first}` : `Levels ${first}–${level - 1}`,
      use: p.use,
      floors: p.floors,
      areaPerFloorM2: per,
      totalM2: per * p.floors,
      fromM: p.baseM,
      toM: p.baseM + p.floors * p.floorM,
    });
  }
  return rows;
}

const MAIN_USE: Record<BuildingType, Use> = {
  condo: "residential",
  hotel: "hotel",
  office: "office",
};

/** Checklist rows both designs share. `ground` is the footprint on the ground. */
function commonChecks(
  input: DesignInput,
  d: { gfa: number; ground: MultiPolygon; parts: DesignPart[] },
  f: Frame,
  envelopeFootprint: MultiPolygon,
  setbacks: { roadM: number; sideM: number },
  parking: { required: number; provided: number; note: string },
): CheckRow[] {
  const { rules, areaM2: A, roadWidthM: W } = input;
  const rows: CheckRow[] = [];
  const footprint = areaOf(d.ground);
  const open = A - footprint;

  // Plot problems carry into every design.
  const issues = [
    input.plotIssues.collidingBuildings
      ? `cuts ${input.plotIssues.collidingBuildings} neighbouring building(s)`
      : "",
    input.plotIssues.crossingRoads.length
      ? `contains public road(s): ${input.plotIssues.crossingRoads.join(", ")}`
      : "",
    input.plotIssues.outsideData ? "is outside the area with building data" : "",
  ].filter(Boolean);
  rows.push({
    id: "plot",
    label: "Plot outline",
    value: issues.length ? "Check the plot" : "OK",
    status: issues.length ? "fail" : "pass",
    detail: issues.length
      ? `The plot ${issues.join("; ")}. Fix the outline before relying on this design.`
      : "The plot cuts no building and contains no public road.",
    cite: [{ source: "osm", clause: "buildings and roads" }],
  });

  rows.push({
    id: "far",
    label: "Floor area within FAR",
    value: `${fmt(d.gfa)} / ${fmt(rules.maxGfaM2)} m²`,
    status: d.gfa <= rules.maxGfaM2 + 0.5 ? "pass" : "fail",
    detail: `Total floor area (every floor in the table, including parking and lobby) ≤ FAR ${rules.far} × plot ${fmt(A)} m².`,
    cite: [
      { source: "plan", clause: "Zone table" },
      { source: "mr33", clause: "cl. 1 (floor area)" },
    ],
  });

  const outside = areaOutside(d.ground, envelopeFootprint);
  rows.push({
    id: "setbacks",
    label: "Setbacks",
    value: `road ${fmt(setbacks.roadM, 1)} m, sides ${fmt(setbacks.sideM, 1)} m`,
    status: outside < 0.5 ? "pass" : "fail",
    detail:
      outside < 0.5
        ? "Every part of the building is inside the setback lines."
        : `${fmt(outside)} m² of the building is outside the setback lines.`,
    cite: [
      { source: "mr55", clause: "cl. 41, 50" },
      { source: "bma", clause: "cl. 50, 54" },
      { source: "mr33", clause: "cl. 4" },
    ],
  });

  // Height plane: each part's top (top part with parapet) vs its nearest point to the road.
  let worst = Infinity;
  const tops = d.parts.map((p) => p.baseM + p.floors * p.floorM);
  const highest = Math.max(...tops);
  d.parts.forEach((p, i) => {
    if (p.floors <= 0) return;
    const top = tops[i] + (tops[i] === highest ? PARAPET_M : 0);
    const allowed = 2 * (minV(p.footprint, f) + W);
    worst = Math.min(worst, allowed - top);
  });
  rows.push({
    id: "height-plane",
    label: "Height from the road",
    value: worst >= -0.01 ? `${fmt(worst, 1)} m to spare` : `${fmt(-worst, 1)} m too high`,
    status: worst >= -0.01 ? "pass" : "fail",
    detail: `Every part, including a ${PARAPET_M} m parapet on the top roof (assumption), stays under 2 × its distance to the far side of the ${fmt(W)} m road.`,
    cite: [
      { source: "mr55", clause: "cl. 44" },
      { source: "bma", clause: "cl. 49" },
    ],
  });

  rows.push({
    id: "footprint",
    label: "Footprint",
    value: `${fmt(footprint)} m² (${fmt((footprint / A) * 100, 1)}% of plot)`,
    status: footprint <= rules.footprintMaxShare * A + 0.5 ? "pass" : "fail",
    detail: `At most ${fmt(rules.footprintMaxShare * 100)}% of the plot (${fmt(rules.footprintMaxShare * A)} m²).`,
    cite: [{ source: "bma", clause: "cl. 52(1)" }],
  });

  const openNeed = Math.max(rules.openSpaceMinShareOfPlot * A, (rules.osrPct / 100) * d.gfa);
  rows.push({
    id: "open-space",
    label: "Open space",
    value: `${fmt(open)} / ${fmt(openNeed)} m² needed`,
    status: open + 0.5 >= openNeed ? "pass" : "fail",
    detail: `The larger of ${fmt(rules.openSpaceMinShareOfPlot * 100)}% of the plot and OSR ${rules.osrPct}% × floor area. Half must be planted ground (assumed in the landscape design; not drawn).`,
    cite: [
      { source: "plan", clause: "OSR" },
      { source: "bma", clause: "cl. 52(1)" },
    ],
  });

  const face = frontFace(d.ground, f);
  const l8ok = face.faceLen > face.perimeter / 8 && face.distanceM <= 20;
  rows.push({
    id: "l8",
    label: "Fire access face (L/8)",
    value: `${fmt(face.faceLen)} m face, needs > ${fmt(face.perimeter / 8, 1)} m`,
    status: l8ok ? "pass" : "fail",
    detail: `The face along the road must be longer than 1/8 of the building's outer perimeter (${fmt(face.perimeter)} m) and within 20 m of the road (it is ${fmt(face.distanceM, 1)} m).`,
    cite: [{ source: "bma", clause: "cl. 52(6), 53" }],
  });

  rows.push({
    id: "parking",
    label: "Parking",
    value: `${fmt(parking.provided)} / ${fmt(parking.required)} spaces`,
    status: parking.provided >= parking.required ? "pass" : "fail",
    detail: `${parking.note} ${M2_PER_SPACE} m² per space including aisles and ramps (assumption).`,
    cite: [
      { source: "bma", clause: "cl. 83–85" },
      { source: "assumption", clause: "30 m² per space" },
    ],
  });
  return rows;
}

function useChecks(input: DesignInput, gfa: number, rooms: number, units: number): CheckRow[] {
  const { buildingType: t, roadWidthM: W, frontageM } = input;
  const nearStation = (input.station?.distanceM ?? Infinity) <= 500;
  const rows: CheckRow[] = [];
  if (t === "hotel") {
    const needsRoad = rooms > 80;
    const ok = !needsRoad || nearStation || (W >= 12 && frontageM >= 12);
    rows.push({
      id: "use",
      label: "Hotel size on this road",
      value: `${fmt(rooms)} rooms`,
      status: ok ? "pass" : "fail",
      detail: `Over 80 rooms needs a road ≥ 12 m with ≥ 12 m frontage, or a rail station within 500 m.`,
      cite: [{ source: "plan", clause: "cl. 16, 36" }],
    });
  } else if (t === "office") {
    const ok = gfa <= EXTRA_LARGE_M2 || nearStation || (W >= 16 && frontageM >= 16);
    rows.push({
      id: "use",
      label: "Office size on this road",
      value: `${fmt(gfa)} m²`,
      status: ok ? "pass" : "fail",
      detail: `Over 10,000 m² needs a road ≥ 16 m with ≥ 16 m frontage, or a rail station within 500 m.`,
      cite: [{ source: "plan", clause: "cl. 16, 36" }],
    });
  } else {
    rows.push({
      id: "use",
      label: "Use allowed in zone",
      value: "Condominium",
      status: "pass",
      detail: "Residential use is allowed in ย.9 without a road-width condition.",
      cite: [{ source: "plan", clause: "cl. 16" }],
    });
  }
  // EIA: condo ≥ 80 units or ≥ 4,000 m²; hotel ≥ 80 rooms. A flag, not a fail.
  const eia = t === "condo" ? units >= 80 || gfa >= 4000 : t === "hotel" ? rooms >= 80 : false;
  rows.push({
    id: "eia",
    label: "Environmental impact assessment",
    value: t === "office" ? "Not checked" : eia ? "Required" : "Not required",
    status: t === "office" ? "info" : eia ? "flag" : "pass",
    detail:
      t === "office"
        ? "EIA thresholds for offices are not modelled."
        : "Condos with 80+ units or 4,000+ m², hotels with 80+ rooms need an EIA reviewed by ONEP (about 6 months). Hotel threshold conflicts across sources (60 or 80 rooms). Source: secondary.",
    cite: [{ source: "assumption", clause: "EIA thresholds, notes §5b" }],
  });
  return rows;
}

function totalsFor(
  input: DesignInput,
  parts: DesignPart[],
  ground: MultiPolygon,
  parking: { required: number; provided: number },
): DesignTotals {
  const gfa = parts.reduce((s, p) => s + areaOf(p.footprint) * p.floors, 0);
  const tops = parts.filter((p) => p.floors > 0).map((p) => p.baseM + p.floors * p.floorM);
  const roof = tops.length ? Math.max(...tops) : 0;
  const main = parts.filter((p) => p.use === MAIN_USE[input.buildingType]);
  const mainGfa = main.reduce((s, p) => s + areaOf(p.footprint) * p.floors, 0);
  const t: DesignTotals = {
    gfaM2: gfa,
    far: gfa / input.areaM2,
    storeys: parts.reduce((s, p) => s + p.floors, 0),
    roofM: roof,
    footprintM2: areaOf(ground),
    openSpaceM2: input.areaM2 - areaOf(ground),
    parkingRequired: parking.required,
    parkingProvided: parking.provided,
  };
  if (input.buildingType === "condo") {
    const total = Math.floor(mainGfa / CONDO_M2_PER_UNIT);
    const oneBed = Math.round(total * ONE_BED_SHARE);
    t.units = { total, oneBed, twoBed: total - oneBed, sellableM2: mainGfa * SELLABLE_SHARE };
  }
  if (input.buildingType === "hotel") t.rooms = Math.floor(mainGfa / HOTEL_M2_PER_ROOM);
  return t;
}

function infeasible(id: "A" | "B", name: string, why: string): Design {
  return {
    id,
    name,
    summary: why,
    parts: [],
    floorTable: [],
    totals: {
      gfaM2: 0,
      far: 0,
      storeys: 0,
      roofM: 0,
      footprintM2: 0,
      openSpaceM2: 0,
      parkingRequired: 0,
      parkingProvided: 0,
    },
    checklist: [
      {
        id: "fit",
        label: "Building fits on the plot",
        value: "No",
        status: "fail",
        detail: why,
        cite: [{ source: "mr33", clause: "cl. 4" }],
      },
    ],
    feasible: false,
  };
}

// ---- Design A checks ----------------------------------------------------------------------

/** How the parking requirement is worded in the checklist (Bangkok ordinance cl. 84). */
const PARKING_RULE_TEXT: Record<BuildingType, string> = {
  condo: "1 per 120 m²",
  hotel: "the larger of the room rule and 1 per 120 m²",
  office: "1 per 60 m²",
};

/** MR 33 cl. 2: a high-rise needs frontage on a wide enough public road. */
function highRiseAccessCheck(input: DesignInput, totals: DesignTotals): CheckRow {
  const { rules, roadWidthM: W, frontageM } = input;
  const needsWiderRoad = totals.gfaM2 > VERY_LARGE_M2 && W < 18;
  const passes = rules.highRiseAllowed && !needsWiderRoad;
  let value = "OK";
  if (!rules.highRiseAllowed) value = "Not allowed on this road";
  else if (needsWiderRoad) value = "Road too narrow for this size";
  return {
    id: "highrise-access",
    label: "Road access for a high-rise",
    value,
    status: passes ? "pass" : "fail",
    detail: `At ${fmt(totals.roofM, 1)} m this is a high-rise (≥ ${HIGH_RISE_M} m): it needs ≥ 12 m frontage on a public road ≥ 10 m wide (≥ 18 m above ${fmt(VERY_LARGE_M2)} m²). This plot: ${fmt(frontageM, 1)} m on a ${fmt(W)} m road.`,
    cite: [{ source: "mr33", clause: "cl. 2" }],
  };
}

/** Tolerance for the 6 m fire road, m (drawing precision). */
const FIRE_ROAD_TOLERANCE_M = 0.05;

/** MR 33 cl. 3: a 6 m fire-truck road all around a high-rise. */
function fireAccessCheck(building: MultiPolygon, ring: XY[], frontageEdge: number): CheckRow {
  const gap = minSideGap(building, ring, frontageEdge);
  return {
    id: "fire-road",
    label: "6 m fire-truck access around",
    value: `${fmt(gap, 1)} m to the nearest side boundary`,
    status: gap >= 6 - FIRE_ROAD_TOLERANCE_M ? "pass" : "fail",
    detail:
      "A high-rise needs a 6 m fire-truck road all around. Checked as at least 6 m between the building and every side boundary; on the road side the public road counts.",
    cite: [{ source: "mr33", clause: "cl. 3" }],
  };
}

// ---- Design A: tower on a parking podium -------------------------------------------

export function designA(input: DesignInput): Design {
  const NAME = "A · Tower on parking podium";
  const { rules, ring, frontageEdge, roadWidthM: W, areaM2: A, buildingType: type } = input;
  const f = frontageFrame(ring, frontageEdge);
  const sb = rules.setbacks["high-rise"];
  const fpAt: FootprintAt = (extra) =>
    safe(() => buildableFootprint(ring, frontageEdge, sb.roadM + extra, sb.sideM + extra));
  const env = fpAt(0);
  if (areaOf(env) < 100)
    return infeasible(
      "A",
      NAME,
      "The 6 m high-rise setbacks leave no room for a tower on this plot.",
    );

  // Target floor area: the road cap if a high-rise is allowed, else the FAR limit
  // (the design is then shown for comparison and fails the road-access row).
  const target = rules.highRiseAllowed ? rules.gfaCapM2 : rules.maxGfaM2;
  const openNeed = Math.max(rules.openSpaceMinShareOfPlot * A, (rules.osrPct / 100) * target);
  const podiumExtra = shrinkUntil(
    0,
    (e) => areaOf(fpAt(e)),
    Math.min(rules.footprintMaxShare * A, A - openNeed),
  );
  const podium = podiumExtra === null ? [] : fpAt(podiumExtra);
  const P = areaOf(podium);
  if (P < 100) return infeasible("A", NAME, "Open-space rules leave no room for a podium.");

  const ftf = FLOOR_M[type];
  const candidates = towerCandidates(podium, f);
  if (!candidates.length)
    return infeasible(
      "A",
      NAME,
      `No ${TOWER_DEPTH_M} m deep tower plate fits inside the setbacks on this plot.`,
    );

  // Iterate on podium parking floors k: parking depends on the tower's size.
  let best: { k: number; n: number; c: (typeof candidates)[number]; spaces: number } | null = null;
  for (let k = 0, guard = 0; guard < 12; guard++) {
    const podiumTop = LOBBY_M + k * PARKING_FLOOR_M;
    const budget = target - P * (1 + k);
    let pick: { c: (typeof candidates)[number]; n: number } | null = null;
    for (const c of candidates) {
      const plate = TOWER_DEPTH_M * c.length;
      const byPlane = Math.floor((2 * (c.v0 + W) - PARAPET_M - podiumTop) / ftf);
      const n = Math.max(0, Math.min(byPlane, Math.floor(budget / plate)));
      if (!pick || n * plate > pick.n * TOWER_DEPTH_M * pick.c.length) pick = { c, n };
    }
    if (!pick) break;
    const towerGfa = pick.n * TOWER_DEPTH_M * pick.c.length;
    const rooms = type === "hotel" ? Math.floor(towerGfa / HOTEL_M2_PER_ROOM) : 0;
    const spaces = parkingRequired(type, P + towerGfa, rooms);
    const kNeeded = Math.ceil((spaces * M2_PER_SPACE) / P);
    best = { k, n: pick.n, c: pick.c, spaces };
    if (kNeeded <= k) break;
    k = kNeeded;
  }
  if (!best || best.n === 0)
    return infeasible(
      "A",
      NAME,
      "The road height limit and parking leave no room for tower floors.",
    );

  const towerFp = rectUV(f, best.c.u0, best.c.v0, best.c.length, TOWER_DEPTH_M);
  const podiumTop = LOBBY_M + best.k * PARKING_FLOOR_M;
  const parts: DesignPart[] = [
    { id: "lobby", use: "lobby", footprint: podium, baseM: 0, floors: 1, floorM: LOBBY_M },
    {
      id: "parking",
      use: "parking",
      footprint: podium,
      baseM: LOBBY_M,
      floors: best.k,
      floorM: PARKING_FLOOR_M,
    },
    {
      id: "tower",
      use: MAIN_USE[type],
      footprint: towerFp,
      baseM: podiumTop,
      floors: best.n,
      floorM: ftf,
    },
  ];
  const provided = Math.floor((best.k * P) / M2_PER_SPACE);
  const totals = totalsFor(input, parts, podium, { required: best.spaces, provided });

  const checklist = [
    ...commonChecks(input, { gfa: totals.gfaM2, ground: podium, parts }, f, env, sb, {
      required: best.spaces,
      provided,
      note: `${best.k} podium parking floor(s) of ${fmt(P)} m². Required: ${PARKING_RULE_TEXT[type]} of non-parking floor area.`,
    }),
    highRiseAccessCheck(input, totals),
    fireAccessCheck(podium, ring, frontageEdge),
    ...useChecks(input, totals.gfaM2, totals.rooms ?? 0, totals.units?.total ?? 0),
  ];

  return {
    id: "A",
    name: NAME,
    summary: `${best.n}-storey ${BUILDING_TYPES[type].label.toLowerCase()} tower on a ${best.k + 1}-storey podium (lobby + ${best.k} parking). Maximum floor area.`,
    parts,
    floorTable: floorTable(parts),
    totals,
    checklist,
    feasible: true,
  };
}

// ---- Design B: mid-rise block around a courtyard -------------------------------------

export function designB(input: DesignInput): Design {
  const NAME = `B · Mid-rise under ${HIGH_RISE_M} m`;
  const { rules, ring, frontageEdge, roadWidthM: W, areaM2: A, buildingType: type } = input;
  const f = frontageFrame(ring, frontageEdge);
  const sb = rules.setbacks["mid-rise"];
  const ftf = FLOOR_M[type];
  // As many floors as fit with the roof slab under 23 m.
  const upper = Math.floor((HIGH_RISE_M - 0.01 - LOBBY_M) / ftf);
  const roof = LOBBY_M + upper * ftf;

  // The road height plane: the block starts where the plane clears roof + parapet.
  const vPlane = Math.max(0, (roof + PARAPET_M) / 2 - W);
  const BIG = 1e5;
  const half: PcPolygon = [
    [
      f.fromUV([-BIG, vPlane]),
      f.fromUV([BIG, vPlane]),
      f.fromUV([BIG, BIG]),
      f.fromUV([-BIG, BIG]),
      f.fromUV([-BIG, vPlane]),
    ] as Ring,
  ];
  const fpAt: FootprintAt = (extra) =>
    safe(() =>
      pc
        .intersection(
          buildableFootprint(ring, frontageEdge, sb.roadM + extra, sb.sideM + extra),
          half,
        )
        .filter((p) => polygonArea(p) >= 1),
    );
  const env = fpAt(0);
  // Courtyard: the ring between the footprint and the footprint SLAB_DEPTH_M further in,
  // if the courtyard is big enough to light the flats.
  const blockAt = (extra: number) => {
    const outer = fpAt(extra);
    const inner = fpAt(extra + SLAB_DEPTH_M);
    if (areaOf(inner) < MIN_COURTYARD_M2) return { block: outer, courtyard: false };
    const block = safe(() => pc.difference(outer, inner).filter((p) => polygonArea(p) >= 1));
    return block.length ? { block, courtyard: true } : { block: outer, courtyard: false };
  };

  // Stay under 10,000 m² (else MR 33's 6 m setbacks apply) and within the FAR limit.
  const gfaLimit = Math.min(EXTRA_LARGE_M2 - 1, rules.maxGfaM2);
  const openNeed = Math.max(rules.openSpaceMinShareOfPlot * A, (rules.osrPct / 100) * gfaLimit);
  const e0 = shrinkUntil(
    0,
    (e) => areaOf(fpAt(e)),
    Math.min(rules.footprintMaxShare * A, A - openNeed),
  );
  // Keep every storey that fits under 23 m; if that would pass the floor-area limit,
  // shrink the block evenly (more garden) rather than drop storeys.
  const e1 =
    e0 === null ? null : shrinkUntil(e0, (e) => areaOf(blockAt(e).block), gfaLimit / (1 + upper));
  const { block, courtyard } = e1 === null ? { block: [], courtyard: false } : blockAt(e1);
  const G = areaOf(block);
  if (G < 100)
    return infeasible(
      "B",
      NAME,
      "The setbacks and road height limit leave no room for a mid-rise block.",
    );
  // At least MIN_BLOCK_WIDTH_M wide somewhere: the footprint must survive shrinking
  // by half that width from every side. A long sliver of a few m² is not a building.
  if (!areaOf(fpAt((e1 ?? 0) + MIN_BLOCK_WIDTH_M / 2)))
    return infeasible(
      "B",
      NAME,
      `After setbacks the plot is narrower than ${MIN_BLOCK_WIDTH_M} m everywhere: too narrow for a building.`,
    );

  // Floors: ground (lobby + covered parking) + upper floors, within the floor-area limit.
  const n = Math.max(0, Math.min(upper, Math.floor((gfaLimit - G) / G)));
  const mainGfa = n * G;
  const rooms = type === "hotel" ? Math.floor(mainGfa / HOTEL_M2_PER_ROOM) : 0;
  const lobbyArea = G * (1 - GROUND_PARKING_SHARE);
  const required = parkingRequired(type, mainGfa + lobbyArea, rooms);
  const covered = Math.floor((G * GROUND_PARKING_SHARE) / M2_PER_SPACE);
  // Open-air parking may use up to half the open space (the other half must be planted).
  const openArea = A - G;
  const openAir = Math.max(
    0,
    Math.min(required - covered, Math.floor((openArea * 0.5) / M2_PER_SPACE)),
  );
  const provided = covered + openAir;

  const parts: DesignPart[] = [
    { id: "ground", use: "lobby", footprint: block, baseM: 0, floors: 1, floorM: LOBBY_M },
    { id: "upper", use: MAIN_USE[type], footprint: block, baseM: LOBBY_M, floors: n, floorM: ftf },
  ];
  const totals = totalsFor(input, parts, block, { required, provided });

  const checklist = [
    ...commonChecks(input, { gfa: totals.gfaM2, ground: block, parts }, f, env, sb, {
      required,
      provided,
      note: `${covered} covered on the ground floor (${fmt(GROUND_PARKING_SHARE * 100)}% of it) + ${openAir} open-air in the open space (at most half of it).`,
    }),
    {
      id: "not-highrise",
      label: "Stays a mid-rise",
      value: `roof ${fmt(totals.roofM, 1)} m, ${fmt(totals.gfaM2)} m²`,
      status: totals.roofM < HIGH_RISE_M && totals.gfaM2 < EXTRA_LARGE_M2 ? "pass" : "fail",
      detail: `Under ${HIGH_RISE_M} m to the roof slab and under ${fmt(EXTRA_LARGE_M2)} m², so the high-rise and extra-large rules (6 m setbacks, 6 m fire road, wide access road) do not apply.`,
      cite: [{ source: "mr33", clause: "cl. 1, 2, 4" }],
    } satisfies CheckRow,
    ...useChecks(input, totals.gfaM2, totals.rooms ?? 0, totals.units?.total ?? 0),
  ];

  return {
    id: "B",
    name: NAME,
    summary: `${n + 1}-storey block${courtyard ? " around a courtyard" : ""}, ground-floor parking. Under ${HIGH_RISE_M} m and ${fmt(EXTRA_LARGE_M2)} m²: simpler and faster to permit.`,
    parts,
    floorTable: floorTable(parts),
    totals,
    checklist,
    feasible: true,
  };
}

export function generateDesigns(input: DesignInput): [Design, Design] {
  return [designA(input), designB(input)];
}
