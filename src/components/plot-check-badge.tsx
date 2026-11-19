import { CircleCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BuildingOverlap } from "@/lib/building-overlap";
import type { DataCoverage, RoadCrossing } from "@/lib/site";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** A badge with a tooltip that explains it. */
function ExplainedBadge({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  const Icon = ok ? CircleCheck : TriangleAlert;
  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>
        <Badge variant={ok ? "outline" : "destructive"}>
          <Icon aria-hidden />
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{detail}</TooltipContent>
    </Tooltip>
  );
}

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

  // Outside the data area there is nothing to check against: say so, not "OK".
  if (coverage === "outside") {
    return (
      <ExplainedBadge
        ok={false}
        label="No building data here, plot not checked"
        detail="The plot is outside the area with OpenStreetMap buildings and roads (purple dashed line), so neighbours cannot be checked."
      />
    );
  }

  const colliding = overlaps.filter((o) => o.status === "colliding");
  const demolished = overlaps.length - colliding.length;
  const cutM2 = Math.round(colliding.reduce((sum, o) => sum + o.overlapM2, 0));

  if (colliding.length === 0) {
    return (
      <ExplainedBadge
        ok
        label="Plot line cuts no buildings"
        detail={`${plural(demolished, "existing building")} on the plot will be demolished.`}
      />
    );
  }
  return (
    <ExplainedBadge
      ok={false}
      label={`Plot line cuts ${plural(colliding.length, "building")}`}
      detail={`The plot boundary runs through ${plural(colliding.length, "neighbouring building")} (${cutM2} m² inside the plot), shown in red. Drag the corners so the line follows the gaps between buildings.`}
    />
  );
}

/** Warns when a public road runs through the plot. Shows nothing when none does. */
export function RoadCrossingBadge({ crossings }: { crossings: RoadCrossing[] }) {
  if (!crossings.length) return null;
  const names = crossings.map((c) => c.name).join(", ");
  const lengths = crossings.map((c) => `${c.name}, ${Math.round(c.insideM)} m inside`).join("; ");
  return (
    <ExplainedBadge
      ok={false}
      label={`Plot crosses ${names}`}
      detail={`A public road runs through the plot (${lengths}), shown in red. A plot cannot include a public road. Private driveways are not counted.`}
    />
  );
}
