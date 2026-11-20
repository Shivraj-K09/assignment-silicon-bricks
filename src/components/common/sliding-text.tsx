import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

/** Text changes: a short ease-out tween, so the change starts at once and lands softly. */
const TEXT_TWEEN = { type: "tween", duration: 0.28, ease: [0.22, 1, 0.36, 1] } as const;

/** Text slides in from the side it moves towards: below when growing, above when shrinking. */
const SLIDE = {
  enter: (direction: number) => ({ y: direction * 10, opacity: 0 }),
  centre: { y: 0, opacity: 1 },
  leave: (direction: number) => ({ y: direction * -10, opacity: 0 }),
};

/** +1 when the value went up since the last render, -1 when it went down. */
export function useChangeDirection(value: number): number {
  const [state, setState] = useState({ value, direction: 1 });
  if (state.value !== value) {
    setState({ value, direction: value > state.value ? 1 : -1 });
  }
  return value === state.value ? state.direction : value > state.value ? 1 : -1;
}

/**
 * A number whose digits roll one by one. Each digit is keyed by its place
 * (units, tens), so 41 to 42 moves only the units while the 4 stays still.
 */
export function RollingNumber({
  value,
  direction,
  format = String,
}: {
  value: number;
  direction: number;
  /** How to print the number, e.g. with thousands separators. Defaults to plain digits. */
  format?: (n: number) => string;
}) {
  const digits = format(value).split("");
  return (
    <span className="inline-flex">
      {digits.map((digit, index) => (
        <SlidingText key={`place-${digits.length - index}`} value={digit} direction={direction} />
      ))}
    </span>
  );
}

/**
 * Text that slides when it changes: the old value leaves one way while the new one
 * arrives from the other. `popLayout` takes the leaving text out of the flow, so the
 * two never push each other around.
 */
export function SlidingText({ value, direction }: { value: string; direction: number }) {
  return (
    <span className="relative inline-flex overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout" custom={direction}>
        <motion.span
          key={value}
          custom={direction}
          variants={SLIDE}
          initial="enter"
          animate="centre"
          exit="leave"
          transition={TEXT_TWEEN}
          className="inline-block tabular-nums"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
