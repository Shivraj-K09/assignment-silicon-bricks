import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import MapView from "@/components/map-view";

export default function App() {
  return (
    <TooltipProvider>
      <div className="bg-background text-foreground flex h-dvh flex-col">
        <header className="flex items-center gap-3 border-b px-4 py-2">
          <h1 className="text-sm font-semibold">Bangkok Plot Tool</h1>
          <Badge variant="secondary">Thong Lo · ย.9</Badge>
        </header>
        <main className="relative flex-1">
          <MapView />
        </main>
      </div>
    </TooltipProvider>
  );
}
