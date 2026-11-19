import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Edge } from "@/lib/local-frame";
import { BUILDING_TYPES, type BuildingType } from "@/lib/rules";
import { MAIN_ROAD_WIDTH_M, SOI_WIDTH_M, type DataCoverage, type RoadCrossing } from "@/lib/site";
import { cn } from "@/lib/utils";

interface InputsPanelProps {
  areaM2: number;
  edges: Edge[];
  frontageEdge: number;
  roadName: string;
  roadWidthM: number;
  buildingType: BuildingType;
  drawing: boolean;
  selfCrossing: boolean;
  /** Existing buildings inside the plot, to be demolished. Null while data loads. */
  demolishedCount: number | null;
  coverage: DataCoverage;
  roadCrossings: RoadCrossing[];
  onDrawToggle: () => void;
  onReset: () => void;
  onFrontageEdge: (edge: number) => void;
  onRoadWidth: (m: number) => void;
  onBuildingType: (t: BuildingType) => void;
}

const fmt = (n: number, dp = 0) => n.toLocaleString("en-US", { maximumFractionDigits: dp });

export default function InputsPanel(p: InputsPanelProps) {
  const edgeItems = p.edges.map((e) => ({
    value: String(e.index),
    label: `Edge ${e.index + 1} · ${fmt(e.lengthM, 1)} m`,
  }));

  // pick the road side, the road width and the building type
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Plot and road</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Plot */}
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold tabular-nums">{fmt(p.areaM2)} m²</span>
            <span className="text-muted-foreground text-xs">
              {p.edges.length} corners · {fmt(p.areaM2 / 1600, 2)} rai
            </span>
          </div>
          {p.demolishedCount !== null && p.coverage !== "outside" && (
            <p className="text-muted-foreground text-xs">
              {p.demolishedCount === 0
                ? "No existing buildings on the plot."
                : `${p.demolishedCount} existing building${p.demolishedCount === 1 ? "" : "s"} on the plot, to be demolished (dashed outlines on the map).`}
            </p>
          )}
          {p.roadCrossings.length > 0 && (
            <p className="text-destructive text-xs">
              A public road runs through the plot ({p.roadCrossings.map((c) => c.name).join(", ")},
              shown in red). A plot cannot include a public road: move the corners so the road stays
              outside.
            </p>
          )}
          {p.coverage !== "inside" && (
            <p className="text-destructive text-xs">
              {p.coverage === "outside"
                ? "The plot is outside the purple dashed area that has building and road data. Neighbouring buildings, the building check and the road name are missing here."
                : "Part of the plot is outside the purple dashed area that has building and road data. Buildings and roads beyond that line are not shown or checked."}
            </p>
          )}
          {p.selfCrossing && (
            <p className="text-destructive text-xs">
              The outline crosses itself. Drag a corner to untangle it.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={p.drawing ? "destructive" : "default"}
              onClick={p.onDrawToggle}
            >
              {p.drawing ? "Cancel drawing" : "Draw new plot"}
            </Button>
            <Button size="sm" variant="outline" onClick={p.onReset}>
              Reset to sample
            </Button>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {p.drawing
              ? "Click the map to place corners. Click the first corner again to finish."
              : "Drag a corner to move it, or drag inside the plot to move the whole plot. For a different number of corners, draw a new plot."}
          </p>
        </section>

        {/* Road */}
        <section className="flex flex-col gap-2">
          <Label>Edge facing the road</Label>
          <p className="text-muted-foreground -mt-1 text-xs">
            Click or tap an edge (or its number) on the map, or pick it here.
          </p>
          <Select
            items={edgeItems}
            value={String(p.frontageEdge)}
            onValueChange={(v) => v !== null && p.onFrontageEdge(Number(v))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {edgeItems.map((it) => (
                <SelectItem key={it.value} value={it.value}>
                  {it.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Road: <span className="text-foreground font-medium">{p.roadName}</span> (nearest public
            road to that edge, from OpenStreetMap)
          </p>
          <Label htmlFor="road-width">Legal road width (m)</Label>
          <div className="flex gap-2">
            <Input
              id="road-width"
              type="number"
              inputMode="decimal"
              min={2}
              max={80}
              step={0.5}
              value={p.roadWidthM}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v > 0) p.onRoadWidth(Math.min(v, 80));
              }}
              className="w-24"
            />
            <Button
              size="sm"
              variant={p.roadWidthM === MAIN_ROAD_WIDTH_M ? "secondary" : "outline"}
              onClick={() => p.onRoadWidth(MAIN_ROAD_WIDTH_M)}
            >
              Thong Lo {MAIN_ROAD_WIDTH_M} m
            </Button>
            <Button
              size="sm"
              variant={p.roadWidthM === SOI_WIDTH_M ? "secondary" : "outline"}
              onClick={() => p.onRoadWidth(SOI_WIDTH_M)}
            >
              Soi {SOI_WIDTH_M} m
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            The legal or planned width (เขตทาง), not the paved width. OSM rarely records it.
          </p>
        </section>

        {/* Building type */}
        <section className="flex flex-col gap-2">
          <Label>Building type</Label>
          <div className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-1" role="radiogroup">
            {(Object.keys(BUILDING_TYPES) as BuildingType[]).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={p.buildingType === t}
                onClick={() => p.onBuildingType(t)}
                className={cn(
                  "rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                  p.buildingType === t
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {BUILDING_TYPES[t].label}
              </button>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
