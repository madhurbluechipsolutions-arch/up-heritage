import { useEffect, useMemo, useState } from "react";
import { Accessibility, ArrowRight, Banknote, Car, Droplets, Hospital, Info, Navigation, Phone, Share2, ShieldAlert, Siren, Toilet, Utensils } from "lucide-react";
import MapView from "../components/MapView";
import { Chip } from "../components/ui";
import { distance, formatDistance, mapsLink, walkMinutes, type LatLng } from "../lib/geo";
import { t, tr } from "../lib/i18n";
import { useSettings } from "../lib/settings";
import type { CityBundle } from "../lib/types";

export const FACILITY_TYPES: { key: string; en: string; hi: string; icon: typeof Toilet; color: string; match: string[] }[] = [
  { key: "toilet", en: "Toilets", hi: "शौचालय", icon: Toilet, color: "#1e4e79", match: ["toilet"] },
  { key: "water", en: "Drinking water", hi: "पीने का पानी", icon: Droplets, color: "#0f7c8c", match: ["water"] },
  { key: "parking", en: "Parking", hi: "पार्किंग", icon: Car, color: "#4a4a4a", match: ["parking"] },
  { key: "medical", en: "Medical", hi: "चिकित्सा", icon: Hospital, color: "#c21f1f", match: ["hospital", "clinic", "pharmacy"] },
  { key: "police", en: "Police", hi: "पुलिस", icon: ShieldAlert, color: "#1f2a5c", match: ["police"] },
  { key: "helpdesk", en: "Help desk", hi: "सहायता केंद्र", icon: Info, color: "#7a2e1c", match: ["helpdesk"] },
  { key: "food", en: "Food", hi: "खाना", icon: Utensils, color: "#a86b00", match: ["food"] },
  { key: "atm", en: "ATM", hi: "एटीएम", icon: Banknote, color: "#2f6b3a", match: ["atm"] },
  { key: "access", en: "Ramps & rest", hi: "रैंप व विश्राम", icon: Accessibility, color: "#6b3e8e", match: ["ramp", "rest", "wheelchair"] },
];

export const facilityKeyFor = (type: string) => FACILITY_TYPES.find((f) => f.match.includes(type))?.key ?? "toilet";

export default function HelpScreen({ bundle, userPos, initialType }: { bundle: CityBundle; userPos: LatLng | null; initialType?: string | null }) {
  const { lang } = useSettings();
  const L = lang === "hi" ? "hi" : "en";
  const [type, setType] = useState(initialType ?? "toilet");
  useEffect(() => {
    if (initialType) setType(initialType);
  }, [initialType]);

  const def = FACILITY_TYPES.find((f) => f.key === type)!;
  const origin = userPos ?? { lat: bundle.info.center[0], lng: bundle.info.center[1] };
  const items = useMemo(
    () =>
      bundle.facilities
        .filter((f) => def.match.includes(f.type))
        .map((f) => ({ ...f, d: distance(origin, f) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 8),
    [bundle.facilities, def, origin],
  );
  const markers = useMemo(() => items.map((f, i) => ({ id: f.id, lat: f.lat, lng: f.lng, label: String(i + 1), color: def.color, title: f.name })), [items, def]);
  const helplines = bundle.info.helplines ?? [
    { id: "emergency", name: { en: "Emergency", hi: "आपातकाल" }, number: "112" },
    { id: "ambulance", name: { en: "Ambulance", hi: "एम्बुलेंस" }, number: "108" },
    { id: "tourist", name: { en: "Tourist Helpline", hi: "पर्यटक हेल्पलाइन" }, number: "1363" },
  ];

  async function shareLocation() {
    const go = (p: LatLng) => {
      const url = `https://maps.google.com/?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
      const text = lang === "hi" ? `मुझे मदद चाहिए। मेरी लोकेशन: ${url}` : `I need help. My location: ${url}`;
      if (navigator.share) navigator.share({ text }).catch(() => {});
      else window.location.href = `sms:?&body=${encodeURIComponent(text)}`;
    };
    if (userPos) go(userPos);
    else navigator.geolocation?.getCurrentPosition((p) => go({ lat: p.coords.latitude, lng: p.coords.longitude }), () => go(origin));
  }

  return (
    <div className="no-scrollbar h-full space-y-6 overflow-y-auto px-4 pb-nav pt-4">
      <a href="tel:112" className="relative flex items-center gap-4 overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#ef4444] to-[#b91c1c] p-5 text-white no-underline shadow-[0_16px_36px_-14px_#dc2626] transition active:scale-[0.98]">
        <span className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10" aria-hidden />
        <span className="pointer-events-none absolute -bottom-16 right-10 size-32 rounded-full bg-white/10" aria-hidden />
        <span className="relative grid size-16 shrink-0 place-items-center rounded-full bg-white text-[#dc2626] animate-ring">
          <Siren size={30} />
        </span>
        <span className="relative min-w-0 flex-1">
          <b className="block font-display text-2xl font-semibold leading-tight">{t("sos", lang)}</b>
          <span className="text-sm text-white/85">{t("sosHint", lang)}</span>
        </span>
        <ArrowRight size={22} className="relative shrink-0" />
      </a>

      <section>
        <p className="eyebrow mb-2.5">{t("helplines", lang)}</p>
        <div className="card divide-y divide-line overflow-hidden">
          {helplines.filter((h) => h.number !== "112").map((h) => (
            <a key={h.id} href={`tel:${h.number}`} className="flex items-center gap-3.5 px-4 py-3 no-underline transition hover:bg-sunk/60">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-sos/10 text-sos">
                <Phone size={18} />
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="line-clamp-2 text-sm text-muted">{tr(h.name, L)}</span>
                <b className="mt-0.5 block font-display text-xl font-semibold tracking-wide">{h.number}</b>
              </span>
              <span className="rounded-full bg-sos px-3 py-1.5 text-xs font-bold text-white">{lang === "hi" ? "कॉल" : "Call"}</span>
            </a>
          ))}
        </div>
        <button onClick={shareLocation} className="btn btn-outline mt-3 w-full">
          <Share2 size={18} className="text-history" /> {t("shareLocation", lang)}
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">{t("nearestFacilities", lang)}</h2>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {FACILITY_TYPES.map((f) => (
            <Chip key={f.key} active={type === f.key} onClick={() => setType(f.key)}>
              <f.icon size={16} style={{ color: type === f.key ? undefined : f.color }} /> {lang === "hi" ? f.hi : f.en}
            </Chip>
          ))}
        </div>
        {!userPos && <p className="text-sm text-muted">{t("fromSite", lang)}</p>}

        <div className="overflow-hidden rounded-[1.75rem] border border-line shadow-card">
          <MapView center={bundle.info.center} zoom={16} markers={markers} user={userPos} fit className="h-60 w-full" />
        </div>

        <ul className="card divide-y divide-line overflow-hidden">
          {items.length === 0 && <li className="p-4 text-muted">—</li>}
          {items.map((f, i) => (
            <li key={f.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold text-white" style={{ background: def.color }}>
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{f.name || (lang === "hi" ? def.hi : def.en)}</p>
                <p className="text-sm text-muted">
                  {formatDistance(f.d)} · {walkMinutes(f.d)} {t("min", lang)} {t("walk", lang)}
                  {f.timings ? ` · ${f.timings}` : ""}
                  {f.synthetic ? ` · ${t("syntheticData", lang)}` : ""}
                </p>
              </div>
              {f.phone && (
                <a href={`tel:${f.phone}`} className="btn-icon bg-sunk" aria-label="Call">
                  <Phone size={17} />
                </a>
              )}
              <a href={mapsLink(f)} target="_blank" rel="noreferrer" className="btn-icon bg-brand text-on-brand" aria-label={t("directions", lang)}>
                <Navigation size={17} />
              </a>
            </li>
          ))}
        </ul>
      </section>
      <p className="flex gap-2 text-xs leading-relaxed text-muted">
        <Info size={14} className="mt-0.5 shrink-0" /> {t("dataNote", lang)}
      </p>
    </div>
  );
}
