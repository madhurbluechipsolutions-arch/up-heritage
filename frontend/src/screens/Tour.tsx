import { useEffect, useMemo, useRef, useState } from "react";
import { Accessibility, Footprints, LocateFixed, Pause, Play, SkipBack, SkipForward, Square } from "lucide-react";
import MapView from "../components/MapView";
import { Chip } from "../components/ui";
import { distance, walkMinutes, type LatLng } from "../lib/geo";
import { t, tr } from "../lib/i18n";
import { useSettings } from "../lib/settings";
import { onSpeakingChange, playAudio, stopSpeaking } from "../lib/speech";
import type { CityBundle, Poi } from "../lib/types";

const TIME_OPTIONS = [30, 60, 120, 240];
const ARRIVE_METRES = 25;

const hasSteps = (p: Poi) => /\b(steps|stairs|staircase|climb)\b|सीढ़ि/i.test(`${p.accessibility?.en ?? ""} ${p.accessibility?.hi ?? ""}`);

/** Pick the most important stops that fit the time, then walk them in their natural order. */
export function planRoute(pois: Poi[], minutes: number, accessible: boolean): Poi[] {
  const pool = pois.filter((p) => (p.tourMinutes ?? 0) > 0 && !(accessible && hasSteps(p) && (p.priority ?? 2) > 1));
  const byImportance = [...pool].sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2) || (a.tourOrder ?? 99) - (b.tourOrder ?? 99));
  const chosen: Poi[] = [];
  const cost = (list: Poi[]) => {
    const ordered = [...list].sort((a, b) => (a.tourOrder ?? 99) - (b.tourOrder ?? 99));
    let total = 0;
    ordered.forEach((p, i) => {
      total += p.tourMinutes ?? 5;
      if (i > 0) total += walkMinutes(distance(ordered[i - 1], p));
    });
    return total;
  };
  for (const p of byImportance) if (cost([...chosen, p]) <= minutes) chosen.push(p);
  return chosen.sort((a, b) => (a.tourOrder ?? 99) - (b.tourOrder ?? 99));
}

export default function TourScreen({ bundle, onOpenPoi, gpsPos }: { bundle: CityBundle; onOpenPoi: (id: string) => void; gpsPos: LatLng | null }) {
  const { city, lang } = useSettings();
  const L = lang === "hi" ? "hi" : "en";
  const [minutes, setMinutes] = useState(60);
  const [accessible, setAccessible] = useState(false);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [useGps, setUseGps] = useState(false);
  const [simPos, setSimPos] = useState<LatLng | null>(null);
  const played = useRef(new Set<string>());
  const waitingAtStop = useRef(false);

  const route = useMemo(() => planRoute(bundle.pois, minutes, accessible), [bundle.pois, minutes, accessible]);
  const totalMin = useMemo(
    () => route.reduce((s, p, i) => s + (p.tourMinutes ?? 5) + (i ? walkMinutes(distance(route[i - 1], p)) : 0), 0),
    [route],
  );
  const stop = route[current];
  const pos = simulating ? simPos : useGps ? gpsPos : null;

  useEffect(() => onSpeakingChange(setPlaying), []);
  useEffect(() => {
    setCurrent(0);
    played.current.clear();
  }, [route]);
  useEffect(() => () => stopSpeaking(), []);

  function playStop(p: Poi, onEnd?: () => void) {
    const text = [tr(p.summary, L), ...(p.history ?? []).slice(0, 2).map((h) => tr(h, L))].join(" ");
    playAudio(`/data/${city}/audio/${p.id}_${L}.mp3`, text, L, onEnd);
  }

  // Geofence: arriving near the next unplayed stop starts its story automatically.
  useEffect(() => {
    if (!pos) return;
    route.forEach((p, i) => {
      if (!played.current.has(p.id) && distance(pos, p) < ARRIVE_METRES) {
        played.current.add(p.id);
        setCurrent(i);
        if (simulating) waitingAtStop.current = true;
        playStop(p, () => (waitingAtStop.current = false));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  // Walk simulation for demos away from the site: moves along the route, pausing at each stop.
  useEffect(() => {
    if (!simulating || route.length === 0) return;
    let seg = 0;
    let p: LatLng = { lat: route[0].lat - 0.0004, lng: route[0].lng };
    played.current.clear();
    waitingAtStop.current = false;
    setSimPos(p);
    const id = setInterval(() => {
      if (waitingAtStop.current) return;
      const target = route[seg];
      if (!target) {
        setSimulating(false);
        return;
      }
      const d = distance(p, target);
      if (d < 3) {
        seg += 1;
        return;
      }
      const step = Math.min(1, 12 / d);
      p = { lat: p.lat + (target.lat - p.lat) * step, lng: p.lng + (target.lng - p.lng) * step };
      setSimPos(p);
    }, 200);
    return () => clearInterval(id);
  }, [simulating, route]);

  function go(i: number) {
    const n = Math.max(0, Math.min(route.length - 1, i));
    setCurrent(n);
    waitingAtStop.current = false;
    stopSpeaking();
  }

  const markers = useMemo(
    () => route.map((p, i) => ({ id: p.id, lat: p.lat, lng: p.lng, label: String(i + 1), active: i === current, title: tr(p.name, L) })),
    [route, current, L],
  );
  const line = useMemo(() => route.map((p) => ({ lat: p.lat, lng: p.lng })), [route]);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="space-y-3 px-4 pt-4">
        <h2 className="font-serif text-xl font-bold">{t("tourTitle", lang)}</h2>
        <p className="label">{t("howMuchTime", lang)}</p>
        <div className="flex flex-wrap gap-2">
          {TIME_OPTIONS.map((m) => (
            <Chip key={m} active={minutes === m} onClick={() => setMinutes(m)}>
              {m < 60 ? `${m} ${t("min", lang)}` : m === 240 ? (lang === "hi" ? "आधा दिन" : "Half day") : `${m / 60} ${lang === "hi" ? "घंटा" : m === 60 ? "hour" : "hours"}`}
            </Chip>
          ))}
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={accessible} onChange={(e) => setAccessible(e.target.checked)} className="size-5 accent-brand" />
          <Accessibility size={18} /> {t("accessibleRoute", lang)}
        </label>
        <p className="text-muted">
          {route.length} {t("stops", lang)} · ~{totalMin} {t("min", lang)}
        </p>
      </div>

      <MapView center={bundle.info.center} zoom={bundle.info.zoom ?? 16} markers={markers} route={line} user={pos} onMarkerClick={(id) => go(route.findIndex((p) => p.id === id))} fit className="mt-3 h-64 w-full shrink-0" />

      <div className="flex gap-2 px-4 pt-3">
        <button className={simulating ? "btn-secondary flex-1" : "btn-primary flex-1"} onClick={() => { setUseGps(false); setSimulating((s) => !s); }}>
          {simulating ? <Square size={18} /> : <Footprints size={18} />} {simulating ? t("stopSim", lang) : t("simulate", lang)}
        </button>
        <button className={"btn-secondary flex-1" + (useGps ? " ring-2 ring-brand" : "")} onClick={() => { setSimulating(false); setUseGps((g) => !g); }}>
          <LocateFixed size={18} /> {t("useGps", lang)}
        </button>
      </div>

      {stop && (
        <div className="m-4 border-l-4 border-brand bg-card p-4">
          <p className="label">
            {current + 1} / {route.length} · {stop.tourMinutes} {t("min", lang)}
          </p>
          <button className="mt-1 text-left font-serif text-xl font-bold hover:underline" onClick={() => onOpenPoi(stop.id)}>
            {tr(stop.name, L)}
          </button>
          <p className="mt-2 leading-relaxed">{tr(stop.summary, L)}</p>
          {stop.accessibility && (
            <p className="mt-2 flex gap-2 text-sm text-muted">
              <Accessibility size={16} className="shrink-0" /> {tr(stop.accessibility, L)}
            </p>
          )}
          <p className="mt-2 text-sm text-muted">{t("arrivedAuto", lang)}</p>
          <div className="mt-3 flex items-center gap-2">
            <button className="btn-icon-lg bg-paper" onClick={() => go(current - 1)} disabled={current === 0} aria-label={t("prev", lang)}>
              <SkipBack size={20} />
            </button>
            <button className="btn-primary flex-1" onClick={() => (playing ? stopSpeaking() : playStop(stop))}>
              {playing ? <Pause size={18} /> : <Play size={18} />} {playing ? t("pause", lang) : t("play", lang)}
            </button>
            <button className="btn-icon-lg bg-paper" onClick={() => go(current + 1)} disabled={current >= route.length - 1} aria-label={t("next", lang)}>
              <SkipForward size={20} />
            </button>
          </div>
        </div>
      )}

      <ol className="space-y-1 px-4 pb-6">
        {route.map((p, i) => (
          <li key={p.id}>
            <button className={"flex w-full items-center gap-3 border border-line px-3 py-2 text-left " + (i === current ? "bg-card" : "bg-paper")} onClick={() => go(i)}>
              <span className="grid size-7 shrink-0 place-items-center bg-brand text-sm font-bold text-paper">{i + 1}</span>
              <span className="flex-1">{tr(p.name, L)}</span>
              <span className="text-sm text-muted">{p.tourMinutes}′</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
