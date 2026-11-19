import { useEffect, useState } from "react";
import SegmentedControl, { type SegmentOption } from "@/components/segmented-control";
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

const SQUARE_METRES_PER_RAI = 1600;
const ROAD_MIN_M = 2;
const ROAD_MAX_M = 80;

const BUILDING_TYPE_OPTIONS: SegmentOption<BuildingType>[] = (
  Object.keys(BUILDING_TYPES) as BuildingType[]
).map((type) => ({ value: type, label: BUILDING_TYPES[type].label }));

/** Inputs: the plot, the road it faces and the building type. */
export default function InputsPanel(props: InputsPanelProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Plot and road</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <PlotSection {...props} />
        <RoadSection {...props} />
        <BuildingTypeSection value={props.buildingType} onChange={props.onBuildingType} />
      </CardContent>
    </Card>
  );
}

// ---- Plot -------------------------------------------------------------------------------

function demolishedText(count: number): string {
  if (count === 0) return "No existing buildings on the plot.";
  const plural = count === 1 ? "" : "s";
  return `${count} existing building${plural} on the plot, to be demolished (dashed outlines on the map).`;
}

function coverageText(coverage: DataCoverage): string {
  return coverage === "outside"
    ? "The plot is outside the purple dashed area that has building and road data. Neighbouring buildings, the building check and the road name are missing here."
    : "Part of the plot is outside the purple dashed area that has building and road data. Buildings and roads beyond that line are not shown or checked.";
}

function PlotSection({
  areaM2,
  edges,
  drawing,
  selfCrossing,
  demolishedCount,
  coverage,
  roadCrossings,
  onDrawToggle,
  onReset,
}: InputsPanelProps) {
  const showDemolished = demolishedCount !== null && coverage !== "outside";
  const crossingNames = roadCrossings.map((c) => c.name).join(", ");

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-semibold tabular-nums">{fmt(areaM2)} m²</span>
        <span className="text-muted-foreground text-xs">
          {edges.length} corners · {fmt(areaM2 / SQUARE_METRES_PER_RAI, 2)} rai
        </span>
      </div>

      {showDemolished && (
        <p className="text-muted-foreground text-xs">{demolishedText(demolishedCount)}</p>
      )}
      {roadCrossings.length > 0 && (
        <p className="text-destructive text-xs">
          A public road runs through the plot ({crossingNames}, shown in red). A plot cannot include
          a public road: move the corners so the road stays outside.
        </p>
      )}
      {coverage !== "inside" && (
        <p className="text-destructive text-xs">{coverageText(coverage)}</p>
      )}
      {selfCrossing && (
        <p className="text-destructive text-xs">
          The outline crosses itself. Drag a corner to untangle it.
        </p>
      )}

      <div className="flex gap-2">
        <Button size="sm" variant={drawing ? "destructive" : "default"} onClick={onDrawToggle}>
          {drawing ? "Cancel drawing" : "Draw new plot"}
        </Button>
        <Button size="sm" variant="outline" onClick={onReset}>
          Reset to sample
        </Button>
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        {drawing
          ? "Click the map to place corners. Click the first corner again to finish."
          : "Drag a corner to move it, or drag inside the plot to move the whole plot. For a different number of corners, draw a new plot."}
      </p>
    </section>
  );
}

// ---- Road -------------------------------------------------------------------------------

function RoadSection({
  edges,
  frontageEdge,
  roadName,
  roadWidthM,
  onFrontageEdge,
  onRoadWidth,
}: InputsPanelProps) {
  const edgeItems = edges.map((edge) => ({
    value: String(edge.index),
    label: `Edge ${edge.index + 1} · ${fmt(edge.lengthM, 1)} m`,
  }));

  const handleEdgeChange = (value: string | null) => {
    if (value !== null) onFrontageEdge(Number(value));
  };
  const handleMainRoadClick = () => onRoadWidth(MAIN_ROAD_WIDTH_M);
  const handleSoiClick = () => onRoadWidth(SOI_WIDTH_M);

  return (
    <section className="flex flex-col gap-2">
      <Label>Edge facing the road</Label>
      <p className="text-muted-foreground -mt-1 text-xs">
        Click or tap an edge (or its number) on the map, or pick it here.
      </p>
      <Select items={edgeItems} value={String(frontageEdge)} onValueChange={handleEdgeChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {edgeItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-muted-foreground text-xs">
        Road: <span className="text-foreground font-medium">{roadName}</span> (nearest public road
        to that edge, from OpenStreetMap)
      </p>

      <Label htmlFor="road-width">Legal road width (m)</Label>
      <div className="flex gap-2">
        <RoadWidthInput value={roadWidthM} onChange={onRoadWidth} />
        <Button
          size="sm"
          variant={roadWidthM === MAIN_ROAD_WIDTH_M ? "secondary" : "outline"}
          onClick={handleMainRoadClick}
        >
          Thong Lo {MAIN_ROAD_WIDTH_M} m
        </Button>
        <Button
          size="sm"
          variant={roadWidthM === SOI_WIDTH_M ? "secondary" : "outline"}
          onClick={handleSoiClick}
        >
          Soi {SOI_WIDTH_M} m
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        The legal or planned width (เขตทาง), not the paved width. OSM rarely records it.
      </p>
    </section>
  );
}

function isValidWidth(text: string): boolean {
  const metres = Number(text);
  return (
    text.trim() !== "" && Number.isFinite(metres) && metres >= ROAD_MIN_M && metres <= ROAD_MAX_M
  );
}

/**
 * Road width box. Keeps its own text while typing, so the field can be cleared
 * and "15" does not pass through a 1 m road on the way. A value is applied only
 * once it is a valid width; leaving the field shows the width in use again.
 */
function RoadWidthInput({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);

  // Follow outside changes (presets, picking another edge) when not typing.
  useEffect(() => {
    if (!editing) setText(String(value));
  }, [value, editing]);

  const handleFocus = () => setEditing(true);
  const handleBlur = () => {
    setEditing(false);
    setText(String(value));
  };
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setText(next);
    if (isValidWidth(next)) onChange(Number(next));
  };

  return (
    <Input
      id="road-width"
      type="number"
      inputMode="decimal"
      min={ROAD_MIN_M}
      max={ROAD_MAX_M}
      step={0.5}
      value={text}
      aria-invalid={editing && !isValidWidth(text)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      className="w-24"
    />
  );
}

// ---- Building type ------------------------------------------------------------------------

function BuildingTypeSection({
  value,
  onChange,
}: {
  value: BuildingType;
  onChange: (type: BuildingType) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <Label>Building type</Label>
      <SegmentedControl
        label="Building type"
        size="lg"
        options={BUILDING_TYPE_OPTIONS}
        value={value}
        onChange={onChange}
      />
    </section>
  );
}
