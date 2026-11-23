import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, SendHorizontal } from "lucide-react";
import AnswerCard from "../components/AnswerCard";
import { Spinner } from "../components/ui";
import { ask, type Turn } from "../lib/api";
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

export default function AskScreen({ bundle, messages, setMessages, prefill, clearPrefill, onAction, onOpenPoi }: Props) {
  const { city, lang, mode, autoRead } = useSettings();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const poiName = (id: string) => tr(bundle.pois.find((p) => p.id === id)?.name, lang === "hi" ? "hi" : "en") || id;

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
      if (autoRead) speak(answer.blocks.map((b) => b.text).join(" "), answer.mode === "ai" ? lang : lang === "hi" ? "hi" : "en");
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
    .map((f) => tr(f.q, lang === "hi" ? "hi" : "en"));
  const fallback =
    lang === "hi"
      ? ["इसे किसने और क्यों बनवाया?", "दीवारों पर लिखावट का क्या मतलब है?", "यहाँ से जुड़ी कोई लोक-कथा सुनाइए", "पास में शौचालय कहाँ है?"]
      : ["Who built this and why?", "What do the inscriptions mean?", "Tell me a legend about this place", "Where is the nearest toilet?"];

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="border-l-4 border-brand bg-card p-4">
              <p className="font-serif text-xl font-bold">{tr(bundle.info.name, lang === "hi" ? "hi" : "en")}</p>
              <p className="mt-1 leading-relaxed">{t("askIntro", lang)}</p>
            </div>
            <p className="label">{t("tryAsking", lang)}</p>
            <div className="flex flex-col items-start gap-2">
              {(suggestions.length >= 3 ? [...suggestions, fallback[2]] : fallback).map((s) => (
                <button key={s} className="chip text-left" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-10 bg-brand px-4 py-2.5 text-paper">
              {m.text}
            </div>
          ) : (
            <div key={i} className="mr-2">
              {m.answer ? (
                <AnswerCard
                  answer={m.answer}
                  lang={lang}
                  onFollowup={(q) => send(q)}
                  onAction={onAction}
                  onOpenPoi={onOpenPoi}
                  poiName={poiName}
                />
              ) : (
                <p className="text-sos">{m.text}</p>
              )}
            </div>
          ),
        )}
        {busy && <Spinner label={t("thinking", lang)} />}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-center gap-2 border-t border-line bg-paper p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <button
          type="button"
          onClick={toggleMic}
          className={"btn-icon-lg " + (listening ? "bg-sos text-paper" : "bg-card")}
          aria-label={listening ? t("stop", lang) : "Speak"}
        >
          {listening ? <MicOff size={22} /> : <Mic size={22} />}
        </button>
        <input
          value={listening ? t("listening", lang) : input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("askPlaceholder", lang)}
          className="input flex-1"
          disabled={listening}
          enterKeyHint="send"
        />
        <button type="submit" className="btn-icon-lg bg-brand text-paper" disabled={!input.trim() || busy} aria-label="Send">
          <SendHorizontal size={22} />
        </button>
      </form>
    </div>
  );
}
