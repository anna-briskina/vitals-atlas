"""Fetch solar energetic particle (SEP) events from NASA's DONKI space weather database.

api.nasa.gov allows at most 60 days per request, so long ranges are fetched in 60-day pieces.
DEMO_KEY allows ~30 requests per hour; get a free personal key at https://api.nasa.gov (instant, by email)
and set it before running:
    Windows PowerShell:  $env:NASA_API_KEY = "your_key"
    macOS / Linux:       export NASA_API_KEY=your_key

Results are cached in data/donki_sep_<start>_<end>.json so the demo works offline.

Usage:
  python -m radiation.donki 2017-01-01 2017-12-31
"""
import json
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import requests

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
NASA_URL = "https://api.nasa.gov/DONKI/SEP"
CCMC_URL = "https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/SEP"  # often unreachable; tried as a fallback
CHUNK_DAYS = 60


def _cache_path(start, end):
    return DATA_DIR / f"donki_sep_{start}_{end}.json"


def _chunks(start, end):
    s, e = date.fromisoformat(start), date.fromisoformat(end)
    while s <= e:
        c = min(e, s + timedelta(days=CHUNK_DAYS - 1))
        yield s.isoformat(), c.isoformat()
        s = c + timedelta(days=1)


def _get(url, params, timeout):
    r = requests.get(url, params=params, timeout=timeout)
    r.raise_for_status()
    return r.json() if r.text.strip() else []   # DONKI returns an empty body when there are no events


def fetch_sep(start, end, api_key=None):
    """Download SEP events between two dates (YYYY-MM-DD), 60 days at a time."""
    key = api_key or os.environ.get("NASA_API_KEY") or "DEMO_KEY"
    events, pieces = [], list(_chunks(start, end))
    for i, (s, e) in enumerate(pieces, 1):
        params = {"startDate": s, "endDate": e}
        try:
            got = _get(NASA_URL, {**params, "api_key": key}, timeout=30)
        except requests.HTTPError as err:
            if err.response is not None and err.response.status_code == 429:
                raise SystemExit("NASA API rate limit reached. Set NASA_API_KEY (free at https://api.nasa.gov) "
                                 "or use a shorter date range.") from err
            try:
                got = _get(CCMC_URL, params, timeout=8)
            except Exception:
                raise SystemExit(f"Could not fetch {s} to {e}: {err}") from err
        events += got
        print(f"  {s} to {e}: {len(got)} events ({i}/{len(pieces)})")
        time.sleep(0.3)
    DATA_DIR.mkdir(exist_ok=True)
    _cache_path(start, end).write_text(json.dumps(events, indent=2))
    return events


def load_cached():
    """All cached SEP events from every cached file, de-duplicated by sepID."""
    seen, out = set(), []
    for p in sorted(DATA_DIR.glob("donki_sep_*.json")):
        for ev in json.loads(p.read_text()) or []:
            sid = ev.get("sepID")
            if sid and sid not in seen:
                seen.add(sid)
                out.append(ev)
    return out


# DONKI SEP records list the instruments that saw the event. Some records come only from forecast models;
# only records with at least one observing spacecraft instrument count as a real storm.
OBSERVING = ("GOES", "SOHO", "STEREO", "ACE", "SDO", "WIND", "PSP", "PARKER", "SOLO", "SOLAR ORBITER")


def is_observed(ev):
    names = [str(n).upper() for n in ev["instruments"]]
    return any(n.startswith(OBSERVING) for n in names)


def simplify(ev):
    """Keep the fields the app needs."""
    instruments = [i.get("displayName", "") for i in (ev.get("instruments") or [])]
    linked = [l.get("activityID", "") for l in (ev.get("linkedEvents") or [])]
    return {
        "id": ev.get("sepID"),
        "time": ev.get("eventTime"),
        "date": (ev.get("eventTime") or "")[:10],
        "instruments": instruments,
        "linked_flare_or_cme": linked,
        "link": ev.get("link"),
        "source": "real",
    }


def events(include_models=False):
    """Real storms, newest first: forecast-only records dropped, records within 1 day merged into one storm."""
    from datetime import date
    evs = [simplify(e) for e in load_cached()]
    evs = [e for e in evs if e["date"] and (include_models or is_observed(e))]
    evs.sort(key=lambda e: e["time"] or "")
    storms = []
    for e in evs:
        d = date.fromisoformat(e["date"])
        if storms and (d - date.fromisoformat(storms[-1]["date"])).days <= 1:
            st = storms[-1]
            st["records"].append(e["id"])
            st["instruments"] = sorted(set(st["instruments"]) | set(e["instruments"]))
        else:
            storms.append({**e, "records": [e["id"]]})
    return list(reversed(storms))


def counts():
    raw = [simplify(e) for e in load_cached()]
    observed = [e for e in raw if e["date"] and is_observed(e)]
    return {"records": len(raw), "observed_records": len(observed), "forecast_only": len(raw) - len(observed),
            "storms": len(events())}


if __name__ == "__main__":
    s, e = (sys.argv[1], sys.argv[2]) if len(sys.argv) == 3 else ("2017-01-01", "2017-12-31")
    evs = fetch_sep(s, e)
    print(f"Saved {len(evs)} SEP records from {s} to {e} into {_cache_path(s, e)}")
    print("All cached:", counts())
    for ev in evs[:15]:
        print(" ", ev.get("sepID"))
