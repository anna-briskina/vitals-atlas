// Vitals Atlas front end: body map + detail panel. Radiation is live from /api/radiation.
const state = { mode: "mars", event: null, sel: "radiation", hazard: null, systems: [], rad: null, events: [],
  done: { bp: true, mood: true, fatigue: false, vision: false }, streak: 6 };

const COLOURS = { green: "#4ccf8a", amber: "#f2b440", red: "#ff6b5e" };
const STATUS_WORD = { green: "Normal for you", amber: "Unusual", red: "Act now" };
const WHO = { self: "You", medic: "Crew medic", ground: "Doctors on Earth", ground_team: "Ground radiation team", crew_now: "Whole crew, now" };
const POS = { sleep: [102, 14], eyes: [18, 44], mind: [186, 44], heart: [70, 118], immune: [152, 150],
  kidney: [102, 214], radiation: [196, 262], bones: [72, 360] };
const SHORT = { sleep: "Sleep", eyes: "Eyes", mind: "Mood", heart: "Heart", immune: "Immune", kidney: "Hydration",
  radiation: "Radiation", bones: "Bones & muscles" };
const HAZARDS = [
  { id: "radiation", label: "Radiation", hits: ["radiation"], caption: "Invisible radiation that raises cancer risk; solar storms bring sudden spikes." },
  { id: "isolation", label: "Isolation", hits: ["sleep", "mind"], caption: "Long confinement in a small space affects mood, sleep and teamwork." },
  { id: "distance", label: "Distance", hits: "all", caption: "Doctors, supplies and evacuation are far away, so every system is affected. See the message delay above." },
  { id: "gravity", label: "Gravity", hits: ["heart", "eyes", "bones", "kidney"], caption: "Muscles, bones, eyes, the heart and the inner ear all adapt to low gravity." },
  { id: "closed", label: "Closed habitat", hits: ["immune"], caption: "Air, noise, light and microbes in a sealed habitat strain the immune system." },
];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// ---------- citations: small chips that open a popover with the source ----------
const CITES = new Map();
let citeSeq = 0;
const INFO = `<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`;
function cite(c) {
  const id = `c${++citeSeq}`;
  CITES.set(id, c);
  return `<button type="button" class="cite${c.simulated ? " sim" : ""}" data-cite="${id}" aria-haspopup="dialog" aria-label="Source: ${esc(c.label)}">${INFO}${esc(c.label)}</button>`;
}
const LINK = {
  radlab: { t: "NASA OSDR RadLab", u: "https://visualization.osdr.nasa.gov/radlab/gui/" },
  donki: { t: "NASA DONKI space weather database", u: "https://kauai.ccmc.gsfc.nasa.gov/DONKI/" },
  risks: { t: "NASA Human Research Program: risks", u: "https://www.nasa.gov/hrp/risks/" },
  csa: { t: "CSA: Monitoring Radiation for Astronaut Health (2026)", u: "https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp" },
  zeitlin: { t: "Zeitlin et al. 2013, Science (Curiosity RAD, cruise to Mars)", u: "https://doi.org/10.1126/science.1235989" },
  hassler: { t: "Hassler et al. 2014, Science (Curiosity RAD, Mars surface)", u: "https://doi.org/10.1126/science.1244797" },
  zhang: { t: "Zhang et al. 2020, Science Advances (Chang'e 4 LND, Moon surface)", u: "https://doi.org/10.1126/sciadv.aaz1334" },
};
const C = {
  limit: () => ({ label: "NASA-STD-3001", title: "NASA career dose limit",
    body: "NASA's career effective dose limit for all astronauts is 600 mSv (NASA-STD-3001, Volume 1).", links: [] }),
  risk: () => ({ label: "NASA HRP", title: "NASA risk name", body: "Official risk name from NASA's Human Research Program.", links: [LINK.risks] }),
  rates: (r) => ({
    label: { mars: "Curiosity RAD", moon: "Chang'e 4 LND", station: "NASA ISS" }[r.mission.mode],
    title: "Expected daily dose by mission phase",
    body: `Projection uses published dose rates per phase: ~1.84 mSv/day in deep space and ~0.64 mSv/day on the Mars surface (Curiosity RAD), ~1.37 mSv/day on the Moon surface (Chang'e 4), ~0.5 mSv/day on the ISS.${r.source === "real" ? ` The usual rate where the crew is now comes from measured ${r.mission.instrument} data in NASA RadLab.` : ""} Prior career dose and mission day are demo values for a fictional crew member.`,
    links: { mars: [LINK.zeitlin, LINK.hassler], moon: [LINK.zhang, LINK.zeitlin], station: [] }[r.mission.mode].concat(r.source === "real" ? [LINK.radlab] : []) }),
  recent: (r) => r.recent.source === "real"
    ? { label: "NASA RadLab", title: `${r.mission.instrument}: measured dose rate`,
        body: `Daily mean dose rate, ${r.recent.dates[0]} to ${r.recent.dates[r.recent.dates.length - 1]}, from NASA OSDR RadLab. Absorbed dose converted to dose equivalent with quality factor ~3 when no dose-equivalent value was recorded.`, links: [LINK.radlab] }
    : { label: "Simulated", simulated: true, title: "Simulated dose rate",
        body: `Simulated around the published rate for this location. Load measured data with: python -m radiation.radlab fetch ${r.mission.mode} <start> <end>`, links: [LINK.radlab] },
  donki: (st) => st.eventSource === "real"
    ? { label: "NASA DONKI", title: `Solar particle event ${st.date}`, body: `Event ${st.id}, recorded in NASA's DONKI space weather database.`,
        links: (st.link ? [{ t: "DONKI record for this event", u: st.link }] : []).concat([LINK.donki]) }
    : { label: "Simulated", simulated: true, title: "Demo storm", body: "No DONKI events cached yet. Run: python -m radiation.donki <start> <end>", links: [LINK.donki] },
  stormDose: (r) => r.storm.doseSource === "real"
    ? { label: "NASA RadLab", title: "Measured storm dose", body: `Excess dose above the usual rate from 2 days before to 8 days after the event, measured by ${r.mission.instrument}.`, links: [LINK.radlab] }
    : { label: "Simulated", simulated: true, title: "Simulated storm dose",
        body: `Same simulated profile for every event, because RadLab data for this date is not loaded. Run: python -m radiation.radlab fetch ${r.mission.mode} <start> <end> around ${r.storm.date || "the event date"}.`, links: [LINK.radlab] },
  csa: () => ({ label: "CSA, 2026", title: "Neutron share of ISS radiation", body: "Neutrons make up about 30% of the total radiation on the ISS and need their own detectors, such as CSA's CANS.", links: [LINK.csa] }),
  demo: () => ({ label: "Simulated", simulated: true, title: "Demo values",
    body: "Values for a fictional crew member. In the full app these come from the wearable, medical kit and tablet tests.", links: [] }),
};

function openCite(btn) {
  const c = CITES.get(btn.dataset.cite);
  const pop = $("cite-pop");
  if (!c) return;
  pop.innerHTML = `<b>${esc(c.title)}</b><p>${esc(c.body)}</p>${c.links.length ? `<ul>${c.links.map((l) => `<li><a href="${esc(l.u)}" target="_blank" rel="noopener">${esc(l.t)}</a></li>`).join("")}</ul>` : ""}`;
  pop.hidden = false;
  const b = btn.getBoundingClientRect();
  const w = pop.offsetWidth;
  pop.style.left = `${Math.max(8, Math.min(window.scrollX + b.left, window.scrollX + document.documentElement.clientWidth - w - 8))}px`;
  pop.style.top = `${window.scrollY + b.bottom + 6}px`;
  document.querySelectorAll(".cite[aria-expanded=true]").forEach((x) => x.setAttribute("aria-expanded", "false"));
  btn.setAttribute("aria-expanded", "true");
}
function closeCite() {
  $("cite-pop").hidden = true;
  document.querySelectorAll(".cite[aria-expanded=true]").forEach((x) => x.setAttribute("aria-expanded", "false"));
}

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

async function load() {
  const q = `mode=${state.mode}${state.event ? `&event=${encodeURIComponent(state.event)}` : ""}`;
  const [sys, rad] = await Promise.all([getJSON(`/api/systems?${q}`), getJSON(`/api/radiation?${q}`)]);
  state.systems = sys.systems;
  state.rad = rad;
  render();
}

async function loadEvents() {
  const r = await getJSON("/api/donki/events");
  state.events = r.events;
  renderEvents();
}

function render() {
  CITES.clear(); closeCite();
  document.querySelectorAll(".modes button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === state.mode)));
  $("delay").textContent = state.rad.mission.delay;
  $("crew").textContent = `Cmdr. A. Rivera · demo crew member · ${state.rad.mission.label} · day ${state.rad.mission.today}`;
  const storm = !!state.rad.storm;
  $("banner").classList.toggle("on", storm);
  if (storm) {
    $("banner-text").textContent = state.rad.storm.banner;
    $("banner").style.background = state.rad.storm.severity === "red" ? "var(--red)" : "var(--amber)";
  }
  $("end-storm").hidden = !storm;
  renderHazards();
  renderMarkers();
  renderDetail();
  renderOutbox();
  renderChecks();
}

function renderHazards() {
  $("hazards").innerHTML = HAZARDS.map((h) =>
    `<button type="button" data-h="${h.id}" aria-pressed="${state.hazard === h.id}">${h.label}</button>`).join("");
  const h = HAZARDS.find((x) => x.id === state.hazard);
  $("hazard-caption").textContent = h ? h.caption : "Tap a hazard to highlight the body systems it affects, or tap a body system for details.";
}

function renderMarkers() {
  const body = $("body");
  body.querySelectorAll(".marker").forEach((m) => m.remove());
  const hz = HAZARDS.find((x) => x.id === state.hazard);
  for (const s of state.systems) {
    const [x, y] = POS[s.system] || [0, 0];
    const hit = !hz || hz.hits === "all" || hz.hits.includes(s.system);
    const el = document.createElement("div");
    el.className = `marker ${s.status}`;
    el.style.cssText = `left:${x}px;top:${y}px;opacity:${hit ? 1 : 0.28}`;
    el.innerHTML = `<button type="button" data-sys="${s.system}" aria-pressed="${state.sel === s.system}"
        aria-label="${esc(s.title)}: ${STATUS_WORD[s.status]}" style="background:${COLOURS[s.status]}">${icon(s.status)}</button>
      <span>${esc(SHORT[s.system] || s.system)}</span>`;
    body.appendChild(el);
  }
}

function icon(status) {
  const p = { green: "M5 12.5l4.5 4.5L19 7.5", amber: "M12 6v8M12 17.5v.5", red: "M7 7l10 10M17 7L7 17" }[status];
  return `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="${p}" fill="none" stroke="#0b1320" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function renderDetail() {
  if (state.sel === "radiation") return renderRadiation(state.rad);
  const s = state.systems.find((x) => x.system === state.sel);
  if (!s) return;
  const c = COLOURS[s.status];
  $("detail").innerHTML = `
    <div class="head"><h2>${esc(s.title)}</h2><span class="pill" style="background:${c}">${STATUS_WORD[s.status]}</span></div>
    <div class="headline">${esc(s.headline)}</div>
    <div class="chart"><div class="chart-head"><span>Last 14 days · ${esc(s.unit)} · usual range ${s.usualRange.join("–")}</span>${cite(C.demo())}</div>
      ${sparkline(s.series, s.usualRange, c)}<div style="font-size:13px;margin-top:4px">Latest: <b>${esc(s.latest)}</b></div></div>
    <div class="two">
      <div><div class="label">Why it matters in space</div><div>${esc(s.why)}</div><div style="color:#8fbcff;font-size:12px;margin-top:4px">NASA: ${esc(s.nasaRisk)} ${cite(C.risk())}</div></div>
      <div><div class="label">How it's measured</div><div>${esc(s.measured)}</div></div>
    </div>
    <div class="actions" style="border-color:${c}"><div class="label">What to do now</div>
      <ul><li><span class="who ${esc(s.whoActs)}">${WHO[s.whoActs] || ""}</span><span>${esc(s.action)}</span></li></ul></div>`;
}

function renderRadiation(r) {
  const c = COLOURS[r.status];
  const d = r.dose;
  const limitTxt = d.limitDay ? `Day ${d.limitDay}` : "Not reached";
  const storm = r.storm ? `<div class="chart" style="border:1px solid ${r.storm.severity === "red" ? "var(--red)" : "var(--amber)"}">
      <b>Storm replay:</b> solar particle event ${r.storm.date ? esc(r.storm.date) : "(demo)"} ${cite(C.donki(r.storm))}
      · extra dose from this event: <b>${r.storm.extraDose} mSv</b> ${cite(C.stormDose(r))}</div>` : "";
  const neutrons = r.breakdown ? `<div class="chart"><div class="chart-head"><span>Today's dose by particle type (station)</span>${cite(C.csa())}</div>
      ${splitBar(r.breakdown.neutrons_share)}<div style="font-size:12px;color:var(--muted);margin-top:6px">Neutrons need their own detector, like CSA's CANS.</div></div>` : "";
  $("detail").innerHTML = `
    <div class="head"><h2>Radiation exposure</h2><span class="pill" style="background:${c}">${STATUS_WORD[r.status]}</span></div>
    <div class="headline">${esc(r.headline)}</div>
    <div class="stats">
      <div class="stat"><small>Career dose so far</small><b>${d.soFar.toFixed(0)} mSv</b></div>
      <div class="stat"><small>Projected at mission end</small><b style="color:${c}">${d.projectedTotal.toFixed(0)} mSv</b></div>
      <div class="stat"><small>NASA career limit ${cite(C.limit())}</small><b>${d.limit.toFixed(0)} mSv</b></div>
      <div class="stat"><small>Limit reached</small><b>${limitTxt}</b></div>
    </div>
    <div class="chart"><div class="chart-head"><span>Career dose by mission day · ${esc(r.mission.phaseToday)} today · solid = so far, dashed = projected, band = uncertainty</span>${cite(C.rates(r))}</div>
      ${cumulativeChart(r, c)}</div>
    ${storm}
    <div class="chart"><div class="chart-head"><span>Daily dose rate, last ${r.recent.values.length} days (mSv/day) · ${esc(r.mission.instrument)}</span>${cite(C.recent(r))}</div>
      ${recentChart(r)}</div>
    ${neutrons}
    <div class="actions" style="border-color:${c}"><div class="label">What to do now</div>
      <ul>${r.actions.map((a) => `<li><span class="who ${esc(a.who)}">${WHO[a.who] || ""}</span><span>${esc(a.text)}</span></li>`).join("")}</ul></div>
    <div class="two">
      <div><div class="label">Why it matters in space</div><div>Space radiation passes through the hull and the body, raising lifetime cancer risk. Solar storms can add a large dose within hours.</div>
        <div style="color:#8fbcff;font-size:12px;margin-top:4px">NASA: ${esc(r.nasaRisk)} ${cite(C.risk())}</div></div>
      <div><div class="label">How it's measured</div><div>Cabin and personal dosimeters (here: ${esc(r.mission.instrument)} via NASA RadLab) and DONKI space weather alerts.</div></div>
    </div>
    <details><summary>Method and assumptions</summary><ul>${r.assumptions.map((a) => `<li>${esc(a)}</li>`).join("")}
      ${Object.values(r.sources).map((s) => `<li>${esc(s)}</li>`).join("")}</ul></details>`;
}

// ---------- charts (plain SVG, no library, works offline) ----------
function sparkline(vals, range, colour) {
  const W = 600, H = 120, p = 10;
  let lo = Math.min(range[0], ...vals), hi = Math.max(range[1], ...vals);
  if (hi === lo) hi = lo + 1;
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const x = (i) => p + i * ((W - 2 * p) / (vals.length - 1));
  const y = (v) => p + (H - 2 * p) * (1 - (v - lo) / (hi - lo));
  const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="14 day trend">
    <rect x="0" y="${y(range[1])}" width="${W}" height="${Math.max(2, y(range[0]) - y(range[1]))}" fill="rgba(106,168,255,.22)"/>
    <polyline points="${pts}" fill="none" stroke="${colour}" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="${x(vals.length - 1)}" cy="${y(vals[vals.length - 1])}" r="5" fill="${colour}"/></svg>`;
}

function cumulativeChart(r, colour) {
  const W = 680, H = 270, L = 52, R = 14, T = 26, B = 40;
  const total = r.mission.totalDays, lim = r.dose.limit;
  const maxY = Math.max(lim * 1.15, ...r.band.high, r.dose.projectedTotal) * 1.03;
  const x = (d) => L + (d - 1) / Math.max(1, total - 1) * (W - L - R);
  const y = (v) => T + (H - T - B) * (1 - v / maxY);
  const so = r.cumulative.map((p) => `${x(p.day)},${y(p.value)}`).join(" ");
  const last = r.cumulative[r.cumulative.length - 1];
  const pr = [last, ...r.projection].map((p) => `${x(p.day)},${y(p.value)}`).join(" ");
  const bandTop = r.projection.map((p, i) => `${x(p.day)},${y(r.band.high[i])}`);
  const bandBot = r.projection.map((p, i) => `${x(p.day)},${y(r.band.low[i])}`).reverse();
  const band = [`${x(last.day)},${y(last.value)}`, ...bandTop, ...bandBot].join(" ");
  let grid = "";
  for (let v = 0; v <= maxY; v += 200) grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#1f2d45"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#9fb0c8">${v}</text>`;
  const step = total > 400 ? 100 : total > 150 ? 30 : 7;
  for (let d = step; d <= total; d += step) grid += `<text x="${x(d)}" y="${H - B + 16}" text-anchor="middle" font-size="11" fill="#9fb0c8">${d}</text>`;
  const limitMark = r.dose.limitDay ? `<circle cx="${x(r.dose.limitDay)}" cy="${y(lim)}" r="6" fill="#ff6b5e" stroke="#0b1320" stroke-width="2"/>
    <text x="${x(r.dose.limitDay)}" y="${y(lim) + 22}" text-anchor="middle" font-size="12" font-weight="700" fill="#ff6b5e">Limit reached · day ${r.dose.limitDay}</text>` : "";
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Career dose projection">
    ${grid}
    <text x="${L}" y="14" font-size="11" fill="#9fb0c8">mSv</text>
    <polygon points="${band}" fill="${colour}" fill-opacity=".14"/>
    <line x1="${L}" x2="${W - R}" y1="${y(lim)}" y2="${y(lim)}" stroke="#ff6b5e" stroke-width="1.5" stroke-dasharray="6 5"/>
    <text x="${L + 8}" y="${y(lim) - 6}" font-size="12" font-weight="600" fill="#ff6b5e">NASA career limit ${lim} mSv</text>
    <line x1="${x(last.day)}" x2="${x(last.day)}" y1="${T}" y2="${H - B}" stroke="#c6d3e6" stroke-dasharray="2 4"/>
    <text x="${x(last.day) + 6}" y="${T + 10}" font-size="12" fill="#e8eef7">Today · day ${last.day}</text>
    <polyline points="${so}" fill="none" stroke="#e8eef7" stroke-width="2.5"/>
    <polyline points="${pr}" fill="none" stroke="${colour}" stroke-width="2.5" stroke-dasharray="7 5"/>
    ${limitMark}
    <text x="${(L + W - R) / 2}" y="${H}" text-anchor="middle" font-size="11" fill="#9fb0c8">mission day</text>
  </svg>`;
}

function recentChart(r) {
  const vals = r.recent.values, W = 680, H = 150, L = 44, B = 22, T = 8;
  const sorted = [...vals].sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)];
  const maxY = Math.max(...vals) * 1.1 || 1;
  const bw = (W - L - 6) / vals.length;
  const y = (v) => T + (H - T - B) * (1 - v / maxY);
  const bars = vals.map((v, i) => {
    const spike = r.storm && v > median * 1.5;
    return `<rect x="${L + i * bw + 1}" y="${y(v)}" width="${bw - 2}" height="${H - B - y(v)}" rx="2" fill="${spike ? "#ff6b5e" : "#6aa8ff"}" fill-opacity="${spike ? 1 : 0.7}"><title>${v.toFixed(2)} mSv/day</title></rect>`;
  }).join("");
  const first = r.recent.dates ? r.recent.dates[0] : `${vals.length} days ago`;
  const lastLbl = r.recent.dates ? r.recent.dates[r.recent.dates.length - 1] : "today";
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily dose rate">
    <line x1="${L}" x2="${W}" y1="${y(median)}" y2="${y(median)}" stroke="#c6d3e6" stroke-dasharray="3 4"/>
    <text x="${L - 6}" y="${y(median) + 4}" text-anchor="end" font-size="11" fill="#9fb0c8">${median.toFixed(2)}</text>
    ${y(median) - y(maxY / 1.1) > 14 ? `<text x="${L - 6}" y="${y(maxY / 1.1) + 4}" text-anchor="end" font-size="11" fill="#9fb0c8">${(maxY / 1.1).toFixed(2)}</text>` : ""}
    ${bars}
    <text x="${L}" y="${H - 4}" font-size="11" fill="#9fb0c8">${esc(first)}</text>
    <text x="${W}" y="${H - 4}" text-anchor="end" font-size="11" fill="#9fb0c8">${esc(lastLbl)}</text>
  </svg>`;
}

function splitBar(share) {
  const n = Math.round(share * 100);
  return `<svg viewBox="0 0 600 34" role="img" aria-label="Neutrons ${n} percent, charged particles ${100 - n} percent">
    <rect x="0" y="0" width="${600 * (1 - share)}" height="34" rx="6" fill="#6aa8ff"/>
    <rect x="${600 * (1 - share)}" y="0" width="${600 * share}" height="34" rx="6" fill="#f2b440"/>
    <text x="10" y="22" font-size="13" font-weight="700" fill="#0b1320">Charged particles ${100 - n}%</text>
    <text x="590" y="22" text-anchor="end" font-size="13" font-weight="700" fill="#0b1320">Neutrons ${n}%</text></svg>`;
}

// ---------- right column ----------
const CHECKS = [
  { id: "bp", label: "Blood pressure & heart rate", sub: "Cuff, sitting quietly · 2 min" },
  { id: "mood", label: "Mood & stress survey", sub: "5 taps · 30 s" },
  { id: "fatigue", label: "Fatigue test", sub: "Tap when the dot appears · 3 min" },
  { id: "vision", label: "Vision grid", sub: "One eye at a time · 1 min" },
];
function renderChecks() {
  const n = CHECKS.filter((k) => state.done[k.id]).length;
  $("checks-count").textContent = `${n} of ${CHECKS.length} done`;
  $("checks").innerHTML = CHECKS.map((k) => {
    const d = !!state.done[k.id];
    return `<button type="button" class="check${d ? " done" : ""}" data-check="${k.id}" aria-pressed="${d}">
      <span class="box">${d ? `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#0b1320" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ""}</span>
      <span><b>${esc(k.label)}</b><small>${d ? "Done today" : esc(k.sub)}</small></span></button>`;
  }).join("");
  $("streak").textContent = n === CHECKS.length ? state.streak + 1 : state.streak;
}
function renderEvents() {
  const box = $("events");
  if (!state.events.length) {
    box.innerHTML = `<div class="event" style="flex-direction:column;align-items:flex-start">
        <span>No DONKI events cached yet. Run <code>python -m radiation.donki 2017-01-01 2024-12-31</code>, then reload.</span>
        <button type="button" data-event="demo">Replay demo storm (simulated)</button></div>`;
    return;
  }
  box.innerHTML = state.events.slice(0, 40).map((e) => `<div class="event">
      <span><b>${esc(e.date)}</b><br><span style="color:var(--muted)">${esc((e.instruments || []).slice(0, 2).join(", ") || "SEP event")}</span></span>
      <button type="button" data-event="${esc(e.id)}" aria-label="Replay event ${esc(e.date)}">Replay</button></div>`).join("");
}

function renderOutbox() {
  const r = state.rad;
  const arrive = { station: "within seconds", moon: "in ~1.3 s", mars: "in 4 to 24 min" }[r.mission.mode];
  const msgs = [];
  if (r.storm) msgs.push({ t: "Radiation alert and crew status", s: `To flight surgeon · arrives ${arrive} · sent automatically` });
  if (r.status === "red" && !r.storm) msgs.push({ t: "Dose plan review requested", s: `Projected ${r.dose.projectedTotal.toFixed(0)} mSv vs ${r.dose.limit} mSv limit · arrives ${arrive}` });
  msgs.push({ t: "Daily summary (you chose what to share)", s: "Queued for next downlink" });
  $("outbox").innerHTML = msgs.map((m) => `<div class="msg"><b>${esc(m.t)}</b><small>${esc(m.s)}</small></div>`).join("");
}

// ---------- events ----------
document.addEventListener("click", (e) => {
  const cb = e.target.closest(".cite");
  if (cb) { e.stopPropagation(); cb.getAttribute("aria-expanded") === "true" ? closeCite() : openCite(cb); return; }
  if (!e.target.closest("#cite-pop")) closeCite();
  const t = e.target.closest("button");
  if (!t) return;
  if (t.dataset.mode) { state.mode = t.dataset.mode; load(); }
  else if (t.dataset.sys) { state.sel = t.dataset.sys; render(); }
  else if (t.dataset.h) { state.hazard = state.hazard === t.dataset.h ? null : t.dataset.h; render(); }
  else if (t.dataset.event) { state.event = t.dataset.event; state.sel = "radiation"; load(); }
  else if (t.id === "end-storm") { state.event = null; load(); }
  else if (t.dataset.check) { state.done[t.dataset.check] = !state.done[t.dataset.check]; renderChecks(); }
});

load().catch((err) => { $("detail").innerHTML = `<p>Could not load data: ${esc(err.message)}</p>`; });
loadEvents().catch(() => {});

document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCite(); });
