import type { MultiPolygon } from "polygon-clipping";
import { ShapeUtils, Vector2 } from "three";
import type { Design, Use } from "./designs.ts";

/** Geometry for one design part: a solid extrusion plus a line at every floor. */
export interface PartMesh {
  use: Use;
  positions: number[];
  indices: number[];
  /** Line segments (xyz pairs): outline at every floor level and corner posts. */
  lines: number[];
}

function extrude(
  footprint: MultiPolygon,
  z0: number,
  z1: number,
  floorM: number,
): Omit<PartMesh, "use"> {
  const positions: number[] = [];
  const indices: number[] = [];
  const lines: number[] = [];
  for (const poly of footprint) {
    const contour = poly[0].slice(0, -1).map(([x, y]) => new Vector2(x, y));
    const holes = poly.slice(1).map((h) => h.slice(0, -1).map(([x, y]) => new Vector2(x, y)));
    const tris = ShapeUtils.triangulateShape(contour, holes);
    const all = [...contour, ...holes.flat()];
    // Top and bottom caps.
    for (const z of [z1, z0]) {
      const base = positions.length / 3;
      for (const v of all) positions.push(v.x, v.y, z);
      for (const t of tris) indices.push(base + t[0], base + t[1], base + t[2]);
    }
    // Walls, floor lines and corner posts.
    const levels: number[] = [];
    for (let z = z0; z < z1 - 1e-6; z += floorM) levels.push(z);
    levels.push(z1);
    for (const ring of poly) {
      for (let i = 0; i < ring.length - 1; i++) {
        const [ax, ay] = ring[i];
        const [bx, by] = ring[i + 1];
        const w = positions.length / 3;
        positions.push(ax, ay, z0, bx, by, z0, bx, by, z1, ax, ay, z1);
        indices.push(w, w + 1, w + 2, w, w + 2, w + 3);
        for (const z of levels) lines.push(ax, ay, z, bx, by, z);
        lines.push(ax, ay, z0, ax, ay, z1);
      }
    }
  }
  return { positions, indices, lines };
}

/** 3D massing for a design: one mesh per part, in local metres. */
export function designMassing(design: Design): PartMesh[] {
  return design.parts
    .filter((p) => p.floors > 0 && p.footprint.length)
    .map((p) => ({
      use: p.use,
      ...extrude(p.footprint, p.baseM, p.baseM + p.floors * p.floorM, p.floorM),
    }));
}
