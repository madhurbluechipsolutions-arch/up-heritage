"""One small interface over the LLM providers. Switch with LLM_PROVIDER in .env.

    generate_json(system, prompt, schema, media=None) -> dict
    transcribe(audio_bytes, mime, lang) -> str

`media` is an optional (bytes, mime_type) tuple - a photo for recognition.
Everything is plain HTTPS with httpx, so no provider SDK is needed.
"""
from __future__ import annotations

import base64
import json
import re

import httpx

from . import config


class LLMError(RuntimeError):
    pass


class LLMUnavailable(LLMError):
    """No key configured, or the provider is set to 'local'."""


def provider_name() -> str:
    p = config.LLM_PROVIDER
    if p == "gemini" and config.GEMINI_API_KEY:
        return "gemini"
    if p == "groq" and config.GROQ_API_KEY:
        return "groq"
    if p == "claude" and config.ANTHROPIC_API_KEY:
        return "claude"
    return "local"


def model_name() -> str:
    return {"gemini": config.GEMINI_MODEL, "groq": config.GROQ_MODEL,
            "claude": config.CLAUDE_MODEL}.get(provider_name(), "none")


def _parse_json(text: str) -> dict:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if fence:
        text = fence.group(1)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise LLMError("Model did not return JSON")
    return json.loads(text[start:end + 1])


class LLMBusy(LLMError):
    """Overloaded / rate limited / timed out - worth trying another model."""


async def _post(url: str, headers: dict, body: dict, timeout: float = 30) -> dict:
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(url, headers=headers, json=body)
    except httpx.TimeoutException as e:
        raise LLMBusy("timeout") from e
    except httpx.HTTPError as e:
        raise LLMError(f"network: {e}") from e
    if r.status_code == 429:
        raise LLMBusy("rate_limited")
    if r.status_code in (500, 502, 503, 504):
        raise LLMBusy(f"{r.status_code}: overloaded")
    if r.status_code >= 400:
        raise LLMError(f"{r.status_code}: {r.text[:300]}")
    return r.json()


# ------------------------------------------------------------------ Gemini

def _gemini_schema(schema: dict) -> dict:
    """JSON-schema subset -> Gemini responseSchema (uppercase types, no additionalProperties)."""
    out = {}
    for k, v in schema.items():
        if k == "type":
            out["type"] = v.upper()
        elif k == "properties":
            out["properties"] = {pk: _gemini_schema(pv) for pk, pv in v.items()}
        elif k == "items":
            out["items"] = _gemini_schema(v)
        elif k in ("required", "enum", "description", "nullable"):
            out[k] = v
    return out


async def _gemini(system: str, prompt: str, schema: dict | None, media=None, temperature=0.3, models=None):
    parts = [{"text": prompt}]
    if media:
        data, mime = media
        parts.append({"inlineData": {"mimeType": mime, "data": base64.b64encode(data).decode()}})
    gen = {"temperature": temperature}
    if schema:
        gen["responseMimeType"] = "application/json"
        gen["responseSchema"] = _gemini_schema(schema)
    last: LLMError | None = None
    # Primary model first; if it is overloaded, rate limited or slow, try the fallbacks in order.
    for model in models or [config.GEMINI_MODEL, *config.GEMINI_FALLBACKS]:
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": parts}],
            # Low thinking keeps answers fast (~3-5 s); the task is retrieval + rewriting, not reasoning.
            "generationConfig": {**gen, "thinkingConfig": {"thinkingLevel": config.GEMINI_THINKING}},
        }
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        try:
            res = await _post(url, {"x-goog-api-key": config.GEMINI_API_KEY}, body)
        except LLMBusy as e:
            last = e
            continue
        except LLMError as e:
            if "thinking" in str(e).lower():  # model without thinking levels: retry once without it
                body["generationConfig"].pop("thinkingConfig")
                try:
                    res = await _post(url, {"x-goog-api-key": config.GEMINI_API_KEY}, body)
                except LLMError as e2:
                    last = e2
                    continue
            elif e.args and str(e.args[0]).startswith("404"):  # retired model: try the next
                last = e
                continue
            else:
                raise
        try:
            return "".join(p.get("text", "") for p in res["candidates"][0]["content"]["parts"])
        except (KeyError, IndexError) as e:
            last = LLMError(f"Unexpected Gemini response from {model}: {str(res)[:200]}")
    raise last or LLMError("No Gemini model answered")


# ------------------------------------------------------------------ Groq (OpenAI-compatible)

async def _groq(system: str, prompt: str, schema: dict | None, media=None, temperature=0.3):
    if media:
        raise LLMError("Photo recognition needs LLM_PROVIDER=gemini or claude")
    sys = system + ("\n\nReply with a single JSON object matching this schema:\n" + json.dumps(schema)
                    if schema else "")
    body = {
        "model": config.GROQ_MODEL,
        "temperature": temperature,
        "messages": [{"role": "system", "content": sys}, {"role": "user", "content": prompt}],
    }
    if schema:
        body["response_format"] = {"type": "json_object"}
    res = await _post("https://api.groq.com/openai/v1/chat/completions",
                      {"Authorization": f"Bearer {config.GROQ_API_KEY}"}, body)
    return res["choices"][0]["message"]["content"]


# ------------------------------------------------------------------ Claude

async def _claude(system: str, prompt: str, schema: dict | None, media=None, temperature=0.3):
    content = []
    if media:
        data, mime = media
        content.append({"type": "image", "source": {"type": "base64", "media_type": mime,
                                                    "data": base64.b64encode(data).decode()}})
    content.append({"type": "text", "text": prompt})
    sys = system + ("\n\nReply with only a JSON object matching this schema:\n" + json.dumps(schema)
                    if schema else "")
    body = {
        "model": config.CLAUDE_MODEL, "max_tokens": 2000, "temperature": temperature,
        "system": [{"type": "text", "text": sys, "cache_control": {"type": "ephemeral"}}],
        "messages": [{"role": "user", "content": content}],
    }
    res = await _post("https://api.anthropic.com/v1/messages",
                      {"x-api-key": config.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01"}, body)
    return "".join(b.get("text", "") for b in res.get("content", []) if b.get("type") == "text")


_IMPL = {"gemini": _gemini, "groq": _groq, "claude": _claude}


async def generate_json(system: str, prompt: str, schema: dict, media=None, temperature=0.3,
                        vision: bool = False) -> dict:
    p = provider_name()
    if p == "local":
        raise LLMUnavailable("No LLM configured")
    if p == "gemini":
        # Photo recognition is harder than rewriting text: try the bigger Flash model first.
        text = await _gemini(system, prompt, schema, media, temperature,
                             config.GEMINI_VISION_MODELS if vision else None)
    else:
        text = await _IMPL[p](system, prompt, schema, media, temperature)
    return _parse_json(text)


async def transcribe(audio: bytes, mime: str, lang: str) -> str:
    """Speech-to-text fallback for browsers without the Web Speech API (Gemini only)."""
    if provider_name() != "gemini":
        raise LLMUnavailable("Transcription fallback needs Gemini")
    text = await _gemini(
        "You transcribe short spoken questions from tourists. Output only the exact words spoken, "
        "in the script of the language spoken. No commentary.",
        f"Transcribe this audio. Expected language code: {lang}.", None, (audio, mime), 0.0)
    return text.strip()
