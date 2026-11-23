import { useRef, useState } from "react";
import { ArrowUpRight, Camera, Eye, ImagePlus, Info, Landmark, RotateCcw, ScanLine } from "lucide-react";
import AnswerCard from "../components/AnswerCard";
import { Img, Spinner } from "../components/ui";
import { ask, compressImage, recognise, type VisionResult } from "../lib/api";
import { photoOf, useOnline } from "../lib/data";
import { t, tr } from "../lib/i18n";
import { useSettings } from "../lib/settings";
import type { Answer, CityBundle } from "../lib/types";

interface Props {
  bundle: CityBundle;
  userPos: { lat: number; lng: number } | null;
  onAction: (action: Answer["action"], facility: string) => void;
  onOpenPoi: (id: string) => void;
}

function Brackets({ className = "border-white" }: { className?: string }) {
  const c = "absolute size-8 " + className;
  return (
    <div className="pointer-events-none absolute inset-5" aria-hidden>
      <span className={c + " left-0 top-0 rounded-tl-2xl border-l-[3px] border-t-[3px]"} />
      <span className={c + " right-0 top-0 rounded-tr-2xl border-r-[3px] border-t-[3px]"} />
      <span className={c + " bottom-0 left-0 rounded-bl-2xl border-b-[3px] border-l-[3px]"} />
      <span className={c + " bottom-0 right-0 rounded-br-2xl border-b-[3px] border-r-[3px]"} />
    </div>
  );
}

function ScanBeam() {
  return <span className="pointer-events-none absolute inset-x-6 h-0.5 rounded-full bg-white shadow-[0_0_18px_4px_rgb(255_255_255/0.7)] animate-scan" aria-hidden />;
}

export default function LensScreen({ bundle, userPos, onAction, onOpenPoi }: Props) {
  const { city, lang, mode } = useSettings();
  const online = useOnline();
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VisionResult | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const L = lang === "hi" ? "hi" : "en";

  const poiName = (id: string) => tr(bundle.pois.find((p) => p.id === id)?.name, L) || id;
  const poiPhoto = (id: string) => photoOf(bundle, id);
  const examples = bundle.pois.filter((p) => p.photos?.length && ["gateway", "decoration", "dome", "ghat", "temple", "stupa", "tower"].includes(p.category ?? "")).slice(0, 3);
  const backdrop = bundle.pois.find((p) => p.category === "decoration")?.photos?.[0] ?? bundle.info.cover;

  async function onFile(file?: File) {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setAnswer(null);
    setError(null);
    setBusy(true);
    try {
      const image = await compressImage(file);
      const r = await recognise({ image, city, lang, mode, lat: userPos?.lat, lng: userPos?.lng });
      setResult(r);
      if (r.answer) setAnswer(r.answer);
      if (r.status === "unavailable") setError(t("errNoAi", lang));
      else if (r.status === "error") setError(t(r.notice === "rate_limited" ? "errBusy" : "errAi", lang));
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setError(t(code === "413" ? "errTooLarge" : code === "network" || /^5\d\d$/.test(code) ? "errServer" : "error", lang));
      console.error("Lens upload failed:", e);
    } finally {
      setBusy(false);
    }
  }

  async function choose(poiId: string) {
    setBusy(true);
    try {
      setAnswer(await ask({ city, question: `What is this (${poiName(poiId)})? Explain what I am looking at.`, lang, mode, history: [], poiId }));
      setResult((r) => (r ? { ...r, status: "matched", poiId } : r));
    } catch {
      setError(t("error", lang));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPreview(null);
    setResult(null);
    setAnswer(null);
    setError(null);
  }

  const matchConf = result?.poiId && result.candidates[0]?.id === result.poiId ? result.candidates[0].confidence : null;

  return (
    <div className="no-scrollbar h-full overflow-y-auto px-4 pb-nav pt-4">
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={galRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />

      {!preview ? (
        <div className="space-y-4 animate-rise">
          <div className="relative h-[54dvh] min-h-[380px] overflow-hidden rounded-[2rem] bg-black text-white shadow-card">
            <Img photo={backdrop} alt="" className="absolute inset-0 opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/10 to-black/80" />
            <Brackets />
            {online && <ScanBeam />}
            <div className="absolute inset-x-0 top-0 px-9 pt-11">
              <h2 className="font-display text-[1.7rem] font-semibold leading-tight">{t("lensTitle", lang)}</h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/80">{t("lensHint", lang)}</p>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 pb-8">
              <button
                className="grid size-20 place-items-center rounded-full border-4 border-white/90 bg-white/20 backdrop-blur-md transition active:scale-90 disabled:animate-none animate-ring"
                onClick={() => camRef.current?.click()}
                disabled={!online}
                aria-label={t("takePhoto", lang)}
              >
                <span className="grid size-14 place-items-center rounded-full bg-white text-black">
                  <Camera size={26} />
                </span>
              </button>
              <span className="text-sm font-semibold">{t("takePhoto", lang)}</span>
            </div>
          </div>
          {!online && (
            <p className="notice">
              <Info size={16} className="mt-0.5 shrink-0 text-folk" /> {t("needsOnline", lang)}
            </p>
          )}
          <button className="btn btn-outline w-full" onClick={() => galRef.current?.click()} disabled={!online}>
            <ImagePlus size={18} /> {t("fromGallery", lang)}
          </button>
          {examples.length > 0 && (
            <div className="pt-2">
              <p className="eyebrow mb-2.5">{t("lensTips", lang)}</p>
              <div className="grid grid-cols-3 gap-2.5">
                {examples.map((p) => (
                  <button key={p.id} onClick={() => onOpenPoi(p.id)} className="group text-left">
                    <Img photo={p.photos?.[0]} alt={tr(p.name, "en")} className="aspect-square rounded-2xl" />
                    <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-snug">{tr(p.name, L)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-[2rem] bg-black shadow-card">
            <img src={preview} alt="" className={"max-h-[52dvh] w-full object-cover transition duration-500 " + (busy ? "scale-[1.02] opacity-80" : "")} />
            {busy && (
              <>
                <Brackets />
                <ScanBeam />
              </>
            )}
            {answer && result?.poiId && !busy && (
              <button className="absolute inset-x-0 bottom-0 flex items-end gap-3 bg-gradient-to-t from-black/85 to-transparent p-5 pt-16 text-left text-white" onClick={() => onOpenPoi(result.poiId!)}>
                <span className="min-w-0 flex-1">
                  {matchConf != null && (
                    <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-ok px-2 py-0.5 text-xs font-bold text-white">
                      <ScanLine size={12} /> {Math.round(matchConf * 100)}% {t("confidence", lang)}
                    </span>
                  )}
                  <span className="block font-display text-2xl font-semibold leading-tight">{poiName(result.poiId)}</span>
                </span>
                <span className="glass btn-icon">
                  <ArrowUpRight size={18} />
                </span>
              </button>
            )}
          </div>

          {busy && (
            <div className="card px-4 py-3.5">
              <Spinner label={t("recognising", lang)} />
            </div>
          )}
          {error && (
            <p className="notice">
              <Info size={16} className="mt-0.5 shrink-0 text-folk" /> {error}
            </p>
          )}

          {result?.seen && !busy && (
            <p className="flex gap-3 rounded-2xl bg-sunk px-4 py-3 text-sm">
              <Eye size={18} className="mt-0.5 shrink-0 text-muted" />
              <span>
                <b>{t("iSee", lang)}:</b> {result.seen}
              </span>
            </p>
          )}

          {result?.status === "ambiguous" && !answer && !busy && (
            <div className="space-y-2">
              <p className="eyebrow">{t("isItOneOf", lang)}</p>
              {result.candidates.map((c) => (
                <button key={c.id} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-2 pr-4 text-left transition hover:shadow-card" onClick={() => choose(c.id)}>
                  <Img photo={poiPhoto(c.id)} className="size-14 shrink-0 rounded-xl" fallback={<Landmark size={18} />} />
                  <span className="flex-1 font-semibold">{c.name}</span>
                  <span className="rounded-full bg-sunk px-2.5 py-1 text-xs font-semibold text-muted">
                    {Math.round(c.confidence * 100)}%
                  </span>
                </button>
              ))}
            </div>
          )}

          {result?.status === "unknown" && !busy && <p className="blk blk-unknown">{t("notRecognised", lang)}</p>}

          {answer && <AnswerCard answer={answer} lang={lang} onAction={onAction} onOpenPoi={onOpenPoi} poiName={poiName} poiPhoto={poiPhoto} />}

          {!busy && (
            <button className="btn btn-soft w-full" onClick={reset}>
              <RotateCcw size={18} /> {t("tryAgain", lang)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
