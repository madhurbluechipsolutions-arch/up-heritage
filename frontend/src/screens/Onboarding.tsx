import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, GraduationCap, HandHeart, Smile, Sparkles, Zap } from "lucide-react";
import { Img } from "../components/ui";
import { useCities } from "../lib/data";
import { LANGUAGES, t, tr } from "../lib/i18n";
import { setSettings, useSettings } from "../lib/settings";
import type { Mode } from "../lib/types";

export const MODES: Mode[] = ["standard", "kid", "quick", "scholar", "pilgrim"];
const MODE_ICON: Record<Mode, typeof Sparkles> = { standard: Sparkles, kid: Smile, quick: Zap, scholar: GraduationCap, pilgrim: HandHeart };

export function LanguagePicker() {
  const { lang } = useSettings();
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          className={"h-11 rounded-2xl border text-[0.95rem] font-semibold transition active:scale-95 " + (lang === l.code ? "border-ink bg-ink text-paper" : "border-line bg-surface hover:border-ink/30")}
          onClick={() => setSettings({ lang: l.code })}
          lang={l.code}
          aria-pressed={lang === l.code}
        >
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
      {MODES.map((m) => {
        const Icon = MODE_ICON[m];
        const on = mode === m;
        return (
          <button
            key={m}
            aria-pressed={on}
            className={"flex items-center gap-3.5 rounded-2xl border p-3 text-left transition active:scale-[0.99] " + (on ? "border-brand bg-brand/[0.07]" : "border-line bg-surface hover:border-ink/25")}
            onClick={() => setSettings({ mode: m })}
          >
            <span className={"grid size-11 shrink-0 place-items-center rounded-xl transition " + (on ? "bg-brand text-on-brand" : "bg-sunk text-ink")}>
              <Icon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block leading-tight">{t(`mode_${m}` as never, lang)}</b>
              <span className="text-sm text-muted">{t(`modeHint_${m}` as never, lang)}</span>
            </span>
            <span className={"grid size-6 shrink-0 place-items-center rounded-full border-2 transition " + (on ? "border-brand bg-brand text-on-brand" : "border-line")}>
              {on && <Check size={14} strokeWidth={3} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function CityPicker({ onPick }: { onPick?: () => void }) {
  const cities = useCities();
  const { city, lang } = useSettings();
  return (
    <div className="grid gap-3">
      {cities.map((c) => {
        const on = city === c.id;
        return (
          <button
            key={c.id}
            aria-pressed={on}
            className={"relative h-32 overflow-hidden rounded-3xl text-left text-white transition active:scale-[0.99] " + (on ? "ring-[3px] ring-brand ring-offset-2 ring-offset-paper" : "")}
            onClick={() => {
              setSettings({ city: c.id });
              onPick?.();
            }}
          >
            <Img src={c.cover} alt={tr(c.name, "en")} className="absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/30 to-transparent" />
            <div className="absolute inset-y-0 left-0 flex flex-col justify-end p-5">
              {c.depth === "lite" && <span className="glass mb-1.5 w-fit rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider">{t("lite", lang)}</span>}
              <span className="font-display text-3xl font-semibold leading-none">{tr(c.name, lang === "hi" ? "hi" : "en")}</span>
            </div>
            {on && (
              <span className="absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-brand text-on-brand shadow-card">
                <Check size={18} strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
      {cities.length === 0 && [0, 1].map((i) => <div key={i} className="skeleton h-32 rounded-3xl" />)}
    </div>
  );
}

export default function Onboarding() {
  const { lang, city } = useSettings();
  const cities = useCities();
  const [step, setStep] = useState(0);
  const cover = cities.find((c) => c.id === city)?.cover ?? cities[0]?.cover;
  const steps = [
    { title: t("chooseLang", lang), body: <LanguagePicker /> },
    { title: t("chooseCity", lang), body: <CityPicker /> },
    { title: t("chooseMode", lang), body: <ModePicker /> },
  ];
  const last = step === steps.length - 1;

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-xl flex-col bg-paper">
      <div className="relative h-[42dvh] min-h-[300px] shrink-0 overflow-hidden">
        <Img key={cover} src={cover} alt="" className="absolute inset-0 animate-fade-in" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/40" />
        <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-5 pt-[calc(env(safe-area-inset-top)+1rem)] text-white">
          <img src="/icon.svg" alt="" className="size-9 rounded-full" />
          <span className="font-display text-xl font-semibold">{t("appName", lang)}</span>
          <span className="ml-auto text-xs font-semibold text-white/70">UP Heritage</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 px-6 pb-14 text-white">
          <h1 className="font-display text-[2.15rem] font-semibold leading-[1.05] animate-rise">{t("onbTitle", lang)}</h1>
          <p className="mt-2 text-white/80 animate-rise [animation-delay:80ms]">{t("onbSub", lang)}</p>
        </div>
      </div>

      <div className="relative -mt-8 flex flex-1 flex-col rounded-t-[2rem] bg-paper">
        <div className="flex items-center gap-3 px-6 pt-6">
          {step > 0 ? (
            <button className="btn-icon -ml-2 bg-sunk" onClick={() => setStep((s) => s - 1)} aria-label={t("back", lang)}>
              <ArrowLeft size={18} />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="eyebrow">
              {t("stepOf", lang)} {step + 1} / {steps.length}
            </p>
            <h2 className="font-display text-2xl font-semibold leading-tight">{steps[step].title}</h2>
          </div>
        </div>
        <div className="mx-6 mt-4 flex gap-1.5">
          {steps.map((_, i) => (
            <span key={i} className={"h-1 flex-1 rounded-full transition-colors duration-500 " + (i <= step ? "bg-brand" : "bg-sunk")} />
          ))}
        </div>

        <div key={step} className="flex-1 px-6 py-5 animate-rise">
          {steps[step].body}
        </div>

        <div className="sticky bottom-0 bg-gradient-to-t from-paper via-paper to-paper/0 px-6 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4">
          <button className="btn btn-primary h-14 w-full text-lg" onClick={() => (last ? setSettings({ onboarded: true }) : setStep((s) => s + 1))}>
            {last ? t("start", lang) : t("continue", lang)} <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
