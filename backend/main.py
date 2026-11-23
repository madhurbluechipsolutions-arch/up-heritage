"""FastAPI app: the /api endpoints plus the built React PWA and the content folder, all on one port.

Run (from the project root):   .venv\\Scripts\\uvicorn backend.main:app --reload
"""
from __future__ import annotations

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import companion, config, llm
from .content import store

app = FastAPI(title="UP Heritage Companion", version="0.1.0")

MAX_IMAGE_BYTES = 6 * 1024 * 1024
MAX_AUDIO_BYTES = 4 * 1024 * 1024


def _city(city_id: str):
    city = store.get(city_id)
    if not city:
        raise HTTPException(404, f"Unknown city '{city_id}'")
    return city


class Turn(BaseModel):
    role: str = "user"
    text: str = ""


class AskRequest(BaseModel):
    city: str
    question: str = Field(min_length=1, max_length=500)
    lang: str = "en"
    mode: str = "standard"
    history: list[Turn] = []
    poiId: str | None = None


@app.get("/api/health")
def health():
    return {"ok": True, "provider": llm.provider_name(), "model": llm.model_name(),
            "cities": [c["id"] for c in store.cities()]}


@app.post("/api/ask")
async def ask(req: AskRequest):
    city = _city(req.city)
    return await companion.ask(city, req.question, req.lang, req.mode,
                               [t.model_dump() for t in req.history], req.poiId)


@app.post("/api/vision")
async def vision(image: UploadFile = File(...), city: str = Form(...), lang: str = Form("en"),
                 mode: str = Form("standard"), lat: float | None = Form(None),
                 lng: float | None = Form(None)):
    c = _city(city)
    data = await image.read()
    if not data:
        raise HTTPException(400, "Empty image")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image too large")
    mime = image.content_type if (image.content_type or "").startswith("image/") else "image/jpeg"
    return await companion.recognise(c, data, mime, lang, mode, lat, lng)


@app.post("/api/transcribe")
async def transcribe(audio: UploadFile = File(...), lang: str = Form("en")):
    data = await audio.read()
    if not data or len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(400, "Audio missing or too large")
    try:
        text = await llm.transcribe(data, audio.content_type or "audio/webm", lang)
    except llm.LLMUnavailable:
        raise HTTPException(503, "Voice fallback needs a Gemini key")
    except llm.LLMError as e:
        raise HTTPException(502, str(e)[:200])
    return {"text": text}


# ------------------------------------------------------------ static: content + built frontend

app.mount("/data", StaticFiles(directory=config.DATA_DIR), name="data")

if (config.FRONTEND_DIST / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=config.FRONTEND_DIST / "assets"), name="assets")


@app.get("/{path:path}", include_in_schema=False)
def spa(path: str):
    """Serve the PWA. Unknown paths (e.g. /p/agra/great-gate from a signboard QR) get index.html."""
    if path.startswith("api/"):
        return JSONResponse({"detail": "Not found"}, status_code=404)
    dist = config.FRONTEND_DIST.resolve()
    target = (dist / path).resolve()
    if path and target.is_file() and dist in target.parents:
        return FileResponse(target)
    index = dist / "index.html"
    if index.exists():
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
    return JSONResponse({"detail": "Frontend not built yet. Run: npm run build --prefix frontend"},
                        status_code=503)
