import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CheckRow, CheckStatus, Design, Use } from "@/lib/designs";
import { SOURCES } from "@/lib/rules";
import { cn } from "@/lib/utils";

const fmt = (n: number, dp = 0) => n.toLocaleString("en-US", { maximumFractionDigits: dp });

/** Colours shared with the 3D massing on the map. */
export const USE_COLOURS: Record<Use, string> = {
  lobby: "#f59e0b",
  parking: "#94a3b8",
  residential: "#60a5fa",
  hotel: "#a78bfa",
  office: "#34d399",
};

const USE_LABEL: Record<Use, string> = {
  lobby: "Lobby",
  parking: "Parking",
  residential: "Residential",
  hotel: "Hotel",
  office: "Office",
};

const STATUS: Record<CheckStatus, { icon: string; className: string; label: string }> = {
  pass: { icon: "✓", className: "text-emerald-600", label: "Pass" },
  fail: { icon: "✗", className: "text-red-600", label: "Fail" },
  flag: { icon: "⚑", className: "text-amber-600", label: "Flag" },
  info: { icon: "i", className: "text-slate-500", label: "Info" },
};

interface DesignPanelProps {
  designs: [Design, Design] | null;
  selected: "A" | "B";
  onSelect: (id: "A" | "B") => void;
  /** True while the designs are catching up with a change (e.g. during a drag). */
  stale: boolean;
}

export default function DesignPanel({ designs, selected, onSelect, stale }: DesignPanelProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Concept designs
          {stale && <span className="text-muted-foreground text-xs font-normal">updating…</span>}
        </CardTitle>
        <CardDescription>
          Two ways to build on this plot, each checked rule by rule. The selected one is drawn on
          the map.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!designs ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <Tabs value={selected} onValueChange={(v) => onSelect(v as "A" | "B")}>
            <TabsList className="w-full">
              {designs.map((d) => (
                <TabsTrigger key={d.id} value={d.id} className="flex-1 gap-1.5">
                  {d.id === "A" ? "A · Tower" : "B · Mid-rise"}
                  <ScoreBadge design={d} />
                </TabsTrigger>
              ))}
            </TabsList>
            {designs.map((d) => (
              <TabsContent key={d.id} value={d.id} className="mt-3">
                <DesignBody design={d} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreBadge({ design }: { design: Design }) {
  const failed = design.checklist.filter((c) => c.status === "fail").length;
  return (
    <span
      className={cn(
        "rounded px-1 text-[10px] font-semibold tabular-nums",
        failed ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700",
      )}
    >
      {failed ? `${failed} ✗` : "✓"}
    </span>
  );
}

function DesignBody({ design: d }: { design: Design }) {
  const t = d.totals;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-medium">{d.name}</h3>
        <p className="text-muted-foreground text-xs leading-relaxed">{d.summary}</p>
      </div>

      {d.feasible && (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Stat
              label="Total floor area"
              value={`${fmt(t.gfaM2)} m²`}
              sub={`FAR ${fmt(t.far, 2)}`}
            />
            <Stat
              label="Height"
              value={`${fmt(t.roofM, 1)} m`}
              sub={`${t.storeys} storeys, roof slab`}
            />
            {t.units && (
              <Stat
                label="Units"
                value={fmt(t.units.total)}
                sub={`${fmt(t.units.oneBed)} × 1-bed, ${fmt(t.units.twoBed)} × 2-bed`}
              />
            )}
            {t.units && (
              <Stat
                label="Sellable area"
                value={`${fmt(t.units.sellableM2)} m²`}
                sub="75% of residential"
              />
            )}
            {t.rooms !== undefined && (
              <Stat label="Hotel rooms" value={fmt(t.rooms)} sub="50 m² per room" />
            )}
            <Stat
              label="Parking"
              value={`${fmt(t.parkingProvided)} spaces`}
              sub={`${fmt(t.parkingRequired)} required`}
            />
            <Stat
              label="Footprint"
              value={`${fmt(t.footprintM2)} m²`}
              sub={`open space ${fmt(t.openSpaceM2)} m²`}
            />
          </dl>

          <FloorTable design={d} />
        </>
      )}

      <section className="flex flex-col gap-2">
        <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Checklist
        </h4>
        <ul className="flex flex-col gap-1.5">
          {d.checklist.map((c) => (
            <CheckItem key={c.id} row={c} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function FloorTable({ design }: { design: Design }) {
  const rows = [...design.floorTable].reverse(); // top floor first, like a section
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Floors</h4>
      <table className="w-full text-xs tabular-nums">
        <thead className="text-muted-foreground">
          <tr className="border-b text-left">
            <th className="py-1 font-normal">Floors</th>
            <th className="py-1 font-normal">Use</th>
            <th className="py-1 text-right font-normal">Each</th>
            <th className="py-1 text-right font-normal">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-dashed">
              <td className="py-1">
                {r.label}
                <span className="text-muted-foreground block text-[10px]">
                  {fmt(r.fromM, 1)}–{fmt(r.toM, 1)} m
                </span>
              </td>
              <td className="py-1">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm" style={{ background: USE_COLOURS[r.use] }} />
                  {USE_LABEL[r.use]}
                </span>
              </td>
              <td className="py-1 text-right">
                {r.floors} × {fmt(r.areaPerFloorM2)}
              </td>
              <td className="py-1 text-right">{fmt(r.totalM2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-medium">
            <td className="py-1" colSpan={3}>
              Total floor area (m²)
            </td>
            <td className="py-1 text-right">{fmt(design.totals.gfaM2)}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}

function CheckItem({ row }: { row: CheckRow }) {
  const st = STATUS[row.status];
  return (
    <li className="rounded-md border px-2 py-1.5">
      <details>
        <summary className="flex cursor-pointer list-none items-start gap-2 [&::-webkit-details-marker]:hidden">
          <span
            className={cn("w-3 shrink-0 text-center font-bold", st.className)}
            aria-label={st.label}
          >
            {st.icon}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm">{row.label}</span>
            <span className="text-muted-foreground text-xs tabular-nums">{row.value}</span>
          </span>
          {row.status === "fail" && <Badge variant="destructive">Fail</Badge>}
          {row.status === "flag" && <Badge variant="secondary">Flag</Badge>}
        </summary>
        <div className="mt-1.5 flex flex-col gap-1 pl-5">
          <p className="text-muted-foreground text-xs leading-relaxed">{row.detail}</p>
          <p className="text-xs">
            {row.cite.map((c, i) => {
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

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
      {sub && <dd className="text-muted-foreground text-[11px]">{sub}</dd>}
    </div>
  );
}
