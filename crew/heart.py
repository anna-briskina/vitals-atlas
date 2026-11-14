"""Heart alert for scenario S2 ("possible heart attack"): detection against criteria, not a prediction.

No invented probabilities, warning windows or track records. Two stages:

1. Screening (wearable ECG). The alert rule fires when the ST segment stays outside the person's own usual
   in-flight range on 3 consecutive 10-minute averages AND at least one supporting signal (resting heart rate)
   is also outside its usual range. This rule is a DESIGN CHOICE of the team, to be tuned with flight data.
   A wearable ECG is a screening signal only: the clinical ST-elevation criteria are defined on a 12-lead ECG.

2. Confirming (12-lead "Heart reading" from the medical kit). Checked against the published criterion: new ST
   elevation at the J point of at least 1 mm in two contiguous leads (other than V2-V3, which have higher
   thresholds). Fourth Universal Definition of Myocardial Infarction, Thygesen et al., Circulation 2018.
   Meeting it means "possible heart attack"; diagnosis still needs clinical assessment.

All values are DEMO values for a fictional crew member.
"""

COVERAGE = "wearable ECG worn 21 of the last 24 hours; 2 blood pressure readings today"

RULE = ("Alert rule (team design, to be tuned with flight data): ST segment outside your usual range on 3 "
        "consecutive 10-minute averages, plus resting heart rate outside its usual range.")
LIMITS = ("A wearable ECG (Bio-Monitor shirt or smartwatch) cannot confirm or rule out a heart attack. The clinical criteria are defined on a "
          "12-lead ECG, so the 12-lead Heart reading is the deciding measurement.")


def assess(stage="screening", symptom=None):
    """stage: "screening" (wearable only) or "confirming" (after the 12-lead Heart reading)."""
    qc = {"yes": "Yes", "unsure": "Not sure", "no": "No"}.get(symptom, "Not answered yet")
    criteria = [
        {"label": "wearable ECG: ST segment outside your usual range, 3 consecutive 10-minute averages",
         "value": "+0.9 mm (usual -0.2 to +0.2 mm)", "met": True, "basis": "rule"},
        {"label": "Resting heart rate outside your usual range",
         "value": "68 bpm (usual 52 to 60)", "met": True, "basis": "norsk"},
        {"label": "Systolic blood pressure (supporting)",
         "value": "124 mmHg (usual 104 to 118)", "met": True, "basis": "norsk"},
        {"label": "Chest discomfort, pressure or pain (quick check)", "value": qc,
         "met": True if symptom == "yes" else (False if symptom == "no" else None), "basis": "symptom"},
    ]
    if stage == "confirming":
        criteria.append({"label": "12-lead ECG: new ST elevation of at least 1 mm in two contiguous leads",
                         "value": "1.6 mm in leads II, III and aVF", "met": True, "basis": "thygesen"})
        level = "criterion_met"
        summary = ("The 12-lead Heart reading meets the ST-elevation criterion for a possible heart attack. "
                   "Diagnosis needs clinical assessment.")
    else:
        criteria.append({"label": "12-lead ECG: new ST elevation of at least 1 mm in two contiguous leads",
                         "value": "Not taken yet", "met": None, "basis": "thygesen"})
        level = "screening"
        summary = ("The wearable ECG has changed from the usual pattern. This is a screening signal, not a "
                   "diagnosis; a 12-lead Heart reading is needed to check.")
    return {
        "stage": stage, "level": level, "summary": summary, "criteria": criteria,
        "coverage": {"text": COVERAGE + ("; 12-lead Heart reading at the time shown" if stage == "confirming" else "")},
        "rule": RULE, "limits": LIMITS,
        "label": "Demo values for a fictional crew member",
    }
