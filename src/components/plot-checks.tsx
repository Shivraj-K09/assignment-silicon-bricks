import { AnimatePresence, motion } from "motion/react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import type { PlotCheck } from "@/lib/plot-checks";

/**
 * The plot's checks, pinned to the plot on the map so the message sits where the
 * problem is. All clear: a small "Plot clear" tag, with how many existing buildings
 * the project would replace. Problems: a short card with a
 * title and a one-line fix for each, gone once the outline is fixed.
 */
export default function PlotPin({
  checks,
  demolished,
}: {
  checks: PlotCheck[] | null;
  /** Existing buildings standing on the plot, which the project would replace. */
  demolished: number;
}) {
  if (!checks) return null;
  const problems = checks.filter((check) => !check.ok);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {problems.length === 0 ? (
        <motion.div
          key="clear"
          {...POP}
          role="status"
          className="flex h-6 items-center gap-1 rounded-md bg-white/95 px-2 text-xs font-medium text-neutral-700 shadow-sm ring-1 shadow-black/10 ring-black/10 backdrop-blur"
        >
          <CircleCheck aria-hidden className="size-3.5 text-emerald-600" />
          Plot clear
          {demolished > 0 && (
            <>
              <span aria-hidden className="mx-0.5 h-3 border-l border-dashed border-neutral-300" />
              <span className="font-normal text-neutral-500">
                {demolished} building{demolished === 1 ? "" : "s"} to demolish
              </span>
            </>
          )}
        </motion.div>
      ) : (
        <motion.div
          key="problems"
          {...POP}
          role="alert"
          className="relative w-64 rounded-xl bg-red-50/95 p-1 shadow-lg ring-1 shadow-black/10 ring-red-600/15 backdrop-blur"
        >
          {/* A small notch pointing up at the plot corner. */}
          <span
            aria-hidden
            className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rotate-45 bg-red-50 ring-1 ring-red-600/15 [clip-path:polygon(0_0,100%_0,0_100%)]"
          />
          <ul className="relative divide-y divide-dashed divide-red-100 rounded-lg border border-red-100 bg-white">
            {problems.map((check) => (
              <ProblemItem key={check.id} check={check} />
            ))}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Pops in from the plot corner it hangs from. */
const POP = {
  initial: { opacity: 0, y: -4, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.96 },
  transition: { type: "tween", duration: 0.18, ease: [0.22, 1, 0.36, 1] },
} as const;

function ProblemItem({ check }: { check: PlotCheck }) {
  return (
    <li className="flex gap-2 px-2.5 py-2">
      <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0 text-red-600" />
      <div className="flex min-w-0 flex-col">
        <span className="text-xs font-medium text-red-700">{check.label}</span>
        {check.fix && <span className="text-xs text-neutral-500">{check.fix}</span>}
      </div>
    </li>
  );
}
