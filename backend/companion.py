"""The companion's two brains: answering questions (UC-1/3/7) and recognising photos (UC-2).

Guardrails, in order:
1. The model sees only our sourced content, each fact tagged with an id.
2. It must cite those ids per block; blocks citing nothing real are dropped here, in code.
3. A block that cites only folklore is always shown as folklore, whatever the model labelled it.
4. Photo recognition is closed-set: the model may only pick from this city's POI list.
"""
from __future__ import annotations

import json
import time
from collections import OrderedDict

from . import config, llm
from .content import City, Fact, _t, local_search

LANG_NAMES = {
    "en": "English", "hi": "Hindi (Devanagari script)", "ur": "Urdu", "bn": "Bengali",
    "mr": "Marathi", "ta": "Tamil", "te": "Telugu", "gu": "Gujarati", "pa": "Punjabi",
    "kn": "Kannada", "ml": "Malayalam", "or": "Odia", "fr": "French", "es": "Spanish",
    "de": "German", "it": "Italian", "ru": "Russian", "ja": "Japanese", "zh": "Simplified Chinese",
    "ko": "Korean", "ar": "Arabic", "pt": "Portuguese",
}

MODE_STYLE = {
    "kid": "Story mode for a 7-year-old child: warm, playful, very short sentences, simple words, "
           "at most 80 words in total. Still only true facts from the knowledge.",
    "quick": "Short version for a visitor in a hurry: at most 2 blocks and 50 words in total.",
    "standard": "Clear, friendly, simple language. Around 120 words in total.",
    "scholar": "Detailed version for history and architecture lovers: names, dates, materials, "
               "techniques, up to 250 words in total. Use every relevant fact.",
    "pilgrim": "Respectful devotional context for pilgrims: lead with spiritual and religious "
               "significance where the knowledge has DEVOTIONAL facts, otherwise answer normally "
               "and reverently. Around 120 words.",
}

FACILITIES = ["toilet", "parking", "water", "hospital", "clinic", "police", "helpdesk", "food",
              "atm", "ramp", "rest", "wheelchair"]

ASK_SCHEMA = {
    "type": "object",
    "properties": {
        "grounded": {"type": "boolean"},
        "blocks": {"type": "array", "items": {
            "type": "object",
            "properties": {
                "kind": {"type": "string", "enum": ["history", "architecture", "folklore",
                                                     "devotional", "info", "unknown"]},
                "text": {"type": "string"},
                "cites": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["kind", "text", "cites"],
        }},
        "followups": {"type": "array", "items": {"type": "string"}},
        "action": {"type": "string", "enum": ["none", "show_facility", "start_tour",
                                              "open_nearby", "sos"]},
        "facility": {"type": "string", "enum": ["none"] + FACILITIES},  # Gemini rejects "" in enums
    },
    "required": ["grounded", "blocks", "followups", "action", "facility"],
}

VISION_SCHEMA = {
    "type": "object",
    "properties": {
        "isHeritagePhoto": {"type": "boolean"},
        "seen": {"type": "string"},
        "matches": {"type": "array", "items": {
            "type": "object",
            "properties": {"id": {"type": "string"}, "confidence": {"type": "number"}},
            "required": ["id", "confidence"],
        }},
    },
    "required": ["isHeritagePhoto", "seen", "matches"],
}

NOT_FOUND = {
    "en": "I don't have verified information about that yet, so I won't guess. "
          "You can ask me about the history, architecture or stories of this place.",
    "hi": "इस बारे में मेरे पास अभी सत्यापित जानकारी नहीं है, इसलिए मैं अनुमान नहीं लगाऊँगा। "
          "आप इस जगह के इतिहास, वास्तुकला या कहानियों के बारे में पूछ सकते हैं।",
}


ACTION_TEXT = {
    "show_facility": {"en": "Here are the nearest ones on the map, with walking distance and directions.",
                      "hi": "सबसे नज़दीकी जगहें मैप पर देखिए — पैदल दूरी और रास्ते के साथ।"},
    "sos": {"en": "For an emergency call 112 (police, fire, ambulance) or 108 (ambulance). Tap the button for all helplines and to share your location.",
            "hi": "आपातकाल में 112 (पुलिस, फ़ायर, एम्बुलेंस) या 108 (एम्बुलेंस) पर कॉल करें। सभी हेल्पलाइन और अपनी लोकेशन भेजने के लिए बटन दबाएँ।"},
    "start_tour": {"en": "Let's start your walking tour — pick how much time you have.",
                   "hi": "चलिए पैदल टूर शुरू करते हैं — बताइए आपके पास कितना समय है।"},
}


def _system_prompt(city: City, lang: str, mode: str) -> str:
    name = _t(city.info.get("name"))
    return f"""You are "Saathi", a friendly, knowledgeable heritage companion for visitors to {name}, \
Uttar Pradesh, India, built for the UP Tourism department.

STRICT RULES
1. Use ONLY the KNOWLEDGE below. Every fact has an id in square brackets, e.g. [great-gate.h1].
   Never add facts, names, dates, numbers or stories from your own memory.
2. Split the answer into blocks. Each block lists in "cites" the exact ids it is based on.
   - kind "history" / "architecture": only from HISTORY / ARCHITECTURE facts.
   - kind "folklore": only from FOLKLORE facts. The text must clearly say it is a legend,
     belief or tradition (e.g. "Local legend says...", "It is popularly believed...").
     Never present folklore as recorded history.
   - kind "devotional": only from DEVOTIONAL facts.
   - kind "info": practical information (timings, fees, nearby places, helplines).
   When folklore exists that is relevant, add it as a separate block AFTER the history.
3. If the KNOWLEDGE does not answer the question, set grounded=false and return exactly one
   block of kind "unknown" (cites empty) that politely says you do not have verified
   information on that and suggests what you can tell about instead. Do not guess.
4. Be respectful of all religious and cultural sentiments. Do not discuss politically
   contested or disputed claims about any monument's origin; say you share only recorded
   history from official sources.
5. If the visitor asks for a toilet, parking, water, medical help, police, help desk, food,
   ATM, ramp or rest point: action="show_facility" and facility=<that type> (otherwise
   facility="none"), with one short
   "info" block. For an emergency: action="sos" and an "info" block with the helpline numbers
   from the knowledge. For a walking/audio tour: action="start_tour". For things to do or eat
   nearby: action="open_nearby" plus your answer from the nearby knowledge. Otherwise "none".
6. LANGUAGE: write every "text" and every follow-up in {LANG_NAMES.get(lang, lang)}, with correct
   spelling including all accents and diacritics. Keep proper names recognisable.
7. STYLE: {MODE_STYLE.get(mode, MODE_STYLE['standard'])}
8. "followups": 2-3 short questions the visitor might ask next that the KNOWLEDGE can answer.

KNOWLEDGE
{city.kb_text}
"""


# ---------------------------------------------------------------- answer post-processing

def _source_list(facts: list[Fact]) -> list[dict]:
    seen, out = set(), []
    for f in facts:
        key = (f.source, f.url)
        if f.url and key not in seen:
            seen.add(key)
            out.append({"name": f.source or f.url, "url": f.url})
    return out


def _clean_blocks(city: City, raw_blocks: list[dict], lang: str) -> list[dict]:
    blocks = []
    for b in raw_blocks or []:
        text = (b.get("text") or "").strip()
        kind = b.get("kind", "info")
        if not text:
            continue
        if kind == "unknown":
            blocks.append({"kind": "unknown", "text": text, "sources": []})
            continue
        facts = [city.facts[c] for c in (b.get("cites") or []) if c in city.facts]
        if not facts:
            continue  # uncited claim: drop it rather than show something unverifiable
        kinds = {f.kind for f in facts}
        if kinds == {"folklore"}:
            kind = "folklore"
        elif kind == "folklore" and "folklore" not in kinds:
            kind = "history"
        block = {"kind": kind, "text": text, "sources": _source_list(facts)}
        if kind == "folklore":
            folk = next(f for f in facts if f.kind == "folklore")
            block["label"] = folk.label or "legend"
            if folk.note:
                block["note"] = _t(folk.note, lang if lang in ("en", "hi") else "en")
        block["poiIds"] = sorted({f.poi_id for f in facts if f.poi_id})
        blocks.append(block)
    return blocks


def _local_answer(city: City, question: str, lang: str, poi_id: str | None) -> dict:
    """No-LLM answer: the best matching facts, verbatim, in English or Hindi."""
    out_lang = "hi" if lang == "hi" else "en"
    facts = local_search(city, question, poi_id)
    if not facts:
        return {"grounded": False, "blocks": [{"kind": "unknown", "text": NOT_FOUND[out_lang], "sources": []}],
                "followups": [], "action": "none", "facility": "", "mode": "basic"}
    blocks = []
    for f in facts:
        b = {"kind": f.kind, "text": _t(f.text, out_lang), "sources": _source_list([f]),
             "poiIds": [f.poi_id] if f.poi_id else []}
        if f.kind == "folklore":
            b["label"] = f.label or "legend"
            if f.note:
                b["note"] = _t(f.note, out_lang)
        blocks.append(b)
    return {"grounded": True, "blocks": blocks, "followups": [], "action": "none",
            "facility": "", "mode": "basic"}


# ---------------------------------------------------------------- caching + logging

_cache: OrderedDict[str, dict] = OrderedDict()


def _cache_get(key: str):
    if key in _cache:
        _cache.move_to_end(key)
        return _cache[key]
    return None


def _cache_put(key: str, value: dict):
    _cache[key] = value
    if len(_cache) > 300:
        _cache.popitem(last=False)


def log_event(kind: str, **data):
    """Anonymous usage log (no personal data) - the feed for a future insights dashboard."""
    try:
        config.LOG_DIR.mkdir(exist_ok=True)
        with (config.LOG_DIR / "events.jsonl").open("a", encoding="utf-8") as f:
            f.write(json.dumps({"ts": int(time.time()), "kind": kind, **data}, ensure_ascii=False) + "\n")
    except OSError:
        pass


# ---------------------------------------------------------------- public API

async def ask(city: City, question: str, lang: str = "en", mode: str = "standard",
              history: list[dict] | None = None, poi_id: str | None = None) -> dict:
    question = (question or "").strip()[:500]
    history = (history or [])[-6:]
    key = json.dumps([city.id, question.lower(), lang, mode, poi_id, history], ensure_ascii=False)
    if (hit := _cache_get(key)) is not None:
        return hit

    convo = "\n".join(f"{h.get('role', 'user')}: {str(h.get('text', ''))[:400]}" for h in history)
    focus = ""
    if poi_id:
        poi = next((p for p in city.pois if p["id"] == poi_id), None)
        if poi:
            focus = f"The visitor is looking at POI {poi_id} ({_t(poi.get('name'))}). Focus on it.\n"
    prompt = (f"{focus}Conversation so far:\n{convo or '(none)'}\n\n"
              f"Visitor's question: {question}")
    try:
        raw = await llm.generate_json(_system_prompt(city, lang, mode), prompt, ASK_SCHEMA)
        action = raw.get("action", "none")
        blocks = _clean_blocks(city, raw.get("blocks", []), lang)
        if action in ACTION_TEXT:
            # Facility / SOS / tour requests are answered by the app's own screens, not by facts:
            # replace any "I don't know" text with a short pointer to that screen.
            blocks = [b for b in blocks if b["kind"] != "unknown"]
            blocks.insert(0, {"kind": "info", "sources": [],
                              "text": ACTION_TEXT[action].get(lang, ACTION_TEXT[action]["en"])})
        if not blocks:
            blocks = [{"kind": "unknown", "text": NOT_FOUND.get(lang, NOT_FOUND["en"]), "sources": []}]
        grounded = any(b["kind"] != "unknown" for b in blocks)
        result = {
            "grounded": grounded,
            "blocks": blocks,
            "followups": [f for f in raw.get("followups", []) if isinstance(f, str)][:3],
            "action": action,
            "facility": "" if raw.get("facility") in (None, "none") else raw["facility"],
            "mode": "ai",
        }
    except llm.LLMUnavailable:
        result = _local_answer(city, question, lang, poi_id)
    except llm.LLMError as e:
        result = _local_answer(city, question, lang, poi_id)
        result["notice"] = "busy" if isinstance(e, llm.LLMBusy) else "ai_error"
        log_event("llm_error", error=str(e)[:200])

    log_event("ask", city=city.id, lang=lang, mode=mode, question=question,
              grounded=result["grounded"], poi=poi_id)
    if result["mode"] == "ai":
        _cache_put(key, result)
    return result


async def recognise(city: City, image: bytes, mime: str, lang: str, mode: str,
                    lat: float | None = None, lng: float | None = None) -> dict:
    candidates = city.pois
    if lat is not None and lng is not None:
        def dist2(p):
            return (p.get("lat", 0) - lat) ** 2 + (p.get("lng", 0) - lng) ** 2
        near = sorted(candidates, key=dist2)
        # ~0.004 deg ~ 400 m. Keep the closest ones, but never fewer than 6 candidates.
        candidates = [p for p in near if dist2(p) < 0.004 ** 2] or near
        candidates = candidates if len(candidates) >= 6 else near[:6]

    listing = "\n".join(f"- id: {p['id']} | {_t(p.get('name'))} | looks like: {p.get('visualCues', '')}"
                        for p in candidates)
    system = ("You identify which heritage point of interest a visitor's photo shows. "
              "You may ONLY choose ids from the CANDIDATES list - never invent one. Compare the photo "
              "with each candidate's visual description. Several neighbouring features are often visible "
              "in one photo (e.g. a garden with the tomb behind it): the main subject is the one in the "
              "foreground that fills most of the frame or is in sharp focus. List up to 3 candidates, best "
              "first, each with its own confidence. Calibrate honestly: above 0.8 only when the "
              "distinguishing details of that candidate are clearly visible AND no other candidate fits "
              "about as well; 0.4-0.7 when it could be one of two or three. If the photo shows none of "
              f"them, return an empty list. Write 'seen' as one short sentence in {LANG_NAMES.get(lang, lang)} "
              "describing only what is visible (no history).\n\nCANDIDATES\n" + listing)
    try:
        raw = await llm.generate_json(system, "Which candidate is the main subject of this photo?",
                                      VISION_SCHEMA, media=(image, mime), temperature=0.1, vision=True)
    except llm.LLMUnavailable:
        return {"status": "unavailable", "candidates": []}
    except llm.LLMError as e:
        log_event("llm_error", error=str(e)[:200])
        return {"status": "error", "candidates": [],
                "notice": "rate_limited" if "rate_limited" in str(e) else "ai_error"}

    valid = {p["id"]: p for p in city.pois}
    matches = [m for m in raw.get("matches", []) if m.get("id") in valid]
    matches.sort(key=lambda m: -float(m.get("confidence", 0)))
    out_lang = lang if lang in ("en", "hi") else "en"
    cands = [{"id": m["id"], "name": _t(valid[m["id"]].get("name"), out_lang),
              "confidence": round(float(m.get("confidence", 0)), 2)} for m in matches[:3]]
    seen = raw.get("seen", "")

    top = cands[0]["confidence"] if cands else 0.0
    second = cands[1]["confidence"] if len(cands) > 1 else 0.0
    if top >= config.MATCH_CONFIDENCE and top - second >= 0.15:
        poi = valid[cands[0]["id"]]
        answer = await ask(city, f"What is this ({_t(poi.get('name'))})? Explain what I am looking at.",
                           lang, mode, poi_id=poi["id"])
        status = "matched"
    elif top >= config.AMBIGUOUS_CONFIDENCE:
        answer, status = None, "ambiguous"
    else:
        answer, status = None, "unknown"

    log_event("vision", city=city.id, lang=lang, status=status, top=cands[0]["id"] if cands else None,
              confidence=top)
    return {"status": status, "seen": seen, "candidates": cands,
            "poiId": cands[0]["id"] if status == "matched" else None, "answer": answer}
