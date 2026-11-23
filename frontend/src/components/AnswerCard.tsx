import { BookOpen, Building2, ExternalLink, HandHeart, Info, Landmark, MapPin, Route, ScrollText, ShieldAlert, Sparkles, HelpCircle, ArrowUpRight } from "lucide-react";
import { t } from "../lib/i18n";
import type { Answer, AnswerBlock, Photo } from "../lib/types";
import { Img, SpeakButton } from "./ui";

const KIND_STYLE: Record<AnswerBlock["kind"], { cls: string; icon: typeof Landmark }> = {
  history: { cls: "blk-history", icon: Landmark },
  architecture: { cls: "blk-arch", icon: Building2 },
  folklore: { cls: "blk-folk", icon: ScrollText },
  devotional: { cls: "blk-devo", icon: HandHeart },
  info: { cls: "blk-info", icon: Info },
  unknown: { cls: "blk-unknown", icon: HelpCircle },
};

export function Block({ b, lang }: { b: AnswerBlock; lang: string }) {
  const { cls, icon: Icon } = KIND_STYLE[b.kind] ?? KIND_STYLE.info;
  return (
    <section className={`blk ${cls} animate-rise`}>
      <header className="blk-head">
        <span className="blk-icon">
          <Icon size={13} aria-hidden />
        </span>
        <span>{t(`kind_${b.kind}` as never, lang)}</span>
        {b.kind === "folklore" && b.label && <span className="blk-tag">{b.label}</span>}
      </header>
      <p className="blk-text">{b.text || t("notRecognised", lang)}</p>
      {b.kind === "folklore" && (
        <p className="blk-warn">
          <ShieldAlert size={15} className="mt-0.5 shrink-0" aria-hidden /> {b.note || t("folkloreWarn", lang)}
        </p>
      )}
      {b.sources.length > 0 && (
        <p className="blk-src">
          <BookOpen size={13} aria-hidden />
          {b.sources.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noreferrer">
              {s.name} <ExternalLink size={10} aria-hidden />
            </a>
          ))}
        </p>
      )}
    </section>
  );
}

interface Props {
  answer: Answer;
  lang: string;
  onFollowup?: (q: string) => void;
  onAction?: (action: Answer["action"], facility: string) => void;
  onOpenPoi?: (id: string) => void;
  poiName?: (id: string) => string;
  poiPhoto?: (id: string) => Photo | undefined;
}

export default function AnswerCard({ answer, lang, onFollowup, onAction, onOpenPoi, poiName, poiPhoto }: Props) {
  const spoken = answer.blocks.map((b) => b.text).join(" ");
  const poiIds = [...new Set(answer.blocks.flatMap((b) => b.poiIds ?? []))].slice(0, 3);
  const actionLabel: Partial<Record<Answer["action"], { key: Parameters<typeof t>[0]; icon: typeof MapPin }>> = {
    show_facility: { key: "openOnMap", icon: MapPin },
    start_tour: { key: "startTour", icon: Route },
    open_nearby: { key: "openExplore", icon: Sparkles },
    sos: { key: "callHelp", icon: ShieldAlert },
  };
  const act = actionLabel[answer.action];

  return (
    <div className="space-y-2.5">
      {answer.mode !== "ai" && (
        <p className="notice">
          <Info size={16} className="mt-0.5 shrink-0 text-folk" />
          {t(answer.mode === "offline" ? "offlineAnswer" : "basicAnswer", lang)}
        </p>
      )}
      {answer.blocks.map((b, i) => (
        <Block key={i} b={b} lang={lang} />
      ))}

      {poiIds.length > 0 && onOpenPoi && poiName && (
        <div className="snap-row !mx-0 !px-0 pt-1">
          {poiIds.map((id) => (
            <button key={id} className="flex w-56 shrink-0 items-center gap-3 rounded-2xl border border-line bg-surface p-2 pr-3 text-left transition hover:shadow-card" onClick={() => onOpenPoi(id)}>
              <Img photo={poiPhoto?.(id)} className="size-12 shrink-0 rounded-xl" fallback={<Landmark size={18} />} />
              <span className="min-w-0 flex-1 text-sm font-semibold leading-snug line-clamp-2">{poiName(id)}</span>
              <ArrowUpRight size={16} className="shrink-0 text-muted" />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <SpeakButton text={spoken} lang={lang} label={t("listen", lang)} stopLabel={t("stop", lang)} />
        {act && onAction && (
          <button className={"btn btn-sm " + (answer.action === "sos" ? "btn-sos" : "btn-primary")} onClick={() => onAction(answer.action, answer.facility)}>
            <act.icon size={16} /> {t(act.key, lang)}
          </button>
        )}
      </div>
      {answer.followups.length > 0 && onFollowup && (
        <div className="flex flex-wrap gap-2 pt-1">
          {answer.followups.map((f) => (
            <button key={f} className="rounded-2xl border border-brand/25 bg-brand/5 px-3.5 py-2 text-left text-sm font-medium text-brand transition hover:bg-brand/10" onClick={() => onFollowup(f)}>
              {f}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
