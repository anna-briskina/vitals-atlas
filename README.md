# Vitals Atlas: radiation module

Health self-check dashboard for astronauts (NASA Space Apps 2026). This part projects an astronaut's
radiation dose against NASA's 600 mSv career limit, using real NASA data, and replays real solar storms.

## Run it

```bash
pip install -r requirements.txt
python server.py            # open http://localhost:5000
```

It runs straight away on published reference values and simulated recent data (labelled "Simulated").
Do the two steps below to switch to real data.

## 1. Load real solar storms (DONKI): 1 minute

```bash
python -m radiation.donki 2017-01-01 2024-12-31
```

Saves `data/donki_sep_<start>_<end>.json`. Reload the page: the storm list shows real solar particle events.
Needs internet once; after that it works offline from the cache.

## 2. Load real dose rates (RadLab): one command per mission setting

After step 1, download a window around every cached storm:

```bash
python -m radiation.radlab fetch-events mars
python -m radiation.radlab fetch-events station
python -m radiation.radlab fetch-events moon
```

This fetches about 25 days before to 10 days after each DONKI event (overlapping windows merged) and adds
them all to `data/radlab_<mode>.csv`. Every storm in the list then replays with its own measured dose.
Only events inside each instrument's coverage are fetched (Curiosity RAD 2015 to 2024, Chang'e 4 2019 to 2023,
ISS DosTel 2020 to 2022). Re-run it only after caching new DONKI events.

To add a single range: `python -m radiation.radlab fetch mars 2017-08-20 2017-10-20` (also merges).

When a storm's date is covered, its extra dose is the **measured** excess above the quiet days before it.
Otherwise the storm profile is simulated and labelled "Simulated".

Note for the pitch: the ISS sits inside Earth's magnetic field, so storms raise its dose much less than
they would in deep space.

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
