import { useMemo, useState, type ReactNode } from "react";
import { BadgeCheck, Bus, ChevronDown, Clock3, ExternalLink, Info, MapPin, Navigation, SlidersHorizontal, Sparkles, Ticket } from "lucide-react";
import { Chip, Credit, Img } from "../components/ui";
import { distance, formatDistance, mapsLink } from "../lib/geo";
import { t, tr } from "../lib/i18n";
import { useSettings } from "../lib/settings";
import type { CityBundle, NearbyItem } from "../lib/types";

const INTERESTS: [string, string, string][] = [
  ["history", "History", "इतिहास"],
  ["architecture", "Architecture", "वास्तुकला"],
  ["spiritual", "Spiritual", "आध्यात्मिक"],
  ["shopping", "Shopping & crafts", "ख़रीदारी व शिल्प"],
  ["food", "Food", "खाना"],
  ["art", "Art", "कला"],
  ["nature", "Nature", "प्रकृति"],
  ["photography", "Photography", "फ़ोटोग्राफ़ी"],
];
const COMPANIONS: [string, string, string][] = [
  ["solo", "Solo", "अकेले"],
  ["couple", "Couple", "जोड़ा"],
  ["family", "Family", "परिवार"],
  ["kids", "Young children", "छोटे बच्चे"],
  ["elderly", "Elderly parents", "बुज़ुर्ग माता-पिता"],
  ["pilgrim", "Pilgrimage", "तीर्थयात्रा"],
];
const BUDGETS: [string, string, string][] = [
  ["free", "Free", "मुफ़्त"],
  ["low", "Low", "कम"],
  ["medium", "Medium", "मध्यम"],
  ["high", "No limit", "कोई सीमा नहीं"],
];
const HOURS = [2, 4, 8];
const TYPE_HI: Record<string, string> = {
  heritage: "विरासत", museum: "संग्रहालय", market: "बाज़ार", food: "खान-पान",
  craft: "शिल्प", festival: "उत्सव", nature: "प्रकृति",
};
const BUDGET_RANK: Record<string, number> = { free: 0, low: 1, medium: 2, high: 3 };

interface Prefs {
  interests: string[];
  hours: number;
  budget: string;
  with: string[];
}

/** Transparent scoring, so each card can say exactly why it was suggested. */
function score(item: NearbyItem, prefs: Prefs, lang: string) {
  const reasons: string[] = [];
  let s = 0;
  const hit = (item.interests ?? []).filter((i) => prefs.interests.includes(i));
  if (hit.length) {
    s += 3 * hit.length;
    reasons.push(hit.map((h) => INTERESTS.find((x) => x[0] === h)?.[lang === "hi" ? 2 : 1] ?? h).join(", "));
  }
  const fits = (item.goodFor ?? []).filter((g) => prefs.with.includes(g));
  if (fits.length) {
    s += 2 * fits.length;
    reasons.push((lang === "hi" ? "उपयुक्त: " : "Good for ") + fits.map((g) => COMPANIONS.find((x) => x[0] === g)?.[lang === "hi" ? 2 : 1] ?? g).join(", ").toLowerCase());
  }
  if (item.durationHours != null) {
    if (item.durationHours <= prefs.hours) {
      s += 1;
      reasons.push(lang === "hi" ? `${item.durationHours} घंटे में` : `Fits in ${item.durationHours} h`);
    } else s -= 4;
  }
  if (item.budget && BUDGET_RANK[item.budget] > BUDGET_RANK[prefs.budget]) s -= 3;
  else if (item.budget) s += 1;
  if (item.odop) s += 1;
  return { s, reasons };
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="eyebrow mb-2">{label}</legend>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">{children}</div>
    </fieldset>
  );
}

function PlaceCard({ item, reasons, dist, lang, L, index }: { item: NearbyItem; reasons: string[]; dist: number | null; lang: string; L: string; index: number }) {
  const [more, setMore] = useState(false);
  const photo = item.photos?.[0];
  const desc = tr(item.description, L);
  return (
    <li className="card overflow-hidden animate-rise" style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}>
      <div className="relative h-56 text-white">
        <Img photo={photo} alt={tr(item.name, "en")} className="absolute inset-0" fallback={<Sparkles size={30} />} />
        <div className="absolute inset-0 shade-b" />
        <div className="absolute inset-x-3 top-3 flex items-start gap-1.5">
          <span className="glass rounded-full px-2.5 py-1 text-xs font-semibold capitalize">{lang === "hi" ? TYPE_HI[item.type] ?? item.type : item.type}</span>
          {item.odop && (
            <span className="flex items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-xs font-bold text-white shadow">
              <BadgeCheck size={13} /> ODOP
            </span>
          )}
          <span className="flex-1" />
          {dist != null && (
            <span className="glass flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
              <MapPin size={12} /> {formatDistance(dist)}
            </span>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="font-display text-2xl font-semibold leading-tight">{tr(item.name, L)}</h3>
          {item.when && <p className="mt-0.5 text-sm text-white/75">{item.when}</p>}
          <Credit photo={photo} className="mt-1 block text-white" />
        </div>
      </div>
      <div className="space-y-3 p-4">
        {reasons.length > 0 && (
          <p className="flex items-start gap-2 rounded-2xl bg-brand/[0.07] px-3 py-2 text-sm">
            <Sparkles size={15} className="mt-0.5 shrink-0 text-brand" />
            <span>
              <b className="text-brand">{t("why", lang)}:</b> {reasons.join(" · ")}
            </span>
          </p>
        )}
        {item.odop && <p className="text-xs font-semibold text-gold">{t("odop", lang)}</p>}
        <div>
          <p className={"leading-relaxed " + (more ? "" : "line-clamp-3")}>{desc}</p>
          {desc.length > 160 && (
            <button className="mt-1 flex items-center gap-0.5 text-sm font-semibold text-brand" onClick={() => setMore((m) => !m)}>
              {more ? t("less", lang) : t("more", lang)} <ChevronDown size={15} className={"transition " + (more ? "rotate-180" : "")} />
            </button>
          )}
        </div>
        {(item.timings || item.entryFee || item.howToReach) && (
          <dl className="grid gap-2 rounded-2xl bg-sunk/70 p-3 text-sm">
            {item.timings && (
              <div className="flex gap-2.5"><Clock3 size={16} className="mt-0.5 shrink-0 text-muted" /><dd>{tr(item.timings, L)}</dd></div>
            )}
            {item.entryFee && (
              <div className="flex gap-2.5"><Ticket size={16} className="mt-0.5 shrink-0 text-muted" /><dd>{tr(item.entryFee, L)}</dd></div>
            )}
            {item.howToReach && (
              <div className="flex gap-2.5"><Bus size={16} className="mt-0.5 shrink-0 text-muted" /><dd>{tr(item.howToReach, L)}</dd></div>
            )}
          </dl>
        )}
        <div className="flex flex-wrap gap-2 pt-0.5">
          {item.lat != null && item.lng != null && (
            <a className="btn btn-sm btn-primary" href={mapsLink({ lat: item.lat, lng: item.lng })} target="_blank" rel="noreferrer">
              <Navigation size={15} /> {t("directions", lang)}
            </a>
          )}
          {item.url && (
            <a className="btn btn-sm btn-soft" href={item.url} target="_blank" rel="noreferrer">
              {item.source ?? t("sources", lang)} <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

export default function ExploreScreen({ bundle, userPos }: { bundle: CityBundle; userPos: { lat: number; lng: number } | null }) {
  const { lang } = useSettings();
  const L = lang === "hi" ? "hi" : "en";
  const [open, setOpen] = useState(true);
  const [prefs, setPrefs] = useState<Prefs>({ interests: ["history", "food"], hours: 4, budget: "medium", with: ["family"] });
  const toggle = (key: "interests" | "with", v: string) =>
    setPrefs((p) => ({ ...p, [key]: p[key].includes(v) ? p[key].filter((x) => x !== v) : [...p[key], v] }));

  const origin = userPos ?? { lat: bundle.info.center[0], lng: bundle.info.center[1] };
  const ranked = useMemo(
    () =>
      bundle.nearby
        .map((item) => ({ item, ...score(item, prefs, lang), dist: item.lat != null && item.lng != null ? distance(origin, { lat: item.lat, lng: item.lng }) : null }))
        .sort((a, b) => b.s - a.s || (a.dist ?? 1e9) - (b.dist ?? 1e9)),
    [bundle.nearby, prefs, lang, origin],
  );
  const good = ranked.filter((r) => r.s > 0);
  const list = good.length ? good : ranked.slice(0, 5);

  const label = (arr: [string, string, string][], v: string) => arr.find((x) => x[0] === v)?.[lang === "hi" ? 2 : 1] ?? v;

  return (
    <div className="no-scrollbar h-full space-y-5 overflow-y-auto px-5 pb-nav pt-4">
      <div className="card overflow-hidden p-5">
        <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className="grid size-10 place-items-center rounded-2xl bg-brand/10 text-brand">
            <SlidersHorizontal size={19} />
          </span>
          <span className="flex-1">
            <b className="block leading-tight">{t("personalise", lang)}</b>
            <span className="text-sm text-muted">
              {list.length} {t("forYou", lang)}
            </span>
          </span>
          <ChevronDown size={20} className={"text-muted transition " + (open ? "rotate-180" : "")} />
        </button>
        {open && (
          <div className="mt-5 space-y-4 animate-fade-in">
            <ChipRow label={t("interests", lang)}>
              {INTERESTS.map(([k]) => (
                <Chip key={k} active={prefs.interests.includes(k)} onClick={() => toggle("interests", k)}>
                  {label(INTERESTS, k)}
                </Chip>
              ))}
            </ChipRow>
            <ChipRow label={t("withWho", lang)}>
              {COMPANIONS.map(([k]) => (
                <Chip key={k} active={prefs.with.includes(k)} onClick={() => toggle("with", k)}>
                  {label(COMPANIONS, k)}
                </Chip>
              ))}
            </ChipRow>
            <ChipRow label={t("timeLeft", lang)}>
              {HOURS.map((h) => (
                <Chip key={h} active={prefs.hours === h} onClick={() => setPrefs((p) => ({ ...p, hours: h }))}>
                  {h === 8 ? (lang === "hi" ? "पूरा दिन" : "Full day") : `${h} h`}
                </Chip>
              ))}
            </ChipRow>
            <ChipRow label={t("budget", lang)}>
              {BUDGETS.map(([k]) => (
                <Chip key={k} active={prefs.budget === k} onClick={() => setPrefs((p) => ({ ...p, budget: k }))}>
                  {label(BUDGETS, k)}
                </Chip>
              ))}
            </ChipRow>
          </div>
        )}
      </div>

      {!good.length && (
        <p className="notice">
          <Info size={16} className="mt-0.5 shrink-0 text-folk" /> {t("noMatches", lang)}
        </p>
      )}

      <ul className="space-y-5">
        {list.map(({ item, reasons, dist }, i) => (
          <PlaceCard key={item.id} item={item} reasons={reasons} dist={dist} lang={lang} L={L} index={i} />
        ))}
      </ul>
    </div>
  );
}
