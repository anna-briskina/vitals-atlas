# Crew Health: three-view prototype (NASA Space Apps 2026)

Health self-check for long-mission crews, built to the team's settled rules: three views (Normal, Emergency,
Crew doctor), staged alerts, NASA alert classes (red emergency/warning, yellow caution, blue advisory, always
colour + icon + word, and only in alerts), personal in-flight baselines, missing data never shown as normal,
predictions never worded as a diagnosis, the human confirms, works offline.

## Run it

```bash
pip install -r requirements.txt
python server.py            # http://localhost:5000
```

Open several windows, one per tablet, to see the views stay in sync:

| URL | Tablet |
| --- | --- |
| `/?as=lena` | Lena, flight engineer (patient in scenario S2) |
| `/?as=sam` | Sam, crew doctor (tabs: My health, Crew doctor) |
| `/?as=ravi` | Ravi, backup crew medical officer |
| `/?as=maya` | Maya, commander and emergency recorder |

"Demo controls" (top right) starts scenario S2, replays a solar particle event, or resets everything.

## Scenario S2: staged heart alert (demo script)

1. Demo controls: issue the heart screening alert. Lena's chest strap ECG has moved outside her own usual
   range (with resting heart rate also outside its range). Lena sees a caution that says it is a screening
   signal, not a diagnosis; Sam gets a quiet advisory in his review list. Nobody else is told.
2. Lena answers the quick check. Yes: 10-second countdown to a crew-wide alert (she can stop it, which wakes
   only the crew doctor). Not sure: crew doctor woken. No: monitored.
3. Sam opens the evidence: a table of criteria, each with Lena's value, met / not met / not yet known, and its
   basis. He records a 12-lead Heart reading, which is checked against the published ST-elevation criterion.
4. Sam decides (escalate, monitor, confirm, override) with a reason; every decision is recorded.
   Escalate starts a countdown he can stop, or "Send now".
5. Emergency on every tablet: what, who, where, and each person's own action in the largest text; "I'm
   responding" / on the way / on scene; checklist with roles and recorded results; patient screen; report to
   Earth sent automatically with the earliest possible reply and "Continue without waiting".
6. Sam ends it with a reason and outcome (confirmed, false alarm, not yet known). Every tablet returns to
   normal, crew access to Lena's data closes and Lena sees what was shared, with whom, and when.

### What the heart alert is based on (`crew/heart.py`)

- **No probabilities, warning windows or invented track records.** The alert is a detection against criteria.
- **Screening rule (team design, to be tuned):** ST segment outside the person's own usual range on 3
  consecutive 10-minute averages, plus resting heart rate outside its usual range. A chest strap is a screening
  signal only.
- **Confirming criterion (published):** new ST elevation of at least 1 mm in two contiguous leads on a 12-lead
  ECG (Fourth Universal Definition of Myocardial Infarction, Thygesen et al., Circulation 2018). Meeting it
  means "possible heart attack"; diagnosis needs clinical assessment.
- **Personal baselines:** resting heart rate is unchanged in flight and blood pressure falls 8 to 10 mmHg
  (Norsk et al. 2015), so values are compared with in-flight usual ranges.
- **Alert history** counts this mission's own alerts and their recorded outcomes, starting at zero.
- All values are demo values for a fictional crew member. Treatment detail is mock content and is labelled.
  The example lab history in the crew doctor view is real Inspiration4 data (NASA OSDR OSD-569, OSD-575),
  labelled as an example, not Lena's.

## Radiation

The radiation module (`radiation/`) projects career dose against NASA's 600 mSv limit and replays real solar
particle events. A Mars or Moon event is a crew-wide emergency ("Go to the storm shelter now"); at the station
it is a caution directed by the ground radiation team.

## 1. Load real solar storms (DONKI): 1 minute

```bash
python -m radiation.donki 2017-01-01 2024-12-31
```

Saves `data/donki_sep_<start>_<end>.json`. Reload the page: the storm list shows real solar particle events.
Needs internet once; after that it works offline from the cache.

## 2. Load real dose rates (RadLab): one command per mission setting

```bash
python -m radiation.radlab fetch-events mars
python -m radiation.radlab fetch-events station
python -m radiation.radlab fetch-events moon
python -m radiation.check          # which storms replay with measured dose
```

- Downloads about 25 days before to 10 days after each observed DONKI storm, keeps every raw download in
  `data/radlab_raw/`, and builds `data/radlab_<mode>.csv`. `python -m radiation.radlab reconvert <mode>`
  rebuilds the daily file from the raw downloads without calling the API.
- Daily values are **time-weighted** (ISS detectors sample faster in high-radiation passes).
- Moon and Mars accept **surface** data only; orbiters such as LRO CRaTER are refused and the app falls back to
  the published surface rate.
- DONKI records that come only from **forecast models are dropped**, and records within a day are merged into
  one storm.
- A storm's measured extra dose counts only days **more than 3 robust standard deviations above** the quiet
  days before it, weighted for solar protons (quality factor 1.5 instead of 3). Otherwise the app says no
  increase was measured at that location.

## API (shared team format)

| Endpoint | Returns |
| --- | --- |
| `GET /api/systems?mode=mars&event=<sepID>` | All body systems for the body map; radiation computed live |
| `GET /api/radiation?mode=mars&event=<sepID>` | Full radiation detail: dose, projection, band, recent rates, storm, actions |
| `GET /api/donki/events` | Cached DONKI solar particle events |

`mode` is `station`, `moon` or `mars`. `event=demo` replays a simulated storm when no DONKI cache exists.
Other body systems come from `data/demo_systems.json` (simulated) until their modules replace them.

## How the projection works

1. Dose so far = prior career dose + each mission day's dose (last 30 days from RadLab when loaded).
2. Projection = dose so far + remaining days at the expected rate for each mission phase.
3. Status: red if the projection passes 600 mSv or a storm is under way; amber at 80% or more; green otherwise.
4. Uncertainty band = day-to-day variation in the data (at least ±10%).

All constants and their sources are in `radiation/config.py`.

## Sources

- NASA-STD-3001 Vol. 1: 600 mSv career effective dose limit
- Zeitlin et al. 2013 (Science); Hassler et al. 2014 (Science): Curiosity RAD cruise and Mars surface dose
- Zhang et al. 2020 (Science Advances): Chang'e 4 LND Moon surface dose
- CSA, "Monitoring Radiation for Astronaut Health" (2026): neutrons ~30% of ISS radiation
- NASA CCMC DONKI; NASA OSDR RadLab

Crew member, prior career dose and mission day are fictional demo values. Not a medical device.
