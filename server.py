"""Vitals Atlas server.

Run:  python server.py   then open http://localhost:5000

Endpoints (all JSON, shared format with "system", "status", "headline", "source", ...):
  GET /api/systems?mode=mars&event=<sepID>   every body system for the body map (radiation is computed live)
  GET /api/radiation?mode=mars&event=<sepID> full radiation detail: projection, recent dose rates, storm
  GET /api/donki/events                      cached DONKI solar particle events (run radiation.donki once to fill)
"""
import json
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from radiation import donki, model

ROOT = Path(__file__).resolve().parent
app = Flask(__name__, static_folder=str(ROOT / "static"), static_url_path="/static")


def _args():
    mode = request.args.get("mode", "mars")
    event = request.args.get("event") or None
    return mode, event


@app.get("/")
def index():
    return send_from_directory(ROOT / "static", "index.html")


@app.get("/api/systems")
def systems():
    mode, event = _args()
    others = json.loads((ROOT / "data" / "demo_systems.json").read_text())
    rad = model.project(mode, event)
    rad_card = {
        "system": "radiation", "title": "Radiation exposure", "status": rad["status"], "headline": rad["headline"],
        "nasaRisk": rad["nasaRisk"], "whoActs": rad["whoActs"], "source": rad["source"],
    }
    return jsonify({"mode": mode, "systems": others + [rad_card]})


@app.get("/api/radiation")
def radiation():
    mode, event = _args()
    try:
        return jsonify(model.project(mode, event))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@app.get("/api/donki/events")
def donki_events():
    evs = donki.events()
    return jsonify({"events": evs, "cached": bool(evs)})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
