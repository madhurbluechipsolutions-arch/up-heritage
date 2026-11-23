import { useMemo, useState } from "react";
import { BadgeCheck, Clock, ExternalLink, Navigation, Ticket, Bus } from "lucide-react";
import { Chip } from "../components/ui";
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

export default function ExploreScreen({ bundle, userPos }: { bundle: CityBundle; userPos: { lat: number; lng: number } | null }) {
  const { lang } = useSettings();
  const L = lang === "hi" ? "hi" : "en";
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
    <div className="h-full space-y-4 overflow-y-auto px-4 py-4">
      <h2 className="font-serif text-xl font-bold">{t("exploreTitle", lang)}</h2>

      <fieldset className="space-y-2">
        <legend className="label">{t("interests", lang)}</legend>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map(([k]) => (
            <Chip key={k} active={prefs.interests.includes(k)} onClick={() => toggle("interests", k)}>
              {label(INTERESTS, k)}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="label">{t("withWho", lang)}</legend>
        <div className="flex flex-wrap gap-2">
          {COMPANIONS.map(([k]) => (
            <Chip key={k} active={prefs.with.includes(k)} onClick={() => toggle("with", k)}>
              {label(COMPANIONS, k)}
            </Chip>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <fieldset className="space-y-2">
          <legend className="label">{t("timeLeft", lang)}</legend>
          <div className="flex flex-wrap gap-2">
            {HOURS.map((h) => (
              <Chip key={h} active={prefs.hours === h} onClick={() => setPrefs((p) => ({ ...p, hours: h }))}>
                {h === 8 ? (lang === "hi" ? "पूरा दिन" : "Full day") : `${h} h`}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="label">{t("budget", lang)}</legend>
          <div className="flex flex-wrap gap-2">
            {BUDGETS.map(([k]) => (
              <Chip key={k} active={prefs.budget === k} onClick={() => setPrefs((p) => ({ ...p, budget: k }))}>
                {label(BUDGETS, k)}
              </Chip>
            ))}
          </div>
        </fieldset>
      </div>

      {!good.length && <p className="notice">{t("noMatches", lang)}</p>}

      <ul className="space-y-3 pb-4">
        {list.map(({ item, reasons, dist }) => (
          <li key={item.id} className="border border-line bg-paper">
            <div className="border-b border-line px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-serif text-lg font-bold">{tr(item.name, L)}</h3>
                {dist != null && <span className="shrink-0 text-sm text-muted">{formatDistance(dist)}</span>}
              </div>
              <p className="mt-0.5 text-sm uppercase tracking-wide text-muted">
                {lang === "hi" ? TYPE_HI[item.type] ?? item.type : item.type}
                {item.when ? ` · ${item.when}` : ""}
              </p>
              {item.odop && (
                <p className="mt-2 inline-flex items-center gap-1 bg-folk px-2 py-0.5 text-sm font-semibold text-paper">
                  <BadgeCheck size={14} /> {t("odop", lang)}
                </p>
              )}
            </div>
            <div className="space-y-2 px-4 py-3">
              <p className="leading-relaxed">{tr(item.description, L)}</p>
              {reasons.length > 0 && (
                <p className="text-sm">
                  <b className="text-brand">{t("why", lang)}:</b> {reasons.join(" · ")}
                </p>
              )}
              <dl className="grid gap-1 text-sm">
                {item.timings && (
                  <div className="flex gap-2"><Clock size={15} className="mt-0.5 shrink-0 text-muted" /><dd>{tr(item.timings, L)}</dd></div>
                )}
                {item.entryFee && (
                  <div className="flex gap-2"><Ticket size={15} className="mt-0.5 shrink-0 text-muted" /><dd>{tr(item.entryFee, L)}</dd></div>
                )}
                {item.howToReach && (
                  <div className="flex gap-2"><Bus size={15} className="mt-0.5 shrink-0 text-muted" /><dd>{tr(item.howToReach, L)}</dd></div>
                )}
              </dl>
              <div className="flex flex-wrap gap-2 pt-1">
                {item.lat != null && item.lng != null && (
                  <a className="btn-primary-sm" href={mapsLink({ lat: item.lat, lng: item.lng })} target="_blank" rel="noreferrer">
                    <Navigation size={15} /> {t("directions", lang)}
                  </a>
                )}
                {item.url && (
                  <a className="btn-ghost" href={item.url} target="_blank" rel="noreferrer">
                    {item.source ?? t("sources", lang)} <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
