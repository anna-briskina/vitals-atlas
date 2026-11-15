"""Shared crew state for the three views (Normal, Emergency, Crew doctor).

One in-memory state on the server; every tablet polls /api/state and sends actions to /api/action, so all views
stay in sync. Everything here is DEMO data for a fictional crew.

Scenario S2 (staged heart alert):
  caution (Lena + quiet advisory to crew doctor) -> check-in [Yes: crew doctor alerted, decides | Not sure: heart
  reading + crew doctor alerted | No: heart reading | no answer in 3 min: crew doctor alerted] -> crew doctor decides
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

# Personal in-flight baselines, in the design team's crew-data.js shape (app/health-caution.html): for each measure
# a unit, the reference it is read against (usualRange, plan, publishedLine or usual word), mock medical limits and
# 7 daily readings, oldest first. DEMO values for a fictional crew, shaped by published in-flight changes:
# blood pressure ~8-10 mmHg lower in flight (Norsk 2015), core temperature ~1 C higher (Stahn 2017),
# sleep ~6 h (Barger 2014). Medical limits are mock (design file), for heart rate and blood pressure only.
ENTRY_TODAY = {"hydration": 2, "mood": "Good", "stress": "Low", "reactionTime": 266}   # value when entered today
ENTRY_IDS = list(ENTRY_TODAY)

BASE = {
    "stShift": {"unit": "millimetres ST shift", "usualRange": {"low": -0.2, "high": 0.2}, "medicalLimit": None,
                "staleAfterMinutes": 10, "v": [0.0, 0.1, -0.1, 0.0, 0.1, 0.0, 0.0]},
    "heartRate": {"unit": "beats per minute", "usualRange": {"low": 52, "high": 60},
                  "medicalLimit": {"low": 40, "high": 131}, "staleAfterMinutes": 10, "v": [55, 56, 54, 57, 55, 56, 56]},
    "exercise": {"unit": "minutes", "plan": 120, "stateSetByHand": "within", "v": [125, 120, 118, 130, 122, 121, 95]},
    "bloodPressure": {"unit": "millimetres of mercury",
                      "usualRange": {"systolic": {"low": 104, "high": 118}, "diastolic": {"low": 64, "high": 74}},
                      "medicalLimit": {"systolic": {"low": 90, "high": 180}, "diastolic": {"high": 120}},
                      "staleAfterMinutes": None, "time": "07:00:00",
                      "v": [(111, 68), (109, 67), (112, 69), (110, 68), (108, 66), (111, 68), (110, 68)]},
    "hydration": {"unit": "urine colour step, 1 palest to 8 darkest", "publishedLine": 3, "stateSetByHand": "within",
                  "v": [2, 2, 3, 2, 2, 3, 2]},
    "bodyTemperature": {"unit": "degrees Celsius", "usualRange": {"low": 37.3, "high": 37.9}, "publishedLine": 38.0,
                        "medicalLimit": None, "staleAfterMinutes": None, "time": "07:00:00",
                        "v": [37.5, 37.6, 37.6, 37.7, 37.5, 37.6, 37.6]},
    "reactionTime": {"unit": "milliseconds", "usualRange": {"low": 250, "high": 290}, "medicalLimit": None,
                     "v": [262, 270, 258, 268, 265, 272, 268]},
    "sleep": {"unit": "minutes", "usualRange": {"low": 336, "high": 396}, "medicalLimit": None,
              "v": [360, 378, 354, 372, 366, 348, 366]},
    "mood": {"unit": "word", "usual": "Good", "stateSetByHand": "within",
             "v": ["Good", "Good", "Okay", "Good", "Good", "Good", "Good"]},
    "stress": {"unit": "word", "usual": "Low", "stateSetByHand": "within",
               "v": ["Low", "Low", "Low", "Some", "Low", "Low", "Low"]},
}
SENSORS = {"stShift", "heartRate", "exercise", "bloodPressure", "bodyTemperature", "sleep"}
PERSON = {   # per-person changes to BASE (demo)
    "sam": {"heartRate": {"usualRange": {"low": 54, "high": 64}, "v": [58, 59, 57, 60, 58, 59, 58]}},
    "ravi": {"heartRate": {"usualRange": {"low": 56, "high": 66}, "v": [60, 61, 59, 62, 60, 61, 60]},
             "sleep": {"v": [366, 372, 360, 350, 330, 330, 330]}},
    "maya": {"heartRate": {"usualRange": {"low": 50, "high": 60}, "v": [54, 55, 53, 56, 54, 55, 55]}},
}
S2_CAUTION = {   # Lena's last days while the S2 heart alert is open (matches crew/heart.py)
    "stShift": [0.0, 0.1, 0.0, 0.1, 0.3, 0.6, 0.9],
    "heartRate": [55, 56, 55, 57, 60, 64, 68],
    "bloodPressure": [(111, 68), (109, 67), (112, 69), (110, 68), (114, 70), (119, 73), (124, 76)],
}
CAUTION_MEASURES = ["stShift", "heartRate", "bloodPressure"]
ANSWER_WINDOW_S = 180   # unanswered check-in: the crew doctor is alerted after 3 minutes (design file)
CHECK_IN = {   # wording from the design file, adapted to scenario S2 (mock; the panel's words are being redesigned)
    "details": "Your wearable ECG has changed from your usual pattern, and your heart rate and blood pressure are "
               "higher than your usual range.",
    "question": "Do you have chest pain, pressure or discomfort?",
    "symptom": "chest pain, pressure or discomfort",
    "afterYes": "Stay where you are and rest. If the pain gets worse, press SOS.",
    "outcomes": {"Yes": "The crew doctor is alerted now and decides what happens next.",
                 "Not sure": "Take a heart reading. The crew doctor is also alerted.",
                 "No": "Take a heart reading."},
}
ANSWER_WORD = {"yes": "Yes", "unsure": "Not sure", "no": "No"}

SUMMARY = {   # crew doctor overview line for the other crew members (Lena is computed)
    "sam": {"state": "ok", "reason": "All measures within usual range"},
    "ravi": {"state": "preventive", "reason": "Sleep below usual range for 3 nights; preventive step suggested"},
    "maya": {"state": "missing", "reason": "No new data: wearable (Bio-Monitor shirt or watch) not worn for 3 hours",
             "missing": "sensor_off"},
}

SOS_CHECKLIST = [
    {"step": "Go to the crew member and ask what is wrong", "role": "First responder", "result_hint": "What they report"},
    {"step": "Check breathing, pulse and responsiveness", "role": "Crew doctor", "result_hint": "Findings"},
    {"step": "Record vital signs every 5 minutes", "role": "Recorder", "result_hint": "HR, BP, SpO2"},
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
        "checkins": {pid: {k: not (pid == "lena" and k in ("stress", "reactionTime")) and not (pid == "ravi" and k == "stress")
                           for k in ENTRY_IDS} for pid in NAMES},   # entered today, per person

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
    if (h and h["stage"] == "caution" and not h.get("quick_check") and not h.get("unanswered_alerted")
            and _now() >= h["issued_at"] + ANSWER_WINDOW_S):
        h["unanswered_alerted"] = _now()
        STATE["doctor_woken"] = {"by": "lena", "at": h["issued_at"] + ANSWER_WINDOW_S,
                                 "why": "No answer to the check-in within 3 minutes"}
        _log("Lena did not answer the check-in within 3 minutes. Crew doctor alerted.")
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
                                   "text": "Possible heart problem: wearable ECG changed from Lena's usual pattern "
                                           "(screening signal, not diagnostic)", "dismissed": None})
    _access("lena", "Sam (crew doctor)", "Heart alert and heart indicators")
    _log("Screening alert: Lena's wearable ECG changed from her usual pattern. Lena and the crew doctor were told.")


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
        elif t == "quick_check" and h and h["stage"] in ("caution", "doctor_woken", "monitored"):
            # Design file (health-caution.html): "Yes" does not declare an emergency; the crew doctor is told and decides.
            ans = a.get("answer")
            h["quick_check"], h["answered_at"] = ans, _now()
            h["model"] = heart.assess(h["model"]["stage"], symptom=ans, clot_test=h.get("clot_test"))
            if ans in ("yes", "unsure"):
                h["stage"] = "doctor_woken"
                STATE["doctor_woken"] = {"by": "lena", "at": _now(),
                                         "why": f"Check-in answer: {ANSWER_WORD[ans]} to chest pain, pressure or discomfort"}
                _log(f"Lena answered {ANSWER_WORD[ans]}. Crew doctor alerted; nobody else.")
            else:
                h["stage"] = "monitored"
                _log("Lena answered No. Asked to take a heart reading; result monitored.")
        elif t == "change_answer" and h and h.get("quick_check") and h["stage"] in ("doctor_woken", "monitored"):
            h["quick_check"], h["answered_at"] = None, None
            h["stage"] = "caution"
        elif t == "doctor_seen" and h and not h.get("seen_at"):
            h["seen_at"] = _now()
        elif t == "stop_countdown" and h and h.get("countdown_end"):
            h["countdown_end"] = None
            h["stage"] = "doctor_woken"
            STATE["doctor_woken"] = {"by": who, "at": _now(), "why": "Countdown stopped"}
            _log(f"{NAMES.get(who, who)} stopped the countdown. Only the crew doctor was woken.")
        elif t == "heart_reading" and h and h["stage"] not in ("emergency",):
            h["heart_reading"] = True
            h["model"] = heart.assess("confirming", symptom=h.get("quick_check"), clot_test=h.get("clot_test"))
            h["reading_at"] = _now()
            if h["stage"] == "caution":
                h["stage"] = "doctor_woken"
            _log("12-lead Heart reading taken: meets the ST-elevation criterion (possible heart attack).")
        elif t == "clot_test" and h and h["stage"] not in ("emergency",) and not h.get("clot_test"):
            h["clot_test"], h["clot_at"] = True, _now()
            h["model"] = heart.assess(h["model"]["stage"], symptom=h.get("quick_check"), clot_test=True)
            _log("ACTIS blood clot test (D-dimer): normal, blood clot unlikely (mock result).")
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
        elif t == "sos" and not e:
            _declare("sos", who, f"SOS from {NAMES.get(who, who)}", NAMES.get(who, who), SOS_CHECKLIST,
                     detail="SOS pressed on the tablet")
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
            k, mine = a.get("id"), STATE["checkins"].get(who, {})
            if k in mine:
                mine[k] = True
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
    s["health"] = {pid: _health(pid, s) for pid in NAMES}
    s["summary"] = copy.deepcopy(SUMMARY)
    return s


# ------------------------------------------------------------------ per-person data in the design's shape
def _clock(t):
    """NASA's form: day of the year, a slash, the time (GMT). 319/03:11:00"""
    g = time.gmtime(t)
    return f"{g.tm_yday}/{g.tm_hour:02d}:{g.tm_min:02d}:{g.tm_sec:02d}"


def _trend(vals, nights=False):
    """Direction and words from the last readings (the design sets these by hand until a rule is agreed)."""
    v = [x[0] if isinstance(x, tuple) else x for x in vals if x is not None]
    if len(v) < 4 or isinstance(v[-1], str):
        return {"direction": "flat", "words": "Steady"}
    up = all(v[-k] > v[-k - 1] for k in (1, 2, 3))
    down = all(v[-k] < v[-k - 1] for k in (1, 2, 3))
    if up:
        return {"direction": "up", "words": "Rising for 3 " + ("nights" if nights else "days")}
    if down:
        return {"direction": "down", "words": ("Shorter for 3 nights" if nights else "Falling for 3 days")}
    if v[-1] < v[-2] and not nights and abs(v[-1] - v[-2]) > 0.15 * abs(v[-2] or 1):
        return {"direction": "down", "words": "Lower today"}
    return {"direction": "flat", "words": "Steady"}


def _health(pid, s):
    now = s["now"]
    today = time.gmtime(now).tm_yday
    hhmmss = lambda t: time.strftime("%H:%M:%S", time.gmtime(t))
    h = s["heart"]
    s2 = pid == "lena" and h and h["stage"] not in ("cleared", "closed")
    measures = {}
    for mid, base in BASE.items():
        m = copy.deepcopy({k: v for k, v in base.items() if k not in ("v", "time")})
        m.update(copy.deepcopy({k: v for k, v in PERSON.get(pid, {}).get(mid, {}).items() if k != "v"}))
        vals = list(PERSON.get(pid, {}).get(mid, {}).get("v", base["v"]))
        if s2 and mid in S2_CAUTION:
            vals = list(S2_CAUTION[mid])
        if mid in ENTRY_TODAY:
            vals[-1] = ENTRY_TODAY[mid] if s["checkins"][pid][mid] else None
        if pid == "maya" and mid == "exercise":
            vals[-1] = None                                     # wearable off: no reading today (missing)
        m["source"] = "demo"
        m["trend"] = _trend(vals, nights=mid == "sleep")
        readings = []
        for i, v in enumerate(vals):
            r = {"day": today - 6 + i, "value": ({"systolic": v[0], "diastolic": v[1]} if isinstance(v, tuple) else v)}
            if mid in SENSORS and mid not in ("exercise", "sleep"):
                if i == 6:
                    t = now - 120
                    if pid == "maya" and mid in ("stShift", "heartRate"):
                        t = max(now - 3 * 3600, now - (now % 86400) + 1)   # wearable off for 3 hours: stale
                    r["time"] = base.get("time") if base.get("time") and base["time"] < hhmmss(now) else hhmmss(t)
                else:
                    r["time"] = base.get("time") or hhmmss(now - 120)
            readings.append(r)
        m["readings"] = readings
        measures[mid] = m
    data = {"clock": _clock(now), "person": {"name": NAMES[pid]}, "crewDoctor": {"name": "Sam", "pronoun": "He"},
            "earthLink": {"station": "strong", "moon": "strong", "mars": "delayed"}[s["mode"]], "measures": measures,
            "caution": None}
    if s2 and h["stage"] in ("caution", "doctor_woken", "monitored", "confirmed"):
        data["caution"] = {
            "class": "Caution", "name": "Heart warning signs",
            "raised": _clock(h["issued_at"]), "answerBy": _clock(h["issued_at"] + ANSWER_WINDOW_S),
            "answered": ANSWER_WORD.get(h.get("quick_check")),
            "answeredAt": _clock(h["answered_at"]) if h.get("answered_at") else None,
            "seenAt": _clock(h["seen_at"]) if h.get("seen_at") else None,
            "measures": CAUTION_MEASURES,
            "reasons": "Wearable ECG changed from your usual pattern. Heart rate and blood pressure higher than your "
                       "usual range.",
            "checkIn": CHECK_IN,
        }
    return data
