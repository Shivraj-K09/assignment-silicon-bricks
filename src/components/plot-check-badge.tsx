import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BuildingCheck } from "@/components/map-view";

// The ✓ / ⚠ label: “Plot line cuts no buildings”
//
/**
 * Says whether the plot line cuts through any existing building. A real plot
 * boundary does not, so a cut means the plot is drawn wrongly.
 */
export default function PlotCheckBadge({ check }: { check: BuildingCheck | null }) {
  if (!check) return null;

  const n = check.colliding.length;
  const cutM2 = check.colliding.reduce((sum, o) => sum + o.overlapM2, 0);
  const label =
    n === 0 ? "Plot line cuts no buildings" : `Plot line cuts ${n} building${n === 1 ? "" : "s"}`;
  const detail =
    n === 0
      ? `${check.onPlot} existing building${check.onPlot === 1 ? "" : "s"} on the plot will be demolished.`
      : `The plot boundary runs through ${n} neighbouring building${n === 1 ? "" : "s"} (${Math.round(cutM2)} m² inside the plot), shown in red. Adjust the corners so the line follows the gaps between buildings.`;

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
