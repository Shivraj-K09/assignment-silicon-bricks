import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { Box, Map as MapIcon, Minus, Plus, RotateCcw } from "lucide-react";
import { FLOATING_BAR } from "@/components/common/floating-bar";
import LayersMenu from "@/components/layers-menu";
import MapHelp from "@/components/map-help";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { MapLayers, SidePanel } from "@/lib/map-layer-options";
import { cn } from "@/lib/utils";

export const TOOL_BUTTON =
  "flex size-8 items-center justify-center rounded-lg text-neutral-500 transition-colors outline-none hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-brand-500/60 disabled:pointer-events-none disabled:opacity-35 data-[popup-open]:bg-neutral-100 data-[popup-open]:text-neutral-900 [&_svg]:size-4";

interface MapToolsProps {
  /** The map, once it is ready; the zoom and compass buttons wait for it. */
  map: MapLibreMap | null;
  layers: MapLayers;
  onLayers: (update: (layers: MapLayers) => MapLayers) => void;
  onView3d: (view3d: boolean) => void;
  onReset: () => void;
  /** Which panel is open on the right; opening one here closes the others. */
  panel: SidePanel;
  onPanel: (panel: SidePanel) => void;
}

/**
 * How the map is viewed, as a slim vertical bar on the right edge: zoom, a
 * compass that faces north again, layers and legend, 2D or 3D, how to move the
 * map, and back to the sample plot. Kept apart from the dock, which holds only
 * the inputs for the plot.
 */
export default function MapTools({
  map,
  layers,
  onLayers,
  onView3d,
  onReset,
  panel,
  onPanel,
}: MapToolsProps) {
  const bearing = useBearing(map);

  const handleZoomIn = () => map?.zoomIn();
  const handleZoomOut = () => map?.zoomOut();
  const handleFaceNorth = () => map?.easeTo({ bearing: 0, duration: 500 });
  const handleViewToggle = () => onView3d(!layers.view3d);
  const handleLayersOpen = (open: boolean) => onPanel(open ? "layers" : null);
  const handleHelpOpen = (open: boolean) => onPanel(open ? "help" : null);

  return (
    <div
      role="toolbar"
      aria-label="Map view"
      aria-orientation="vertical"
      className={cn(FLOATING_BAR, "absolute top-[4.25rem] right-3 z-10 flex-col sm:right-4")}
    >
      <ToolTip text="Zoom in">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={handleZoomIn}
          disabled={!map}
          className={TOOL_BUTTON}
        >
          <Plus aria-hidden />
        </button>
      </ToolTip>
      <ToolTip text="Zoom out">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={handleZoomOut}
          disabled={!map}
          className={TOOL_BUTTON}
        >
          <Minus aria-hidden />
        </button>
      </ToolTip>
      <ToolTip text="Face north">
        <button
          type="button"
          aria-label={`Face north, the map is turned ${Math.round(bearing)} degrees`}
          onClick={handleFaceNorth}
          disabled={!map}
          className={TOOL_BUTTON}
        >
          <Compass bearing={bearing} />
        </button>
      </ToolTip>

      <Divider />

      <ToolTip text="Layers and legend">
        <LayersMenu
          layers={layers}
          onLayers={onLayers}
          triggerClassName={TOOL_BUTTON}
          open={panel === "layers"}
          onOpenChange={handleLayersOpen}
        />
      </ToolTip>
      <ToolTip text={layers.view3d ? "Flat map" : "3D view"}>
        <button
          type="button"
          aria-label="3D view"
          aria-pressed={layers.view3d}
          onClick={handleViewToggle}
          className={TOOL_BUTTON}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={layers.view3d ? "3d" : "2d"}
              initial={{ opacity: 0, rotate: -30, scale: 0.8 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 30, scale: 0.8 }}
              transition={{ type: "tween", duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="flex"
            >
              {layers.view3d ? <Box aria-hidden /> : <MapIcon aria-hidden />}
            </motion.span>
          </AnimatePresence>
        </button>
      </ToolTip>
      <ToolTip text="How to move the map">
        <MapHelp
          triggerClassName={TOOL_BUTTON}
          open={panel === "help"}
          onOpenChange={handleHelpOpen}
        />
      </ToolTip>

      <Divider />

      <ToolTip text="Back to the sample plot">
        <button
          type="button"
          aria-label="Back to the sample plot"
          onClick={onReset}
          className={TOOL_BUTTON}
        >
          <RotateCcw aria-hidden />
        </button>
      </ToolTip>
    </div>
  );
}

/** The map's rotation in degrees, kept in step as the user turns the map. */
function useBearing(map: MapLibreMap | null): number {
  const [bearing, setBearing] = useState(() => map?.getBearing() ?? 0);
  useEffect(() => {
    if (!map) return;
    const handleRotate = () => setBearing(map.getBearing());
    handleRotate();
    map.on("rotate", handleRotate);
    return () => {
      map.off("rotate", handleRotate);
    };
  }, [map]);
  return bearing;
}

/** A compass needle that turns with the map; its red tip always points north. */
function Compass({ bearing }: { bearing: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className="size-4 transition-transform duration-150 ease-out"
      style={{ transform: `rotate(${-bearing}deg)` }}
    >
      <path d="M8 1.5 10.5 8h-5z" fill="#ef4444" />
      <path d="M8 14.5 5.5 8h5z" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1.5 my-0.5 border-t border-dashed border-neutral-200" />;
}

/** A tooltip to the left of a tool, since the bar sits on the right edge. */
function ToolTip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<div className="flex" />}>{children}</TooltipTrigger>
      <TooltipContent side="left">{text}</TooltipContent>
    </Tooltip>
  );
}
