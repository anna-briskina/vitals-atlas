// Crew Health front end, in the design team's look (health-caution.html, 2026-11-15).
// One shared server state; every tablet polls it. Tabs: Emergency (while one is active), Health, Alerts, Crew,
// and Crew doctor on Sam's tablet. Health cards come from the design's rules (static/health-cards.js).
// Alert classes: red emergency, yellow caution, blue advisory; always colour + icon + word.

const params = new URLSearchParams(location.search);
const ui = {
  me: params.get("as") || "lena",
  tab: params.get("view") || null,
  selPerson: "lena", rad: null, events: [], S: null, hash: "", offset: 0, drafts: {},
  panelOpen: false, panelKey: "", autoOpened: {}, seenSent: {},
};

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const IC = (n, f) => ICONS.svg(n, f);
const NUM = (n) => `<span class="num">${n}</span>`;
const NAMES = { lena: "Lena", sam: "Sam", ravi: "Ravi", maya: "Maya" };
const serverNow = () => Date.now() / 1000 + ui.offset;
// Times in NASA's form, "GMT 319/03:11:00" (day of the year / time), spelled out for screen readers (design file).
function gmtSec(t) {
  const d = new Date(t * 1000), y = d.getUTCFullYear();
  const doy = Math.floor((Date.UTC(y, d.getUTCMonth(), d.getUTCDate()) - Date.UTC(y, 0, 0)) / 86400000);
  return doy * 86400 + d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds();
}
const T = (t) => HC.timeHTML(gmtSec(t));
const pl = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
function leftWords(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const m = Math.floor(sec / 60), r = sec % 60, w = (k, x) => `${NUM(k)} ${x}${k === 1 ? "" : "s"}`;
  if (m && r) return `${w(m, "minute")} ${w(r, "second")}`;
  return m ? w(m, "minute") : w(r, "second");
}
function untilWords(sec) {
  if (sec <= 0) return "a reply could arrive now";
  return sec < 90 ? `in ${pl(Math.round(sec), "second")}` : `in ${pl(Math.round(sec / 60), "minute")}`;
}

// ---------- citations ----------
const CITES = new Map();
let citeSeq = 0;
function cite(c) {
  const id = `c${++citeSeq}`;
  CITES.set(id, c);
  return `<button type="button" class="cite${c.simulated ? " sim" : ""}" data-cite="${id}" aria-haspopup="dialog" aria-expanded="false">${IC("info")}<span class="sr">Source: </span>${esc(c.label)}</button>`;
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
  bio: { t: "CSA: Bio-Monitor", u: "https://www.asc-csa.gc.ca/eng/sciences/bio-monitor.asp" },
  crew13: { t: "CSA: Crew-13 science activities (Joshua Kutryk)", u: "https://www.asc-csa.gc.ca/eng/missions/crew-13/science-activities.asp" },
  csa: { t: "CSA: Monitoring Radiation for Astronaut Health (2026)", u: "https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp" },
};
const SRC = {
  research_cardio: { label: "NASA cardio risk", title: "Cardiovascular adaptations", body: "NASA names rhythm disturbances, clots and fainting at landing among the cardiovascular hazards of spaceflight.", links: [L.cardio] },
  norsk: { label: "Norsk 2015", title: "Blood pressure and heart rate in flight", body: "24-hour average blood pressure fell 8 to 10 mmHg on the ISS; resting heart rate was unchanged.", links: [L.norsk] },
  stahn: { label: "Stahn 2017", title: "Core temperature in flight", body: "Resting core temperature rose about 1 °C over about 2.5 months on six-month ISS missions.", links: [L.stahn] },
  barger: { label: "Barger 2014", title: "Sleep in flight", body: "Astronauts slept about 6 hours on the ISS against 8.5 scheduled.", links: [L.barger] },
  trim: { label: "Trim 2023", title: "Blood sugar with inactivity", body: "In a 60-day bed rest study, daily blood sugar rose 6% and fasting insulin 40%.", links: [L.trim] },
  behav: { label: "NASA behavioural risk", title: "Behavioural conditions", body: "Isolation and confinement affect mood, sleep and decisions. NASA's risk page lists no monitoring tool.", links: [L.behav] },
  bio: { label: "CSA Bio-Monitor", title: "Where the readings come from", body: "Every crew member has a tablet. Continuous readings come from a wearable paired with it: a smartwatch, or the CSA's Bio-Monitor, a smart shirt and headband (Carré Technologies, Montreal) that measure heart rate and electrical heart activity, blood pressure, breathing rate and volume, skin temperature, blood oxygen and movement. It can be worn during sleep and exercise and pairs with a tablet app. First used on the ISS by David Saint-Jacques after launching in December 2018, and in use again on Crew-13 by CSA astronaut Joshua Kutryk. A smartwatch ECG is usually single-lead and taken on demand, so continuous ECG monitoring works best with the shirt. Values shown here are demo values, not Bio-Monitor data.", links: [L.bio, L.crew13] },
  demo: { label: "Demo values", simulated: true, title: "Demo values", body: "Values for a fictional crew member, shaped by the published in-flight changes cited on each indicator.", links: [] },
  rule: { label: "Alert rule", simulated: true, title: "Screening alert rule (team design)", body: "Fires when the wearable ECG's ST segment stays outside the person's own usual range on 3 consecutive 10-minute averages and resting heart rate is also outside its usual range. A design choice to be tuned with flight data; a wearable ECG is a screening signal, not diagnostic.", links: [] },
  thygesen: { label: "Thygesen 2018", title: "ST-elevation criterion", body: "Fourth Universal Definition of Myocardial Infarction: new ST elevation at the J point of at least 1 mm in two contiguous leads (higher thresholds in leads V2 to V3), measured on a 12-lead ECG. Meeting it indicates possible myocardial infarction; diagnosis needs clinical assessment.", links: [{ t: "Thygesen et al. 2018, Circulation", u: "https://doi.org/10.1161/CIR.0000000000000617" }] },
  symptom: { label: "Quick check", title: "Reported symptom", body: "Chest discomfort, pressure or pain, as answered by the crew member in the quick check.", links: [] },
  labs: { label: "NASA OSDR", title: "Real astronaut lab results", body: "Inspiration4 crew member C001: blood count (OSD-569) and metabolic panel (OSD-575), with the testing lab's own normal ranges. Shown as an example lab history; not Lena's data.", links: [L.osdr569, L.osdr575] },
};
L.actis = { t: "CSA: ACTIS, Acute Care Testing in Space", u: "https://www.asc-csa.gc.ca/eng/sciences/actis.asp" };
SRC.actis = { label: "CSA ACTIS", title: "Blood clot test in space", body: "ACTIS is a portable device the CSA is testing on Crew-13 with Joshua Kutryk. It measures D-dimer, a protein fragment produced when blood clots break down, from a blood sample in about 15 minutes, and can send the result to the ground. A blood clot in the lungs can also cause chest pain, so a normal result helps the crew doctor rule it out. It does not confirm or rule out a heart attack. The result shown here is mock.", links: [L.actis, L.cardio] };
SRC.symptom = { label: "Check-in", title: "Reported symptom", body: "Chest pain, pressure or discomfort, as answered by the crew member in the check-in.", links: [] };
SRC.mood = { label: "Private", title: "Who sees this", body: "Mood and stress are yours. The crew doctor sees your scores and trends, never journal entries. They are never shared in an emergency.", links: [] };
// Sources shown under each measure's card: why it matters in space, and how it is measured.
const MEASURE_SRC = {
  stShift: ["research_cardio", "bio"], heartRate: ["norsk", "bio"], bloodPressure: ["norsk"], bodyTemperature: ["stahn"],
  sleep: ["barger", "bio"], mood: ["behav", "mood"], stress: ["behav", "mood"], exercise: [], hydration: [], reactionTime: [],
};
const ENTRY_NAMES = { hydration: "Hydration", mood: "Mood", stress: "Stress", reactionTime: "Reaction test" };
function openCite(btn) {
  const c = CITES.get(btn.dataset.cite), pop = $("cite-pop");
  if (!c) return;
  pop.innerHTML = `${c.simulated ? `<span class="tag-sim">Not measured data</span>` : ""}<h3>${esc(c.title)}</h3><p>${esc(c.body)}</p>${c.links.length ? `<ul>${c.links.map((l) => `<li><a href="${esc(l.u)}" target="_blank" rel="noopener">${esc(l.t)}</a></li>`).join("")}</ul>` : ""}`;
  pop.hidden = false;
  const b = btn.getBoundingClientRect(), W = document.documentElement.clientWidth, H = innerHeight;
  pop.style.left = `${Math.max(8, Math.min(b.left, W - pop.offsetWidth - 8))}px`;
  pop.style.top = `${b.bottom + pop.offsetHeight + 12 > H ? Math.max(8, b.top - pop.offsetHeight - 6) : b.bottom + 6}px`;
  btn.setAttribute("aria-expanded", "true");
}
function closeCite() { $("cite-pop").hidden = true; document.querySelectorAll(".cite[aria-expanded=true]").forEach((x) => x.setAttribute("aria-expanded", "false")); }

// ---------- data ----------
async function getJSON(u, opt) { const r = await fetch(u, opt); if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); }
async function post(type, extra = {}) {
  const S = await getJSON("/api/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, who: ui.me, ...extra }) });
  accept(S, true);
  if (["spe_start", "stand_down", "reset", "mode"].includes(type)) loadRad();
}
async function poll() { try { accept(await getJSON("/api/state")); } catch (e) { /* offline: keep the last state */ } }
// The hash leaves out the clock and reading times, which change every second, so the page redraws only on real change.
const VOLATILE = new Set(["now", "clock", "time"]);
function accept(S, force) {
  ui.offset = S.now - Date.now() / 1000;
  const h = JSON.stringify(S, (k, v) => (VOLATILE.has(k) ? undefined : v));
  const modeChanged = ui.S && ui.S.mode !== S.mode;
  const emKey = S.emergency ? S.emergency.id : null, emChanged = ui.S && (ui.S.emergency ? ui.S.emergency.id : null) !== emKey;
  ui.S = S;
  if (modeChanged || emChanged) loadRad();
  if (force || h !== ui.hash) { ui.hash = h; if (typing()) ui.pending = true; else render(); }
}
function typing() { const a = document.activeElement; return a && a.tagName === "INPUT" && a.type === "text"; }
async function loadRad() {
  const S = ui.S, ev = S && S.emergency && S.emergency.kind === "spe" ? `&event=${encodeURIComponent(S.emergency.event || "demo")}`
    : S && S.spe_caution ? `&event=${encodeURIComponent(S.spe_caution.event || "demo")}` : "";
  try { ui.rad = await getJSON(`/api/radiation?mode=${S ? S.mode : "mars"}${ev}`); render(); } catch (e) { /* keep */ }
}
async function loadEvents() {
  try { const r = await getJSON("/api/donki/events"); ui.events = r.events || []; } catch (e) { ui.events = []; }
  $("spe-events").innerHTML = (ui.events.length ? ui.events.slice(0, 24).map((e) =>
    `<button type="button" class="btn out sm" data-spe="${esc(e.id)}">${esc(e.date)}</button>`).join("") : "<span>No DONKI storms cached yet.</span>")
    + `<button type="button" class="btn out sm" data-spe="demo">Simulated storm</button>`;
}

// ---------- shared state helpers ----------
const heart = (S) => S.heart;
const heartOpen = (S) => S.heart && ["caution", "doctor_woken", "monitored", "confirmed"].includes(S.heart.stage);
const speOn = (S) => S.emergency && S.emergency.kind === "spe";
const stormDose = () => (ui.rad && ui.rad.storm ? ui.rad.storm : null);
const SHELTER_WORD = { alerted: "Not yet acknowledged", acknowledged: "On the way to the shelter", in_shelter: "In the storm shelter" };
const ROSTER_WORD = { alerted: "Alerted", acknowledged: "Responding", on_the_way: "On the way", on_scene: "On scene", patient: "Patient", in_shelter: "In shelter" };
const ARS_SRC = { label: "CDC", title: "Acute radiation sickness threshold", body: "Acute radiation syndrome usually needs a large whole-body dose received quickly, generally above about 0.7 gray (Gy). Doses from a sheltered solar storm are far below that, so vital signs are not expected to change; the concern is the added lifetime (career) dose.", links: [{ t: "CDC: Acute Radiation Syndrome", u: "https://www.cdc.gov/radiation-emergencies/hcp/clinical-guidance/ars.html" }] };
function radAdvisory() {
  const r = ui.rad;
  if (!r || r.dose.shareOfLimit < 0.8) return null;
  return r.dose.limitDay
    ? `Projected to pass the 600 mSv career limit on mission day ${NUM(r.dose.limitDay)}, ${NUM(r.dose.limitDay - r.mission.today)} days from now. Flight surgeons will review the dose plan.`
    : `Projected to use ${NUM(Math.round(r.dose.shareOfLimit * 100))}% of the 600 mSv career limit by the end of the mission.`;
}
const chip = (cls, icon, words, fill = true) => `<span class="chip ${cls}">${IC(icon, fill)}${words}</span>`;
const CHIP = {
  emergency: chip("emergency", "emergency", "Emergency"),
  caution: chip("caution", "warning", "Caution"),
  advisory: chip("advisory", "info", "Advisory"),
};

// ===================== RENDER =====================
function render() {
  const S = ui.S;
  if (!S) return;
  CITES.clear(); closeCite();
  $("as-select").value = ui.me;
  document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === S.mode)));
  const e = S.emergency;
  if (e && ui.emId !== e.id) { ui.emId = e.id; ui.tab = "emergency"; }
  if (!ui.tab || (!e && ui.tab === "emergency") || (ui.tab === "doctor" && ui.me !== "sam")) ui.tab = ui.me === "sam" ? "doctor" : "health";
  renderBar(S);
  renderNav(S);
  const main = $("main");
  if (ui.tab === "emergency" && e) main.innerHTML = renderEmergency(S);
  else if (ui.tab === "alerts") main.innerHTML = renderAlerts(S);
  else if (ui.tab === "crew") main.innerHTML = renderCrew(S);
  else if (ui.tab === "doctor") main.innerHTML = renderDoctor(S);
  else main.innerHTML = renderHealth(S);
  renderPanel(S);
  drawCharts();
  if (ui.me === "sam" && ui.tab === "doctor" && S.heart && heartOpen(S) && ui.selPerson === "lena" && !S.heart.seen_at && !ui.seenSent[S.heart.id]) {
    ui.seenSent[S.heart.id] = true; post("doctor_seen");
  }
}

// ---------- top bar ----------
function myCaution(S) {
  if (ui.me === "lena" && heartOpen(S)) return { name: "Heart warning signs" };
  if (ui.me === "sam" && S.doctor_woken) return { name: `${NAMES[S.doctor_woken.by] || S.doctor_woken.by} needs the crew doctor` };
  if (S.spe_caution) return { name: "Solar particle event" };
  return null;
}
function renderBar(S) {
  const e = S.emergency, bar = $("bar"), c = myCaution(S);
  let cls = "neutral", mid;
  if (e) {
    cls = "emergency";
    mid = `${IC("emergency_bar", true)}<span><span class="cls">Emergency</span><span class="what">${esc(e.kind === "heart" ? `${e.what}: ${NAMES[e.patient]}` : e.what)}</span></span>`;
    document.title = `Emergency: ${e.what}. Health`;
  } else if (c) {
    cls = "caution";
    mid = `${IC("warning", true)}<span><span class="cls">Caution</span><span class="what">${esc(c.name)}</span></span>`;
    document.title = `Caution: ${c.name}. Health`;
  } else {
    const me = S.crew.find((x) => x.id === ui.me);
    mid = `<span><span class="what">${esc(me.name)}</span><span class="cls" style="font-weight:400;font-size:var(--t19)">${esc(me.role.split(" (")[0])}</span></span>`;
    document.title = "Health";
  }
  bar.className = `bar ${cls}`;
  $("mid").innerHTML = mid;
  const delay = { station: "Earth: near-live", moon: "Earth: 1.3 s each way", mars: "Earth: 14 min each way" }[S.mode];
  $("link").innerHTML = `<span class="sr">Earth link: ${esc(delay)}.</span>${IC("public")}${IC(S.mode === "mars" ? "signal_delay" : "signal_cellular_alt")}<span class="delay" aria-hidden="true">${esc(delay)}</span>`;
  $("get-doctor").hidden = ui.me === "sam";
  $("sos").hidden = !!e;
  tickClock();
}
function tickClock() {
  const s = gmtSec(serverNow());
  $("clock").textContent = HC.timeShown(s);
  $("clock-sr").textContent = HC.timeSaid(s) + ".";
}

// ---------- bottom navigation ----------
function renderNav(S) {
  const n = myAlerts(S).length;
  const tabs = [];
  if (S.emergency) tabs.push(["emergency", "emergency", "Emergency"]);
  tabs.push(["health", "favorite", "Health"], ["alerts", "notifications", "Alerts"], ["crew", "group", "Crew"]);
  if (ui.me === "sam") tabs.push(["doctor", "medical", "Crew doctor"]);
  $("nav").innerHTML = tabs.map(([k, ic, t]) => `<button type="button" class="tab${k === "emergency" ? " em" : ""}" data-tab="${k}"${ui.tab === k ? ' aria-current="page"' : ""}>${IC(ic, ui.tab === k || k === "emergency")}${t}${k === "alerts" && n ? ` <span class="badge" aria-label="${n} active">${n}</span>` : ""}</button>`).join("");
}

// ---------- alert strips (Health and Alerts tabs) ----------
function strip(kind, icon, cls, line1, line2, actions) {
  return `<section class="strip ${kind}" aria-label="${esc(cls)}">${IC(icon, true)}<span class="txt"><span class="l2"><span class="cls">${esc(cls)}.</span> ${line1}</span>${line2 ? `<span class="l3">${line2}</span>` : ""}</span>${actions ? `<span class="acts">${actions}</span>` : ""}</section>`;
}
function emergencyStrip(S) {
  const e = S.emergency;
  return strip("emergency", "emergency", "Emergency", `<b>${esc(e.what)}</b>${e.patient ? ` · ${esc(NAMES[e.patient])}` : ""} · ${esc(e.where)}. ${esc(myActionText(S))}`, "",
    `<button type="button" class="btn red" data-tab="emergency">Back to emergency</button>`);
}
function heartStrip(S) {
  const h = S.heart, c = S.health.lena.caution, now = serverNow(), limit = h.issued_at + 180;
  let l3;
  if (!h.quick_check) {
    l3 = limit > now ? `If you do not answer, the crew doctor will be alerted at ${T(limit)}, in <span data-left-min="${limit}">${pl(Math.ceil((limit - now) / 60), "minute")}</span>.`
      : `No answer yet. The crew doctor has been alerted at ${T(limit)}. You can still answer.`;
  } else {
    l3 = `You answered ${esc(c.answered)} at ${T(h.answered_at)}. ${h.quick_check === "no" ? "" : `The crew doctor, Sam, ${h.seen_at ? `saw it at ${T(h.seen_at)}` : "has been alerted"}.`}`;
    if (h.heart_reading) l3 += ` Heart reading taken at ${T(h.reading_at)}.`;
    if (h.stage === "confirmed") l3 += " The crew doctor has reviewed it and will tell you the next step.";
  }
  return `<section class="strip caution" aria-label="About this caution"><span class="txt"><span class="l2">${esc(c.reasons)}</span><span class="l3">${l3}</span></span>
    <button class="btn" type="button" data-open-check aria-haspopup="dialog">${h.quick_check ? "Check-in answer" : "Check in"}</button></section>`;
}
function myAlerts(S) {
  const me = ui.me, out = [];
  if (S.emergency && ui.tab !== "emergency") out.push(emergencyStrip(S));
  if (me === "lena" && heartOpen(S)) out.push(heartStrip(S));
  if (S.spe_caution) out.push(strip("caution", "warning", "Caution", `<b>${esc(S.spe_caution.text)}</b>`,
    "At the station, Earth's magnetic field shields most of each orbit. The ground radiation team directs precautions.",
    `<button type="button" class="btn out" data-act="spe_end">Alert over</button>`));
  if (me === "sam" && S.doctor_woken) out.push(strip("caution", "warning", "Caution",
    `<b>${esc(NAMES[S.doctor_woken.by] || S.doctor_woken.by)} needs the crew doctor.</b> ${esc(S.doctor_woken.why)}.`, `Alerted at ${T(S.doctor_woken.at)}.`,
    S.doctor_woken.by === "lena" && heartOpen(S) ? `<button type="button" class="btn" data-person="lena" data-tab="doctor">Open evidence</button>` : ""));
  if (me !== "sam" && S.doctor_woken && S.doctor_woken.by === me && !(me === "lena" && heartOpen(S)))
    out.push(strip("advisory", "info", "Advisory", `<b>Crew doctor alerted at ${T(S.doctor_woken.at)}.</b> Sam is coming to you. Nobody else has been alerted.`));
  if (me === "sam") S.advisories.filter((a) => !a.dismissed).forEach((a) => out.push(strip("advisory", "info", "Advisory",
    `<b>${esc(NAMES[a.person])}:</b> ${esc(a.text)}.`, `Arrived quietly at ${T(a.at)}. ${esc(NAMES[a.person])} has also been told.`,
    `<button type="button" class="btn out" data-person="${a.person}" data-tab="doctor">Review</button>`)));
  if (me === "lena" && S.access_closed_notice) out.push(strip("advisory", "info", "Advisory",
    `<b>Crew access to your data closed at ${T(S.access_closed_notice.at)}.</b>`,
    `Shared during the emergency: ${esc(S.access_closed_notice.data)}, with ${esc(S.access_closed_notice.shared_with)}. Your mood, stress and journal were never shared.`));
  const ra = radAdvisory();
  if (ra) out.push(strip("advisory", "info", "Advisory", `<b>Radiation dose plan.</b> ${ra}`, "",
    `<button type="button" class="btn out" data-goto="rad">See radiation</button>`));
  return out;
}

// ===================== HEALTH TAB =====================
const CFG = {};
function cardsHTML(pid, opts = {}) {
  const S = ui.S, data = S.health[pid];
  HC.setCrewData(data);
  const own = pid === ui.me;
  return HC.DEFS.filter((d) => !opts.only || opts.only.includes(d.id)).map((def) => {
    const m = data.measures[def.id];
    if (!m) return "";
    try {
      const M = HC.cardModel(def, m), key = `${pid}:${def.id}`;
      CFG[key] = HC.chartConfig(M);
      const srcs = (MEASURE_SRC[def.id] || []).map((k) => cite(SRC[k])).join("");
      const enter = own && M.pending ? `<button type="button" class="btn out enter" data-checkin="${def.id}">Enter today's ${def.kind === "test" ? "test" : esc(def.name.toLowerCase())}</button>` : "";
      return `<li class="card" data-chart="${key}"><div class="head"><h2>${esc(def.name)}</h2><div class="tags">${HC.pillsHTML(M)}</div>${HC.trendHTML(M)}${HC.readingHTML(M)}</div>${HC.amountHTML(M)}${HC.referenceHTML(M)}${enter}<div class="plot"></div><p class="sr">${HC.esc(HC.chartSentence(M))}</p>${srcs ? `<p class="src">${srcs}</p>` : ""}</li>`;
    } catch (err) { console.error(`[crew data] ${def.name} could not be drawn: ${err.message}`); return ""; }
  }).join("");
}
function drawCharts() {
  const go = () => {
    document.querySelectorAll(".card[data-chart]").forEach((t) => { const p = t.querySelector(".plot"), c = CFG[t.dataset.chart]; if (!p) return; p.innerHTML = ""; const W = p.clientWidth; if (c && W > 0) p.appendChild(HC.chart(c, W)); });
    // Card rows (design, alignment option 5): a card that ends above its neighbour gives the spare height to its plot.
    document.querySelectorAll(".card[data-chart]").forEach((t) => { const p = t.querySelector(".plot"), c = CFG[t.dataset.chart]; if (!p || !c || c.panels) return;
      const after = [...t.children].slice([...t.children].indexOf(p) + 1).reduce((a, x) => a + x.getBoundingClientRect().height, 0);
      const spare = Math.floor(t.getBoundingClientRect().bottom - 24 - after - p.getBoundingClientRect().bottom);
      if (spare > 6) { const cfg = Object.assign({}, c); cfg.ph = (cfg.ph || 120) + spare; p.innerHTML = ""; p.appendChild(HC.chart(cfg, p.clientWidth)); } });
  };
  go();
}

function renderHealth(S) {
  const me = ui.me, alerts = myAlerts(S);
  const done = Object.values(S.checkins[me]).filter(Boolean).length, all = Object.keys(S.checkins[me]).length;
  const entries = `<li class="card flat wide"><h2 class="h">Today's check-ins</h2>
    <p>${NUM(done)} of ${NUM(all)} done: ${Object.entries(S.checkins[me]).map(([k, v]) => `${ENTRY_NAMES[k]} ${v ? "done" : "not yet"}`).join(", ")}.</p>
    <p class="muted">${NUM(done === all ? S.streak + 1 : S.streak)}-day check-in streak. Credit is for completing check-ins, never for results.</p></li>`;
  return `<h1 class="sr">Health</h1>${alerts.length ? `<div class="strips">${alerts.join("")}</div>` : ""}
    <ul class="tiles" aria-label="Your health measures">${cardsHTML(me)}${radCard(S)}${entries}${me === "lena" ? accessLog(S) : ""}</ul>`;
}
function accessLog(S) {
  const log = (S.access_log.lena || []).slice(0, 6);
  return `<li class="card flat wide"><h2 class="h">Who has seen my data</h2>
    ${log.length ? `<table class="tbl"><tr><th>When</th><th>Who</th><th>What</th></tr>${log.map((l) => `<tr><td>${T(l.at)}</td><td>${esc(l.who)}</td><td>${esc(l.data)}</td></tr>`).join("")}</table>` : "<p>Nobody has viewed your data today.</p>"}
    <p class="muted">Your journal is never shown to anyone.</p></li>`;
}

// ---------- the check-in panel (design file, wired to the shared state) ----------
function renderPanel(S) {
  const pnl = $("check"), h = S.heart, show = ui.me === "lena" && heartOpen(S);
  if (!show) { if (ui.panelOpen) closeCheck(true); pnl.innerHTML = ""; ui.panelKey = ""; return; }
  const c = S.health.lena.caution, k = c.checkIn, limit = h.issued_at + 180;
  const key = JSON.stringify([h.id, h.quick_check, h.seen_at, h.heart_reading, h.stage, serverNow() >= limit]);
  if (!ui.autoOpened[h.id] && !h.quick_check && !params.has("panel")) { ui.autoOpened[h.id] = true; ui.panelKey = ""; setTimeout(openCheck, 0); }
  if (key === ui.panelKey) return;   // no change: keep focus where it is
  ui.panelKey = key;
  const head = `<div class="dh"><h2 id="ci" tabindex="-1">Check in</h2><button class="btn out" type="button" id="close-check">Close</button></div>`;
  let body;
  if (!h.quick_check) {
    const ans = [["yes", "Yes", "yes"], ["unsure", "Not sure", ""], ["no", "No", "no"]];
    body = `<div class="ask"><p class="why">This opened because of the caution at ${T(h.issued_at)}.</p>
      <p class="det">${esc(k.details)}</p><p class="who">Only you and the crew doctor have been told.</p>
      <p class="q">${esc(k.question)}</p>
      <div class="answers">${ans.map(([v, w, cls]) => `<div class="col"><button class="ans ${cls}" type="button" data-qc="${v}" aria-describedby="o-${v}">${w}</button><p class="out" id="o-${v}">${esc(k.outcomes[w])}</p></div>`).join("")}</div>
      <p class="tim">${serverNow() < limit
        ? `<span class="t1">If you do not answer, the crew doctor will be alerted in <b data-left="${limit}">${leftWords(limit - serverNow())}</b></span><span class="t2">at ${T(limit)}.</span>`
        : `<span class="t1"><b>No answer yet. The crew doctor has been alerted.</b> You can still answer.</span><span class="t2">Alerted at ${T(limit)}.</span>`}</p></div>`;
  } else {
    const yes = h.quick_check === "yes", unsure = h.quick_check === "unsure";
    const reading = h.heart_reading ? `<p>Heart reading (12-lead ECG) taken at ${T(h.reading_at)}. The crew doctor has it.</p>`
      : `<div class="acts"><button class="btn" type="button" data-act="heart_reading">Take a heart reading (12-lead ECG)</button></div>`;
    body = `<div class="conf" role="status" style="display:block">
      <p class="a">You answered ${esc(c.answered)} to ${esc(k.symptom)}.</p>
      ${yes || unsure ? `<p class="who"><b>The crew doctor, Sam, has been alerted</b> at ${T(S.doctor_woken ? S.doctor_woken.at : h.answered_at)}. ${h.seen_at ? `He saw it at ${T(h.seen_at)}.` : "He has not seen it yet."}</p>
        <p class="who">Sam decides what happens next.</p>` : `<p class="who">Nobody else has been told. The result is monitored.</p>`}
      ${yes ? `<p>${esc(k.afterYes)}</p>` : `<p class="mt8">${esc(k.outcomes[c.answered])}</p>`}
      ${yes ? (h.heart_reading ? reading : "") : reading}
      <div class="acts"><button class="btn out" type="button" data-act="change_answer">Change answer</button></div></div>`;
  }
  pnl.innerHTML = head + body;
  if (ui.panelOpen) setTimeout(() => $("ci") && $("ci").focus(), 0);
}
const placePanel = () => { const b = $("bar").getBoundingClientRect().bottom; document.querySelector(".scrim").style.top = `${b}px`; $("check").style.top = `${b + 24}px`; };
const inert = (v) => ["main", "nav"].forEach((s) => { const el = document.querySelector(s); if (v) el.setAttribute("inert", ""); else el.removeAttribute("inert"); });
function openCheck() { if (!$("check").innerHTML) return; ui.panelOpen = true; document.documentElement.classList.add("open"); placePanel(); inert(true); $("ci").focus(); }
function closeCheck(silent) {
  ui.panelOpen = false; document.documentElement.classList.remove("open"); inert(false);
  if (!silent) { const b = document.querySelector("[data-open-check]"); if (b) b.focus(); }
}

// ---------- radiation card ----------
function radCard(S) {
  const r = ui.rad;
  if (!r) return `<li class="card wide" id="rad"><h2 class="h">Radiation, career dose</h2><p>Loading radiation data…</p></li>`;
  const d = r.dose, ra = radAdvisory(), storm = speOn(S) || S.spe_caution;
  const pills = storm ? (speOn(S) ? CHIP.emergency : CHIP.caution) : ra ? chip("advisory", "info", "Advisory: dose plan") : chip("green", "check_circle", "Within the dose plan");
  const rateSrc = { label: { mars: "Curiosity RAD", moon: "Chang'e 4 LND", station: "NASA ISS" }[r.mission.mode], title: "Expected daily dose by mission phase",
    body: "Projection uses published dose rates per phase: ~1.84 mSv/day in deep space and ~0.64 mSv/day on the Mars surface (Curiosity RAD), ~1.37 mSv/day on the Moon surface (Chang'e 4), ~0.5 mSv/day on the ISS. Prior career dose and mission day are demo values.",
    links: { mars: [L.zeitlin, L.hassler], moon: [L.zhang, L.zeitlin], station: [] }[r.mission.mode].concat(r.source === "real" ? [L.radlab] : []) };
  const recentSrc = r.recent.source === "real"
    ? { label: "NASA RadLab", title: `${r.mission.instrument}: measured dose rate`, body: `Daily mean dose rate, ${r.recent.dates[0]} to ${r.recent.dates[r.recent.dates.length - 1]}, from NASA OSDR RadLab.`, links: [L.radlab] }
    : { label: "Simulated", simulated: true, title: "Simulated dose rate", body: "Simulated around the published rate for this location. Load measured data with python -m radiation.radlab fetch-events.", links: [L.radlab] };
  const limitSrc = { label: "NASA-STD-3001", title: "NASA career dose limit", body: "NASA's career effective dose limit for all astronauts is 600 mSv (NASA-STD-3001, Volume 1).", links: [] };
  const st = r.storm;
  const stormLine = st ? `<p class="amt">${IC(speOn(S) ? "emergency" : "warning", true)}<span>Solar particle event ${esc(st.date || "(simulated)")}: ${st.doseSource === "real"
    ? (st.detected ? `extra dose measured here ${NUM(st.extraDose)} mSv` : "no increase above normal variation measured at this location")
    : `extra dose ${NUM(st.extraDose)} mSv (simulated profile)`}</span></p>` : "";
  return `<li class="card wide" id="rad"><div class="head"><h2>Radiation, career dose</h2><div class="tags">${pills}</div>
      <p class="first"><span class="val"><span class="big num">${d.soFar.toFixed(0)}</span> <span class="u">mSv so far in your career</span></span></p></div>
    ${stormLine}
    <p class="range">${ra || esc(r.headline)} Career limit ${NUM(600)} mSv ${cite(limitSrc)}</p>
    <div class="stats mt24">
      <div class="stat"><span>So far</span><b>${d.soFar.toFixed(0)} mSv</b></div>
      <div class="stat"><span>Projected at mission end</span><b>${d.projectedTotal.toFixed(0)} mSv</b></div>
      <div class="stat"><span>Career limit</span><b>${d.limit.toFixed(0)} mSv</b></div>
      <div class="stat"><span>Limit reached</span><b>${d.limitDay ? `Day ${d.limitDay}` : "No"}</b></div>
    </div>
    <div class="chart mt24"><div class="chart-head"><span>Career dose by mission day</span>${cite(rateSrc)}</div>${cumulativeChart(r)}
      <span class="muted">Solid line: so far. Dashed line: projected. Shaded: uncertainty.</span></div>
    <div class="chart mt24"><div class="chart-head"><span>Daily dose rate, last ${r.recent.values.length} days · ${esc(r.mission.instrument)}</span>${cite(recentSrc)}</div>${recentChart(r)}</div>
    ${r.breakdown ? `<div class="mt24">${neutronCard(r.breakdown)}</div>` : ""}
    <div class="two mt24">
      <div><p class="lab">What to do</p><ul style="margin:4px 0 0;padding-left:1.25rem">${r.actions.map((a) => `<li>${esc(a.text)}</li>`).join("")}</ul></div>
      <div><p class="lab">Why it matters in space</p><p>Space radiation passes through the hull and the body, raising lifetime cancer risk. Solar storms can add a large dose within hours.</p><p class="muted">NASA: ${esc(r.nasaRisk)}</p></div>
    </div></li>`;
}

// ===================== ALERTS TAB =====================
function renderAlerts(S) {
  const active = myAlerts(S);
  const past = S.closed.map((c) => `<li class="card flat"><h2 class="h">${esc(c.what)}${c.patient ? `: ${esc(NAMES[c.patient])}` : ""}</h2>
    <p>Declared ${T(c.declared_at)} by ${esc(c.declared_by)}. Ended ${T(c.ended_at)} by ${esc(c.ended_by)}.</p>
    <p>Reason: ${esc(c.reason || "none given")}. Outcome: ${esc({ not_known: "not yet known", confirmed: "confirmed event", false_alarm: "false alarm", ended: "ended" }[c.outcome] || c.outcome)}.</p></li>`);
  return `<h1 class="sr">Alerts</h1><h2 class="section-title">Active</h2>
    ${active.length ? `<div class="strips">${active.join("")}</div>` : `<p class="card">${IC("check_circle", true)} No active alerts for you.</p>`}
    <h2 class="section-title">Earlier this mission</h2>
    ${past.length ? `<ul class="tiles">${past.join("")}</ul>` : `<p class="card">No earlier crew-wide alerts.</p>`}`;
}

// ===================== CREW TAB =====================
function renderCrew(S) {
  const e = S.emergency;
  return `<h1 class="sr">Crew</h1><ul class="people">${S.crew.map((c) => `<li class="person"><span class="nm">${esc(c.name)}${c.id === ui.me ? " (you)" : ""}</span>
    <span>${esc(c.role)}</span><span class="muted">${esc(c.where)}</span>
    ${e ? `<span class="st">${esc(ROSTER_WORD[e.roster[c.id]] || e.roster[c.id])}</span>` : ""}</li>`).join("")}</ul>
    <p class="muted">Crew members see names, roles and locations. Health data is shared only with the crew doctor, and with the whole crew only during an emergency (emergency data only, logged).</p>`;
}

// ===================== CREW DOCTOR TAB =====================
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
    const st = e.roster[pid];
    return st === "in_shelter" ? { rank: 2, chip: chip("neutral", "check_circle", "In shelter"), reason: "In the storm shelter" }
      : { rank: 4, chip: CHIP.emergency, reason: SHELTER_WORD[st] || st };
  }
  if (e && e.patient === pid) return { rank: 5, chip: CHIP.emergency, reason: `${e.what}: emergency in progress` };
  if (pid === "lena" && heartOpen(S)) {
    const h = S.heart, m = h.model;
    if (h.stage === "monitored") return { rank: 2, chip: CHIP.advisory, reason: "Monitored: heart screening alert" };
    return { rank: 3, chip: CHIP.caution, reason: m.level === "criterion_met" ? "12-lead ECG meets the ST-elevation criterion" : "Wearable ECG changed from usual (screening)" };
  }
  if (S.doctor_woken && S.doctor_woken.by === pid) return { rank: 3, chip: CHIP.caution, reason: `Asked for you: ${S.doctor_woken.why}` };
  const sm = S.summary[pid];
  if (sm && sm.state === "missing") return { rank: 1, chip: chip("stale", "schedule", "No new data"), reason: sm.reason };
  if (sm && sm.state === "preventive") return { rank: 1, chip: chip("entry", "info", "Preventive step", false), reason: sm.reason };
  return { rank: 0, chip: chip("green", "check_circle", "Within usual ranges"), reason: sm ? sm.reason : "All measures within usual range" };
}
function renderDoctor(S) {
  const crew = S.crew.map((c) => ({ ...c, st: personStatus(S, c.id) })).sort((a, b) => b.st.rank - a.st.rank);
  const alerts = myAlerts(S);
  const people = `<ul class="people" aria-label="Crew, most urgent first">${crew.map((c) => `<li><button type="button" class="person" style="width:100%" data-person="${c.id}" aria-pressed="${ui.selPerson === c.id}">
      <span class="nm">${esc(c.name)}</span>${c.st.chip}<span>${esc(c.st.reason)}</span><span class="muted">${esc(c.role)}</span></button></li>`).join("")}</ul>`;
  const notKnown = S.closed.filter((c) => c.outcome === "not_known").map((c) => strip("advisory", "info", "Advisory",
    `<b>Outcome not yet recorded:</b> ${esc(c.what)}, ended ${T(c.ended_at)}.`, "",
    `<button type="button" class="btn out" data-outcome="${c.id}" data-value="confirmed">Confirmed event</button><button type="button" class="btn out" data-outcome="${c.id}" data-value="false_alarm">False alarm</button>`));
  const pid = ui.selPerson, showEvidence = pid === "lena" && heartOpen(S);
  const decisions = S.decisions.length ? `<li class="card flat wide"><h2 class="h">Decision record</h2><table class="tbl"><tr><th>When</th><th>Who</th><th>Decision</th><th>Reason</th></tr>
    ${S.decisions.slice(0, 8).map((d) => `<tr><td>${T(d.at)}</td><td>${esc(d.who)}</td><td>${esc(d.decision)}</td><td>${esc(d.reason)}</td></tr>`).join("")}</table></li>` : "";
  return `<h1 class="sr">Crew doctor</h1>${alerts.length || notKnown.length ? `<div class="strips">${alerts.join("")}${notKnown.join("")}</div>` : ""}
    ${people}
    <h2 class="section-title">${esc(NAMES[pid])}${showEvidence ? ": heart warning signs" : ""}</h2>
    <ul class="tiles">${showEvidence ? evidence(S) : ""}${cardsHTML(pid)}${pid === "lena" ? labs() : ""}${decisions}</ul>`;
}
function evidence(S) {
  const h = S.heart, m = h.model, t = S.track;
  const MET = { true: `${IC("check_circle", true)} Met`, false: "Not met", null: "Not yet known" };
  const BASIS = { rule: SRC.rule, norsk: SRC.norsk, symptom: SRC.symptom, thygesen: SRC.thygesen, actis: SRC.actis };
  const adv = S.advisories.find((a) => a.id === h.id && !a.dismissed);
  const decide = h.stage === "countdown" || h.countdown_end
    ? `<div class="strip emergency">${IC("emergency", true)}<span class="txt"><span class="l2"><b class="count" data-countdown="${h.countdown_end}">…</b> until the crew-wide emergency is declared.</span><span class="l3">Started by ${esc(h.countdown_by)}.</span></span>
       <span class="acts"><button type="button" class="btn red" data-act="send_now">Send now</button><button type="button" class="btn out" data-act="stop_countdown">Stop countdown</button></span></div>`
    : `<div class="stack"><p class="lab">Decide. Recorded with your name, the time and your reason.</p>
       <input type="text" id="reason" placeholder="Reason, one line" value="${esc(ui.drafts.reason || "")}" aria-label="Reason">
       <div class="row">${[["escalate", "Escalate to crew-wide emergency"], ["monitor", "Monitor"], ["confirm", "Confirm credible"], ["override", "Override: not credible"]].map(([k, w]) => `<button type="button" class="btn ${k === "escalate" ? "red" : "out"}" data-decide="${k}">${w}</button>`).join("")}</div>
       <p class="muted">Escalate starts a ${NUM(S.countdown_s)}-second countdown you can stop. Nothing beyond alerting happens until a person confirms.</p>
       ${adv ? `<p class="lab mt8">Or dismiss the advisory with a reason</p><div class="row">${["Explained by exercise", "Sensor artefact", "Known for this person"].map((r) => `<button type="button" class="btn out sm" data-dismiss="${adv.id}" data-reason="${esc(r)}">${esc(r)}</button>`).join("")}</div>` : ""}</div>`;
  return `<li class="card wide"><div class="head"><h2>Evidence</h2><div class="tags">${h.stage === "monitored" ? CHIP.advisory : CHIP.caution}</div>
      <p class="first">${esc(m.summary)}</p></div>
    <p class="range">${m.level === "criterion_met" ? "Stage: 12-lead criterion met." : "Stage: screening signal (wearable ECG)."} Raised ${T(h.issued_at)}.${h.reading_at ? ` 12-lead heart reading at ${T(h.reading_at)}.` : ""}
      Check-in answer: ${esc(h.quick_check ? { yes: "Yes", unsure: "Not sure", no: "No" }[h.quick_check] : "not answered yet")}.</p>
    <div class="scroll-x mt16"><table class="tbl"><tr><th>Criterion</th><th>Lena now</th><th>Status</th><th>Basis</th></tr>
      ${m.criteria.map((c) => `<tr><td>${esc(c.label)}</td><td>${HC.numify(c.value)}</td><td>${MET[c.met]}</td><td>${cite(BASIS[c.basis] || SRC.demo)}</td></tr>`).join("")}</table></div>
    <div class="two mt16"><div><p class="lab">Data covered</p><p>${esc(m.coverage.text)}</p></div><div><p class="lab">Limits</p><p>${esc(m.limits)}</p></div></div>
    ${h.heart_reading && h.clot_test ? "" : `<div class="row mt16">${h.heart_reading ? "" : `<button type="button" class="btn out" data-act="heart_reading">Record heart reading (12-lead ECG)</button>`}${h.clot_test ? "" : `<button type="button" class="btn out" data-act="clot_test">Blood clot test (ACTIS D-dimer, about 15 min)</button>`}</div>`}
    ${h.clot_test ? `<p class="muted mt8">ACTIS blood clot test at ${T(h.clot_at)}. On the station it takes about 15 minutes; the demo shows the result at once. Mock result.</p>` : ""}
    <p class="mt16"><span class="lab">Heart alerts this mission:</span> ${NUM(t.alerts)} raised, ${NUM(t.confirmed)} confirmed, ${NUM(t.not_confirmed)} not confirmed, ${NUM(Math.max(0, t.alerts - t.confirmed - t.not_confirmed))} outcome not yet recorded. <span class="muted">Counted from this mission's own alerts.</span></p>
    <p class="muted">${esc(m.label)}. Values shaped by published in-flight data where cited.</p>
    <div class="mt24">${decide}</div></li>`;
}
function labs() {
  return `<li class="card flat wide"><div class="row"><h2 class="h">Example lab history (real astronaut data)</h2><span class="spacer"></span>${cite(SRC.labs)}</div>
    <div class="scroll-x"><table class="tbl"><tr><th>Test (lab range)</th>${LABS.times.map((t) => `<th>${t}</th>`).join("")}</tr>
    ${LABS.rows.map((r) => `<tr><td>${esc(r.name)}<br><span class="muted">${esc(r.range)}</span></td>${r.v.map((v) => `<td>${NUM(v)}${v < r.lo || v > r.hi ? `<br><span class="muted">outside range</span>` : ""}</td>`).join("")}</tr>`).join("")}</table></div>
    <p class="muted">L = days before launch, R = days after return. Out-of-range values occur before flight too, so one result alone should not alarm. Not Lena's data.</p></li>`;
}

// ===================== EMERGENCY TAB =====================
const ACTION = {
  heart: { patient: "Stop what you are doing. Sit or lie down. Help is coming.", sam: "Go to Lena in the Laboratory module. You lead the response.", ravi: "Bring the medical kit and defibrillator to the Laboratory module.", maya: "Go to the Laboratory module and record the response." },
  spe: "Go to the storm shelter now.",
};
function myActionText(S) {
  const e = S.emergency, me = ui.me;
  if (e.kind === "spe") return ACTION.spe;
  if (e.patient === me) return e.kind === "heart" ? ACTION.heart.patient : "Stay where you are. Help is coming.";
  if (e.kind === "heart") return ACTION.heart[me];
  return me === "sam" ? `Go to ${NAMES[e.patient]} in the ${e.where}. You lead the response.` : `Go to ${NAMES[e.patient]} in the ${e.where}.`;
}
function renderEmergency(S) {
  const e = S.emergency, me = ui.me, isPatient = e.patient === me, mySt = e.roster[me];
  const next = e.kind === "spe"
    ? ({ alerted: ["acknowledged", "I'm responding"], acknowledged: ["in_shelter", "I'm in the shelter"] }[mySt] || null)
    : ({ alerted: ["acknowledged", "I'm responding"], acknowledged: ["on_the_way", "On the way"], on_the_way: ["on_scene", "On scene"] }[mySt] || null);
  const current = e.checklist.findIndex((s) => !s.result);
  const canEnd = (e.kind !== "spe" && me === "sam") || (e.kind === "spe" && (me === "sam" || me === "maya"));
  const responders = Object.entries(e.roster).filter(([, s]) => s !== "patient");
  const action = `<li class="card"><h2 class="h">${isPatient ? "Your instruction" : "Your action"}</h2>
    <p class="my-action mt8">${esc(myActionText(S))}</p>
    ${next ? `<div class="mt16"><button type="button" class="btn big" data-respond="${next[0]}">${esc(next[1])}</button></div>` : mySt && !isPatient ? `<p class="mt16 st">You: ${esc(ROSTER_WORD[mySt])}</p>` : ""}
    ${isPatient ? `<p class="lab mt24">Who is coming</p><ul class="roster">${responders.map(([p, s]) => `<li><b>${esc(NAMES[p])}</b><span class="st">${esc(ROSTER_WORD[s])}</span></li>`).join("")}</ul>
      <p class="lab mt16">What the crew can see about you</p><p>Emergency data only: heart measures, the alert and your location. Not your mood, stress or journal.</p>` : ""}
    ${e.kind !== "spe" ? `<p class="muted mt16">Emergency data only is shared. Access closes when the emergency ends, and it is logged.</p>` : ""}
    <p class="muted">Declared ${T(e.declared_at)} by ${esc(e.declared_by)}. ${esc(e.detail || "")}</p></li>`;
  let storm = "";
  if (e.kind === "spe") {
    const st = stormDose();
    storm = `<li class="card"><h2 class="h">Storm dose</h2><p class="mt8">${st ? (st.doseSource === "real" && !st.detected ? "No increase above normal variation has been measured at this location yet."
      : `Extra dose from this storm so far: ${NUM(st.extraDose)} mSv (habitat estimate${st.doseSource === "simulated" ? ", simulated profile" : ""}), added to your career dose.`) : "Loading storm dose…"}</p>
      <p class="mt8">You: <b>${esc(SHELTER_WORD[mySt] || mySt)}</b>.</p>
      <p class="muted mt8">Your other measures are not expected to change: storm doses in a shelter are far below the level that causes immediate symptoms. ${cite(ARS_SRC)}</p></li>`;
  }
  const checklist = isPatient ? "" : `<li class="card"><h2 class="h">First actions</h2><p class="muted">Recorder: Maya, or whoever is free.</p>
    <ol class="steps mt16">${e.checklist.map((s, i) => `<li class="step ${i === current ? "current" : ""} ${s.result ? "done" : ""}"><span class="n">${s.result ? IC("check") : i + 1}</span>
      <div class="stack" style="gap:8px"><div><b>${esc(s.step)}</b> ${s.mock ? `<span class="chip mock">Mock content</span>` : ""}<br><span class="muted">${esc(s.role)}${i === current ? " · current step" : ""}</span></div>
      ${s.result ? `<span>Result: ${esc(s.result)}. ${esc(s.by)} at ${T(s.at)}.</span>`
        : i === current ? `<div class="row"><input type="text" id="step-${i}" aria-label="Result of step ${i + 1}" placeholder="${esc(s.result_hint || "Result")}" value="${esc(ui.drafts[`step-${i}`] || "")}" style="flex:1;min-width:12rem">
          <button type="button" class="btn" data-step="${i}">Record result</button></div>` : ""}</div></li>`).join("")}</ol>
    ${e.kind === "heart" ? `<details class="mt16"><summary>Detailed treatment (mock content)</summary><div class="stack mt8" style="gap:4px">${S.treatment_mock.map((t) => `<p>${esc(t)}</p>`).join("")}</div></details>` : ""}</li>`;
  const patient = e.patient && !isPatient ? `<li class="wide"><h2 class="section-title">${esc(NAMES[e.patient])}: emergency data</h2><ul class="tiles">${cardsHTML(e.patient, { only: ["stShift", "heartRate", "bloodPressure"] })}</ul></li>` : "";
  const roster = `<li class="card"><h2 class="h">Crew</h2><ul class="roster mt8">${S.crew.map((c) => `<li><span><b>${esc(c.name)}</b><br><span class="muted">${esc(c.role)}</span></span><span class="st">${esc(ROSTER_WORD[e.roster[c.id]] || e.roster[c.id])}</span></li>`).join("")}</ul></li>`;
  const rep = e.report;
  const report = `<li class="card"><h2 class="h">Report to Earth</h2>
    ${rep.status === "queued" ? `<p class="mt8"><b>Queued</b> at ${T(rep.queued_at)}. It sends automatically when the link is up.</p>`
      : `<p class="mt8"><b>Sent</b> at ${T(rep.sent_at)}, without anyone composing it.</p><p>Earliest possible reply: <b>${T(rep.earliest_reply_at)}</b>, <span data-until="${rep.earliest_reply_at}">…</span>.</p>`}
    <p class="my-action mt16">Continue without waiting.</p></li>`;
  const end = canEnd ? `<li class="card"><h2 class="h">End the emergency</h2><p class="muted">Only the ${e.kind === "spe" ? "crew doctor or commander" : "crew doctor"} can end it, with a reason.</p>
    <div class="mt16"><button type="button" class="btn out" data-act="open_stand_down">End emergency…</button></div></li>` : "";
  return `<h1 class="sr">Emergency</h1><ul class="tiles">${action}${storm || checklist}${storm ? checklist : ""}${roster}${report}${end}${patient}</ul>`;
}
function openStandDown() {
  const e = ui.S.emergency, who = e.patient ? NAMES[e.patient] : "the whole crew";
  $("modal").innerHTML = `<div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="sd-title">
    <h2 id="sd-title">End the emergency for ${esc(who)}?</h2>
    <p>${esc(e.what)} · ${esc(e.where)} · declared ${T(e.declared_at)}.</p>
    <p>Ending returns every tablet to its normal view${e.patient ? ` and closes the crew's access to ${esc(who)}'s data` : ""}.</p>
    <label class="fld">Reason <input type="text" id="sd-reason" placeholder="For example: patient stable, monitoring continues"></label>
    ${e.kind === "heart" ? `<label class="fld">Outcome <select class="f" id="sd-outcome"><option value="not_known">Not yet known (set later)</option><option value="confirmed">Confirmed event</option><option value="false_alarm">False alarm</option></select></label>` : ""}
    <div class="row"><button type="button" class="btn" id="sd-confirm" disabled>End emergency for ${esc(who)}</button><button type="button" class="btn out" id="sd-cancel">Keep it active</button></div></div>`;
  $("modal").hidden = false;
  $("sd-reason").focus();
}
function openSOS() {
  $("modal").innerHTML = `<div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="sos-title">
    <h2 id="sos-title">Send SOS to the whole crew?</h2>
    <p>Every tablet shows an emergency with your name and location, and a report goes to Earth automatically.</p>
    <div class="row"><button type="button" class="btn red" id="sos-confirm">Send SOS</button><button type="button" class="btn out" id="sd-cancel">Cancel</button></div></div>`;
  $("modal").hidden = false;
  $("sos-confirm").focus();
}

// ---------- radiation charts (plain SVG, the design's chart look: black lines, grey grid, direct labels) ----------
function cumulativeChart(r) {
  const W = 1220, H = 380, Lm = 64, R = 20, Tp = 30, B = 56;
  const total = r.mission.totalDays, lim = r.dose.limit;
  const maxY = Math.max(lim * 1.15, ...r.band.high, r.dose.projectedTotal) * 1.03;
  const x = (d) => Lm + (d - 1) / Math.max(1, total - 1) * (W - Lm - R), y = (v) => Tp + (H - Tp - B) * (1 - v / maxY);
  const last = r.cumulative[r.cumulative.length - 1];
  const so = r.cumulative.map((p) => `${x(p.day)},${y(p.value)}`).join(" ");
  const pr = [last, ...r.projection].map((p) => `${x(p.day)},${y(p.value)}`).join(" ");
  const band = [`${x(last.day)},${y(last.value)}`, ...r.projection.map((p, i) => `${x(p.day)},${y(r.band.high[i])}`), ...r.projection.map((p, i) => `${x(p.day)},${y(r.band.low[i])}`).reverse()].join(" ");
  let g = "";
  for (let v = 0; v <= maxY; v += 200) g += `<line x1="${Lm}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#d0d0d0"/><text class="n" x="${Lm - 10}" y="${y(v) + 6}" text-anchor="end">${v}</text>`;
  const step = total > 400 ? 200 : total > 150 ? 60 : 30;
  for (let d = step; d <= total; d += step) g += `<text class="n" x="${x(d)}" y="${H - B + 26}" text-anchor="middle">${d}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Career dose: ${r.dose.soFar.toFixed(0)} mSv so far, projected ${r.dose.projectedTotal.toFixed(0)} mSv at mission end, limit ${lim} mSv${r.dose.limitDay ? `, reached on mission day ${r.dose.limitDay}` : ""}.">${g}
    <text x="0" y="18">mSv</text>
    <polygon points="${band}" fill="#e0e0e0"/>
    <line x1="${Lm}" x2="${W - R}" y1="${y(lim)}" y2="${y(lim)}" stroke="#000" stroke-width="1.5" stroke-dasharray="16 6"/>
    <text x="${Lm + 8}" y="${y(lim) - 8}" font-weight="600">Career limit <tspan class="n">${lim}</tspan> mSv</text>
    <line x1="${x(last.day)}" x2="${x(last.day)}" y1="${Tp}" y2="${H - B}" stroke="#6f6f6f" stroke-dasharray="3 4"/>
    <text x="${x(last.day) + 8}" y="${H - B - 10}">Today, day <tspan class="n">${last.day}</tspan></text>
    <polyline points="${so}" fill="none" stroke="#000" stroke-width="2.5"/>
    <polyline points="${pr}" fill="none" stroke="#000" stroke-width="2.5" stroke-dasharray="7 5"/>
    ${r.dose.limitDay ? `<rect x="${x(r.dose.limitDay) - 6}" y="${y(lim) - 6}" width="12" height="12" fill="#000"/><text x="${Math.min(x(r.dose.limitDay), W - 150)}" y="${y(lim) + 28}" text-anchor="middle" font-weight="600">Limit reached, day <tspan class="n">${r.dose.limitDay}</tspan></text>` : ""}
    <text x="${(Lm + W - R) / 2}" y="${H - 2}" text-anchor="middle">Mission day</text></svg>`;
}
function recentChart(r) {
  const vals = r.recent.values, W = 1220, H = 220, Lm = 64, B = 34, Tp = 10;
  const med = [...vals].sort((a, b) => a - b)[Math.floor(vals.length / 2)], maxY = Math.max(...vals) * 1.15 || 1, bw = (W - Lm - 8) / vals.length;
  const y = (v) => Tp + (H - Tp - B) * (1 - v / maxY);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily dose rate, ${vals.length} days, usual about ${med.toFixed(2)} mSv per day${vals.some((v) => v > med * 1.5) ? "; some days well above usual" : ""}.">
    ${vals.map((v, i) => `<rect x="${Lm + i * bw + 2}" y="${y(v)}" width="${bw - 4}" height="${H - B - y(v)}" fill="${v > med * 1.5 ? "#000" : "#a8a8a8"}"><title>${v.toFixed(2)} mSv/day</title></rect>`).join("")}
    <line x1="${Lm}" x2="${W}" y1="${y(med)}" y2="${y(med)}" stroke="#000" stroke-width="1.5" stroke-dasharray="6 5"/>
    <text class="n" x="${Lm - 10}" y="${y(med) + 6}" text-anchor="end">${med.toFixed(2)}</text>
    <line x1="${Lm}" x2="${W}" y1="${H - B}" y2="${H - B}" stroke="#000" stroke-width="1.5"/>
    <text x="${Lm}" y="${H - 6}">${esc(r.recent.dates ? r.recent.dates[0] : `${vals.length} days ago`)}</text>
    <text x="${W}" y="${H - 6}" text-anchor="end">${esc(r.recent.dates ? r.recent.dates[r.recent.dates.length - 1] : "Today")}</text></svg>
    <span class="muted">mSv per day. Dashed line: usual (median). Black bars: more than 1.5 times usual.</span>`;
}
function splitBar(share) {
  const n = Math.round(share * 100), w = 1220;
  return `<svg viewBox="0 0 ${w} 44" role="img" aria-label="Charged particles ${100 - n} percent, neutrons ${n} percent"><rect x="0" y="0" width="${w * (1 - share) - 2}" height="44" fill="#a8a8a8"/><rect x="${w * (1 - share)}" y="0" width="${w * share}" height="44" fill="#393939"/>
    <text x="12" y="29" font-weight="600">Charged particles <tspan class="n">${100 - n}</tspan>%</text><text x="${w - 12}" y="29" text-anchor="end" font-weight="600" fill="#fff" style="fill:#fff">Neutrons <tspan class="n" style="fill:#fff">${n}</tspan>%</text></svg>`;
}

const CSA_SRC = (b) => ({ label: "CSA Radi-N2", title: "Canadian neutron measurements on the ISS",
  body: `Radi-N and Radi-N2 bubble detectors (Bubble Technology Industries, Chalk River, Ontario) measured neutron dose on the ISS during the missions of Robert Thirsk, Chris Hadfield and David Saint-Jacques. ${b.sessions} week-long sessions, ${b.first} to ${b.last}: ${Math.round(b.neutron_msv_per_day * 1000)} µSv/day on average (range ${b.range_usv_per_day[0]}–${b.range_usv_per_day[1]}). Dataset released by the CSA for the 2019 Space Apps Challenge. ${b.added_to_total ? "Added to the DosTel dose, because silicon detectors mostly miss neutrons." : "The ISS total here is the published ~0.5 mSv/day, so the CSA data sets the neutron share."} Next: CSA's CANS will measure neutrons continuously.`,
  links: [{ t: "CSA: Radi-N2", u: "https://www.asc-csa.gc.ca/eng/sciences/radi-n2.asp" }, L.csa] });
function neutronCard(b) {
  if (!b.rows) return `<div class="chart"><div class="chart-head"><span>Today's dose by particle type (station)</span>${cite({ label: "CSA, 2026", title: "Neutron share of ISS radiation", body: "Neutrons make up about 30% of ISS radiation and need their own detectors, such as CSA's CANS.", links: [L.csa] })}</div>${splitBar(b.neutrons_share)}</div>`;
  const mean = Math.round(b.neutron_msv_per_day * 1000);
  const groups = [];
  b.rows.forEach((x) => {
    let g = groups.find((y) => y.mission === x.mission);
    if (!g) groups.push(g = { mission: x.mission, experiment: x.experiment, rows: [] });
    g.rows.push(x);
  });
  return `<div class="chart neutron">
    <div class="chart-head"><span>Daily dose by particle type (station) · neutrons measured by Canadian detectors</span>${cite(CSA_SRC(b))}</div>
    ${splitBar(b.neutrons_share)}
    <div class="n-stats">
      <div class="n-stat"><span>Neutrons (CSA measured)</span><b>${mean}<span> µSv/day</span></b></div>
      <div class="n-stat"><span>Charged particles</span><b>${Math.round(b.charged_msv_per_day * 1000)}<span> µSv/day</span></b></div>
      <div class="n-stat"><span>Bubble-detector readings</span><b>${b.sessions}<span> · ${esc(b.first.slice(0, 4))}–${esc(b.last.slice(0, 4))}</span></b></div>
    </div>
    <p class="lab">Measured on three Canadian missions</p>
    <div class="n-missions">${groups.map((g) => neutronMission(g, mean)).join("")}</div>
    <span class="muted">Each dot is one week-long bubble-detector reading (hover for the date). Dashed line: average of all ${b.sessions} readings (${mean} µSv/day).</span>
  </div>`;
}

function neutronMission(g, mean) {
  const [who, exp] = g.mission.split(", ");
  const avg = Math.round(g.rows.reduce((s, x) => s + x.usv_per_day, 0) / g.rows.length);
  const years = [...new Set(g.rows.map((x) => x.start.slice(0, 4)))].join("–");
  const W = 700, H = 64, max = 250, X = (v) => 8 + (v / max) * (W - 16);
  const dots = g.rows.map((x, i) => `<circle cx="${X(x.usv_per_day).toFixed(1)}" cy="${20 + (i % 2 ? 6 : -6)}" r="9" fill="#393939" stroke="#fff" stroke-width="2"><title>Week of ${esc(x.start)}: ${x.usv_per_day} µSv/day</title></circle>`).join("");
  const ticks = [0, 100, 200].map((t) => `<text x="${X(t)}" y="${H - 2}" class="n" text-anchor="middle">${t}</text>`).join("");
  return `<div class="n-mission">
    <div class="n-who"><b>${esc(who)}</b><small>${esc(exp || "")} · ${esc(years)}</small></div>
    <div class="n-meta"><span class="n-chip">${esc(g.experiment)}</span><span>${g.rows.length} reading${g.rows.length > 1 ? "s" : ""}</span><span class="n-avg">${avg} µSv/day</span></div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(who)}: ${g.rows.length} weekly readings, average ${avg} microsieverts per day">
      <line x1="${X(0)}" x2="${X(max)}" y1="20" y2="20" stroke="var(--line-2)" stroke-width="2" stroke-linecap="round"/>
      <line x1="${X(mean)}" x2="${X(mean)}" y1="4" y2="36" stroke="var(--muted)" stroke-dasharray="3 3"/>
      ${dots}${ticks}</svg>
  </div>`;
}

// ---------- live counters ----------
setInterval(() => {
  const now = serverNow();
  tickClock();
  document.querySelectorAll("[data-countdown]").forEach((el) => { el.textContent = `${Math.max(0, Math.ceil(+el.dataset.countdown - now))} s`; });
  document.querySelectorAll("[data-left]").forEach((el) => { el.innerHTML = leftWords(+el.dataset.left - now); });
  document.querySelectorAll("[data-left-min]").forEach((el) => { el.textContent = pl(Math.max(0, Math.ceil((+el.dataset.leftMin - now) / 60)), "minute"); });
  document.querySelectorAll("[data-until]").forEach((el) => { el.textContent = untilWords(+el.dataset.until - now); });
  // the answer time passing changes the panel's wording
  if (ui.S && ui.S.heart && !ui.S.heart.quick_check && ui.me === "lena") renderPanel(ui.S);
}, 1000);

// ---------- events ----------
document.addEventListener("input", (e) => {
  const id = e.target.id || "";
  if (id === "reason" || id.startsWith("step-")) ui.drafts[id] = e.target.value;
  if (id === "sd-reason") $("sd-confirm").disabled = !e.target.value.trim();
});
document.addEventListener("focusout", () => setTimeout(() => { if (!typing() && ui.pending) { ui.pending = false; render(); } }, 0));
document.addEventListener("click", (e) => {
  const cb = e.target.closest(".cite");
  if (cb) { e.stopPropagation(); cb.getAttribute("aria-expanded") === "true" ? closeCite() : openCite(cb); return; }
  if (!e.target.closest("#cite-pop")) closeCite();
  const t = e.target.closest("button");
  if (!t) return;
  const d = t.dataset;
  if (t.id === "get-doctor") return post("get_doctor");
  if (t.id === "sos") return openSOS();
  if (t.id === "sos-confirm") { $("modal").hidden = true; return post("sos"); }
  if (t.id === "sd-cancel") { $("modal").hidden = true; return; }
  if (t.id === "sd-confirm") { const reason = $("sd-reason").value.trim(), outcome = $("sd-outcome") ? $("sd-outcome").value : "ended"; $("modal").hidden = true; return post("stand_down", { reason, outcome }); }
  if (t.id === "close-check") return closeCheck();
  if (d.openCheck !== undefined) return openCheck();
  if (d.act === "open_stand_down") return openStandDown();
  if (d.act === "change_answer") { post("change_answer"); return; }
  if (d.act) { if (d.act === "reset") { ui.autoOpened = {}; ui.seenSent = {}; } return post(d.act); }
  if (d.mode) return post("mode", { mode: d.mode });
  if (d.person) { ui.selPerson = d.person; if (ui.me === "sam") ui.tab = "doctor"; render(); return; }
  if (d.tab) { ui.tab = d.tab; render(); $("main").scrollTop = 0; return; }
  if (d.goto) { ui.tab = "health"; render(); const el = $(d.goto), m = $("main"); if (el) m.scrollTo({ top: el.getBoundingClientRect().top - m.getBoundingClientRect().top + m.scrollTop - 16, behavior: "smooth" }); return; }
  if (d.qc) return post("quick_check", { answer: d.qc });
  if (d.checkin) return post("checkin", { id: d.checkin });
  if (d.dismiss) return post("dismiss_advisory", { id: +d.dismiss, reason: d.reason });
  if (d.outcome) return post("set_outcome", { id: +d.outcome, outcome: d.value });
  if (d.decide) { const reason = ui.drafts.reason || ""; ui.drafts.reason = ""; return post("decide", { decision: d.decide, reason }); }
  if (d.respond) return post("respond", { status: d.respond });
  if (d.step) { const i = +d.step, result = ui.drafts[`step-${i}`] || "Done"; ui.drafts[`step-${i}`] = ""; return post("record_step", { index: i, result }); }
  if (d.spe) return post("spe_start", { event: d.spe });
});
function toggleDemo(open) {
  const d = $("demo"), show = open ?? d.hidden;
  d.hidden = !show;
  if (show) loadEvents();
}
document.addEventListener("keydown", (e) => {
  // Demo controls are hidden from the tablet: press D to open and close them (not while typing).
  const tag = (e.target.tagName || "").toLowerCase();
  if ((e.key === "d" || e.key === "D") && !e.ctrlKey && !e.metaKey && !e.altKey && !["input", "select", "textarea"].includes(tag)) { toggleDemo(); return; }
  if (e.key !== "Escape") return;
  closeCite();
  if (!$("modal").hidden) { $("modal").hidden = true; return; }
  if (ui.panelOpen) closeCheck();
  if (!$("demo").hidden) toggleDemo(false);
});
$("as-select").addEventListener("change", (e) => {
  ui.me = e.target.value; ui.tab = null; ui.panelKey = ""; closeCheck(true);
  history.replaceState(null, "", `?as=${ui.me}`); render();
});
addEventListener("resize", () => { drawCharts(); if (ui.panelOpen) placePanel(); });
(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => drawCharts());

poll().then(loadRad);
setInterval(poll, 1000);