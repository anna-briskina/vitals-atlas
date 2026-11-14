"""Real dose-rate measurements from NASA OSDR RadLab.

FETCH A WINDOW AROUND EVERY CACHED DONKI STORM (recommended, run once per mission setting):
    python -m radiation.radlab fetch-events mars
    python -m radiation.radlab fetch-events station
    python -m radiation.radlab fetch-events moon

FETCH one date range (adds to what is already saved):
    python -m radiation.radlab fetch mars    2017-08-20 2017-10-20
    python -m radiation.radlab fetch station 2021-10-01 2021-12-01
    python -m radiation.radlab fetch moon    2020-01-01 2020-03-01

  Pick date ranges that include a DONKI solar particle event date so the storm replay uses measured data.
  Merges into data/radlab_<mode>.csv (one row per day, mSv/day). Last raw download kept in data/radlab_raw_<mode>.csv.

CONVERT a CSV you exported from the RadLab website instead:
    python -m radiation.radlab convert mars --raw path/to/export.csv

API reference: https://visualization.osdr.nasa.gov/radlab/api  (GET, key-value syntax, format=csv)
  absorbed_dose_rate is in uGy/hour, dose_equivalent_rate in uSv/hour.
"""
import argparse
import io
import re
from collections import Counter
from pathlib import Path

import pandas as pd
import requests

from .config import DEFAULT_QUALITY_FACTOR

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
API = "https://visualization.osdr.nasa.gov/radlab/api/"

# Which instruments to ask for, per mission setting (RadLab key-value filters; spaces as %20).
MODE_QUERY = {
    "mars": "instrument=RAD&trajectory=Mars%20surface",       # Curiosity MSL/RAD on the Mars surface
    "moon": "celestial_body=Moon",                             # Chang'e 4 LND on the Moon surface
    "station": "spacecraft=ISS&instrument=DosTel",             # DosTel1/DosTel2 in the ISS Columbus module
}

# multiplier to convert a value in <unit> to milli-units per DAY (mGy/day or mSv/day)
_UNIT_TO_MILLI_PER_DAY = {
    "ugy/h": 24 / 1000, "ugy/hr": 24 / 1000, "ugy/hour": 24 / 1000,
    "ugy/d": 1 / 1000, "ugy/day": 1 / 1000,
    "mgy/d": 1.0, "mgy/day": 1.0, "mgy/h": 24.0,
    "ngy/s": 86400 / 1e6, "ugy/min": 1440 / 1000,
    "usv/h": 24 / 1000, "usv/hr": 24 / 1000, "usv/hour": 24 / 1000, "usv/d": 1 / 1000, "usv/day": 1 / 1000,
    "msv/d": 1.0, "msv/day": 1.0,
}


# ---------------------------------------------------------------- API fetch
def build_url(mode, start, end, query=None):
    q = query or MODE_QUERY[mode]
    return (f"{API}?{q}&timestamp>={start}&timestamp<{end}"
            f"&absorbed_dose_rate&dose_equivalent_rate&format=csv")


def fetch(mode, start, end, query=None, timeout=180):
    url = build_url(mode, start, end, query)
    print(f"GET {url}")
    r = requests.get(url, timeout=timeout)
    r.raise_for_status()
    text = r.text
    first_line = text.strip().splitlines()[0].lower() if text.strip() else ""
    if "timestamp" not in first_line:
        raise SystemExit(f"RadLab returned no data or an error:\n{text[:500]}")
    DATA_DIR.mkdir(exist_ok=True)
    raw = DATA_DIR / f"radlab_raw_{mode}.csv"
    raw.write_text(text)
    df = pd.read_csv(io.StringIO(text))
    print(f"Downloaded {len(df)} readings. Instruments: {dict(Counter(df.get('instrument_id', pd.Series(['?']))))}")
    return df


def from_api_frame(df, instrument_id=None, q=DEFAULT_QUALITY_FACTOR):
    """Daily mSv/day from a RadLab API frame. Uses one detector (the one with most readings unless given)."""
    df = df.copy()
    df.columns = [c.lower() for c in df.columns]
    if "instrument_id" in df.columns:
        ids = df["instrument_id"].dropna()
        chosen = instrument_id or (ids.value_counts().index[0] if len(ids) else None)
        if chosen is not None:
            df = df[df["instrument_id"] == chosen]
        print(f"Using detector: {chosen}")
    de = pd.to_numeric(df.get("dose_equivalent_rate"), errors="coerce") if "dose_equivalent_rate" in df else None
    ad = pd.to_numeric(df.get("absorbed_dose_rate"), errors="coerce") if "absorbed_dose_rate" in df else None
    if de is not None and de.notna().sum() > len(df) * 0.5:
        msv_day, how = de * 24 / 1000, "dose equivalent rate (uSv/h), as measured"
    elif ad is not None and ad.notna().any():
        msv_day, how = ad * 24 / 1000 * q, f"absorbed dose rate (uGy/h) x quality factor {q}"
    else:
        raise SystemExit("No dose values in the download.")
    print(f"Converted from {how}")
    t = pd.to_datetime(df["timestamp"], utc=True, errors="coerce", format="mixed")
    out = pd.DataFrame({"time": t, "v": msv_day}).dropna()
    daily = out.set_index("time")["v"].resample("1D").mean().dropna().reset_index()
    daily.columns = ["date", "dose_msv_per_day"]
    daily["date"] = daily["date"].dt.strftime("%Y-%m-%d")
    daily["source"] = "real"
    return daily


# ---------------------------------------------------------------- one window per DONKI storm
# Data coverage per instrument in RadLab (approximate, from the RadLab overview); events outside are skipped.
COVERAGE = {"mars": ("2015-01-01", "2024-12-31"), "moon": ("2019-01-01", "2023-12-31"), "station": ("2020-01-01", "2022-12-31")}


def storm_windows(mode, before=25, after=10):
    """Date ranges around every cached DONKI event inside the instrument's coverage, overlapping ones merged."""
    from datetime import date, timedelta
    from . import donki
    lo, hi = (date.fromisoformat(d) for d in COVERAGE[mode])
    spans = []
    for ev in donki.events():
        if not ev.get("date"):
            continue
        d = date.fromisoformat(ev["date"])
        if lo <= d <= hi:
            spans.append([d - timedelta(days=before), d + timedelta(days=after)])
    spans.sort()
    merged = []
    for s, e in spans:
        if merged and s <= merged[-1][1] + timedelta(days=1):
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    return [(s.isoformat(), e.isoformat()) for s, e in merged]


def fetch_events(mode, query=None, instrument_id=None, q=DEFAULT_QUALITY_FACTOR):
    wins = storm_windows(mode)
    if not wins:
        raise SystemExit(f"No cached DONKI events inside {mode} coverage {COVERAGE[mode]}. "
                         "Run python -m radiation.donki <start> <end> for those years first.")
    print(f"{len(wins)} download windows cover the DONKI events for {mode}.")
    for i, (s, e) in enumerate(wins, 1):
        print(f"[{i}/{len(wins)}] {s} to {e}")
        try:
            _save(mode, from_api_frame(fetch(mode, s, e, query), instrument_id, q))
        except SystemExit as err:
            print(f"  skipped: {err}")


# ---------------------------------------------------------------- CSV from the website
def _norm_unit(u):
    return (u or "").lower().replace("µ", "u").replace("μ", "u").replace(" ", "").replace("[", "").replace("]", "")


def convert(raw_csv, time_col=None, dose_col=None, unit=None, q=DEFAULT_QUALITY_FACTOR):
    """Daily mSv/day from a CSV exported on the RadLab website (auto-detects columns)."""
    df = pd.read_csv(raw_csv, comment="#")
    if "timestamp" in [c.lower() for c in df.columns] and not (time_col or dose_col or unit):
        return from_api_frame(df, q=q)   # same layout as the API
    cols = list(df.columns)
    time_col = time_col or next((c for c in cols if re.search(r"time|date|utc", c, re.I)), cols[0])
    if not dose_col:
        cands = [c for c in cols if re.search(r"dose", c, re.I) and pd.api.types.is_numeric_dtype(df[c])]
        dose_col = cands[0] if cands else None
    if not unit and dose_col:
        m = re.search(r"([uµμmn]?(?:Gy|Sv)\s*/\s*(?:h|hr|hour|d|day|s|min))", dose_col, re.I)
        unit = m.group(1) if m else None
    print(f"Columns: {cols}\nUsing time='{time_col}', dose='{dose_col}', unit='{unit}', quality factor={q}")
    if dose_col is None or unit is None:
        raise SystemExit("Could not detect the dose column or its unit. Pass --dose and --unit.")
    key = _norm_unit(unit)
    if key not in _UNIT_TO_MILLI_PER_DAY:
        raise SystemExit(f"Unknown unit '{unit}'. Known: {sorted(_UNIT_TO_MILLI_PER_DAY)}")
    per_day = df[dose_col].astype(float) * _UNIT_TO_MILLI_PER_DAY[key]
    if "gy" in key:
        per_day = per_day * q
    out = pd.DataFrame({"time": pd.to_datetime(df[time_col], utc=True, errors="coerce"), "v": per_day}).dropna()
    daily = out.set_index("time")["v"].resample("1D").mean().dropna().reset_index()
    daily.columns = ["date", "dose_msv_per_day"]
    daily["date"] = daily["date"].dt.strftime("%Y-%m-%d")
    daily["source"] = "real"
    return daily


def load(mode):
    """Daily series for a mission setting, or None if no RadLab data has been saved yet."""
    p = DATA_DIR / f"radlab_{mode}.csv"
    return pd.read_csv(p) if p.exists() else None


def _save(mode, daily):
    """Merge new days into data/radlab_<mode>.csv (new values win), so several fetches add up."""
    dest = DATA_DIR / f"radlab_{mode}.csv"
    if dest.exists():
        daily = pd.concat([pd.read_csv(dest), daily]).drop_duplicates("date", keep="last")
    daily = daily.sort_values("date").reset_index(drop=True)
    daily.to_csv(dest, index=False)
    print(f"Wrote {len(daily)} days to {dest}: median {daily.dose_msv_per_day.median():.2f} mSv/day, "
          f"max {daily.dose_msv_per_day.max():.2f} on {daily.loc[daily.dose_msv_per_day.idxmax(), 'date']}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("fetch"); f.add_argument("mode", choices=list(MODE_QUERY))
    f.add_argument("start"); f.add_argument("end")
    f.add_argument("--query", help="override the RadLab filters, e.g. 'spacecraft=ISS&instrument=REM'")
    f.add_argument("--id", help="use this instrument_id (detector) only")
    f.add_argument("--q", type=float, default=DEFAULT_QUALITY_FACTOR)
    fe = sub.add_parser("fetch-events", help="download a window around every cached DONKI event")
    fe.add_argument("mode", choices=list(MODE_QUERY))
    fe.add_argument("--query"); fe.add_argument("--id"); fe.add_argument("--q", type=float, default=DEFAULT_QUALITY_FACTOR)
    c = sub.add_parser("convert"); c.add_argument("mode", choices=list(MODE_QUERY))
    c.add_argument("--raw"); c.add_argument("--time"); c.add_argument("--dose"); c.add_argument("--unit")
    c.add_argument("--q", type=float, default=DEFAULT_QUALITY_FACTOR)
    a = ap.parse_args()
    if a.cmd == "fetch":
        df = fetch(a.mode, a.start, a.end, a.query)
        _save(a.mode, from_api_frame(df, a.id, a.q))
    elif a.cmd == "fetch-events":
        fetch_events(a.mode, a.query, a.id, a.q)
    else:
        raw = Path(a.raw) if a.raw else DATA_DIR / f"radlab_raw_{a.mode}.csv"
        _save(a.mode, convert(raw, a.time, a.dose, a.unit, a.q))
