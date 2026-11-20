import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The frosted white bar shared by the top bar, the dock and the map tools.
 *
 * Layout on the map, one grid for everything floating on it:
 * - top row, 16 px down: the title bar, centred;
 * - content row, 68 px down (just under the title bar): the answer card on the
 *   left and the map tools on the right, both 16 px from the edge; the details
 *   drawer opens on the same line, 12 px inside the tools;
 * - bottom: the dock, centred.
 */
export const FLOATING_BAR =
  "pointer-events-auto flex max-w-full items-center gap-1 rounded-xl bg-white/90 p-1 text-neutral-900 shadow-lg ring-1 shadow-black/10 ring-black/5 backdrop-blur-xl";

/** A light dashed separator between groups in a floating bar. */
export function Seam({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("mx-0.5 h-5 shrink-0 border-l border-dashed border-neutral-200", className)}
    />
  );
}

/** Centres a floating bar along the top or bottom edge of the map. */
export function FloatingBarSlot({
  edge,
  children,
}: {
  edge: "top" | "bottom";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 z-10 flex justify-center px-3",
        edge === "top" ? "top-4" : "bottom-6",
      )}
    >
      {children}
    </div>
  );
}
