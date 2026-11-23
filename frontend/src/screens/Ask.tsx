import { useEffect, useRef, useState } from "react";
import { ArrowUp, BadgeCheck, Mic, MicOff, Sparkles } from "lucide-react";
import AnswerCard from "../components/AnswerCard";
import { Img, Spinner } from "../components/ui";
import { ask, type Turn } from "../lib/api";
import { photoOf } from "../lib/data";
import { t, tr } from "../lib/i18n";
import { useSettings } from "../lib/settings";
import { listen, speak } from "../lib/speech";
import type { Answer, CityBundle } from "../lib/types";

export interface ChatMsg {
  role: "user" | "assistant";
  text: string;
  answer?: Answer;
}

interface Props {
  bundle: CityBundle;
  messages: ChatMsg[];
  setMessages: (fn: (m: ChatMsg[]) => ChatMsg[]) => void;
  prefill: { question: string; poiId?: string } | null;
  clearPrefill: () => void;
  onAction: (action: Answer["action"], facility: string) => void;
  onOpenPoi: (id: string) => void;
}

function Avatar() {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-on-brand shadow-card">
      <Sparkles size={15} />
    </span>
  );
}

export default function AskScreen({ bundle, messages, setMessages, prefill, clearPrefill, onAction, onOpenPoi }: Props) {
  const { city, lang, mode, autoRead } = useSettings();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const L = lang === "hi" ? "hi" : "en";

  const poiName = (id: string) => tr(bundle.pois.find((p) => p.id === id)?.name, L) || id;
  const poiPhoto = (id: string) => photoOf(bundle, id);

  async function send(question: string, poiId?: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    const history: Turn[] = messages.slice(-6).map((m) => ({ role: m.role, text: m.answer ? m.answer.blocks.map((b) => b.text).join(" ") : m.text }));
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const answer = await ask({ city, question: q, lang, mode, history, poiId });
      setMessages((m) => [...m, { role: "assistant", text: "", answer }]);
      if (autoRead) speak(answer.blocks.map((b) => b.text).join(" "), answer.mode === "ai" ? lang : L);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: t("error", lang) }]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (prefill) {
      send(prefill.question, prefill.poiId);
      clearPrefill();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); // newer browsers return a Promise here; never return it to React
  }, [messages, busy]);

  function toggleMic() {
    if (listening) {
      stopRef.current?.();
      return;
    }
    setListening(true);
    stopRef.current = listen(
      lang,
      (text) => send(text),
      () => setListening(false),
      () => setListening(false),
    );
  }

  const suggestions = bundle.pois
    .flatMap((p) => p.faq ?? [])
    .slice(0, 4)
    .map((f) => tr(f.q, L));
  const fallback =
    lang === "hi"
      ? ["इसे किसने और क्यों बनवाया?", "दीवारों पर लिखावट का क्या मतलब है?", "यहाँ से जुड़ी कोई लोक-कथा सुनाइए", "पास में शौचालय कहाँ है?"]
      : ["Who built this and why?", "What do the inscriptions mean?", "Tell me a legend about this place", "Where is the nearest toilet?"];
  const prompts = suggestions.length >= 3 ? [...suggestions, fallback[2]] : fallback;
  const cover = bundle.info.cover;

  return (
    <div className="flex h-full flex-col">
      <div className="no-scrollbar flex-1 space-y-5 overflow-y-auto px-4 pb-4 pt-4">
        {messages.length === 0 && (
          <div className="space-y-5 animate-rise">
            <div className="relative overflow-hidden rounded-[1.75rem] text-white shadow-card">
              <Img photo={cover} alt="" className="absolute inset-0" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />
              <div className="relative flex min-h-56 flex-col justify-end p-5">
                <span className="glass mb-auto flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
                  <BadgeCheck size={13} /> {t("verified", lang)}
                </span>
                <p className="mt-10 font-display text-3xl font-semibold leading-tight">{t("appTag", lang)}</p>
                <p className="mt-1.5 leading-relaxed text-white/85">{t("askIntro", lang)}</p>
              </div>
            </div>
            <div>
              <p className="eyebrow mb-2.5">{t("tryAsking", lang)}</p>
              <div className="grid gap-2">
                {prompts.map((s, i) => (
                  <button
                    key={s}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left text-[0.95rem] font-medium transition hover:border-brand/40 hover:shadow-card active:scale-[0.99] animate-rise"
                    style={{ animationDelay: `${i * 50}ms` }}
                    onClick={() => send(s)}
                  >
                    <Sparkles size={16} className="shrink-0 text-brand" />
                    <span className="flex-1">{s}</span>
                    <ArrowUp size={16} className="shrink-0 rotate-45 text-muted" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end animate-rise">
              <p className="max-w-[85%] rounded-3xl rounded-br-lg bg-ink px-4 py-2.5 text-paper">{m.text}</p>
            </div>
          ) : (
            <div key={i} className="flex gap-2.5">
              <Avatar />
              <div className="min-w-0 flex-1">
                {m.answer ? (
                  <AnswerCard answer={m.answer} lang={lang} onFollowup={(q) => send(q)} onAction={onAction} onOpenPoi={onOpenPoi} poiName={poiName} poiPhoto={poiPhoto} />
                ) : (
                  <p className="rounded-2xl bg-sos/10 px-4 py-3 text-sos">{m.text}</p>
                )}
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="flex items-center gap-2.5">
            <Avatar />
            <div className="rounded-3xl rounded-tl-lg bg-surface px-4 py-3 shadow-card">
              <Spinner label={t("thinking", lang)} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="px-4 pb-[calc(env(safe-area-inset-bottom)+6.25rem)] pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className={"flex items-center gap-1.5 rounded-full border bg-surface p-1.5 shadow-card transition " + (listening ? "border-sos ring-4 ring-sos/15" : "border-line focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15")}>
          <button
            type="button"
            onClick={toggleMic}
            className={"btn-icon size-11 " + (listening ? "animate-pulse bg-sos text-white" : "bg-sunk text-ink hover:text-brand")}
            aria-label={listening ? t("stop", lang) : "Speak"}
          >
            {listening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <input
            value={listening ? t("listening", lang) : input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("askPlaceholder", lang)}
            className="h-11 min-w-0 flex-1 bg-transparent px-2 text-base outline-none placeholder:text-muted"
            disabled={listening}
            enterKeyHint="send"
          />
          <button type="submit" className="btn-icon size-11 bg-brand text-on-brand disabled:bg-sunk disabled:text-muted disabled:opacity-100" disabled={!input.trim() || busy} aria-label="Send">
            <ArrowUp size={20} strokeWidth={2.5} />
          </button>
        </div>
      </form>
    </div>
  );
}
