import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { polygon } from "@turf/turf";
import { readFileSync } from "node:fs";
import { DATA_AREA, dataCoverage, findCrossingRoads, type SiteData } from "../src/lib/site.ts";
import { SAMPLE_PLOT } from "../src/lib/sample-plot.ts";

const square = (lon: number, lat: number, size = 0.0005) =>
  polygon([
    [
      [lon, lat],
      [lon + size, lat],
      [lon + size, lat + size],
      [lon, lat + size],
      [lon, lat],
    ],
  ]);

describe("dataCoverage", () => {
  it("finds the sample plot inside the data area", () => {
    assert.equal(dataCoverage(SAMPLE_PLOT), "inside");
  });

  it("flags a plot far away (Siam) as outside", () => {
    assert.equal(dataCoverage(square(100.534, 13.746)), "outside");
  });

  it("flags a plot across the eastern edge as partly inside", () => {
    const [, s, e] = DATA_AREA;
    assert.equal(dataCoverage(square(e - 0.0002, s + 0.005)), "partly");
  });

  it("flags a plot just north of the area as outside", () => {
    const [w, , , n] = DATA_AREA;
    assert.equal(dataCoverage(square(w + 0.005, n + 0.0001)), "outside");
  });
});

describe("findCrossingRoads (real Thong Lo roads)", () => {
  const roads = JSON.parse(
    readFileSync(new URL("../public/data/thonglo-roads.geojson", import.meta.url), "utf8"),
  ) as SiteData["roads"];

  it("finds no public road through the sample plot", () => {
    assert.deepEqual(findCrossingRoads(SAMPLE_PLOT, roads), []);
  });

  it("flags Soi Thararom 2 through the first M1 plot, which was drawn across it", () => {
    const m1 = polygon([
      [
        [100.5837168, 13.7369255],
        [100.5838868, 13.7374203],
        [100.5842293, 13.7373376],
        [100.5843142, 13.7371869],
        [100.5845191, 13.7371583],
        [100.5843491, 13.7367773],
        [100.5839831, 13.7368202],
        [100.5837168, 13.7369255],
      ],
    ]);
    const crossing = findCrossingRoads(m1, roads);
    assert.ok(
      crossing.some((c) => c.name === "Soi Thararom 2" && c.insideM > 10),
      JSON.stringify(crossing.map((c) => [c.name, c.insideM])),
    );
  });

  it("flags Thong Lo when a plot is drawn across the main road", () => {
    // ~40 x 40 m box centred on Thong Lo near the sample plot.
    const across = square(100.5836, 13.7372, 0.0004);
    assert.ok(findCrossingRoads(across, roads).some((c) => c.name.startsWith("Thong Lo")));
  });

  it("ignores a road that only runs outside the plot", () => {
    assert.deepEqual(findCrossingRoads(square(100.5855, 13.7405, 0.0001), roads), []);
  });
});
