import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, ImageOff, Square, Volume2, X } from "lucide-react";
import { onSpeakingChange, speak, stopSpeaking } from "../lib/speech";
import type { Photo } from "../lib/types";

/** Bottom sheet: slides up, rounded, with a grab handle. `bare` lets the content draw its own header (e.g. a hero photo). */
export function Sheet({ open, onClose, title, children, bare }: { open: boolean; onClose: () => void; title: string; children: ReactNode; bare?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/45 backdrop-blur-[2px] animate-fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] bg-paper shadow-float animate-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        {bare ? (
          <div className="no-scrollbar overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">{children}</div>
        ) : (
          <>
            <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-ink/15" aria-hidden />
            <div className="flex items-center justify-between px-5 pb-2 pt-3">
              <h2 className="font-display text-2xl font-semibold">{title}</h2>
              <button className="btn-icon bg-sunk" onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="no-scrollbar overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-2">{children}</div>
          </>
        )}
      </div>
    </div>
  );
}

/** A photo that fades in when loaded and falls back to a soft gradient if it is missing or fails. */
export function Img({ photo, src, alt = "", className = "", fallback }: { photo?: Photo | null; src?: string; alt?: string; className?: string; fallback?: ReactNode }) {
  const url = src ?? photo?.url;
  // Track which URL loaded/failed, so a cached image that loads before effects run is never reset to "loading".
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const state: "loading" | "ok" | "err" = !url || failed === url ? "err" : loaded === url ? "ok" : "loading";
  const setState = (s: "ok" | "err") => (s === "ok" ? setLoaded(url ?? null) : setFailed(url ?? null));
  return (
    <div className={(/\babsolute\b/.test(className) ? "" : "relative ") + "overflow-hidden bg-sunk " + className}>
      {state !== "ok" && (
        <div className={"absolute inset-0 grid place-items-center " + (state === "loading" ? "skeleton" : "bg-gradient-to-br from-[color-mix(in_srgb,var(--c-brand)_28%,var(--c-sunk))] to-sunk text-ink/30")}>
          {state === "err" && (fallback ?? <ImageOff size={28} />)}
        </div>
      )}
      {url && state !== "err" && (
        <img
          ref={(el) => {
            if (el?.complete && el.naturalWidth > 0 && loaded !== url) setLoaded(url);
          }}
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setState("ok")}
          onError={() => setState("err")}
          className={"absolute inset-0 size-full object-cover transition-opacity duration-700 " + (state === "ok" ? "opacity-100" : "opacity-0")}
        />
      )}
    </div>
  );
}

/** Small attribution line, required by the CC licences of the photos. */
export function Credit({ photo, className = "" }: { photo?: Photo | null; className?: string }) {
  if (!photo?.credit) return null;
  return (
    <a href={photo.page ?? photo.url} target="_blank" rel="noreferrer" className={"truncate text-[0.65rem] no-underline opacity-75 hover:opacity-100 " + className} onClick={(e) => e.stopPropagation()}>
      © {photo.credit}
      {photo.license ? ` · ${photo.license}` : ""}
    </a>
  );
}

/** Speaker toggle bound to the shared speech state. */
export function SpeakButton({ text, lang, label, stopLabel, className = "btn btn-sm btn-soft" }: { text: string; lang: string; label: string; stopLabel: string; className?: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [mine, setMine] = useState(false);
  useEffect(() => onSpeakingChange((s) => { setSpeaking(s); if (!s) setMine(false); }), []);
  const active = speaking && mine;
  return (
    <button
      type="button"
      className={className + (active ? " !bg-brand !text-on-brand" : "")}
      onClick={() => {
        if (active) stopSpeaking();
        else {
          speak(text, lang);
          setMine(true);
        }
      }}
    >
      {active ? <Square size={14} fill="currentColor" /> : <Volume2 size={16} />}
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

/** iOS-style segmented control. */
export function Segmented<T extends string | number>({ value, options, onChange, className = "" }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={"flex rounded-full bg-sunk p-1 " + className} role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={
            "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold whitespace-nowrap transition " +
            (value === o.value ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SectionHeader({ title, eyebrow, action, onAction }: { title: string; eyebrow?: string; action?: string; onAction?: () => void }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h2 className="section-title">{title}</h2>
      </div>
      {action && onAction && (
        <button className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-brand" onClick={onAction}>
          {action} <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted" role="status">
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2 animate-bounce rounded-full bg-brand" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
      <span>{label}</span>
    </div>
  );
}
