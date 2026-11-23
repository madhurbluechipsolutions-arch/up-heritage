import { speechLang } from "./i18n";

/* ------------------------------------------------------------------ speaking (TTS) */

let current: HTMLAudioElement | null = null;
const listeners = new Set<(speaking: boolean) => void>();
const emit = (v: boolean) => listeners.forEach((l) => l(v));

export function onSpeakingChange(cb: (speaking: boolean) => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function stopSpeaking() {
  if (current) {
    current.pause();
    current = null;
  }
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  emit(false);
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const want = speechLang(lang).toLowerCase();
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.toLowerCase() === want) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(want.slice(0, 2)))
  );
}

/** Read text aloud with the device voice. */
export function speak(text: string, lang: string) {
  stopSpeaking();
  if (!("speechSynthesis" in window) || !text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = speechLang(lang);
  const v = pickVoice(lang);
  if (v) u.voice = v;
  u.rate = 0.95;
  u.onend = () => emit(false);
  u.onerror = () => emit(false);
  emit(true);
  speechSynthesis.speak(u);
}

/** Play a pre-generated MP3 (natural voice, works offline once cached); falls back to TTS. */
export function playAudio(url: string, fallbackText: string, lang: string, onEnd?: () => void) {
  stopSpeaking();
  const a = new Audio(url);
  current = a;
  a.onended = () => {
    emit(false);
    onEnd?.();
  };
  a.onerror = () => {
    if (current === a) speak(fallbackText, lang);
  };
  emit(true);
  a.play().catch(() => {
    if (current === a) speak(fallbackText, lang);
  });
}

/* ------------------------------------------------------------------ listening (STT) */

type Rec = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: (e: { error: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

const SR: (new () => Rec) | undefined =
  (window as unknown as { SpeechRecognition?: new () => Rec }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition;

export const hasNativeSpeech = Boolean(SR);

/**
 * Listen for one spoken question. Uses the browser's speech recognition when available
 * (Chrome/Android), otherwise records a few seconds and sends it to /api/transcribe.
 * Returns a stop() function.
 */
export function listen(
  lang: string,
  onText: (text: string) => void,
  onDone: () => void,
  onError: (msg: string) => void,
): () => void {
  if (SR) {
    const rec = new SR();
    rec.lang = speechLang(lang);
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => onText(e.results[0][0].transcript);
    rec.onerror = (e) => onError(e.error);
    rec.onend = onDone;
    rec.start();
    return () => rec.stop();
  }

  let stopped = false;
  let recorder: MediaRecorder | null = null;
  navigator.mediaDevices
    ?.getUserMedia({ audio: true })
    .then((stream) => {
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        onDone();
        return;
      }
      const chunks: Blob[] = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        try {
          const blob = new Blob(chunks, { type: recorder?.mimeType || "audio/webm" });
          const fd = new FormData();
          fd.append("audio", blob, "question.webm");
          fd.append("lang", lang);
          const r = await fetch("/api/transcribe", { method: "POST", body: fd });
          if (!r.ok) throw new Error(await r.text());
          const { text } = await r.json();
          if (text) onText(text);
        } catch {
          onError("transcribe-failed");
        } finally {
          onDone();
        }
      };
      recorder.start();
      setTimeout(() => recorder?.state === "recording" && recorder.stop(), 7000);
    })
    .catch(() => {
      onError("mic-denied");
      onDone();
    });
  return () => {
    stopped = true;
    if (recorder?.state === "recording") recorder.stop();
  };
}
