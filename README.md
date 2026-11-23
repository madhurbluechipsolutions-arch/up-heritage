# Saathi — UP Heritage Companion (PoC)

AI tourism companion for Uttar Pradesh heritage sites, built for the UP AI Mission hackathon
("AI Tourism Companion" problem statement). Main destination: **Taj Mahal, Agra**. Second, lighter
destination: **Varanasi** (to show that a new city is just a new data folder).

One project: **FastAPI backend + React PWA frontend**. No Docker, no database.

## Run it (Windows)

First time only:

```bash
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
npm install --prefix frontend
copy .env.example .env
```

Put your free Gemini key in `.env` (`GEMINI_API_KEY=...`, get it at https://aistudio.google.com).
Without a key the app still works in **basic mode**: answers come straight from the sourced content.

Build the app and start the server:

```bash
npm run build --prefix frontend
.venv\Scripts\uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Open http://localhost:8000

While changing frontend code, run `npm run dev --prefix frontend` too and open http://localhost:5173
(it forwards `/api` and `/data` to the backend on port 8000).

### On a phone

Camera, microphone, GPS and offline mode need **HTTPS**. Easiest free way from your laptop:

```bash
winget install Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:8000
```

Open the `https://….trycloudflare.com` link it prints, in **Chrome on Android**.

## Deploy (free, Render, one service)

One Render web service runs everything: FastAPI answers `/api/*` and also serves the built React
app (`frontend/dist`, committed to git) and the content (`data/`). `render.yaml` has the settings.

1. Rebuild the app if the frontend changed: `npm run build --prefix frontend`, then commit.
2. Push this folder to a GitHub repo (`.env` is git-ignored, so the key is not uploaded).
3. render.com → **New → Blueprint** → pick the repo → paste `GEMINI_API_KEY` when asked → Apply.
4. Open `https://<name>.onrender.com` on the phone. Free services sleep after ~15 idle minutes;
   a free UptimeRobot ping to `/api/health` every 10 minutes keeps it awake for demo day.

## What the visitor gets (use cases from the problem statement)

| Use case | Where |
|---|---|
| UC-1 Ask anything, text or voice, in their language | **Ask** tab (mic uses the browser's speech recognition; falls back to Gemini transcription) |
| UC-2 Point the camera and ask | **Camera** tab: closed-set recognition against the city's POI list, confidence shown, "is it one of these?" when unsure |
| UC-3 History vs folklore, clearly labelled | Every answer is split into coloured blocks: *Recorded history*, *Architecture*, *Folklore* (with a warning line), *Devotional*; each with its source link |
| UC-4 Self-guided audio tour | **Tour** tab: route sized to the visitor's time, numbered map, pre-recorded audio per stop, auto-play on arrival (GPS) and a **Simulate walk** button for demos |
| UC-5 Personalised nearby | **Explore** tab: interests, time, budget, who you travel with; each card says *why* it was suggested; ODOP products badged |
| UC-6 Facilities + SOS | **Help** tab: one-tap 112, helplines, share location, nearest toilets/water/parking/medical/police on a map with walking time |
| UC-7 Content for different visitors | Mode: Standard, Kids story, Quick, In depth, Pilgrim |
| UC-8 Accessible | Read aloud everywhere, large text, accessible-route option in the tour, ramp/rest points |
| UC-9 Insights | Not built in the PoC. Every question is logged anonymously to `logs/events.jsonl` as the feed for a future dashboard |

Also: **16 answer languages**, **offline pack** (Settings → Offline pack), **signboard QR deep links**
(`/p/agra/<poiId>` opens that spot directly).

## How the AI is kept honest

1. The model sees only our sourced content (`data/<city>/*.json`); every fact has an id.
2. It must cite those ids per answer block. The backend **drops any block that cites nothing real**,
   so a source shown to the visitor is always one from our data.
3. A block that cites only folklore is always shown as folklore.
4. Unknown → "I don't have verified information", never a guess.
5. Photo recognition may only pick from the city's own POI list.

## Project layout

```
backend/            FastAPI: /api/ask, /api/vision, /api/transcribe, serves data/ and the built PWA
  companion.py      prompts, citation checks, photo recognition flow
  llm.py            Gemini / Groq / Claude / local switch (LLM_PROVIDER in .env)
  content.py        loads city folders, builds the citable knowledge base, keyword fallback
frontend/           React + Vite + Tailwind PWA (Ask, Camera, Tour, Explore, Help)
data/
  cities.json       list of destinations
  SCHEMA.md         content format and rules
  agra/  varanasi/  city.json, pois.json, nearby.json, facilities.geojson, audio/*.mp3
scripts/
  fetch_facilities.py   facilities from OpenStreetMap (+ marked synthetic points)
  gen_audio.py          tour audio MP3s (edge-tts neural voices, EN + HI)
  make_icons.py         app icons
```

## Add a new destination

1. Create `data/<city>/` with `city.json`, `pois.json`, `nearby.json` (format: `data/SCHEMA.md`).
2. Add it to `data/cities.json`.
3. `.venv\Scripts\python scripts\fetch_facilities.py <city>` (add its centre to `CITIES` in the script).
4. `.venv\Scripts\python scripts\gen_audio.py <city>`

No code changes.

## Data

Content comes from public sources (ASI / tajmahal.gov.in, UNESCO, UP Tourism, odopup.in,
district portals, Wikipedia, Wikimedia Commons), each item with its URL. Facilities come from
OpenStreetMap; points marked `"synthetic": true` are test data, as the problem statement allows.
