import { useEffect, useState } from "react";
import { Accessibility, MessageCircle } from "lucide-react";
import { t, tr } from "../lib/i18n";
import { ask } from "../lib/api";
import { useSettings } from "../lib/settings";
import type { Answer, AnswerBlock, Poi } from "../lib/types";
import AnswerCard, { Block } from "./AnswerCard";
import { Sheet, Spinner, SpeakButton } from "./ui";

/** Full detail for one point of interest, straight from the sourced content. */
export default function PoiSheet({ poi, city, onClose, onAsk }: { poi: Poi | null; city: string; onClose: () => void; onAsk?: (poiId: string) => void }) {
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
  const photo = poi.photos?.[0];

  return (
    <Sheet open onClose={onClose} title={tr(poi.name, L)}>
      {photo && (
        <figure className="-mx-4 -mt-4 mb-3">
          <img src={photo.url} alt={tr(poi.name, "en")} className="h-52 w-full object-cover" loading="lazy" />
          <figcaption className="px-4 pt-1 text-xs text-muted">
            <a href={photo.page ?? photo.url} target="_blank" rel="noreferrer">
              {photo.credit} · {photo.license}
            </a>
          </figcaption>
        </figure>
      )}
      {loading && <Spinner label={t("thinking", lang)} />}
      {ai ? (
        <AnswerCard answer={ai} lang={lang} />
      ) : (
        !loading && (
          <div className="space-y-2">
            {lead && <p className="text-lg leading-relaxed">{lead}</p>}
            <div className="flex flex-wrap gap-2">
              <SpeakButton text={[lead, ...blocks.map((b) => b.text)].join(" ")} lang={L} label={t("listen", lang)} stopLabel={t("stop", lang)} />
              {onAsk && (
                <button className="btn-ghost" onClick={() => onAsk(poi.id)}>
                  <MessageCircle size={16} /> {t("ask", lang)}
                </button>
              )}
            </div>
            {(mode === "quick" ? blocks.slice(0, 2) : blocks).map((b, i) => (
              <Block key={i} b={b} lang={lang} />
            ))}
            {poi.accessibility && (
              <p className="blk blk-info flex gap-2">
                <Accessibility size={18} className="shrink-0" /> {tr(poi.accessibility, L)}
              </p>
            )}
          </div>
        )
      )}
    </Sheet>
  );
}
