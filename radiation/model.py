"""Radiation dose projection against NASA's career limit.

What it does, in plain words:
  1. Dose so far  = prior career dose + every mission day's dose up to today.
  2. Projection   = dose so far + the rest of the mission at the expected daily rate per phase.
  3. Status       = red if the projection passes the 600 mSv career limit (or a storm is under way),
                    amber if it uses 80% or more, green otherwise.
  4. Storm replay = a real DONKI solar particle event; if RadLab data covers that date, the extra
                    dose is the MEASURED excess above the usual rate. Otherwise a labelled simulated profile.

Data provenance is carried on every series: "real" (RadLab / DONKI), "published" (paper values) or "simulated".
"""
import math
import random

import pandas as pd

from . import donki, radlab
from .config import (AMBER_SHARE, CAREER_LIMIT_MSV, DELAY_TEXT, DEMO_CREW, ISS_NEUTRON_SHARE, MISSIONS,
                     PUBLISHED_RATES_MSV_PER_DAY, RED_HORIZON_DAYS, RED_SHARE, SOURCES, STORM_RESPONSE)

SURFACE_ENV = {"station": "station", "moon": "moon_surface", "mars": "mars_surface"}
RECENT_DAYS = 30
STORM_WINDOW = (-2, 8)  # days around the event used to measure the extra dose


def _phase_rates(mode, rates):
    """One expected rate per mission day (index 0 = day 1)."""
    out = []
    for ph in MISSIONS[mode]["phases"]:
        out += [rates[ph["env"]]] * ph["days"]
    return out


def _phases_upto(mode, day):
    """Yield the phase that contains `day` (first match)."""
    d = 0
    for ph in MISSIONS[mode]["phases"]:
        d += ph["days"]
        if day <= d:
            yield ph
            return
    yield MISSIONS[mode]["phases"][-1]


def _phase_at(mode, day):
    d = 0
    for ph in MISSIONS[mode]["phases"]:
        d += ph["days"]
        if day <= d:
            return ph["name"]
    return MISSIONS[mode]["phases"][-1]["name"]


def _simulated_recent(base, n, seed):
    rnd = random.Random(seed)
    return [round(base * (1 + rnd.gauss(0, 0.06)), 3) for _ in range(n)]


def _recent_window(mode, base_rate, event):
    """Daily dose rates for the RECENT_DAYS-day window shown in the app, real if RadLab data exists.

    No storm: the latest RECENT_DAYS days in the RadLab file.
    Storm:    the RECENT_DAYS days ending STORM_WINDOW[1] days after the event, if the file covers the event
              date. The extra dose is the measured excess above the quiet days just before the event.
    Returns (values, dates, source, storm_extra_msv, storm_source, cv, usual_rate).
    """
    df = radlab.load(mode)
    if df is not None and len(df) >= 7:
        df = df.sort_values("date").drop_duplicates("date", keep="last").reset_index(drop=True)
        df["d"] = pd.to_datetime(df["date"])
        rate = df["dose_msv_per_day"]
        median = float(rate.median())
        cv = float(rate.std() / median) if median else 0.1
        day = pd.Timedelta(days=1)

        ev_day = pd.to_datetime(event["date"]) if event and event.get("date") else None
        covered = ev_day is not None and (df["d"] == ev_day).any()
        if covered:
            end = ev_day + STORM_WINDOW[1] * day
            seg = df[(df["d"] > end - RECENT_DAYS * day) & (df["d"] <= end)]
            quiet = df[(df["d"] >= ev_day - 21 * day) & (df["d"] <= ev_day + (STORM_WINDOW[0] - 1) * day)]
            base = float(quiet["dose_msv_per_day"].median()) if len(quiet) >= 5 else median
            storm = df[(df["d"] >= ev_day + STORM_WINDOW[0] * day) & (df["d"] <= end)]
            extra = float((storm["dose_msv_per_day"] - base).clip(lower=0).sum())
            return seg["dose_msv_per_day"].tolist(), seg["date"].tolist(), "real", extra, "real", cv, median

        last = df["d"].max()
        seg = df[df["d"] > last - RECENT_DAYS * day]
        vals, extra, storm_src = seg["dose_msv_per_day"].tolist(), 0.0, None
        if event:
            # RadLab does not cover this event date: real baseline, simulated storm on top
            vals, extra = _add_simulated_storm(vals, median)
            storm_src = "simulated"
        return vals, seg["date"].tolist(), "real", extra, storm_src, cv, median
    # no RadLab data yet: simulated around the published rate
    vals = _simulated_recent(base_rate, RECENT_DAYS, seed=mode)
    extra, storm_src = 0.0, None
    if event:
        vals, extra = _add_simulated_storm(vals, base_rate)
        storm_src = "simulated"
    return vals, None, "simulated", extra, storm_src, 0.06, base_rate


def _add_simulated_storm(vals, base):
    """Illustrative storm profile (multiples of the usual rate) placed near the end of the window.
    Clearly simulated: replace with RadLab data that covers a real DONKI event."""
    profile = [1.0, 3.0, 2.2, 1.6, 1.3, 1.1]
    vals = list(vals)
    while len(vals) < len(profile):
        vals.insert(0, base)
    start = len(vals) - len(profile)
    extra = 0.0
    for k, m in enumerate(profile):
        new = base * m
        extra += max(0.0, new - base)
        vals[start + k] = round(new, 3)
    return vals, extra


def _find_event(event_id):
    if not event_id:
        return None
    for ev in donki.events():
        if ev["id"] == event_id:
            return ev
    # a demo event when no DONKI cache exists yet (labelled simulated)
    if event_id == "demo":
        return {"id": "demo", "date": None, "time": None, "source": "simulated", "instruments": [], "link": None}
    return None


def project(mode="mars", event_id=None):
    if mode not in MISSIONS:
        raise ValueError(f"unknown mode {mode}")
    rates = dict(PUBLISHED_RATES_MSV_PER_DAY)
    rate_source = "published"
    event = _find_event(event_id)

    base_env = SURFACE_ENV[mode]
    recent, recent_dates, recent_src, storm_extra, storm_src, cv, measured_rate = _recent_window(
        mode, rates[base_env], event)
    if recent_src == "real":
        rates[base_env] = measured_rate  # use the measured usual rate for this environment
        rate_source = "real"

    daily = _phase_rates(mode, rates)
    total_days = len(daily)
    today = min(DEMO_CREW["mission_day"][mode], total_days)
    prior = DEMO_CREW["prior_career_dose_msv"]

    # past: expected rates up to today, with the last RECENT_DAYS replaced by the recent window
    past_rates = daily[:today]
    k = min(RECENT_DAYS, today)
    past_rates[-k:] = recent[-k:]

    cum, s = [], prior
    for d, r in enumerate(past_rates, start=1):
        s += r
        cum.append({"day": d, "value": round(s, 1), "kind": "so_far"})
    so_far = s

    # projection with an uncertainty band from day-to-day variation (at least +/-10%)
    spread = max(0.10, min(0.35, cv * 2))
    proj, band_lo, band_hi = [], [], []
    p = lo = hi = so_far
    for d in range(today + 1, total_days + 1):
        r = daily[d - 1]
        p += r; lo += r * (1 - spread); hi += r * (1 + spread)
        proj.append({"day": d, "value": round(p, 1), "kind": "projection"})
        band_lo.append(round(lo, 1)); band_hi.append(round(hi, 1))
    projected_total = p

    limit_day = None
    for pt in cum + proj:
        if pt["value"] >= CAREER_LIMIT_MSV:
            limit_day = pt["day"]
            break

    share = projected_total / CAREER_LIMIT_MSV
    storm_active = event is not None
    # where the crew is today decides how serious a storm is
    env_today = next(ph["env"] for ph in _phases_upto(mode, today))
    storm_rule = STORM_RESPONSE[env_today] if storm_active else None

    limit_soon = limit_day is not None and limit_day - today <= RED_HORIZON_DAYS
    rank = {"green": 0, "amber": 1, "red": 2}
    if limit_soon:
        status = "red"
    elif share >= AMBER_SHARE:
        status = "amber"
    else:
        status = "green"
    if storm_rule and rank[storm_rule["status"]] > rank[status]:
        status = storm_rule["status"]

    if limit_day and limit_day <= today:
        headline = f"Career limit already passed on mission day {limit_day}."
    elif limit_day:
        headline = (f"On track to pass the {int(CAREER_LIMIT_MSV)} mSv career limit on mission day {limit_day} "
                    f"of {total_days}, in {limit_day - today} days. Dose plan changes needed.")
    else:
        headline = f"Projected to end the mission at {projected_total:.0f} mSv, {share:.0%} of the career limit."
    if storm_active:
        headline = "Solar particle event under way. " + headline

    actions = []
    if storm_rule:
        actions += [{"text": t, "who": w} for t, w in storm_rule["actions"]]
    if share >= AMBER_SHARE:
        actions.append({"text": "Sleep in the shielded area to cut daily dose.", "who": "self"})
        if share > RED_SHARE:
            actions.append({"text": "Ask flight surgeons to review the mission dose plan (fewer excursions, shorter stay).",
                            "who": "ground"})
    if not actions:
        actions.append({"text": "Nothing to do. You will be alerted if space weather changes.", "who": "self"})

    breakdown = None
    if mode == "station":
        breakdown = {"neutrons_share": ISS_NEUTRON_SHARE, "note": "Neutrons are ~30% of ISS radiation (CSA, 2026)"}

    return {
        "system": "radiation",
        "status": status,
        "headline": headline,
        "nasaRisk": "Risk of Radiation-Induced Cancers",
        "mission": {"mode": mode, "label": MISSIONS[mode]["label"], "today": today, "totalDays": total_days,
                    "phaseToday": _phase_at(mode, today), "delay": DELAY_TEXT[mode],
                    "instrument": MISSIONS[mode]["radlab_instrument"]},
        "dose": {"priorCareer": prior, "soFar": round(so_far, 1), "projectedTotal": round(projected_total, 1),
                 "limit": CAREER_LIMIT_MSV, "shareOfLimit": round(share, 3), "limitDay": limit_day,
                 "todayRate": round(recent[-1], 3)},
        "cumulative": cum,
        "projection": proj,
        "band": {"low": band_lo, "high": band_hi, "spread": round(spread, 3)},
        "recent": {"values": [round(v, 3) for v in recent], "dates": recent_dates, "source": recent_src,
                   "unit": "mSv/day"},
        "storm": None if not event else {
            "id": event["id"], "date": event.get("date"), "link": event.get("link"),
            "eventSource": event.get("source"), "doseSource": storm_src, "extraDose": round(storm_extra, 2),
            "banner": storm_rule["banner"], "severity": storm_rule["status"], "where": env_today},
        "breakdown": breakdown,
        "actions": actions,
        "whoActs": storm_rule["who"] if storm_rule else ("ground" if status == "red" else "self"),
        "source": rate_source,
        "assumptions": [
            f"Expected daily rates per phase: {SOURCES['mars']}; {SOURCES['moon']}; ISS ~0.5 mSv/day.",
            f"Absorbed dose converted to dose equivalent with quality factor ~3 (Curiosity RAD).",
            f"Uncertainty band +/-{spread:.0%} from day-to-day variation in the data (min 10%).",
            "Prior career dose (40 mSv) and mission day are demo values for a fictional crew member.",
        ],
        "sources": SOURCES,
    }


def summary(mode="mars", event_id=None):
    """Small version for the body map."""
    r = project(mode, event_id)
    return {k: r[k] for k in ("system", "status", "headline", "nasaRisk", "whoActs", "source")}


if __name__ == "__main__":
    import json
    for m in ("station", "moon", "mars"):
        r = project(m)
        print(m, r["status"], r["headline"], r["dose"])
    print(json.dumps(project("mars", "demo")["storm"], indent=2))
