import earcut from "earcut";

type Pt = { x: number; y: number } | [number, number];
const xy = (p: Pt): [number, number] => (Array.isArray(p) ? p : [p.x, p.y]);

/**
 * Triangles for a polygon with holes, as index triples into [...contour, ...holes.flat()].
 * Same contract as Three.js ShapeUtils.triangulateShape (which uses earcut too),
 * without pulling Three.js into the first page load.
 */
export function triangulate(contour: Pt[], holes: Pt[][] = []): [number, number, number][] {
  const flat: number[] = [];
  const holeStarts: number[] = [];
  for (const p of contour) flat.push(...xy(p));
  for (const h of holes) {
    holeStarts.push(flat.length / 2);
    for (const p of h) flat.push(...xy(p));
  }
  const idx = earcut(flat, holeStarts, 2);
  const out: [number, number, number][] = [];
  for (let i = 0; i < idx.length; i += 3) out.push([idx[i], idx[i + 1], idx[i + 2]]);
  return out;
}
