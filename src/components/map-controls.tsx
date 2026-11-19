import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export interface MapLayers {
  /** Tilted 3D view (true) or flat top-down 2D view, handy for drawing. */
  view3d: boolean;
  envelope: boolean;
  neighbours: boolean;
}

export const DEFAULT_LAYERS: MapLayers = { view3d: true, envelope: true, neighbours: true };

/** 2D/3D view and what to show on the map, top-left over the map. */
export default function MapControls({
  layers,
  onLayers,
}: {
  layers: MapLayers;
  /** Takes an updater, so quick successive clicks never overwrite each other. */
  onLayers: (update: (l: MapLayers) => MapLayers) => void;
}) {
  const set = (patch: Partial<MapLayers>) => onLayers((l) => ({ ...l, ...patch }));
  return (
    <Card className="absolute top-2 left-2 gap-2 px-2.5 py-2 text-xs shadow-sm">
      <div className="bg-muted grid grid-cols-2 gap-1 rounded-md p-0.5" role="radiogroup">
        {[
          { id: false, label: "2D" },
          { id: true, label: "3D" },
        ].map((v) => (
          <button
            key={v.label}
            type="button"
            role="radio"
            aria-checked={layers.view3d === v.id}
            onClick={() => set({ view3d: v.id })}
            className={cn(
              "rounded px-2 py-1 font-medium transition-colors",
              layers.view3d === v.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      <label className="flex cursor-pointer items-center justify-between gap-3">
        Envelope
        <Switch size="sm" checked={layers.envelope} onCheckedChange={(v) => set({ envelope: v })} />
      </label>
      <label className="flex cursor-pointer items-center justify-between gap-3">
        Buildings
        <Switch
          size="sm"
          checked={layers.neighbours}
          onCheckedChange={(v) => set({ neighbours: v })}
        />
      </label>
    </Card>
  );
}
