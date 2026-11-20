import { useEffect, useState } from "react";

/**
 * The value, but only once it has stopped changing for `delayMs`. While a corner
 * is being dragged the value changes on every step; this holds the last settled
 * one, so heavy work keyed on it runs once when the drag pauses, not on every step.
 */
export function useSettledValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}
