"""Mission profiles, limits and published reference values for the radiation module.

Every number here has a source. Change values in one place only: here.
"""

# NASA career effective dose limit for all astronauts (NASA-STD-3001 Vol. 1, Rev. B/C, 2022+).
CAREER_LIMIT_MSV = 600.0

# Status thresholds, as a share of the career limit reached by the END of the mission (projected).
AMBER_SHARE = 0.80   # projected to use 80% or more of the limit -> amber
RED_SHARE = 1.00     # projected to exceed the limit by mission end
# Red means "act now": a storm is under way, or the limit is passed / less than this many days away.
# A limit further away is amber ("plan changes needed"), so the dashboard is not red by default.
RED_HORIZON_DAYS = 60

# How a solar particle event is handled depends on where the crew is.
# Station: Earth's magnetic field shields most of each orbit; NASA's ground radiation team directs
#   precautions (no spacewalks, more-shielded modules during high-latitude passes) -> amber.
# Moon surface / deep space: no magnetic field or atmosphere -> shelter now -> red.
# Mars surface: the atmosphere gives partial protection; crew outside must return to the habitat -> red.
STORM_RESPONSE = {
    "station": {
        "status": "amber", "who": "ground_team",
        "banner": "Solar particle event: spacewalks on hold. Follow ground radiation team instructions.",
        "actions": [
            ("Spacewalks postponed until the alert clears.", "ground_team"),
            ("During high-latitude parts of the orbit, stay in the more shielded modules if the ground team asks.", "self"),
        ],
    },
    "moon_surface": {
        "status": "red", "who": "crew_now",
        "banner": "Radiation alert: solar particle event. Whole crew to the storm shelter now.",
        "actions": [
            ("Whole crew to the storm shelter now; stay until the alert clears.", "crew_now"),
            ("Cancel surface excursions; anyone outside returns immediately.", "crew_now"),
        ],
    },
    "deep_space": {
        "status": "red", "who": "crew_now",
        "banner": "Radiation alert: solar particle event. Whole crew to the storm shelter now.",
        "actions": [
            ("Whole crew to the storm shelter now; stay until the alert clears.", "crew_now"),
            ("Postpone spacewalks.", "crew_now"),
        ],
    },
    "mars_surface": {
        "status": "red", "who": "crew_now",
        "banner": "Radiation alert: solar particle event. Crew outside return to the habitat now.",
        "actions": [
            ("Anyone outside returns to the habitat now; cancel surface excursions.", "crew_now"),
            ("Stay in the habitat's most shielded area until the alert clears.", "crew_now"),
        ],
    },
}

# Published dose-equivalent rates (mSv/day), used when no RadLab data has been loaded.
# Mars cruise and surface: Curiosity RAD (Zeitlin et al. 2013, Science; Hassler et al. 2014, Science).
# ISS: typical 0.3 to 0.8 mSv/day depending on solar cycle and altitude (NASA); we use 0.5 as a midpoint.
# Moon surface: Chang'e 4 LND (Zhang et al. 2020, Science Advances): ~1.37 mSv/day dose equivalent.
PUBLISHED_RATES_MSV_PER_DAY = {
    "station": 0.5,
    "moon_surface": 1.37,
    "deep_space": 1.84,
    "mars_surface": 0.64,
}

# Average quality factor to turn absorbed dose (Gy) into dose equivalent (Sv) for galactic cosmic rays.
# Curiosity RAD measured roughly 3.0 to 3.8 (Zeitlin 2013, Hassler 2014). Override per instrument if known.
DEFAULT_QUALITY_FACTOR = 3.0

# CSA: neutrons are about 30% of total radiation on the ISS ("Monitoring Radiation for Astronaut Health", Feb 2026).
ISS_NEUTRON_SHARE = 0.30

# One-way light time to Earth, shown in the UI.
DELAY_TEXT = {"station": "near-live", "moon": "~1.3 s each way", "mars": "~4 to 24 min each way"}

# Mission profiles: ordered phases, each with a length in days and an environment key above.
# The Mars profile is a typical long-stay "conjunction class" mission (~180 d out, ~500 d surface, ~180 d back).
MISSIONS = {
    "station": {
        "label": "Space station, 6 months",
        "phases": [{"name": "Station", "days": 180, "env": "station"}],
        "radlab_instrument": "ISS (DosTel / REM)",
    },
    "moon": {
        "label": "Moon base, 1 year",
        "phases": [
            {"name": "Transit to Moon", "days": 4, "env": "deep_space"},
            {"name": "Moon surface", "days": 357, "env": "moon_surface"},
            {"name": "Transit home", "days": 4, "env": "deep_space"},
        ],
        "radlab_instrument": "Chang'e 4 LND (Moon surface)",
    },
    "mars": {
        "label": "Mars, ~2.4 years",
        "phases": [
            {"name": "Cruise to Mars", "days": 180, "env": "deep_space"},
            {"name": "Mars surface", "days": 500, "env": "mars_surface"},
            {"name": "Cruise home", "days": 180, "env": "deep_space"},
        ],
        "radlab_instrument": "Curiosity MSL/RAD (Mars surface)",
    },
}

# Demo crew member (fictional). Prior career dose from earlier missions, in mSv.
DEMO_CREW = {"name": "Cmdr. A. Rivera (demo)", "prior_career_dose_msv": 40.0, "mission_day": {"station": 95, "moon": 140, "mars": 300}}

SOURCES = {
    "limit": "NASA-STD-3001 Vol. 1: career effective dose limit 600 mSv",
    "mars": "Zeitlin et al. 2013 (Science); Hassler et al. 2014 (Science): Curiosity RAD",
    "moon": "Zhang et al. 2020 (Science Advances): Chang'e 4 LND",
    "neutrons": "CSA, Monitoring Radiation for Astronaut Health (2026)",
    "donki": "NASA CCMC DONKI space weather database",
    "radlab": "NASA OSDR RadLab",
}
