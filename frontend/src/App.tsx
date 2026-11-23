import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Camera, Check, CloudDownload, CloudOff, House, LifeBuoy, MessageCircle, Monitor, Moon, Route, Settings2, Sun } from "lucide-react";
import PoiSheet from "./components/PoiSheet";
import { Segmented, Sheet } from "./components/ui";
import { downloadPack, isPackDownloaded } from "./lib/api";
import { useCity, useOnline } from "./lib/data";
import type { LatLng } from "./lib/geo";
import { t, tr } from "./lib/i18n";
import { setSettings, useSettings, type Accent, type Theme } from "./lib/settings";
import type { Answer, Tab } from "./lib/types";
import AskScreen, { type ChatMsg } from "./screens/Ask";
import ExploreScreen from "./screens/Explore";
import HelpScreen, { facilityKeyFor } from "./screens/Help";
import HomeScreen from "./screens/Home";
import LensScreen from "./screens/Lens";
import Onboarding, { CityPicker, LanguagePicker, ModePicker } from "./screens/Onboarding";
import TourScreen from "./screens/Tour";

const NAV: { id: Tab; icon: typeof MessageCircle; label: "home" | "tour" | "lens" | "ask" | "help" }[] = [
  { id: "home", icon: House, label: "home" },
  { id: "tour", icon: Route, label: "tour" },
  { id: "lens", icon: Camera, label: "lens" },
  { id: "ask", icon: MessageCircle, label: "ask" },
  { id: "help", icon: LifeBuoy, label: "help" },
];

export const ACCENTS: { id: Accent; light: string; dark: string }[] = [
  { id: "sandstone", light: "#b04a23", dark: "#ec8a60" },
  { id: "peacock", light: "#0e7470", dark: "#40c4b6" },
  { id: "saffron", light: "#c05f00", dark: "#f4a640" },
  { id: "neel", light: "#4338ca", dark: "#9b9cf8" },
];

/** Deep link from a signboard QR code: /p/<city>/<poiId> opens that spot directly. */
function readDeepLink(): { city: string; poi: string } | null {
  const m = window.location.pathname.match(/^\/p\/([a-z0-9-]+)\/([a-z0-9-]+)/);
  return m ? { city: m[1], poi: m[2] } : null;
}

/** Keeps <html data-theme/data-accent> in sync with the settings and the OS preference. */
function useTheme(theme: Theme, accent: Accent) {
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const dark = theme === "dark" || (theme === "system" && systemDark);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = dark ? "dark" : "light";
    root.dataset.accent = accent;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", dark ? "#0f0d0b" : "#f6f2ea"));
  }, [dark, accent]);
  return dark;
}

export default function App() {
  const settings = useSettings();
  const { city, lang, largeText, onboarded, theme, accent } = settings;
  const dark = useTheme(theme, accent);
  const bundle = useCity(city);
  const online = useOnline();
  const [tab, setTab] = useState<Tab>("home");
  const [openPoi, setOpenPoi] = useState<string | null>(null);
  const [messages, setMessagesState] = useState<ChatMsg[]>([]);
  const [prefill, setPrefill] = useState<{ question: string; poiId?: string } | null>(null);
  const [facility, setFacility] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pack, setPack] = useState<number | null>(null);
  const [gpsPos, setGpsPos] = useState<LatLng | null>(null);

  const setMessages = useCallback((fn: (m: ChatMsg[]) => ChatMsg[]) => setMessagesState(fn), []);

  useEffect(() => {
    const link = readDeepLink();
    if (link) {
      setSettings({ city: link.city, onboarded: true });
      setOpenPoi(link.poi);
      window.history.replaceState(null, "", "/");
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("large-text", largeText);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ur" ? "rtl" : "ltr";
  }, [largeText, lang]);

  useEffect(() => {
    setMessagesState([]);
    setTab("home");
  }, [city]);

  // Location (if the visitor allows it): used for distances, the photo hint and the tour geofence.
  useEffect(() => {
    if (!onboarded || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setGpsPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setGpsPos(null),
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [onboarded]);

  // Only trust GPS when the visitor is actually near this destination (~5 km).
  const nearSite =
    gpsPos && bundle && Math.abs(gpsPos.lat - bundle.info.center[0]) < 0.05 && Math.abs(gpsPos.lng - bundle.info.center[1]) < 0.05 ? gpsPos : null;

  const onAction = useCallback((action: Answer["action"], fac: string) => {
    if (action === "show_facility") {
      setFacility(facilityKeyFor(fac));
      setTab("help");
    } else if (action === "sos") setTab("help");
    else if (action === "start_tour") setTab("tour");
    else if (action === "open_nearby") setTab("explore");
  }, []);

  if (!onboarded) return <Onboarding />;

  const poi = bundle?.pois.find((p) => p.id === openPoi) ?? null;
  const L = lang === "hi" ? "hi" : "en";
  const packReady = isPackDownloaded(city, lang);
  const titles: Partial<Record<Tab, string>> = {
    ask: t("quickAsk", lang),
    lens: t("quickScan", lang),
    tour: t("tourTitle", lang),
    explore: t("exploreTitle", lang),
    help: t("help", lang),
  };

  return (
    <div className="relative min-h-dvh bg-paper">
      {/* wide screens: the city photo, softly blurred, behind the phone-width app */}
      {bundle?.info.cover && (
        <div className="pointer-events-none fixed inset-0 hidden md:block" aria-hidden>
          <img src={bundle.info.cover.url} alt="" className="size-full scale-110 object-cover opacity-40 blur-3xl" />
        </div>
      )}

      <div className="relative mx-auto flex h-dvh max-w-xl flex-col overflow-hidden bg-paper md:border-x md:border-line md:shadow-float">
        {tab !== "home" && (
          <header className="z-20 flex items-center gap-2 border-b border-line bg-paper/85 px-4 pb-2.5 pt-[calc(env(safe-area-inset-top)+0.7rem)] backdrop-blur-xl">
            {tab === "explore" && (
              <button className="btn-icon -ml-1 bg-sunk" onClick={() => setTab("home")} aria-label={t("back", lang)}>
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <p className="eyebrow truncate">{bundle ? tr(bundle.info.name, L) : "…"}</p>
              <h1 className="truncate font-display text-xl font-semibold leading-tight">{titles[tab]}</h1>
            </div>
            {!online && (
              <span className="flex h-9 items-center gap-1 rounded-full bg-sunk px-3 text-xs font-semibold">
                <CloudOff size={14} /> {t("offline", lang)}
              </span>
            )}
            <button className="btn-icon bg-sunk" onClick={() => setSettingsOpen(true)} aria-label={t("settings", lang)}>
              <Settings2 size={18} />
            </button>
          </header>
        )}

        <main className="relative min-h-0 flex-1">
          {!bundle ? (
            <div className="space-y-4 p-5">
              <div className="skeleton h-[55dvh] rounded-[2rem]" />
              <div className="skeleton h-24 rounded-3xl" />
            </div>
          ) : (
            <>
              {tab === "home" && <HomeScreen bundle={bundle} online={online} onOpenPoi={setOpenPoi} onTab={setTab} onSettings={() => setSettingsOpen(true)} />}
              <div className={tab === "ask" ? "h-full" : "hidden"}>
                <AskScreen bundle={bundle} messages={messages} setMessages={setMessages} prefill={prefill} clearPrefill={() => setPrefill(null)} onAction={onAction} onOpenPoi={setOpenPoi} />
              </div>
              {tab === "lens" && <LensScreen bundle={bundle} userPos={nearSite} onAction={onAction} onOpenPoi={setOpenPoi} />}
              {tab === "tour" && <TourScreen bundle={bundle} onOpenPoi={setOpenPoi} gpsPos={nearSite} />}
              {tab === "explore" && <ExploreScreen bundle={bundle} userPos={nearSite} />}
              {tab === "help" && <HelpScreen bundle={bundle} userPos={nearSite} initialType={facility} />}
            </>
          )}
        </main>

        {/* Floating tab bar */}
        <nav className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]" aria-label="Main">
          <div className="glass-surface pointer-events-auto mx-auto flex h-[4.25rem] max-w-md items-center justify-around rounded-[1.75rem] px-1 shadow-float">
            {NAV.map(({ id, icon: Icon, label }) => {
              const active = tab === id || (id === "home" && tab === "explore");
              if (id === "lens")
                return (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    aria-label={t(label, lang)}
                    aria-current={active ? "page" : undefined}
                    className={"-mt-7 grid size-[3.75rem] place-items-center rounded-full border-4 border-paper bg-brand text-on-brand shadow-[0_10px_24px_-6px_var(--c-brand)] transition active:scale-95 " + (active ? "ring-4 ring-brand/25" : "")}
                  >
                    <Icon size={24} />
                  </button>
                );
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  aria-current={active ? "page" : undefined}
                  className={
                    "relative flex h-full flex-1 flex-col items-center justify-center gap-1 text-[0.68rem] font-semibold transition " +
                    (active ? (id === "help" ? "text-sos" : "text-brand") : id === "help" ? "text-sos/70 hover:text-sos" : "text-muted hover:text-ink")
                  }
                >
                  <Icon size={21} strokeWidth={active ? 2.4 : 2} />
                  {t(label, lang)}
                  <span className={"absolute bottom-1.5 size-1 rounded-full bg-current transition " + (active ? "opacity-100" : "opacity-0")} />
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      <PoiSheet
        poi={poi}
        city={city}
        bundle={bundle}
        onClose={() => setOpenPoi(null)}
        onAsk={(id) => {
          setOpenPoi(null);
          setTab("ask");
          const name = tr(bundle?.pois.find((p) => p.id === id)?.name, L);
          setPrefill({ question: lang === "hi" ? `${name} के बारे में बताइए` : `Tell me about ${name}`, poiId: id });
        }}
      />

      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title={t("settings", lang)}>
        <div className="space-y-7">
          <section className="space-y-2.5">
            <h3 className="eyebrow">{t("appearance", lang)}</h3>
            <Segmented<Theme>
              value={theme}
              onChange={(v) => setSettings({ theme: v })}
              options={[
                { value: "system", label: (<><Monitor size={15} /> {t("theme_system", lang)}</>) },
                { value: "light", label: (<><Sun size={15} /> {t("theme_light", lang)}</>) },
                { value: "dark", label: (<><Moon size={15} /> {t("theme_dark", lang)}</>) },
              ]}
            />
          </section>
          <section className="space-y-2.5">
            <h3 className="eyebrow">{t("accent", lang)}</h3>
            <div className="grid grid-cols-4 gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSettings({ accent: a.id })}
                  aria-pressed={accent === a.id}
                  className={"flex flex-col items-center gap-2 rounded-2xl border py-3 text-xs font-semibold transition " + (accent === a.id ? "border-ink bg-surface" : "border-line hover:bg-surface")}
                >
                  <span className="grid size-9 place-items-center rounded-full text-white shadow-card" style={{ background: dark ? a.dark : a.light }}>
                    {accent === a.id && <Check size={18} strokeWidth={3} />}
                  </span>
                  {t(`accent_${a.id}` as never, lang)}
                </button>
              ))}
            </div>
          </section>
          <section className="space-y-2.5">
            <h3 className="eyebrow">{t("chooseLang", lang)}</h3>
            <LanguagePicker />
          </section>
          <section className="space-y-2.5">
            <h3 className="eyebrow">{t("chooseMode", lang)}</h3>
            <ModePicker />
          </section>
          <section className="card divide-y divide-line px-5">
            <label className="flex items-center justify-between gap-3 py-4">
              <span className="font-semibold">{t("largeText", lang)}</span>
              <span className="switch">
                <input type="checkbox" className="sr-only" checked={largeText} onChange={(e) => setSettings({ largeText: e.target.checked })} />
              </span>
            </label>
            <label className="flex items-center justify-between gap-3 py-4">
              <span className="font-semibold">{t("autoRead", lang)}</span>
              <span className="switch">
                <input type="checkbox" className="sr-only" checked={settings.autoRead} onChange={(e) => setSettings({ autoRead: e.target.checked })} />
              </span>
            </label>
          </section>
          <section className="card overflow-hidden">
            <div className="flex gap-4 p-5">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
                <CloudDownload size={22} />
              </span>
              <div>
                <h3 className="font-semibold">{t("offlinePack", lang)}</h3>
                <p className="text-sm text-muted">{t("offlineHint", lang)}</p>
              </div>
            </div>
            {pack !== null && (
              <div className="mx-5 h-1.5 overflow-hidden rounded-full bg-sunk">
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pack}%` }} />
              </div>
            )}
            <div className="p-4 pt-3">
              <button
                className={"btn w-full " + (packReady && pack === null ? "btn-soft" : "btn-primary")}
                disabled={pack !== null || !online}
                onClick={async () => {
                  setPack(0);
                  await downloadPack(city, lang, setPack);
                  setPack(null);
                }}
              >
                {pack !== null ? `${pack}%` : packReady ? (<><Check size={18} /> {t("downloaded", lang)}</>) : (<><CloudDownload size={18} /> {t("download", lang)}</>)}
              </button>
            </div>
          </section>
          <section className="space-y-2.5">
            <h3 className="eyebrow">{t("changeCity", lang)}</h3>
            <CityPicker onPick={() => setSettingsOpen(false)} />
          </section>
          <p className="text-xs leading-relaxed text-muted">{t("dataNote", lang)}</p>
        </div>
      </Sheet>
    </div>
  );
}

