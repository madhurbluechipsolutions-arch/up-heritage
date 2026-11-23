import { useRef, useState } from "react";
import { Camera, Eye, ImagePlus, RotateCcw } from "lucide-react";
import AnswerCard from "../components/AnswerCard";
import { Spinner } from "../components/ui";
import { ask, compressImage, recognise, type VisionResult } from "../lib/api";
import { useOnline } from "../lib/data";
import { t, tr } from "../lib/i18n";
import { useSettings } from "../lib/settings";
import type { Answer, CityBundle } from "../lib/types";

interface Props {
  bundle: CityBundle;
  userPos: { lat: number; lng: number } | null;
  onAction: (action: Answer["action"], facility: string) => void;
  onOpenPoi: (id: string) => void;
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

  const poiName = (id: string) => tr(bundle.pois.find((p) => p.id === id)?.name, lang === "hi" ? "hi" : "en") || id;

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
      if (r.status === "error" || r.status === "unavailable") setError(t("error", lang));
    } catch {
      setError(t("error", lang));
    } finally {
      setBusy(false);
    }
  }

  async function choose(poiId: string) {
    setBusy(true);
    try {
      setAnswer(await ask({ city, question: `What is this (${poiName(poiId)})? Explain what I am looking at.`, lang, mode, history: [], poiId }));
      setResult((r) => (r ? { ...r, status: "matched", poiId } : r));
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

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={galRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />

      {!preview ? (
        <div className="space-y-4">
          <div className="border-l-4 border-brand bg-card p-4">
            <h2 className="font-serif text-xl font-bold">{t("lensTitle", lang)}</h2>
            <p className="mt-1 leading-relaxed">{t("lensHint", lang)}</p>
          </div>
          {!online && <p className="notice">{t("needsOnline", lang)}</p>}
          <button className="btn-primary h-40 w-full flex-col text-lg" onClick={() => camRef.current?.click()} disabled={!online}>
            <Camera size={44} />
            {t("takePhoto", lang)}
          </button>
          <button className="btn-secondary w-full" onClick={() => galRef.current?.click()} disabled={!online}>
            <ImagePlus size={18} /> {t("fromGallery", lang)}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <img src={preview} alt="" className="max-h-72 w-full border border-line object-cover" />
          {busy && <Spinner label={t("recognising", lang)} />}
          {error && <p className="notice">{error}</p>}

          {result?.seen && !busy && (
            <p className="flex gap-2 text-muted">
              <Eye size={18} className="shrink-0" /> <span><b>{t("iSee", lang)}:</b> {result.seen}</span>
            </p>
          )}

          {result?.status === "ambiguous" && !answer && !busy && (
            <div className="space-y-2">
              <p className="label">{t("isItOneOf", lang)}</p>
              {result.candidates.map((c) => (
                <button key={c.id} className="btn-secondary w-full justify-between" onClick={() => choose(c.id)}>
                  <span>{c.name}</span>
                  <span className="text-sm text-muted">{Math.round(c.confidence * 100)}% {t("confidence", lang)}</span>
                </button>
              ))}
            </div>
          )}

          {result?.status === "unknown" && !busy && <p className="blk blk-unknown">{t("notRecognised", lang)}</p>}

          {answer && result?.poiId && (
            <button className="font-serif text-xl font-bold text-brand underline-offset-4 hover:underline" onClick={() => onOpenPoi(result.poiId!)}>
              {poiName(result.poiId)}
              {result.candidates[0] && result.candidates[0].id === result.poiId && (
                <span className="ml-2 align-middle font-sans text-sm font-normal text-muted">
                  {Math.round(result.candidates[0].confidence * 100)}% {t("confidence", lang)}
                </span>
              )}
            </button>
          )}
          {answer && <AnswerCard answer={answer} lang={lang} onAction={onAction} onOpenPoi={onOpenPoi} poiName={poiName} />}

          {!busy && (
            <button className="btn-secondary w-full" onClick={reset}>
              <RotateCcw size={18} /> {t("tryAgain", lang)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
