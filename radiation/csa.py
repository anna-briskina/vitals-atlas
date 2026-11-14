"""Canadian Space Agency neutron measurements on the ISS (Radi-N and Radi-N2 bubble detectors).

Source file: data/csa_radi-n2_iss.csv, the ISS dataset the CSA released for the 2019 Space Apps Challenge
("Radi-N2 -ISS data.csv"). The CSA's original download folder is no longer online; this copy comes from a 2019
participant's public mirror (github.com/rominacarabathampi/CanadianSpaceAppChallenge). Ask the CSA mentor for an
official copy and its licence before publishing.

Each row is one detector exposed for about a week. "Calculated-Exposure(mrem)" is the neutron dose equivalent
over the session; 1 mrem = 10 uSv. Dividing by the session length gives a daily neutron dose rate.
The session length comes from the Measurement-Duration column (one end date in the file has a typo: 2019 for 2009).
"""
import csv
from pathlib import Path

FILE = Path(__file__).resolve().parent.parent / "data" / "csa_radi-n2_iss.csv"
MISSION = {"ROBERT THIRSK": ("Radi-N", "Robert Thirsk, Expedition 20/21"),
           "CHRIS HADFIELD": ("Radi-N2", "Chris Hadfield, Expedition 34/35"),
           "DAVID SAINT-JACQUES": ("Radi-N2", "David Saint-Jacques, Expedition 58")}


def sessions():
    if not FILE.exists():
        return []
    out, mission = [], None
    with FILE.open(newline="", encoding="utf-8", errors="replace") as f:
        for row in csv.reader(f):
            first = (row[0] if row else "").strip()
            if first.endswith("MISSION DATA"):
                mission = first.replace(" MISSION DATA", "")
                continue
            if len(row) >= 7 and first[:2] in ("20", "19") and row[2].strip().isdigit():
                minutes, mrem = float(row[2]), float(row[6])
                days = minutes / 1440
                exp, who = MISSION.get(mission, ("Radi-N2", mission or ""))
                out.append({"start": first, "days": round(days, 2), "detector": row[3].strip(),
                            "usv": mrem * 10, "usv_per_day": round(mrem * 10 / days, 1),
                            "experiment": exp, "mission": who})
    return out


def summary():
    s = sessions()
    if not s:
        return None
    rates = [x["usv_per_day"] for x in s]
    return {"sessions": len(s), "mean_usv_per_day": round(sum(rates) / len(rates), 1),
            "min_usv_per_day": min(rates), "max_usv_per_day": max(rates),
            "first": min(x["start"] for x in s), "last": max(x["start"] for x in s), "rows": s,
            "source": "CSA Radi-N / Radi-N2 bubble detectors, ISS (Space Apps 2019 dataset)"}


if __name__ == "__main__":
    sm = summary()
    for r in sm["rows"]:
        print(f"{r['start']}  {r['experiment']:8} {r['detector']:12} {r['days']:5} d  {r['usv']:6.0f} uSv  {r['usv_per_day']:6.1f} uSv/day")
    print({k: v for k, v in sm.items() if k != "rows"})
