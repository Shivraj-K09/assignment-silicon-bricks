/** Where edge numbers are drawn, and which plot edge a click or tap picks. */
import type * as maplibregl from "maplibre-gl";
import { signedArea, type Edge, type Frame } from "./local-frame.ts";

/** How close (screen pixels) a click must be to a plot edge or its number to pick it. */
const EDGE_CLICK_PX = 14;

/** Edge numbers sit this far outside the plot, so they do not cover the edge line. */
const EDGE_LABEL_OFFSET_M = 4;

/** Clicks near the ends of an edge belong to dragging its corners. */
const EDGE_END_SHARE = 0.15;

/** Where an edge's number is drawn: its midpoint, pushed outward from the plot. */
export function edgeLabelPoint(edge: Edge, edges: Edge[]): [number, number] {
  const ring = edges.map((e) => e.a);
  const orientation = signedArea(ring) >= 0 ? 1 : -1;
  const ux = (edge.b[0] - edge.a[0]) / (edge.lengthM || 1);
  const uy = (edge.b[1] - edge.a[1]) / (edge.lengthM || 1);
  // Outward normal: right of the edge for a counter-clockwise ring.
  const nx = uy * orientation;
  const ny = -ux * orientation;
  return [
    (edge.a[0] + edge.b[0]) / 2 + nx * EDGE_LABEL_OFFSET_M,
    (edge.a[1] + edge.b[1]) / 2 + ny * EDGE_LABEL_OFFSET_M,
  ];
}

type ScreenPoint = { x: number; y: number };

/** Distance on screen from p to the segment a→b, or null near the segment's ends. */
function distanceToEdgeMiddle(p: ScreenPoint, a: ScreenPoint, b: ScreenPoint): number | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 1) return null;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared;
  if (t < EDGE_END_SHARE || t > 1 - EDGE_END_SHARE) return null;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * The plot edge a click or tap picks, if any: the click is on the edge's number,
 * or on the edge line away from its corners. Measured in screen pixels, so it
 * feels the same at every zoom and tilt.
 */
export function pickEdge(
  map: maplibregl.Map,
  edges: Edge[],
  frame: Frame,
  point: ScreenPoint,
): number | null {
  let best: { distance: number; edge: number } | null = null;

  for (const edge of edges) {
    const label = map.project(frame.toLngLat(edgeLabelPoint(edge, edges)));
    const a = map.project(frame.toLngLat(edge.a));
    const b = map.project(frame.toLngLat(edge.b));
    const candidates = [
      Math.hypot(point.x - label.x, point.y - label.y),
      distanceToEdgeMiddle(point, a, b),
    ];
    for (const distance of candidates) {
      if (distance === null || distance > EDGE_CLICK_PX) continue;
      if (!best || distance < best.distance) best = { distance, edge: edge.index };
    }
  }
  return best?.edge ?? null;
}
