/**
 * The zoning and building-control rules for a plot, as pure functions.
 * Every number comes from research-notes.md (sections 2, 3, 3b, 4, 5a, 5b, 5e, 5f),
 * which was checked against the primary Thai legal texts listed in SOURCES.
 */

export type BuildingType = "condo" | "hotel" | "office";

export const BUILDING_TYPES: Record<BuildingType, { label: string; residential: boolean }> = {
  condo: { label: "Condominium", residential: true },
  hotel: { label: "Hotel", residential: false },
  office: { label: "Office", residential: false },
};

export const SOURCES = {
  plan: {
    short: "Bangkok Comprehensive Plan 2556",
    url: "https://download.asa.or.th/03media/04law/cpa/mr56-bma.pdf",
  },
  mr55: {
    short: "Ministerial Regulation 55",
    url: "https://download.asa.or.th/03media/04law/fubr/a1_bcmr55-63.pdf",
  },
  mr33: {
    short: "Ministerial Regulation 33",
    url: "https://download.asa.or.th/03media/04law/cba/mr/mr35-33-upd69.pdf",
  },
  bma: {
    short: "Bangkok Building Control Ordinance 2544",
    url: "https://download.asa.or.th/03media/04law/cba/bb/bb44-03.pdf",
  },
  osm: { short: "OpenStreetMap", url: "https://www.openstreetmap.org/" },
  assumption: { short: "Tool assumption (see notes)", url: "" },
} as const;
export type SourceId = keyof typeof SOURCES;

export interface Citation {
  source: SourceId;
  clause: string;
}

/** FAR and OSR (open space as % of floor area) by zone, 2013 plan (Gazette text). */
export const ZONES: Record<string, { far: number; osrPct: number; label: string }> = {
  "ย.1": { far: 1, osrPct: 40, label: "Low-density residential" },
  "ย.2": { far: 1.5, osrPct: 20, label: "Low-density residential" },
  "ย.3": { far: 2.5, osrPct: 12.5, label: "Low-density residential" },
  "ย.4": { far: 3, osrPct: 10, label: "Low-density residential" },
  "ย.5": { far: 4, osrPct: 7.5, label: "Medium-density residential" },
  "ย.6": { far: 4.5, osrPct: 6.5, label: "Medium-density residential" },
  "ย.7": { far: 5, osrPct: 6, label: "Medium-density residential" },
  "ย.8": { far: 6, osrPct: 5, label: "High-density residential" },
  "ย.9": { far: 7, osrPct: 4.5, label: "High-density residential, inner city on mass transit" },
  "ย.10": { far: 8, osrPct: 4, label: "High-density residential, next to the CBD" },
  "พ.1": { far: 5, osrPct: 6, label: "Commercial" },
  "พ.2": { far: 6, osrPct: 5, label: "Commercial" },
  "พ.3": { far: 7, osrPct: 4.5, label: "Commercial" },
  "พ.4": { far: 8, osrPct: 4, label: "Commercial" },
  "พ.5": { far: 10, osrPct: 3, label: "Commercial" },
  "อ.1": { far: 2, osrPct: 15, label: "Industrial" },
  "อ.2": { far: 1.5, osrPct: 20, label: "Industrial" },
  "อ.3": { far: 1, osrPct: 40, label: "Warehouse" },
  "ศ.1": { far: 3, osrPct: 10, label: "Thai cultural conservation" },
  "ศ.2": { far: 4, osrPct: 7.5, label: "Thai cultural conservation" },
};

/** The zone this tool is built and checked for. */
export const TARGET_ZONE = "ย.9";

/** High-rise from 23 m (ground to roof slab), MR 33. */
export const HIGH_RISE_M = 23;
/** Extra-large building from 10,000 m² of floor area, MR 33. */
export const EXTRA_LARGE_M2 = 10_000;
/** Above 30,000 m² the access road must be at least 18 m wide, MR 33 cl. 2. */
export const VERY_LARGE_M2 = 30_000;
/** Hotel floor area per room, for room counts (assumption, notes 5f). */
export const HOTEL_M2_PER_ROOM = 50;

/**
 * Building line from the plot's road edge, MR 55 cl. 41 / BMA cl. 50.
 * The law measures narrow roads from the centreline; converted here to the plot edge.
 */
export function roadLineSetback(roadWidthM: number): { m: number; rule: string } {
  const w = roadWidthM;
  if (w < 6)
    return { m: Math.max(0, 3 - w / 2), rule: "road under 6 m: 3 m from the road centreline" };
  if (w < 10)
    return { m: Math.max(0, 6 - w / 2), rule: "road under 10 m: 6 m from the road centreline" };
  if (w <= 20) return { m: w / 10, rule: "road 10–20 m: 1/10 of the road width" };
  return { m: 2, rule: "road over 20 m: 2 m from the road edge" };
}

export type Status = "ok" | "limit" | "warn" | "info";

export interface RuleItem {
  id: string;
  group: "zone" | "size" | "setback" | "height" | "access";
  title: string;
  value: string;
  detail: string;
  status: Status;
  cite: Citation[];
}

export interface RulesInput {
  zone: string | null;
  zonesTouched: string[];
  plotAreaM2: number;
  frontageM: number;
  roadName: string;
  roadWidthM: number;
  buildingType: BuildingType;
  station: { name: string; distanceM: number } | null;
  plannedRoads: { name: string; widthM: number }[];
}

export type EnvelopeKind = "high-rise" | "mid-rise";

export interface Rules {
  zone: string | null;
  far: number;
  osrPct: number;
  maxGfaM2: number;
  /** GFA cap from the access road (MR 33), may be below FAR. */
  gfaCapM2: number;
  /** Is a high-rise / extra-large building allowed on this road and frontage? */
  highRiseAllowed: boolean;
  /** Which envelope applies: the biggest building the road allows. */
  envelopeKind: EnvelopeKind;
  setbacks: Record<EnvelopeKind, { roadM: number; sideM: number }>;
  /** Max height of a mid-rise building (just under the high-rise line). */
  midRiseMaxM: number;
  roadWidthM: number;
  footprintMaxShare: number;
  openSpaceMinShareOfPlot: number;
  items: RuleItem[];
}

const m = (n: number, dp = 1) => `${n.toLocaleString("en-US", { maximumFractionDigits: dp })} m`;
const m2 = (n: number) => `${Math.round(n).toLocaleString("en-US")} m²`;
const pct = (n: number) => `${(n * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;

export function computeRules(input: RulesInput): Rules {
  const { plotAreaM2: A, roadWidthM: W, frontageM, buildingType } = input;
  const type = BUILDING_TYPES[buildingType];
  const zoneRow = input.zone ? ZONES[input.zone] : undefined;
  const far = zoneRow?.far ?? 0;
  const osrPct = zoneRow?.osrPct ?? 0;
  const maxGfa = far * A;
  const items: RuleItem[] = [];

  // ---- Zone -------------------------------------------------------------------
  const crosses = input.zonesTouched.length > 1;
  items.push({
    id: "zone",
    group: "zone",
    title: "Zone",
    value: input.zone ?? "Outside the zoning map",
    detail: !input.zone
      ? "The plot's centre is not in any zone of the 2013 plan."
      : input.zone !== TARGET_ZONE
        ? `${zoneRow?.label ?? "Zone"}. This tool is built and checked for ${TARGET_ZONE}; FAR and OSR use this zone's values, but its allowed uses are not checked.`
        : `${zoneRow?.label}. Condo is an allowed use (plan cl. 16).`,
    status: input.zone === TARGET_ZONE ? "ok" : "warn",
    cite: [{ source: "plan", clause: "Zoning map, cl. 16" }],
  });
  if (crosses) {
    items.push({
      id: "zone-crossing",
      group: "zone",
      title: "Plot crosses a zone line",
      value: input.zonesTouched.join(" + "),
      detail:
        "The plan applies each zone's rules to its own part of the plot. This tool uses the zone at the plot's centre for the whole plot.",
      status: "warn",
      cite: [{ source: "plan", clause: "Zoning map" }],
    });
  }
  items.push({
    id: "special-area",
    group: "zone",
    title: "Special height-control area",
    value: "None",
    detail:
      "The BMA's area-specific height-ban ordinances (old town, Samphanthawong, 2022 ceilings) do not cover Sukhumvit. An architect would confirm this for the exact plot.",
    status: "info",
    cite: [{ source: "bma", clause: "Area ordinances (notes §1)" }],
  });

  // ---- Floor area -------------------------------------------------------------
  items.push({
    id: "far",
    group: "size",
    title: "Floor area ratio (FAR)",
    value: `${far} → max ${m2(maxGfa)}`,
    detail: `Total floor area of all storeys ≤ FAR × plot area = ${far} × ${m2(A)}. Floor area includes balconies and enclosed parking floors (MR 33 cl. 1, as amended by MR 50).`,
    status: "info",
    cite: [
      { source: "plan", clause: "Zone table" },
      { source: "mr33", clause: "cl. 1 (definitions)" },
    ],
  });

  // ---- High-rise access (MR 33 cl. 2) ----------------------------------------
  const roadOkFor30k = W >= 10;
  const roadOkForAny = W >= 18;
  const frontageOk = frontageM >= 12;
  const highRiseAllowed = frontageOk && roadOkFor30k;
  const gfaCap = !highRiseAllowed
    ? Math.min(maxGfa, EXTRA_LARGE_M2)
    : roadOkForAny
      ? maxGfa
      : Math.min(maxGfa, VERY_LARGE_M2);
  items.push({
    id: "mr33-access",
    group: "access",
    title: "Road access for a high-rise",
    value: highRiseAllowed
      ? gfaCap < maxGfa
        ? `Allowed up to ${m2(VERY_LARGE_M2)}`
        : "Allowed"
      : "Not allowed",
    detail: highRiseAllowed
      ? `A building ≥ ${HIGH_RISE_M} m tall or ≥ ${m2(EXTRA_LARGE_M2)} needs ≥ 12 m frontage on a public road ≥ 10 m wide, and ≥ 18 m wide above ${m2(VERY_LARGE_M2)}. This plot: ${m(frontageM)} on a ${m(W)} road.${gfaCap < maxGfa ? ` The road is under 18 m, so floor area is capped at ${m2(VERY_LARGE_M2)}, below the FAR limit.` : ""}`
      : `${!frontageOk ? `Frontage is ${m(frontageM)}, under the 12 m needed.` : ""}${!roadOkFor30k ? ` The road is ${m(W)} wide, under the 10 m needed.` : ""} So the building must stay under ${HIGH_RISE_M} m and under ${m2(EXTRA_LARGE_M2)}.`,
    status: highRiseAllowed ? (gfaCap < maxGfa ? "limit" : "ok") : "limit",
    cite: [{ source: "mr33", clause: "cl. 2" }],
  });

  // ---- Use-specific road rules (plan cl. 16, cl. 36) --------------------------
  const nearStation = (input.station?.distanceM ?? Infinity) <= 500;
  const stationText = input.station
    ? `nearest station ${input.station.name}, ${m(input.station.distanceM, 0)} away`
    : "no station data";
  if (buildingType === "hotel") {
    const rooms = Math.floor(gfaCap / HOTEL_M2_PER_ROOM);
    const ok = W >= 12 && frontageM >= 12;
    items.push({
      id: "hotel-road",
      group: "access",
      title: "Hotel over 80 rooms",
      value: ok || nearStation ? "Allowed" : "Max 80 rooms",
      detail: `In ${TARGET_ZONE}, a hotel over 80 rooms needs a road ≥ 12 m wide with ≥ 12 m frontage on it, or a site within 500 m of a rail station (${stationText}). At this size it would have about ${rooms.toLocaleString("en-US")} rooms (1 room per ${HOTEL_M2_PER_ROOM} m², assumption).`,
      status: ok || nearStation ? "ok" : "limit",
      cite: [
        { source: "plan", clause: "cl. 16, cl. 36" },
        { source: "assumption", clause: "50 m² per room" },
      ],
    });
  }
  if (buildingType === "office") {
    const ok = W >= 16 && frontageM >= 16;
    items.push({
      id: "office-road",
      group: "access",
      title: "Office over 10,000 m²",
      value: ok || nearStation ? "Allowed" : `Max ${m2(EXTRA_LARGE_M2)}`,
      detail: `In ${TARGET_ZONE}, an office over ${m2(EXTRA_LARGE_M2)} needs a road ≥ 16 m wide with ≥ 16 m frontage on it, or a site within 500 m of a rail station (${stationText}).`,
      status: ok || nearStation ? "ok" : "limit",
      cite: [{ source: "plan", clause: "cl. 16, cl. 36" }],
    });
  }

  // ---- Setbacks ---------------------------------------------------------------
  const line = roadLineSetback(W);
  const setbacks = {
    "high-rise": { roadM: Math.max(line.m, 6), sideM: 6 },
    "mid-rise": { roadM: line.m, sideM: 3 },
  };
  const kind: EnvelopeKind = highRiseAllowed ? "high-rise" : "mid-rise";
  items.push({
    id: "setback-road",
    group: "setback",
    title: "Setback from the road",
    value: `${m(setbacks[kind].roadM)} (${kind})`,
    detail: `Building line: ${line.rule} = ${m(line.m)} from the plot edge. A high-rise must also keep 6 m from public roads (MR 33 cl. 4). The larger of the two applies, never their sum: high-rise ${m(setbacks["high-rise"].roadM)}, mid-rise ${m(setbacks["mid-rise"].roadM)}. Road width means the legal or planned width, not the paved width.`,
    status: "info",
    cite: [
      { source: "mr55", clause: "cl. 41" },
      { source: "bma", clause: "cl. 50" },
      { source: "mr33", clause: "cl. 4" },
    ],
  });
  items.push({
    id: "setback-side",
    group: "setback",
    title: "Setback from neighbours",
    value: `${m(setbacks[kind].sideM)} (${kind})`,
    detail: `A high-rise keeps 6 m from neighbouring land, above and below ground (MR 33 cl. 4). A mid-rise wall with windows keeps 2 m up to 9 m height and 3 m above; the tool applies 3 m to the whole block. Every wall is assumed to have windows.`,
    status: "info",
    cite: [
      { source: "mr33", clause: "cl. 4" },
      { source: "mr55", clause: "cl. 50" },
      { source: "bma", clause: "cl. 54" },
    ],
  });

  // ---- Height -----------------------------------------------------------------
  const frontHeight = 2 * (setbacks[kind].roadM + W);
  items.push({
    id: "height-plane",
    group: "height",
    title: "Height from the road",
    value: `≤ 2 × distance to far side of road`,
    detail: `At every point, height ≤ 2 × the horizontal distance to the far edge of the road. A sloping plane, not a flat cap: at the building line (${m(setbacks[kind].roadM)} back) it allows ${m(frontHeight)}, rising further back.`,
    status: "info",
    cite: [
      { source: "mr55", clause: "cl. 44" },
      { source: "bma", clause: "cl. 49" },
    ],
  });
  items.push({
    id: "height-class",
    group: "height",
    title: "High-rise threshold",
    value:
      kind === "high-rise"
        ? `${HIGH_RISE_M} m and above allowed`
        : `Must stay under ${HIGH_RISE_M} m`,
    detail: `From ${HIGH_RISE_M} m (ground to roof slab) a building is a high-rise, which switches on the 6 m all-round setback, the 6 m fire-truck access road and the road-access rule above.`,
    status: kind === "high-rise" ? "info" : "limit",
    cite: [{ source: "mr33", clause: "cl. 1, 3, 4" }],
  });

  // ---- Footprint and open space ------------------------------------------------
  const footprintMaxShare = type.residential ? 0.7 : 0.9;
  const openMinShare = 1 - footprintMaxShare;
  const openForOsr = (osrPct / 100) * gfaCap;
  const openRequired = Math.max(openMinShare * A, openForOsr);
  const footprintAtFullFar = A - openRequired;
  items.push({
    id: "footprint",
    group: "size",
    title: "Maximum footprint",
    value: `${pct(footprintMaxShare)} of plot = ${m2(footprintMaxShare * A)}`,
    detail: type.residential
      ? "Residential buildings must leave at least 30% of the plot open (BMA cl. 52(1), stricter than MR 55's 30% of the largest floor), so the footprint is at most 70%."
      : "Non-residential buildings must leave at least 10% of the plot open (BMA cl. 52), so the footprint is at most 90%. Hotels are treated as non-residential (assumption).",
    status: "info",
    cite: [{ source: "bma", clause: "cl. 52(1)" }],
  });
  items.push({
    id: "open-space",
    group: "size",
    title: "Open space",
    value: `≥ ${m2(openRequired)} at max floor area`,
    detail: `The larger of ${pct(openMinShare)} of the plot (${m2(openMinShare * A)}) and OSR ${osrPct}% × floor area (${m2(openForOsr)}). Half of it must be permeable ground for planting (zones ย.8–ย.10). Open space is land with nothing above it; podium roof gardens do not count. So at max floor area the footprint can be at most ${m2(footprintAtFullFar)} (${pct(footprintAtFullFar / A)}).`,
    status: openForOsr > openMinShare * A ? "limit" : "info",
    cite: [
      { source: "plan", clause: "OSR, zone table" },
      { source: "bma", clause: "cl. 52(1)" },
    ],
  });

  // ---- Planned road widening -------------------------------------------------
  if (input.plannedRoads.length) {
    const r = input.plannedRoads[0];
    items.push({
      id: "planned-road",
      group: "access",
      title: "Planned road widening",
      value: `${r.name}, ${m(r.widthM, 0)}`,
      detail: `The frontage lies on a planned road (${r.name}, ${m(r.widthM, 0)} right of way). The planned road line counts as the road line for setbacks; enter the planned width as the road width.`,
      status: "limit",
      cite: [{ source: "plan", clause: "cl. 36, planned roads" }],
    });
  }

  return {
    zone: input.zone,
    far,
    osrPct,
    maxGfaM2: maxGfa,
    gfaCapM2: gfaCap,
    highRiseAllowed,
    envelopeKind: kind,
    setbacks,
    midRiseMaxM: HIGH_RISE_M,
    roadWidthM: W,
    footprintMaxShare,
    openSpaceMinShareOfPlot: openMinShare,
    items,
  };
}
