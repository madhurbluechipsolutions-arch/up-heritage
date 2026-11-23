import MiniSearch from "minisearch";
import { tr } from "./i18n";
import { loadCity } from "./data";
import type { Answer, AnswerBlock, CityBundle, Mode } from "./types";

export interface Turn {
  role: "user" | "assistant";
  text: string;
}

/* ------------------------------------------------------------ offline answers (no network) */

type Doc = { id: string; text: string; block: AnswerBlock; poiId?: string };
const indexes = new Map<string, MiniSearch<Doc>>();

function buildIndex(city: CityBundle, lang: string): MiniSearch<Doc> {
  const L = lang === "hi" ? "hi" : "en";
  const docs: Doc[] = [];
  for (const p of city.pois) {
    const name = `${tr(p.name, "en")} ${tr(p.name, "hi")}`;
    const add = (kind: AnswerBlock["kind"], items: { source?: string; url?: string; label?: string; note?: unknown }[] | undefined) =>
      items?.forEach((it, i) => {
        const text = tr(it as never, L);
        docs.push({
          id: `${p.id}.${kind}.${i}`,
          text: `${name} ${text}`,
          poiId: p.id,
          block: {
            kind,
            text,
            sources: it.url ? [{ name: it.source ?? it.url, url: it.url }] : [],
            label: it.label,
            note: it.note ? tr(it.note as never, L) : undefined,
            poiIds: [p.id],
          },
        });
      });
    add("history", p.history);
    add("architecture", p.architecture);
    add("folklore", p.folklore);
    add("devotional", p.devotional);
    p.faq?.forEach((f, i) =>
      docs.push({
        id: `${p.id}.faq.${i}`,
        text: `${name} ${tr(f.q, "en")} ${tr(f.q, "hi")} ${tr(f.a, L)}`,
        poiId: p.id,
        block: { kind: "history", text: tr(f.a, L), sources: [], poiIds: [p.id] },
      }),
    );
  }
  const ms = new MiniSearch<Doc>({
    fields: ["text"],
    storeFields: ["block"],
    searchOptions: { fuzzy: 0.2, prefix: true, boost: { text: 1 } },
    tokenize: (s) => s.toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean),
  });
  ms.addAll(docs);
  return ms;
}

export async function offlineAnswer(cityId: string, question: string, lang: string): Promise<Answer> {
  const city = await loadCity(cityId);
  const key = `${cityId}:${lang === "hi" ? "hi" : "en"}`;
  if (!indexes.has(key)) indexes.set(key, buildIndex(city, lang));
  const hits = indexes.get(key)!.search(question).slice(0, 3);
  const blocks = hits.map((h) => (h as unknown as { block: AnswerBlock }).block);
  return {
    grounded: blocks.length > 0,
    blocks: blocks.length
      ? blocks.sort((a, b) => Number(a.kind === "folklore") - Number(b.kind === "folklore"))
      : [{ kind: "unknown", text: "", sources: [] }],
    followups: [],
    action: "none",
    facility: "",
    mode: "offline",
  };
}

/* ------------------------------------------------------------ online */

export async function ask(params: {
  city: string;
  question: string;
  lang: string;
  mode: Mode;
  history: Turn[];
  poiId?: string;
}): Promise<Answer> {
  if (!navigator.onLine) return offlineAnswer(params.city, params.question, params.lang);
  try {
    const r = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!r.ok) throw new Error(String(r.status));
    return (await r.json()) as Answer;
  } catch {
    return offlineAnswer(params.city, params.question, params.lang);
  }
}

export interface VisionResult {
  status: "matched" | "ambiguous" | "unknown" | "unavailable" | "error";
  seen?: string;
  candidates: { id: string; name: string; confidence: number }[];
  poiId?: string | null;
  answer?: Answer | null;
  notice?: string;
}

/** Shrink the photo before upload: faster on weak networks, and plenty for recognition. */
export async function compressImage(file: File, maxSide = 1024): Promise<Blob> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    return file; // format the browser can't decode (e.g. HEIC): send the original, the server checks size
  }
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.82));
}

export async function recognise(params: {
  image: Blob;
  city: string;
  lang: string;
  mode: Mode;
  lat?: number;
  lng?: number;
}): Promise<VisionResult> {
  const fd = new FormData();
  fd.append("image", params.image, params.image.type === "image/jpeg" ? "photo.jpg" : "photo");
  fd.append("city", params.city);
  fd.append("lang", params.lang);
  fd.append("mode", params.mode);
  if (params.lat != null && params.lng != null) {
    fd.append("lat", String(params.lat));
    fd.append("lng", String(params.lng));
  }
  let r: Response;
  try {
    r = await fetch("/api/vision", { method: "POST", body: fd });
  } catch {
    throw new Error("network");
  }
  if (!r.ok) throw new Error(String(r.status));
  try {
    return (await r.json()) as VisionResult;
  } catch {
    throw new Error("network"); // e.g. an HTML error page from a proxy when the backend is down
  }
}

/* ------------------------------------------------------------ offline pack */

const PACK_KEY = "saathi.pack.";

export const isPackDownloaded = (city: string, lang: string) => {
  try {
    return localStorage.getItem(PACK_KEY + city) === (lang === "hi" ? "hi" : "en");
  } catch {
    return false;
  }
};

/** Map tile x/y for a lat/lng at a zoom level (Web Mercator). */
function tileXY(lat: number, lng: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const r = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return { x, y };
}

/**
 * Fetches everything a visit needs into the service-worker caches: content JSON, tour audio in
 * the visitor's language, photos, and the map tiles around the site.
 */
export async function downloadPack(cityId: string, lang: string, onProgress: (pct: number) => void) {
  const city = await loadCity(cityId);
  const L = lang === "hi" ? "hi" : "en";
  const urls = new Set<string>([
    `/data/${cityId}/city.json`,
    `/data/${cityId}/pois.json`,
    `/data/${cityId}/nearby.json`,
    `/data/${cityId}/facilities.geojson`,
    "/data/cities.json",
  ]);
  for (const p of city.pois) {
    urls.add(`/data/${cityId}/audio/${p.id}_${L}.mp3`);
    p.photos?.slice(0, 1).forEach((ph) => urls.add(ph.url));
  }
  // Map: style + vector tiles around the site.
  try {
    const style = await (await fetch(MAP_STYLE)).json();
    const src = Object.values(style.sources as Record<string, { url?: string }>).find((s) => s.url);
    if (src?.url) {
      const tj = await (await fetch(src.url)).json();
      const template: string = tj.tiles[0];
      const [lat, lng] = city.info.center;
      for (let z = 12; z <= Math.min(14, tj.maxzoom ?? 14); z++) {
        const r = z - 11; // a few tiles around the centre at each zoom
        const c = tileXY(lat, lng, z);
        for (let dx = -r; dx <= r; dx++)
          for (let dy = -r; dy <= r; dy++)
            urls.add(template.replace("{z}", String(z)).replace("{x}", String(c.x + dx)).replace("{y}", String(c.y + dy)));
      }
    }
  } catch {
    /* map tiles are best effort */
  }
  const list = [...urls];
  let done = 0;
  const queue = [...list];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const u = queue.shift()!;
        try {
          await fetch(u); // goes through the service worker, which stores it in its cache
        } catch {
          /* missing audio etc. is fine */
        }
        onProgress(Math.round((++done / list.length) * 100));
      }
    }),
  );
  try {
    localStorage.setItem(PACK_KEY + cityId, L);
  } catch {
    /* ignore */
  }
}

export const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
