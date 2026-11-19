import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Envelope } from "@/lib/envelope";
import { SOURCES, type RuleItem, type Rules, type Status } from "@/lib/rules";
import { cn } from "@/lib/utils";

const STATUS: Record<Status, { dot: string; label: string }> = {
  ok: { dot: "bg-emerald-500", label: "OK" },
  limit: { dot: "bg-amber-500", label: "Limits the building" },
  warn: { dot: "bg-red-500", label: "Check this" },
  info: { dot: "bg-slate-300", label: "Applies" },
};

const GROUPS: { id: RuleItem["group"]; title: string }[] = [
  { id: "zone", title: "Zone" },
  { id: "size", title: "Floor area and open space" },
  { id: "access", title: "Road access" },
  { id: "setback", title: "Setbacks" },
  { id: "height", title: "Height" },
];

const fmt = (n: number, dp = 0) => n.toLocaleString("en-US", { maximumFractionDigits: dp });

// The rules table: FAR, open space, setbacks, height and so on, each with its legal source.
//
export function EnvelopeSummary({
  rules,
  envelope,
  displayCapM,
}: {
  rules: Rules;
  envelope: Envelope | null;
  displayCapM: number;
}) {
  const kind = rules.envelopeKind;
  const s = rules.setbacks[kind];
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Allowed envelope
          <Badge variant={kind === "high-rise" ? "default" : "secondary"}>
            {kind === "high-rise" ? "High-rise" : "Mid-rise, under 23 m"}
          </Badge>
        </CardTitle>
        <CardDescription>
          The teal volume on the map: the space a building may fill after setbacks and the road
          height limit.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {envelope?.error ? (
          <p className="text-destructive text-xs">{envelope.error}</p>
        ) : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Stat label="Max floor area" value={`${fmt(rules.gfaCapM2)} m²`} />
            <Stat label="FAR" value={`${rules.far}`} />
            <Stat label="Buildable footprint" value={`${fmt(envelope?.footprintM2 ?? 0)} m²`} />
            <Stat
              label="Setbacks road / sides"
              value={`${fmt(s.roadM, 1)} / ${fmt(s.sideM, 1)} m`}
            />
            <Stat
              label="Height at building line"
              value={`${fmt(envelope?.frontHeightM ?? 0, 1)} m`}
            />
            <Stat
              label="Highest point"
              value={
                kind === "high-rise" && (envelope?.maxHeightM ?? 0) >= displayCapM
                  ? `${displayCapM} m+ (drawn to ${displayCapM} m)`
                  : `${fmt(envelope?.maxHeightM ?? 0, 1)} m`
              }
            />
          </dl>
        )}
      </CardContent>
    </Card>
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

export default function RulesPanel({ rules }: { rules: Rules }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Rules that apply</CardTitle>
        <CardDescription>
          From the Thai legal texts. Updates as you change the plot, road or building type.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {GROUPS.map((g) => {
          const items = rules.items.filter((i) => i.group === g.id);
          if (!items.length) return null;
          return (
            <section key={g.id} className="flex flex-col gap-2">
              <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {g.title}
              </h3>
              <ul className="flex flex-col gap-2">
                {items.map((item) => (
                  <RuleRow key={item.id} item={item} />
                ))}
              </ul>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RuleRow({ item }: { item: RuleItem }) {
  const st = STATUS[item.status];
  return (
    <li className="rounded-lg border p-2.5">
      <details>
        <summary className="flex cursor-pointer list-none items-start gap-2 [&::-webkit-details-marker]:hidden">
          <span
            className={cn("mt-1.5 size-2 shrink-0 rounded-full", st.dot)}
            title={st.label}
            aria-label={st.label}
          />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm">{item.title}</span>
            <span className="text-sm font-medium tabular-nums">{item.value}</span>
          </span>
          <span className="text-muted-foreground text-xs">Why ▾</span>
        </summary>
        <div className="mt-2 flex flex-col gap-1.5 pl-4">
          <p className="text-muted-foreground text-xs leading-relaxed">{item.detail}</p>
          <p className="text-xs">
            {item.cite.map((c, i) => {
              const src = SOURCES[c.source];
              return (
                <span key={i}>
                  {i > 0 && " · "}
                  {src.url ? (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {src.short}, {c.clause}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">
                      {src.short}: {c.clause}
                    </span>
                  )}
                </span>
              );
            })}
          </p>
        </div>
      </details>
    </li>
  );
}
