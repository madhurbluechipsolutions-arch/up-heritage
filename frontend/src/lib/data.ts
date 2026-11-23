import { useEffect, useState } from "react";
import type { CityBundle, CityInfo, CityListItem, Facility, NearbyItem, Poi } from "./types";

async function getJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(url);
    if (!r.ok) return fallback;
    return (await r.json()) as T;
  } catch {
    return fallback;
  }
}

const bundles = new Map<string, Promise<CityBundle>>();

export function loadCity(city: string): Promise<CityBundle> {
  if (!bundles.has(city)) {
    bundles.set(
      city,
      (async () => {
        const [info, pois, nearby, geo] = await Promise.all([
          getJson<CityInfo>(`/data/${city}/city.json`, { id: city, name: { en: city }, center: [27.1751, 78.0421] }),
          getJson<Poi[]>(`/data/${city}/pois.json`, []),
          getJson<NearbyItem[]>(`/data/${city}/nearby.json`, []),
          getJson<{ features?: { geometry: { coordinates: [number, number] }; properties: Record<string, unknown> }[] }>(
            `/data/${city}/facilities.geojson`,
            { features: [] },
          ),
        ]);
        const facilities: Facility[] = (geo.features ?? []).map((f, i) => ({
          id: String(f.properties.id ?? i),
          type: String(f.properties.type ?? "other"),
          name: String(f.properties.name ?? ""),
          lng: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
          timings: f.properties.timings as string | undefined,
          phone: f.properties.phone as string | undefined,
          synthetic: Boolean(f.properties.synthetic),
          source: f.properties.source as string | undefined,
        }));
        const sorted = [...pois].sort((a, b) => (a.tourOrder ?? 99) - (b.tourOrder ?? 99));
        return { info, pois: sorted, nearby, facilities };
      })(),
    );
  }
  return bundles.get(city)!;
}

export function useCity(city: string): CityBundle | null {
  const [data, setData] = useState<CityBundle | null>(null);
  useEffect(() => {
    let alive = true;
    setData(null);
    loadCity(city).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [city]);
  return data;
}

export function useCities(): CityListItem[] {
  const [list, setList] = useState<CityListItem[]>([]);
  useEffect(() => {
    getJson<CityListItem[]>("/data/cities.json", [{ id: "agra", name: { en: "Agra", hi: "आगरा" }, depth: "full" }]).then(setList);
  }, []);
  return list;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
