import type { Feature, Polygon, Position } from "geojson";

/** A point in metres: x = east, y = north, from the frame's origin. */
export type XY = [number, number];

const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LON_EQUATOR = 111_320;

/**
 * Converts between lon/lat and flat local metres around an origin.
 * Equirectangular: over a few hundred metres the error is well under 1 cm,
 * and all the zoning maths (setbacks, areas, heights) is done in these metres.
 */
export function makeFrame(origin: [number, number]) {
  const [lon0, lat0] = origin;
  const kx = M_PER_DEG_LON_EQUATOR * Math.cos((lat0 * Math.PI) / 180);
  const ky = M_PER_DEG_LAT;
  return {
    origin,
    toLocal: ([lon, lat]: Position): XY => [(lon - lon0) * kx, (lat - lat0) * ky],
    toLngLat: ([x, y]: XY): [number, number] => [lon0 + x / kx, lat0 + y / ky],
  };
}
export type Frame = ReturnType<typeof makeFrame>;

/** Signed area of a ring in m² (positive = counter-clockwise). Ring may be open or closed. */
export function signedArea(ring: XY[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/** The plot's outer ring in local metres, open (no repeated last point). */
export function plotRing(plot: Feature<Polygon>, frame: Frame): XY[] {
  const ring = plot.geometry.coordinates[0].map(frame.toLocal);
  const [first, last] = [ring[0], ring[ring.length - 1]];
  if (first[0] === last[0] && first[1] === last[1]) ring.pop();
  return ring;
}

export interface Edge {
  /** Edge i runs from corner i to corner i+1. */
  index: number;
  a: XY;
  b: XY;
  lengthM: number;
}

export function ringEdges(ring: XY[]): Edge[] {
  return ring.map((a, index) => {
    const b = ring[(index + 1) % ring.length];
    return { index, a, b, lengthM: Math.hypot(b[0] - a[0], b[1] - a[1]) };
  });
}
