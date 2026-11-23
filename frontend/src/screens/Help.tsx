import { useEffect, useMemo, useState } from "react";
import { Accessibility, Banknote, Car, Droplets, Hospital, Info, Navigation, Phone, Share2, ShieldAlert, Siren, Toilet, Utensils } from "lucide-react";
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
    <div className="h-full space-y-4 overflow-y-auto px-4 py-4">
      <a href="tel:112" className="btn-sos flex w-full flex-col py-5 text-xl">
        <span className="flex items-center gap-2"><Siren size={28} /> {t("sos", lang)}</span>
        <span className="text-sm font-normal opacity-90">{t("sosHint", lang)}</span>
      </a>

      <div className="grid grid-cols-2 gap-2">
        {helplines.filter((h) => h.number !== "112").map((h) => (
          <a key={h.id} href={`tel:${h.number}`} className="btn-secondary justify-start">
            <Phone size={18} className="shrink-0 text-sos" />
            <span className="text-left leading-tight">
              <b className="block text-lg">{h.number}</b>
              <span className="text-sm">{tr(h.name, L)}</span>
            </span>
          </a>
        ))}
        <button onClick={shareLocation} className="btn-secondary justify-start">
          <Share2 size={18} className="shrink-0" /> {t("shareLocation", lang)}
        </button>
      </div>

      <h2 className="pt-2 font-serif text-xl font-bold">{t("nearestFacilities", lang)}</h2>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FACILITY_TYPES.map((f) => (
          <Chip key={f.key} active={type === f.key} onClick={() => setType(f.key)}>
            <f.icon size={16} /> {lang === "hi" ? f.hi : f.en}
          </Chip>
        ))}
      </div>
      {!userPos && <p className="text-sm text-muted">{t("fromSite", lang)}</p>}

      <MapView center={bundle.info.center} zoom={16} markers={markers} user={userPos} fit className="-mx-4 h-60 w-[calc(100%+2rem)]" />

      <ul className="space-y-2 pb-4">
        {items.length === 0 && <li className="text-muted">—</li>}
        {items.map((f, i) => (
          <li key={f.id} className="flex items-center gap-3 border border-line bg-paper px-3 py-2.5">
            <span className="grid size-8 shrink-0 place-items-center text-sm font-bold text-paper" style={{ background: def.color }}>
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
              <a href={`tel:${f.phone}`} className="btn-icon" aria-label="Call">
                <Phone size={18} />
              </a>
            )}
            <a href={mapsLink(f)} target="_blank" rel="noreferrer" className="btn-icon" aria-label={t("directions", lang)}>
              <Navigation size={18} />
            </a>
          </li>
        ))}
      </ul>
      <p className="flex gap-2 pb-6 text-xs text-muted">
        <Info size={14} className="mt-0.5 shrink-0" /> {t("dataNote", lang)}
      </p>
    </div>
  );
}
