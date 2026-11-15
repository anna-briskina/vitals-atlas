# Data used in Crew Health

Every input the app uses, the values we take from it, and how we process it.

## 1. Real measured data

| Data | Source | What we use | Preprocessing |
|---|---|---|---|
| **Solar storms** | [NASA DONKI](https://kauai.ccmc.gsfc.nasa.gov/DONKI/) SEP API via [api.nasa.gov](https://api.nasa.gov/) (`radiation/donki.py`) | Storm list for "Storm replay": date, ID, instruments, link | Fetched in 60-day pieces (API limit). **Forecast-model-only records dropped.** Records within 1 day of each other **merged into one storm**. |
| **Space radiation dose rates** | [NASA OSDR RadLab](https://visualization.osdr.nasa.gov/radlab/gui/) ([API](https://visualization.osdr.nasa.gov/radlab/api/)) (`radiation/radlab.py`). Mars: Curiosity RAD (surface only). Station: ISS DosTel. | Daily dose rate for the "last 30 days" chart, the usual rate for projections, and measured storm doses | See [RadLab preprocessing](#radlab-preprocessing) below |
| **ISS neutron dose** | [CSA Radi-N2](https://www.asc-csa.gc.ca/eng/sciences/radi-n2.asp) bubble detectors (`data/csa_radi-n2_iss.csv`, CSA's 2019 Space Apps dataset via [this GitHub mirror](https://github.com/rominacarabathampi/CanadianSpaceAppChallenge); CSA's original folder is offline) | 11 week-long readings, 2009–2019 (Thirsk, Hadfield, Saint-Jacques). Average **192 µSv/day**, range 109–219 | mrem × 10 → µSv, ÷ session length (minutes ÷ 1440) → µSv/day. Average is a **plain mean of the 11 readings** (not weighted by session length). Saint-Jacques's two detectors in the same week count as 2 readings. |
| **Example lab history** | NASA OSDR, Inspiration4 crew member C001 ([OSD-569](https://osdr.nasa.gov/bio/repo/data/studies/OSD-569) blood count, [OSD-575](https://osdr.nasa.gov/bio/repo/data/studies/OSD-575) metabolic panel) | 5 analytes (glucose, potassium, creatinine, haemoglobin, white cells) at 7 time points, with the lab's own normal ranges | Copied as reported; we only chose which 5 to show. Labelled as an example, not Lena's data. |
| **Wearable source (reference only)** | [CSA Bio-Monitor](https://www.asc-csa.gc.ca/eng/sciences/bio-monitor.asp) | Cited as one of the two wearable options (Bio-Monitor shirt or smartwatch) for ECG, heart rate and sleep; in use on Crew-13 ([CSA Crew-13 science activities](https://www.asc-csa.gc.ca/eng/missions/crew-13/science-activities.asp)) | None. No Bio-Monitor data is used; vitals are demo values. |

### RadLab preprocessing

1. Moon and Mars downloads that aren't surface data (e.g. the LRO orbiter) are **refused**.
2. Only the detector with the most readings is kept.
3. Unit conversion:
   - Dose equivalent reported: µSv/h × 24 ÷ 1000 → mSv/day.
   - Otherwise: absorbed dose µGy/h × 24 ÷ 1000 × **quality factor 3** → mSv/day.
4. **Time-weighted daily means**, because ISS detectors sample faster in high-radiation passes. Gaps longer than 10× the usual sampling interval are capped, so an outage doesn't stretch one reading over hours.
5. **Storm extra dose:**
   - Baseline = median of the quiet days in the 3 weeks before the storm.
   - A day counts only if it is more than **3 robust standard deviations** above baseline (1.4826 × median absolute deviation).
   - The excess on those days is re-weighted from quality factor 3 to **1.5** (solar protons).
   - If no day passes, the app says no increase was measured.
6. **Station only:** the CSA neutron average is added to the DosTel daily dose, because silicon detectors mostly miss neutrons.

DONKI and RadLab data exist only on the machine that ran the fetch commands. Without them, the app falls back to the published rates in section 2.

## 2. Published reference values (constants in `radiation/config.py`)

| Value | Used for | Source |
|---|---|---|
| **600 mSv** career limit | Projection and status | [NASA-STD-3001 Vol. 1 Rev. C](https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf); summary in the [OCHMO radiation technical brief](https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf) |
| **1.84 mSv/day** deep space | Cruise and transit phases | [Zeitlin et al. 2013, *Science*](https://doi.org/10.1126/science.1235989) |
| **0.64 mSv/day** Mars surface | Fallback when no RadLab data | [Hassler et al. 2014, *Science*](https://doi.org/10.1126/science.1244797) |
| **1.37 mSv/day** Moon surface | Always (no surface data in RadLab) | [Zhang et al. 2020, *Science Advances*](https://doi.org/10.1126/sciadv.aaz1334) (Chang'e 4) |
| **0.5 mSv/day** ISS | Fallback; NASA range 0.3–0.8, we use the midpoint | NASA ⚠️ exact page still to add |
| **Quality factor 3** | Absorbed dose → dose equivalent, cosmic rays | Curiosity RAD measured 3.0–3.8 ([Zeitlin 2013](https://doi.org/10.1126/science.1235989), [Hassler 2014](https://doi.org/10.1126/science.1244797)) |
| **Quality factor 1.5** | Storm (solar proton) excess | ⚠️ Citation still to confirm (check the [OCHMO technical brief](https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf)) |
| **~30%** neutron share on the ISS | Only if the CSA file is missing | [CSA: Monitoring Radiation for Astronaut Health (Feb 2026)](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp) |
| BP **−8 to −10 mmHg** in flight; resting HR unchanged | Shapes the usual ranges | [Norsk et al. 2015, *J Physiol*](https://doi.org/10.1113/jphysiol.2014.284869) |
| Core temperature **+1 °C** in flight | Shapes the usual range | [Stahn et al. 2017, *Sci Rep*](https://doi.org/10.1038/s41598-017-15560-w) |
| Sleep **~6 h** against 8.5 scheduled | Shapes the usual range | [Barger et al. 2014, *Lancet Neurol*](https://pmc.ncbi.nlm.nih.gov/articles/PMC4188436) |
| ST elevation **≥1 mm in 2 contiguous leads** (12-lead ECG) | Heart alert confirmation | [Thygesen et al. 2018, *Circulation*](https://doi.org/10.1161/CIR.0000000000000617) |

## 3. Team design choices (not from a paper; say so if asked)

- **Radiation status:**
  - Amber when the projection reaches **80%** of the limit.
  - Red when the limit is **≤60 days** away, or a storm hits the Moon, deep space or Mars.
  - A storm at the station is amber.
- **Uncertainty band:** day-to-day variation × 2, kept between **±10% and ±35%**.
- **Heart screening rule:** ST shift outside the person's usual range on **3 consecutive 10-minute averages**, plus resting heart rate outside its range.
- **Storm window:** 2 days before to 8 days after the event. The quiet baseline comes from the 21 days before.

## 4. Demo or simulated values (labelled in the app)

- **Crew measures:** every value for the ten health measures (wearable ECG ST shift, heart rate, exercise, blood pressure, hydration, body temperature, reaction time, sleep, mood, stress) is fictional, in the design team's `crew-data.js` shape, shaped to fit the published in-flight changes above (`BASE` in `crew/engine.py`). Medical limits for heart rate and blood pressure are the design file's mock values.
- **Check-in rules:** the 3-minute answer window and what each answer does come from the design file (`health-caution.html`).
- **Radiation career figures:** prior career dose **40 mSv**; mission day station 95, Moon 140, Mars 300.
- **Mission profiles:**
  - Station: 180 days.
  - Moon: 4 + 357 + 4 days.
  - Mars: 180 + 500 + 180 days (typical long-stay mission).
- **Simulated fallbacks:**
  - No RadLab data loaded: the 30-day chart is the published rate with **±6% random noise**.
  - Storm date with no measured data: **made-up profile** of 3×, 2.2×, 1.6×, 1.3×, 1.1× the usual rate, proton-weighted.
- **Mock content:** treatment checklist.
- **ACTIS blood clot test:** the D-dimer result in the crew doctor's evidence ("Normal: blood clot unlikely") is mock. ACTIS itself is real: the CSA's portable D-dimer test on Crew-13 ([CSA ACTIS](https://www.asc-csa.gc.ca/eng/sciences/actis.asp)). It is cited only, and no ACTIS data is used.
- **Communication delays:** station 1 s, Moon 2 s, Mars 14 min. Demo choices within the real ranges.
- **Not used:** `data/demo_systems.json` is a leftover from the old body-map version. The new screens don't use it; only the old `/api/systems` endpoint still reads it.

## Other sources cited in the app

- [NASA: Risk of Cardiovascular Adaptations](https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/)
- [NASA: Risk of Behavioral Conditions and Psychiatric Disorders](https://www.nasa.gov/reference/risk-of-behavioral-conditions-and-psychiatric-disorders/)
- [Trim et al. 2023, *Clinical Nutrition*](https://doi.org/10.1016/j.clnu.2023.02.006): blood sugar during bed rest
- [CDC: Acute Radiation Syndrome, clinical guidance](https://www.cdc.gov/radiation-emergencies/hcp/clinical-guidance/ars.html): why storm doses in a shelter don't change other vital signs

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

## Open items before judging

- Confirm the source for the **1.5** solar-proton quality factor.
- Add the exact NASA page for the **0.5 mSv/day** ISS rate.
- Ask the CSA for an **official copy and licence** for the Radi-N2 file.
