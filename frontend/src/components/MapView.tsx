import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre 6 loads its worker from a separate file; let Vite bundle it and tell MapLibre where it is.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

maplibregl.setWorkerUrl(workerUrl);
import { MAP_STYLE } from "../lib/api";
import type { LatLng } from "../lib/geo";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  active?: boolean;
  title?: string;
}

interface Props {
  center: [number, number]; // [lat, lng]
  zoom?: number;
  markers: MapMarker[];
  route?: LatLng[];
  user?: LatLng | null;
  onMarkerClick?: (id: string) => void;
  fit?: boolean;
  className?: string;
}

export default function MapView({ center, zoom = 16, markers, route, user, onMarkerClick, fit, className }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const pins = useRef<maplibregl.Marker[]>([]);
  const me = useRef<maplibregl.Marker | null>(null);
  const clickRef = useRef(onMarkerClick);
  clickRef.current = onMarkerClick;

  useEffect(() => {
    if (!box.current) return;
    const m = new maplibregl.Map({
      container: box.current,
      style: MAP_STYLE,
      center: [center[1], center[0]],
      zoom,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // markers
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    pins.current.forEach((p) => p.remove());
    pins.current = markers.map((mk) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "map-pin" + (mk.active ? " map-pin--active" : "");
      el.style.background = mk.color ?? "var(--color-brand)";
      el.textContent = mk.label ?? "";
      el.title = mk.title ?? "";
      el.setAttribute("aria-label", mk.title ?? mk.label ?? "marker");
      el.onclick = (e) => {
        e.stopPropagation();
        clickRef.current?.(mk.id);
      };
      return new maplibregl.Marker({ element: el }).setLngLat([mk.lng, mk.lat]).addTo(m);
    });
    if (fit && markers.length > 1) {
      const b = new maplibregl.LngLatBounds();
      markers.forEach((mk) => b.extend([mk.lng, mk.lat]));
      if (user) b.extend([user.lng, user.lat]);
      m.fitBounds(b, { padding: 48, maxZoom: 17, duration: 0 });
    }
  }, [markers, fit, user]);

  // route line
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const draw = () => {
      const data = {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates: (route ?? []).map((p) => [p.lng, p.lat]) },
      };
      const src = m.getSource("route") as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(data);
      else {
        m.addSource("route", { type: "geojson", data });
        m.addLayer({
          id: "route",
          type: "line",
          source: "route",
          paint: { "line-color": "#7a2e1c", "line-width": 3, "line-dasharray": [2, 1.5] },
        });
      }
    };
    if (m.isStyleLoaded()) draw();
    else m.once("load", draw);
  }, [route]);

  // user position
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!user) {
      me.current?.remove();
      me.current = null;
      return;
    }
    if (!me.current) {
      const el = document.createElement("div");
      el.className = "map-me";
      me.current = new maplibregl.Marker({ element: el }).setLngLat([user.lng, user.lat]).addTo(m);
    } else me.current.setLngLat([user.lng, user.lat]);
  }, [user]);

  return <div ref={box} className={className ?? "h-64 w-full"} />;
}
