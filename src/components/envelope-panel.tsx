import SegmentedControl, { type SegmentOption } from "@/components/segmented-control";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { EnvelopeView } from "@/hooks/use-analysis";
import type { Envelope } from "@/lib/envelope";
import { EXTRA_LARGE_M2, HIGH_RISE_M, type EnvelopeKind, type Rules } from "@/lib/rules";

const fmt = (n: number, dp = 0) => n.toLocaleString("en-US", { maximumFractionDigits: dp });

interface EnvelopePanelProps {
  rules: Rules;
  shown: { kind: EnvelopeKind; allowed: boolean; capM: number; envelope: Envelope };
  view: EnvelopeView;
  /** Takes an updater, so quick successive clicks never overwrite each other. */
  onView: (update: (v: EnvelopeView) => EnvelopeView) => void;
}

const KIND_OPTIONS: SegmentOption<EnvelopeView["kind"]>[] = [
  { value: "auto", label: "Best allowed" },
  { value: "high-rise", label: "High-rise" },
  { value: "mid-rise", label: `Mid-rise < ${HIGH_RISE_M} m` },
];

/** A mid-rise must also stay under the extra-large threshold, or MR 33's 6 m setbacks apply. */
function maxFloorAreaFor(kind: EnvelopeKind, rules: Rules): number {
  return kind === "mid-rise" ? Math.min(rules.maxGfaM2, EXTRA_LARGE_M2) : rules.gfaCapM2;
}

function setbackText(on: boolean, metres: number): string {
  return on ? fmt(metres, 1) : "off";
}

export default function EnvelopePanel({ rules, shown, view, onView }: EnvelopePanelProps) {
  const { kind, allowed, capM, envelope } = shown;
  const legal = rules.setbacks[kind];
  const allRulesOn = view.roadSetback && view.sideSetback && view.heightPlane;
  const hasFootprint = !envelope.error && envelope.footprintM2 > 0;

  const update = (patch: Partial<EnvelopeView>) => onView((current) => ({ ...current, ...patch }));
  const handleKindChange = (value: EnvelopeView["kind"]) => update({ kind: value });
  const handleRoadSetbackChange = (roadSetback: boolean) => update({ roadSetback });
  const handleSideSetbackChange = (sideSetback: boolean) => update({ sideSetback });
  const handleHeightPlaneChange = (heightPlane: boolean) => update({ heightPlane });

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Allowed envelope
          <Badge variant={kind === "high-rise" ? "default" : "secondary"}>
            {kind === "high-rise" ? "High-rise" : `Mid-rise, under ${HIGH_RISE_M} m`}
          </Badge>
          {!allRulesOn && <Badge variant="destructive">Not the legal envelope</Badge>}
        </CardTitle>
        <CardDescription>
          The teal volume on the map: the space a building may fill after setbacks and the road
          height limit.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <SegmentedControl
          label="Which envelope"
          options={KIND_OPTIONS}
          value={view.kind}
          onChange={handleKindChange}
        />
        {!allowed && (
          <p className="text-destructive text-xs">
            A high-rise is not allowed here (see Road access below). Shown for comparison only.
          </p>
        )}

        {envelope.error && <p className="text-destructive text-xs">{envelope.error}</p>}
        {!envelope.error && !hasFootprint && (
          <p className="text-destructive text-xs">
            The setbacks leave no buildable area on this plot. It is too small or too narrow for a{" "}
            {kind} building: the road side needs {fmt(legal.roadM, 1)} m and the other sides{" "}
            {fmt(legal.sideM, 1)} m.
          </p>
        )}
        {hasFootprint && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Stat label="Max floor area" value={`${fmt(maxFloorAreaFor(kind, rules))} m²`} />
            <Stat label="FAR" value={`${rules.far}`} />
            <Stat label="Buildable footprint" value={`${fmt(envelope.footprintM2)} m²`} />
            <Stat
              label="Setbacks road / sides"
              value={`${setbackText(view.roadSetback, legal.roadM)} / ${setbackText(view.sideSetback, legal.sideM)} m`}
            />
            <Stat label="Height at building line" value={`${fmt(envelope.frontHeightM, 1)} m`} />
            <Stat
              label={kind === "high-rise" ? "Drawn up to" : "Highest point"}
              value={`${fmt(envelope.maxHeightM, 1)} m`}
            />
          </dl>
        )}
        {kind === "high-rise" && hasFootprint && (
          <p className="text-muted-foreground text-xs leading-relaxed">
            There is no fixed height limit in this zone: floor area (FAR) limits the building. The
            envelope is drawn up to {fmt(capM)} m, enough for the full floor area on this footprint
            plus a margin.
          </p>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            See what each rule does
          </h3>
          <RuleSwitch
            label="Setback from the road"
            detail={`${fmt(legal.roadM, 1)} m`}
            checked={view.roadSetback}
            onChange={handleRoadSetbackChange}
          />
          <RuleSwitch
            label="Setback from neighbours"
            detail={`${fmt(legal.sideM, 1)} m`}
            checked={view.sideSetback}
            onChange={handleSideSetbackChange}
          />
          <RuleSwitch
            label="Height from the road"
            detail="≤ 2 × distance to far side of road"
            checked={view.heightPlane}
            onChange={handleHeightPlaneChange}
          />
          <p className="text-muted-foreground text-xs">
            Switch a rule off to see the space it takes away. The legal envelope has all of them on.
          </p>
        </section>
      </CardContent>
    </Card>
  );
}

function RuleSwitch({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-2.5 py-2">
      <span className="flex flex-col">
        <span className="text-sm">{label}</span>
        <span className="text-muted-foreground text-xs">{detail}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
