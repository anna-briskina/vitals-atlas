// Crew Health front end: three views (Normal, Crew doctor, Emergency) over one shared server state.
// Colour is used only for NASA alert classes (red emergency/warning, yellow caution, blue advisory).

const params = new URLSearchParams(location.search);
const ui = {
  me: params.get("as") || "lena",
  tab: params.get("view") === "doctor" ? "doctor" : "health",
  selInd: null, selPerson: "lena", rad: null, events: [], S: null, hash: "", offset: 0, drafts: {},
};

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const NAMES = { lena: "Lena", sam: "Sam", ravi: "Ravi", maya: "Maya" };
const clock = (t) => new Date(t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const serverNow = () => Date.now() / 1000 + ui.offset;
const mins = (s) => s < 90 ? `${Math.max(0, Math.round(s))} s` : `${Math.round(s / 60)} min`;

// ---------- icons (shape carries meaning with the word, not colour alone) ----------
const ICON = {
  ok: `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  caution: `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l10 18H2z" fill="currentColor"/><path d="M12 10v5M12 18v.5" stroke="#f5c242" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  advisory: `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M12 11v6M12 7.5v.5" stroke="#5aa9ff" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  warning: `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2h8l6 6v8l-6 6H8l-6-6V8z" fill="currentColor"/><path d="M12 7v6M12 16.5v.5" stroke="#ff5c4d" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  dash: `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
  info: `<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`,
};
const TAG = {
  emergency: `<span class="tag emergency">${ICON.warning}Emergency</span>`,
  caution: `<span class="tag caution">${ICON.caution}Caution</span>`,
  advisory: `<span class="tag advisory">${ICON.advisory}Advisory</span>`,
};

// ---------- citations ----------
const CITES = new Map();
let citeSeq = 0;
function cite(c) {
  const id = `c${++citeSeq}`;
  CITES.set(id, c);
  return `<button type="button" class="cite${c.simulated ? " sim" : ""}" data-cite="${id}" aria-haspopup="dialog" aria-label="Source: ${esc(c.label)}">${ICON.info}${esc(c.label)}</button>`;
}
const L = {
  cardio: { t: "NASA: Risk of Cardiovascular Adaptations", u: "https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/" },
  norsk: { t: "Norsk et al. 2015, Journal of Physiology (blood pressure in flight)", u: "https://doi.org/10.1113/jphysiol.2014.284869" },
  stahn: { t: "Stahn et al. 2017, Scientific Reports (core temperature in flight)", u: "https://doi.org/10.1038/s41598-017-15560-w" },
  barger: { t: "Barger et al. 2014, Lancet Neurology (sleep in flight)", u: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4188436" },
  trim: { t: "Trim et al. 2023, Clinical Nutrition (blood sugar, bed rest)", u: "https://doi.org/10.1016/j.clnu.2023.02.006" },
  behav: { t: "NASA: Risk of Behavioral Conditions and Psychiatric Disorders", u: "https://www.nasa.gov/reference/risk-of-behavioral-conditions-and-psychiatric-disorders/" },
  osdr569: { t: "NASA OSDR OSD-569 (Inspiration4 blood count)", u: "https://osdr.nasa.gov/bio/repo/data/studies/OSD-569" },
  osdr575: { t: "NASA OSDR OSD-575 (Inspiration4 metabolic panel)", u: "https://osdr.nasa.gov/bio/repo/data/studies/OSD-575" },
  radlab: { t: "NASA OSDR RadLab", u: "https://visualization.osdr.nasa.gov/radlab/gui/" },
  zeitlin: { t: "Zeitlin et al. 2013, Science (Curiosity RAD, cruise)", u: "https://doi.org/10.1126/science.1235989" },
  hassler: { t: "Hassler et al. 2014, Science (Curiosity RAD, Mars surface)", u: "https://doi.org/10.1126/science.1244797" },
  zhang: { t: "Zhang et al. 2020, Science Advances (Chang'e 4, Moon surface)", u: "https://doi.org/10.1126/sciadv.aaz1334" },
  csa: { t: "CSA: Monitoring Radiation for Astronaut Health (2026)", u: "https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp" },
};
const SRC = {
  research_cardio: { label: "NASA cardio risk", title: "Cardiovascular adaptations", body: "NASA names rhythm disturbances, clots and fainting at landing among the cardiovascular hazards of spaceflight.", links: [L.cardio] },
  norsk: { label: "Norsk 2015", title: "Blood pressure and heart rate in flight", body: "24-hour average blood pressure fell 8 to 10 mmHg on the ISS; resting heart rate was unchanged.", links: [L.norsk] },
  stahn: { label: "Stahn 2017", title: "Core temperature in flight", body: "Resting core temperature rose about 1 °C over about 2.5 months on six-month ISS missions.", links: [L.stahn] },
  barger: { label: "Barger 2014", title: "Sleep in flight", body: "Astronauts slept about 6 hours on the ISS against 8.5 scheduled.", links: [L.barger] },
  trim: { label: "Trim 2023", title: "Blood sugar with inactivity", body: "In a 60-day bed rest study, daily blood sugar rose 6% and fasting insulin 40%.", links: [L.trim] },
  behav: { label: "NASA behavioural risk", title: "Behavioural conditions", body: "Isolation and confinement affect mood, sleep and decisions. NASA's risk page lists no monitoring tool.", links: [L.behav] },
  demo: { label: "Demo values", simulated: true, title: "Demo values", body: "Values for a fictional crew member, shaped by the published in-flight changes cited on each indicator.", links: [] },
  rule: { label: "Alert rule", simulated: true, title: "Screening alert rule (team design)", body: "Fires when the chest strap ECG's ST segment stays outside the person's own usual range on 3 consecutive 10-minute averages and resting heart rate is also outside its usual range. A design choice to be tuned with flight data; a chest strap is a screening signal, not diagnostic.", links: [] },
  thygesen: { label: "Thygesen 2018", title: "ST-elevation criterion", body: "Fourth Universal Definition of Myocardial Infarction: new ST elevation at the J point of at least 1 mm in two contiguous leads (higher thresholds in leads V2 to V3), measured on a 12-lead ECG. Meeting it indicates possible myocardial infarction; diagnosis needs clinical assessment.", links: [{ t: "Thygesen et al. 2018, Circulation", u: "https://doi.org/10.1161/CIR.0000000000000617" }] },
  symptom: { label: "Quick check", title: "Reported symptom", body: "Chest discomfort, pressure or pain, as answered by the crew member in the quick check.", links: [] },
  labs: { label: "NASA OSDR", title: "Real astronaut lab results", body: "Inspiration4 crew member C001: blood count (OSD-569) and metabolic panel (OSD-575), with the testing lab's own normal ranges. Shown as an example lab history; not Lena's data.", links: [L.osdr569, L.osdr575] },
};
function openCite(btn) {
  const c = CITES.get(btn.dataset.cite), pop = $("cite-pop");
  if (!c) return;
  pop.innerHTML = `<b>${esc(c.title)}</b><p>${esc(c.body)}</p>${c.links.length ? `<ul>${c.links.map((l) => `<li><a href="${esc(l.u)}" target="_blank" rel="noopener">${esc(l.t)}</a></li>`).join("")}</ul>` : ""}`;
  pop.hidden = false;
  const b = btn.getBoundingClientRect();
  pop.style.left = `${Math.max(8, Math.min(scrollX + b.left, scrollX + document.documentElement.clientWidth - pop.offsetWidth - 8))}px`;
  pop.style.top = `${scrollY + b.bottom + 6}px`;
  btn.setAttribute("aria-expanded", "true");
}
function closeCite() { $("cite-pop").hidden = true; document.querySelectorAll(".cite[aria-expanded=true]").forEach((x) => x.setAttribute("aria-expanded", "false")); }

// ---------- data ----------
async function getJSON(u, opt) { const r = await fetch(u, opt); if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); }
async function post(type, extra = {}) {
  const S = await getJSON("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, who: ui.me, ...extra }) });
  accept(S, true);
  if (type === "spe_start" || type === "stand_down" || type === "reset") loadRad();
}
async function poll() {
  try { accept(await getJSON("/api/state")); } catch (e) { /* offline: keep showing the last state */ }
}
function accept(S, force) {
  ui.offset = S.now - Date.now() / 1000;
  const { now, ...rest } = S;
  const h = JSON.stringify(rest);
  const modeChanged = ui.S && ui.S.mode !== S.mode;
  const emKey = S.emergency ? S.emergency.id : null, emChanged = ui.S && (ui.S.emergency ? ui.S.emergency.id : null) !== emKey;
  ui.S = S;
  if (modeChanged || emChanged) loadRad();
  if (force || h !== ui.hash) { ui.hash = h; if (!typing()) render(); }
}
function typing() { const a = document.activeElement; return a && a.tagName === "INPUT" && a.type === "text" && !ui.forceRender; }
async function loadRad() {
  const ev = ui.S && ui.S.emergency && ui.S.emergency.kind === "spe" ? `&event=${encodeURIComponent(ui.S.emergency.event || "demo")}` : "";
  try { ui.rad = await getJSON(`/api/radiation?mode=${ui.S ? ui.S.mode : "mars"}${ev}`); render(); } catch (e) {}
}
async function loadEvents() {
  try { const r = await getJSON("/api/donki/events"); ui.events = r.events || []; } catch (e) { ui.events = []; }
  $("spe-events").innerHTML = (ui.events.length ? ui.events.slice(0, 24).map((e) =>
    `<button type="button" class="btn small secondary" data-spe="${esc(e.id)}">${esc(e.date)}</button>`).join("") : "<small>No DONKI events cached.</small>")
    + `<button type="button" class="btn small ghost" data-spe="demo">Demo event (simulated)</button>`;
}

// ---------- render ----------
function render() {
  const S = ui.S;
  if (!S) return;
  CITES.clear(); closeCite();
  $("as-select").value = ui.me;
  document.querySelectorAll(".modes button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === S.mode)));
  $("delay").textContent = { station: "near-live", moon: "about 1.3 s each way", mars: "4 to 24 min each way (demo: 14 min)" }[S.mode];
  $("who-line").textContent = `${NAMES[ui.me]} · mission day ${S.mission_day} · demo crew`;
  $("get-doctor").hidden = ui.me === "sam";
  const e = S.emergency;
  if (e && ui.emId !== e.id) { ui.emId = e.id; ui.tab = "emergency"; if (e.kind === "spe") ui.selInd = "rad"; }
  if (!e && ui.tab === "emergency") ui.tab = ui.me === "sam" ? "doctor" : "health";
  const tabs = [];
  if (e) tabs.push(["emergency", "Emergency"]);
  tabs.push(["health", "My health"]);
  if (ui.me === "sam") tabs.push(["doctor", "Crew doctor"]);
  $("tabs").innerHTML = tabs.length > 1 ? tabs.map(([k, t]) => `<button type="button" data-tab="${k}" aria-pressed="${ui.tab === k}">${t}</button>`).join("") : "";
  if (e && ui.tab === "emergency") return renderEmergency(S);
  if (ui.tab === "doctor" && ui.me === "sam") renderDoctor(S); else renderNormal(S);
  if (e) $("main").insertAdjacentHTML("afterbegin", emergencyStrip(S));
}

// Persistent strip shown on the other views while an emergency is active.
function emergencyStrip(S) {
  const e = S.emergency, me = ui.me, isPatient = e.patient === me;
  const act = e.kind === "spe" ? ACTION.spe : (isPatient ? ACTION.heart.patient : ACTION.heart[me]);
  return `<div class="emg-head" role="alert">${ICON.warning}<span class="tag" style="background:var(--red-ink);color:var(--red)">Emergency</span>
    <span class="what">${esc(e.what)} · ${esc(act)}</span>
    <span class="spacer"></span><button type="button" class="btn small" data-tab="emergency" style="background:var(--red-ink);color:#fff">Back to emergency</button></div>`;
}

// ===================== NORMAL VIEW =====================
const MISSING = { not_entered: "Not entered yet", sensor_off: "Sensor off", fault: "Sensor fault", stale: "Stale" };
const NEXT = {
  ecg: ["Answer the quick check above, then take a Heart reading with the 12-lead ECG from the medical kit.", "Crew doctor (already told)"],
  hr: ["Rest for 10 minutes and let the strap take a new reading.", "Crew doctor (already told)"],
};
const CHANGED = {
  ecg: "Your chest strap ECG shows an ST shift of +0.9 mm, outside your usual ±0.2 mm, rising over the last 6 hours.",
  hr: "Your resting heart rate is 68 bpm, above your usual 52–60, rising over the last 6 hours.",
};

const SHELTER_WORD = { alerted: "Not yet acknowledged", acknowledged: "On the way to the shelter", in_shelter: "In the storm shelter" };
function speOn(S) { return S.emergency && S.emergency.kind === "spe"; }
function stormDose() { const r = ui.rad; return r && r.storm ? r.storm : null; }
const ARS_SRC = { label: "CDC", title: "Acute radiation sickness threshold", body: "Acute radiation syndrome usually needs a large whole-body dose received quickly, generally above about 0.7 gray (Gy). Doses from a sheltered solar storm are far below that, so vital signs are not expected to change; the concern is the added lifetime (career) dose.", links: [{ t: "CDC: Acute Radiation Syndrome", u: "https://www.cdc.gov/radiation-emergencies/hcp/clinical-guidance/ars.html" }] };

function heartRelevant(S) {
  const h = S.heart;
  return h && ["caution", "countdown", "doctor_woken", "monitored", "confirmed"].includes(h.stage);
}
function radAlert() {
  const r = ui.rad;
  if (!r || r.dose.shareOfLimit < 0.8) return null;
  return r.dose.limitDay
    ? `Projected to pass the 600 mSv career limit on mission day ${r.dose.limitDay}, ${r.dose.limitDay - r.mission.today} days from now. Flight surgeons will review the dose plan.`
    : `Projected to use ${Math.round(r.dose.shareOfLimit * 100)}% of the 600 mSv career limit by the end of the mission.`;
}

function renderNormal(S) {
  const me = ui.me, inds = (S.indicators[me] || []).slice(), rad = ui.rad, isLena = me === "lena";
  const heartOn = isLena && heartRelevant(S);
  const flagged = inds.filter((i) => i.state === "flag");
  const ordered = [...flagged, ...inds.filter((i) => i.state !== "flag" && i.state !== "missing"), ...inds.filter((i) => i.state === "missing")];
  if (heartOn && ui.autoSel !== S.heart.id) { ui.selInd = "ecg"; ui.autoSel = S.heart.id; }
  if (!ui.selInd || (ui.selInd !== "rad" && !inds.find((i) => i.key === ui.selInd))) ui.selInd = (flagged[0] || inds[0]).key;

  let status;
  const myRoster = S.emergency ? S.emergency.roster[me] : null;
  if (speOn(S)) status = `<div class="status">${TAG.emergency}<div><b>Solar particle event: radiation dose rate raised</b><br><small>You: ${esc(SHELTER_WORD[myRoster] || myRoster)}</small></div></div>`;
  else if (S.emergency && S.emergency.patient === me) status = `<div class="status">${TAG.emergency}<b>Possible heart attack: help is coming</b></div>`;
  else if (heartOn) status = `<div class="status">${TAG.caution}<b>Possible heart problem: quick check needed</b></div>`;
  else if (S.spe_caution) status = `<div class="status">${TAG.caution}<b>Solar particle event: follow ground instructions</b></div>`;
  else if (inds.some((i) => i.state === "missing" && i.missing === "sensor_off")) status = `<div class="status"><span class="ico">${ICON.dash}</span><div><b>Some readings are missing</b><br><small>Your watch is not sending data. Missing data is never counted as normal.</small></div></div>`;
  else status = `<div class="status"><span class="ico">${ICON.ok}</span><div><b>Within your usual ranges</b><br><small>Data current at ${clock(S.now)}</small></div></div>`;

  const alerts = [];
  if (speOn(S)) {
    const st = stormDose();
    alerts.push(`<div class="alert warning"><div class="row">${TAG.emergency}<b>Storm in progress: added radiation dose</b></div>
      <div>${st ? (st.doseSource === "real" && !st.detected ? "No increase above normal variation has been measured at this location yet."
        : `Extra dose from this storm so far: <b>${st.extraDose} mSv</b> (habitat estimate${st.doseSource === "simulated" ? ", simulated profile" : ""}), added to your career dose.`) : "Loading storm dose…"}</div>
      <div>Your status: <b>${esc(SHELTER_WORD[myRoster] || myRoster)}</b>${myRoster !== "in_shelter" ? ". Go to the storm shelter now." : "."}</div>
      <small>Your other indicators are not expected to change: storm doses in a shelter are far below the level that causes immediate symptoms. ${cite(ARS_SRC)}</small>
      ${myRoster !== "in_shelter" ? `<div><button type="button" class="btn small" data-respond="in_shelter">I'm in the shelter</button></div>` : ""}</div>`);
  }
  if (heartOn) alerts.push(heartCaution(S));
  if (S.spe_caution) alerts.push(`<div class="alert caution"><div class="row">${TAG.caution}<b>${esc(S.spe_caution.text)}</b></div>
      <small>At the station, Earth's magnetic field shields most of each orbit. The ground radiation team directs precautions.</small>
      <div><button type="button" class="btn small secondary" data-act="spe_end">Acknowledge: alert over</button></div></div>`);
  if (isLena && S.access_closed_notice) alerts.push(`<div class="alert advisory"><div class="row">${TAG.advisory}<b>Crew access to your data closed at ${clock(S.access_closed_notice.at)}</b></div>
      <small>Shared during the emergency: ${esc(S.access_closed_notice.data)}, with ${esc(S.access_closed_notice.shared_with)}. Your mood check-ins and journal were never shared.</small></div>`);
  const ra = radAlert();
  if (ra) alerts.push(`<div class="alert advisory"><div class="row">${TAG.advisory}<b>Radiation dose plan</b></div><div>${esc(ra)}</div>
      <div><button type="button" class="btn small ghost" data-ind="rad">See radiation details</button></div></div>`);
  if (S.doctor_woken && S.doctor_woken.by === me) alerts.push(`<div class="alert advisory"><div class="row">${TAG.advisory}<b>Crew doctor notified at ${clock(S.doctor_woken.at)}</b></div><small>Sam is coming to you. Nobody else has been alerted.</small></div>`);

  const radRow = rad ? `<button type="button" class="ind ${ra || speOn(S) ? "" : "quiet"}" data-ind="rad" aria-pressed="${ui.selInd === "rad"}">
      <span><span class="nm">Radiation, career dose</span><br>${speOn(S) ? TAG.emergency : "<small>Career limit 600 mSv</small>"}</span>
      <span class="val">${rad.dose.soFar.toFixed(0)} <small>mSv</small></span>
      <span class="trend">Projected ${rad.dose.projectedTotal.toFixed(0)} mSv at mission end</span></button>` : "";

  $("main").innerHTML = `<div class="grid2">
    <div class="stack">
      <section class="panel">${status}</section>
      ${alerts.join("")}
      <section class="panel stack">
        <div class="row" style="justify-content:space-between"><h3>My indicators</h3><small>Against your own in-flight usual range</small></div>
        ${ordered.map(indRow).join("")}
        ${radRow}
      </section>
      ${checkins(S)}
      ${isLena ? accessLog(S) : ""}
    </div>
    <div class="stack">${ui.selInd === "rad" ? radDetail() : indDetail(inds.find((i) => i.key === ui.selInd))}</div>
  </div>`;
}

function heartCaution(S) {
  const h = S.heart, m = h.model;
  const head = `<div class="row">${TAG.caution}<b>Possible heart problem</b><small>issued ${clock(h.issued_at)}</small></div>
    <div style="font-size:16px">${esc(m.summary)}</div>
    <small>Based on: ${esc(m.coverage.text)} ${cite(m.level === "criterion_met" ? SRC.thygesen : SRC.rule)}</small>
    <small>Only you and the crew doctor have been told.</small>`;
  let body = "";
  if (h.stage === "caution") {
    body = `<div><b>Quick check: do you have chest discomfort, pressure or pain right now?</b></div>
      <div class="choice">
        <button type="button" data-qc="yes"><b>Yes</b><small>A ${S.countdown_s}-second countdown starts, then the whole crew is alerted. You can stop it.</small></button>
        <button type="button" data-qc="unsure"><b>Not sure</b><small>The crew doctor is woken. Nobody else is alerted.</small></button>
        <button type="button" data-qc="no"><b>No</b><small>The result is monitored and you recheck in 1 hour.</small></button>
      </div>`;
  } else if (h.stage === "countdown") {
    body = `<div class="row"><span class="countdown" data-countdown="${h.countdown_end}">…</span><span>until the whole crew is alerted<br><small>Started by ${esc(h.countdown_by)}</small></span>
      <button type="button" class="btn" data-act="stop_countdown">Stop: wake only the crew doctor</button></div>`;
  } else {
    const what = { doctor_woken: "The crew doctor has been woken and is reviewing your result.", monitored: "Monitored: recheck in 1 hour, or sooner if you feel unwell.", confirmed: "The crew doctor has reviewed your result and will tell you the next step." }[h.stage] || "";
    body = `<div>${esc(what)} ${h.quick_check ? `<small>Your quick check answer: ${esc({ yes: "Yes", no: "No", unsure: "Not sure" }[h.quick_check])}.</small>` : ""}</div>`;
  }
  const reading = h.heart_reading ? `<small>Heart reading (12-lead ECG) taken at ${clock(h.reading_at)}.</small>`
    : `<div><button type="button" class="btn ghost small" data-act="heart_reading">Take a Heart reading (12-lead ECG)</button></div>`;
  return `<div class="alert caution">${head}${body}${reading}</div>`;
}

function indRow(i) {
  const flag = i.state === "flag", miss = i.state === "missing";
  const val = miss ? `<span class="val">${ICON.dash} ${esc(MISSING[i.missing] || "No data")}</span>` : `<span class="val">${esc(i.value)} <small>${esc(i.unit)}</small></span>`;
  const sub = flag ? TAG.caution : `<small>${i.private ? "Private to you" : `Usual ${esc(i.usual)}`}${i.preventive ? " · preventive step" : ""}</small>`;
  return `<button type="button" class="ind ${flag ? "" : miss ? "missing" : "quiet"}" data-ind="${i.key}" aria-pressed="${ui.selInd === i.key}">
    <span><span class="nm">${esc(i.name)}</span><br>${sub}</span>${val}
    <span class="spark">${i.series && !miss ? spark(i.series, i.band) : `<span class="trend">${miss ? "Not counted as normal" : ""}</span>`}</span></button>`;
}

function indDetail(i) {
  if (!i) return "";
  const flag = i.state === "flag", miss = i.state === "missing", src = SRC[i.src] || SRC.demo;
  let changed, next, who;
  if (flag) { changed = CHANGED[i.key] || "Outside your usual range."; [next, who] = NEXT[i.key] || ["Recheck later.", "Crew doctor"]; }
  else if (miss && i.missing === "not_entered") { changed = "No reading entered today. This is not a warning."; next = "Enter today's reading."; who = "Only you"; }
  else if (miss) { changed = "Your watch is not sending data. Missing data is never counted as normal."; next = "Put the watch on and check that it shows a connection."; who = "Only you"; }
  else if (i.preventive) { changed = i.preventive; next = "A small preventive step, before this reaches a caution level."; who = "Only you"; }
  else { changed = "Within your usual range."; next = "No action needed. Next check: tomorrow morning."; who = "Nobody"; }
  return `<section class="panel stack">
    <div class="row"><h2>${esc(i.name)}</h2>${flag ? TAG.caution : ""}</div>
    <div style="font-size:16px">${esc(changed)}</div>
    ${miss ? (i.missing === "not_entered" ? `<div><button type="button" class="btn" data-checkin="${i.key}">Enter now</button></div>` : "")
      : i.series ? `<div class="chart"><div class="chart-head"><span>Last 7 days · ${esc(i.series_unit || i.unit)} · band = your usual in-flight range</span>${cite(SRC.demo)}</div>${line(i.series, i.band)}
        <div style="font-size:13px;margin-top:4px">Now: <b>${esc(i.value)} ${esc(i.unit)}</b> · usual ${esc(i.usual)}</div></div>` : ""}
    <div class="two">
      <div><div class="label">Next step</div><div>${esc(next)}</div></div>
      <div><div class="label">Who to tell</div><div>${esc(who)}</div></div>
    </div>
    <div class="two">
      <div><div class="label">Why it matters in space</div><div>${esc(i.why)} ${cite(src)}</div><small>NASA: ${esc(i.risk)}</small></div>
      <div><div class="label">How it is measured</div><div>${esc(i.measured)}</div>${i.private ? `<small>Private: the crew doctor sees that you checked in, never your entries.</small>` : ""}</div>
    </div></section>`;
}

function checkins(S) {
  const defs = S.checkin_defs, done = defs.filter((d) => S.checkins[d.id]).length;
  return `<section class="panel stack" style="gap:8px">
    <div class="row" style="justify-content:space-between"><h3>Today's check-ins</h3><small>${done} of ${defs.length} done</small></div>
    ${defs.map((d) => `<button type="button" class="check ${S.checkins[d.id] ? "done" : ""}" data-checkin="${d.id}" aria-pressed="${!!S.checkins[d.id]}">
      <span class="box">${S.checkins[d.id] ? ICON.ok : ""}</span><span><b>${esc(d.label)}</b><small>${S.checkins[d.id] ? "Done today" : esc(d.sub)}</small></span></button>`).join("")}
    <small>${done === defs.length ? S.streak + 1 : S.streak}-day check-in streak · credit for completing check-ins, never for results</small></section>`;
}

function accessLog(S) {
  const log = (S.access_log.lena || []).slice(0, 5);
  return `<section class="panel stack" style="gap:6px"><h3>Who has seen my data</h3>
    ${log.length ? `<table><tr><th>When</th><th>Who</th><th>What</th></tr>${log.map((l) => `<tr><td>${clock(l.at)}</td><td>${esc(l.who)}</td><td>${esc(l.data)}</td></tr>`).join("")}</table>` : "<small>Nobody has viewed your data today.</small>"}
    <small>Your journal is never shown to anyone.</small></section>`;
}

function radDetail() {
  const r = ui.rad;
  if (!r) return `<section class="panel">Loading radiation data…</section>`;
  const d = r.dose, ra = radAlert();
  const rateSrc = { label: { mars: "Curiosity RAD", moon: "Chang'e 4 LND", station: "NASA ISS" }[r.mission.mode], title: "Expected daily dose by mission phase",
    body: "Projection uses published dose rates per phase: ~1.84 mSv/day in deep space and ~0.64 mSv/day on the Mars surface (Curiosity RAD), ~1.37 mSv/day on the Moon surface (Chang'e 4), ~0.5 mSv/day on the ISS. Prior career dose and mission day are demo values.",
    links: { mars: [L.zeitlin, L.hassler], moon: [L.zhang, L.zeitlin], station: [] }[r.mission.mode].concat(r.source === "real" ? [L.radlab] : []) };
  const recentSrc = r.recent.source === "real"
    ? { label: "NASA RadLab", title: `${r.mission.instrument}: measured dose rate`, body: `Daily mean dose rate, ${r.recent.dates[0]} to ${r.recent.dates[r.recent.dates.length - 1]}, from NASA OSDR RadLab.`, links: [L.radlab] }
    : { label: "Simulated", simulated: true, title: "Simulated dose rate", body: "Simulated around the published rate for this location. Load measured data with python -m radiation.radlab fetch-events.", links: [L.radlab] };
  const limitSrc = { label: "NASA-STD-3001", title: "NASA career dose limit", body: "NASA's career effective dose limit for all astronauts is 600 mSv (NASA-STD-3001, Volume 1).", links: [] };
  return `<section class="panel stack">
    <div class="row"><h2>Radiation exposure</h2>${ra ? TAG.advisory : ""}</div>
    <div style="font-size:16px">${esc(ra || r.headline)}</div>
    <div class="stats">
      <div class="stat"><small>Career dose so far</small><b>${d.soFar.toFixed(0)} mSv</b></div>
      <div class="stat"><small>Projected at mission end</small><b>${d.projectedTotal.toFixed(0)} mSv</b></div>
      <div class="stat"><small>Career limit ${cite(limitSrc)}</small><b>${d.limit.toFixed(0)} mSv</b></div>
      <div class="stat"><small>Limit reached</small><b>${d.limitDay ? `Day ${d.limitDay}` : "Not reached"}</b></div>
    </div>
    <div class="chart"><div class="chart-head"><span>Career dose by mission day · solid = so far, dashed = projected, band = uncertainty</span>${cite(rateSrc)}</div>${cumulativeChart(r)}</div>
    <div class="chart"><div class="chart-head"><span>Daily dose rate, last ${r.recent.values.length} days (mSv/day) · ${esc(r.mission.instrument)}</span>${cite(recentSrc)}</div>${recentChart(r)}</div>
    ${r.storm ? `<div class="chart"><b>Solar particle event ${esc(r.storm.date || "(demo)")}:</b> ${r.storm.doseSource === "real"
      ? (r.storm.detected ? `extra dose measured here: <b>${r.storm.extraDose} mSv</b> (days above normal variation only, solar protons weighted 1.5).`
        : "no increase above normal day-to-day variation was measured at this location. Storms seen near Earth often miss Mars.")
      : `extra dose ${r.storm.extraDose} mSv from a simulated profile (no measured data for this date).`}</div>` : ""}
    ${r.breakdown ? `<div class="chart"><div class="chart-head"><span>Today's dose by particle type (station)</span>${cite({ label: "CSA, 2026", title: "Neutron share of ISS radiation", body: "Neutrons make up about 30% of ISS radiation and need their own detectors, such as CSA's CANS.", links: [L.csa] })}</div>${splitBar(r.breakdown.neutrons_share)}</div>` : ""}
    <div class="two">
      <div><div class="label">What to do</div><ul style="margin:4px 0 0;padding-left:18px">${r.actions.map((a) => `<li>${esc(a.text)}</li>`).join("")}</ul></div>
      <div><div class="label">Why it matters in space</div><div>Space radiation passes through the hull and the body, raising lifetime cancer risk. Solar storms can add a large dose within hours.</div><small>NASA: ${esc(r.nasaRisk)}</small></div>
    </div></section>`;
}

// ===================== CREW DOCTOR VIEW =====================
const LABS = { // Inspiration4 C001, NASA OSDR OSD-569 and OSD-575 (real values, used as an example history)
  times: ["L-92", "L-44", "L-3", "R+1", "R+45", "R+82", "R+194"],
  rows: [
    { name: "Glucose (mg/dL)", range: "65–99", v: [83, 80, 69, 90, 84, 91, 87], lo: 65, hi: 99 },
    { name: "Potassium (mmol/L)", range: "3.5–5.3", v: [4.6, 4.2, 3.9, 4.4, 4.0, 4.3, 4.3], lo: 3.5, hi: 5.3 },
    { name: "Creatinine (mg/dL)", range: "0.6–1.35", v: [1.24, 1.10, 1.37, 1.12, 1.11, 1.25, 1.29], lo: 0.6, hi: 1.35 },
    { name: "Haemoglobin (g/dL)", range: "13.2–17.1", v: [14.1, 14.9, 14.7, 14.7, 14.3, 15.7, 14.1], lo: 13.2, hi: 17.1 },
    { name: "White cells (×1000/µL)", range: "3.8–10.8", v: [5.4, 5.5, 7.0, 5.0, 4.9, 4.9, 4.9], lo: 3.8, hi: 10.8 },
  ],
};

function personStatus(S, pid) {
  const e = S.emergency;
  if (e && e.kind === "spe") {
    const st = e.roster[pid], d = stormDose();
    const dose = d && (d.doseSource !== "real" || d.detected) ? ` · storm dose ${d.extraDose} mSv` : "";
    if (st === "in_shelter") return { rank: 2, cls: "shelter", reason: `In the storm shelter${dose}` };
    return { rank: 4, cls: "emergency", reason: `${SHELTER_WORD[st] || st}${dose}` };
  }
  if (e && e.patient === pid) return { rank: 5, cls: "emergency", reason: `${e.what}: emergency in progress` };
  if (pid === "lena" && S.heart) {
    const h = S.heart, m = h.model;
    if (["caution", "countdown", "doctor_woken", "confirmed"].includes(h.stage)) return { rank: 3, cls: "caution", reason: m.level === "criterion_met" ? "Possible heart problem: 12-lead ECG meets ST-elevation criterion" : "Possible heart problem: chest strap ECG changed from usual (screening)" };
    if (h.stage === "monitored") return { rank: 2, cls: "advisory", reason: "Monitored: heart screening alert" };
  }
  if (S.doctor_woken && S.doctor_woken.by === pid) return { rank: 3, cls: "caution", reason: `${NAMES[pid]} asked for you: ${S.doctor_woken.why}` };
  const sm = S.summary[pid];
  if (sm && sm.state === "missing") return { rank: 1, cls: "missing", reason: sm.reason };
  return { rank: 0, cls: "ok", reason: sm ? sm.reason : "All indicators within usual range" };
}
function statusChip(st) {
  if (st.cls === "emergency") return TAG.emergency;
  if (st.cls === "shelter") return `<span class="tag neutral">${ICON.ok}In shelter</span>`;
  if (st.cls === "caution") return TAG.caution;
  if (st.cls === "advisory") return TAG.advisory;
  if (st.cls === "missing") return `<span class="tag neutral">${ICON.dash}No data</span>`;
  return `<span class="tag neutral">${ICON.ok}Normal</span>`;
}

function renderDoctor(S) {
  const crew = S.crew.map((c) => ({ ...c, st: personStatus(S, c.id) })).sort((a, b) => b.st.rank - a.st.rank);
  const strip = `<div class="strip">${crew.map((c) => `<button type="button" class="person" data-person="${c.id}" aria-pressed="${ui.selPerson === c.id}">
      <span class="row" style="justify-content:space-between"><span class="nm">${esc(c.name)}</span>${statusChip(c.st)}</span>
      <span class="why">${esc(c.st.reason)}</span><small>${esc(c.role)}</small></button>`).join("")}</div>`;
  const open = S.advisories.filter((a) => !a.dismissed);
  const woken = S.doctor_woken ? `<div class="alert caution"><div class="row">${TAG.caution}<b>${esc(NAMES[S.doctor_woken.by] || S.doctor_woken.by)} needs you</b><small>${clock(S.doctor_woken.at)}</small></div><div>${esc(S.doctor_woken.why)}</div></div>` : "";
  const qc = S.heart && S.heart.quick_check ? { yes: "Yes", no: "No", unsure: "Not sure" }[S.heart.quick_check] : "not answered yet";
  const review = `<section class="panel stack"><div class="row" style="justify-content:space-between"><h3>Review list</h3><small>Advisories arrive here quietly, with no sound</small></div>
    ${open.length ? open.map((a) => `<div class="adv"><div class="row">${TAG.advisory}<b>${esc(NAMES[a.person])}</b><small>${clock(a.at)}</small></div>
      <div>${esc(a.text)}</div><small>${esc(NAMES[a.person])} has also been told. Quick check answer: ${esc(qc)}.</small>
      <div class="row"><button type="button" class="btn small" data-person="${a.person}">Open evidence</button><small>Dismiss with a reason:</small>
        <div class="chips">${["Explained by exercise", "Sensor artefact", "Known for this person"].map((r) => `<button type="button" data-dismiss="${a.id}" data-reason="${esc(r)}">${esc(r)}</button>`).join("")}</div></div></div>`).join("")
      : "<small>Nothing to review.</small>"}
    ${S.closed.filter((c) => c.outcome === "not_known").map((c) => `<div class="adv"><div class="row">${TAG.advisory}<b>Outcome not yet known: ${esc(c.what)}</b><small>ended ${clock(c.ended_at)}</small></div>
      <div class="chips">${[["confirmed", "Confirmed event"], ["false_alarm", "False alarm"]].map(([k, t]) => `<button type="button" data-outcome="${c.id}" data-value="${k}">${t}</button>`).join("")}</div></div>`).join("")}
  </section>`;
  const decisions = S.decisions.length ? `<section class="panel stack" style="gap:6px"><h3>Decision record</h3><table><tr><th>When</th><th>Who</th><th>Decision</th><th>Reason</th></tr>
    ${S.decisions.slice(0, 6).map((d) => `<tr><td>${clock(d.at)}</td><td>${esc(d.who)}</td><td>${esc(d.decision)}</td><td>${esc(d.reason)}</td></tr>`).join("")}</table></section>` : "";
  const showEvidence = ui.selPerson === "lena" && S.heart && !["cleared", "closed"].includes(S.heart.stage);
  $("main").innerHTML = `${strip}<div class="grid2"><div class="stack">${woken}${review}${decisions}</div>
    <div class="stack">${showEvidence ? evidence(S) : personRecord(S, ui.selPerson)}</div></div>`;
}

function evidence(S) {
  const h = S.heart, m = h.model;
  const MET = { true: `${ICON.ok} Met`, false: "Not met", null: "Not yet known" };
  const BASIS = { rule: SRC.rule, norsk: SRC.norsk, symptom: SRC.symptom, thygesen: SRC.thygesen };
  const decide = h.stage === "countdown"
    ? `<div class="alert warning"><div class="row"><span class="countdown" data-countdown="${h.countdown_end}">…</span><span>until the crew-wide emergency is declared<br><small>Started by ${esc(h.countdown_by)}</small></span></div>
       <div class="row"><button type="button" class="btn" data-act="send_now">Send now</button><button type="button" class="btn secondary" data-act="stop_countdown">Stop countdown</button></div></div>`
    : `<div class="stack" style="gap:8px"><div class="label">Decide (recorded with your name, time and reason)</div>
       <input type="text" id="reason" placeholder="Reason (one line)" value="${esc(ui.drafts.reason || "")}">
       <div class="row">${[["escalate", "Escalate to crew-wide emergency"], ["monitor", "Monitor"], ["confirm", "Confirm credible"], ["override", "Override (not credible)"]].map(([k, t]) => `<button type="button" class="btn ${k === "escalate" ? "" : "secondary"} small" data-decide="${k}">${t}</button>`).join("")}</div>
       <small>Escalate starts a ${S.countdown_s}-second countdown you can stop. Nothing beyond alerting happens until a person confirms.</small></div>`;
  const t = S.track;
  return `<section class="panel stack">
    <div class="row"><h2>Lena · possible heart problem</h2>${h.stage === "monitored" ? TAG.advisory : TAG.caution}</div>
    <div style="font-size:16px">${esc(m.summary)}</div>
    <div class="two">
      <div><div class="label">Stage</div><div>${m.level === "criterion_met" ? "12-lead criterion met" : "Screening signal (chest strap)"}</div></div>
      <div><div class="label">Issued</div><div>${clock(h.issued_at)}${h.reading_at ? ` · 12-lead Heart reading at ${clock(h.reading_at)}` : ""}</div></div>
    </div>
    <table><tr><th>Criterion</th><th>Lena now</th><th>Status</th><th>Basis</th></tr>
      ${m.criteria.map((c) => `<tr><td>${esc(c.label)}</td><td>${esc(c.value)}</td><td>${MET[c.met]}</td><td>${cite(BASIS[c.basis] || SRC.demo)}</td></tr>`).join("")}</table>
    <div><div class="label">Data covered</div><div>${esc(m.coverage.text)}</div></div>
    <div><div class="label">Limits</div><div>${esc(m.limits)}</div></div>
    ${h.heart_reading ? "" : `<div><button type="button" class="btn small" data-act="heart_reading">Record Heart reading (12-lead ECG)</button></div>`}
    <div><div class="label">Heart alerts this mission</div><div>${t.alerts} issued · ${t.confirmed} confirmed · ${t.not_confirmed} not confirmed · ${Math.max(0, t.alerts - t.confirmed - t.not_confirmed)} outcome not yet recorded</div>
      <small>Counted from this mission's own alerts, not invented figures.</small></div>
    <small>${esc(m.label)}. Values shaped by published in-flight data where cited.</small>
    ${decide}
  </section>`;
}

function personRecord(S, pid) {
  const inds = S.indicators[pid] || [];
  return `<section class="panel stack"><div class="row"><h2>${esc(NAMES[pid])}</h2>${statusChip(personStatus(S, pid))}</div>
    <table><tr><th>Indicator</th><th>Now</th><th>Usual</th></tr>${inds.filter((i) => !i.private).map((i) => `<tr><td>${esc(i.name)}</td>
      <td>${i.state === "missing" ? esc(MISSING[i.missing] || "No data") : `${esc(i.value)} ${esc(i.unit)}`}${i.state === "flag" ? " " + TAG.caution : ""}</td><td>${esc(i.usual)}</td></tr>`).join("")}</table>
    ${ui.rad ? `<table><tr><th>Radiation</th><th>Now</th><th>Limit</th></tr><tr><td>Career dose (habitat estimate)${speOn(S) && stormDose() ? `<br><small>includes ${stormDose().extraDose} mSv from the current storm</small>` : ""}</td>
      <td>${ui.rad.dose.soFar.toFixed(0)} mSv${speOn(S) ? " " + TAG.emergency : ""}</td><td>600 mSv · projected ${ui.rad.dose.projectedTotal.toFixed(0)} at mission end</td></tr></table>` : ""}
    <small>Wellbeing: check-in completed today. Scores and trends only; journal entries are never available.</small>
    ${pid === "lena" ? labs() : ""}</section>`;
}

function labs() {
  return `<div class="stack" style="gap:6px"><div class="row" style="justify-content:space-between"><div class="label">Example lab history (real astronaut data)</div>${cite(SRC.labs)}</div>
    <div style="overflow-x:auto"><table><tr><th>Test (lab range)</th>${LABS.times.map((t) => `<th>${t}</th>`).join("")}</tr>
    ${LABS.rows.map((r) => `<tr><td>${esc(r.name)}<br><small>${esc(r.range)}</small></td>${r.v.map((v) => `<td>${v}${v < r.lo || v > r.hi ? "<br><small>outside range</small>" : ""}</td>`).join("")}</tr>`).join("")}</table></div>
    <small>L = days before launch, R = days after return. Out-of-range values occur before flight too, so one result alone should not alarm.</small></div>`;
}

// ===================== EMERGENCY VIEW =====================
const ACTION = {
  heart: {
    patient: "Stop what you are doing. Sit or lie down. Help is coming.",
    sam: "Go to Lena in the Laboratory module. You lead the response.",
    ravi: "Bring the medical kit and defibrillator to the Laboratory module.",
    maya: "Go to the Laboratory module and record the response.",
  },
  spe: "Go to the storm shelter now.",
};
const ROSTER_WORD = { alerted: "Alerted", acknowledged: "Acknowledged", on_the_way: "On the way", on_scene: "On scene", patient: "Patient", in_shelter: "In shelter" };

function renderEmergency(S) {
  const e = S.emergency, me = ui.me, isPatient = e.patient === me;
  const myAction = e.kind === "spe" ? ACTION.spe : (isPatient ? ACTION.heart.patient : ACTION.heart[me]);
  const mySt = e.roster[me];
  const next = e.kind === "spe"
    ? ({ alerted: ["acknowledged", "I'm responding"], acknowledged: ["in_shelter", "I'm in the shelter"] }[mySt] || null)
    : ({ alerted: ["acknowledged", "I'm responding"], acknowledged: ["on_the_way", "On the way"], on_the_way: ["on_scene", "On scene"] }[mySt] || null);
  const current = e.checklist.findIndex((s) => !s.result);
  const canEnd = (e.kind === "heart" && me === "sam") || (e.kind === "spe" && (me === "sam" || me === "maya"));
  const responders = Object.entries(e.roster).filter(([, s]) => s !== "patient");

  const head = `<div class="emg-head">${ICON.warning}<span class="tag" style="background:var(--red-ink);color:var(--red)">Emergency</span>
    <span class="what">${esc(e.what)} · ${esc(e.patient ? NAMES[e.patient] : "Whole crew")} · ${esc(e.where)}</span>
    <span>Declared ${clock(e.declared_at)} by ${esc(e.declared_by)}</span></div>`;
  const actionPanel = `<section class="panel stack">
    <div class="label">${isPatient ? "Your instruction" : "Your action"}</div>
    <div class="my-action">${esc(myAction)}</div>
    ${next ? `<div><button type="button" class="btn big" data-respond="${next[0]}">${esc(next[1])}</button></div>` : mySt && !isPatient ? `<div><span class="st">${esc(ROSTER_WORD[mySt])}</span></div>` : ""}
    ${isPatient ? `<div><div class="label">Who is coming</div>${responders.map(([p, s]) => `<div class="row"><b>${esc(NAMES[p])}</b><span class="st ${s}">${esc(ROSTER_WORD[s])}</span></div>`).join("")}</div>
      <div><div class="label">What the crew can see about you</div><div>Emergency data only: heart indicators, the model result and your location. Not your mood check-ins or journal.</div></div>` : ""}
    ${e.kind === "heart" ? `<small>Emergency data only is shared. Access closes when the emergency ends, and it is logged.</small>` : ""}</section>`;
  const checklist = isPatient ? "" : `<section class="panel stack"><div class="row" style="justify-content:space-between"><h3>First actions</h3><small>Recorder: Maya, or whoever is free</small></div>
    ${e.checklist.map((s, i) => `<div class="step ${i === current ? "current" : ""} ${s.result ? "done" : ""}"><span class="n">${s.result ? ICON.ok : i + 1}</span>
      <div class="stack" style="gap:6px"><div><b>${esc(s.step)}</b> ${s.mock ? `<span class="mock">Mock content</span>` : ""}<br><small>${esc(s.role)}${i === current ? " · current step" : ""}</small></div>
      ${s.result ? `<small>Result: ${esc(s.result)} · ${esc(s.by)} at ${clock(s.at)}</small>`
        : i === current ? `<div class="row"><input type="text" id="step-${i}" placeholder="${esc(s.result_hint || "Result")}" value="${esc(ui.drafts[`step-${i}`] || "")}" style="flex:1;min-width:160px">
          <button type="button" class="btn small" data-step="${i}">Record result</button></div>` : ""}</div></div>`).join("")}
    ${e.kind === "heart" ? `<details><summary>Detailed treatment (mock content)</summary><div class="stack" style="gap:4px;margin-top:8px">${S.treatment_mock.map((t) => `<div>${esc(t)}</div>`).join("")}</div></details>` : ""}
  </section>`;
  const roster = `<section class="panel stack"><h3>Crew</h3><table class="roster"><tr><th>Name</th><th>Role</th><th>Status</th></tr>
    ${S.crew.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.role)}</td><td><span class="st ${e.roster[c.id]}">${esc(ROSTER_WORD[e.roster[c.id]] || e.roster[c.id])}</span></td></tr>`).join("")}</table></section>`;
  const rep = e.report;
  const report = `<section class="panel stack" style="gap:6px"><h3>Report to Earth</h3>
    ${rep.status === "queued" ? `<div><b>Queued</b> at ${clock(rep.queued_at)}. It sends automatically when the link is up.</div>`
      : `<div><b>Sent</b> at ${clock(rep.sent_at)}, without anyone composing it.</div><div>Earliest possible reply: <b>${clock(rep.earliest_reply_at)}</b> (<span data-until="${rep.earliest_reply_at}">…</span>)</div>`}
    <div style="font-size:16px;font-weight:700">Continue without waiting.</div></section>`;
  const end = canEnd ? `<section class="panel stack"><h3>End the emergency</h3><small>Only the ${e.kind === "heart" ? "crew doctor" : "crew doctor or commander"} can end it, with a reason.</small>
    <div><button type="button" class="btn secondary" data-act="open_stand_down">End emergency…</button></div></section>` : "";
  $("main").innerHTML = `${head}<div class="grid2"><div class="stack">${actionPanel}${checklist}</div><div class="stack">${roster}${report}${end}</div></div>`;
}

function openStandDown() {
  const e = ui.S.emergency, who = e.patient ? NAMES[e.patient] : "the whole crew";
  $("modal").innerHTML = `<div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="sd-title">
    <h3 id="sd-title">End the emergency for ${esc(who)}?</h3>
    <div>${esc(e.what)} · ${esc(e.where)} · declared ${clock(e.declared_at)}.</div>
    <div>Ending returns every tablet to its normal view${e.patient ? ` and closes the crew's access to ${esc(who)}'s data` : ""}.</div>
    <label>Reason <input type="text" id="sd-reason" placeholder="For example: patient stable, monitoring continues"></label>
    ${e.kind === "heart" ? `<label>Outcome <select class="f" id="sd-outcome"><option value="not_known">Not yet known (set later)</option><option value="confirmed">Confirmed event</option><option value="false_alarm">False alarm</option></select></label>` : ""}
    <div class="row"><button type="button" class="btn" id="sd-confirm" disabled>End emergency for ${esc(who)}</button><button type="button" class="btn secondary" id="sd-cancel">Keep it active</button></div></div>`;
  $("modal").hidden = false;
  $("sd-reason").focus();
}

// ---------- charts (plain SVG, neutral) ----------
function spark(vals, band) {
  const W = 120, H = 34, p = 3;
  let lo = Math.min(...vals, band ? band[0] : Infinity), hi = Math.max(...vals, band ? band[1] : -Infinity);
  if (hi === lo) hi = lo + 1;
  const x = (i) => p + i * ((W - 2 * p) / (vals.length - 1)), y = (v) => p + (H - 2 * p) * (1 - (v - lo) / (hi - lo));
  return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">${band ? `<rect x="0" y="${y(band[1])}" width="${W}" height="${Math.max(1, y(band[0]) - y(band[1]))}" fill="var(--band)"/>` : ""}
    <polyline points="${vals.map((v, i) => `${x(i)},${y(v)}`).join(" ")}" fill="none" stroke="#e8eef7" stroke-width="1.8"/></svg>`;
}
function line(vals, band) {
  const W = 600, H = 130, p = 12;
  let lo = Math.min(...vals, band[0]), hi = Math.max(...vals, band[1]);
  if (hi === lo) hi = lo + 1;
  const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
  const x = (i) => p + i * ((W - 2 * p) / (vals.length - 1)), y = (v) => p + (H - 2 * p) * (1 - (v - lo) / (hi - lo));
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="7 day trend against usual range">
    <rect x="0" y="${y(band[1])}" width="${W}" height="${Math.max(2, y(band[0]) - y(band[1]))}" fill="var(--band)"/>
    <polyline points="${vals.map((v, i) => `${x(i)},${y(v)}`).join(" ")}" fill="none" stroke="#e8eef7" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="${x(vals.length - 1)}" cy="${y(vals[vals.length - 1])}" r="5" fill="#e8eef7"/></svg>`;
}
function cumulativeChart(r) {
  const W = 680, H = 250, Lm = 52, R = 14, T = 22, B = 38;
  const total = r.mission.totalDays, lim = r.dose.limit;
  const maxY = Math.max(lim * 1.15, ...r.band.high, r.dose.projectedTotal) * 1.03;
  const x = (d) => Lm + (d - 1) / Math.max(1, total - 1) * (W - Lm - R), y = (v) => T + (H - T - B) * (1 - v / maxY);
  const last = r.cumulative[r.cumulative.length - 1];
  const so = r.cumulative.map((p) => `${x(p.day)},${y(p.value)}`).join(" ");
  const pr = [last, ...r.projection].map((p) => `${x(p.day)},${y(p.value)}`).join(" ");
  const band = [`${x(last.day)},${y(last.value)}`, ...r.projection.map((p, i) => `${x(p.day)},${y(r.band.high[i])}`), ...r.projection.map((p, i) => `${x(p.day)},${y(r.band.low[i])}`).reverse()].join(" ");
  let g = "";
  for (let v = 0; v <= maxY; v += 200) g += `<line x1="${Lm}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#1f2a40"/><text x="${Lm - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#9aa8bf">${v}</text>`;
  const step = total > 400 ? 100 : total > 150 ? 30 : 7;
  for (let d = step; d <= total; d += step) g += `<text x="${x(d)}" y="${H - B + 16}" text-anchor="middle" font-size="11" fill="#9aa8bf">${d}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Career dose projection">${g}
    <polygon points="${band}" fill="rgba(201,214,234,.14)"/>
    <line x1="${Lm}" x2="${W - R}" y1="${y(lim)}" y2="${y(lim)}" stroke="#e8eef7" stroke-width="1.5" stroke-dasharray="6 5"/>
    <text x="${Lm + 8}" y="${y(lim) - 6}" font-size="12" font-weight="600" fill="#e8eef7">Career limit ${lim} mSv</text>
    <line x1="${x(last.day)}" x2="${x(last.day)}" y1="${T}" y2="${H - B}" stroke="#9aa8bf" stroke-dasharray="2 4"/>
    <text x="${x(last.day) + 6}" y="${T + 10}" font-size="12" fill="#e8eef7">Today · day ${last.day}</text>
    <polyline points="${so}" fill="none" stroke="#e8eef7" stroke-width="2.5"/>
    <polyline points="${pr}" fill="none" stroke="#c5d0e2" stroke-width="2.5" stroke-dasharray="7 5"/>
    ${r.dose.limitDay ? `<circle cx="${x(r.dose.limitDay)}" cy="${y(lim)}" r="6" fill="#e8eef7" stroke="#0c1220" stroke-width="2"/><text x="${x(r.dose.limitDay)}" y="${y(lim) + 22}" text-anchor="middle" font-size="12" font-weight="700" fill="#e8eef7">Limit reached · day ${r.dose.limitDay}</text>` : ""}
    <text x="${(Lm + W - R) / 2}" y="${H - 2}" text-anchor="middle" font-size="11" fill="#9aa8bf">mission day</text></svg>`;
}
function recentChart(r) {
  const vals = r.recent.values, W = 680, H = 140, Lm = 44, B = 22, T = 8;
  const med = [...vals].sort((a, b) => a - b)[Math.floor(vals.length / 2)], maxY = Math.max(...vals) * 1.1 || 1, bw = (W - Lm - 6) / vals.length;
  const y = (v) => T + (H - T - B) * (1 - v / maxY);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily dose rate">
    <line x1="${Lm}" x2="${W}" y1="${y(med)}" y2="${y(med)}" stroke="#9aa8bf" stroke-dasharray="3 4"/><text x="${Lm - 6}" y="${y(med) + 4}" text-anchor="end" font-size="11" fill="#9aa8bf">${med.toFixed(2)}</text>
    ${vals.map((v, i) => `<rect x="${Lm + i * bw + 1}" y="${y(v)}" width="${bw - 2}" height="${H - B - y(v)}" rx="2" fill="${v > med * 1.5 ? "#e8eef7" : "#56657f"}"><title>${v.toFixed(2)} mSv/day</title></rect>`).join("")}
    <text x="${Lm}" y="${H - 4}" font-size="11" fill="#9aa8bf">${esc(r.recent.dates ? r.recent.dates[0] : `${vals.length} days ago`)}</text>
    <text x="${W}" y="${H - 4}" text-anchor="end" font-size="11" fill="#9aa8bf">${esc(r.recent.dates ? r.recent.dates[r.recent.dates.length - 1] : "today")}</text></svg>`;
}
function splitBar(share) {
  const n = Math.round(share * 100);
  return `<svg viewBox="0 0 600 34" role="img" aria-label="Neutrons ${n} percent"><rect x="0" y="0" width="${600 * (1 - share)}" height="34" rx="6" fill="#56657f"/><rect x="${600 * (1 - share)}" y="0" width="${600 * share}" height="34" rx="6" fill="#c5d0e2"/>
    <text x="10" y="22" font-size="13" font-weight="700" fill="#e8eef7">Charged particles ${100 - n}%</text><text x="590" y="22" text-anchor="end" font-size="13" font-weight="700" fill="#0c1220">Neutrons ${n}%</text></svg>`;
}

// ---------- live countdowns ----------
setInterval(() => {
  const now = serverNow();
  document.querySelectorAll("[data-countdown]").forEach((el) => { el.textContent = `${Math.max(0, Math.ceil(+el.dataset.countdown - now))} s`; });
  document.querySelectorAll("[data-until]").forEach((el) => { const s = +el.dataset.until - now; el.textContent = s > 0 ? `in ${mins(s)}` : "a reply could arrive now"; });
}, 250);

// ---------- events ----------
document.addEventListener("input", (e) => {
  const id = e.target.id || "";
  if (id === "reason" || id.startsWith("step-")) ui.drafts[id] = e.target.value;
  if (id === "sd-reason") $("sd-confirm").disabled = !e.target.value.trim();
});
document.addEventListener("focusout", () => setTimeout(() => { if (!typing()) render(); }, 0));
document.addEventListener("click", (e) => {
  const cb = e.target.closest(".cite");
  if (cb) { e.stopPropagation(); cb.getAttribute("aria-expanded") === "true" ? closeCite() : openCite(cb); return; }
  if (!e.target.closest("#cite-pop")) closeCite();
  const t = e.target.closest("button");
  if (!t) return;
  const d = t.dataset;
  if (t.id === "demo-toggle") { const open = $("demo").hidden; $("demo").hidden = !open; t.setAttribute("aria-expanded", String(open)); if (open) loadEvents(); }
  else if (t.id === "get-doctor") post("get_doctor");
  else if (t.id === "sd-cancel") $("modal").hidden = true;
  else if (t.id === "sd-confirm") {
    const reason = $("sd-reason").value.trim(), outcome = $("sd-outcome") ? $("sd-outcome").value : "ended";
    $("modal").hidden = true; post("stand_down", { reason, outcome });
  }
  else if (d.act === "open_stand_down") openStandDown();
  else if (d.act) post(d.act);
  else if (d.mode) post("mode", { mode: d.mode });
  else if (d.tab) { ui.tab = d.tab; render(); }
  else if (d.ind) { ui.selInd = d.ind; render(); }
  else if (d.qc) post("quick_check", { answer: d.qc });
  else if (d.checkin) post("checkin", { id: d.checkin });
  else if (d.person) { ui.selPerson = d.person; if (ui.me === "sam") ui.tab = "doctor"; render(); }
  else if (d.dismiss) post("dismiss_advisory", { id: +d.dismiss, reason: d.reason });
  else if (d.outcome) post("set_outcome", { id: +d.outcome, outcome: d.value });
  else if (d.decide) { const reason = ui.drafts.reason || ""; ui.drafts.reason = ""; post("decide", { decision: d.decide, reason }); }
  else if (d.respond) post("respond", { status: d.respond });
  else if (d.step) { const i = +d.step, result = ui.drafts[`step-${i}`] || "Done"; ui.drafts[`step-${i}`] = ""; post("record_step", { index: i, result }); }
  else if (d.spe) post("spe_start", { event: d.spe });
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeCite(); $("modal").hidden = true; } });
$("as-select").addEventListener("change", (e) => {
  ui.me = e.target.value; ui.tab = ui.me === "sam" ? "doctor" : "health"; ui.selInd = null;
  history.replaceState(null, "", `?as=${ui.me}`); render();
});

if (ui.me === "sam" && !params.get("view")) ui.tab = "doctor";
poll().then(loadRad);
setInterval(poll, 1000);
