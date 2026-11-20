import { useEffect, useRef, useState } from "react";

/**
 * The value, updated at most once every `intervalMs`. A change after a quiet
 * spell passes straight through (so a click feels instant); during a burst, like
 * dragging a corner, it updates on a steady beat; and the last value always lands.
 */
export function useThrottledValue<T>(value: T, intervalMs: number): T {
  const [throttled, setThrottled] = useState(value);
  const lastRunRef = useRef(0);

  useEffect(() => {
    const wait = lastRunRef.current + intervalMs - Date.now();
    const apply = () => {
      lastRunRef.current = Date.now();
      setThrottled(value);
    };
    if (wait <= 0) {
      apply();
      return;
    }
    const timer = window.setTimeout(apply, wait);
    return () => window.clearTimeout(timer);
  }, [value, intervalMs]);

  return throttled;
}
