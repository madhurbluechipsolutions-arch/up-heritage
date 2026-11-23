import { useCallback, useEffect, useState } from "react";
import { Camera, CloudDownload, CloudOff, Compass, LifeBuoy, MessageCircle, Route, Settings2, Check } from "lucide-react";
import PoiSheet from "./components/PoiSheet";
import { Sheet } from "./components/ui";
import { downloadPack, isPackDownloaded } from "./lib/api";
import { useCity, useOnline } from "./lib/data";
import type { LatLng } from "./lib/geo";
import { LANGUAGES, t, tr } from "./lib/i18n";
import { setSettings, useSettings } from "./lib/settings";
import type { Answer, Tab } from "./lib/types";
import AskScreen, { type ChatMsg } from "./screens/Ask";
import ExploreScreen from "./screens/Explore";
import HelpScreen, { facilityKeyFor } from "./screens/Help";
import LensScreen from "./screens/Lens";
import Onboarding, { CityPicker, LanguagePicker, ModePicker } from "./screens/Onboarding";
import TourScreen from "./screens/Tour";

const TABS: { id: Tab; icon: typeof MessageCircle }[] = [
  { id: "ask", icon: MessageCircle },
  { id: "lens", icon: Camera },
  { id: "tour", icon: Route },
  { id: "explore", icon: Compass },
  { id: "help", icon: LifeBuoy },
];

/** Deep link from a signboard QR code: /p/<city>/<poiId> opens that spot directly. */
function readDeepLink(): { city: string; poi: string } | null {
  const m = window.location.pathname.match(/^\/p\/([a-z0-9-]+)\/([a-z0-9-]+)/);
  return m ? { city: m[1], poi: m[2] } : null;
}

export default function App() {
  const settings = useSettings();
  const { city, lang, largeText, onboarded, mode } = settings;
  const bundle = useCity(city);
  const online = useOnline();
  const [tab, setTab] = useState<Tab>("ask");
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

  return (
    <div className="mx-auto flex h-dvh max-w-xl flex-col bg-paper">
      <header className="flex items-center gap-2 bg-brand px-4 py-2.5 text-paper">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.18em] opacity-80">{t("appName", lang)} · {t(`mode_${mode}` as never, lang)}</p>
          <p className="truncate font-serif text-lg font-bold leading-tight">{bundle ? tr(bundle.info.name, L) : "…"}</p>
        </div>
        {!online && (
          <span className="flex items-center gap-1 bg-paper/15 px-2 py-1 text-xs">
            <CloudOff size={14} /> {t("offline", lang)}
          </span>
        )}
        <button className="border border-paper/40 px-2 py-1 text-sm" onClick={() => setSettingsOpen(true)} aria-label={t("chooseLang", lang)}>
          {LANGUAGES.find((l) => l.code === lang)?.label ?? lang}
        </button>
        <button className="btn-icon text-paper" onClick={() => setSettingsOpen(true)} aria-label={t("settings", lang)}>
          <Settings2 size={20} />
        </button>
      </header>

      <main className="min-h-0 flex-1">
        {!bundle ? (
          <div className="p-6 text-muted">…</div>
        ) : (
          <>
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

      <nav className="grid grid-cols-5 border-t border-line bg-paper" aria-label="Main">
        {TABS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={"flex flex-col items-center gap-0.5 py-2 text-xs font-semibold " + (tab === id ? "border-t-[3px] border-brand text-brand" : "border-t-[3px] border-transparent text-muted") + (id === "help" ? " text-sos" : "")}
            aria-current={tab === id ? "page" : undefined}
          >
            <Icon size={22} />
            {t(id, lang)}
          </button>
        ))}
      </nav>

      <PoiSheet
        poi={poi}
        city={city}
        onClose={() => setOpenPoi(null)}
        onAsk={(id) => {
          setOpenPoi(null);
          setTab("ask");
          const name = tr(bundle?.pois.find((p) => p.id === id)?.name, L);
          setPrefill({ question: lang === "hi" ? `${name} के बारे में बताइए` : `Tell me about ${name}`, poiId: id });
        }}
      />

      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title={t("settings", lang)}>
        <div className="space-y-6">
          <section className="space-y-2">
            <h3 className="label">{t("chooseLang", lang)}</h3>
            <LanguagePicker />
          </section>
          <section className="space-y-2">
            <h3 className="label">{t("chooseMode", lang)}</h3>
            <ModePicker />
          </section>
          <section className="space-y-3">
            <label className="flex items-center justify-between gap-3 border border-line px-4 py-3">
              <span className="font-semibold">{t("largeText", lang)}</span>
              <input type="checkbox" className="size-6 accent-brand" checked={largeText} onChange={(e) => setSettings({ largeText: e.target.checked })} />
            </label>
            <label className="flex items-center justify-between gap-3 border border-line px-4 py-3">
              <span className="font-semibold">{t("autoRead", lang)}</span>
              <input type="checkbox" className="size-6 accent-brand" checked={settings.autoRead} onChange={(e) => setSettings({ autoRead: e.target.checked })} />
            </label>
          </section>
          <section className="space-y-2 border border-line p-4">
            <h3 className="font-semibold">{t("offlinePack", lang)}</h3>
            <p className="text-sm text-muted">{t("offlineHint", lang)}</p>
            <button
              className="btn-primary w-full"
              disabled={pack !== null || !online}
              onClick={async () => {
                setPack(0);
                await downloadPack(city, lang, setPack);
                setPack(null);
              }}
            >
              {pack !== null ? `${pack}%` : packReady ? (<><Check size={18} /> {t("downloaded", lang)}</>) : (<><CloudDownload size={18} /> {t("download", lang)}</>)}
            </button>
          </section>
          <section className="space-y-2">
            <h3 className="label">{t("changeCity", lang)}</h3>
            <CityPicker onPick={() => setSettingsOpen(false)} />
          </section>
          <p className="text-xs text-muted">{t("dataNote", lang)}</p>
        </div>
      </Sheet>
    </div>
  );
}
