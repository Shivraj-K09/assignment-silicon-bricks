import { Card } from "@/components/ui/card";

// The colour key (real vs estimated heights)
//
const ITEMS = [
  { colour: "#6b7280", label: "Building, height from OSM" },
  { colour: "#d6d3cc", label: "Building, height estimated" },
  { colour: "#dc2626", label: "Building cut by the plot line" },
  { colour: "#2563eb", label: "Your plot", outline: true },
];

/** Explains the map colours. Heights come from OpenStreetMap where tagged;
 * the rest are estimated from footprint size, so they are shown differently. */
export default function MapLegend() {
  return (
    <Card className="absolute bottom-8 left-2 gap-1.5 px-3 py-2 text-xs shadow-sm">
      {ITEMS.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span
            className="size-3 shrink-0 rounded-sm"
            style={
              item.outline
                ? { border: `2px solid ${item.colour}`, background: `${item.colour}26` }
                : { background: item.colour }
            }
          />
          {item.label}
        </div>
      ))}
    </Card>
  );
}
