import { useEffect, useState } from "react";
import type { SiteData } from "@/lib/site";

async function loadJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/** Loads the static site data once. Nothing is fetched from live APIs. */
export function useSiteData() {
  const [data, setData] = useState<SiteData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadJson<SiteData["zoning"]>("/data/bkk-zoning.geojson"),
      loadJson<SiteData["buildings"]>("/data/thonglo-buildings.geojson"),
      loadJson<SiteData["roads"]>("/data/thonglo-roads.geojson"),
      loadJson<SiteData["plannedRoads"]>("/data/bkk-planned-roads.geojson"),
      loadJson<SiteData["stations"]>("/data/rail-stations.geojson"),
    ])
      .then(([zoning, buildings, roads, plannedRoads, stations]) => {
        // Stable numeric ids, so the map can mark buildings with feature-state.
        buildings.features.forEach((f, i) => (f.id = i));
        if (!cancelled) setData({ zoning, buildings, roads, plannedRoads, stations });
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, error };
}
