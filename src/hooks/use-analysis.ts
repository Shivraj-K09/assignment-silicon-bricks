import { useDeferredValue, useMemo } from "react";
import { area, centroid, kinks } from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import { findBuildingOverlaps } from "@/lib/building-overlap";
import { generateDesigns, type DesignInput } from "@/lib/designs";
import { computeEnvelope, highRiseDisplayCap } from "@/lib/envelope";
import { makeFrame, plotRing, ringEdges } from "@/lib/local-frame";
import { computeRules, type BuildingType, type EnvelopeKind } from "@/lib/rules";
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

/** Which envelope to show, and which rules shape it (each can be switched off to see its effect). */
export interface EnvelopeView {
  /** "auto" shows the biggest building the road allows. */
  kind: "auto" | EnvelopeKind;
  roadSetback: boolean;
  sideSetback: boolean;
  heightPlane: boolean;
}

export const DEFAULT_VIEW: EnvelopeView = {
  kind: "auto",
  roadSetback: true,
  sideSetback: true,
  heightPlane: true,
};

/**
 * Everything derived from the inputs: zone, rules, envelope, building check.
 * Pure and memoised, so a drag or a keystroke recomputes it all in a few ms.
 */
export function useAnalysis(
  data: SiteData | null,
  inputs: SiteInputs,
  view: EnvelopeView = DEFAULT_VIEW,
) {
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

  const shown = useMemo(() => {
    if (!rules) return null;
    const kind: EnvelopeKind = view.kind === "auto" ? rules.envelopeKind : view.kind;
    const legal = rules.setbacks[kind];
    const roadSetbackM = view.roadSetback ? legal.roadM : 0;
    const sideSetbackM = view.sideSetback ? legal.sideM : 0;
    const base = {
      ring: geometry.ring,
      frontageEdge,
      roadSetbackM,
      sideSetbackM,
      roadWidthM,
      heightPlane: view.heightPlane,
    };
    let capM: number = rules.midRiseMaxM;
    if (kind === "high-rise") {
      // Cap from the footprint actually available: first pass without a cap.
      const fp = computeEnvelope({ ...base, capM: 1e4 }).footprintM2;
      const A = geometry.areaM2;
      const openRequired = Math.max(
        rules.openSpaceMinShareOfPlot * A,
        (rules.osrPct / 100) * rules.gfaCapM2,
      );
      capM = highRiseDisplayCap({
        gfaM2: rules.gfaCapM2,
        usableFootprintM2: Math.min(fp, rules.footprintMaxShare * A, A - openRequired),
        frontPlaneM: 2 * (roadSetbackM + roadWidthM),
      });
    }
    return {
      kind,
      /** False when the user chose a high-rise the road does not allow. */
      allowed: kind === "mid-rise" || rules.highRiseAllowed,
      capM,
      envelope: computeEnvelope({ ...base, capM }),
    };
  }, [rules, view, geometry.ring, geometry.areaM2, frontageEdge, roadWidthM]);
  const envelope = shown?.envelope ?? null;

  // The two designs. They take ~30–60 ms, so they run on a deferred copy of the
  // inputs: while a corner is dragged the map and envelope stay smooth and the
  // designs catch up as soon as the drag pauses.
  const designInput = useMemo<DesignInput | null>(() => {
    if (!rules || !site) return null;
    return {
      ring: geometry.ring,
      frontageEdge,
      roadWidthM,
      frontageM,
      buildingType,
      areaM2: geometry.areaM2,
      rules,
      station: site.station,
      plotIssues: {
        collidingBuildings: site.overlaps.filter((o) => o.status === "colliding").length,
        crossingRoads: site.roadCrossings.map((c) => c.name),
        outsideData: geometry.coverage === "outside",
      },
    };
  }, [rules, site, geometry, frontageEdge, roadWidthM, frontageM, buildingType]);
  const deferredInput = useDeferredValue(designInput);
  const designs = useMemo(
    () => (deferredInput ? generateDesigns(deferredInput) : null),
    [deferredInput],
  );
  const designsStale = deferredInput !== designInput;

  return { geometry, site, rules, envelope, shown, frontageM, designs, designsStale };
}
export type Analysis = ReturnType<typeof useAnalysis>;
