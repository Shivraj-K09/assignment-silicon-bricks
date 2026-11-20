import { useSyncExternalStore } from "react";

/** True while the CSS media query matches; follows the window as it resizes. */
export function useMediaQuery(query: string): boolean {
  const subscribe = (onChange: () => void) => {
    const list = window.matchMedia(query);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  };
  const getSnapshot = () => window.matchMedia(query).matches;
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Tailwind's `sm` breakpoint: phones are below it. */
export const SM_UP = "(min-width: 640px)";
