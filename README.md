# Bangkok Plot Tool

Draw a plot in Bangkok, pick the road it faces and a building type, and see what the zoning and building laws allow: the rules with their sources, the 3D space a building may fill among the real surrounding buildings, and two concept designs with pass / fail checklists. Everything updates live.

**Live:** https://shiv-assignment.vercel.app

Scope: one zone, **ย.9** (high-density residential, FAR 7), on northern Thong Lo (Sukhumvit Soi 55), done properly. Other zones show their FAR and OSR with a warning that their use rules are not checked.

## What it does

| Input                                              | Output                                                                                                                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plot drawn on the map (any shape), or the sample   | Zone, FAR, open space, setbacks, road height limit, high-rise rules, each with its clause and a link to the source PDF                                         |
| Edge facing the road (click it, or pick from list) | The allowed envelope in 3D: plot minus setbacks, topped by the 2 × road-distance height plane; each rule can be switched off to see what it takes away         |
| Legal road width                                   | Design A (tower on a parking podium) and Design B (mid-rise under 23 m): key numbers, a floor table that adds up, and a checklist of pass / fail / flag rows   |
| Building type: condo, hotel, office                | Warnings pinned to the plot when its outline crosses itself, cuts a neighbouring building, contains a public road, or lies outside the area with building data |

## Run it

Needs Node 24 (it runs the TypeScript tests directly).

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # 89 tests: rules, envelope, designs, plot checks, edge cases, real-data checks
npm run build    # type check + production build into dist/
```

`npm run dev` rebuilds on save and serves `dist/` instead of using Vite's dev server, because the original project folder name contains `#`, which Vite's dev server cannot serve. In a folder without `#`, `npx vite` works as usual.

## Where the rules come from

All numbers were checked against the primary Thai legal texts (the research is in [`research-notes.md`](research-notes.md)):

- **Bangkok Comprehensive Plan B.E. 2556 (2013)**: zones, FAR, OSR, uses, road-width conditions. Still in force; the 4th revision is a draft.
- **Ministerial Regulation 55**: building line from the road, height from the road (2 × distance to the far side), walls with windows.
- **Ministerial Regulation 33**: high-rise (≥ 23 m) and extra-large (≥ 10,000 m²) buildings: road access, 6 m setbacks, 6 m fire-truck road, floor-area definition.
- **Bangkok Building Control Ordinance B.E. 2544**: 30% open plot for residential, the L/8 fire-access face, parking ratios.

Design assumptions (floor heights, unit mix, parking area per space, hotel room size) are from research notes §5e–5f and are labelled as assumptions in the checklists.

## Data

All data is static, shipped in `public/data/`; nothing calls a live API while the tool runs.

| File                                                                          | Source                                                                                                                                        | Script                                           |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `bkk-zoning.geojson`, `bkk-planned-roads.geojson`                             | BMA 2013 plan map, as converted to GeoJSON in [Kanesuan/KNS.MAP PR #6](https://github.com/Kanesuan/KNS.MAP/pull/6), pinned to its head commit | `scripts/fetch-zoning.mjs`                       |
| `thonglo-buildings.geojson`, `thonglo-roads.geojson`, `rail-stations.geojson` | OpenStreetMap via Overpass (fetched once, with mirror fallback), box 13.730–13.745 N, 100.576–100.590 E                                       | `scripts/fetch-osm.mjs`, `scripts/build-osm.mjs` |

Only about 1% of the buildings here have a height in OSM; the rest are estimated from footprint size and drawn in a lighter colour. The basemap is OpenFreeMap (no API key).

## How it works

- **Stack:** Vite, React, TypeScript, Tailwind, shadcn/ui on Base UI. MapLibre for the map, Three.js for the envelope and designs (drawn in MapLibre's own depth buffer, so real buildings hide them correctly), terra-draw for drawing the plot, polygon-clipping, Turf and earcut for geometry.
- **Interface:** the map fills the screen. Floating on it: a title bar (location and plot size), the answer card (maximum floor area and designs A and B drawn side by side to scale; tap one to show it on the map), a details panel with Floors, Checks and Rules tabs (a bottom sheet on phones), map tools on the right (zoom, compass, layers and legend, 2D/3D, help, reset) and a dock at the bottom for the inputs (building type, road width, draw plot). The accent colour is one set of CSS variables, `--brand-*` in `src/index.css`.
- **Pure functions, tested:** `src/lib/rules.ts` (the rules), `envelope.ts` (setbacks + height plane), `designs.ts` (designs A and B and their checklists), `building-overlap.ts` and `site.ts` (plot checks against the real data). All maths runs in local metres around the site.
- **Live and smooth:** the analysis is memoised on the inputs; the designs (~50 ms) run on a deferred copy so dragging a corner stays smooth. The map code loads in parallel with the data, so the controls and cards appear first.

```
src/
  app.tsx                  layout and input state
  hooks/use-analysis.ts    inputs → zone, rules, envelope, designs
  hooks/use-site-data.ts   loads the static data
  components/              map, answer card, details panel, dock, map tools, top bar
  lib/                     rules, envelope, designs, geometry, site checks
scripts/                   data fetch and build, sample plot search, dev server
tests/                     node --test suites
```

## Known limits

- Plot boundaries are drawn by hand: Thai cadastral data (DOL LandsMaps) is not open.
- Corner plots and plots between two roads (MR 55 cl. 45–46), the blank-wall option, the stepped 9 m setback, bonus FAR, basements and car stackers are not modelled.
- A plot pushed a few metres into a road, without reaching its centreline, is not caught: OSM gives road centrelines, not widths.
- Building heights are mostly estimates.
