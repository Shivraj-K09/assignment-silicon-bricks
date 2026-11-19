import { Card } from "@/components/ui/card";
import { COLOURS } from "@/components/map-view";

type Item = { colour: string; label: string; kind: "fill" | "outline" | "line" | "dashed" };

const ITEMS: Item[] = [
  { colour: COLOURS.plot, label: "Your plot", kind: "outline" },
  { colour: COLOURS.frontage, label: "Edge facing the road", kind: "line" },
  { colour: COLOURS.envelope, label: "Allowed envelope", kind: "fill" },
  { colour: COLOURS.envelope, label: "Setback line", kind: "dashed" },
  { colour: COLOURS.realHeight, label: "Building, height from OSM", kind: "fill" },
  { colour: COLOURS.estimatedHeight, label: "Building, height estimated", kind: "fill" },
  { colour: COLOURS.colliding, label: "Building cut by the plot line", kind: "fill" },
  { colour: COLOURS.colliding, label: "Public road through the plot", kind: "line" },
  { colour: COLOURS.demolished, label: "Building to be demolished", kind: "dashed" },
  { colour: COLOURS.dataArea, label: "Edge of building and road data", kind: "dashed" },
];

function Swatch({ colour, kind }: Pick<Item, "colour" | "kind">) {
  if (kind === "line") return <span className="h-1 w-3 rounded" style={{ background: colour }} />;
  if (kind === "dashed")
    return <span className="w-3 border-t-2 border-dashed" style={{ borderColor: colour }} />;
  if (kind === "outline")
    return (
      <span
        className="size-3 rounded-sm"
        style={{ border: `2px solid ${colour}`, background: `${colour}26` }}
      />
    );
  return <span className="size-3 rounded-sm" style={{ background: colour }} />;
}

/** Explains the map colours. Collapsed to a button on small screens. */
export default function MapLegend() {
  return (
    <Card className="absolute bottom-8 left-2 gap-0 px-3 py-2 text-xs shadow-sm">
      <details
        // Open on desktop; collapsed on phones, where it would cover the map.
        open={typeof window === "undefined" || window.innerWidth >= 768}
        className="group [&_summary::-webkit-details-marker]:hidden"
      >
        <summary className="cursor-pointer list-none font-medium group-open:mb-1.5">Legend</summary>
        <div className="flex flex-col gap-1">
          {ITEMS.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="flex w-3 shrink-0 items-center justify-center">
                <Swatch colour={item.colour} kind={item.kind} />
              </span>
              {item.label}
            </div>
          ))}
        </div>
      </details>
    </Card>
  );
}
