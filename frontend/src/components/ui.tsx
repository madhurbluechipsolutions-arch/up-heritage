import { useEffect, useState, type ReactNode } from "react";
import { Square, Volume2, X } from "lucide-react";
import { onSpeakingChange, speak, stopSpeaking } from "../lib/speech";

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-ink/40" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="mx-auto flex max-h-[88dvh] w-full max-w-xl flex-col border-t-4 border-brand bg-paper"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-serif text-lg font-bold">{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

/** Speaker toggle bound to the shared speech state. */
export function SpeakButton({ text, lang, label, stopLabel }: { text: string; lang: string; label: string; stopLabel: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [mine, setMine] = useState(false);
  useEffect(() => onSpeakingChange((s) => { setSpeaking(s); if (!s) setMine(false); }), []);
  const active = speaking && mine;
  return (
    <button
      type="button"
      className="btn-ghost"
      onClick={() => {
        if (active) stopSpeaking();
        else {
          speak(text, lang);
          setMine(true);
        }
      }}
    >
      {active ? <Square size={16} /> : <Volume2 size={16} />}
      <span>{active ? stopLabel : label}</span>
    </button>
  );
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={"chip" + (active ? " chip--on" : "")} aria-pressed={active}>
      {children}
    </button>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-muted" role="status">
      <span className="spinner" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
