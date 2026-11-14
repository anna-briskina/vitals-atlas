"""Show which DONKI storms can be replayed with measured RadLab dose, per mission setting.

Usage:  python -m radiation.check
"""
from datetime import date

from . import donki, radlab
from .radlab import COVERAGE


def main():
    evs = [e for e in donki.events() if e.get("date")]
    if not evs:
        print("No DONKI events cached. Run: python -m radiation.donki <start> <end>")
        return
    c = donki.counts()
    print(f"DONKI: {c['records']} cached records, {c['forecast_only']} forecast-only (dropped), "
          f"{c['storms']} observed storms after merging same-day records, "
          f"{min(e['date'] for e in evs)} to {max(e['date'] for e in evs)}\n")
    for mode, (lo, hi) in COVERAGE.items():
        df = radlab.load(mode)
        days = set(df["date"]) if df is not None else set()
        inside = [e for e in evs if lo <= e["date"] <= hi]
        covered = [e for e in inside if e["date"] in days]
        span = f"{min(days)} to {max(days)}, {len(days)} days" if days else "none loaded"
        print(f"{mode:8} RadLab data: {span}")
        print(f"         instrument coverage {lo} to {hi}: {len(inside)} DONKI events inside, "
              f"{len(covered)} with measured dose loaded")
        for e in covered[:10]:
            print(f"           real replay: {e['date']}  ({e['id']})")
        missing = [e for e in inside if e["date"] not in days]
        if missing:
            print(f"         {len(missing)} events inside coverage still simulated -> run: "
                  f"python -m radiation.radlab fetch-events {mode}")
        if not inside:
            yrs = f"{lo[:4]}-01-01 {hi[:4]}-12-31"
            print(f"         no cached storms in this instrument's years -> run: python -m radiation.donki {yrs}")
        print()


if __name__ == "__main__":
    main()
