import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import MapLegend from "@/components/map-legend";
import MapView, { type BuildingCheck } from "@/components/map-view";
import PlotCheckBadge from "@/components/plot-check-badge";

export default function App() {
  const [buildingCheck, setBuildingCheck] = useState<BuildingCheck | null>(null);

  return (
    <TooltipProvider>
      <div className="bg-background text-foreground flex h-dvh flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
          <h1 className="text-sm font-semibold">Bangkok Plot Tool</h1>
          <Badge variant="secondary">Thong Lo · ย.9</Badge>
          <PlotCheckBadge check={buildingCheck} />
        </header>
        <main className="relative flex-1">
          <MapView onBuildingCheck={setBuildingCheck} />
          <MapLegend />
        </main>
      </div>
    </TooltipProvider>
  );
}
