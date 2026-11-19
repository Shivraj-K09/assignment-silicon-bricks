import SegmentedControl, { type SegmentOption } from "@/components/segmented-control";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export interface MapLayers {
  /** Tilted 3D view (true) or flat top-down 2D view, handy for drawing. */
  view3d: boolean;
  envelope: boolean;
  /** The selected concept design, drawn as massing. */
  design: boolean;
  neighbours: boolean;
}

export const DEFAULT_LAYERS: MapLayers = {
  view3d: true,
  envelope: true,
  design: true,
  neighbours: true,
};

const VIEW_OPTIONS: SegmentOption<boolean>[] = [
  { value: false, label: "2D" },
  { value: true, label: "3D" },
];

interface MapControlsProps {
  layers: MapLayers;
  /** Takes an updater, so quick successive clicks never overwrite each other. */
  onLayers: (update: (l: MapLayers) => MapLayers) => void;
}

/** 2D/3D view and what to show on the map, top-left over the map. */
export default function MapControls({ layers, onLayers }: MapControlsProps) {
  const update = (patch: Partial<MapLayers>) => onLayers((current) => ({ ...current, ...patch }));
  const handleViewChange = (view3d: boolean) => update({ view3d });
  const handleEnvelopeChange = (envelope: boolean) => update({ envelope });
  const handleDesignChange = (design: boolean) => update({ design });
  const handleBuildingsChange = (neighbours: boolean) => update({ neighbours });

  return (
    <Card className="absolute top-2 left-2 gap-2 px-2.5 py-2 text-xs shadow-sm">
      <SegmentedControl
        label="Map view"
        size="sm"
        options={VIEW_OPTIONS}
        value={layers.view3d}
        onChange={handleViewChange}
      />
      <LayerSwitch label="Envelope" checked={layers.envelope} onChange={handleEnvelopeChange} />
      <LayerSwitch label="Design" checked={layers.design} onChange={handleDesignChange} />
      <LayerSwitch label="Buildings" checked={layers.neighbours} onChange={handleBuildingsChange} />
    </Card>
  );
}

function LayerSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      {label}
      <Switch size="sm" checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
