"""Loads the per-city content folders and turns them into a citable knowledge base.

Every fact gets a stable id (e.g. ``great-gate.h1``). The LLM must cite these ids, and the
backend only keeps answer blocks whose citations really exist - so a source shown to the visitor
is always a real one from our data, never one the model invented.
"""
from __future__ import annotations

import json
import re
import threading
from dataclasses import dataclass, field
from pathlib import Path

from .config import DATA_DIR

KIND_PREFIX = {"history": "h", "architecture": "a", "folklore": "f", "devotional": "d"}


@dataclass
class Fact:
    id: str
    kind: str          # history | architecture | folklore | devotional | info
    poi_id: str | None
    text: dict         # {"en": ..., "hi": ...}
    source: str
    url: str
    label: str | None = None   # folklore label, e.g. "legend"
    note: dict | None = None   # folklore note


@dataclass
class City:
    id: str
    info: dict
    pois: list[dict]
    nearby: list[dict]
    facts: dict[str, Fact] = field(default_factory=dict)
    kb_text: str = ""


def _read_json(path: Path, default):
    if not path.exists():
        return default
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _t(d, lang="en") -> str:
    if isinstance(d, str):
        return d
    if not isinstance(d, dict):
        return ""
    return d.get(lang) or d.get("en") or next(iter(d.values()), "")


def _build_city(city_id: str) -> City:
    folder = DATA_DIR / city_id
    info = _read_json(folder / "city.json", {"id": city_id, "name": {"en": city_id}})
    pois = _read_json(folder / "pois.json", [])
    nearby = _read_json(folder / "nearby.json", [])
    city = City(id=city_id, info=info, pois=pois, nearby=nearby)

    lines: list[str] = []
    site = info.get("mainSite") or {}
    if site:
        fid = "city.site"
        txt = {
            lang: " ".join(
                p for p in [
                    _t(site.get("name"), lang),
                    "Timings: " + _t(site.get("timings"), lang) if site.get("timings") else "",
                    "Closed: " + _t(site.get("closedOn"), lang) if site.get("closedOn") else "",
                    "Entry fee: " + _t(site.get("entryFee"), lang) if site.get("entryFee") else "",
                ] if p
            )
            for lang in ("en", "hi")
        }
        city.facts[fid] = Fact(fid, "info", None, txt, site.get("source", ""), site.get("url", ""))
        lines.append(f"## Visiting info\n[{fid}] {txt['en']}")

    for poi in pois:
        pid = poi["id"]
        lines.append(f"\n## POI {pid}: {_t(poi.get('name'))} (category: {poi.get('category', '')})")
        if poi.get("summary"):
            lines.append(f"Summary: {_t(poi['summary'])}")
        for kind, prefix in KIND_PREFIX.items():
            for i, item in enumerate(poi.get(kind) or [], start=1):
                fid = f"{pid}.{prefix}{i}"
                text = {k: v for k, v in item.items() if k in ("en", "hi")}
                city.facts[fid] = Fact(
                    fid, kind, pid, text, item.get("source", ""), item.get("url", ""),
                    item.get("label"), item.get("note"),
                )
                tag = kind.upper()
                if kind == "folklore":
                    tag += f" ({item.get('label', 'folklore')})"
                lines.append(f"[{fid}] {tag}: {_t(text)}")
        if poi.get("accessibility"):
            lines.append(f"Accessibility: {_t(poi['accessibility'])}")
        if poi.get("kidsStory"):
            lines.append(f"Kids story (uses only facts above): {_t(poi['kidsStory'])}")

    if nearby:
        lines.append("\n## Nearby attractions and experiences")
    for item in nearby:
        fid = f"near.{item['id']}"
        parts = [
            _t(item.get("name")),
            f"({item.get('type', '')}{', ODOP product' if item.get('odop') else ''})",
            _t(item.get("description")),
            "Timings: " + _t(item.get("timings")) if item.get("timings") else "",
            "Entry: " + _t(item.get("entryFee")) if item.get("entryFee") else "",
            "How to reach: " + _t(item.get("howToReach")) if item.get("howToReach") else "",
            "When: " + item["when"] if item.get("when") else "",
        ]
        txt_en = " ".join(p for p in parts if p)
        city.facts[fid] = Fact(fid, "info", None, {"en": txt_en}, item.get("source", ""), item.get("url", ""))
        lines.append(f"[{fid}] {txt_en}")

    city.kb_text = "\n".join(lines)
    return city


class ContentStore:
    """Caches cities and reloads a city when any of its files change (handy while editing data)."""

    def __init__(self):
        self._lock = threading.Lock()
        self._cache: dict[str, tuple[float, City]] = {}

    def cities(self) -> list[dict]:
        return _read_json(DATA_DIR / "cities.json", [])

    def _mtime(self, city_id: str) -> float:
        folder = DATA_DIR / city_id
        return max((p.stat().st_mtime for p in folder.glob("*.json")), default=0.0)

    def get(self, city_id: str) -> City | None:
        if not re.fullmatch(r"[a-z0-9-]+", city_id or "") or not (DATA_DIR / city_id).is_dir():
            return None
        mtime = self._mtime(city_id)
        with self._lock:
            hit = self._cache.get(city_id)
            if hit and hit[0] == mtime:
                return hit[1]
            city = _build_city(city_id)
            self._cache[city_id] = (mtime, city)
            return city


store = ContentStore()

# ---------------------------------------------------------------- local (no-LLM) retrieval

_WORD = re.compile(r"[\wऀ-ॿ]+", re.UNICODE)
_STOP = set("the a an is are was were of to in on and or what who why how when where this that it its "
            "me tell about did does do for with by from be i you can have has had their there they them "
            "off out up any some please my we our will would could should here also than then into "
            "kya hai ka ki ke ko mein me se ye yeh kaun kab kyun kaise "
            "है का की के को में से यह ये क्या कौन कब क्यों कैसे और भी था थी थे".split())


def _stem(w: str) -> str:
    """Tiny English stemmer so 'hands'/'hand', 'carved'/'carving' meet."""
    for suf in ("ings", "ing", "ies", "es", "ed", "s"):
        if w.isascii() and w.endswith(suf) and len(w) - len(suf) >= 3:
            return w[: -len(suf)]
    return w


def _tokens(s: str) -> set[str]:
    return {_stem(w) for w in (m.lower() for m in _WORD.findall(s or "")) if w not in _STOP and len(w) > 1}


def local_search(city: City, question: str, poi_id: str | None = None, limit: int = 4) -> list[Fact]:
    """Plain keyword overlap over every fact, POI names and FAQ. Used when no LLM is reachable."""
    q = _tokens(question)
    wants_story = bool(re.search(r"legend|myth|story|stories|folklore|believe|kahani|kissa|कहानी|कथा|किस्सा|मान्यता", question, re.I))
    names = {p["id"]: _tokens(_t(p.get("name"), "en") + " " + _t(p.get("name"), "hi")) for p in city.pois}
    scored = []
    for fact in city.facts.values():
        words = _tokens(" ".join(fact.text.values()))
        score = len(q & words)
        if fact.id == "city.site" and score < 2:
            score = 0  # long visiting-info text matches everything weakly; only show it when clearly asked
        if score and wants_story and fact.kind == "folklore":
            score += 2
        if fact.poi_id:
            score += 2 * len(q & names.get(fact.poi_id, set()))
            if poi_id and fact.poi_id == poi_id:
                score += 3
        if score:
            scored.append((score, fact))
    scored.sort(key=lambda x: -x[0])
    return [f for _, f in scored[:limit]]
