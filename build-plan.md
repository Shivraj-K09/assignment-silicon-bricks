# Build plan — Bangkok plot tool

Rules and numbers come from `research-notes.md` (sections 2, 3, 3b, 4, 5a, 5e, 5f). This plan covers only how to build it.

## Stack

- **Vite 8 + React 19 + TypeScript** (strict), static build, deployed to Vercel (`dist/`). No backend. `@/` import alias → `src/`.
- **Tailwind CSS v4** (via `@tailwindcss/vite`, theme in `src/index.css`, no config file) + **shadcn/ui on Base UI** (`base-nova` style, `@base-ui/react`, lucide icons; no Radix). Components in `src/components/ui/`. Font: Geist from Google Fonts.
- **MapLibre GL JS** with a free, keyless basemap (OpenFreeMap vector tiles). One map does both 2D drawing and 3D (tilt/rotate).
- **Neighbour buildings**: MapLibre `fill-extrusion` from our static GeoJSON. Real heights in grey, estimated heights in a lighter hatched-looking colour, with a legend.
- **Envelope + designs**: a **Three.js custom layer** inside MapLibre, so the sloped height plane and the massing sit in the same 3D scene as the real buildings.
- **Drawing**: `terra-draw` (polygon draw + vertex drag) on MapLibre.
- **Geometry**: `@turf/turf` (area, centroid, point-in-polygon, line buffer) + `polygon-clipping` (difference/intersection). All maths in a local metric frame (metres east/north of the plot centroid), converted back to lon/lat only for drawing.
- **UI**: React components built from shadcn parts — left panel for inputs and rules, right panel for designs and checklists. The map is created once in `map-view.tsx` (inside an absolute wrapper, since MapLibre's CSS forces `position: relative`); React state changes update map sources and the Three.js layer, never re-create the map.
- **State**: one React state object (plot, frontage edge, road width, building type); rules, envelope and designs are derived from it with `useMemo` — pure functions, so they are testable and fast.
- **Tests**: Node's built-in test runner (`node --test`, `npm test`) for the rules, envelope and design maths. Test files live in `tests/` (`*.test.ts`) and import with `.ts` extensions. Node 24 runs TypeScript directly.

## Conventions

- File names in **kebab-case** (`map-view.tsx`, `rules-panel.tsx`, `envelope.ts`). React component names stay PascalCase inside the files (React requires it).
- Pure logic in `src/lib/` (no React), components in `src/components/`.

## Project quirks (folder name contains `#`)

- Vite's dev server can't serve from a path with `#`, so `npm run dev` runs `scripts/dev.mjs`: build in watch mode + `vite preview` on port 5173. Vercel runs the normal `npm run build`.
- MapLibre's worker is copied to `public/` by `scripts/setup-map-worker.mjs` (postinstall / predev / prebuild) and set with `setWorkerUrl`, because Vite's `?url` import fails on this path.
- Font files can't go through Vite's asset loader here, so Geist comes from Google Fonts.
- The shadcn CLI writes `import { cn } from "cn"` on this path; fix to `@/lib/utils` after every `shadcn add`.
- Vitest cannot load test files from this path (it also breaks at a drive root via `subst`), so tests use Node's built-in runner instead.

## Data prep (scripts in `scripts/`, run once, output to `public/data/`)

1. `fetch-zoning.mjs` — download `bkk-zoning-current.geojson` and `bkk-planned-roads.geojson` from KNS.MAP PR #6 head commit; keep as is (1.4 MB, gzip by Vercel).
2. `fetch-osm.mjs` — Overpass query for buildings + highways in bbox 13.730–13.745 N, 100.576–100.590 E. Try main server, then mirrors (kumi, private.coffee), with retries. Save raw JSON.
3. `build-osm.mjs` — convert to GeoJSON; per building set `height`:
   - `height` tag → real; else `building:levels × 3.2 m` → real (from levels);
   - else estimate from footprint area (small < 150 m² → 2 storeys, < 600 → 4, < 2,000 → 8, larger → 12) → `estimated: true`.
     Roads keep `name`, `highway`, `width`/`lanes` if present.

## Inputs

- Sample irregular plot (~4,000 m², 5–6 corners) on northern Thong Lo, ย.9, pre-loaded.
- Draw a new plot, or drag corners of the current one.
- **Frontage edge**: click a plot edge to mark it as the road side (default: the edge facing Thong Lo). Road name auto-filled from the nearest OSM road.
- Road width input, presets: Thong Lo 25 m / soi 8 m.
- Building type: condo / hotel / office.

## Rules engine (`src/lib/rules.ts`, pure functions, unit-tested with `node --test`)

Input: plot polygon (m), frontage edge, road width, type, zone. Output: a rules object with every number and its source clause.

- Zone by centroid point-in-polygon → FAR, OSR; flag if the plot crosses a zone boundary; flag if outside ย.9 (still compute with that zone's FAR/OSR from the table).
- Max GFA = FAR × plot area.
- Road setback (from plot edge): <6 m road → 3 m from centreline − W/2; <10 m → 6 − W/2; 10–20 m → W/10; >20 m → 2 m. High-rise: max(that, 6 m).
- Side/rear setback: high-rise 6 m; mid-rise 3 m (whole block, per notes 5f).
- Height plane: h(p) ≤ 2 × (distance from p to frontage line + W).
- Footprint ≤ 70% plot (residential) / 90% (non-residential, 10% open); open space ≥ max(OSR × GFA, 30% plot) for residential, half permeable.
- High-rise ≥ 23 m (roof slab); extra-large ≥ 10,000 m²; road ≥ 10 m (≤ 30,000 m²) / ≥ 18 m (> 30,000 m²); frontage ≥ 12 m.
- MR 33 clause 3 (high-rise only): a 6 m fire-truck access road all around the building. Checked as: the gap between the building and every plot edge is ≥ 6 m (the road side may use the public road). Shown as a checklist row.
- L/8 rule: road-facing building face > perimeter/8 and ≤ 20 m from road.
- Use-specific road flags (hotel > 80 rooms, office > 10,000 m²), EIA flag, "not in special height area", planned-road-widening flag.
- Parking: condo `ceil(nonParkingGFA/120)`; hotel max(84(2), /120); office `/60`; 30 m² per space.

## Envelope algorithm (`src/lib/envelope.ts`)

1. Project plot to local metres.
2. For each edge, buffer the segment by its setback (road edge → road setback, others → side setback); buildable = plot − union(buffers). Handles any non-convex shape. If the setbacks split the plot into several pieces, all pieces are kept: each is real buildable land, and dropping the smaller ones would understate what can be built.
3. Two envelopes: **high-rise** (6 m all round) and **mid-rise** (3 m sides, mid-rise road setback, capped < 23 m).
4. Top surface = the 2× road plane, evaluated per vertex after triangulating the buildable polygon (earcut via Three.js `ShapeUtils`) — exact because the plane is linear in distance to a straight frontage line. Display cap (high-rise only; there is no fixed height limit in ย.9): the larger of (a) full FAR stacked on the usable footprint at 3 m per floor, plus 25%, and (b) the plane height at the building line + 30 m, so the slope stays visible; rounded up to 10 m. Mid-rise cap: 23 m.
5. Render: translucent extruded mesh with the sloped top, plus outlined plot and setback lines on the ground. Toggle "show each rule" layers (road setback, side setback, height plane) so each rule visibly changes the shape.

## Design generator (`src/lib/designs.ts`)

- **A — Tower on parking podium (high-rise)**: podium = buildable polygon shrunk to ≤ 70% plot and to meet open space; floors = parking needed / (podium area / 30 m²). Tower = rectangle 20 m deep aligned to the frontage edge, fitted inside the buildable polygon (largest inscribed oriented rectangle by sampling), floors added until GFA reaches FAR cap or the height plane is hit. Lobby 4.5 m, parking 3.0 m, floors 3.0/3.2/3.6 m by type.
- **B — Mid-rise slab (< 23 m)**: slab(s) 18–20 m deep inside the mid-rise envelope, ground lobby + 6 floors (≤ 22.5 m to roof slab), parking in open-air ground parking/1 podium level.
- Each design returns: floors table (use, area, height), GFA total = sum of floors (shown so it adds up), units/rooms, parking, height, footprint, open space, and a **checklist** of pass/fail/flag rows with clause references.
- If a rule can't be met (tiny plot), the design shows the failing rows rather than hiding.

## UI

- Header with site name, zone badge, building type switch.
- Left: inputs + "Rules that apply" table (value, clause, link to source PDF).
- Centre: map / 3D view; buttons: 2D draw, 3D view, toggle envelope / design A / design B / neighbours.
- Right: design cards A and B: key numbers, floor breakdown, checklist (✓ / ✗ / ⚑).
- shadcn parts: `Select` (building type, frontage edge), `Input` (road width), `Tabs` (Design A / B), `Card` (design cards), `Badge` (zone, pass/fail), `Switch` (layer toggles), `Tooltip` (rule sources), `ScrollArea` (panels).
- Recompute on every input event, debounced with `requestAnimationFrame`; geometry is small so a full recompute is < 5 ms. Three meshes are rebuilt, not the map.

## Milestones (deploy to Vercel after each)

| #               | Target (IST)       | What's live                                                                                                                                                                                                                                                                 |
| --------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1              | today +2 h         | Vite app on Vercel: map of Thong Lo, sample plot, 3D OSM buildings (real vs estimated), zoning layer. **Plus a test box drawn by a Three.js custom layer inside MapLibre**, checked for position, scale and depth against the real buildings (riskiest part, proven first). |
| M2              | end of today       | Plot drawing/editing, frontage edge + road + type inputs, rules panel with sources, **and a simple 3D envelope** (setbacks inset + 2× road height plane), all live. **Basic working version.**                                                                              |
| M3              | Fri AM             | Envelope refined: per-rule toggles, mid-rise vs high-rise envelopes, edge cases; tests for rules.                                                                                                                                                                           |
| M4              | Fri PM             | Designs A and B with floor tables + checklists, rendered in 3D.                                                                                                                                                                                                             |
| M5              | Fri late afternoon | Polish: styling, loading states, edge cases (self-intersecting plot, tiny plot, zone crossing), phone check, perf check, README.                                                                                                                                            |
| **Code freeze** | **Fri evening**    | Coding stops. Evening is for the user to write the doc.                                                                                                                                                                                                                     |
| Sat AM          | until 11:14 IST    | Final small fixes only, then submit.                                                                                                                                                                                                                                        |

## Milestone checklists

What each milestone row above covers, item by item, with the section of this plan that describes it. ✓ done and pushed, ◐ done but not yet pushed, ☐ not started.

### M1: map, real site, Three.js test

- ✓ Vite + React + TypeScript app deployed on Vercel (Stack)
- ✓ Map of Thong Lo with the 2013 zoning layer and zone labels (Data prep 1)
- ✓ OSM buildings and roads, fetched once with mirror fallback (Data prep 2)
- ✓ 3D buildings: real heights vs estimated heights, shown differently, with a legend (Data prep 3)
- ✓ Sample irregular plot in ย.9 on Thong Lo, pre-loaded (Inputs). Built as 3,669 m², 9 corners, following the gaps between buildings so it cuts none (`scripts/make-sample-plot.mjs`).
- ✓ Three.js test box inside MapLibre, checked for position, scale and depth against real buildings (M1 row)

### M2: basic working version

- ✓ Draw a new plot; drag corners; drag the whole plot (Inputs)
- ✓ Pick the road edge by clicking or tapping it (or its number) on the map, or from a dropdown (Inputs, Phone screens)
- ✓ Road name auto-filled from the nearest OSM road (Inputs)
- ✓ Road width input with presets Thong Lo 25 m / soi 8 m (Inputs)
- ✓ Building type: condo / hotel / office. In the left panel, not the header (UI)
- ✓ Rules panel: value, plain explanation, clause and link to the source PDF (UI, Rules engine)
- ✓ Rules: zone, FAR, OSR, setbacks, height plane, footprint, open space, high-rise and extra-large thresholds, MR 33 road access, use-specific road flags, special height area, planned road widening, zone crossing (Rules engine)
- ✓ Simple 3D envelope: setbacks plus the 2× road height plane (Envelope algorithm 1, 2, 4)
- ✓ Everything updates live on every change (UI). Recomputed directly with `useMemo`; no `requestAnimationFrame` step was needed.
- ✓ Phone layout checked at 375 px (Phone screens)
- ✓ Extras: building collision check, demolished buildings as dashed outlines, data-area boundary and warning, public road through the plot warning

### M3: envelope refined

- ✓ Switch each rule on and off: road setback, side setbacks, road height plane (Envelope algorithm 5, M3 row)
- ✓ Both envelopes viewable: best allowed / high-rise / mid-rise under 23 m (Envelope algorithm 3, M3 row)
- ✓ Display cap from full floor area plus a margin, keeping the slope visible (Envelope algorithm 4)
- ✓ Split plots: all pieces kept (Envelope algorithm 2)
- ✓ Edge cases: tiny or narrow plot message, very narrow and very wide roads (M3 row)
- ✓ 2D / 3D view, envelope and buildings toggles (UI)
- ✓ Tests for the rules, envelope and cap (M3 row): 63 passing

### M4: two designs with checklists

- ◐ Design A: tower on a parking podium, high-rise (Design generator)
- ◐ Design B: mid-rise under 23 m (Design generator). Built as a block with every storey that fits under 23 m (7 for a condo), shrunk evenly to stay under 10,000 m², with a courtyard when the block is deep enough; parking on the covered ground floor plus open-air parking in up to half the open space.
- ◐ Floor table per design: use, area, height; total floor area = sum of floors (Design generator)
- ◐ Units or rooms, parking spaces and area, height, footprint, open space per design (Design generator, Rules engine: parking)
- ◐ Pass / fail / flag checklist per design with clause references (Design generator), including:
  - ◐ FAR, open space, footprint, setbacks, height plane
  - ◐ MR 33 clause 3: 6 m fire-truck access around a high-rise (Rules engine)
  - ◐ L/8 frontage rule (Rules engine)
  - ◐ Parking count (Rules engine)
  - ◐ EIA flag (Rules engine)
- ◐ A design that can't meet a rule shows the failing rows rather than hiding (Design generator)
- ◐ Designs drawn in 3D among the real buildings (M4 row)
- ◐ Design cards A and B in a panel, with Tabs (UI)
- ◐ Map toggles for design A / design B (UI). One "Design" switch on the map; the A / B tab picks which design is drawn.
- ◐ Tests for the design maths

### M5: polish

- ☐ Styling pass, so it looks client-ready (M5 row)
- ☐ Loading states (M5 row)
- ☐ Edge-case sweep: self-intersecting plot, tiny plot, zone crossing (M5 row; most already handled in M2 and M3)
- ☐ Phone check of the final version (M5 row, Phone screens)
- ☐ Performance check on a normal laptop (M5 row)
- ☐ README (M5 row)

### Code freeze and Saturday

- ☐ Coding stops Friday evening; the evening is for the user's doc
- ☐ Saturday morning: final small fixes only, then submit before 11:14 IST

## Phone screens

- Layout: side panels on desktop; on narrow screens (< 768 px) the map goes on top (about 55% of the height) and the panels stack below it, scrollable, with no horizontal page scroll.
- Touch: map pan/zoom/tilt with fingers; plot corners are large enough to drag; the frontage edge can be chosen from a dropdown as well as by tapping.
- Checked on a 375 px wide viewport at each milestone from M2 onward.

## Not doing (v1)

Basements, corner/two-road plots, blank-wall option, stepped 9 m setback, bonus FAR, hotel lobby parking — all per research notes section 6.
