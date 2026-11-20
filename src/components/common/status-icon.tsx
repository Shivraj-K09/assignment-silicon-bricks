import { CircleAlert, CircleCheck, CircleX, Flag, Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Every pass / fail / warning state in the app, mapped to one icon and colour. */
export type Tone = "pass" | "fail" | "flag" | "limit" | "info";

const TONES: Record<Tone, { Icon: LucideIcon; className: string; label: string }> = {
  pass: { Icon: CircleCheck, className: "text-success", label: "Pass" },
  fail: { Icon: CircleX, className: "text-destructive", label: "Fail" },
  flag: { Icon: Flag, className: "text-warning", label: "Flag" },
  limit: { Icon: CircleAlert, className: "text-warning", label: "Limits the building" },
  info: { Icon: Info, className: "text-muted-foreground", label: "Applies" },
};

export default function StatusIcon({ tone, className }: { tone: Tone; className?: string }) {
  const { Icon, className: colour, label } = TONES[tone];
  return <Icon className={cn("size-4 shrink-0", colour, className)} aria-label={label} />;
}
