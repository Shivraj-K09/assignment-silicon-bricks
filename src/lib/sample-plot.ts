import type { Feature, Polygon } from "geojson";

// The example plot’s shape
/**
 * Sample irregular plot on the east side of Thong Lo (Sukhumvit Soi 55),
 * between Soi Thararom 2 and Soi Thong Lo 20, zone ย.9.
 *
 * Its edges follow the gaps between existing buildings, so the plot line cuts
 * no building (found by scripts/make-sample-plot.mjs). It crosses no public
 * road. The first edge (vertex 0 -> 1) lies on the legal edge of Thong Lo,
 * 12.5 m east of the road centreline (25 m road).
 * About 3,670 m², 62 m frontage, 9 corners.
 */
export const SAMPLE_PLOT: Feature<Polygon> = {
  type: "Feature",
  properties: { name: "Sample plot, Thong Lo" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [100.5838223, 13.7372326],
        [100.5840041, 13.7377615],
        [100.5841402, 13.7377174],
        [100.5841432, 13.7377259],
        [100.5843056, 13.7376732],
        [100.5843203, 13.7377158],
        [100.5845091, 13.7376546],
        [100.584295, 13.7370319],
        [100.5841224, 13.7371258],
        [100.5838223, 13.7372326],
      ],
    ],
  },
};

/** Index of the plot edge that faces the road (vertex i -> i+1). */
export const SAMPLE_FRONTAGE_EDGE = 0;
