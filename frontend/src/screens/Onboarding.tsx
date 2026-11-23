import { ArrowRight } from "lucide-react";
import { useCities } from "../lib/data";
import { LANGUAGES, t, tr } from "../lib/i18n";
import { setSettings, useSettings } from "../lib/settings";
import type { Mode } from "../lib/types";

export const MODES: Mode[] = ["standard", "kid", "quick", "scholar", "pilgrim"];

export function LanguagePicker() {
  const { lang } = useSettings();
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {LANGUAGES.map((l) => (
        <button key={l.code} className={"chip justify-center py-2.5" + (lang === l.code ? " chip--on" : "")} onClick={() => setSettings({ lang: l.code })} lang={l.code}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

export function ModePicker() {
  const { lang, mode } = useSettings();
  return (
    <div className="grid gap-2">
      {MODES.map((m) => (
        <button key={m} className={"flex items-baseline justify-between border px-4 py-2.5 text-left " + (mode === m ? "border-brand bg-brand text-paper" : "border-line bg-paper")} onClick={() => setSettings({ mode: m })}>
          <b>{t(`mode_${m}` as never, lang)}</b>
          <span className={"text-sm " + (mode === m ? "opacity-90" : "text-muted")}>{t(`modeHint_${m}` as never, lang)}</span>
        </button>
      ))}
    </div>
  );
}

export function CityPicker({ onPick }: { onPick?: () => void }) {
  const cities = useCities();
  const { city, lang } = useSettings();
  return (
    <div className="grid gap-2">
      {cities.map((c) => (
        <button
          key={c.id}
          className={"flex items-center justify-between border px-4 py-3 text-left " + (city === c.id ? "border-brand bg-brand text-paper" : "border-line bg-paper")}
          onClick={() => {
            setSettings({ city: c.id });
            onPick?.();
          }}
        >
          <span className="font-serif text-lg font-bold">{tr(c.name, lang === "hi" ? "hi" : "en")}</span>
          {c.depth === "lite" && <span className="border border-current px-2 text-xs uppercase">{t("lite", lang)}</span>}
        </button>
      ))}
    </div>
  );
}

export default function Onboarding() {
  const { lang } = useSettings();
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col bg-paper">
      <header className="bg-brand px-6 pb-8 pt-10 text-paper">
        <p className="text-sm uppercase tracking-[0.2em] opacity-80">UP Heritage</p>
        <h1 className="mt-1 font-serif text-4xl font-bold">{t("appName", lang)}</h1>
        <p className="mt-1 text-lg opacity-90">{t("appTag", lang)}</p>
      </header>
      <div className="flex-1 space-y-6 px-6 py-6">
        <section className="space-y-2">
          <h2 className="label">{t("chooseLang", lang)}</h2>
          <LanguagePicker />
        </section>
        <section className="space-y-2">
          <h2 className="label">{t("chooseCity", lang)}</h2>
          <CityPicker />
        </section>
        <section className="space-y-2">
          <h2 className="label">{t("chooseMode", lang)}</h2>
          <ModePicker />
        </section>
      </div>
      <div className="sticky bottom-0 border-t border-line bg-paper p-4">
        <button className="btn-primary w-full py-4 text-lg" onClick={() => setSettings({ onboarded: true })}>
          {t("start", lang)} <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}
