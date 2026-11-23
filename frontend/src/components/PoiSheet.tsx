import { useEffect, useState } from "react";
import { Accessibility, Clock3, MessageCircle, Star, X } from "lucide-react";
import { t, tr } from "../lib/i18n";
import { ask } from "../lib/api";
import { photoOf } from "../lib/data";
import { useSettings } from "../lib/settings";
import type { Answer, AnswerBlock, CityBundle, Poi } from "../lib/types";
import AnswerCard, { Block } from "./AnswerCard";
import { Credit, Img, Sheet, Spinner, SpeakButton } from "./ui";

const cap = (s?: string) => (s ? s.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "");

/** Full detail for one point of interest, straight from the sourced content. */
export default function PoiSheet({ poi, city, bundle, onClose, onAsk }: { poi: Poi | null; city: string; bundle?: CityBundle | null; onClose: () => void; onAsk?: (poiId: string) => void }) {
  const { lang, mode } = useSettings();
  const [ai, setAi] = useState<Answer | null>(null);
  const [loading, setLoading] = useState(false);
  const native = lang === "en" || lang === "hi";

  useEffect(() => {
    setAi(null);
    // Content is stored in English and Hindi; for other languages ask the companion to explain.
    if (!poi || native) return;
    setLoading(true);
    ask({ city, question: `Explain ${tr(poi.name, "en")} to me.`, lang, mode, history: [], poiId: poi.id })
      .then(setAi)
      .finally(() => setLoading(false));
  }, [poi, lang, mode, city, native]);

  if (!poi) return null;
  const L = native ? lang : "en";
  const toBlocks = (kind: AnswerBlock["kind"], items?: { source?: string; url?: string; label?: string; note?: unknown }[]): AnswerBlock[] =>
    (items ?? []).map((it) => ({
      kind,
      text: tr(it as never, L),
      sources: it.url ? [{ name: it.source ?? it.url, url: it.url }] : [],
      label: it.label,
      note: it.note ? tr(it.note as never, L) : undefined,
    }));
  const blocks = [
    ...(mode === "pilgrim" ? toBlocks("devotional", poi.devotional) : []),
    ...toBlocks("history", poi.history),
    ...(mode === "quick" ? [] : toBlocks("architecture", poi.architecture)),
    ...toBlocks("folklore", poi.folklore),
    ...(mode === "pilgrim" ? [] : toBlocks("devotional", poi.devotional)),
  ];
  const lead = mode === "kid" && poi.kidsStory ? tr(poi.kidsStory, L) : tr(poi.summary, L);
  const photo = poi.photos?.[0] ?? photoOf(bundle, poi.id);

  return (
    <Sheet open onClose={onClose} title={tr(poi.name, L)} bare>
      <div className="relative h-[46dvh] min-h-[300px] text-white">
        <Img photo={photo} alt={tr(poi.name, "en")} className="absolute inset-0" />
        <div className="absolute inset-0 shade-b" />
        <div className="absolute inset-x-0 top-0 h-24 shade-t" />
        <div className="absolute left-1/2 top-2.5 h-1.5 w-10 -translate-x-1/2 rounded-full bg-white/60" aria-hidden />
        <button className="glass btn-icon absolute right-4 top-4" onClick={onClose} aria-label={t("close", lang)}>
          <X size={18} />
        </button>
        <div className="absolute inset-x-0 bottom-0 p-5">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {poi.priority === 1 && (
              <span className="flex items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-xs font-bold text-white">
                <Star size={12} fill="currentColor" /> {t("mustSee", lang)}
              </span>
            )}
            {poi.tourMinutes ? (
              <span className="glass flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
                <Clock3 size={12} /> {poi.tourMinutes} {t("min", lang)}
              </span>
            ) : null}
            {L === "en" && poi.category && <span className="glass rounded-full px-2.5 py-1 text-xs font-semibold">{cap(poi.category)}</span>}
          </div>
          <h2 className="font-display text-[2rem] font-semibold leading-[1.05]">{tr(poi.name, L)}</h2>
          <Credit photo={photo} className="mt-2 block text-white" />
        </div>
      </div>

      <div className="space-y-4 px-5 pt-5">
        {loading && <Spinner label={t("thinking", lang)} />}
        {ai ? (
          <AnswerCard answer={ai} lang={lang} />
        ) : (
          !loading && (
            <>
              {lead && <p className="font-display text-xl leading-relaxed">{lead}</p>}
              <div className="flex flex-wrap gap-2">
                <SpeakButton text={[lead, ...blocks.map((b) => b.text)].join(" ")} lang={L} label={t("listen", lang)} stopLabel={t("stop", lang)} className="btn btn-sm btn-ink" />
                {onAsk && (
                  <button className="btn btn-sm btn-soft" onClick={() => onAsk(poi.id)}>
                    <MessageCircle size={16} /> {t("ask", lang)}
                  </button>
                )}
              </div>
              <div className="space-y-2.5">
                {(mode === "quick" ? blocks.slice(0, 2) : blocks).map((b, i) => (
                  <Block key={i} b={b} lang={lang} />
                ))}
              </div>
              {poi.accessibility && (
                <p className="blk blk-info flex gap-2.5">
                  <Accessibility size={18} className="mt-0.5 shrink-0 text-brand" /> {tr(poi.accessibility, L)}
                </p>
              )}
            </>
          )
        )}
      </div>
    </Sheet>
  );
}
