import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";

// Worker file is copied into public/ by scripts/setup-map-worker.mjs
// (Vite's ?url import fails because the project path contains "#").
maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

export default function MapView() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current!,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [100.5835, 13.738],
      zoom: 16,
    });
    return () => map.remove();
  }, []);

  // MapLibre CSS forces position:relative on the map element, so size it
  // through an absolutely positioned wrapper.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" />
    </div>
  );
}
