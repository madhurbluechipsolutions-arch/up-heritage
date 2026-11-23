import { useSyncExternalStore } from "react";
import type { Mode } from "./types";

export interface Settings {
  city: string;
  lang: string;
  mode: Mode;
  largeText: boolean;
  autoRead: boolean;
  onboarded: boolean;
}

const KEY = "saathi.settings.v1";

const defaults: Settings = {
  city: "agra",
  lang: navigator.language?.startsWith("hi") ? "hi" : "en",
  mode: "standard",
  largeText: false,
  autoRead: false,
  onboarded: false,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    /* storage blocked: fall back to defaults */
  }
  return defaults;
}

let state: Settings = load();
const listeners = new Set<() => void>();

export function setSettings(patch: Partial<Settings>) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

export const getSettings = () => state;
