import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

// The rules table: FAR, open space, setbacks, height and so on, each with its legal source.
//
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
      <details className="group">
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
          <span className="text-muted-foreground flex items-center gap-0.5 text-xs">
            Why
            <ChevronDown
              className="size-3.5 transition-transform group-open:rotate-180"
              aria-hidden
            />
          </span>
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
