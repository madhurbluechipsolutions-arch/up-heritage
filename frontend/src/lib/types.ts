export type L10n = { en: string; hi?: string; [k: string]: string | undefined };

export type Sourced = { en: string; hi?: string; source?: string; url?: string };

export type Folklore = Sourced & { label?: string; note?: L10n };

export interface Poi {
  id: string;
  site?: string;
  category?: string;
  name: L10n;
  lat: number;
  lng: number;
  tourOrder?: number;
  tourMinutes?: number;
  priority?: number;
  summary?: L10n;
  history?: Sourced[];
  architecture?: Sourced[];
  folklore?: Folklore[];
  devotional?: Sourced[];
  kidsStory?: L10n;
  visualCues?: string;
  accessibility?: L10n;
  faq?: { q: L10n; a: L10n }[];
  photos?: { url: string; credit?: string; license?: string; page?: string }[];
}

export interface NearbyItem {
  id: string;
  type: string;
  odop?: boolean;
  name: L10n;
  lat?: number;
  lng?: number;
  description?: L10n;
  interests?: string[];
  budget?: string;
  goodFor?: string[];
  durationHours?: number;
  timings?: L10n;
  entryFee?: L10n;
  howToReach?: L10n;
  when?: string;
  source?: string;
  url?: string;
}

export interface Helpline {
  id: string;
  name: L10n;
  number: string;
}

export interface CityInfo {
  id: string;
  name: L10n;
  tagline?: L10n;
  center: [number, number];
  zoom?: number;
  mainSite?: {
    id: string;
    name: L10n;
    timings?: L10n;
    closedOn?: L10n;
    entryFee?: L10n;
    source?: string;
    url?: string;
  };
  helplines?: Helpline[];
}

export interface CityListItem {
  id: string;
  name: L10n;
  depth?: "full" | "lite";
}

export interface Facility {
  id: string;
  type: string;
  name: string;
  lat: number;
  lng: number;
  timings?: string;
  phone?: string;
  synthetic?: boolean;
  source?: string;
}

export interface CityBundle {
  info: CityInfo;
  pois: Poi[];
  nearby: NearbyItem[];
  facilities: Facility[];
}

export interface AnswerBlock {
  kind: "history" | "architecture" | "folklore" | "devotional" | "info" | "unknown";
  text: string;
  sources: { name: string; url: string }[];
  label?: string;
  note?: string;
  poiIds?: string[];
}

export interface Answer {
  grounded: boolean;
  blocks: AnswerBlock[];
  followups: string[];
  action: "none" | "show_facility" | "start_tour" | "open_nearby" | "sos";
  facility: string;
  mode: "ai" | "basic" | "offline";
  notice?: string;
}

export type Mode = "standard" | "kid" | "quick" | "scholar" | "pilgrim";
export type Tab = "ask" | "lens" | "tour" | "explore" | "help";
