import { memo, useRef, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { ChevronRight, CircleCheck, TriangleAlert } from "lucide-react";
import { RollingNumber, SlidingText, useChangeDirection } from "@/components/common/sliding-text";
import {
  DesignElevation,
  ELEVATION_H,
  elevationScale,
  GROUND_Y,
} from "@/components/design-elevation";
import type { Design } from "@/lib/designs";
import { HIGH_RISE_M, maxFloorAreaFor, type EnvelopeKind, type Rules } from "@/lib/rules";
import { cn } from "@/lib/utils";

const fmt = (n: number, dp = 0) => n.toLocaleString("en-US", { maximumFractionDigits: dp });
const fmtWhole = (n: number) => fmt(Math.round(n));

const DESIGN_NAMES: Record<Design["id"], string> = {
  A: "Tower on podium",
  B: "Mid-rise block",
};

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

interface AnswerCardProps {
  rules: Rules | null;
  /** The envelope kind shown on the map; decides the floor area ceiling. */
  envelopeKind: EnvelopeKind | null;
  areaM2: number;
  designs: [Design, Design] | null;
  /** True while the designs are being worked out for newer inputs. */
  designsStale: boolean;
  selected: Design["id"];
  onSelect: (id: Design["id"]) => void;
  /** Opens the drawer with floors, checks and rules. */
  onOpenDetails: () => void;
  detailsOpen: boolean;
}

/**
 * The answer, floating on the map. On top, how much floor area the plot allows.
 * Below, both concept designs stand side by side in one small street scene, to
 * the same scale: tapping a building picks it (and shows it on the map), and the
 * strip underneath describes the picked one.
 */
/** Memoised: re-renders only when its own data changes, not on every frame of a drag. */
export default memo(function AnswerCard({
  rules,
  envelopeKind,
  areaM2,
  designs,
  designsStale,
  selected,
  onSelect,
  onOpenDetails,
  detailsOpen,
}: AnswerCardProps) {
  const maxAreaM2 = rules && envelopeKind ? Math.round(maxFloorAreaFor(envelopeKind, rules)) : 0;
  const direction = useChangeDirection(maxAreaM2);
  const picked = designs?.find((d) => d.id === selected) ?? null;

  return (
    <section
      aria-label="What you can build"
      className="pointer-events-auto absolute inset-x-3 bottom-20 z-10 rounded-[20px] bg-neutral-100/90 p-1.5 shadow-xl ring-1 shadow-black/10 ring-black/5 backdrop-blur-xl sm:top-[4.25rem] sm:right-auto sm:bottom-auto sm:left-4 sm:w-[18.5rem]"
    >
      <div className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white">
        <header className="px-4 pt-3.5 pb-3">
          <p className="text-[11px] text-neutral-500">You can build up to</p>
          <p
            className="mt-0.5 flex items-baseline text-[22px] leading-7 font-semibold tracking-tight text-neutral-900"
            aria-live="polite"
          >
            {rules ? (
              <>
                <RollingNumber value={maxAreaM2} direction={direction} format={fmtWhole} />
                <span className="ml-1 text-xs font-medium text-neutral-400">m²</span>
              </>
            ) : (
              <span className="my-0.5 inline-block h-6 w-32 animate-pulse rounded-md bg-neutral-100" />
            )}
          </p>
          {rules && (
            <ul className="mt-2 flex items-center gap-2 text-[10px] text-neutral-500">
              <li>
                FAR <span className="font-medium text-neutral-700">{rules.far}</span>
              </li>
              <Divider />
              <li>
                Plot{" "}
                <span className="font-medium text-neutral-700 tabular-nums">{fmt(areaM2)} m²</span>
              </li>
              <Divider />
              <li className="font-medium text-neutral-700">
                {rules.highRiseAllowed ? "High-rise allowed" : `Under ${HIGH_RISE_M} m`}
              </li>
            </ul>
          )}
        </header>

        <DesignScene
          designs={designs}
          stale={designsStale}
          selected={selected}
          onSelect={onSelect}
        />

        {picked && <PickedDesign design={picked} maxAreaM2={maxAreaM2} />}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1.5 pl-2.5">
        <p className="hidden text-[10px] text-neutral-500 sm:block">
          Tap a building to see it on the map.
        </p>
        <button
          type="button"
          onClick={onOpenDetails}
          aria-expanded={detailsOpen}
          aria-label={detailsOpen ? "Hide details" : "Show details"}
          className="text-brand-700 focus-visible:ring-brand-500/60 ml-auto flex h-6 items-center gap-0.5 rounded-md pr-1.5 pl-2 text-[11px] font-medium transition-colors outline-none hover:bg-white focus-visible:ring-2"
        >
          Details
          <ChevronRight
            aria-hidden
            className={cn(
              "size-3.5 transition-transform duration-300 ease-out",
              detailsOpen && "rotate-180",
            )}
          />
        </button>
      </div>
    </section>
  );
});

function Divider() {
  return <li aria-hidden className="h-3 border-l border-dashed border-neutral-200" />;
}

// ---- The street scene ---------------------------------------------------------------

/**
 * Both designs on one ground line, to one scale, with the 23 m high-rise line
 * behind them. The buildings are the radio buttons: Tab lands on the picked one,
 * arrow keys switch.
 */
/** Memoised: the scene redraws only when the designs or the pick change, not on every drag step. */
const DesignScene = memo(function DesignScene({
  designs,
  stale,
  selected,
  onSelect,
}: {
  designs: [Design, Design] | null;
  stale: boolean;
  selected: Design["id"];
  onSelect: (id: Design["id"]) => void;
}) {
  const groupRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const next = selected === "A" ? "B" : "A";
    onSelect(next);
    groupRef.current?.querySelector<HTMLButtonElement>(`[data-design="${next}"]`)?.focus();
  };

  if (!designs) {
    return (
      <div
        aria-busy="true"
        className="mx-1.5 h-24 animate-pulse rounded-xl bg-neutral-50 sm:h-36"
      />
    );
  }

  const tallestM = Math.max(HIGH_RISE_M, ...designs.map((d) => d.totals.roofM));
  const scale = elevationScale(tallestM);
  // Where the 23 m line and the ground fall, as a share of the scene height.
  const thresholdPct = ((GROUND_Y - HIGH_RISE_M * scale) / ELEVATION_H) * 100;
  const groundPct = (GROUND_Y / ELEVATION_H) * 100;

  return (
    <div
      className={cn(
        "relative mx-1.5 h-24 overflow-hidden rounded-xl bg-gradient-to-b from-sky-50 via-white to-white transition-opacity sm:h-36",
        stale && "opacity-60",
      )}
    >
      {/* The 23 m line, behind the buildings. */}
      <div
        aria-hidden
        className="absolute inset-x-2 border-t border-dotted border-neutral-300"
        style={{ top: `${thresholdPct}%` }}
      >
        <span className="absolute -top-3.5 left-0 text-[9px] text-neutral-400 tabular-nums">
          {HIGH_RISE_M} m
        </span>
      </div>
      {/* The ground. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 border-t-2 border-dotted border-neutral-200 bg-neutral-50"
        style={{ top: `${groundPct}%` }}
      />

      <div
        ref={groupRef}
        role="radiogroup"
        aria-label="Concept design"
        aria-busy={stale}
        onKeyDown={handleKeyDown}
        className="absolute inset-0 grid grid-cols-2"
      >
        {designs.map((design) => (
          <SceneBuilding
            key={design.id}
            design={design}
            scale={scale}
            selected={design.id === selected}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
});

function SceneBuilding({
  design,
  scale,
  selected,
  onSelect,
}: {
  design: Design;
  scale: number;
  selected: boolean;
  onSelect: (id: Design["id"]) => void;
}) {
  const handleClick = () => onSelect(design.id);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={selected ? 0 : -1}
      data-design={design.id}
      onClick={handleClick}
      aria-label={`Design ${design.id}: ${DESIGN_NAMES[design.id]}, ${design.totals.storeys} floors, ${fmt(design.totals.roofM)} m`}
      className="group focus-visible:ring-brand-500/60 relative h-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-inset"
    >
      {design.feasible ? (
        // The ghost and the coloured drawing sit on top of each other and crossfade,
        // so picking a design dissolves smoothly instead of swapping colours.
        <span className="absolute inset-0 block">
          <span className="absolute inset-0 block">
            <DesignElevation design={design} scale={scale} ghost />
          </span>
          <motion.span
            className="absolute inset-0 block"
            initial={false}
            animate={{ opacity: selected ? 1 : 0 }}
            transition={{ type: "tween", duration: 0.45, ease: EASE_OUT }}
          >
            <DesignElevation design={design} scale={scale} ghost={false} />
          </motion.span>
        </span>
      ) : (
        <span className="absolute inset-x-0 bottom-3 text-center text-[10px] text-neutral-400">
          Does not fit
        </span>
      )}
      {/* The letter, standing on the ground under its building. */}
      <span
        className={cn(
          "absolute bottom-0.5 left-1/2 flex size-4 -translate-x-1/2 items-center justify-center rounded text-[9px] font-semibold transition-[background-color,color,box-shadow] duration-300",
          selected
            ? "bg-brand-600 shadow-brand-600/30 text-white shadow-sm"
            : "bg-white text-neutral-500 ring-1 ring-neutral-200 group-hover:text-neutral-800",
        )}
      >
        {design.id}
      </span>
    </button>
  );
}

// ---- The picked design ----------------------------------------------------------------

/** One quiet strip describing the picked design; its numbers roll when the pick changes. */
function PickedDesign({ design, maxAreaM2 }: { design: Design; maxAreaM2: number }) {
  const t = design.totals;
  const gfa = Math.round(t.gfaM2);
  const direction = useChangeDirection(gfa);
  const usedPct = maxAreaM2 > 0 ? Math.min(100, Math.round((t.gfaM2 / maxAreaM2) * 100)) : 0;
  const failing = design.checklist.filter((c) => c.status === "fail").length;
  const counted = design.checklist.filter((c) => c.status !== "info").length;

  return (
    <div className="px-4 pt-3 pb-3.5" aria-live="polite">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium text-neutral-700">
          <SlidingText value={DESIGN_NAMES[design.id]} direction={design.id === "A" ? -1 : 1} />
        </span>
        <CheckScore failing={failing} counted={counted} />
      </div>

      {design.feasible ? (
        <>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="flex items-baseline text-sm font-semibold text-neutral-900">
              <RollingNumber value={gfa} direction={direction} format={fmtWhole} />
              <span className="ml-0.5 text-[10px] font-medium text-neutral-400">m²</span>
            </span>
            <span className="text-[10px] text-neutral-500 tabular-nums">
              {t.storeys} floors, {fmt(t.roofM)} m tall
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2" title={`Uses ${usedPct}% of the maximum`}>
            <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-neutral-100">
              <motion.span
                className="bg-brand-500 block h-full rounded-full"
                initial={false}
                animate={{ width: `${usedPct}%` }}
                transition={{ type: "tween", duration: 0.45, ease: EASE_OUT }}
              />
            </span>
            <span className="text-[10px] text-neutral-500 tabular-nums">{usedPct}% of max</span>
          </div>
        </>
      ) : (
        <p className="mt-1.5 text-[10px] text-neutral-500">Does not fit on this plot.</p>
      )}
    </div>
  );
}

function CheckScore({ failing, counted }: { failing: number; counted: number }) {
  const Icon = failing ? TriangleAlert : CircleCheck;
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-[10px] font-medium",
        failing ? "text-red-600" : "text-emerald-700",
      )}
    >
      <Icon aria-hidden className="size-3" />
      {failing ? `${failing} of ${counted} fail` : `${counted} checks pass`}
    </span>
  );
}
