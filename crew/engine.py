"""Shared crew state for the three views (Normal, Emergency, Crew doctor).

One in-memory state on the server; every tablet polls /api/state and sends actions to /api/action, so all views
stay in sync. Everything here is DEMO data for a fictional crew.

Scenario S2 (staged heart alert):
  caution (Lena + quiet advisory to crew doctor) -> quick check -> [Yes: countdown -> crew-wide emergency |
  stop: crew doctor woken | Not sure: crew doctor woken | No: monitored] -> Heart reading -> crew doctor decides
  (confirm / monitor / escalate / override) -> escalate countdown or "Send now" -> emergency -> roster, checklist,
  Earth report -> crew doctor stands down with reason and outcome -> access closed and logged.
Scenario SPE (solar particle event): crew-wide "go to the shelter", roster with "in shelter".
"""
import copy
import itertools
import threading
import time

from radiation import model as radmodel
from radiation.config import STORM_RESPONSE

from . import heart

LOCK = threading.Lock()
COUNTDOWN_S = 10
ONE_WAY_S = {"station": 1, "moon": 2, "mars": 14 * 60}   # demo one-way light time, seconds
_ids = itertools.count(1)

CREW = [
    {"id": "lena", "name": "Lena", "role": "Flight engineer", "where": "Laboratory module"},
    {"id": "sam", "name": "Sam", "role": "Crew doctor (crew medical officer)", "where": "Galley"},
    {"id": "ravi", "name": "Ravi", "role": "Backup crew medical officer", "where": "Node 2"},
    {"id": "maya", "name": "Maya", "role": "Commander (emergency recorder)", "where": "Command deck"},
]
NAMES = {c["id"]: c["name"] for c in CREW}

# Personal in-flight baselines. Numbers are demo values shaped by the team's research file:
# blood pressure ~8-10 mmHg lower in flight (Norsk 2015), core temperature ~1 C higher (Stahn 2017),
# sleep ~6 h (Barger 2014). Statuses: ok | flag | missing (with a missing kind) | stale.
BASE_INDICATORS = {
    "lena": [
        {"key": "ecg", "name": "Heart rhythm (chest strap ECG)", "value": "Regular", "unit": "", "usual": "Regular, no ST shift",
         "trend": "steady", "series": [0.0, 0.05, -0.05, 0.0, 0.05, 0.0, 0.0], "band": [-0.2, 0.2], "series_unit": "mm ST shift",
         "state": "ok", "why": "Fluid shifts and deconditioning change how the heart works in weightlessness; rhythm changes are a named NASA cardiovascular hazard.",
         "risk": "Risk of Cardiovascular Adaptations", "measured": "Chest strap ECG, continuous while worn.", "src": "research_cardio"},
        {"key": "hr", "name": "Resting heart rate", "value": "56", "unit": "bpm", "usual": "52–60", "trend": "steady",
         "series": [55, 56, 54, 57, 55, 56, 56], "band": [52, 60], "series_unit": "bpm", "state": "ok",
         "why": "Resting heart rate is usually unchanged in flight, so a rise from your own range is worth a look.",
         "risk": "Risk of Cardiovascular Adaptations", "measured": "Chest strap or watch, overnight average.", "src": "norsk"},
        {"key": "bp", "name": "Blood pressure", "value": "110/68", "unit": "mmHg", "usual": "104–118 / 64–74", "trend": "steady",
         "series": [111, 109, 112, 110, 108, 111, 110], "band": [104, 118], "series_unit": "mmHg systolic", "state": "ok",
         "why": "Blood pressure falls about 8 to 10 mmHg in flight, so your usual range here is your in-flight range, not your Earth range.",
         "risk": "Risk of Cardiovascular Adaptations", "measured": "Cuff, morning, seated quietly.", "src": "norsk"},
        {"key": "temp", "name": "Body temperature", "value": "37.6", "unit": "°C", "usual": "37.3–37.9", "trend": "steady",
         "series": [37.5, 37.6, 37.6, 37.7, 37.5, 37.6, 37.6], "band": [37.3, 37.9], "series_unit": "°C", "state": "ok",
         "why": "Resting core temperature rises about 1 °C over the first months in flight, so 37.6 °C is normal for you here.",
         "risk": "Risk of Altered Immune System Responses", "measured": "Forehead core-temperature sensor.", "src": "stahn"},
        {"key": "sleep", "name": "Sleep", "value": "6.1", "unit": "h", "usual": "5.6–6.6", "trend": "steady",
         "series": [6.0, 6.3, 5.9, 6.2, 6.1, 5.8, 6.1], "band": [5.6, 6.6], "series_unit": "h", "state": "ok",
         "why": "Crews sleep about 6 hours against 8.5 scheduled; a further drop affects alertness and errors.",
         "risk": "Risk of Inadequate Sleep and Irregular Schedules", "measured": "Wrist actigraphy (as in NASA's ARCHeR study).", "src": "barger"},
        {"key": "glucose", "name": "Blood sugar", "value": None, "unit": "mg/dL", "usual": "72–95", "state": "missing",
         "missing": "not_entered", "why": "Inactivity raises blood sugar; a fasting reading tracks it.",
         "risk": "Risk of Inadequate Food and Nutrition", "measured": "Finger-stick glucometer, fasting.", "src": "trim"},
        {"key": "mood", "name": "Mood check-in", "value": "Entered today", "unit": "", "usual": "", "state": "ok", "trend": "",
         "why": "Isolation and confinement affect mood; NASA lists no monitoring tool for this risk.",
         "risk": "Risk of Behavioral Changes and Psychiatric Disorders", "measured": "Short check-in; private to you.", "src": "behav", "private": True},
    ],
}

SUMMARY = {   # crew doctor overview for the other crew members (Lena is computed)
    "sam": {"state": "ok", "reason": "All indicators within usual range"},
    "ravi": {"state": "ok", "reason": "Sleep 5.5 h, slightly below usual for 3 nights; preventive step suggested"},
    "maya": {"state": "missing", "reason": "No data: watch not worn since 06:10", "missing": "sensor_off"},
}

CHECKINS = [
    {"id": "bp", "label": "Blood pressure", "sub": "Cuff, seated quietly · 2 min"},
    {"id": "mood", "label": "Mood check-in", "sub": "5 taps · 30 s"},
    {"id": "glucose", "label": "Blood sugar (fasting)", "sub": "Finger-stick · 2 min"},
    {"id": "fatigue", "label": "Reaction-time test", "sub": "3 min"},
]

HEART_CHECKLIST = [
    {"step": "Stop all activity and help Lena sit or lie down", "role": "First responder", "result_hint": "Position and time"},
    {"step": "Attach the 12-lead ECG and record the reading", "role": "Crew doctor", "result_hint": "ST shift (mm), rhythm"},
    {"step": "Give aspirin per the medical kit protocol", "role": "Crew doctor", "result_hint": "Dose and time", "mock": True},
    {"step": "Check blood oxygen; give oxygen if below protocol threshold", "role": "Backup crew medical officer", "result_hint": "SpO2 (%)", "mock": True},
    {"step": "Record vital signs every 5 minutes", "role": "Recorder", "result_hint": "HR, BP, SpO2"},
]
SPE_CHECKLIST = [
    {"step": "Go to the storm shelter now", "role": "All crew", "result_hint": ""},
    {"step": "Confirm every crew member is in the shelter", "role": "Commander", "result_hint": "Names"},
    {"step": "Postpone spacewalks and surface excursions", "role": "Commander", "result_hint": ""},
]
TREATMENT_MOCK = [
    "MOCK CONTENT for the demo, not medical guidance.",
    "1. Keep the patient at rest, seated or semi-reclined, and loosen tight clothing.",
    "2. Obtain a 12-lead ECG and send it to the flight surgeon with the event report.",
    "3. Follow the medical kit cardiac protocol card for medication and oxygen.",
    "4. Prepare the defibrillator; follow its voice prompts if the patient becomes unresponsive.",
    "5. Record vital signs every 5 minutes and any change in symptoms.",
]


def _now():
    return time.time()


def _fresh():
    return {
        "mode": "mars",
        "mission_day": 300,
        "heart": None,          # staged heart alert for Lena
        "advisories": [],       # crew doctor review list (quiet)
        "emergency": None,      # active crew-wide emergency
        "spe_caution": None,    # station SPE: caution, not emergency
        "closed": [],           # ended emergencies
        "decisions": [],        # who decided what, when, why
        "access_log": {"lena": []},
        "access_closed_notice": None,
        "doctor_woken": None,
        "checkins": {"bp": True, "mood": True, "glucose": False, "fatigue": False},
        "streak": 6,
        "track": {"alerts": 0, "confirmed": 0, "not_confirmed": 0},   # this mission only, real counts
        "events": [],           # timeline for the demo
    }


STATE = _fresh()


def reset():
    global STATE
    with LOCK:
        STATE = _fresh()


def _log(text):
    STATE["events"].insert(0, {"at": _now(), "text": text})
    STATE["events"] = STATE["events"][:40]


def _access(person, who, data):
    STATE["access_log"].setdefault(person, []).insert(0, {"at": _now(), "who": who, "data": data})


# ------------------------------------------------------------------ time-based transitions
def _tick():
    h = STATE["heart"]
    if h and h.get("countdown_end") and _now() >= h["countdown_end"]:
        h["countdown_end"] = None
        _declare_heart(by=h.get("countdown_by", "system"))
    e = STATE["emergency"]
    if e and e.get("report") and e["report"]["status"] == "queued" and _now() >= e["report"]["send_at"]:
        e["report"]["status"] = "sent"
        e["report"]["sent_at"] = e["report"]["send_at"]
        e["report"]["earliest_reply_at"] = e["report"]["sent_at"] + 2 * ONE_WAY_S[STATE["mode"]]


# ------------------------------------------------------------------ S2 heart scenario
def _start_s2():
    model = heart.assess("screening")
    STATE["track"]["alerts"] += 1
    STATE["heart"] = {"id": next(_ids), "person": "lena", "stage": "caution", "issued_at": _now(),
                      "model": model, "quick_check": None, "heart_reading": False, "countdown_end": None,
                      "outcome": None}
    STATE["advisories"].insert(0, {"id": STATE["heart"]["id"], "kind": "heart", "person": "lena", "at": _now(),
                                   "text": "Possible heart problem: chest strap ECG changed from Lena's usual pattern "
                                           "(screening signal, not diagnostic)", "dismissed": None})
    _access("lena", "Sam (crew doctor)", "Heart alert and heart indicators")
    _log("Screening alert: Lena's chest strap ECG changed from her usual pattern. Lena and the crew doctor were told.")


def _declare_heart(by):
    h = STATE["heart"]
    model = h["model"]
    h["stage"] = "emergency"
    _declare("heart", "lena", "Possible heart attack", by, HEART_CHECKLIST,
             detail=("12-lead ECG meets the ST-elevation criterion" if model["level"] == "criterion_met"
                     else "Screening signal; 12-lead Heart reading not yet taken"))


def _declare(kind, patient, what, by, checklist, detail=""):
    where = next((c["where"] for c in CREW if c["id"] == patient), "Habitat") if patient else "Whole habitat"
    roster = {c["id"]: ("patient" if c["id"] == patient else "alerted") for c in CREW}
    STATE["emergency"] = {
        "id": next(_ids), "kind": kind, "patient": patient, "what": what, "where": where, "detail": detail,
        "declared_at": _now(), "declared_by": by, "roster": roster,
        "checklist": [dict(s, result=None, by=None, at=None) for s in checklist],
        "report": {"status": "queued", "queued_at": _now(), "send_at": _now() + 2, "sent_at": None,
                   "earliest_reply_at": None},
    }
    for c in CREW:   # whoever declared it has already acknowledged
        if c["name"] in str(by) and roster[c["id"]] == "alerted":
            roster[c["id"]] = "acknowledged"
    STATE["doctor_woken"] = None
    for adv in STATE["advisories"]:
        if adv["person"] == patient and not adv["dismissed"]:
            adv["dismissed"] = "Escalated to crew-wide emergency"
    if patient:
        _access(patient, "All crew (emergency)", "Emergency data only: heart indicators, heart alert, location")
    _log(f"Crew-wide emergency declared: {what}. Report to Earth queued automatically.")


def action(a, who="lena"):
    """Apply one action. `who` is the person using the tablet."""
    with LOCK:
        _tick()
        t = a.get("type")
        h, e = STATE["heart"], STATE["emergency"]

        if t == "reset":
            pass
        elif t == "demo_start_s2" and not h and not e:
            _start_s2()
        elif t == "quick_check" and h and h["stage"] == "caution":
            ans = a.get("answer")
            h["quick_check"] = ans
            h["model"] = heart.assess(h["model"]["stage"], symptom=ans)
            if ans == "yes":
                h["stage"] = "countdown"
                h["countdown_end"] = _now() + COUNTDOWN_S
                h["countdown_by"] = "Lena (quick check: yes)"
                _log("Lena answered Yes to chest discomfort. Countdown to crew-wide alert started.")
            elif ans == "unsure":
                h["stage"] = "doctor_woken"
                STATE["doctor_woken"] = {"by": "lena", "at": _now(), "why": "Quick check: not sure"}
                _log("Lena answered Not sure. Crew doctor woken; nobody else alerted.")
            else:
                h["stage"] = "monitored"
                _log("Lena answered No. Result is monitored; recheck in 1 hour.")
        elif t == "stop_countdown" and h and h.get("countdown_end"):
            h["countdown_end"] = None
            h["stage"] = "doctor_woken"
            STATE["doctor_woken"] = {"by": who, "at": _now(), "why": "Countdown stopped"}
            _log(f"{NAMES.get(who, who)} stopped the countdown. Only the crew doctor was woken.")
        elif t == "heart_reading" and h and h["stage"] not in ("emergency",):
            h["heart_reading"] = True
            h["model"] = heart.assess("confirming", symptom=h.get("quick_check"))
            h["reading_at"] = _now()
            if h["stage"] == "caution":
                h["stage"] = "doctor_woken"
            _log("12-lead Heart reading taken: meets the ST-elevation criterion (possible heart attack).")
        elif t == "decide" and h:
            d = a.get("decision")
            STATE["decisions"].insert(0, {"at": _now(), "who": "Sam (crew doctor)", "decision": d,
                                          "reason": a.get("reason") or "", "result": h["model"]["level"]})
            _access("lena", "Sam (crew doctor)", "Model evidence and heart indicators")
            if d == "escalate":
                h["stage"] = "countdown"
                h["countdown_end"] = _now() + COUNTDOWN_S
                h["countdown_by"] = "Sam (crew doctor)"
                _log("Crew doctor escalated. Countdown to crew-wide alert started.")
            elif d == "monitor":
                h["stage"] = "monitored"
                _log("Crew doctor set the result to monitored.")
            elif d in ("override", "clear"):
                h["stage"] = "cleared"
                for adv in STATE["advisories"]:
                    if adv["id"] == h["id"]:
                        adv["dismissed"] = a.get("reason") or "Overridden by crew doctor"
                _log("Crew doctor overrode the result.")
            elif d == "confirm":
                h["stage"] = "confirmed"
                _log("Crew doctor confirmed the result is credible; decide next step.")
        elif t == "send_now" and h and h.get("countdown_end"):
            h["countdown_end"] = None
            _declare_heart(by=h.get("countdown_by", who))
        elif t == "dismiss_advisory":
            for adv in STATE["advisories"]:
                if adv["id"] == a.get("id"):
                    adv["dismissed"] = a.get("reason", "Not credible")
                    STATE["decisions"].insert(0, {"at": _now(), "who": "Sam (crew doctor)", "decision": "dismiss",
                                                  "reason": adv["dismissed"], "result": None})
            if h and h["id"] == a.get("id") and h["stage"] != "emergency":
                h["stage"] = "cleared"
        elif t == "get_doctor":
            STATE["doctor_woken"] = {"by": who, "at": _now(), "why": "Get crew doctor pressed"}
            _log(f"{NAMES.get(who, who)} pressed Get crew doctor.")
        elif t == "respond" and e:
            STATE["emergency"]["roster"][who] = a.get("status", "acknowledged")
        elif t == "record_step" and e:
            i = int(a.get("index", 0))
            if 0 <= i < len(e["checklist"]):
                e["checklist"][i].update(result=a.get("result") or "Done", by=NAMES.get(who, who), at=_now())
        elif t == "stand_down" and e:
            outcome = a.get("outcome", "not_known")
            closed = dict(e, ended_at=_now(), ended_by=NAMES.get(who, who), reason=a.get("reason", ""), outcome=outcome)
            STATE["closed"].insert(0, closed)
            if e["kind"] == "heart":
                if outcome == "confirmed":
                    STATE["track"]["confirmed"] += 1
                elif outcome == "false_alarm":
                    STATE["track"]["not_confirmed"] += 1
                if STATE["heart"]:
                    STATE["heart"]["stage"] = "closed"
                    STATE["heart"]["outcome"] = outcome
                STATE["access_closed_notice"] = {"at": _now(), "person": e["patient"],
                                                 "shared_with": "All crew", "data": "Emergency data only"}
                _access(e["patient"], "System", "Crew access to emergency data closed")
            STATE["emergency"] = None
            _log(f"{NAMES.get(who, who)} stood down the emergency. Outcome: {outcome.replace('_', ' ')}.")
        elif t == "set_outcome":
            for c in STATE["closed"]:
                if c["id"] == a.get("id") and c.get("outcome") == "not_known":
                    c["outcome"] = a.get("outcome", "not_known")
                    if c["kind"] == "heart" and c["outcome"] == "confirmed":
                        STATE["track"]["confirmed"] += 1
                    elif c["kind"] == "heart" and c["outcome"] == "false_alarm":
                        STATE["track"]["not_confirmed"] += 1
                    _log(f"Outcome recorded later for the {c['what']} event: {c['outcome'].replace('_', ' ')}.")
        elif t == "spe_start":
            rad = radmodel.project(STATE["mode"], a.get("event") or "demo")
            rule = rad["storm"]
            if rule["severity"] == "red":
                _declare("spe", None, "Solar particle event", "Space weather monitoring", SPE_CHECKLIST,
                         detail=rule["banner"])
                STATE["emergency"]["event"] = a.get("event") or "demo"
            else:
                STATE["spe_caution"] = {"at": _now(), "event": a.get("event") or "demo", "text": rule["banner"]}
                _log("SPE at the station: caution only; ground radiation team directs precautions.")
        elif t == "spe_end":
            STATE["spe_caution"] = None
        elif t == "mode":
            if a.get("mode") in ONE_WAY_S:
                STATE["mode"] = a["mode"]
        elif t == "checkin":
            k = a.get("id")
            if k in STATE["checkins"]:
                STATE["checkins"][k] = not STATE["checkins"][k]
        return snapshot()


def snapshot():
    """Full state for the views (the caller decides what each view shows)."""
    _tick()
    s = copy.deepcopy(STATE)
    s["now"] = _now()
    s["crew"] = CREW
    s["one_way_s"] = ONE_WAY_S[s["mode"]]
    s["countdown_s"] = COUNTDOWN_S
    s["treatment_mock"] = TREATMENT_MOCK
    s["checkin_defs"] = CHECKINS
    # Lena's indicators, adjusted for the heart scenario
    inds = copy.deepcopy(BASE_INDICATORS["lena"])
    h = s["heart"]
    if h and h["stage"] not in ("cleared", "closed"):
        for ind in inds:
            if ind["key"] == "ecg":
                ind.update(value="ST shift +0.9 mm", usual="No ST shift (±0.2 mm)", trend="rising", state="flag",
                           series=[0.0, 0.05, 0.0, 0.1, 0.3, 0.6, 0.9])
            if ind["key"] == "hr":
                ind.update(value="68", trend="rising", state="flag", series=[55, 56, 55, 57, 60, 64, 68])
    for ind in inds:
        if ind["key"] == "glucose" and s["checkins"].get("glucose"):
            ind.update(value="84", state="ok", trend="steady", series=[82, 85, 80, 83, 86, 81, 84], band=[72, 95],
                       series_unit="mg/dL", missing=None)
    s["indicators"] = {"lena": inds}
    # Other crew members: same indicator set, unflagged; Maya's watch is off; Ravi gets a preventive step.
    for pid in ("sam", "ravi", "maya"):
        other = copy.deepcopy(BASE_INDICATORS["lena"])
        for ind in other:
            if pid == "maya" and ind["key"] in ("ecg", "hr", "sleep"):
                ind.update(value=None, state="missing", missing="sensor_off", trend="")
            if pid == "ravi" and ind["key"] == "sleep":
                ind.update(value="5.5", trend="falling", series=[6.1, 6.0, 6.2, 5.9, 5.6, 5.5, 5.5],
                           preventive="Sleep has been slightly below your usual range for 3 nights. Try dimming "
                                      "cabin lights 30 minutes earlier tonight.")
        s["indicators"][pid] = other
    s["summary"] = copy.deepcopy(SUMMARY)
    return s
