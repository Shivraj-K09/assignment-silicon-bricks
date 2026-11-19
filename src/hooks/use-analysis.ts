import { useMemo } from "react";
import { area, centroid, kinks } from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import { findBuildingOverlaps } from "@/lib/building-overlap";
import { computeEnvelope } from "@/lib/envelope";
import { makeFrame, plotRing, ringEdges } from "@/lib/local-frame";
import { computeRules, type BuildingType } from "@/lib/rules";
import { SAMPLE_PLOT } from "@/lib/sample-plot";
import {
  dataCoverage,
  findCrossingRoads,
  findZone,
  nearestStation,
  plannedRoadsNearFrontage,
  type SiteData,
} from "@/lib/site";

export interface SiteInputs {
  plot: Feature<Polygon>;
  frontageEdge: number;
  roadName: string;
  roadWidthM: number;
  buildingType: BuildingType;
}

/** One fixed local frame for the whole session, centred on the sample plot. */
export const FRAME = makeFrame(centroid(SAMPLE_PLOT).geometry.coordinates as [number, number]);

/** High-rise envelopes are drawn up to this height. There is no fixed height limit in ย.9. */
export const HIGH_RISE_DISPLAY_CAP_M = 150;

/**
 * Everything derived from the inputs: zone, rules, envelope, building check.
 * Pure and memoised, so a drag or a keystroke recomputes it all in a few ms.
 */
export function useAnalysis(data: SiteData | null, inputs: SiteInputs) {
  const { plot, frontageEdge, roadWidthM, roadName, buildingType } = inputs;

  const geometry = useMemo(() => {
    const ring = plotRing(plot, FRAME);
    const edges = ringEdges(ring);
    return {
      ring,
      edges,
      areaM2: area(plot),
      selfCrossing: kinks(plot).features.length > 0,
      coverage: dataCoverage(plot),
    };
  }, [plot]);

  const site = useMemo(() => {
    if (!data) return null;
    return {
      zone: findZone(plot, data.zoning),
      station: nearestStation(plot, data.stations),
      overlaps: findBuildingOverlaps(plot, data.buildings),
      roadCrossings: findCrossingRoads(plot, data.roads),
    };
  }, [data, plot]);

  const planned = useMemo(
    () =>
      data
        ? plannedRoadsNearFrontage(plot, frontageEdge, data.plannedRoads, FRAME).map((r) => ({
            name: r.properties.name,
            widthM: r.properties.widthM,
          }))
        : [],
    [data, plot, frontageEdge],
  );

  const frontageM = geometry.edges[frontageEdge]?.lengthM ?? 0;

  const rules = useMemo(
    () =>
      site
        ? computeRules({
            zone: site.zone.zone,
            zonesTouched: site.zone.touched,
            plotAreaM2: geometry.areaM2,
            frontageM,
            roadName,
            roadWidthM,
            buildingType,
            station: site.station,
            plannedRoads: planned,
          })
        : null,
    [site, geometry.areaM2, frontageM, roadName, roadWidthM, buildingType, planned],
  );

  const envelope = useMemo(() => {
    if (!rules) return null;
    const kind = rules.envelopeKind;
    return computeEnvelope({
      ring: geometry.ring,
      frontageEdge,
      roadSetbackM: rules.setbacks[kind].roadM,
      sideSetbackM: rules.setbacks[kind].sideM,
      roadWidthM,
      capM: kind === "high-rise" ? HIGH_RISE_DISPLAY_CAP_M : rules.midRiseMaxM,
    });
  }, [rules, geometry.ring, frontageEdge, roadWidthM]);

  return { geometry, site, rules, envelope, frontageM };
}
export type Analysis = ReturnType<typeof useAnalysis>;
