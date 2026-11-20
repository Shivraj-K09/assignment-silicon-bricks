import { AnimatePresence, motion } from "motion/react";
import { MousePointerClick } from "lucide-react";

/** A short how-to under the top bar, shown only while a new plot is being drawn. */
export default function DrawingHint({ drawing }: { drawing: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[4.25rem] z-10 flex justify-center px-3">
      <AnimatePresence>
        {drawing && (
          <motion.p
            key="hint"
            role="status"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: "tween", duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-2 rounded-xl bg-neutral-900/90 px-3 py-2 text-xs text-white shadow-lg shadow-black/20 backdrop-blur-xl"
          >
            <MousePointerClick aria-hidden className="size-3.5 text-brand-300" />
            Click the map to place corners. Click the first corner again to finish.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
