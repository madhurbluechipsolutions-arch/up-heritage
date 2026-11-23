import { useEffect, useMemo, useRef, useState } from "react";
import { Accessibility, ArrowUpRight, Check, Footprints, Headphones, LocateFixed, Pause, Play, SkipBack, SkipForward, Square } from "lucide-react";
import MapView from "../components/MapView";
import { Img, Segmented } from "../components/ui";
import { photoOf } from "../lib/data";
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

  const timeLabel = (m: number) =>
    m < 60 ? `${m} ${t("min", lang)}` : m === 240 ? (lang === "hi" ? "आधा दिन" : "Half day") : `${m / 60} ${lang === "hi" ? "घंटा" : "h"}`;
  const stopPhoto = stop ? photoOf(bundle, stop.id) : undefined;

  return (
    <div className="no-scrollbar h-full overflow-y-auto pb-nav">
      <div className="space-y-3 px-4 pt-4">
        <p className="eyebrow">{t("howMuchTime", lang)}</p>
        <Segmented value={minutes} onChange={setMinutes} options={TIME_OPTIONS.map((m) => ({ value: m, label: timeLabel(m) }))} />
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
          <Accessibility size={18} className="shrink-0 text-brand" />
          <span className="flex-1 text-sm font-semibold leading-tight">{t("accessibleRoute", lang)}</span>
          <span className="switch">
            <input type="checkbox" className="sr-only" checked={accessible} onChange={(e) => setAccessible(e.target.checked)} />
          </span>
        </label>
      </div>

      <div className="relative mx-4 mt-4 overflow-hidden rounded-[1.75rem] border border-line shadow-card">
        <MapView center={bundle.info.center} zoom={bundle.info.zoom ?? 16} markers={markers} route={line} user={pos} onMarkerClick={(id) => go(route.findIndex((p) => p.id === id))} fit className="h-64 w-full" />
        <span className="glass-surface absolute left-3 top-3 z-10 rounded-full px-3 py-1.5 text-xs font-semibold text-ink shadow-card">
          {route.length} {t("stops", lang)} · ~{totalMin} {t("min", lang)}
        </span>
        <div className="absolute bottom-3 left-3 z-10 flex gap-2">
          <button
            className={"btn btn-sm shadow-card " + (simulating ? "btn-ink" : "glass-surface text-ink")}
            onClick={() => {
              setUseGps(false);
              setSimulating((s) => !s);
            }}
          >
            {simulating ? <Square size={14} fill="currentColor" /> : <Footprints size={16} />} {simulating ? t("stopSim", lang) : t("simulate", lang)}
          </button>
          <button
            className={"btn btn-sm shadow-card " + (useGps ? "btn-ink" : "glass-surface text-ink")}
            onClick={() => {
              setSimulating(false);
              setUseGps((g) => !g);
            }}
          >
            <LocateFixed size={16} /> {t("useGps", lang)}
          </button>
        </div>
      </div>

      {stop && (
        <div key={stop.id} className="relative mx-4 mt-4 overflow-hidden rounded-[1.75rem] text-white shadow-card animate-rise">
          <Img photo={stopPhoto} alt={tr(stop.name, "en")} className="absolute inset-0" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/20" />
          <div className="relative p-5 pt-16">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-white/75">
              <span className={"size-2 rounded-full " + (playing ? "animate-pulse bg-[#5ee38a]" : "bg-white/60")} />
              {t("nowPlaying", lang)} {current + 1} / {route.length} · {stop.tourMinutes} {t("min", lang)}
            </p>
            <button className="mt-1.5 flex items-start gap-2 text-left font-display text-[1.65rem] font-semibold leading-tight" onClick={() => onOpenPoi(stop.id)}>
              {tr(stop.name, L)} <ArrowUpRight size={20} className="mt-1.5 shrink-0 opacity-70" />
            </button>
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/85">{tr(stop.summary, L)}</p>
            {stop.accessibility && (
              <p className="mt-2 flex gap-2 text-xs text-white/70">
                <Accessibility size={14} className="shrink-0" /> <span className="line-clamp-2">{tr(stop.accessibility, L)}</span>
              </p>
            )}
            <div className="mt-5 flex items-center justify-center gap-5">
              <button className="glass btn-icon size-12" onClick={() => go(current - 1)} disabled={current === 0} aria-label={t("prev", lang)}>
                <SkipBack size={20} fill="currentColor" />
              </button>
              <button
                className="grid size-16 place-items-center rounded-full bg-white text-black shadow-float transition active:scale-95"
                onClick={() => (playing ? stopSpeaking() : playStop(stop))}
                aria-label={playing ? t("pause", lang) : t("play", lang)}
              >
                {playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" className="ml-1" />}
              </button>
              <button className="glass btn-icon size-12" onClick={() => go(current + 1)} disabled={current >= route.length - 1} aria-label={t("next", lang)}>
                <SkipForward size={20} fill="currentColor" />
              </button>
            </div>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-white/60">
              <Headphones size={13} /> {t("arrivedAuto", lang)}
            </p>
          </div>
        </div>
      )}

      <section className="px-4 pt-7">
        <p className="eyebrow mb-3">{t("yourRoute", lang)}</p>
        <ol>
          {route.map((p, i) => {
            const on = i === current;
            const done = played.current.has(p.id) && !on;
            return (
              <li key={p.id} className="relative pb-2 last:pb-0">
                {i < route.length - 1 && <span className="absolute left-[1.35rem] top-11 h-[calc(100%-2rem)] w-0.5 bg-line" aria-hidden />}
                <button
                  className={"flex w-full items-center gap-3 rounded-2xl p-1.5 pr-3 text-left transition " + (on ? "bg-surface shadow-card" : "hover:bg-surface/60")}
                  onClick={() => go(i)}
                  aria-current={on ? "step" : undefined}
                >
                  <span className={"relative z-10 ml-1 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold " + (on ? "bg-brand text-on-brand" : done ? "bg-ok text-white" : "border-2 border-line bg-paper text-muted")}>
                    {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                  </span>
                  <Img photo={photoOf(bundle, p.id)} className="size-14 shrink-0 rounded-xl" />
                  <span className={"min-w-0 flex-1 line-clamp-2 leading-snug " + (on ? "font-bold" : "font-semibold")}>{tr(p.name, L)}</span>
                  <span className="shrink-0 rounded-full bg-sunk px-2 py-0.5 text-xs font-semibold text-muted">{p.tourMinutes}′</span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
