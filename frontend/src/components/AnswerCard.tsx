import { BookOpen, Building2, ExternalLink, HandHeart, Info, Landmark, MapPin, Route, ScrollText, ShieldAlert, Sparkles, HelpCircle } from "lucide-react";
import { t } from "../lib/i18n";
import type { Answer, AnswerBlock } from "../lib/types";
import { SpeakButton } from "./ui";

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
    <section className={`blk ${cls}`}>
      <header className="blk-head">
        <Icon size={16} aria-hidden />
        <span>{t(`kind_${b.kind}` as never, lang)}</span>
        {b.kind === "folklore" && b.label && <span className="blk-tag">{b.label}</span>}
      </header>
      <p className="blk-text">{b.text || t("notRecognised", lang)}</p>
      {b.kind === "folklore" && (
        <p className="blk-warn">
          <ShieldAlert size={14} aria-hidden /> {b.note || t("folkloreWarn", lang)}
        </p>
      )}
      {b.sources.length > 0 && (
        <p className="blk-src">
          <BookOpen size={13} aria-hidden />
          {b.sources.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noreferrer">
              {s.name} <ExternalLink size={11} aria-hidden />
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
}

export default function AnswerCard({ answer, lang, onFollowup, onAction, onOpenPoi, poiName }: Props) {
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
    <div className="space-y-2">
      {answer.mode !== "ai" && (
        <p className="notice">{t(answer.mode === "offline" ? "offlineAnswer" : "basicAnswer", lang)}</p>
      )}
      {answer.blocks.map((b, i) => (
        <Block key={i} b={b} lang={lang} />
      ))}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <SpeakButton text={spoken} lang={lang} label={t("listen", lang)} stopLabel={t("stop", lang)} />
        {act && onAction && (
          <button className={answer.action === "sos" ? "btn-sos-sm" : "btn-primary-sm"} onClick={() => onAction(answer.action, answer.facility)}>
            <act.icon size={16} /> {t(act.key, lang)}
          </button>
        )}
        {poiIds.map((id) =>
          onOpenPoi && poiName ? (
            <button key={id} className="btn-ghost" onClick={() => onOpenPoi(id)}>
              <Landmark size={15} /> {poiName(id)}
            </button>
          ) : null,
        )}
      </div>
      {answer.followups.length > 0 && onFollowup && (
        <div className="flex flex-wrap gap-2 pt-1">
          {answer.followups.map((f) => (
            <button key={f} className="chip" onClick={() => onFollowup(f)}>
              {f}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
