import { memo, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Drawer } from "@base-ui/react/drawer";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import {
  ArrowUpToLine,
  ChevronDown,
  CircleCheck,
  ExternalLink,
  Layers,
  ListChecks,
  Map as MapIcon,
  MapPinned,
  MoveHorizontal,
  Route,
  Ruler,
  Scale,
  Signpost,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import StatusIcon, { type Tone } from "@/components/common/status-icon";
import { Switch } from "@/components/ui/switch";
import type { EnvelopeView } from "@/hooks/use-analysis";
import { SM_UP, useMediaQuery } from "@/hooks/use-media-query";
import { USE_COLOURS } from "@/lib/colours";
import type { CheckStatus, Design } from "@/lib/designs";
import type { Edge } from "@/lib/local-frame";
import { MAIN_ROAD_WIDTH_M, SOI_WIDTH_M } from "@/lib/site";
import { SOURCES, type Citation, type RuleItem, type Rules, type Status } from "@/lib/rules";
import { cn } from "@/lib/utils";

const fmt = (n: number, dp = 0) => n.toLocaleString("en-US", { maximumFractionDigits: dp });

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

type DrawerTab = "floors" | "checks" | "rules";

const TABS: { id: DrawerTab; label: string; Icon: LucideIcon }[] = [
  { id: "floors", label: "Floors", Icon: Layers },
  { id: "checks", label: "Checks", Icon: ListChecks },
  { id: "rules", label: "Rules", Icon: Scale },
];

const USE_LABEL: Record<Design["floorTable"][number]["use"], string> = {
  lobby: "Lobby",
  parking: "Parking",
  residential: "Flats",
  hotel: "Hotel rooms",
  office: "Offices",
};

const CHECK_TONE: Record<CheckStatus, Tone> = {
  pass: "pass",
  fail: "fail",
  flag: "flag",
  info: "info",
};

/** How a rule's status reads: fine, limits the building, needs a look, or just applies. */
const RULE_TONE: Record<Status, Tone> = {
  ok: "pass",
  limit: "limit",
  warn: "fail",
  info: "info",
};

const RULE_GROUPS: { id: RuleItem["group"]; title: string; icon: LucideIcon }[] = [
  { id: "zone", title: "Zone", icon: MapPinned },
  { id: "size", title: "Floor area and open space", icon: Ruler },
  { id: "access", title: "Road access", icon: Route },
  { id: "setback", title: "Setbacks", icon: MoveHorizontal },
  { id: "height", title: "Height", icon: ArrowUpToLine },
];

interface DetailsDrawerProps {
  open: boolean;
  onClose: () => void;
  design: Design | null;
  rules: Rules | null;
  view: EnvelopeView;
  /** Takes an updater, so quick successive clicks never overwrite each other. */
  onView: (update: (view: EnvelopeView) => EnvelopeView) => void;
  road: RoadSide;
}

/** The plot's edges and which one faces the road, for the road-side picker. */
export interface RoadSide {
  edges: Edge[];
  frontageEdge: number;
  roadName: string;
  onFrontageEdge: (edge: number) => void;
  roadWidthM: number;
  onRoadWidth: (m: number) => void;
}

/** Common legal widths, one click each: a main road like Thong Lo, or a soi. */
const ROAD_PRESETS = [
  { label: "Main road", widthM: MAIN_ROAD_WIDTH_M },
  { label: "Soi", widthM: SOI_WIDTH_M },
];

/**
 * The details behind the answer card, sliding in from the right: the picked
 * design's floors and checks, and the zoning rules with their legal sources.
 * Escape or the close button puts it away.
 */
/** Memoised: re-renders only when its own data changes, not on every frame of a drag. */
export default memo(function DetailsDrawer(props: DetailsDrawerProps) {
  const desktop = useMediaQuery(SM_UP);
  return desktop ? <SidePanel {...props} /> : <BottomSheet {...props} />;
});

/** Larger screens: a panel sliding in from the right, next to the map tools. */
function SidePanel({ open, onClose, ...content }: DetailsDrawerProps) {
  const panelRef = useRef<HTMLElement>(null);

  // Move focus into the panel when it opens, so the keyboard follows.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          ref={panelRef}
          key="details"
          role="dialog"
          aria-label="Details"
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ type: "tween", duration: 0.32, ease: EASE_OUT }}
          className="pointer-events-auto absolute top-[4.25rem] right-[4.25rem] bottom-20 z-20 flex w-[22rem] flex-col rounded-[20px] bg-neutral-100/90 p-1.5 shadow-xl ring-1 shadow-black/10 ring-black/5 backdrop-blur-xl outline-none"
        >
          <DetailsBody {...content} onClose={onClose} />
          <p className="px-2.5 pt-2 pb-0.5 text-[11px] text-neutral-500">
            Open a row to see why it applies and its legal source.
          </p>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/**
 * Phones: a bottom sheet in the same card style, with a grab handle. Swipe it
 * down, tap outside or press close to put it away.
 */
function BottomSheet({ open, onClose, ...content }: DetailsDrawerProps) {
  const handleOpenChange = (next: boolean) => {
    if (!next) onClose();
  };

  return (
    <Drawer.Root open={open} onOpenChange={handleOpenChange} swipeDirection="down">
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-40 bg-neutral-950/25 backdrop-blur-[2px] transition-opacity duration-300 ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
          <Drawer.Popup className="flex h-[78dvh] w-full [transform:translateY(var(--drawer-swipe-movement-y))] flex-col rounded-t-[24px] bg-neutral-100 p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-2xl ring-1 shadow-black/20 ring-black/5 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none data-[ending-style]:[transform:translateY(100%)] data-[starting-style]:[transform:translateY(100%)] data-[swiping]:transition-none">
            <span
              aria-hidden
              className="mx-auto mt-0.5 mb-1.5 h-1 w-10 shrink-0 rounded-full bg-neutral-300"
            />
            <Drawer.Title className="sr-only">Details</Drawer.Title>
            <Drawer.Content className="flex min-h-0 flex-1 flex-col">
              <DetailsBody {...content} onClose={onClose} />
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** The tabs and their contents, shared by the side panel and the bottom sheet. */
function DetailsBody({
  onClose,
  design,
  rules,
  view,
  onView,
  road,
}: Omit<DetailsDrawerProps, "open">) {
  const [tab, setTab] = useState<DrawerTab>("floors");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-neutral-200/70 bg-white">
      <header className="flex items-center border-b border-neutral-200/80 pr-2">
        <DrawerTabs value={tab} onChange={setTab} />
        <button
          type="button"
          aria-label="Close details"
          onClick={onClose}
          className="focus-visible:ring-brand-500/60 ml-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors outline-none hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-2"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3.5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ type: "tween", duration: 0.18, ease: EASE_OUT }}
          >
            {tab === "floors" && <FloorsTab design={design} />}
            {tab === "checks" && <ChecksTab design={design} />}
            {tab === "rules" && <RulesTab rules={rules} view={view} onView={onView} road={road} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---- Tabs ---------------------------------------------------------------------------------

/** Three full-width tabs with an underline that slides to the chosen one; arrow keys switch. */
function DrawerTabs({ value, onChange }: { value: DrawerTab; onChange: (tab: DrawerTab) => void }) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const index = TABS.findIndex((t) => t.id === value);
    const next = TABS[(index + step + TABS.length) % TABS.length].id;
    onChange(next);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.focus();
  };

  return (
    <LayoutGroup id="drawer-tabs">
      <div
        ref={listRef}
        role="tablist"
        aria-label="Details"
        onKeyDown={handleKeyDown}
        className="grid flex-1 grid-cols-3"
      >
        {TABS.map((t) => (
          <DrawerTabButton key={t.id} tab={t} selected={t.id === value} onSelect={onChange} />
        ))}
      </div>
    </LayoutGroup>
  );
}

function DrawerTabButton({
  tab,
  selected,
  onSelect,
}: {
  tab: (typeof TABS)[number];
  selected: boolean;
  onSelect: (tab: DrawerTab) => void;
}) {
  const handleClick = () => onSelect(tab.id);
  const { Icon } = tab;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      data-tab={tab.id}
      onClick={handleClick}
      className={cn(
        "relative flex h-11 items-center justify-center gap-1.5 text-xs font-medium transition-colors outline-none focus-visible:bg-neutral-50",
        selected ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-800",
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          "size-3.5 transition-colors",
          selected ? "text-brand-600" : "text-neutral-400",
        )}
      />
      {tab.label}
      {selected && (
        <motion.span
          layoutId="drawer-tab-underline"
          aria-hidden
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
          className="bg-brand-600 absolute inset-x-4 -bottom-px h-0.5 rounded-full"
        />
      )}
    </button>
  );
}

// ---- Floors ---------------------------------------------------------------------------------

function FloorsTab({ design }: { design: Design | null }) {
  if (!design) return <Empty text="Working out the designs…" />;
  if (!design.feasible) return <Empty text="No building fits on this plot." />;
  const t = design.totals;
  const rows = [...design.floorTable].reverse(); // top floor first, like a section

  const facts: { label: string; value: string }[] = [
    { label: "Floor area", value: `${fmt(t.gfaM2)} m²` },
    { label: "Height", value: `${fmt(t.roofM, 1)} m, ${t.storeys} floors` },
    ...(t.units
      ? [
          {
            label: "Units",
            value: `${fmt(t.units.total)} (${fmt(t.units.oneBed)} 1-bed, ${fmt(t.units.twoBed)} 2-bed)`,
          },
          { label: "Sellable", value: `${fmt(t.units.sellableM2)} m²` },
        ]
      : []),
    ...(t.rooms !== undefined ? [{ label: "Hotel rooms", value: fmt(t.rooms) }] : []),
    { label: "Parking", value: `${fmt(t.parkingProvided)} of ${fmt(t.parkingRequired)} required` },
    { label: "Footprint", value: `${fmt(t.footprintM2)} m²` },
    { label: "Open space", value: `${fmt(t.openSpaceM2)} m²` },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[13px] font-semibold text-neutral-900">{design.name}</h2>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500">{design.summary}</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {facts.map((fact) => (
          <div key={fact.label} className="flex flex-col">
            <dt className="text-[11px] text-neutral-500">{fact.label}</dt>
            <dd className="text-xs font-medium text-neutral-900 tabular-nums">{fact.value}</dd>
          </div>
        ))}
      </dl>

      <Section title="Floor by floor" icon={Layers}>
        <ul className="flex flex-col divide-y divide-dashed divide-neutral-200">
          {rows.map((row) => (
            <li key={`${row.label}-${row.fromM}`} className="flex items-center gap-2.5 py-2">
              <span
                aria-hidden
                className="h-6 w-1 shrink-0 rounded-full"
                style={{ background: USE_COLOURS[row.use] }}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-xs font-medium text-neutral-800">
                  {row.label}
                  <span className="ml-1.5 font-normal text-neutral-500">{USE_LABEL[row.use]}</span>
                </span>
                <span className="text-[11px] text-neutral-400 tabular-nums">
                  {fmt(row.fromM, 1)} to {fmt(row.toM, 1)} m, {row.floors} ×{" "}
                  {fmt(row.areaPerFloorM2)} m²
                </span>
              </span>
              <span className="text-xs font-medium text-neutral-800 tabular-nums">
                {fmt(row.totalM2)} m²
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-1 flex items-center justify-between border-t border-neutral-200 pt-2 text-xs font-semibold text-neutral-900 tabular-nums">
          <span>Total floor area</span>
          <span>{fmt(t.gfaM2)} m²</span>
        </div>
      </Section>
    </div>
  );
}

// ---- Checks ---------------------------------------------------------------------------------

function ChecksTab({ design }: { design: Design | null }) {
  if (!design) return <Empty text="Working out the designs…" />;
  const problems = design.checklist.filter((c) => c.status === "fail" || c.status === "flag");
  const others = design.checklist.filter((c) => c.status !== "fail" && c.status !== "flag");

  return (
    <div className="flex flex-col gap-4">
      {problems.length > 0 && (
        <Section title="Needs attention" icon={TriangleAlert} tone="warn">
          <DetailList>
            {problems.map((c) => (
              <DetailRow
                key={c.id}
                tone={CHECK_TONE[c.status]}
                title={c.label}
                value={c.value}
                detail={c.detail}
                cite={c.cite}
              />
            ))}
          </DetailList>
        </Section>
      )}
      <Section
        title={problems.length ? "Passing" : `All ${others.length} checks pass`}
        icon={CircleCheck}
        tone="ok"
      >
        <DetailList>
          {others.map((c) => (
            <DetailRow
              key={c.id}
              tone={CHECK_TONE[c.status]}
              title={c.label}
              value={c.value}
              detail={c.detail}
              cite={c.cite}
            />
          ))}
        </DetailList>
      </Section>
    </div>
  );
}

// ---- Rules ----------------------------------------------------------------------------------

function RulesTab({
  rules,
  view,
  onView,
  road,
}: {
  rules: Rules | null;
  view: EnvelopeView;
  onView: (update: (view: EnvelopeView) => EnvelopeView) => void;
  road: RoadSide;
}) {
  if (!rules) return <Empty text="Loading the zoning rules…" />;

  const toggle = (key: "roadSetback" | "sideSetback" | "heightPlane") => (on: boolean) =>
    onView((current) => ({ ...current, [key]: on }));
  const handleRoadSetback = toggle("roadSetback");
  const handleSideSetback = toggle("sideSetback");
  const handleHeightPlane = toggle("heightPlane");

  return (
    <div className="flex flex-col gap-4">
      <Section title="Road side" icon={Signpost}>
        <RoadSidePicker road={road} />
      </Section>

      <Section title="Show on the map" icon={MapIcon}>
        <EnvelopeKindPicker value={view.kind} onView={onView} />
        {view.kind === "high-rise" && !rules.highRiseAllowed && (
          <p className="mb-2 text-[11px] text-amber-700">
            The road does not allow a high-rise here; it is shown only for comparison.
          </p>
        )}
        <div className="flex flex-col gap-2 rounded-xl bg-neutral-50 px-3 py-2.5">
          <RuleSwitch
            label="Road setback"
            checked={view.roadSetback}
            onChange={handleRoadSetback}
          />
          <RuleSwitch
            label="Side setbacks"
            checked={view.sideSetback}
            onChange={handleSideSetback}
          />
          <RuleSwitch
            label="Height plane"
            checked={view.heightPlane}
            onChange={handleHeightPlane}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-neutral-500">
          Turn a rule off to see how much it shapes the allowed envelope.
        </p>
      </Section>

      {RULE_GROUPS.map((group) => {
        const items = rules.items.filter((item) => item.group === group.id);
        if (!items.length) return null;
        return (
          <Section key={group.id} title={group.title} icon={group.icon}>
            <DetailList>
              {items.map((item) => (
                <DetailRow
                  key={item.id}
                  tone={RULE_TONE[item.status]}
                  title={item.title}
                  value={item.value}
                  detail={item.detail}
                  cite={item.cite}
                />
              ))}
            </DetailList>
          </Section>
        );
      })}
    </div>
  );
}

/**
 * Which plot edge faces the road: one chip per edge with its length. The same as
 * clicking an edge on the map.
 */
function RoadSidePicker({ road }: { road: RoadSide }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-neutral-600">
        Faces <span className="font-medium text-neutral-900">{road.roadName}</span>
      </p>
      <div role="radiogroup" aria-label="Edge facing the road" className="flex flex-wrap gap-1">
        {road.edges.map((edge) => (
          <EdgeChip
            key={edge.index}
            edge={edge}
            selected={edge.index === road.frontageEdge}
            onSelect={road.onFrontageEdge}
          />
        ))}
      </div>
      <p className="text-[11px] text-neutral-500">Or click an edge of the plot on the map.</p>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-[11px] text-neutral-500">Width</span>
        {ROAD_PRESETS.map((preset) => (
          <RoadPreset
            key={preset.label}
            preset={preset}
            selected={road.roadWidthM === preset.widthM}
            onRoadWidth={road.onRoadWidth}
          />
        ))}
      </div>
    </div>
  );
}

function RoadPreset({
  preset,
  selected,
  onRoadWidth,
}: {
  preset: (typeof ROAD_PRESETS)[number];
  selected: boolean;
  onRoadWidth: (m: number) => void;
}) {
  const handleClick = () => onRoadWidth(preset.widthM);
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={handleClick}
      className={cn(
        "focus-visible:ring-brand-500/60 flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium tabular-nums transition-colors outline-none focus-visible:ring-2",
        selected
          ? "bg-brand-50 text-brand-700 ring-brand-600/20 ring-1"
          : "bg-white text-neutral-600 shadow-sm ring-1 shadow-black/5 ring-black/10 hover:text-neutral-900",
      )}
    >
      {preset.label}
      <span className={selected ? "text-brand-600/80" : "text-neutral-400"}>{preset.widthM} m</span>
    </button>
  );
}

function EdgeChip({
  edge,
  selected,
  onSelect,
}: {
  edge: Edge;
  selected: boolean;
  onSelect: (edge: number) => void;
}) {
  const handleClick = () => onSelect(edge.index);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`Edge ${edge.index + 1}, ${fmt(edge.lengthM, 1)} metres`}
      onClick={handleClick}
      className={cn(
        "focus-visible:ring-brand-500/60 flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium tabular-nums transition-colors outline-none focus-visible:ring-2",
        selected
          ? "bg-brand-50 text-brand-700 ring-brand-600/20 ring-1"
          : "bg-white text-neutral-600 shadow-sm ring-1 shadow-black/5 ring-black/10 hover:text-neutral-900",
      )}
    >
      <span className={cn("font-semibold", selected ? "text-brand-700" : "text-neutral-900")}>
        {edge.index + 1}
      </span>
      <span className={selected ? "text-brand-600/80" : "text-neutral-400"}>
        {fmt(edge.lengthM, 0)} m
      </span>
    </button>
  );
}

const ENVELOPE_KINDS: { value: EnvelopeView["kind"]; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "high-rise", label: "High-rise" },
  { value: "mid-rise", label: "Mid-rise" },
];

/**
 * Which envelope the map draws: "Auto" is the biggest building the road allows;
 * the other two show one kind on purpose, to compare.
 */
function EnvelopeKindPicker({
  value,
  onView,
}: {
  value: EnvelopeView["kind"];
  onView: (update: (view: EnvelopeView) => EnvelopeView) => void;
}) {
  return (
    <LayoutGroup id="envelope-kind">
      <div
        role="radiogroup"
        aria-label="Envelope to show"
        className="mb-2 grid grid-cols-3 gap-0.5 rounded-lg bg-neutral-100 p-0.5"
      >
        {ENVELOPE_KINDS.map((kind) => (
          <EnvelopeKindButton
            key={kind.value}
            kind={kind}
            selected={kind.value === value}
            onView={onView}
          />
        ))}
      </div>
    </LayoutGroup>
  );
}

function EnvelopeKindButton({
  kind,
  selected,
  onView,
}: {
  kind: (typeof ENVELOPE_KINDS)[number];
  selected: boolean;
  onView: (update: (view: EnvelopeView) => EnvelopeView) => void;
}) {
  const handleClick = () => onView((current) => ({ ...current, kind: kind.value }));
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={handleClick}
      className={cn(
        "focus-visible:ring-brand-500/60 relative h-7 rounded-md text-xs font-medium transition-colors outline-none focus-visible:ring-2",
        selected ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-800",
      )}
    >
      {selected && (
        <motion.span
          layoutId="envelope-kind-pill"
          aria-hidden
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
          className="absolute inset-0 rounded-md bg-white shadow-sm ring-1 shadow-black/10 ring-black/10"
        />
      )}
      <span className="relative">{kind.label}</span>
    </button>
  );
}

function RuleSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-xs font-medium text-neutral-700">
      {label}
      <Switch size="sm" checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

// ---- Shared pieces --------------------------------------------------------------------------

function Section({
  title,
  icon: Icon,
  tone,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  /** "warn" tints the title for sections about problems; "ok" greens the icon for passes. */
  tone?: "warn" | "ok";
  children: ReactNode;
}) {
  return (
    <section>
      <h3
        className={cn(
          "mb-1.5 flex items-center gap-1.5 text-xs font-semibold",
          tone === "warn" ? "text-amber-700" : "text-neutral-900",
        )}
      >
        {Icon && (
          <Icon
            aria-hidden
            className={cn(
              "size-3.5",
              tone === "warn" && "text-amber-600",
              tone === "ok" && "text-emerald-600",
              !tone && "text-neutral-400",
            )}
          />
        )}
        {title}
      </h3>
      {children}
    </section>
  );
}

function DetailList({ children }: { children: ReactNode }) {
  return (
    <ul className="-mx-2 flex flex-col divide-y divide-dashed divide-neutral-200">{children}</ul>
  );
}

/**
 * One rule or check: icon, title and value. Clicking opens the reason and its
 * legal sources with a smooth height animation. Each row keeps a little space
 * above and below, so its hover highlight never touches the dotted dividers.
 */
function DetailRow({
  tone,
  title,
  value,
  detail,
  cite,
}: {
  tone: Tone;
  title: string;
  value: string;
  detail: string;
  cite: Citation[];
}) {
  const [open, setOpen] = useState(false);
  const handleToggle = () => setOpen((isOpen) => !isOpen);

  return (
    <li className="py-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={handleToggle}
        className="focus-visible:ring-brand-500/60 flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors outline-none hover:bg-neutral-50 focus-visible:ring-2"
      >
        <StatusIcon tone={tone} className="mt-px size-3.5" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-medium text-neutral-800">{title}</span>
          <span className="text-[11px] text-neutral-500 tabular-nums">{value}</span>
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "mt-0.5 size-3.5 shrink-0 text-neutral-400 transition-transform duration-300 ease-out",
            open && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "tween", duration: 0.28, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1.5 pt-1 pr-2 pb-2 pl-7.5">
              <p className="text-xs leading-relaxed text-neutral-600">{detail}</p>
              <Sources cite={cite} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/** The legal sources behind a rule or check, as links to the PDFs. */
function Sources({ cite }: { cite: Citation[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {cite.map((c) => {
        const source = SOURCES[c.source];
        const text = `${source.short}, ${c.clause}`;
        return (
          <li key={`${c.source}-${c.clause}`} className="text-[11px]">
            {source.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 inline-flex items-center gap-1 underline-offset-2 hover:underline"
              >
                {text}
                <ExternalLink className="size-2.5" aria-hidden />
              </a>
            ) : (
              <span className="text-neutral-500">{text}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-xs text-neutral-500">{text}</p>;
}
