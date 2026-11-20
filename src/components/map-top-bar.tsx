import { MapPin } from "lucide-react";
import { FLOATING_BAR, FloatingBarSlot, Seam } from "@/components/common/floating-bar";

const SQUARE_METRES_PER_RAI = 1600;
const fmt = (n: number, dp = 0) => n.toLocaleString("en-US", { maximumFractionDigits: dp });

interface MapTopBarProps {
  /** Zone code of the plot, e.g. "ย.9". Null while the data loads. */
  zone: string | null;
  far: number | null;
  areaM2: number;
}

/** The brand mark: a tower rising behind its podium. */
function BrandMark() {
  return (
    <span className="flex size-6 items-center justify-center rounded-md bg-gradient-to-b from-brand-500 to-brand-600 shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_1px_2px_color-mix(in_oklab,var(--brand-700)_45%,transparent)]">
      <svg viewBox="0 0 16 16" className="size-3.5 text-white" aria-hidden>
        <rect x="2" y="10" width="12" height="4" rx="0.75" fill="currentColor" opacity="0.55" />
        <rect x="5" y="2" width="6" height="8" rx="0.75" fill="currentColor" />
      </svg>
    </span>
  );
}

/** The floating bar along the top of the map: the tool, where the plot is, and its size. */
export default function MapTopBar({ zone, far, areaM2 }: MapTopBarProps) {
  return (
    <FloatingBarSlot edge="top">
      <header className={FLOATING_BAR}>
        <div className="flex h-8 items-center gap-2 pr-1 pl-1.5">
          <BrandMark />
          <h1 className="text-xs font-semibold tracking-tight whitespace-nowrap">
            Bangkok Plot Tool
          </h1>
        </div>

        <Seam />

        <div className="flex h-8 items-center gap-1.5 px-1.5 text-xs whitespace-nowrap">
          <MapPin className="size-3.5 text-neutral-400" aria-hidden />
          <span className="font-medium">Thong Lo</span>
          {zone && (
            <span className="hidden text-neutral-500 sm:inline">
              {zone}
              {far ? `, FAR ${far}` : ""}
            </span>
          )}
        </div>

        <Seam className="hidden sm:block" />

        <div className="hidden h-8 items-center px-1.5 text-xs whitespace-nowrap sm:flex">
          <span className="font-medium tabular-nums">{fmt(areaM2)} m²</span>
          <span className="ml-1 text-neutral-500 tabular-nums">
            ({fmt(areaM2 / SQUARE_METRES_PER_RAI, 2)} rai)
          </span>
        </div>
      </header>
    </FloatingBarSlot>
  );
}
