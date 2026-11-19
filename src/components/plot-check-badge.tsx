import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BuildingOverlap } from "@/lib/building-overlap";
import type { DataCoverage, RoadCrossing } from "@/lib/site";

/**
 * Says whether the plot line cuts through any existing building. A real plot
 * boundary does not, so a cut means the plot is drawn wrongly.
 */
export default function PlotCheckBadge({
  overlaps,
  coverage,
}: {
  overlaps: BuildingOverlap[] | null;
  coverage: DataCoverage;
}) {
  if (!overlaps) return null;
  // Outside the data area there is nothing to check against: say so, not "✓".
  if (coverage === "outside")
    return <Badge variant="destructive">⚠ No building data here, plot not checked</Badge>;

  const colliding = overlaps.filter((o) => o.status === "colliding");
  const onPlot = overlaps.length - colliding.length;
  const n = colliding.length;
  const cutM2 = colliding.reduce((sum, o) => sum + o.overlapM2, 0);
  const label =
    n === 0 ? "Plot line cuts no buildings" : `Plot line cuts ${n} building${n === 1 ? "" : "s"}`;
  const detail =
    n === 0
      ? `${onPlot} existing building${onPlot === 1 ? "" : "s"} on the plot will be demolished.`
      : `The plot boundary runs through ${n} neighbouring building${n === 1 ? "" : "s"} (${Math.round(cutM2)} m² inside the plot), shown in red. Drag the corners so the line follows the gaps between buildings.`;

  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>
        <Badge variant={n === 0 ? "outline" : "destructive"}>
          {n === 0 ? "✓" : "⚠"} {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{detail}</TooltipContent>
    </Tooltip>
  );
}

/** Warns when a public road runs through the plot. Shows nothing when none does. */
export function RoadCrossingBadge({ crossings }: { crossings: RoadCrossing[] }) {
  if (!crossings.length) return null;
  const names = crossings.map((c) => c.name).join(", ");
  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>
        <Badge variant="destructive">⚠ Plot crosses {names}</Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        {`A public road runs through the plot (${crossings
          .map((c) => `${c.name}, ${Math.round(c.insideM)} m inside`)
          .join(
            "; ",
          )}), shown in red. A plot cannot include a public road. Private driveways are not counted.`}
      </TooltipContent>
    </Tooltip>
  );
}
