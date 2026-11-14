"""Real dose-rate measurements from NASA OSDR RadLab.

FETCH A WINDOW AROUND EVERY CACHED DONKI STORM (recommended, run once per mission setting):
    python -m radiation.radlab fetch-events mars
    python -m radiation.radlab fetch-events station
    python -m radiation.radlab fetch-events moon

FETCH one date range (adds to what is already saved):
    python -m radiation.radlab fetch mars 2017-08-20 2017-10-20

REBUILD the daily file from the raw downloads already on disk (no API calls):
    python -m radiation.radlab reconvert station

Every raw download is kept in data/radlab_raw/<mode>_<start>_<end>.csv, so the daily file can be rebuilt
when the conversion changes. The daily file is data/radlab_<mode>.csv (one row per day).

Conversion rules:
  * Daily values are TIME-WEIGHTED means: each reading counts for the time until the next reading. Some ISS
    detectors sample several times faster during high-radiation passes, so a plain mean of readings
    overstates the daily dose (several-fold for DosTel).
  * Measured dose equivalent (uSv/h) is used when the instrument reports it; otherwise absorbed dose
    (uGy/h) x the galactic cosmic ray quality factor. The factor applied is stored in column "q"
    (0 = measured dose equivalent), so storm doses can be re-weighted for solar protons in model.py.
  * Moon and Mars settings accept SURFACE data only; an orbiter (e.g. LRO CRaTER) is refused.

API reference: https://visualization.osdr.nasa.gov/radlab/api  (GET, key-value syntax, format=csv)
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
RAW_DIR = DATA_DIR / "radlab_raw"
API = "https://visualization.osdr.nasa.gov/radlab/api/"

# RadLab key-value filters per mission setting (spaces as %20).
MODE_QUERY = {
    "mars": "instrument=RAD&trajectory=Mars%20surface",        # Curiosity MSL/RAD, Mars surface
    "moon": "celestial_body=Moon&trajectory=Surface",           # lunar SURFACE only (Chang'e 4 LND), not orbiters
    "station": "spacecraft=ISS&instrument=DosTel",              # DosTel1/DosTel2, ISS Columbus module
}
SURFACE_REQUIRED = {"mars", "moon"}

_UNIT_TO_MILLI_PER_DAY = {
    "ugy/h": 24 / 1000, "ugy/hr": 24 / 1000, "ugy/hour": 24 / 1000, "ugy/d": 1 / 1000, "ugy/day": 1 / 1000,
    "mgy/d": 1.0, "mgy/day": 1.0, "mgy/h": 24.0, "ngy/s": 86400 / 1e6, "ugy/min": 1440 / 1000,
    "usv/h": 24 / 1000, "usv/hr": 24 / 1000, "usv/hour": 24 / 1000, "usv/d": 1 / 1000, "usv/day": 1 / 1000,
    "msv/d": 1.0, "msv/day": 1.0,
}


# ---------------------------------------------------------------- time-weighted daily means
def time_weighted_daily(times, values):
    """Daily mean of a rate, weighting each reading by the time until the next one.

    Gaps longer than 10x the median sampling interval are capped at that, so a data outage does not
    stretch one reading over hours. Returns a DataFrame with date and value."""
    d = pd.DataFrame({"t": times, "v": values}).dropna().sort_values("t").reset_index(drop=True)
    if d.empty:
        return pd.DataFrame(columns=["date", "v"])
    dt = d["t"].shift(-1).sub(d["t"]).dt.total_seconds()
    med = float(dt.median()) if dt.notna().any() else 60.0
    dt = dt.fillna(med).clip(lower=0, upper=10 * med)
    d["w"] = dt
    d["vw"] = d["v"] * d["w"]
    d["date"] = d["t"].dt.strftime("%Y-%m-%d")
    g = d.groupby("date").agg(vw=("vw", "sum"), w=("w", "sum"), n=("v", "size"))
    g = g[g["w"] > 0]
    out = (g["vw"] / g["w"]).rename("v").reset_index()
    return out


# ---------------------------------------------------------------- API fetch
def build_url(mode, start, end, query=None):
    q = query or MODE_QUERY[mode]
    return (f"{API}?{q}&timestamp>={start}&timestamp<{end}"
            f"&absorbed_dose_rate&dose_equivalent_rate&trajectory&spacecraft&format=csv")


def fetch(mode, start, end, query=None, timeout=180):
    url = build_url(mode, start, end, query)
    print(f"GET {url}")
    r = requests.get(url, timeout=timeout)
    r.raise_for_status()
    text = r.text
    first = text.strip().splitlines()[0].lower() if text.strip() else ""
    if "timestamp" not in first:
        raise SystemExit(f"RadLab returned no data for {mode} {start} to {end}.")
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    (RAW_DIR / f"{mode}_{start}_{end}.csv").write_text(text)
    df = pd.read_csv(io.StringIO(text))
    print(f"Downloaded {len(df)} readings. Detectors: {dict(Counter(df.get('instrument_id', pd.Series(['?']))))}")
    return df


def from_api_frame(df, mode, instrument_id=None, q=DEFAULT_QUALITY_FACTOR):
    """Daily mSv/day from a RadLab API frame, from one detector (the one with most readings unless given)."""
    df = df.copy()
    df.columns = [c.lower() for c in df.columns]
    if mode in SURFACE_REQUIRED and "trajectory" in df.columns:
        traj = set(df["trajectory"].dropna().astype(str))
        if not any("surface" in t.lower() for t in traj):
            raise SystemExit(f"Refused: {mode} needs surface data, but RadLab returned {sorted(traj)} "
                             f"(e.g. an orbiter). The app will use the published surface rate instead.")
        df = df[df["trajectory"].astype(str).str.lower().str.contains("surface")]
    chosen = None
    if "instrument_id" in df.columns:
        ids = df["instrument_id"].dropna()
        chosen = instrument_id or (ids.value_counts().index[0] if len(ids) else None)
        if chosen is not None:
            df = df[df["instrument_id"] == chosen]
    craft = df["spacecraft"].dropna().astype(str).iloc[0] if "spacecraft" in df.columns and df["spacecraft"].notna().any() else ""
    label = " ".join(x for x in (craft, str(chosen or "")) if x).strip() or "RadLab detector"
    de = pd.to_numeric(df["dose_equivalent_rate"], errors="coerce") if "dose_equivalent_rate" in df else None
    ad = pd.to_numeric(df["absorbed_dose_rate"], errors="coerce") if "absorbed_dose_rate" in df else None
    if de is not None and de.notna().sum() > len(df) * 0.5:
        rate, qa, how = de * 24 / 1000, 0.0, "measured dose equivalent rate (uSv/h)"
    elif ad is not None and ad.notna().any():
        rate, qa, how = ad * 24 / 1000 * q, q, f"absorbed dose rate (uGy/h) x quality factor {q}"
    else:
        raise SystemExit("No dose values in the download.")
    t = pd.to_datetime(df["timestamp"], utc=True, errors="coerce", format="mixed")
    gaps = t.sort_values().diff().dt.total_seconds()
    if gaps.notna().any():
        print(f"Detector {label}: sampling interval median {gaps.median():.0f} s, "
              f"shortest 5% {gaps.quantile(0.05):.0f} s (time-weighting corrects for uneven sampling)")
    print(f"Converted from {how}")
    daily = time_weighted_daily(t, rate).rename(columns={"v": "dose_msv_per_day"})
    daily["q"] = qa
    daily["instrument"] = label
    daily["source"] = "real"
    return daily


# ---------------------------------------------------------------- one window per DONKI storm
COVERAGE = {"mars": ("2015-01-01", "2024-12-31"), "moon": ("2019-01-01", "2023-12-31"), "station": ("2020-01-01", "2022-12-31")}


def storm_windows(mode, before=25, after=10):
    """Date ranges around every observed DONKI storm inside the instrument's coverage, overlaps merged."""
    from datetime import date, timedelta
    from . import donki
    lo, hi = (date.fromisoformat(d) for d in COVERAGE[mode])
    spans = []
    for ev in donki.events():
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
        raise SystemExit(f"No cached DONKI storms inside {mode} coverage {COVERAGE[mode]}. "
                         "Run python -m radiation.donki <start> <end> for those years first.")
    print(f"{len(wins)} download windows cover the DONKI storms for {mode}.")
    for i, (s, e) in enumerate(wins, 1):
        print(f"[{i}/{len(wins)}] {s} to {e}")
        try:
            _save(mode, from_api_frame(fetch(mode, s, e, query), mode, instrument_id, q))
        except SystemExit as err:
            print(f"  skipped: {err}")


def reconvert(mode, instrument_id=None, q=DEFAULT_QUALITY_FACTOR):
    """Rebuild data/radlab_<mode>.csv from every raw download on disk, with the current conversion."""
    files = sorted(RAW_DIR.glob(f"{mode}_*.csv"))
    if not files:
        raise SystemExit(f"No raw downloads for {mode} in {RAW_DIR}. Run fetch-events {mode} first.")
    parts = []
    for f in files:
        try:
            parts.append(from_api_frame(pd.read_csv(f), mode, instrument_id, q))
        except SystemExit as err:
            print(f"  {f.name} skipped: {err}")
    if not parts:
        raise SystemExit("Nothing could be converted.")
    dest = DATA_DIR / f"radlab_{mode}.csv"
    dest.unlink(missing_ok=True)
    _save(mode, pd.concat(parts))


# ---------------------------------------------------------------- CSV from the website
def _norm_unit(u):
    return (u or "").lower().replace("µ", "u").replace("μ", "u").replace(" ", "").replace("[", "").replace("]", "")


def convert(raw_csv, mode, time_col=None, dose_col=None, unit=None, q=DEFAULT_QUALITY_FACTOR):
    """Daily mSv/day from a CSV exported on the RadLab website (auto-detects columns)."""
    df = pd.read_csv(raw_csv, comment="#")
    if "timestamp" in [c.lower() for c in df.columns] and not (time_col or dose_col or unit):
        return from_api_frame(df, mode, q=q)
    cols = list(df.columns)
    time_col = time_col or next((c for c in cols if re.search(r"time|date|utc", c, re.I)), cols[0])
    if not dose_col:
        cands = [c for c in cols if re.search(r"dose", c, re.I) and pd.api.types.is_numeric_dtype(df[c])]
        dose_col = cands[0] if cands else None
    if not unit and dose_col:
        m = re.search(r"([uµμmn]?(?:Gy|Sv)\s*/\s*(?:h|hr|hour|d|day|s|min))", dose_col, re.I)
        unit = m.group(1) if m else None
    print(f"Columns: {cols}\nUsing time='{time_col}', dose='{dose_col}', unit='{unit}'")
    if dose_col is None or unit is None:
        raise SystemExit("Could not detect the dose column or its unit. Pass --dose and --unit.")
    key = _norm_unit(unit)
    if key not in _UNIT_TO_MILLI_PER_DAY:
        raise SystemExit(f"Unknown unit '{unit}'. Known: {sorted(_UNIT_TO_MILLI_PER_DAY)}")
    rate = df[dose_col].astype(float) * _UNIT_TO_MILLI_PER_DAY[key]
    qa = q if "gy" in key else 0.0
    if qa:
        rate = rate * q
    t = pd.to_datetime(df[time_col], utc=True, errors="coerce")
    daily = time_weighted_daily(t, rate).rename(columns={"v": "dose_msv_per_day"})
    daily["q"], daily["instrument"], daily["source"] = qa, "RadLab export", "real"
    return daily


def load(mode):
    """Daily series for a mission setting, or None if no RadLab data has been saved yet."""
    p = DATA_DIR / f"radlab_{mode}.csv"
    if not p.exists():
        return None
    df = pd.read_csv(p)
    if "q" not in df.columns:            # file from an older version: assume absorbed dose x default factor
        df["q"] = DEFAULT_QUALITY_FACTOR
    if "instrument" not in df.columns:
        df["instrument"] = "RadLab detector"
    return df


def _save(mode, daily):
    """Merge new days into data/radlab_<mode>.csv (new values win)."""
    dest = DATA_DIR / f"radlab_{mode}.csv"
    if dest.exists():
        daily = pd.concat([load(mode), daily]).drop_duplicates("date", keep="last")
    daily = daily.sort_values("date").reset_index(drop=True)
    daily.to_csv(dest, index=False)
    print(f"Wrote {len(daily)} days to {dest}: median {daily.dose_msv_per_day.median():.3f} mSv/day")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("fetch"); f.add_argument("mode", choices=list(MODE_QUERY))
    f.add_argument("start"); f.add_argument("end")
    f.add_argument("--query"); f.add_argument("--id"); f.add_argument("--q", type=float, default=DEFAULT_QUALITY_FACTOR)
    fe = sub.add_parser("fetch-events"); fe.add_argument("mode", choices=list(MODE_QUERY))
    fe.add_argument("--query"); fe.add_argument("--id"); fe.add_argument("--q", type=float, default=DEFAULT_QUALITY_FACTOR)
    rc = sub.add_parser("reconvert"); rc.add_argument("mode", choices=list(MODE_QUERY))
    rc.add_argument("--id"); rc.add_argument("--q", type=float, default=DEFAULT_QUALITY_FACTOR)
    c = sub.add_parser("convert"); c.add_argument("mode", choices=list(MODE_QUERY))
    c.add_argument("--raw", required=True); c.add_argument("--time"); c.add_argument("--dose"); c.add_argument("--unit")
    c.add_argument("--q", type=float, default=DEFAULT_QUALITY_FACTOR)
    a = ap.parse_args()
    if a.cmd == "fetch":
        _save(a.mode, from_api_frame(fetch(a.mode, a.start, a.end, a.query), a.mode, a.id, a.q))
    elif a.cmd == "fetch-events":
        fetch_events(a.mode, a.query, a.id, a.q)
    elif a.cmd == "reconvert":
        reconvert(a.mode, a.id, a.q)
    else:
        _save(a.mode, convert(Path(a.raw), a.mode, a.time, a.dose, a.unit, a.q))
