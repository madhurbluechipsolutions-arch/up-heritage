# Content data schema

Every city is one folder under `data/<cityId>/`. Adding a city = adding a folder and one line to
`data/cities.json`. No code changes.

Rules for all content (from the UP AI Mission problem statement):
- Every fact comes from a credible public source and carries its `source` + `url`.
- Recorded history and folklore are NEVER mixed. A claim the sources call a legend, belief,
  "it is said", or popular story goes in `folklore`, never in `history`.
- Respect religious and cultural sentiment. Leave out politically contested or disputed claims.
- Anything not from a real source (test data) is marked `"synthetic": true`.
- Every user-facing text has `en` and `hi` (Hindi in Devanagari, simple words).

## data/cities.json

```json
[{ "id": "agra", "name": {"en": "Agra", "hi": "आगरा"}, "depth": "full", "cover": "https://upload.wikimedia.org/..." },
 { "id": "varanasi", "name": {"en": "Varanasi", "hi": "वाराणसी"}, "depth": "lite" }]
```

## data/<city>/city.json

```json
{
  "id": "agra",
  "name": {"en": "Agra", "hi": "आगरा"},
  "cover": {"url": "https://upload.wikimedia.org/...", "credit": "Author", "license": "CC BY-SA 4.0", "page": "https://commons.wikimedia.org/wiki/File:..."},
  "tagline": {"en": "...", "hi": "..."},
  "center": [27.1751, 78.0421],
  "zoom": 16,
  "mainSite": {
    "id": "taj-mahal",
    "name": {"en": "Taj Mahal", "hi": "ताजमहल"},
    "timings": {"en": "...", "hi": "..."},
    "closedOn": {"en": "...", "hi": "..."},
    "entryFee": {"en": "...", "hi": "..."},
    "source": "Archaeological Survey of India", "url": "https://..."
  },
  "helplines": [
    {"id": "emergency", "name": {"en": "Emergency (Police/Fire/Ambulance)", "hi": "आपातकाल"}, "number": "112"},
    {"id": "ambulance", "name": {"en": "Ambulance", "hi": "एम्बुलेंस"}, "number": "108"},
    {"id": "tourist", "name": {"en": "Tourist Helpline", "hi": "पर्यटक हेल्पलाइन"}, "number": "1363"}
  ]
}
```

## data/<city>/pois.json

```json
[{
  "id": "great-gate",
  "site": "taj-mahal",
  "category": "gateway",
  "name": {"en": "Great Gate (Darwaza-i-Rauza)", "hi": "दरवाज़ा-ए-रौज़ा (मुख्य द्वार)"},
  "lat": 27.1733, "lng": 78.0421,
  "tourOrder": 2,
  "tourMinutes": 8,
  "priority": 1,
  "summary": {"en": "1-2 sentence plain summary", "hi": "..."},
  "history": [
    {"en": "One recorded fact.", "hi": "...", "source": "ASI", "url": "https://..."}
  ],
  "architecture": [
    {"en": "One architectural fact.", "hi": "...", "source": "...", "url": "https://..."}
  ],
  "folklore": [
    {"en": "The story, told engagingly.", "hi": "...",
     "label": "legend | popular belief | local tradition",
     "note": {"en": "Why this is folklore, e.g. 'No historical record supports this.'", "hi": "..."},
     "source": "...", "url": "https://..."}
  ],
  "devotional": [ {"en": "...", "hi": "...", "source": "...", "url": "..."} ],
  "kidsStory": {"en": "3-4 sentence story for a 7-year-old, only using facts above", "hi": "..."},
  "visualCues": "English description of what it LOOKS like, for photo recognition",
  "accessibility": {"en": "Steps/ramps/rest notes if known", "hi": "..."},
  "faq": [ {"q": {"en": "...", "hi": "..."}, "a": {"en": "...", "hi": "..."}} ],
  "photos": [ {"url": "https://upload.wikimedia.org/...", "credit": "Author", "license": "CC BY-SA 4.0", "page": "https://commons.wikimedia.org/wiki/File:..."} ]
}]
```

`priority`: 1 = must see, 2 = good to see, 3 = if time. `tourOrder` = sensible walking order.
`devotional`, `accessibility`, `faq`, `photos` are optional.

## data/<city>/nearby.json

```json
[{
  "id": "agra-fort",
  "type": "heritage | museum | market | food | craft | festival | nature",
  "odop": false,
  "name": {"en": "...", "hi": "..."},
  "lat": 27.1795, "lng": 78.0211,
  "description": {"en": "...", "hi": "..."},
  "interests": ["history", "architecture", "spiritual", "shopping", "food", "art", "nature", "photography"],
  "budget": "free | low | medium | high",
  "goodFor": ["kids", "elderly", "family", "couple", "solo", "pilgrim"],
  "durationHours": 2,
  "timings": {"en": "...", "hi": "..."},
  "entryFee": {"en": "...", "hi": "..."},
  "howToReach": {"en": "...", "hi": "..."},
  "when": "Only for festivals, e.g. 'February (annual)'",
  "source": "...", "url": "https://...",
  "photos": [ {"url": "https://upload.wikimedia.org/...", "credit": "Author", "license": "CC BY-SA 4.0", "page": "https://commons.wikimedia.org/wiki/File:..."} ]
}]
```

The app is image-led: the city `cover` is the home-screen hero and the city-picker card, and each
spot/nearby place shows its first photo. Use freely licensed Wikimedia Commons photos and keep the
`credit` + `license` + `page` (the app shows the attribution). A spot without a photo falls back to the
city cover; a nearby place without one shows a plain tile.

## data/<city>/facilities.geojson

GeoJSON FeatureCollection of Points. `properties`:
`{ "type": "toilet | parking | water | hospital | clinic | police | helpdesk | food | atm | ramp | rest | wheelchair",
   "name": "...", "timings": "...", "phone": "...", "source": "OpenStreetMap | synthetic", "synthetic": false }`
