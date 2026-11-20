import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { LayoutGroup, motion, MotionConfig } from "motion/react";
import {
  BriefcaseBusiness,
  Building2,
  Hotel,
  Minus,
  PenTool,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react";
import { FLOATING_BAR, FloatingBarSlot, Seam } from "@/components/common/floating-bar";
import { RollingNumber, SlidingText, useChangeDirection } from "@/components/common/sliding-text";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BUILDING_TYPES, type BuildingType } from "@/lib/rules";
import { cn } from "@/lib/utils";

const ROAD_MIN_M = 2;
const ROAD_MAX_M = 80;

const BUILDING_TYPE_LIST = Object.keys(BUILDING_TYPES) as BuildingType[];

const TYPE_ICONS: Record<BuildingType, LucideIcon> = {
  condo: Building2,
  hotel: Hotel,
  office: BriefcaseBusiness,
};

/** Short names that fit the dock; the full name stays the accessible label. */
const DOCK_LABELS: Record<BuildingType, string> = {
  condo: "Condo",
  hotel: "Hotel",
  office: "Office",
};

/** The pill's slide: quick, settles without overshoot. */
const PILL_SPRING = { type: "spring", stiffness: 420, damping: 36, mass: 0.8 } as const;

/**
 * How long an input waits after the last change before the map recomputes. Longer
 * than the animations, so the heavy envelope and design work never lands mid-motion.
 */
const COMMIT_DELAY_MS = 360;

const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-white";

const ICON_BUTTON =
  "flex size-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-4";

interface MapDockProps {
  buildingType: BuildingType;
  roadWidthM: number;
  roadName: string;
  drawing: boolean;
  onBuildingType: (type: BuildingType) => void;
  onRoadWidth: (m: number) => void;
  onDrawToggle: () => void;
}

const clampRoad = (m: number) => Math.min(ROAD_MAX_M, Math.max(ROAD_MIN_M, Math.round(m)));

/** The small control dock floating at the bottom of the map. */
export default function MapDock({
  buildingType,
  roadWidthM,
  roadName,
  drawing,
  onBuildingType,
  onRoadWidth,
  onDrawToggle,
}: MapDockProps) {
  const [roadDraft, setRoadDraft] = useDeferredCommit(roadWidthM, onRoadWidth);
  const [typeDraft, setTypeDraft] = useDeferredCommit(buildingType, onBuildingType);
  const handleNarrower = () => setRoadDraft((m) => clampRoad(m - 1));
  const handleWider = () => setRoadDraft((m) => clampRoad(m + 1));

  return (
    <MotionConfig transition={PILL_SPRING} reducedMotion="user">
      <FloatingBarSlot edge="bottom">
        <div role="toolbar" aria-label="Plot inputs" className={FLOATING_BAR}>
          <BuildingTypePicker value={typeDraft} onChange={setTypeDraft} />

          <Seam />

          <DockTip text={`Legal width of ${roadName}`}>
            <div role="group" aria-label="Road width" className="flex items-center">
              <button
                type="button"
                aria-label="Narrower road"
                onClick={handleNarrower}
                disabled={roadDraft <= ROAD_MIN_M}
                className={cn(ICON_BUTTON, "size-7", FOCUS_RING)}
              >
                <Minus aria-hidden />
              </button>
              <RoadWidthValue value={roadDraft} onChange={setRoadDraft} />
              <button
                type="button"
                aria-label="Wider road"
                onClick={handleWider}
                disabled={roadDraft >= ROAD_MAX_M}
                className={cn(ICON_BUTTON, "size-7", FOCUS_RING)}
              >
                <Plus aria-hidden />
              </button>
            </div>
          </DockTip>

          <button
            type="button"
            aria-pressed={drawing}
            onClick={onDrawToggle}
            className={cn(
              "ml-0.5 flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-[background-color,box-shadow,filter] sm:px-3 [&_svg]:size-3.5",
              FOCUS_RING,
              drawing
                ? "bg-gradient-to-b from-neutral-50 to-neutral-100 text-neutral-700 shadow-[inset_0_1px_0_rgb(255_255_255),0_1px_2px_rgb(0_0_0/0.12)] ring-1 ring-black/5 hover:to-neutral-200"
                : "bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_1px_2px_color-mix(in_oklab,var(--brand-700)_45%,transparent)] hover:brightness-105",
            )}
          >
            {drawing ? <X aria-hidden /> : <PenTool aria-hidden />}
            <span className="sr-only sm:not-sr-only">{drawing ? "Stop drawing" : "Draw plot"}</span>
          </button>
        </div>
      </FloatingBarSlot>
    </MotionConfig>
  );
}

// ---- Building type ----------------------------------------------------------------------

/**
 * A radio group with roving focus: Tab lands on the chosen type, arrow keys move
 * the choice. A soft blue pill slides to the chosen icon and the name beside
 * the group slides to match. The buttons never change size, so nothing reflows.
 */
function BuildingTypePicker({
  value,
  onChange,
}: {
  value: BuildingType;
  onChange: (type: BuildingType) => void;
}) {
  const groupRef = useRef<HTMLDivElement>(null);

  const focusType = (type: BuildingType) => {
    groupRef.current?.querySelector<HTMLButtonElement>(`[data-type="${type}"]`)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const jump = { Home: 0, End: BUILDING_TYPE_LIST.length - 1 }[event.key];
    if (step === undefined && jump === undefined) return;
    event.preventDefault();
    const count = BUILDING_TYPE_LIST.length;
    const index = jump ?? (BUILDING_TYPE_LIST.indexOf(value) + step! + count) % count;
    const next = BUILDING_TYPE_LIST[index];
    onChange(next);
    focusType(next);
  };

  return (
    <LayoutGroup id="building-type">
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label="Building type"
        onKeyDown={handleKeyDown}
        className="flex items-center gap-0.5"
      >
        {BUILDING_TYPE_LIST.map((type) => (
          <TypeButton key={type} type={type} selected={type === value} onSelect={onChange} />
        ))}
      </div>
      {/* One label for the group, fixed width so the dock never resizes; the word slides in. */}
      <span aria-hidden className="hidden w-11 pl-1 text-xs font-medium text-brand-700 sm:block">
        <SlidingText value={DOCK_LABELS[value]} direction={1} />
      </span>
    </LayoutGroup>
  );
}

function TypeButton({
  type,
  selected,
  onSelect,
}: {
  type: BuildingType;
  selected: boolean;
  onSelect: (type: BuildingType) => void;
}) {
  const Icon = TYPE_ICONS[type];
  const handleClick = () => onSelect(type);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={BUILDING_TYPES[type].label}
      tabIndex={selected ? 0 : -1}
      data-type={type}
      onClick={handleClick}
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 [&_svg]:size-4",
        FOCUS_RING,
        selected ? "text-brand-600" : "text-neutral-500 hover:text-neutral-900",
      )}
    >
      {selected && (
        <motion.span
          layoutId="building-type-pill"
          aria-hidden
          className="absolute inset-0 rounded-lg bg-brand-50 ring-1 ring-brand-600/15 ring-inset"
        />
      )}
      <Icon aria-hidden className="relative" />
    </button>
  );
}

/**
 * A dock value shown at once but applied to the map only once the user pauses.
 * The animation runs on a free main thread, and a run of quick clicks costs one
 * envelope and design recompute instead of one per click.
 */
function useDeferredCommit<T>(committed: T, onCommit: (value: T) => void) {
  const [draft, setDraft] = useState(committed);
  const commitRef = useRef(onCommit);

  // Keep the latest callback without restarting the timer when the parent re-renders.
  useEffect(() => {
    commitRef.current = onCommit;
  }, [onCommit]);

  // Follow outside changes (picking another edge, reset) when they differ.
  useEffect(() => setDraft(committed), [committed]);

  useEffect(() => {
    if (draft === committed) return;
    const timer = window.setTimeout(() => commitRef.current(draft), COMMIT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft, committed]);

  return [draft, setDraft] as const;
}

// ---- Road width -------------------------------------------------------------------------

/**
 * The road width as a spin button: arrow keys change it by 1 m (Shift for 5 m),
 * Page Up/Down by 5 m. The number slides up as it grows and down as it shrinks.
 */
function RoadWidthValue({
  value,
  onChange,
}: {
  value: number;
  onChange: (update: (m: number) => number) => void;
}) {
  const direction = useChangeDirection(value);
  const [editing, setEditing] = useState(false);

  const handleStartEditing = () => setEditing(true);
  const handleStopEditing = () => setEditing(false);
  const handleCommit = (metres: number) => {
    onChange(() => clampRoad(metres));
    setEditing(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      setEditing(true);
      return;
    }
    const big = event.shiftKey ? 5 : 1;
    const delta = {
      ArrowUp: big,
      ArrowRight: big,
      ArrowDown: -big,
      ArrowLeft: -big,
      PageUp: 5,
      PageDown: -5,
    }[event.key];
    if (event.key === "Home") onChange(() => ROAD_MIN_M);
    else if (event.key === "End") onChange(() => ROAD_MAX_M);
    else if (delta !== undefined) onChange((m) => clampRoad(m + delta));
    else return;
    event.preventDefault();
  };

  if (editing) {
    return <RoadWidthInput value={value} onCommit={handleCommit} onCancel={handleStopEditing} />;
  }

  return (
    <span
      role="spinbutton"
      tabIndex={0}
      aria-label="Road width, press Enter to type it"
      aria-valuenow={value}
      aria-valuemin={ROAD_MIN_M}
      aria-valuemax={ROAD_MAX_M}
      aria-valuetext={`${value} metres`}
      onKeyDown={handleKeyDown}
      onClick={handleStartEditing}
      className={cn(
        "flex h-7 w-12 cursor-text items-center justify-center rounded-md text-xs font-medium tabular-nums transition-colors hover:bg-neutral-100",
        FOCUS_RING,
      )}
    >
      <RollingNumber value={value} direction={direction} />
      <span className="ml-0.5 text-neutral-400">m</span>
    </span>
  );
}

/**
 * The road width as a text box, for typing an exact width. Enter or leaving the
 * box applies it (kept within 2 to 80 m); Escape puts the old width back.
 */
function RoadWidthInput({
  value,
  onCommit,
  onCancel,
}: {
  value: number;
  onCommit: (metres: number) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(String(value));
  const metres = Number(text);
  const valid = text.trim() !== "" && Number.isFinite(metres);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => setText(event.target.value);
  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => event.target.select();
  const handleBlur = () => (valid ? onCommit(metres) : onCancel());
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleBlur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  };

  return (
    <span className="flex h-7 w-12 items-center justify-center rounded-md bg-white ring-1 ring-brand-500/50">
      <input
        autoFocus
        type="text"
        inputMode="decimal"
        aria-label="Road width in metres"
        aria-invalid={!valid}
        value={text}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-7 bg-transparent text-right text-xs font-medium text-neutral-900 tabular-nums outline-none"
      />
      <span className="ml-0.5 text-xs text-neutral-400">m</span>
    </span>
  );
}

// ---- Small parts ------------------------------------------------------------------------

function DockTip({
  text,
  className = "flex",
  children,
}: {
  text: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<div className={className} />}>{children}</TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}
