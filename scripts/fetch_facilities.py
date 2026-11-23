"""Builds data/<city>/facilities.geojson from OpenStreetMap (Overpass API, free, no key).

Where OpenStreetMap has no data for a facility type close to the site (common for toilets, water
points, ramps and rest benches inside monument complexes), a few synthetic points are added and
marked "synthetic": true, as the problem statement allows for test data.

Usage:  .venv\\Scripts\\python scripts\\fetch_facilities.py agra
"""
import json
import math
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

# Default search centre and radius (metres) per city. city.json "center" overrides the centre.
CITIES = {
    "agra": {"center": (27.1751, 78.0421), "radius": 2500},
    "varanasi": {"center": (25.3071, 83.0104), "radius": 2000},
}

# OSM tag -> our facility type
TAGS = [
    ('["amenity"="toilets"]', "toilet"),
    ('["amenity"="drinking_water"]', "water"),
    ('["amenity"="parking"]', "parking"),
    ('["amenity"="hospital"]', "hospital"),
    ('["amenity"="clinic"]', "clinic"),
    ('["amenity"="doctors"]', "clinic"),
    ('["amenity"="pharmacy"]', "pharmacy"),
    ('["amenity"="police"]', "police"),
    ('["tourism"="information"]["information"="office"]', "helpdesk"),
    ('["amenity"="atm"]', "atm"),
    ('["amenity"="restaurant"]', "food"),
    ('["amenity"="fast_food"]', "food"),
    ('["amenity"="cafe"]', "food"),
    ('["amenity"="bench"]', "rest"),
    ('["wheelchair"="yes"]["amenity"="toilets"]', "wheelchair"),
]
MAX_PER_TYPE = {"food": 25, "atm": 10, "parking": 12, "rest": 10}

# Synthetic points inside/around the main site, used only when OSM has nothing close by.
# Offsets in metres (north, east) from the city centre.
SYNTHETIC = {
    "agra": [
        ("toilet", "Toilets near East Gate ticket counter", (-380, 420)),
        ("toilet", "Toilets near West Gate ticket counter", (-420, -430)),
        ("toilet", "Toilets in forecourt (Jilaukhana)", (-250, 60)),
        ("water", "Drinking water - forecourt", (-240, -40)),
        ("water", "Drinking water - garden east side", (-80, 140)),
        ("helpdesk", "Tourist facilitation desk - East Gate", (-400, 400)),
        ("ramp", "Ramp to mausoleum platform", (40, 70)),
        ("rest", "Shaded benches - garden", (-120, -90)),
        ("wheelchair", "Wheelchair available at East Gate (ask counter)", (-390, 410)),
        ("clinic", "First-aid post - East Gate", (-395, 440)),
    ],
    "varanasi": [
        ("toilet", "Public toilets near Dashashwamedh Ghat", (60, -40)),
        ("water", "Drinking water - ghat entrance", (40, -60)),
        ("helpdesk", "Tourist help desk - Dashashwamedh", (80, -90)),
        ("rest", "Shaded seating - ghat steps", (10, 20)),
    ],
}


def offset(center, north_m, east_m):
    lat, lng = center
    return lat + north_m / 111_320, lng + east_m / (111_320 * math.cos(math.radians(lat)))


def dist_m(a, b):
    dlat = (a[0] - b[0]) * 111_320
    dlng = (a[1] - b[1]) * 111_320 * math.cos(math.radians(a[0]))
    return math.hypot(dlat, dlng)


def main(city_id: str):
    cfg = CITIES.get(city_id)
    if not cfg:
        sys.exit(f"Add '{city_id}' to CITIES first")
    city_file = ROOT / "data" / city_id / "city.json"
    center = tuple(json.loads(city_file.read_text(encoding="utf-8"))["center"]) if city_file.exists() else cfg["center"]
    lat, lng = center
    r = cfg["radius"]

    parts = "".join(f"nwr{tag}(around:{r},{lat},{lng});" for tag, _ in TAGS)
    query = f"[out:json][timeout:60];({parts});out center tags;"
    print(f"Querying OpenStreetMap around {center} (r={r} m)...")
    elements = None
    for url in OVERPASS_MIRRORS:
        try:
            res = httpx.post(url, data={"data": query}, timeout=90,
                             headers={"User-Agent": "UPHeritageCompanion-PoC/0.1"})
            res.raise_for_status()
            elements = res.json().get("elements", [])
            break
        except (httpx.HTTPError, ValueError) as e:
            print(f"  {url} failed ({e.__class__.__name__}), trying next mirror...")
    if elements is None:
        sys.exit("All Overpass mirrors failed - try again in a few minutes.")

    features, seen = [], set()
    by_type: dict[str, list] = {}
    for el in elements:
        tags = el.get("tags", {})
        p = (el.get("lat"), el.get("lon")) if "lat" in el else (el.get("center", {}).get("lat"), el.get("center", {}).get("lon"))
        if p[0] is None:
            continue
        ftype = None
        for tag, t in TAGS:
            conds = [c.strip('[]').split("=") for c in tag.split("][")]
            if all(tags.get(k.strip('[]"')) == v.strip('[]"') for k, v in conds):
                ftype = t
                break
        if not ftype or (el["type"], el["id"]) in seen:
            continue
        seen.add((el["type"], el["id"]))
        by_type.setdefault(ftype, []).append((dist_m(center, p), p, tags, el))

    for ftype, items in by_type.items():
        items.sort(key=lambda x: x[0])
        for d, p, tags, el in items[: MAX_PER_TYPE.get(ftype, 20)]:
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [round(p[1], 6), round(p[0], 6)]},
                "properties": {
                    "id": f"osm-{el['type'][0]}{el['id']}",
                    "type": ftype,
                    "name": tags.get("name:en") or tags.get("name") or "",
                    "timings": tags.get("opening_hours", ""),
                    "phone": tags.get("phone") or tags.get("contact:phone") or "",
                    "source": "OpenStreetMap",
                    "synthetic": False,
                },
            })

    # Fill gaps close to the site with clearly-marked synthetic points.
    for i, (ftype, name, (n, e)) in enumerate(SYNTHETIC.get(city_id, [])):
        p = offset(center, n, e)
        near_real = [x for x in by_type.get(ftype, []) if dist_m(p, x[1]) < 300]
        if near_real:
            continue
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(p[1], 6), round(p[0], 6)]},
            "properties": {"id": f"syn-{i}", "type": ftype, "name": name, "timings": "",
                           "phone": "", "source": "synthetic", "synthetic": True},
        })

    out = ROOT / "data" / city_id / "facilities.geojson"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False, indent=1),
                   encoding="utf-8")
    counts: dict[str, int] = {}
    for f in features:
        k = f["properties"]["type"] + (" (synthetic)" if f["properties"]["synthetic"] else "")
        counts[k] = counts.get(k, 0) + 1
    print(f"Wrote {out} with {len(features)} points:")
    for k in sorted(counts):
        print(f"  {k}: {counts[k]}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "agra")
