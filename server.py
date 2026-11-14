"""Crew health dashboard server (NASA Space Apps 2026 prototype).

Run:  python server.py   then open http://localhost:5000
Open several browser windows to see the views stay in sync, for example:
  http://localhost:5000/?as=lena    (crew member, the patient in scenario S2)
  http://localhost:5000/?as=sam     (crew doctor)
  http://localhost:5000/?as=ravi    (another crew member)

Endpoints:
  GET  /api/state                   shared crew state (all views poll this)
  POST /api/action  {"type": ..., "who": ...}   scenario actions
  GET  /api/radiation?mode=mars&event=<sepID>   radiation detail: projection, recent dose rates, storm
  GET  /api/donki/events                        cached DONKI solar particle events
"""
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from crew import engine
from radiation import donki, model

ROOT = Path(__file__).resolve().parent
app = Flask(__name__, static_folder=str(ROOT / "static"), static_url_path="/static")


@app.get("/")
def index():
    return send_from_directory(ROOT / "static", "index.html")


@app.get("/api/state")
def state():
    with engine.LOCK:
        return jsonify(engine.snapshot())


@app.post("/api/action")
def act():
    body = request.get_json(force=True, silent=True) or {}
    if body.get("type") == "reset":
        engine.reset()
        with engine.LOCK:
            return jsonify(engine.snapshot())
    return jsonify(engine.action(body, who=body.get("who", "lena")))


@app.get("/api/radiation")
def radiation():
    mode = request.args.get("mode", "mars")
    event = request.args.get("event") or None
    try:
        return jsonify(model.project(mode, event))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@app.get("/api/donki/events")
def donki_events():
    evs = donki.events()
    return jsonify({"events": evs, "cached": bool(evs)})


if __name__ == "__main__":
    app.run(debug=True, port=5000, threaded=True)
