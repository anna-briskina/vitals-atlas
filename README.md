# Crew Health: three-view prototype (NASA Space Apps 2026)

Health self-check for long-mission crews, built to the team's settled rules: three views (Normal, Emergency,
Crew doctor), staged alerts, NASA alert classes (red emergency/warning, yellow caution, blue advisory, always
colour + icon + word, and only in alerts), personal in-flight baselines, missing data never shown as normal,
predictions never worded as a diagnosis, the human confirms, works offline.

## Run it

```bash
pip install -r requirements.txt
python server.py            # http://localhost:5000
python tools/get_fonts.py   # optional, once: saves the two fonts locally so the look also works offline
```

Open several windows, one per tablet, to see the views stay in sync:

| URL | Tablet |
| --- | --- |
| `/?as=lena` | Lena, flight engineer (patient in scenario S2) |
| `/?as=sam` | Sam, crew doctor (adds the Crew doctor tab) |
| `/?as=ravi` | Ravi, backup crew medical officer |
| `/?as=maya` | Maya, commander (her wearable is off: shows the Stale and missing states) |

**Press D** to open or close the demo controls (hidden from the tablet screen). They switch the tablet and mission setting, raises the S2 heart caution, replays a solar particle
event, or resets everything.

## Look and layout (design team's health-caution.html, 2026-11-15)

- **Top bar:** GMT clock in NASA's form (`GMT 319/03:11:00`), Earth link and delay, the active alert in the centre
  (yellow caution, red emergency, neutral otherwise), and **Doctor** and **SOS** on every tablet.
- **Bottom navigation:** Health, Alerts, Crew; Emergency while one is active; Crew doctor on Sam's tablet.
- **Health tab:** one card per measure, drawn by the design's own rules, copied unchanged into
  `static/health-cards.js` (Parts 1 to 3: chart, measure definitions, pill colour rule, trend, reading, amount
  outside the range, reference sentence, stale and missing states, screen-reader sentences). One measure is added:
  the wearable ECG's ST segment. The server sends each person's data in the design's `crew-data.js` shape
  (`crew/engine.py`, `_health()`).
- **Check-in panel:** the design's panel, wired to the shared state (answers, 3-minute answer window, crew doctor
  seen time, heart reading, change answer).
- Icons are inline SVG (`static/icons.js`), so nothing needs an icon font.

## Scenario S2: staged heart alert (demo script)

1. Demo: raise the heart caution for Lena. Her wearable ECG's ST segment and heart rate have moved outside her own
   usual range. Lena's bar turns yellow ("Caution: Heart warning signs"), the check-in panel opens by itself, and
   the cards involved carry "In this caution". Sam gets a quiet blue advisory. Nobody else is told.
2. Lena answers "Do you have chest pain, pressure or discomfort?" (design file behaviour):
   Yes: the crew doctor is alerted now and decides; it does not declare an emergency. Not sure: take a heart reading,
   and the crew doctor is also alerted. No: take a heart reading. No answer within 3 minutes: the crew doctor is
   alerted, and she can still answer. Lena sees when Sam has seen it.
3. Sam (yellow bar: "Lena needs the crew doctor") opens the evidence: a table of criteria, each with Lena's value,
   met / not met / not yet known, and its basis. A 12-lead heart reading is checked against the published
   ST-elevation criterion. He can also run the ACTIS blood clot test (CSA D-dimer test, Crew-13; mock result) to
   rule out a clot, another cause of chest pain. Lena's own cards are below.
4. Sam decides (escalate, monitor, confirm, override) with a reason; every decision is recorded.
   Escalate starts a countdown he can stop, or "Send now".
5. Emergency on every tablet (red bar, Emergency tab first): each person's own action in the largest text;
   "I'm responding" / on the way / on scene; checklist with roles and recorded results; Lena's heart cards for the
   responders (emergency data only); report to Earth sent automatically with the earliest possible reply and
   "Continue without waiting".
6. Sam ends it with a reason and outcome. Every tablet returns to normal, crew access to Lena's data closes and Lena
   sees what was shared, with whom, and when. Past events are listed in the Alerts tab.

SOS on any tablet asks once, then declares a crew-wide emergency with that person's name and location.

### Where the readings come from

Every crew member has a tablet. Continuous readings (ECG, resting heart rate, sleep) come from a wearable paired
with it: a **smartwatch** or the CSA's **Bio-Monitor** smart shirt and headband (Carré Technologies, Montreal), which
measures heart activity, blood pressure, breathing, skin temperature, blood oxygen and movement, can be worn
during sleep and pairs with a tablet app (https://www.asc-csa.gc.ca/eng/sciences/bio-monitor.asp). Blood
pressure (cuff), core temperature and blood sugar are entered as check-ins. Values in the demo are not
Bio-Monitor data.

### What the heart alert is based on (`crew/heart.py`)

- **No probabilities, warning windows or invented track records.** The alert is a detection against criteria.
- **Screening rule (team design, to be tuned):** ST segment outside the person's own usual range on 3
  consecutive 10-minute averages, plus resting heart rate outside its usual range. A wearable ECG is a screening
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

## Local impact

Built for Mars, where the doctor is 14 minutes away. The same tool works where the doctor is a flight away.

The app's care model matches many of Canada's remote and northern fly-in communities:

| In space | In a remote community |
|---|---|
| A tablet for every crew member | A tablet per patient or household |
| A wearable (Bio-Monitor shirt or smartwatch) that flags changes early | The same wearable |
| A crew doctor who is not a specialist responds first | A community nurse responds first |
| A report to Earth with a communication delay | Telehealth or medevac with a delay of hours |

The CSA's own advisory council makes this link: technology for medical care far from a doctor also serves remote
communities in Canada ([Health Beyond report](https://www.asc-csa.gc.ca/eng/publications/health-beyond-report-advisory-council-deep-space-healthcare.asp)).
Canadian hardware runs through the app: the Bio-Monitor shirt is in use on the ISS right now by CSA astronaut Joshua
Kutryk ([Crew-13 science activities](https://www.asc-csa.gc.ca/eng/missions/crew-13/science-activities.asp)), and the
station neutron dose comes from CSA Radi-N/Radi-N2 measurements by Canadian astronauts.

Note: the Crew-13 experiments themselves do not state a northern-health goal; the link to remote communities is our
app's design, supported by the Health Beyond report.

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

## Canadian neutron data (CSA Radi-N / Radi-N2)

`data/csa_radi-n2_iss.csv` holds the ISS neutron measurements the Canadian Space Agency released for the 2019
Space Apps Challenge: 11 week-long bubble-detector sessions (Robert Thirsk 2009, Chris Hadfield 2012–13, David
Saint-Jacques 2019), 192 µSv/day on average. `python -m radiation.csa` prints them.

In the station setting the app uses them as the measured neutron dose: added to DosTel data when that is loaded
(silicon detectors mostly miss neutrons), or used to set the neutron share of the published ISS total. The CSA's
original download folder is offline; this copy comes from a 2019 participant's public mirror
(github.com/rominacarabathampi/CanadianSpaceAppChallenge). Ask the CSA for an official copy and its licence.
