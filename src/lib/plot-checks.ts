import type { BuildingOverlap } from "./building-overlap.ts";
import type { DataCoverage, RoadCrossing } from "./site.ts";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export interface PlotCheck {
  id: string;
  ok: boolean;
  label: string;
  detail: string;
  /** For a problem: one short line on how to fix it. */
  fix?: string;
}

/**
 * Every check on how the plot is drawn: does its line cut a neighbour, does a
 * public road run through it, and is it inside the area with building data.
 * Null while the data loads.
 */
export function listPlotChecks(
  overlaps: BuildingOverlap[] | null,
  crossings: RoadCrossing[],
  coverage: DataCoverage,
  /** The outline crosses itself (a corner dragged across another edge). */
  selfCrossing: boolean,
): PlotCheck[] | null {
  const others = neighbourChecks(overlaps, crossings, coverage);
  if (!others || !selfCrossing) return others;
  return [
    {
      id: "outline",
      ok: false,
      label: "The outline crosses itself",
      detail:
        "Two edges of the plot cross, so its area and the rules cannot be worked out properly.",
      fix: "Drag a corner back to untangle it.",
    },
    ...others,
  ];
}

/** The checks against the surroundings: neighbouring buildings, public roads, data area. */
function neighbourChecks(
  overlaps: BuildingOverlap[] | null,
  crossings: RoadCrossing[],
  coverage: DataCoverage,
): PlotCheck[] | null {
  if (!overlaps) return null;

  // Outside the data area there is nothing to check against: say so, not "OK".
  if (coverage === "outside") {
    return [
      {
        id: "coverage",
        ok: false,
        label: "No building data here",
        fix: "Move the plot inside the purple dashed line.",
        detail:
          "The plot is outside the area with OpenStreetMap buildings and roads (purple dashed line), so neighbours and roads cannot be checked.",
      },
    ];
  }

  const colliding = overlaps.filter((o) => o.status === "colliding");
  const demolished = overlaps.length - colliding.length;
  const cutM2 = Math.round(colliding.reduce((sum, o) => sum + o.overlapM2, 0));
  const names = crossings.map((c) => c.name).join(", ");
  const lengths = crossings.map((c) => `${c.name}, ${Math.round(c.insideM)} m inside`).join("; ");

  return [
    colliding.length === 0
      ? {
          id: "buildings",
          ok: true,
          label: "Plot line cuts no buildings",
          detail:
            demolished === 0
              ? "No existing buildings stand on the plot."
              : `${plural(demolished, "existing building")} on the plot will be demolished (dashed outlines).`,
        }
      : {
          id: "buildings",
          ok: false,
          label: `Plot line cuts ${plural(colliding.length, "building")}`,
          fix: "Drag the corners into the gaps between buildings.",
          detail: `The boundary runs through ${plural(colliding.length, "neighbouring building")} (${cutM2} m² inside the plot), shown in red. Drag the corners so the line follows the gaps between buildings.`,
        },
    crossings.length === 0
      ? {
          id: "roads",
          ok: true,
          label: "No public road through the plot",
          detail: "Private driveways are not counted.",
        }
      : {
          id: "roads",
          ok: false,
          label:
            crossings.length === 1
              ? `Plot crosses ${names}`
              : `Plot crosses ${crossings.length} roads`,
          fix: "Move the corners so the road stays outside the plot.",
          detail: `A public road runs through the plot (${lengths}), shown in red. A plot cannot include a public road.`,
        },
    coverage === "inside"
      ? {
          id: "coverage",
          ok: true,
          label: "Inside the building data area",
          detail: "Neighbours and roads are checked all around the plot.",
        }
      : {
          id: "coverage",
          ok: false,
          label: "Partly outside the data area",
          fix: "Neighbours beyond the purple line are not checked.",
          detail:
            "Part of the plot is outside the area with building and road data (purple dashed line). Buildings and roads beyond it are not checked.",
        },
  ];
}
