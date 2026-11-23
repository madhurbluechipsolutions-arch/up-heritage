import { useState } from "react";
import { BadgeCheck, CalendarX, Camera, Clock3, CloudOff, ExternalLink, Headphones, Landmark, MessageCircle, Settings2, Sparkles, Ticket } from "lucide-react";
import { Credit, Img, SectionHeader } from "../components/ui";
import { photoOf } from "../lib/data";
import { LANGUAGES, t, tr } from "../lib/i18n";
import { useSettings } from "../lib/settings";
import type { CityBundle, L10n, Poi, Tab } from "../lib/types";

interface Props {
  bundle: CityBundle;
  online: boolean;
  onOpenPoi: (id: string) => void;
  onTab: (tab: Tab) => void;
  onSettings: () => void;
}

const cap = (s?: string) => (s ? s.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "");

function InfoRow({ icon: Icon, label, text }: { icon: typeof Clock3; label: string; text: string }) {
  const { lang } = useSettings();
  const [open, setOpen] = useState(false);
  const long = text.length > 140;
  return (
    <div className="flex gap-3.5 py-3.5 first:pt-0 last:pb-0">
      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
        <Icon size={19} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="eyebrow">{label}</p>
        <p className={"mt-0.5 text-[0.95rem] leading-relaxed " + (open || !long ? "" : "line-clamp-2")}>{text}</p>
        {long && (
          <button className="mt-1 text-sm font-semibold text-brand" onClick={() => setOpen((o) => !o)}>
            {open ? t("less", lang) : t("more", lang)}
          </button>
        )}
      </div>
    </div>
  );
}

function SpotCard({ poi, bundle, L, lang, onOpen, size = "lg" }: { poi: Poi; bundle: CityBundle; L: string; lang: string; onOpen: () => void; size?: "lg" | "sm" }) {
  const photo = photoOf(bundle, poi.id);
  return (
    <button
      onClick={onOpen}
      className={
        "group relative shrink-0 overflow-hidden text-left text-white shadow-card transition duration-300 active:scale-[0.98] " +
        (size === "lg" ? "h-[22rem] w-[16.5rem] rounded-[1.75rem]" : "aspect-[4/5] w-full rounded-3xl")
      }
    >
      <Img photo={photo} alt={tr(poi.name, "en")} className="absolute inset-0 transition duration-700 group-hover:scale-105" fallback={<Landmark size={32} />} />
      <div className="absolute inset-0 shade-b" />
      {poi.tourMinutes ? (
        <span className="glass absolute left-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
          <Clock3 size={12} /> {poi.tourMinutes} {t("min", lang)}
        </span>
      ) : null}
      <div className={"absolute inset-x-0 bottom-0 " + (size === "lg" ? "p-5" : "p-3.5")}>
        {L === "en" && poi.category && <p className="mb-1 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-white/70">{cap(poi.category)}</p>}
        <h3 className={"font-display font-semibold leading-tight " + (size === "lg" ? "text-2xl" : "text-lg line-clamp-2")}>{tr(poi.name, L)}</h3>
        {size === "lg" && poi.summary && <p className="mt-1.5 line-clamp-2 text-sm text-white/80">{tr(poi.summary, L)}</p>}
      </div>
    </button>
  );
}

export default function HomeScreen({ bundle, online, onOpenPoi, onTab, onSettings }: Props) {
  const { lang } = useSettings();
  const L = lang === "hi" ? "hi" : "en";
  const { info, pois, nearby } = bundle;
  const cover = info.cover ?? pois.find((p) => p.photos?.length)?.photos?.[0];
  const mustSee = pois.filter((p) => (p.priority ?? 2) === 1);
  const rest = pois.filter((p) => (p.priority ?? 2) !== 1);
  const site = info.mainSite;
  const langLabel = LANGUAGES.find((l) => l.code === lang)?.label ?? lang;

  const quick: { tab: Tab; icon: typeof Camera; key: "quickScan" | "quickTour" | "quickAsk"; primary?: boolean }[] = [
    { tab: "lens", icon: Camera, key: "quickScan", primary: true },
    { tab: "tour", icon: Headphones, key: "quickTour" },
    { tab: "ask", icon: MessageCircle, key: "quickAsk" },
  ];

  return (
    <div className="no-scrollbar h-full overflow-y-auto pb-nav">
      {/* Hero */}
      <section className="relative h-[66dvh] min-h-[430px] max-h-[640px] overflow-hidden">
        <Img photo={cover} alt={tr(info.name, "en")} className="absolute inset-0 animate-fade-in" />
        <div className="absolute inset-0 shade-b" />
        <div className="absolute inset-x-0 top-0 h-36 shade-t" />

        <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+0.9rem)]">
          <span className="glass flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5">
            <img src="/icon.svg" alt="" className="size-7 rounded-full" />
            <span className="font-display text-base font-semibold">{t("appName", lang)}</span>
          </span>
          <span className="flex-1" />
          {!online && (
            <span className="glass flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold">
              <CloudOff size={14} /> {t("offline", lang)}
            </span>
          )}
          <button className="glass h-10 rounded-full px-3.5 text-sm font-semibold" onClick={onSettings} aria-label={t("chooseLang", lang)}>
            {langLabel}
          </button>
          <button className="glass btn-icon" onClick={onSettings} aria-label={t("settings", lang)}>
            <Settings2 size={18} />
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 px-5 pb-14 text-white animate-rise">
          <p className="eyebrow !text-white/75">{t("welcome", lang)} · Uttar Pradesh</p>
          <h1 className="mt-1 font-display text-6xl font-semibold leading-[0.95] tracking-tight">{tr(info.name, L)}</h1>
          {info.tagline && <p className="mt-3 max-w-md text-[0.95rem] leading-relaxed text-white/85 line-clamp-3">{tr(info.tagline, L)}</p>}
          <Credit photo={cover} className="mt-3 block max-w-[80%] text-white" />
        </div>
      </section>

      {/* Quick actions */}
      <div className="relative z-10 -mt-8 px-5">
        <div className="card grid grid-cols-3 gap-1 p-2">
          {quick.map((q) => (
            <button key={q.tab} onClick={() => onTab(q.tab)} className="flex flex-col items-center gap-2 rounded-2xl px-1 py-3 text-center transition hover:bg-sunk active:scale-95">
              <span className={"grid size-12 place-items-center rounded-2xl " + (q.primary ? "bg-brand text-on-brand shadow-[0_8px_20px_-8px_var(--c-brand)]" : "bg-sunk text-ink")}>
                <q.icon size={22} />
              </span>
              <span className="text-[0.8rem] font-semibold leading-tight">{t(q.key, lang)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Must see */}
      {mustSee.length > 0 && (
        <section className="mt-9 px-5">
          <SectionHeader eyebrow={site ? tr(site.name, L) : undefined} title={t("mustSee", lang)} action={t("quickTour", lang)} onAction={() => onTab("tour")} />
          <div className="snap-row">
            {mustSee.map((p) => (
              <SpotCard key={p.id} poi={p} bundle={bundle} L={L} lang={lang} onOpen={() => onOpenPoi(p.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Plan */}
      {site && (site.timings || site.entryFee || site.closedOn) && (
        <section className="mt-9 px-5">
          <SectionHeader title={t("planVisit", lang)} />
          <div className="card divide-y divide-line p-5">
            {site.timings && <InfoRow icon={Clock3} label={t("timings", lang)} text={tr(site.timings as L10n, L)} />}
            {site.closedOn && <InfoRow icon={CalendarX} label={t("closedOn", lang)} text={tr(site.closedOn as L10n, L)} />}
            {site.entryFee && <InfoRow icon={Ticket} label={t("entry", lang)} text={tr(site.entryFee as L10n, L)} />}
            {site.url && (
              <a href={site.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 pt-3.5 text-xs text-muted no-underline hover:text-ink">
                <BadgeCheck size={14} className="text-ok" /> {site.source ?? t("sources", lang)} <ExternalLink size={11} />
              </a>
            )}
          </div>
        </section>
      )}

      {/* Nearby */}
      {nearby.length > 0 && (
        <section className="mt-9 px-5">
          <SectionHeader title={t("beyond", lang)} action={t("seeAll", lang)} onAction={() => onTab("explore")} />
          <div className="snap-row">
            {nearby.slice(0, 10).map((n) => (
              <button key={n.id} onClick={() => onTab("explore")} className="w-60 shrink-0 text-left">
                <div className="relative">
                  <Img photo={n.photos?.[0]} alt={tr(n.name, "en")} className="h-40 w-full rounded-3xl" fallback={<Sparkles size={26} />} />
                  {n.odop && (
                    <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-[0.68rem] font-bold text-white shadow">
                      <BadgeCheck size={12} /> ODOP
                    </span>
                  )}
                </div>
                <p className="mt-2.5 font-semibold leading-snug line-clamp-1">{tr(n.name, L)}</p>
                <p className="text-sm capitalize text-muted">{n.type}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Every corner */}
      {rest.length > 0 && (
        <section className="mt-9 px-5">
          <SectionHeader title={t("allSpots", lang)} eyebrow={t("tapToOpen", lang)} />
          <div className="grid grid-cols-2 gap-3">
            {rest.map((p) => (
              <SpotCard key={p.id} poi={p} bundle={bundle} L={L} lang={lang} size="sm" onOpen={() => onOpenPoi(p.id)} />
            ))}
          </div>
        </section>
      )}

      <p className="mx-5 mt-10 flex gap-2 text-xs leading-relaxed text-muted">
        <BadgeCheck size={14} className="mt-0.5 shrink-0" /> {t("dataNote", lang)}
      </p>
    </div>
  );
}
