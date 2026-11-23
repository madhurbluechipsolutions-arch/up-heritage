"""Pre-generates the audio-tour stories as MP3 files (English + Hindi) with natural neural voices.

The MP3s live in data/<city>/audio/<poiId>_<lang>.mp3, are served as static files and get cached
by the offline pack, so the tour plays even with no signal.

Usage:  .venv\\Scripts\\python scripts\\gen_audio.py agra          (skips files that exist)
        .venv\\Scripts\\python scripts\\gen_audio.py agra --force
"""
import asyncio
import json
import sys
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
VOICES = {"en": "en-IN-NeerjaNeural", "hi": "hi-IN-SwaraNeural"}
FOLK_INTRO = {
    "en": "And now, a story people tell here. Remember, this is a legend, not recorded history.",
    "hi": "अब एक लोक-कथा, जो यहाँ सुनाई जाती है। याद रखिए, यह कहानी है, दर्ज इतिहास नहीं।",
}


def pick(d, lang):
    return (d or {}).get(lang) or (d or {}).get("en") or ""


def story(poi: dict, lang: str) -> str:
    parts = [pick(poi.get("name"), lang) + ".", pick(poi.get("summary"), lang)]
    parts += [pick(h, lang) for h in (poi.get("history") or [])[:2]]
    parts += [pick(a, lang) for a in (poi.get("architecture") or [])[:1]]
    folk = (poi.get("folklore") or [])[:1]
    if folk:
        parts += [FOLK_INTRO[lang], pick(folk[0], lang)]
    return " ".join(p.strip() for p in parts if p and p.strip())


async def main(city: str, force: bool):
    pois = json.loads((ROOT / "data" / city / "pois.json").read_text(encoding="utf-8"))
    out = ROOT / "data" / city / "audio"
    out.mkdir(parents=True, exist_ok=True)
    for poi in pois:
        for lang, voice in VOICES.items():
            path = out / f"{poi['id']}_{lang}.mp3"
            if path.exists() and not force:
                continue
            text = story(poi, lang)
            if not text:
                continue
            for attempt in range(3):
                try:
                    await edge_tts.Communicate(text, voice, rate="-5%").save(str(path))
                    print(f"  {path.name}  ({len(text)} chars)")
                    break
                except Exception as e:  # network hiccups: retry
                    print(f"  retry {poi['id']}_{lang}: {e}")
                    await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "agra", "--force" in sys.argv))
