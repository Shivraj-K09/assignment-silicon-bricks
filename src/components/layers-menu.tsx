import { Popover } from "@base-ui/react/popover";
import { Layers } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { COLOURS, USE_COLOURS } from "@/lib/colours";
import type { MapLayers } from "@/lib/map-layer-options";
import { cn } from "@/lib/utils";

type SwatchKind = "fill" | "outline" | "line" | "dashed";
type LegendItem = { colour: string; label: string; kind: SwatchKind };

const LEGEND: { title: string; items: LegendItem[] }[] = [
  {
    title: "Your plot",
    items: [
      { colour: COLOURS.plot, label: "Plot", kind: "outline" },
      { colour: COLOURS.frontage, label: "Edge facing the road", kind: "line" },
      { colour: COLOURS.envelope, label: "Allowed envelope", kind: "fill" },
      { colour: COLOURS.envelope, label: "Setback line", kind: "dashed" },
    ],
  },
  {
    title: "Design",
    items: [
      { colour: USE_COLOURS.residential, label: "Flats, rooms or offices", kind: "fill" },
      { colour: USE_COLOURS.parking, label: "Parking", kind: "fill" },
      { colour: USE_COLOURS.lobby, label: "Lobby", kind: "fill" },
    ],
  },
  {
    title: "Around the plot",
    items: [
      { colour: COLOURS.realHeight, label: "Building, height from OpenStreetMap", kind: "fill" },
      { colour: COLOURS.estimatedHeight, label: "Building, height estimated", kind: "fill" },
      { colour: COLOURS.demolished, label: "To be demolished", kind: "dashed" },
      { colour: COLOURS.colliding, label: "Cut by the plot, or road through it", kind: "fill" },
      { colour: COLOURS.dataArea, label: "Edge of the building data", kind: "dashed" },
    ],
  },
];

type LayerKey = "envelope" | "design" | "neighbours";

const SWITCHES: { key: LayerKey; label: string }[] = [
  { key: "envelope", label: "Allowed envelope" },
  { key: "design", label: "Design" },
  { key: "neighbours", label: "Buildings around" },
];

interface LayersMenuProps {
  layers: MapLayers;
  /** Takes an updater, so quick successive clicks never overwrite each other. */
  onLayers: (update: (layers: MapLayers) => MapLayers) => void;
  /** Classes for the trigger button, so it matches the bar it sits in. */
  triggerClassName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * A "Layers" button for the map tools. It opens to the left into a small card: switches for
 * what the map shows, and below them the legend of what the colours mean.
 */
export default function LayersMenu({
  layers,
  onLayers,
  triggerClassName,
  open,
  onOpenChange,
}: LayersMenuProps) {
  const handleOpenChange = (next: boolean) => onOpenChange(next);
  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger aria-label="Map layers and legend" className={triggerClassName}>
        <Layers aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="left" align="end" sideOffset={14} className="z-50">
          <Popover.Popup className="w-64 origin-[var(--transform-origin)] rounded-[20px] bg-neutral-100/90 p-1.5 shadow-xl ring-1 shadow-black/10 ring-black/5 backdrop-blur-xl transition-[transform,opacity] duration-200 ease-out outline-none data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <div className="rounded-2xl border border-neutral-200/70 bg-white">
              <div className="flex flex-col gap-2 px-3.5 py-3">
                <Popover.Title className="text-xs font-semibold text-neutral-900">
                  Show on the map
                </Popover.Title>
                {SWITCHES.map((item) => (
                  <LayerSwitch
                    key={item.key}
                    item={item}
                    checked={layers[item.key]}
                    onLayers={onLayers}
                  />
                ))}
              </div>
              <div className="flex flex-col gap-3 border-t border-dashed border-neutral-200 px-3.5 py-3">
                {LEGEND.map((group) => (
                  <div key={group.title} className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold text-neutral-500">
                      {group.title}
                    </span>
                    <ul className="flex flex-col gap-1">
                      {group.items.map((item) => (
                        <li
                          key={item.label}
                          className="flex items-center gap-2 text-[11px] text-neutral-700"
                        >
                          <span className="flex w-3.5 shrink-0 items-center justify-center">
                            <Swatch colour={item.colour} kind={item.kind} />
                          </span>
                          {item.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function LayerSwitch({
  item,
  checked,
  onLayers,
}: {
  item: (typeof SWITCHES)[number];
  checked: boolean;
  onLayers: LayersMenuProps["onLayers"];
}) {
  const handleChange = (on: boolean) => onLayers((current) => ({ ...current, [item.key]: on }));
  return (
    <label className="flex items-center justify-between gap-3 text-xs text-neutral-700">
      {item.label}
      <Switch size="sm" checked={checked} onCheckedChange={handleChange} />
    </label>
  );
}

function Swatch({ colour, kind }: { colour: string; kind: SwatchKind }) {
  if (kind === "line") return <span className="h-1 w-3.5 rounded" style={{ background: colour }} />;
  if (kind === "dashed") {
    return <span className="w-3.5 border-t-2 border-dashed" style={{ borderColor: colour }} />;
  }
  return (
    <span
      className={cn("size-3 rounded-[3px]", kind === "outline" && "border-2")}
      style={
        kind === "outline"
          ? { borderColor: colour, background: `${colour}26` }
          : { background: colour }
      }
    />
  );
}
