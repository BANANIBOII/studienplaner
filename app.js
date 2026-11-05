// ============================================================
//  Studienplaner – Hauptprogramm
// ============================================================

const LS_KEY = "studienplaner-v1";
// Zeitraum und Höhe des Stundenplans im Reiter. Mit „automatisch“ richtet er sich nach den
// sichtbaren Terminen (früheste Stunde −30 Min, späteste Stunde +30 Min).
let START_MIN = 7 * 60;
let END_MIN = 20 * 60;
let HOUR_PX = 42;
let PX_PER_MIN = HOUR_PX / 60;
function visibleDates() {
  if (ui.view === "day") return [ui.dayDate];
  const mon = addDays(mondayOf(new Date()), ui.weekOffset * 7);
  const n = state.settings.weekend ? 7 : 5;
  return Array.from({ length: n }, (_, i) => iso(addDays(mon, i)));
}
function applyDayRange() {
  const s = state.settings;
  let start = (s.dayStart ?? 7) * 60;
  let end = (s.dayEnd ?? 20) * 60;
  if (s.autoRange) {
    const dates = visibleDates();
    const evs = state.events.filter((e) => dates.includes(e.date));
    if (evs.length) {
      start = Math.max(0, Math.min(...evs.map((e) => e.start)) - 30);
      end = Math.min(24 * 60, Math.max(...evs.map((e) => e.end)) + 30);
    }
  }
  START_MIN = start;
  END_MIN = end;
  HOUR_PX = ui.tab === "stundenplan" && planFitPx ? planFitPx : 42 * (s.zoomY || 1);
  PX_PER_MIN = HOUR_PX / 60;
  document.documentElement.style.setProperty("--hour-px", HOUR_PX + "px");
}
const gridHeight = () => (END_MIN - START_MIN) * PX_PER_MIN;
// Schriftfarbe, die auf dem Hintergrund gut lesbar ist (hell oder dunkel)
function textOn(hex) {
  const h = (hex || "#64748b").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16), g = parseInt(full.slice(2, 4), 16), b = parseInt(full.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 165 ? "#0a1414" : "#ffffff";
}
const SEMESTER_END = "2027-01-22";
const PALETTE = ["#2dd4bf", "#f59e0b", "#60a5fa", "#a78bfa", "#f472b6", "#34d399", "#fb923c", "#f87171"];
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WEEKDAYS_LONG = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const PRIO_ORDER = { hoch: 0, mittel: 1, niedrig: 2 };
const CAT_LABEL = { todo: "To-Do", abgabe: "Abgabe", klausur: "Klausur" };
const SWIPE_MIN_PX = 70;
const HISTORY_MAX = 20;
const TRASH_DAYS = 30;
const DEFAULT_DURATION = 60;
const PLAN_DEFAULTS = { grid: "", now: "", todo: "#60a5fa", abgabe: "#f59e0b", klausur: "#f43f5e" };

// Gerätespezifisch: bleibt im Browser dieses Geräts und geht NICHT in den Cloud-Abgleich
const DEVICE_LS = "studienplaner-device-v1";
const DEVICE_DEFAULTS = {
  dark: true, weekend: false, scrollbars: true, colors: { dark: {}, light: {} },
  themeMode: "", fontScale: 100, startTab: "dashboard",
  zoomY: 1, autoRange: false, dayStart: 7, dayEnd: 20,
  dash: { zoomY: 1, grid: "", now: "" },
  planLook: { grid: "", now: "" },
  navSide: "",
  checkSide: "left",
  layouts: {},
  cal: { style: "bar", w: 100, h: 100 },
};
const DEVICE_KEYS = Object.keys(DEVICE_DEFAULTS);

// Fertige Designs: Farben für Hell- und Dunkelmodus (gelten pro Gerät). Kategorie-Farben sind getrennt und gelten überall.
const BUILTIN_PRESETS = [
  { name: "Standard Türkis", colors: { dark: {}, light: {} } },
  { name: "Ozean", colors: {
      dark:  { accent: "#38bdf8", bg: "#07131f", card: "#0f2033", text: "#e0f2fe", muted: "#7c9bb5", now: "#fb7185", line: "#1b3349" },
      light: { accent: "#0369a1", bg: "#eef6fb", card: "#ffffff", text: "#0c2233", muted: "#5b7487", now: "#e11d48", line: "#d6e6f0" } } },
  { name: "Waldgrün", colors: {
      dark:  { accent: "#84cc16", bg: "#0c1409", card: "#141f11", text: "#ecfccb", muted: "#8a9f78", now: "#f97316", line: "#23321b" },
      light: { accent: "#4d7c0f", bg: "#f4f7ee", card: "#ffffff", text: "#1c2612", muted: "#6b7a58", now: "#ea580c", line: "#e1e8d6" } } },
  { name: "Sonnenuntergang", colors: {
      dark:  { accent: "#fb923c", bg: "#170c0a", card: "#24130f", text: "#fde8dc", muted: "#b08a7c", now: "#facc15", line: "#33201b" },
      light: { accent: "#c2410c", bg: "#fdf4ef", card: "#ffffff", text: "#2a140c", muted: "#8a6558", now: "#eab308", line: "#f0dfd6" } } },
  { name: "Nacht Lila", colors: {
      dark:  { accent: "#a78bfa", bg: "#0d0a18", card: "#17132a", text: "#ede9fe", muted: "#9488b8", now: "#f472b6", line: "#241e3d" },
      light: { accent: "#7c3aed", bg: "#f5f3ff", card: "#ffffff", text: "#1e1538", muted: "#6e6395", now: "#db2777", line: "#e4dff5" } } },
  { name: "Graphit", colors: {
      dark:  { accent: "#cbd5e1", bg: "#0b0d10", card: "#14171c", text: "#f1f5f9", muted: "#8b95a5", now: "#f87171", line: "#1f242c" },
      light: { accent: "#334155", bg: "#f4f5f7", card: "#ffffff", text: "#111827", muted: "#6b7280", now: "#dc2626", line: "#e5e7eb" } } },
  { name: "Kirsche", colors: {
      dark:  { accent: "#fb7185", bg: "#150a0e", card: "#22121a", text: "#ffe4e9", muted: "#b07d8c", now: "#fde047", line: "#321a24" },
      light: { accent: "#be123c", bg: "#fff1f4", card: "#ffffff", text: "#2a0c16", muted: "#8a5a68", now: "#ca8a04", line: "#f5d9e0" } } },
  { name: "Salbei & Sand", colors: {
      dark:  { accent: "#a3b18a", bg: "#11130e", card: "#1b1f16", text: "#eef0e6", muted: "#9ca38a", now: "#e76f51", line: "#262c1e" },
      light: { accent: "#588157", bg: "#f5f3ea", card: "#ffffff", text: "#2b2d21", muted: "#6f7460", now: "#bc4749", line: "#e3e0d2" } } },
  { name: "Blau Klassik", colors: {
      dark:  { accent: "#60a5fa", bg: "#0b1120", card: "#131c33", text: "#e2e8f0", muted: "#8093b3", now: "#f472b6", line: "#1e2a45" },
      light: { accent: "#2563eb", bg: "#f1f5fd", card: "#ffffff", text: "#0f172a", muted: "#64748b", now: "#e11d48", line: "#dde6f5" } } },
];

function applyPreset(pid) {
  const kind = pid[0];
  const key = pid.slice(2);
  const p = kind === "b" ? BUILTIN_PRESETS[Number(key)] : (state.settings.presets || []).find((x) => x.id === key);
  if (!p) return;
  state.settings.colors = JSON.parse(JSON.stringify(p.colors));
  commit();
}

// Vorschau eines Designs: kleine Karte im Hell- oder Dunkelmodus
function designPreview(colors, mode) {
  const c = { ...THEME_DEFAULTS[mode], ...((colors || {})[mode] || {}) };
  return `<div class="dprev" style="background:${c.bg}">
    <div class="dprev-card" style="background:${c.card};border-color:${c.line}">
      <span class="dprev-dot" style="background:${c.accent}"></span>
      <span class="dprev-bar" style="background:${c.text}"></span>
      <span class="dprev-bar short" style="background:${c.muted}"></span>
    </div></div>`;
}
const designIsActive = (colors) => {
  const cur = state.settings.colors || {};
  return ["dark", "light"].every((m) => JSON.stringify(cur[m] || {}) === JSON.stringify((colors || {})[m] || {}));
};
function activeDesignName() {
  const all = [...BUILTIN_PRESETS, ...(state.settings.presets || [])];
  const hit = all.find((p) => designIsActive(p.colors));
  return hit ? hit.name : "Eigenes Design";
}

// Karte in den Einstellungen: zeigt das aktuelle Design und öffnet die Auswahl
function viewDesignCard() {
  const c = themeColors();
  return `<div class="card"><h3>Design</h3>
    <div class="row" style="justify-content:space-between;gap:12px">
      <div class="grow"><b>${esc(activeDesignName())}</b><div class="muted">Gilt nur für dieses Gerät</div></div>
      <div class="dprev-mini" style="background:${c.bg}"><span style="background:${c.card}"></span><i style="background:${c.accent}"></i></div>
    </div>
    <div class="row" style="margin-top:12px"><button class="btn" data-act="designopen">Design anpassen</button></div>
  </div>`;
}

// Fenster mit allen Designs zum genauen Ansehen und Anwenden
function openDesignModal() {
  const mine = state.settings.presets || [];
  const row = (pid, name, colors, deletable) => `<div class="dcard ${designIsActive(colors) ? "on" : ""}">
    <div class="row" style="justify-content:space-between">
      <b class="grow">${esc(name)}</b>
      ${designIsActive(colors) ? `<span class="pill-topic">aktiv</span>` : ""}
    </div>
    <div class="dprev-pair">${designPreview(colors, "dark")}${designPreview(colors, "light")}</div>
    <div class="row" style="gap:6px;justify-content:flex-end;margin-top:8px">
      ${deletable ? `<button class="btn ghost" data-act="presetdel" data-pid="${pid}">Löschen</button>` : ""}
      <button class="btn" data-act="preset" data-pid="${pid}">Anwenden</button>
    </div>
  </div>`;
  openModal(`<h3>Design wählen</h3>
    <p class="muted" style="margin-top:0">Jedes Design hat eine helle und eine dunkle Variante. Die Auswahl gilt nur für dieses Gerät.</p>
    <div class="dgrid">
      ${BUILTIN_PRESETS.map((p, i) => row("b:" + i, p.name, p.colors, false)).join("")}
      ${mine.map((p) => row("u:" + p.id, p.name, p.colors, true)).join("")}
    </div>
    <div class="row" style="margin-top:14px;justify-content:space-between">
      <button class="btn ghost" data-act="presetsave">Aktuelles Design speichern</button>
      <button class="btn ghost" data-act="mclose">Schließen</button>
    </div>`);
}

// Eigene Karten im Dashboard (Verknüpfungen, Notizen)
// Meine Karten: jede Karte steht für sich (keine Rahmenkarte mehr), damit sie im Layout frei beweglich ist
function linkItemHTML(c) {
  const inner = `<b>${esc(c.title)}</b>${c.note ? `<span class="muted">${esc(c.note)}</span>` : ""}${c.url ? `<span class="muted" style="font-size:12px">↗ ${esc(c.url.replace(/^https?:\/\//, ""))}</span>` : ""}`;
  const main = c.url
    ? `<a class="linkmain" href="${esc(c.url)}" target="_blank" rel="noopener">${inner}</a>`
    : `<div class="linkmain">${inner}</div>`;
  return `<div class="linkcard" style="border-color:${c.color || "var(--accent)"}">
    ${main}
    <div class="row" style="gap:4px;justify-content:flex-end"><button class="btn ghost" data-act="cardedit" data-id="${c.id}">✎</button></div>
  </div>`;
}
// Ohne Bearbeitungsmodus: einfache Reihe der Karten
function linksFlow() {
  const cards = state.cards || [];
  return `<div class="linkgrid">${cards.map(linkItemHTML).join("")}</div>`;
}
// Im Layout: jede Karte als eigene Kachel
function linksItems() {
  return (state.cards || []).map((c) => ({ id: "card-" + c.id, w: 3, h: 3, html: linkItemHTML(c) }));
}

function openCardModal(id) {
  const c = id ? state.cards.find((x) => x.id === id) : null;
  openModal(`<h3>${c ? "Karte bearbeiten" : "Neue Karte"}</h3>
    <form data-form="card">
      <input type="hidden" name="id" value="${c ? c.id : ""}">
      <label class="muted">Titel</label>
      <input name="title" required value="${esc(c ? c.title : "")}">
      <label class="muted">Link (optional)</label>
      <input name="url" placeholder="z. B. moodle.th-nuernberg.de" value="${esc(c ? c.url : "")}">
      <label class="muted">Notiz (optional)</label>
      <input name="note" value="${esc(c ? c.note : "")}">
      <label class="muted">Farbe</label>
      <input type="color" name="color" value="${c && c.color ? c.color : themeColors().accent}">
      <div class="row" style="margin-top:14px">
        <button class="btn">Speichern</button>
        ${c ? `<button type="button" class="btn danger" data-act="carddel" data-id="${c.id}">Löschen</button>` : ""}
        <button type="button" class="btn ghost" data-act="mclose">Abbrechen</button>
      </div>
    </form>`);
}

const THEME_DEFAULTS = {
  dark:  { accent: "#2dd4bf", bg: "#0a1414", card: "#111c1d", text: "#e6f4f1", muted: "#8aa6a2", now: "#f43f5e", line: "#1e2d2e" },
  light: { accent: "#0f9d8a", bg: "#f2f7f6", card: "#ffffff", text: "#10201e", muted: "#6b807d", now: "#e11d48", line: "#e2ebe9" },
};
const THEME_LABELS = { accent: "Akzentfarbe", bg: "Hintergrund", card: "Kartenfarbe", text: "Textfarbe", now: "Rote Linie (Uhrzeit)" };

// ---------- Helfer ----------
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(x, -((x.getDay() + 6) % 7)); };
const fmtD = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
const fmtMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const enc = (s) => encodeURIComponent(s);
const dec = (s) => decodeURIComponent(s);
const byDateDesc = (a, b) => b.date.localeCompare(a.date);

function kwOf(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNr);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
}
const parityOf = (d) => (kwOf(d) % 2 === 0 ? "G" : "U");

// ---------- Daten ----------
function defaultState() {
  return {
    events: [],
    modules: {},
    todos: [],
    trash: [],
    history: [],
    future: [],
    cards: [],
    settings: { dark: true, weekend: false, semester: "WiSe 2026/27", colors: { dark: {}, light: {} }, plan: { ...PLAN_DEFAULTS }, presets: [], dayStart: 7, dayEnd: 20, zoomY: 1, autoRange: false, dash: { zoomY: 1, grid: "", now: "" } },
    updatedAt: 0,
  };
}
// Gerätespezifische Werte aus dem Browser lesen und in die Einstellungen übernehmen
function readDeviceRaw() {
  try { return JSON.parse(localStorage.getItem(DEVICE_LS)); } catch { return null; }
}
function applyDevice(settings) {
  const raw = readDeviceRaw();
  if (!raw) return settings; // Noch kein Gerätestand: vorhandene Werte bleiben, werden beim ersten Speichern übernommen
  const d = { ...DEVICE_DEFAULTS, ...raw };
  DEVICE_KEYS.forEach((k) => { if (k !== "planLook") settings[k] = JSON.parse(JSON.stringify(d[k])); });
  settings.colors = { dark: {}, light: {}, ...d.colors };
  settings.dash = { ...DEVICE_DEFAULTS.dash, ...d.dash };
  settings.cal = { ...DEVICE_DEFAULTS.cal, ...d.cal };
  settings.plan = { ...(settings.plan || PLAN_DEFAULTS), grid: d.planLook.grid || "", now: d.planLook.now || "" };
  return settings;
}
function deviceFromSettings(s) {
  return {
    dark: s.dark, weekend: s.weekend, colors: s.colors, zoomY: s.zoomY, autoRange: s.autoRange,
    dayStart: s.dayStart, dayEnd: s.dayEnd, dash: s.dash, navSide: s.navSide || "", checkSide: s.checkSide || "left", scrollbars: s.scrollbars !== false, themeMode: s.themeMode || "", fontScale: s.fontScale || 100, startTab: s.startTab || "dashboard", layouts: s.layouts || {}, cal: s.cal || DEVICE_DEFAULTS.cal,
    planLook: { grid: (s.plan && s.plan.grid) || "", now: (s.plan && s.plan.now) || "" },
  };
}
function saveDevice() {
  try { localStorage.setItem(DEVICE_LS, JSON.stringify(deviceFromSettings(state.settings))); } catch {}
}
// Nur der Teil, der zwischen Geräten abgeglichen wird
function syncable(s) {
  const settings = { ...s.settings };
  DEVICE_KEYS.forEach((k) => delete settings[k]);
  if (settings.plan) {
    const { grid, now, ...pl } = settings.plan;
    settings.plan = pl;
  }
  return { ...s, settings };
}

function normalize(s) {
  const d = defaultState();
  const sett = s.settings || {};
  const out = {
    ...d, ...s,
    settings: {
      ...d.settings, ...sett,
      colors: { ...d.settings.colors, ...(sett.colors || {}) },
      plan: { ...PLAN_DEFAULTS, ...(sett.plan || {}) },
    },
  };
  applyDevice(out.settings);
  out.trash = (out.trash || []).filter((x) => x.deletedAt >= Date.now() - TRASH_DAYS * 86400000);
  out.history = out.history || [];
  out.cards = out.cards || [];
  out.future = out.future || [];
  out.settings.presets = out.settings.presets || [];
  for (const m of Object.values(out.modules)) {
    m.topics = m.topics || [];
    m.notes = m.notes || [];
    delete m.checklist;
    // Altes getrenntes Feld „noch zu lernen“ wird in den Notiztext übernommen
    m.notes.forEach((n) => {
      if (n.todo) {
        n.done = [n.done, n.todo].filter(Boolean).join("\n\n");
        n.todo = "";
      }
    });
  }
  return out;
}
function loadLocal() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY));
    return s ? normalize(s) : defaultState();
  } catch { return defaultState(); }
}
let state = loadLocal();
const saveLocal = () => localStorage.setItem(LS_KEY, JSON.stringify(state));

// Verlauf für Rückgängig: Momentaufnahme ohne Verlauf und Zeitstempel
const snapshot = () => JSON.stringify({ ...syncable(state), history: undefined, future: undefined, updatedAt: undefined });
let lastSnap = snapshot();

// Hinweis, was geändert wurde, und in welchem Reiter das war (für Rückgängig)
let histMeta = [], futMeta = [], layHist = [];
function diffLabel(prevStr, curStr) {
  let a, b;
  try { a = JSON.parse(prevStr); b = JSON.parse(curStr); } catch { return "Änderung"; }
  for (const [k, noun] of [["todos", "Aufgabe"], ["events", "Termin"], ["cards", "Karte"]]) {
    const x = a[k] || [], y = b[k] || [];
    if (x.length > y.length) return `${noun} gelöscht`;
    if (x.length < y.length) return `${noun} hinzugefügt`;
    const i = x.findIndex((t, j) => JSON.stringify(t) !== JSON.stringify(y[j]));
    if (i >= 0) {
      if (k === "todos" && x[i].done !== y[i].done) return `${y[i].done ? "Aufgabe erledigt" : "Aufgabe wieder offen"}: ${y[i].title}`;
      return `${noun} geändert${y[i].title ? ": " + y[i].title : ""}`;
    }
  }
  const ma = Object.keys(a.modules || {}), mb = Object.keys(b.modules || {});
  if (ma.length !== mb.length) return ma.length > mb.length ? "Protokoll gelöscht" : "Protokoll angelegt";
  const na = ma.reduce((n, m) => n + (a.modules[m].notes || []).length, 0);
  const nb = mb.reduce((n, m) => n + (b.modules[m].notes || []).length, 0);
  if (na !== nb) return na > nb ? "Protokoll-Eintrag gelöscht" : "Protokoll-Eintrag hinzugefügt";
  return "Änderung";
}
function pushLayHist(label) {
  layHist = [...layHist, { ts: Date.now(), label, tab: ui.tab, modOpen: ui.modOpen || null, prev: JSON.stringify(state.settings.layouts || {}) }].slice(-HISTORY_MAX);
}
function commit() {
  saveDevice();
  const snap = snapshot();
  if (lastSnap !== snap) {
    histMeta = [...histMeta, { label: diffLabel(lastSnap, snap), tab: ui.tab, modOpen: ui.modOpen || null, ts: Date.now() }].slice(-HISTORY_MAX);
    futMeta = [];
    state.history = [...(state.history || []), lastSnap].slice(-HISTORY_MAX);
    state.future = [];
    lastSnap = snap;
    state.updatedAt = Date.now();
    saveLocal();
    scheduleCloud();
  } else {
    saveLocal();
  }
  render();
}

function undo() {
  // Zuletzt geändert: Layout oder Daten?
  const lastLay = layHist[layHist.length - 1];
  const lastData = histMeta[histMeta.length - 1];
  if (lastLay && (!lastData || lastLay.ts >= lastData.ts)) {
    layHist = layHist.slice(0, -1);
    state.settings.layouts = JSON.parse(lastLay.prev);
    saveDevice();
    ui.tab = lastLay.tab || ui.tab;
    ui.modOpen = lastLay.modOpen;
    showToast(`Rückgängig: ${lastLay.label}`);
    render();
    return;
  }
  const hist = state.history || [];
  if (!hist.length) return;
  const fut = [...(state.future || []), lastSnap].slice(-HISTORY_MAX);
  const prev = hist[hist.length - 1];
  const meta = lastData;
  if (meta) {
    histMeta = histMeta.slice(0, -1);
    futMeta = [...futMeta, meta];
    ui.tab = meta.tab || ui.tab;
    ui.modOpen = meta.modOpen;
    showToast(`Rückgängig: ${meta.label}<small>Zu: ${TAB_NAMES[ui.tab] || ui.tab}</small>`, 9000);
  }
  state = normalize(JSON.parse(prev));
  state.history = hist.slice(0, -1);
  state.future = fut;
  state.updatedAt = Date.now();
  lastSnap = snapshot();
  saveLocal();
  scheduleCloud();
  render();
}

function redo() {
  const fut = state.future || [];
  if (!fut.length) return;
  const hist = [...(state.history || []), lastSnap].slice(-HISTORY_MAX);
  const next = fut[fut.length - 1];
  const m = futMeta[futMeta.length - 1];
  if (m) { futMeta = futMeta.slice(0, -1); histMeta = [...histMeta, m]; }
  state = normalize(JSON.parse(next));
  state.history = hist;
  state.future = fut.slice(0, -1);
  state.updatedAt = Date.now();
  lastSnap = snapshot();
  saveLocal();
  scheduleCloud();
  render();
}

// Papierkorb
function trashAdd(type, data, extra) {
  state.trash = [...(state.trash || []), { id: uid(), type, data, extra: extra || null, deletedAt: Date.now() }];
}
function trashedModuleNames() {
  return new Set((state.trash || []).filter((x) => x.type === "module").map((x) => x.extra.name));
}
function restoreTrash(id) {
  const it = state.trash.find((x) => x.id === id);
  if (!it) return;
  const d = it.data;
  switch (it.type) {
    case "todo": state.todos.push(d); break;
    case "card": state.cards.push(d); break;
    case "event": state.events.push(d); break;
    case "note": ensureModule(it.extra.module).notes.push(d); break;
    case "topic": {
      const mod = ensureModule(it.extra.module);
      mod.topics.push(d.topic);
      (d.noteIds || []).forEach((nid) => {
        const n = mod.notes.find((x) => x.id === nid);
        if (n) n.topicId = d.topic.id;
      });
      break;
    }
    case "module": {
      const name = it.extra.name;
      if (state.modules[name]) {
        state.modules[name].topics = [...state.modules[name].topics, ...d.topics];
        state.modules[name].notes = [...state.modules[name].notes, ...d.notes];
      } else {
        state.modules[name] = d;
      }
      break;
    }
  }
  state.trash = state.trash.filter((x) => x.id !== id);
  commit();
}
function purgeTrash(id) {
  state.trash = state.trash.filter((x) => x.id !== id);
  commit();
}
const trashLabel = (it) => {
  switch (it.type) {
    case "todo": return `${CAT_LABEL[it.data.type] || "To-Do"}: ${it.data.title}`;
    case "event": return `Termin: ${it.data.name}`;
    case "note": return `Eintrag (${it.extra.module})`;
    case "topic": return `Thema: ${it.data.topic.title} (${it.extra.module})`;
    case "module": return `Protokoll: ${it.extra.name}`;
    case "card": return `Karte: ${it.data.title}`;
  }
  return "Eintrag";
};

function ensureModule(name) {
  if (!state.modules[name]) {
    state.modules[name] = {
      color: PALETTE[Object.keys(state.modules).length % PALETTE.length],
      topics: [],
      notes: [],
    };
  }
  return state.modules[name];
}
const colorOf = (name) => (state.modules[name] ? state.modules[name].color : "#64748b");
const topicOf = (m, id) => m.topics.find((t) => t.id === id);
const catColor = (type) => state.settings.plan[type] || PLAN_DEFAULTS[type];
const canCheck = (t) => t.type !== "klausur" || (!!t.date && t.date <= iso(new Date()));
const moduleHasEvents = (name) => state.events.some((e) => e.name === name);

// ---------- Oberfläche-Zustand ----------
const ui = {
  tab: "dashboard",
  view: "week",
  weekOffset: 0,
  dayDate: iso(new Date()),
  anim: null,
  month: new Date(),
  selDate: iso(new Date()),
  modOpen: null,
  topicOpen: null,
  modSearch: "",
  calSearch: "",
  calFilterOpen: false,
  dayPop: null,
  calFrom: "", calTo: "", calType: "", calMod: "",
  rueckRange: "woche",
  calFilter: "alle",
  modKind: "alle",
  calShowDone: false,
  dashNext: null,
  layEdit: false,
  showHidden: false,
  noteFor: null,
  editNote: null,
  noteWindow: false,
  dashNoteDismissed: false,
};

// ---------- Farben / Design ----------
function currentMode() {
  if (state.settings.themeMode === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return state.settings.dark ? "dark" : "light";
}
function themeColors() {
  const mode = currentMode();
  return { ...THEME_DEFAULTS[mode], ...((state.settings.colors || {})[mode] || {}) };
}
function applyTheme() {
  document.body.classList.toggle("dark", currentMode() === "dark");
  document.body.style.zoom = String((state.settings.fontScale || 100) / 100);
  // Farbe der Statusleiste am Handy an den aktuellen Hintergrund anpassen
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.setAttribute("content", currentMode() === "dark" ? "#0a1414" : "#eef2f7");
  document.body.classList.toggle("nav-left", state.settings.navSide === "left");
  document.body.classList.toggle("nav-bottom", state.settings.navSide === "bottom");
  document.body.classList.toggle("check-right", state.settings.checkSide === "right");
  document.body.classList.toggle("no-scrollbars", state.settings.scrollbars === false);
  const c = themeColors();
  const r = document.documentElement.style;
  r.setProperty("--accent", c.accent);
  r.setProperty("--bg", c.bg);
  r.setProperty("--card", c.card);
  r.setProperty("--text", c.text);
  r.setProperty("--muted", c.muted);
  r.setProperty("--now", c.now);
  r.setProperty("--line", c.line);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", c.bg);
}

// ---------- Stundenplan: ICS einlesen ----------
function unfoldAndSplit(text) { return text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/); }
function parseICSDate(v) {
  const m = v && v.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  if (!m) return null;
  return { date: `${m[1]}-${m[2]}-${m[3]}`, min: Number(m[4]) * 60 + Number(m[5]) };
}
const unescapeICS = (s) => (s || "").replace(/\\n/g, "\n").replace(/\\([,;\\])/g, "$1");

function parseICS(text) {
  const out = [];
  let cur = null;
  for (const line of unfoldAndSplit(text)) {
    if (line === "BEGIN:VEVENT") { cur = {}; continue; }
    if (line === "END:VEVENT") { if (cur) out.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    cur[line.slice(0, i).split(";")[0]] = line.slice(i + 1);
  }
  return out.map((e) => {
    const s = parseICSDate(e.DTSTART);
    const en = parseICSDate(e.DTEND);
    if (!s || !en) return null;
    return {
      id: uid(),
      name: unescapeICS(e.SUMMARY) || "Ohne Titel",
      date: s.date, start: s.min, end: en.min,
      room: unescapeICS(e.LOCATION),
      desc: unescapeICS(e.DESCRIPTION),
    };
  }).filter(Boolean);
}

// Überlappende Termine nebeneinander anordnen
function layout(items) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const groups = [];
  let group = [];
  let groupEnd = -1;
  for (const e of sorted) {
    if (group.length && e.start >= groupEnd) { groups.push(group); group = []; groupEnd = -1; }
    group.push(e);
    groupEnd = Math.max(groupEnd, e.end);
  }
  if (group.length) groups.push(group);
  for (const g of groups) {
    const cols = [];
    for (const e of g) {
      let placed = false;
      for (let i = 0; i < cols.length; i++) {
        if (cols[i] <= e.start) { cols[i] = e.end; e._col = i; placed = true; break; }
      }
      if (!placed) { cols.push(e.end); e._col = cols.length - 1; }
    }
    g.forEach((e) => (e._cols = cols.length));
  }
  return sorted;
}

// Serientermine erzeugen (einmalig, jede Woche, nur G, nur U)
function seriesDates(first, repeat, until) {
  if (repeat === "once") return [first];
  const out = [];
  const end = parseIso(until || SEMESTER_END);
  let d = parseIso(first);
  while (d <= end && out.length < 60) {
    const k = kwOf(d) % 2;
    if (repeat === "weekly" || (repeat === "G" && k === 0) || (repeat === "U" && k === 1)) out.push(iso(d));
    d = addDays(d, 7);
  }
  return out;
}

// ---------- Render ----------
function render() {
  applyTheme();
  applyDayRange();
  // Mit Cloud-Sync: ohne Anmeldung sieht man nur das Login-Fenster
  const locked = cloudConfigured() && (!authChecked || !session);
  document.body.classList.toggle("locked", locked);
  if (locked) {
    document.getElementById("app").innerHTML = authChecked ? loginScreen() : "";
    ui.anim = null;
    return;
  }
  document.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === ui.tab));
  document.querySelectorAll('[data-act="undo"]').forEach((b) => (b.disabled = !((state.history || []).length || layHist.length)));
  document.querySelectorAll('[data-act="redo"]').forEach((b) => (b.disabled = !(state.future || []).length));
  const views = {
    dashboard: viewDashboard,
    stundenplan: viewPlan,
    kalender: viewCal,
    protokolle: viewModules,
    einstellungen: viewSettings,
  };
  const appEl = document.getElementById("app");
  const tabOrder = ["dashboard", "stundenplan", "kalender", "protokolle", "einstellungen"];
  const prevTab = appEl.dataset.shownTab;
  const tabChanged = prevTab !== ui.tab;
  const dir = tabOrder.indexOf(ui.tab) >= tabOrder.indexOf(prevTab) ? "dir-fwd" : "dir-back";
  appEl.innerHTML = (ui.layEdit ? layBarHTML() : "") + views[ui.tab]();
  appEl.dataset.shownTab = ui.tab;
  // Einblenden nur beim Wechsel des Reiters, nicht bei jedem Haken oder Klick
  if (tabChanged) {
    appEl.classList.remove("dir-fwd", "dir-back");
    appEl.classList.add("tab-in", dir);
    clearTimeout(appEl._tabIn);
    appEl._tabIn = setTimeout(() => appEl.classList.remove("tab-in", "dir-fwd", "dir-back"), 480);
  }
  document.querySelectorAll(".lay-btn").forEach((b) => b.classList.toggle("on", ui.layEdit));
  if (ui.tab === "dashboard") loadMensa(false);
  if (ui.dayPop) openDayModal(ui.dayPop);
  if (ui.tab === "stundenplan" && !ui.layEdit) fitPlan();
  // Stundenplan: Eintragskarte als eigenes Fenster
  if (ui.tab === "stundenplan" && ui.noteFor && ui.noteWindow) openModal(notePanelHTML(ui.noteFor.name, ui.noteFor.date));
  ui.anim = null;
}

// ---------- Dashboard ----------
function todoSort(a, b) {
  const da = a.date || "9999-99-99";
  const db = b.date || "9999-99-99";
  if (da !== db) return da.localeCompare(db);
  return (PRIO_ORDER[a.priority] ?? 1) - (PRIO_ORDER[b.priority] ?? 1);
}

// Begrüßung: passt sich Tageszeit, laufender/nächster Vorlesung und offenen Aufgaben an (locker)
function greetingInfo(now) {
  const today = iso(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const hour = now.getHours();
  const hi = hour < 11 ? "Guten Morgen!" : hour < 17 ? "Hallo!" : "Guten Abend!";
  const todays = state.events.filter((e) => e.date === today).sort((a, b) => a.start - b.start);
  const running = todays.find((e) => e.start <= nowMin && nowMin < e.end);
  const upcoming = todays.filter((e) => e.start > nowMin);
  const upcomingNames = [...new Set(upcoming.map((e) => e.name))].filter((n) => !running || n !== running.name);
  const todayOpen = state.todos.filter((t) => !t.done && t.date === today);
  const weekEnd = iso(addDays(mondayOf(now), 6));
  const week = state.todos.filter((t) => !t.done && t.date && t.date >= today && t.date <= weekEnd).sort(todoSort);

  let title;
  if (running) title = `Du bist mitten in der Vorlesung.`;
  else if (upcoming.length) title = `Noch ${upcoming.length === 1 ? "eine Vorlesung" : upcoming.length + " Vorlesungen"}, dann bist du durch.`;
  else if (todayOpen.length) title = "Heute ist nur noch etwas offen.";
  else title = "Für heute fertig.";

  const lines = [];
  if (running) lines.push(`Gerade dran: <b>${esc(running.name)}</b>.`);
  if (upcoming.length) lines.push(`Als Nächstes: <b>${esc(upcoming[0].name)}</b> um ${fmtMin(upcoming[0].start)}.`);
  if (upcomingNames.length >= 2) lines.push(`Es stehen noch ${upcomingNames.length} Module für heute an.`);
  if (week.length) {
    const t = week[0];
    const when = t.date === today ? "heute" : `am ${WEEKDAYS_LONG[(parseIso(t.date).getDay() + 6) % 7]}`;
    lines.push(`Vergiss nicht: <b>${esc(t.title)}</b> ${when}${week.length > 1 ? ` (und ${week.length - 1} weitere diese Woche)` : ""}.`);
  }
  return { hi, title, lines };
}

// Nächster Tag für das Dashboard: nächster Werktag (Wochenende nur, wenn es eingeblendet ist)
function nextWorkday(from) {
  let d = addDays(from, 1);
  while (!state.settings.weekend && (d.getDay() === 0 || d.getDay() === 6)) d = addDays(d, 1);
  return d;
}
// Welcher Tag im Dashboard-Stundenplan gezeigt wird. Ein Wechsel gilt nur für heute und endet um Mitternacht.
function dashDay(now) {
  if (ui.dashNext && ui.dashNext.stamp === iso(now)) return parseIso(ui.dashNext.date);
  return now;
}
// Knopf „Nächster Tag“: erscheint, wenn heute keine Termine mehr anstehen
function dashDayButton(now) {
  const day = dashDay(now);
  if (iso(day) !== iso(now)) return `<div class="row" style="margin-top:10px"><button class="btn ghost" data-act="dashtoday">‹ Zurück zu heute</button></div>`;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const remaining = state.events.some((e) => e.date === iso(now) && e.end > nowMin);
  if (remaining) return "";
  return `<div class="row" style="margin-top:10px"><button class="btn ghost" data-act="dashnext">Nächster Tag: ${WEEKDAYS_LONG[(nextWorkday(now).getDay() + 6) % 7]} ▸</button></div>`;
}

function viewDashboard() {
  const now = new Date();
  const today = iso(now);
  const todays = layout(state.events.filter((e) => e.date === today).map((e) => ({ ...e })));
  // Offen und fällig bis Sonntag dieser Woche (überfällige eingeschlossen), ohne Datum nicht
  const weekEnd = iso(addDays(mondayOf(now), 6));
  const open = state.todos.filter((t) => !t.done && t.date && t.date <= weekEnd).sort(todoSort);

  const greet = greetingInfo(now);
  let h = `<div class="hero">
    <div class="date">${WEEKDAYS_LONG[(now.getDay() + 6) % 7]}, ${now.getDate()}. ${MONTHS[now.getMonth()]}</div>
    <h2>${greet.hi} ${greet.title}</h2>
    ${greet.lines.map((l) => `<p>${l}</p>`).join("")}
  </div>`;

  // Karten: Stundenplan heute, To-Dos, Countdown, Links. Ohne Layout-Bearbeitung wie bisher.
  const planCard = `<div class="card">
      <div class="row" style="justify-content:space-between"><h3 style="margin:0">${iso(dashDay(now)) === iso(now) ? "Heute im Stundenplan" : "Stundenplan"}</h3>
        <button class="btn ghost menu-btn" data-act="dashmenu" title="Einstellungen">⋮</button></div>
      ${todayPlanHTML()}
      ${dashDayButton(now)}
      ${quickNoteHTML()}
      ${iso(dashDay(now)) === iso(now) ? tomorrowHTML() : ""}
    </div>`;
  const todoCard = `<div class="card todo-compact">
        <h3>Anstehende To-Dos · diese Woche</h3>
        <form data-form="quicktodo" class="row quick-row">
          <input name="title" required placeholder="Neue Aufgabe …" style="flex:1">
          <input type="date" name="date" value="${iso(new Date())}">
          <button class="btn">+</button>
        </form>
        ${open.length ? open.slice(0, 5).map(todoItem).join("") : `<div class="empty"><div class="ei">🎉</div>Diese Woche ist nichts offen.</div>`}
        ${open.length > 8 ? `<div class="muted" style="margin-top:10px">… und ${open.length - 8} weitere im Kalender.</div>` : ""}
      </div>`;
  const countCard = countdownBlock();
  const linksCard = linksFlow();
  const mensaCard = mensaCardHTML();
  const nextCard = nextDeadlineCard();
  const rueckCard = rueckblickCard();
  const flow = `<div style="margin-bottom:18px">${nextCard}</div><div class="dash-main">${planCard}<div class="dash-side">${todoCard}${countCard}</div></div><div style="margin-top:18px">${mensaCard}</div><div style="margin-top:18px">${rueckCard}</div><div style="margin-top:18px">${linksCard}</div>`;
  h += laid("dash", [
    { id: "plan", w: 7, h: 20, html: planCard },
    { id: "todo", w: 5, h: 12, html: todoCard },
    { id: "count", w: 5, h: 8, html: countCard },
    { id: "next", w: 12, h: 4, html: nextCard },
    { id: "mensa", w: 5, h: 8, html: mensaCard },
    { id: "rueck", w: 7, h: 8, html: rueckCard },
    ...linksItems(),
  ], flow);
  return h;
}

// Ausschnitt des heutigen Stundenplans: von jetzt (–30 Min) bis zum letzten Termin des Tages
// Ausschnitt des heutigen Stundenplans: von jetzt (–30 Min) bis zum letzten Termin des Tages.
// Eigene feste Größe, unabhängig von den Einstellungen im Stundenplan.
// Dashboard: kompletter Stundenplan für heute, eigene Einstellungen (state.settings.dash)
let PLAN_OVERRIDE = null;
// Dashboard: Stundenplan für heute, automatisch von 30 Min vor der ersten bis 30 Min nach der letzten Stunde.
// Eigene Streckung (state.settings.dash.zoomY), unabhängig vom Reiter Stundenplan.
function todayPlanHTML() {
  const now = new Date();
  const day = dashDay(now);
  const today = iso(day);
  const evs = state.events.filter((e) => e.date === today);
  if (!evs.length) return `<div class="empty"><div class="ei">☕</div>${today === iso(now) ? "Heute" : "An diesem Tag"} keine Termine.</div>`;
  const from = Math.max(0, Math.min(...evs.map((e) => e.start)) - 30);
  const to = Math.min(24 * 60, Math.max(...evs.map((e) => e.end)) + 30);
  const dash = state.settings.dash;
  const saved = [START_MIN, END_MIN, HOUR_PX, PX_PER_MIN, PLAN_OVERRIDE];
  START_MIN = from;
  END_MIN = to;
  HOUR_PX = 36 * (dash.zoomY || 1);
  PX_PER_MIN = HOUR_PX / 60;
  PLAN_OVERRIDE = { ...state.settings.plan, grid: dash.grid || "", now: dash.now || "" };
  try {
    const label = `<b>${WEEKDAYS_LONG[(day.getDay() + 6) % 7]}</b><small>${fmtD(day)}</small>`;
    return `<div class="week excerpt" style="--hour-px:${HOUR_PX}px">
      <div class="axis" style="height:${50 + gridHeight()}px">${axisHTML()}</div>
      ${dayColumn(today, label, false, now, true)}
    </div>`;
  } finally {
    [START_MIN, END_MIN, HOUR_PX, PX_PER_MIN, PLAN_OVERRIDE] = saved;
  }
}

function openDashMenu() {
  const d = state.settings.dash;
  const gridVal = d.grid || THEME_DEFAULTS[currentMode()].card;
  const nowVal = d.now || themeColors().now;
  const pct = Math.round((d.zoomY || 1) * 100);
  openModal(`
    <h3>Stundenplan im Dashboard</h3>
    <p class="muted" style="margin-top:0">Der Zeitraum passt sich automatisch dem heutigen Tag an (30 Min davor und danach). Gilt nur für das Dashboard.</p>
    <label class="muted">Höhe: ${pct} %</label>
    <input type="range" min="50" max="200" step="5" value="${pct}" data-dash-zoom="1">
    <label class="muted">Hintergrund</label>
    <input type="color" value="${gridVal}" data-dash-color="grid">
    <label class="muted">Linie (aktuelle Uhrzeit)</label>
    <input type="color" value="${nowVal}" data-dash-color="now">
    <div class="row" style="margin-top:14px">
      <button class="btn ghost" data-act="dashreset">Standard</button>
      <button class="btn" data-act="mclose">Fertig</button>
    </div>`);
}

// Schnellnotiz direkt im Dashboard: Vorlesung wählen, Text schreiben
// Dashboard: Notizfeld für das gerade laufende Fach (oder das angetippte Fach)
// Dashboard: Notizfeld für das laufende Fach, wieder schließbar
function quickNoteHTML() {
  if (ui.noteFor && !ui.noteWindow) return notePanelHTML(ui.noteFor.name, ui.noteFor.date);
  if (ui.dashNoteDismissed) return "";
  const now = new Date();
  const today = iso(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const running = state.events.find((e) => e.date === today && e.start <= nowMin && nowMin < e.end);
  if (!running) return "";
  return notePanelHTML(running.name, today);
}

// Inline-Notizfeld: Thema wählen, Text schreiben, Einträge des Tages abhaken oder ändern
// Notizfeld: Thema wählen (oder neues anlegen), Text schreiben, Einträge des Tages abhaken oder ändern
function notePanelHTML(name, date) {
  const m = state.modules[name];
  if (!m) return "";
  const dayNotes = m.notes.filter((x) => x.date === date).sort((a, b) => (a.created || 0) - (b.created || 0));
  const editing = dayNotes.find((x) => x.id === ui.editNote) || null;
  const topicOpts = `<option value="">— kein Thema —</option>` +
    m.topics.map((t) => `<option value="${t.id}" ${editing && editing.topicId === t.id ? "selected" : ""}>${esc(t.title)}</option>`).join("") +
    `<option value="__new">+ Neues Thema …</option>`;
  return `<div class="card notepanel" style="border-color:${m.color}">
    <div class="row" style="justify-content:space-between;align-items:flex-start">
      <div class="grow"><b style="font-size:15px">${esc(name)}</b><div class="muted">${fmtD(parseIso(date))}</div></div>
      <button class="btn ghost" data-act="gotoprot" data-m="${enc(name)}">Protokoll →</button>
      <button class="btn ghost" data-act="npclose" title="Schließen">✕</button>
    </div>
    <form data-form="notepanel" data-m="${enc(name)}" data-date="${date}" style="margin-top:10px">
      <input type="hidden" name="id" value="${editing ? editing.id : ""}">
      <select name="topic">${topicOpts}</select>
      <input name="newTopic" data-newtopic placeholder="Name des neuen Themas" style="display:none;margin-bottom:8px">
      <textarea name="text" rows="3" required placeholder="Was hast du gemacht? Was musst du noch lernen?">${esc(editing ? editing.done : "")}</textarea>
      <div class="row" style="justify-content:flex-end;gap:8px">
        ${editing ? `<button type="button" class="btn ghost" data-act="npcancel">Abbrechen</button>` : ""}
        <button class="btn">${editing ? "Ändern" : "Speichern"}</button>
      </div>
    </form>
    ${dayNotes.filter((x) => !editing || x.id !== editing.id).length ? `<div class="np-list">${dayNotes.filter((x) => !editing || x.id !== editing.id).map((x) => `<div class="np-entry">
        <input type="checkbox" class="note-check" data-act="ncheck" data-id="${x.id}" data-m="${enc(name)}" ${x.checked ? "checked" : ""}>
        <div class="grow ${x.checked ? "is-done" : ""}">${x.topicId && m.topics.find((t) => t.id === x.topicId) ? `<small class="pill-topic">${esc(m.topics.find((t) => t.id === x.topicId).title)}</small>` : ""}${esc(x.done)}</div>
        <button class="btn ghost" data-act="npedit" data-id="${x.id}" title="Bearbeiten">✎</button>
        <button class="btn ghost" data-act="npdelete" data-id="${x.id}" data-m="${enc(name)}" title="Löschen">🗑</button>
      </div>`).join("")}</div>` : ""}
  </div>`;
}

// Morgen auf einen Blick
function tomorrowHTML() {
  const t = addDays(new Date(), 1);
  const evs = state.events.filter((e) => e.date === iso(t)).sort((a, b) => a.start - b.start);
  const head = `<div class="muted" style="margin:14px 0 4px;font-weight:700">Morgen · ${WEEKDAYS_LONG[(t.getDay() + 6) % 7]}</div>`;
  if (!evs.length) return head + `<div class="muted">Keine Termine.</div>`;
  return head + evs.map((e) => `<div class="listrow">
      <span class="pdot" style="background:${colorOf(e.name)}"></span>
      <div class="grow"><b>${esc(e.name)}</b><div class="muted">${fmtMin(e.start)}–${fmtMin(e.end)}${e.room ? " · " + esc(e.room) : ""}</div></div>
    </div>`).join("");
}

// Countdown: je Kategorie die nächsten drei, nach kürzester Frist sortiert
function countdownBlock() {
  const today = iso(new Date());
  const groups = [["todo", "To-Dos"], ["abgabe", "Abgaben"], ["klausur", "Klausuren"]];
  const sortFn = (a, b) => (a.date || "9999").localeCompare(b.date || "9999");
  return `<div class="card"><h3>Countdown</h3>${groups.map(([type, label]) => {
    const items = state.todos
      .filter((t) => t.type === type && !t.done && (!t.date || t.date >= today))
      .sort(sortFn).slice(0, 3);
    return `<h4 style="color:${catColor(type)}">${label}</h4>` + (items.length
      ? items.map((t) => `<div class="listrow" data-lp="${t.id}">
          <span class="pdot" style="background:${catColor(type)}"></span>
          <div class="grow"><b>${esc(t.title)}</b><div class="muted">${t.date ? fmtD(parseIso(t.date)) + (t.time ? " · " + esc(t.time) : "") : "Termin folgt"}</div></div>
          <div style="font-weight:700;white-space:nowrap;color:${catColor(type)}">${t.date ? countdownText(t.date) : "–"}</div>
          <span class="prio ${t.priority || "mittel"}">${t.priority || "mittel"}</span>
          <button class="btn ghost" data-act="tedit" data-id="${t.id}" title="Bearbeiten">✎</button></div>`).join("")
      : `<div class="muted">Keine.</div>`);
  }).join("")}</div>`;
}

function todoItem(t) {
  const sub = CAT_LABEL[t.type] || "To-Do";
  const due = t.date ? ` · fällig ${fmtD(parseIso(t.date))}` : " · Termin folgt";
  const prio = t.priority || "mittel";
  return `<div class="item" data-lp="${t.id}">
    <input type="checkbox" data-act="tdone" data-id="${t.id}" ${canCheck(t) ? "" : "disabled"}>
    <div class="grow"><b>${esc(t.title)}</b><div class="muted">${sub}${due}${t.time ? " · " + esc(t.time) : ""}</div></div>
    <span class="prio ${prio}">${prio}</span>
    <button class="btn ghost" data-act="tedit" data-id="${t.id}" title="Bearbeiten">✎</button>
  </div>`;
}

// ---------- Stundenplan ----------
function axisHTML() {
  let out = "";
  for (let m = Math.ceil(START_MIN / 30) * 30; m <= END_MIN; m += 30) {
    const h = Math.floor(m / 60);
    const half = m % 60 === 30;
    const top = 50 + (m - START_MIN) * PX_PER_MIN - (half ? 4 : 8);
    out += `<div class="axis-h${half ? " half" : ""}" style="top:${top}px">${pad(h)}:${half ? "30" : "00"}</div>`;
  }
  return out;
}

function allDayHTML(dates, showDate) {
  const items = state.todos
    .filter((t) => t.date && dates.includes(t.date) && !t.time)
    .sort((a, b) => a.date.localeCompare(b.date) || (PRIO_ORDER[a.priority] ?? 1) - (PRIO_ORDER[b.priority] ?? 1));
  if (!items.length) return "";
  return `<div class="card allday">${items.map((t) => {
    const c = catColor(t.type);
    const label = showDate ? `${WEEKDAYS[(parseIso(t.date).getDay() + 6) % 7]} ${fmtD(parseIso(t.date))} · ` : "";
    const note = t.type === "klausur" && !canCheck(t) ? " · abhakbar am Prüfungstag" : "";
    return `<div class="chip ${t.type === "todo" ? "filled" : "outlined"}" data-drag="${t.id}" style="--c:${c}">
      <input type="checkbox" data-act="tdone" data-id="${t.id}" ${t.done ? "checked" : ""} ${canCheck(t) ? "" : "disabled"}>
      <div class="grow" data-act="tedit" data-id="${t.id}">
        <b class="${t.done ? "done-title" : ""}">${esc(t.title)}</b>
        <div class="muted">${label}${CAT_LABEL[t.type] || "To-Do"}${note}</div>
      </div>
      <button class="btn ghost" data-act="tedit" data-id="${t.id}">✎</button>
    </div>`;
  }).join("")}</div>`;
}

function timedTodoItems(k) {
  return state.todos
    .filter((t) => t.date === k && t.time)
    .map((t) => {
      const s = toMin(t.time);
      const dur = Number(t.duration) || DEFAULT_DURATION;
      return { id: t.id, kind: t.type, name: t.title, date: k, start: s, end: Math.min(s + dur, END_MIN) };
    })
    .filter((x) => x.start >= START_MIN && x.start < END_MIN);
}

function dayColumn(k, label, wide, today, noNav = false) {
  const isToday = k === iso(today);
  const evs = state.events.filter((e) => e.date === k).map((e) => ({ ...e, kind: "event" }));
  const clipped = [...evs, ...timedTodoItems(k)]
    .filter((x) => x.end > START_MIN && x.start < END_MIN)
    .map((x) => ({ ...x, start: Math.max(x.start, START_MIN), end: Math.min(x.end, END_MIN) }));
  const items = layout(clipped);
  const plan = PLAN_OVERRIDE || state.settings.plan;
  const blocks = items.map((it) => {
    const w = 100 / it._cols;
    const pos = `top:${(it.start - START_MIN) * PX_PER_MIN}px;height:${Math.max(26, (it.end - it.start) * PX_PER_MIN) - 2}px;left:calc(${it._col * w}% + 2px);width:calc(${w}% - 4px);`;
    if (it.kind === "event") {
      return `<div class="ev" data-act="note" data-kind="event" data-id="${it.id}" style="${pos}background:${colorOf(it.name)};color:${textOn(colorOf(it.name))}">
        <b>${esc(it.name)}</b><small>${fmtMin(it.start)}–${fmtMin(it.end)}</small><small>${esc(it.room)}</small></div>`;
    }
    const c = catColor(it.kind);
    if (it.kind === "todo") {
      return `<div class="ev block-todo" data-drag="${it.id}" data-act="tedit" data-id="${it.id}" style="${pos}background:color-mix(in srgb, ${c} 80%, transparent);border-left:4px solid ${c}">
        <b>${esc(it.name)}</b><small>${fmtMin(it.start)} · To-Do</small></div>`;
    }
    return `<div class="ev block-outline" data-drag="${it.id}" data-act="tedit" data-id="${it.id}" style="${pos}border:2px solid ${c};background:color-mix(in srgb, ${c} 10%, transparent)">
      <b>${esc(it.name)}</b><small>${fmtMin(it.start)} · ${CAT_LABEL[it.kind]}</small></div>`;
  }).join("");
  let now = "";
  if (isToday) {
    const t = new Date();
    const m = t.getHours() * 60 + t.getMinutes();
    if (m >= START_MIN && m <= END_MIN) {
      now = `<div class="nowline" style="top:${(m - START_MIN) * PX_PER_MIN}px;${plan.now ? `background:${plan.now};` : ""}"></div>`;
    }
  }
  const gridStyle = ` style="height:${gridHeight()}px;${plan.grid ? `background-color:${plan.grid};` : ""}"`;
  const headAct = noNav ? "" : (wide ? "toweek" : "dayopen");
  return `<div class="daycol${wide ? " wide" : ""}">
    <div class="dayhead ${isToday ? "today" : ""}" data-act="${headAct}" data-d="${k}">${label}</div>
    <div class="grid" data-date="${k}"${gridStyle}>${blocks}${now}</div></div>`;
}

function viewPlan() {
  const today = new Date();
  const animCls = ui.anim ? ` anim-${ui.anim}` : "";
  const menuBtn = `<button class="btn ghost" data-act="planmenu" title="Einstellungen">⋮</button>`;

  if (ui.view === "day") {
    const d = parseIso(ui.dayDate);
    const wd = WEEKDAYS_LONG[(d.getDay() + 6) % 7];
    return `${allDayHTML([ui.dayDate], false)}
    ${planNavHTML(`KW ${kwOf(d)} · ${fmtD(d)}`, "day")}
    <div class="${animCls}">${planLaid(`<div class="week"><div class="axis" style="height:${50 + gridHeight()}px">${axisHTML()}</div>${dayColumn(ui.dayDate, `<b class="daytitle">${wd}</b>`, true, today)}</div>`)}</div>${emptyPlanHint()}${planFabHTML()}`;
  }

  const mon = addDays(mondayOf(today), ui.weekOffset * 7);
  const sun = addDays(mon, 6);
  const dayCount = state.settings.weekend ? 7 : 5;
  const weekDates = Array.from({ length: 7 }, (_, i) => iso(addDays(mon, i)));
  let h = allDayHTML(weekDates, true);
  h += planNavHTML(`KW ${kwOf(mon)} (${parityOf(mon)}) · ${fmtD(mon)} – ${fmtD(sun)}`, "week");

  let cols = "";
  for (let i = 0; i < dayCount; i++) {
    const d = addDays(mon, i);
    cols += dayColumn(iso(d), `${WEEKDAYS[i]}<br>${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`, false, today);
  }
  h += `<div class="${animCls}">${planLaid(`<div class="week"><div class="axis" style="height:${50 + gridHeight()}px">${axisHTML()}</div>${cols}</div>`)}</div>${emptyPlanHint()}${planFabHTML()}`;
  return h;
}

// Leiste für den PC (am Handy wischt man), Knopf für die Einstellungen
function planNavHTML(label, view) {
  const prev = view === "week" ? `data-act="wk" data-v="-1"` : `data-act="dprev"`;
  const next = view === "week" ? `data-act="wk" data-v="1"` : `data-act="dnext"`;
  // Ein Knopf: in der Wochenansicht „Heute“, in der Tagesansicht „Woche“
  const toggle = view === "week"
    ? `<button class="btn ghost" data-act="wk" data-v="0">Heute</button>`
    : `<button class="btn ghost" data-act="planview">Woche</button>`;
  return `<div class="plan-nav">
    <button class="btn ghost" ${prev} title="Zurück">‹</button>
    <b>${label}</b>
    <button class="btn ghost" ${next} title="Weiter">›</button>
    ${toggle}
  </div>`;
}
function planFabHTML() {
  return `<button class="plan-fab" data-act="planmenu" title="Einstellungen">⋮</button>`;
}
// Wochen- und Tagesansicht umschalten (einmal antippen auf den Reiter oder den Knopf)
function planToggle() {
  if (ui.view === "week") { ui.view = "day"; ui.dayDate = iso(new Date()); ui.anim = null; render(); }
  else toWeekView();
}

function emptyPlanHint() {
  if (state.events.length) return "";
  return `<div class="card" style="margin-top:14px"><b>Noch kein Stundenplan geladen.</b><p class="muted">Gehe zu „Einstellungen“ und lade deine .ics-Datei hoch.</p></div>`;
}

function openPlanMenu() {
  const p = state.settings.plan;
  const s = state.settings;
  const gridVal = p.grid || THEME_DEFAULTS[currentMode()].card;
  const nowVal = p.now || themeColors().now;
  const opts = (from, to, sel) => {
    let o = "";
    for (let v = from; v <= to; v += 0.5) {
      o += `<option value="${v}" ${sel === v ? "selected" : ""}>${pad(Math.floor(v))}:${v % 1 ? "30" : "00"}</option>`;
    }
    return o;
  };
  openModal(`
    <h3>Stundenplan-Einstellungen</h3>
    <label class="row" style="margin-bottom:12px"><input type="checkbox" data-change="weekend" ${s.weekend ? "checked" : ""}> Samstag und Sonntag anzeigen</label>
    <label class="row" style="margin-bottom:12px"><input type="checkbox" data-change="autorange" ${s.autoRange ? "checked" : ""}> Zeitachse automatisch an Vorlesungen anpassen (30 Min davor und danach)</label>
    <label class="muted">Beginn</label>
    <select data-plan-range="dayStart" ${s.autoRange ? "disabled" : ""}>${opts(6, 11.5, s.dayStart)}</select>
    <label class="muted">Ende</label>
    <select data-plan-range="dayEnd" ${s.autoRange ? "disabled" : ""}>${opts(14, 23.5, s.dayEnd)}</select>
    <label class="muted">Höhe: ${Math.round(getZoom("plan") * 100)} %</label>
    <input type="range" min="50" max="200" step="5" value="${Math.round(getZoom("plan") * 100)}" data-plan-zoom>
    <p class="muted">Alternativ mit zwei Fingern zusammenziehen oder auseinanderziehen (am PC: Strg + Mausrad).</p>
    <label class="muted">Hintergrund des Stundenplans</label>
    <input type="color" value="${gridVal}" data-plan="grid">
    <label class="muted">Farbe der Linie (aktuelle Uhrzeit)</label>
    <input type="color" value="${nowVal}" data-plan="now">
    <div class="row" style="margin-top:14px">
      <button class="btn ghost" data-act="planreset">Standard</button>
      <button class="btn" data-act="mclose">Fertig</button>
    </div>`);
}

function navigate(dir) {
  if (ui.view === "day") ui.dayDate = iso(addDays(parseIso(ui.dayDate), dir));
  else ui.weekOffset += dir;
  ui.anim = dir > 0 ? "next" : "prev";
  render();
}

function toWeekView() {
  const diff = Math.round((mondayOf(parseIso(ui.dayDate)) - mondayOf(new Date())) / (7 * 86400000));
  ui.weekOffset = diff;
  ui.view = "week";
  render();
}

function openEventEdit(id) {
  const ev = state.events.find((x) => x.id === id);
  if (!ev) return;
  const mod = state.modules[ev.name];
  const color = mod ? mod.color : PALETTE[0];
  openModal(`
    <h3>Termin bearbeiten</h3>
    <form data-form="evedit" data-id="${ev.id}">
      <label class="muted">Titel (gilt für alle Termine dieser Vorlesung)</label>
      <input name="name" required value="${esc(ev.name)}">
      <div class="grid2">
        <div><label class="muted">Datum</label><input type="date" name="date" required value="${ev.date}"></div>
        <div><label class="muted">Raum</label><input name="room" value="${esc(ev.room)}"></div>
      </div>
      <div class="grid2">
        <div><label class="muted">Beginn</label><input type="time" name="start" required value="${fmtMin(ev.start)}"></div>
        <div><label class="muted">Ende</label><input type="time" name="end" required value="${fmtMin(ev.end)}"></div>
      </div>
      <label class="muted">Farbe</label>
      <input type="hidden" name="color" value="${color}">
      <div class="row" style="margin-bottom:8px"><span class="muted">Farbe wählen:</span><input type="color" id="evColorPick" value="${color}"></div>
      ${mod ? "" : `<label class="row" style="margin-top:12px"><input type="checkbox" name="protokoll"> Auch im Vorlesungs-Protokoll anlegen</label>`}
      <div class="sheet-actions">
        <button type="button" class="danger-text" data-act="evdelmenu" data-id="${ev.id}">Löschen</button>
        <div class="right">
          <button type="button" class="btn ghost" data-act="mclose">Abbrechen</button>
          <button class="btn">Speichern</button>
        </div>
      </div>
    </form>`);
}

// Auswahl beim Löschen eines Termins
function openDeleteChoice(id) {
  const ev = state.events.find((x) => x.id === id);
  if (!ev) return;
  openModal(`
    <h3>Termin löschen</h3>
    <p class="muted" style="margin-top:0">„${esc(ev.name)}“ am ${fmtD(parseIso(ev.date))}</p>
    <div class="choice-list">
      <button type="button" class="choice" data-act="evdel" data-id="${ev.id}">Nur diesen Termin</button>
      <button type="button" class="choice" data-act="evdelfuture" data-id="${ev.id}">Diesen und alle späteren</button>
      <button type="button" class="choice" data-act="evdelall" data-id="${ev.id}">Alle Termine dieser Vorlesung</button>
    </div>
    <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" data-act="mclose">Abbrechen</button></div>`);
}

function openEventCreate(date, startMin) {
  const endMin = Math.min(startMin + 90, END_MIN);
  openModal(`
    <h3>Neuer Termin</h3>
    <form data-form="evcreate">
      <label class="muted">Titel</label>
      <input name="name" required placeholder="z. B. Infoveranstaltung">
      <div class="grid2">
        <div><label class="muted">Datum</label><input type="date" name="date" required value="${date}"></div>
        <div><label class="muted">Raum (optional)</label><input name="room"></div>
      </div>
      <div class="grid2">
        <div><label class="muted">Beginn</label><input type="time" name="start" required value="${fmtMin(startMin)}"></div>
        <div><label class="muted">Ende</label><input type="time" name="end" required value="${fmtMin(endMin)}"></div>
      </div>
      <label class="muted">Wiederholung</label>
      <select name="repeat">
        <option value="once">Einmalig</option>
        <option value="weekly">Jede Woche</option>
        <option value="G">Nur an geraden KW (G)</option>
        <option value="U">Nur an ungeraden KW (U)</option>
      </select>
      <div id="untilWrap" style="display:none">
        <label class="muted">Bis</label>
        <input type="date" name="until" value="${SEMESTER_END}">
      </div>
      <label class="row" style="margin-top:12px"><input type="checkbox" name="protokoll"> Auch im Vorlesungs-Protokoll anlegen</label>
      <div class="row" style="margin-top:14px"><button class="btn">Speichern</button><button type="button" class="btn ghost" data-act="mclose">Abbrechen</button></div>
    </form>`);
}

// ---------- Kalender & To-Dos ----------
function countdownText(dateStr) {
  const days = Math.round((parseIso(dateStr) - parseIso(iso(new Date()))) / 86400000);
  if (days < 0) return "vorbei";
  if (days === 0) return "heute";
  if (days === 1) return "morgen";
  return `noch ${days} Tage`;
}

// Symbole für die Arten: Klausur = Dokument mit Stift, Abgabe = Dokument mit Haken, To-Do = abgerundetes Kästchen mit Haken
const TYPE_ICON_PATHS = {
  klausur: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M10 17l1.2-3.2 4.3-4.3 2 2-4.3 4.3z"/>',
  abgabe: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M9 15l2 2 4-4"/>',
  todo: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 12.5l3 3 5-6"/>',
};
function typeIcon(type, color, size = 14) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none">${TYPE_ICON_PATHS[type] || ""}</svg>`;
}
const shortTitle = (s) => (s.length > 11 ? s.slice(0, 10) + "…" : s);
const calSet = () => ({ ...DEVICE_DEFAULTS.cal, ...(state.settings.cal || {}) });

// Inhalt einer Tageszelle je nach gewählter Darstellung
function calCellInner(style, d, dayT, evCount) {
  const num = d.getDate();
  if (style === "bar") {
    return `<div class="mnum">${num}</div><div class="micons">${dayT.slice(0, 3).map((t) => typeIcon(t.type, catColor(t.type), 13)).join("")}${evCount ? `<span class="dot" style="background:var(--muted)"></span>` : ""}</div>`;
  }
  if (style === "ring") {
    const top = ["klausur", "abgabe", "todo"].find((ty) => dayT.some((t) => t.type === ty && !t.done));
    const ring = top ? catColor(top) : "var(--line)";
    return `<div class="mring" style="--ring:${ring}">${num}</div>${dayT.length ? `<div class="mcount">${dayT.length}</div>` : ""}${evCount ? `<span class="dot" style="background:var(--muted)"></span>` : ""}`;
  }
  // Pillen (Standard)
  return `<div class="mnum">${num}</div><div class="mpills">${dayT.slice(0, 2).map((t) => `<span class="mpill ${t.done ? "is-done" : ""}" style="--pc:${catColor(t.type)}">${typeIcon(t.type, catColor(t.type), 11)}<span>${esc(shortTitle(t.title))}</span></span>`).join("")}${dayT.length > 2 ? `<span class="mmore">+${dayT.length - 2}</span>` : ""}${evCount ? `<span class="dot" style="background:var(--muted)"></span>` : ""}</div>`;
}

// Inhalt eines Tages (Einträge, To-Dos, erledigte eingeklappt) — für das Tages-Fenster
function dayPanelHTML(date) {
  const doneBox = (list) => list.length ? `<details class="donebox"><summary>Erledigt (${list.length})</summary>${list.map(todoRow).join("")}</details>` : "";
  const dayAll = state.todos.filter((t) => t.date === date).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  const dayEvents = layout(state.events.filter((e) => e.date === date).map((e) => ({ ...e })));
  return `${dayEvents.map((e) => `<div class="listrow"><span class="pdot" style="background:${colorOf(e.name)}"></span><div class="grow"><b>${esc(e.name)}</b><div class="muted">${fmtMin(e.start)}–${fmtMin(e.end)} · ${esc(e.room)}</div></div></div>`).join("")}
    ${dayAll.filter((t) => !t.done).map(todoRow).join("")}
    ${!dayAll.length && !dayEvents.length ? `<div class="empty"><div class="ei">✨</div>Nichts an diesem Tag.</div>` : ""}
    ${doneBox(dayAll.filter((t) => t.done))}`;
}
// Tippen auf einen Tag: kleines Fenster mit den Einträgen dieses Tages
function openDayModal(date) {
  ui.selDate = date;
  openModal(`<div class="row" style="justify-content:space-between;margin-bottom:8px"><h3 style="margin:0">${fmtD(parseIso(date))}</h3>
      <button class="btn ghost" data-act="mclose" title="Schließen">✕</button></div>
    ${dayPanelHTML(date)}
    <div class="sheet-actions"><button class="btn ghost" data-act="daypopopen" data-d="${date}">Im Stundenplan</button>
      <div class="right"><button class="btn" data-act="tnew">+ Eintrag</button></div></div>`);
  ui.dayPop = date;
}

function viewCal() {
  const today = iso(new Date());
  const cal = calSet();
  const cq = (ui.calSearch || "").trim().toLowerCase();
  const filtering = !!(cq || ui.calFrom || ui.calTo || ui.calType || ui.calMod);
  const modNames = Object.keys(state.modules).sort((a, b) => a.localeCompare(b, "de"));
  const filterCount = [ui.calFrom, ui.calTo, ui.calType, ui.calMod].filter(Boolean).length;
  const filtersOpen = !!ui.calFilterOpen || filtering;

  // Suchleiste ganz unten. Die Filter erscheinen erst beim Antippen.
  const searchBar = `<div class="card calsearch">
    <div class="row" style="gap:8px">
      <input id="calSearch" placeholder="Suchen: Titel, Modul, Raum …" value="${esc(ui.calSearch || "")}" style="flex:1">
      <button class="btn ghost" data-act="calfiltertoggle">Filter${filterCount ? ` (${filterCount})` : ""}</button>
    </div>
    <div id="calFilters" class="calfilters${filtersOpen ? " open" : ""}">
      <label class="muted">Von <input type="date" data-sf="from" value="${ui.calFrom}"></label>
      <label class="muted">bis <input type="date" data-sf="to" value="${ui.calTo}"></label>
      <select data-sf="type">${[["", "Alle Arten"], ["todo", "Aufgaben"], ["abgabe", "Abgaben"], ["klausur", "Klausuren"], ["vorlesung", "Vorlesungen"]].map(([v, l]) => `<option value="${v}" ${ui.calType === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <select data-sf="mod"><option value="">Alle Module</option>${modNames.map((n) => `<option value="${esc(n)}" ${ui.calMod === n ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
      ${filtering ? `<button class="btn ghost" data-act="calsfreset">Zurücksetzen</button>` : ""}
    </div>
  </div>`;

  let h = `<h2 style="margin-bottom:14px">Kalender &amp; To-Dos</h2>`;
  if (filtering) {
    const inRange = (d) => (!ui.calFrom || (d && d >= ui.calFrom)) && (!ui.calTo || (d && d <= ui.calTo));
    const tOk = (t) => !ui.calMod && (!ui.calType || (ui.calType !== "vorlesung" && t.type === ui.calType));
    const eOk = (e) => (!ui.calType || ui.calType === "vorlesung") && (!ui.calMod || e.name === ui.calMod);
    const tHits = state.todos.filter((t) => tOk(t) && inRange(t.date) && (!cq || `${t.title} ${CAT_LABEL[t.type] || ""}`.toLowerCase().includes(cq))).sort(todoSort);
    const eHits = state.events.filter((e) => eOk(e) && inRange(e.date) && (!cq || `${e.name} ${e.room || ""}`.toLowerCase().includes(cq)))
      .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
    const hitRow = (dot, title, sub, attrs) => `<div class="listrow" ${attrs} style="cursor:pointer"><span class="pdot" style="background:${dot}"></span><div class="grow"><b>${esc(title)}</b><div class="muted">${sub}</div></div></div>`;
    const tRows = tHits.map((t) => hitRow(catColor(t.type), t.title, `${CAT_LABEL[t.type] || "To-Do"} · ${t.date ? fmtD(parseIso(t.date)) : "ohne Datum"}${t.time ? " · " + esc(t.time) : ""}`, `data-act="tedit" data-id="${t.id}"`));
    const eRows = eHits.map((e) => hitRow(colorOf(e.name), e.name, `Vorlesung · ${fmtD(parseIso(e.date))} · ${fmtMin(e.start)}${e.room ? " · " + esc(e.room) : ""}`, `data-act="calgo" data-d="${e.date}"`));
    const total = tRows.length + eRows.length;
    h += `<div class="card"><h4 style="margin-top:0">${total} Treffer</h4>${tRows.join("")}${eRows.join("")}${total ? "" : `<div class="empty"><div class="ei">🔍</div>Nichts gefunden.</div>`}</div>`;
    return h + searchBar;
  }

  // Links: Monat. Rechts: Tagesliste und Übersicht. Am Handy untereinander.
  const m = ui.month;
  const grid0 = mondayOf(new Date(m.getFullYear(), m.getMonth(), 1));
  let cells = WEEKDAYS.map((w) => `<div class="mwd">${w}</div>`).join("");
  for (let i = 0; i < 42; i++) {
    const d = addDays(grid0, i);
    const k = iso(d);
    const dayT = state.todos.filter((t) => t.date === k).sort((a, b) => Number(a.done) - Number(b.done));
    const evCount = state.events.filter((e) => e.date === k).length;
    const topType = ["klausur", "abgabe", "todo"].find((ty) => dayT.some((t) => t.type === ty && !t.done));
    const border = cal.style !== "ring" && topType ? `border-color:${catColor(topType)};` : "";
    const cls = ["mday", `style-${cal.style}`, d.getMonth() !== m.getMonth() ? "other" : "", k === today ? "today" : "", k === ui.selDate ? "sel" : ""].join(" ");
    cells += `<div class="${cls}" data-act="sel" data-d="${k}" style="${border}">${calCellInner(cal.style, d, dayT, evCount)}</div>`;
  }
  const monthCard = `<div class="card">
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <button class="btn ghost" data-act="mon" data-v="-1">‹</button>
      <b>${MONTHS[m.getMonth()]} ${m.getFullYear()}</b>
      <button class="btn ghost" data-act="mon" data-v="1">›</button>
    </div>
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <button class="btn ghost" data-act="calToday">Heute</button>
      <button class="btn ghost menu-btn" data-act="calmenu" title="Darstellung">⋮</button>
    </div>
    <div class="month">${cells}</div>
    <div class="muted" style="margin-top:10px">To-Do auf einen Tag ziehen, um das Datum zu ändern (Handy: kurz gedrückt halten)</div>
  </div>`;

  // Übersicht: alle To-Dos, Abgaben und Klausuren, filterbar
  const fType = ui.calFilter || "alle";
  const showDone = !!ui.calShowDone;
  const items = state.todos.filter((t) => (fType === "alle" || t.type === fType) && (showDone || !t.done)).sort(todoSort);
  const openCount = state.todos.filter((t) => !t.done).length;
  const chip = (v, label) => `<button class="btn ${fType === v ? "" : "ghost"}" data-act="calfilter" data-v="${v}">${label}</button>`;
  const types = fType === "alle" ? ["klausur", "abgabe", "todo"] : [fType];
  const body = types.map((ty) => {
    const arr = items.filter((t) => t.type === ty);
    return arr.length ? `<h4>${CAT_LABEL[ty] || ty}</h4>${arr.map(todoRow).join("")}` : "";
  }).join("");
  const allCard = `<div class="card">
    <div class="row" style="justify-content:space-between;margin-bottom:10px"><h3 style="margin:0">Alle Einträge</h3><span class="count">${openCount} offen</span></div>
    <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px">${chip("alle", "Alle")}${chip("klausur", "Klausuren")}${chip("abgabe", "Abgaben")}${chip("todo", "To-Dos")}</div>
    <label class="row" style="font-size:14px;margin-bottom:6px"><input type="checkbox" data-act="calshowdone" ${showDone ? "checked" : ""}> Erledigte zeigen</label>
    ${body || `<div class="empty"><div class="ei">✨</div>Nichts in dieser Auswahl.</div>`}
  </div>`;

  const calFlow = `<div class="calstack">${monthCard}${allCard}${searchBar}</div>`;
  h += laid("kal", [
    { id: "month", w: 12, h: 16, html: monthCard },
    { id: "all", w: 12, h: 14, html: allCard },
    { id: "search", w: 12, h: 4, html: searchBar },
  ], calFlow, `--calw:${cal.w};--calh:${cal.h}`);
  return h;
}
function openCalMenu() {
  const cal = calSet();
  const styleBtn = (v, label) => `<button class="btn ${cal.style === v ? "" : "ghost"}" data-act="calstyle" data-v="${v}">${label}</button>`;
  openModal(`<h3>Kalender-Darstellung</h3>
    <p class="muted" style="margin-top:0">Gilt nur für dieses Gerät.</p>
    <label class="muted">Termine in den Tagen</label>
    <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:10px">${styleBtn("pill", "Namen")}${styleBtn("bar", "Symbole")}${styleBtn("ring", "Ring")}</div>
    <label class="muted">Breite des Kalenders: ${cal.w} %</label>
    <input type="range" min="60" max="120" step="5" value="${cal.w}" data-calrange="w">
    <label class="muted">Höhe der Tage: ${cal.h} %</label>
    <input type="range" min="60" max="200" step="5" value="${cal.h}" data-calrange="h">
    <div class="row" style="margin-top:14px;justify-content:space-between">
      <button class="btn ghost" data-act="calreset">Standard</button>
      <button class="btn" data-act="mclose">Fertig</button>
    </div>`);
}

function todoRow(t) {
  const prio = t.priority || "mittel";
  const c = catColor(t.type);
  return `<div class="listrow" data-drag="${t.id}">
    <input type="checkbox" data-act="tdone" data-id="${t.id}" ${t.done ? "checked" : ""} ${canCheck(t) ? "" : "disabled"}>
    <div class="grow"><span class="${t.done ? "done-title" : ""}"><b>${esc(t.title)}</b></span>
      <div class="muted" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="color:${c};display:inline-flex;align-items:center;gap:4px">${typeIcon(t.type, c, 13)}${CAT_LABEL[t.type] || "To-Do"}</span>${t.time ? " · " + esc(t.time) : ""}${t.date ? "" : " · Termin folgt"}</div></div>
    <span class="prio ${prio}">${prio}</span>
    <button class="btn ghost" data-act="tedit" data-id="${t.id}">✎</button>
  </div>`;
}

// ---------- Vorlesungs-Protokolle ----------
function viewModules() {
  if (ui.modOpen && state.modules[ui.modOpen]) return viewModuleDetail(ui.modOpen);

  let h = `<h2 style="margin-bottom:14px">Vorlesungs-Protokolle</h2>
    <div class="card"><input id="modSearch" placeholder="Module und Mitschriften durchsuchen …" value="${esc(ui.modSearch)}"></div>`;
  const q = ui.modSearch.trim().toLowerCase();
  const allNames = Object.keys(state.modules).sort((a, b) => a.localeCompare(b, "de"));

  if (q) {
    const modHits = allNames.filter((n) => n.toLowerCase().includes(q));
    const hits = [];
    for (const [name, m] of Object.entries(state.modules)) {
      for (const n of m.notes) {
        if (`${n.done} ${n.todo}`.toLowerCase().includes(q)) hits.push({ name, n });
      }
    }
    hits.sort((a, b) => b.n.date.localeCompare(a.n.date));
    h += `<div class="card"><h4 style="margin-top:0">Module</h4>${modHits.map((n) =>
      `<div class="listrow" data-act="mopen" data-m="${enc(n)}" style="cursor:pointer"><span class="bar" style="background:${state.modules[n].color}"></span><b class="grow">${esc(n)}</b></div>`
    ).join("") || `<div class="muted">Keine Module gefunden.</div>`}</div>`;
    h += `<div class="card"><h4 style="margin-top:0">Mitschriften</h4>${hits.map((x) =>
      `<div class="note"><div class="muted">${fmtD(parseIso(x.n.date))} · <b>${esc(x.name)}</b></div>${esc(x.n.done)}${x.n.todo ? `<div class="muted" style="margin-top:6px">Noch zu lernen: ${esc(x.n.todo)}</div>` : ""}</div>`
    ).join("") || `<div class="muted">Keine Treffer.</div>`}</div>`;
    return h;
  }

  const visible = allNames.filter(moduleHasEvents);
  const hidden = allNames.filter((n) => !moduleHasEvents(n));

  // Art einer Veranstaltung aus dem Namen: Tutorium, Übung oder Vorlesung
  const kf = ui.modKind || "alle";
  const kindOf = (n) => (/tutorium/i.test(n) ? "tut" : /übung/i.test(n) ? "ueb" : "vl");
  const kindLabel = { vl: "Vorlesungen", ueb: "Übungen", tut: "Tutorien" };
  const kindChip = (v, label) => `<button class="btn ${kf === v ? "" : "ghost"}" data-act="modkind" data-v="${v}">${label}</button>`;
  h += `<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:10px">${kindChip("alle", "Alle")}${kindChip("vl", "Vorlesungen")}${kindChip("ueb", "Übungen")}${kindChip("tut", "Tutorien")}</div>`;
  h += `<div class="row" style="justify-content:flex-end;margin-bottom:10px"><label class="row" style="font-size:14px"><input type="checkbox" data-act="showhidden" ${ui.showHidden ? "checked" : ""}> Ausgeblendete anzeigen</label></div>`;

  if (!visible.length && !(ui.showHidden && hidden.length)) {
    return h + `<div class="card muted">Noch keine Protokolle. Ein Protokoll erscheint, sobald ein Termin mit diesem Namen im Stundenplan steht.</div>`;
  }

  const groups = ["vl", "ueb", "tut"].filter((k) => kf === "alle" || kf === k);
  h += groups.map((k) => {
    const list = visible.filter((n) => kindOf(n) === k);
    if (!list.length) return "";
    return (kf === "alle" ? `<h4 style="margin-top:18px">${kindLabel[k]}</h4>` : "") +
      laid("prot-" + k, list.map((n) => ({ id: n, w: 4, h: 3, html: cardHTML(n, false) })), `<div class="dash-grid">` + list.map((n) => cardHTML(n, false)).join("") + `</div>`);
  }).join("") || `<div class="card muted">Keine Einträge in dieser Auswahl.</div>`;
  if (ui.showHidden && hidden.length) {
    h += `<h4 style="margin-top:18px">Ausgeblendet (keine Termine im Stundenplan)</h4><div class="dash-grid">` +
      hidden.map((name) => cardHTML(name, true)).join("") + `</div>`;
  }
  return h;
}

function cardHTML(name, dim) {
  const m = state.modules[name];
  const total = m.topics.length;
  const done = m.topics.filter((t) => topicComplete(m, t)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return `<div class="card modcard ${dim ? "dimmed" : ""}" data-act="mopen" data-m="${enc(name)}" style="--mc:${m.color}">
    <div class="row">
      <div class="grow"><b class="mod-name">${esc(name)}</b>
        <div class="muted">${done} von ${total} Themen fertig · ${m.notes.length} Einträge</div></div>
      <button class="btn ghost menu-btn" data-act="mmenu" data-m="${enc(name)}" title="Optionen">⋮</button>
    </div>
    <div class="progress"><div style="width:${pct}%;background:${m.color}"></div></div>
  </div>`;
}

function openModuleMenu(name) {
  const n = enc(name);
  openModal(`
    <h3>${esc(name)}</h3>
    <div class="menu-list">
      <button class="btn" data-act="medit" data-m="${n}">Bearbeiten (Farbe)</button>
      <button class="btn danger" data-act="mtrash" data-m="${n}">In den Papierkorb</button>
    </div>
    <div class="row"><button class="btn ghost" data-act="mclose">Schließen</button></div>
    <p class="muted">Die Termine im Stundenplan bleiben erhalten.</p>`);
}

function openModuleEdit(name) {
  const m = state.modules[name];
  if (!m) return;
  const n = enc(name);
  openModal(`
    <h3>${esc(name)} bearbeiten</h3>
    <div class="muted">Farbe (gilt auch im Stundenplan)</div>
    <div class="row" style="margin:10px 0"><input type="color" value="${m.color}" data-mcolorpick data-m="${n}"></div>
    <div class="row" style="margin-top:14px"><button class="btn" data-act="mclose">Fertig</button></div>`);
}

// Fortschritt: ein Thema ist fertig, wenn alle seine Einträge abgehakt sind
function topicEntries(m, tid) { return m.notes.filter((x) => x.topicId === tid); }
function topicComplete(m, t) {
  const es = topicEntries(m, t.id);
  return es.length > 0 && es.every((x) => x.checked);
}

function viewModuleDetail(name) {
  const m = state.modules[name];
  if (ui.topicOpen && topicOf(m, ui.topicOpen)) return viewTopicDetail(name, ui.topicOpen);
  const n = enc(name);
  const total = m.topics.length;
  const done = m.topics.filter((t) => topicComplete(m, t)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const loose = m.notes.filter((x) => !x.topicId).sort(byDateDesc);
  return `<div class="mod-head">
      <div class="row">
        <button class="btn ghost" data-act="mback">‹</button>
        <div class="grow"><div class="mod-title" style="color:${m.color}">${esc(name)}</div>
          <div class="muted">${done} von ${total} Themen fertig</div></div>
        <button class="btn ghost menu-btn" data-act="mmenu" data-m="${n}" title="Optionen">⋮</button>
      </div>
      <div class="progress"><div style="width:${pct}%;background:${m.color}"></div></div>
    </div>
    <div class="card">
      <div class="sec-title">Themen</div>
      <form data-form="topic" data-m="${n}" class="row quick-row">
        <input name="title" placeholder="Neues Thema …" required style="flex:1"><button class="btn">+</button>
      </form>
      ${m.topics.map((t) => topicCard(name, t)).join("") || `<div class="empty"><div class="ei">📚</div>Noch keine Themen. Lege oben das erste an.</div>`}
    </div>
    <div class="card">
      <div class="row" style="justify-content:space-between">
        <div class="sec-title" style="margin:0">Ohne Thema</div>
        <button class="btn" data-act="nnew" data-m="${n}">+ Eintrag</button>
      </div>
      ${loose.map((x) => noteBlock(name, x)).join("") || `<div class="muted" style="margin-top:8px">Keine Einträge ohne Thema.</div>`}
    </div>`;
}

function topicCard(name, t) {
  const m = state.modules[name];
  const es = topicEntries(m, t.id);
  const complete = topicComplete(m, t);
  return `<div class="topic-card" data-act="topen" data-id="${t.id}" data-m="${enc(name)}">
    <div class="grow"><b>${esc(t.title)}</b>
      <div class="muted">${es.length} ${es.length === 1 ? "Eintrag" : "Einträge"}</div></div>
    ${complete ? `<span class="pct" style="background:${m.color};color:${textOn(m.color)}">✓ 100 %</span>` : ""}
    <span class="chev">›</span>
  </div>`;
}

function viewTopicDetail(name, tid) {
  const m = state.modules[name];
  const t = topicOf(m, tid);
  const n = enc(name);
  const list = topicEntries(m, tid).sort(byDateDesc);
  const complete = topicComplete(m, t);
  return `<div class="mod-head">
      <div class="row">
        <button class="btn ghost" data-act="tback">‹</button>
        <div class="grow"><div class="mod-title">${esc(t.title)}</div><div class="muted">${esc(name)}</div></div>
        ${complete ? `<span class="pct" style="background:${m.color};color:${textOn(m.color)}">✓ 100 %</span>` : ""}
        <button class="btn ghost" data-act="ttitle" data-id="${t.id}" data-m="${n}" title="Umbenennen">✎</button>
      </div>
    </div>
    <div class="card">
      <div class="row" style="justify-content:space-between">
        <div class="sec-title" style="margin:0">Einträge</div>
        <button class="btn" data-act="nnewt" data-m="${n}" data-t="${t.id}">+ Eintrag</button>
      </div>
      ${list.map((x) => noteBlock(name, x)).join("") || `<div class="empty"><div class="ei">📝</div>Noch keine Einträge. Lege den ersten an.</div>`}
    </div>
    <div style="text-align:center"><button class="btn danger" data-act="tdel" data-id="${t.id}" data-m="${n}">Thema löschen</button></div>`;
}

function noteBlock(name, x) {
  return `<div class="note-card ${x.checked ? "is-done" : ""}">
    <input type="checkbox" class="note-check" data-act="ncheck" data-id="${x.id}" data-m="${enc(name)}" ${x.checked ? "checked" : ""} title="erledigt">
    <div class="grow">
      <div class="muted note-date">${fmtD(parseIso(x.date))}</div>
      <div class="note-text">${esc(x.done)}</div>
    </div>
    <button class="btn ghost" data-act="nedit" data-id="${x.id}" data-m="${enc(name)}" title="Bearbeiten">✎</button>
    <button class="btn ghost" data-act="ndel" data-id="${x.id}" data-m="${enc(name)}" title="Löschen">✕</button>
  </div>`;
}

// ---------- Einstellungen ----------
function phoneToolsHTML() {
  return `<div class="card phone-tools">
    <h3 style="margin-top:0">Werkzeuge</h3>
    <div class="row" style="gap:8px;flex-wrap:wrap">
      <button class="btn ghost" data-act="undo">↶ Rückgängig</button>
      <button class="btn ghost" data-act="redo">↷ Wiederholen</button>
      <button class="btn ghost lay-btn" data-act="laytoggle">Layout bearbeiten</button>
      <button class="btn ghost" data-act="navside">⇆ Leiste wechseln</button>
    </div>
    <p class="muted" style="margin:10px 0 0">Sync: <span class="syncStatus sync">lokal</span></p>
  </div>`;
}
function viewSettings() {
  const s = state.settings;
  const mode = currentMode();
  const c = themeColors();

  let h = `<h2 style="margin-bottom:14px">Einstellungen</h2>`;
  h += phoneToolsHTML();
  h += `<div class="card"><h3>Darstellung</h3>
    <label class="muted" style="display:block;margin-bottom:6px">Design (nur auf diesem Gerät)</label>
    <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:14px">
      ${[["light", "Hell"], ["dark", "Dunkel"], ["system", "Wie Gerät"]].map(([v, l]) =>
        `<button class="btn ${(s.themeMode === "system" ? "system" : s.dark ? "dark" : "light") === v ? "" : "ghost"}" data-act="themeset" data-v="${v}">${l}</button>`).join("")}
    </div>
    <label class="muted" style="display:block;margin-bottom:6px">Schriftgröße: ${s.fontScale || 100} % (nur auf diesem Gerät)</label>
    <input type="range" min="80" max="150" step="5" value="${s.fontScale || 100}" data-change="fontscale" style="width:100%;margin-bottom:14px">
    <label class="muted" style="display:block;margin-bottom:6px">Startseite beim Öffnen (nur auf diesem Gerät)</label>
    <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:14px">
      ${[["dashboard", "Dashboard"], ["stundenplan", "Stundenplan"], ["kalender", "Kalender"], ["protokolle", "Protokolle"], ["einstellungen", "Einstellungen"]].map(([v, l]) =>
        `<button class="btn ${(s.startTab || "dashboard") === v ? "" : "ghost"}" data-act="startset" data-v="${v}">${l}</button>`).join("")}
    </div>
    <label class="row" style="margin-top:10px"><input type="checkbox" data-change="scrollbars" ${s.scrollbars !== false ? "checked" : ""}> Scrollbalken anzeigen (nur auf diesem Gerät)</label>
    <label class="muted" style="display:block;margin-top:14px">Reiterleiste (nur auf diesem Gerät)</label>
    <div class="row" style="gap:6px;flex-wrap:wrap">
      ${[["", "Automatisch"], ["left", "Links"], ["bottom", "Unten"]].map(([v, l]) =>
        `<button class="btn ${(s.navSide || "") === v ? "" : "ghost"}" data-act="navset" data-v="${v}">${l}</button>`).join("")}
    </div>
    <p class="muted" style="margin-bottom:0">Automatisch: links am PC, unten am Handy.</p>
    <label class="muted" style="display:block;margin-top:14px">Haken bei Listen (nur dieses Gerät)</label>
    <div class="row" style="gap:6px">
      ${[["left", "Links vom Namen"], ["right", "Rechts vom Namen"]].map(([v, l]) =>
        `<button class="btn ${(s.checkSide || "left") === v ? "" : "ghost"}" data-act="checkset" data-v="${v}">${l}</button>`).join("")}
    </div>
  </div>`;
  h += viewDesignCard();
  h += `<div class="card"><h3>Farben (${mode === "dark" ? "Dunkel" : "Hell"}-Modus)</h3>
    <p class="muted" style="margin-top:0">Jeder Modus hat eigene Farben.</p>
    ${Object.keys(THEME_LABELS).map((key) => `<label class="muted" style="display:block;margin-top:10px">${THEME_LABELS[key]}</label>
      <input type="color" value="${c[key]}" data-change="color" data-key="${key}">`).join("")}
    <div class="row" style="margin-top:14px"><button class="btn ghost" data-act="colorreset">Standardfarben wiederherstellen</button></div>
  </div>`;
  h += `<div class="card"><h3>Kategorie-Farben</h3>
    <p class="muted" style="margin-top:0">Gelten auf allen Geräten gleich.</p>
    ${[["todo", "To-Do"], ["abgabe", "Abgabe"], ["klausur", "Klausur"]].map(([key, label]) =>
      `<label class="muted" style="display:block;margin-top:10px">${label}</label>
      <input type="color" value="${s.plan[key] || PLAN_DEFAULTS[key]}" data-change="catcolor" data-key="${key}">`).join("")}
  </div>`;
  h += `<div class="card"><h3>Semester & Stundenplan</h3>
    <form data-form="semester"><label class="muted">Semester-Bezeichnung</label>
      <input name="semester" value="${esc(s.semester)}"><button class="btn">Speichern</button></form>
    <label class="muted" style="display:block;margin-top:14px">Stundenplan (.ics) hochladen</label>
    <input type="file" accept=".ics,text/calendar" data-change="ics">
    <p class="muted">Ersetzt den bisherigen Stundenplan. Module werden automatisch angelegt, vorhandene Einträge bleiben erhalten. Aktuell: ${state.events.length} Termine.</p>
  </div>`;
  h += trashSection();
  h += `<div class="card"><h3>Alles zurücksetzen</h3>
    <p class="muted">Löscht Stundenplan, Protokolle, To-Dos, Karten und den Papierkorb. Mit „Rückgängig“ lässt sich das wieder zurücknehmen. Die Änderung wird auch in der Cloud gespeichert.</p>
    <button class="btn danger" data-act="resetall">Alle Daten zurücksetzen</button>
  </div>`;
  h += `<div class="card"><h3>Backup</h3>
    <div class="row"><button class="btn" data-act="export">Backup speichern (JSON)</button></div>
    <label class="muted" style="display:block;margin-top:14px">Backup wiederherstellen</label>
    <input type="file" accept=".json,application/json" data-change="import">
    <p class="muted">Achtung: Das Wiederherstellen ersetzt alle aktuellen Daten.</p>
  </div>`;
  h += `<div class="card"><h3>Cloud-Sync (Supabase)</h3>${cloudSection()}</div>`;
  return h;
}

function trashSection() {
  const items = [...(state.trash || [])].sort((a, b) => b.deletedAt - a.deletedAt);
  const rows = items.map((it) => {
    const left = Math.max(0, Math.ceil((it.deletedAt + TRASH_DAYS * 86400000 - Date.now()) / 86400000));
    return `<div class="listrow">
      <div class="grow"><b>${esc(trashLabel(it))}</b><div class="muted">Wird in ${left} Tagen endgültig gelöscht</div></div>
      <button class="btn ghost" data-act="trestore" data-id="${it.id}">Wiederherstellen</button>
      <button class="btn ghost" data-act="tpurge" data-id="${it.id}">Endgültig</button>
    </div>`;
  }).join("");
  return `<div class="card"><div class="row" style="justify-content:space-between"><h3 style="margin:0">Papierkorb</h3>
      ${items.length ? `<button class="btn ghost" data-act="trashempty">Leeren</button>` : ""}</div>
    <p class="muted">Gelöschte Einträge bleiben 30 Tage hier, danach werden sie automatisch endgültig gelöscht.</p>
    ${rows || `<div class="muted">Der Papierkorb ist leer.</div>`}
  </div>`;
}

function cloudSection() {
  if (!cloudConfigured()) {
    return `<p class="muted">Noch nicht eingerichtet. Trage in der Datei <b>config.js</b> deine SUPABASE_URL und den SUPABASE_ANON_KEY ein und lade die App neu.</p>`;
  }
  if (session) {
    return `<p class="muted">Angemeldet als ${esc(session.user.email)}. Daten, Papierkorb und Verlauf werden zwischen deinen Geräten synchronisiert.</p>
      <div class="row"><button class="btn" data-act="syncnow">Jetzt synchronisieren</button>
      <button class="btn ghost" data-act="logout">Abmelden</button></div>`;
  }
  return `<form data-form="login">
    <label class="muted">E-Mail</label><input type="email" name="email" required>
    <label class="muted">Passwort</label><input type="password" name="password" required>
    <button class="btn">Anmelden</button></form>`;
}

// ---------- Modale Fenster ----------
function openModal(html) {
  ui.dayPop = null;
  document.getElementById("modalRoot").innerHTML = `<div class="modal" data-act="mbg"><div class="sheet">${html}</div></div>`;
}
// ---------- Nächste Frist (Countdown, groß) und Rückblick ----------
const TAB_NAMES = { dashboard: "Dashboard", stundenplan: "Stundenplan", kalender: "Kalender & To-Dos", protokolle: "Vorlesungs-Protokolle", einstellungen: "Einstellungen" };
function nextDeadlineCard() {
  const today = iso(new Date());
  const next = state.todos
    .filter((t) => ["klausur", "abgabe"].includes(t.type) && !t.done && t.date && t.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!next) return `<div class="card muted">Keine Klausur oder Abgabe in Sicht.</div>`;
  const days = Math.round((parseIso(next.date) - parseIso(today)) / 86400000);
  const big = days === 0 ? "Heute" : days === 1 ? "Morgen" : String(days);
  const unit = days > 1 ? "Tage" : "";
  const col = catColor(next.type);
  return `<div class="card deadline" style="border-left:6px solid ${col}">
    <div class="dl-num" style="color:${col}">${big}</div>
    <div class="dl-unit muted">${unit}</div>
    <div class="dl-info"><span class="muted">${CAT_LABEL[next.type] || "Frist"}</span><b>${esc(next.title)}</b><span class="muted">${fmtD(parseIso(next.date))}${next.time ? " · " + esc(next.time) : ""}</span></div>
  </div>`;
}
function rueckRange(v) {
  const now = new Date();
  const today = iso(now);
  if (v === "4wochen") return { from: iso(addDays(now, -27)), to: today, label: "Letzte 4 Wochen" };
  if (v === "alles") return { from: "", to: today, label: "Alles bisher" };
  return { from: iso(mondayOf(now)), to: today, label: "Diese Woche" };
}
function rueckData(v) {
  const r = rueckRange(v);
  const inR = (d) => d && d >= r.from && d <= r.to;
  // Zählt nach dem Tag, an dem es erledigt wurde (ältere Einträge ohne Datum nach Fälligkeit)
  const doneDay = (t) => t.doneAt || t.date || "";
  const done = state.todos.filter((t) => t.done && inR(doneDay(t))).sort((a, b) => doneDay(b).localeCompare(doneDay(a)));
  const notes = [];
  for (const [name, m] of Object.entries(state.modules)) for (const n of m.notes) if (inR(n.date)) notes.push({ name, n });
  notes.sort((a, b) => b.n.date.localeCompare(a.n.date));
  const termine = state.events.filter((e) => inR(e.date)).sort((a, b) => b.date.localeCompare(a.date) || b.start - a.start);
  return { r, done, notes, termine };
}
function rueckblickCard() {
  const d = rueckData("woche");
  const rows = d.done.slice(0, 4).map((t) =>
    `<div class="listrow"><span class="pdot" style="background:${catColor(t.type)}"></span><div class="grow"><b>${esc(t.title)}</b></div></div>`).join("");
  return `<div class="card">
    <div class="row" style="justify-content:space-between"><h3 style="margin:0">Diese Woche</h3>
      <button class="btn ghost" data-act="rueckblick">Ganzer Rückblick</button></div>
    <div class="muted" style="margin:6px 0 10px">${d.done.length} erledigt · ${d.notes.length} Protokoll-Einträge · ${d.termine.length} Termine</div>
    ${rows || `<div class="muted">Diese Woche noch nichts erledigt.</div>`}
  </div>`;
}
function openRueckblick() {
  const v = ui.rueckRange || "woche";
  const d = rueckData(v);
  const seg = [["woche", "Diese Woche"], ["4wochen", "4 Wochen"], ["alles", "Alles"]]
    .map(([k, l]) => `<button class="btn ${k === v ? "" : "ghost"}" data-act="rueckrange" data-v="${k}">${l}</button>`).join("");
  const sec = (title, rows) => `<h4>${title} <span class="muted">(${rows.length})</span></h4>` + (rows.join("") || `<div class="muted">Keine Einträge.</div>`);
  openModal(`<h3>Rückblick · ${d.r.label}</h3>
    <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:10px">${seg}</div>
    ${sec("Erledigt", d.done.map((t) => `<div class="listrow"><span class="pdot" style="background:${catColor(t.type)}"></span><div class="grow"><b>${esc(t.title)}</b><div class="muted">${CAT_LABEL[t.type] || "Aufgabe"} · ${fmtD(parseIso(t.date))}</div></div></div>`))}
    ${sec("Protokolle", d.notes.map(({ name, n }) => `<div class="note"><div class="muted">${fmtD(parseIso(n.date))} · <b>${esc(name)}</b></div>${esc(n.done)}${n.todo ? `<div class="muted" style="margin-top:6px">Noch zu lernen: ${esc(n.todo)}</div>` : ""}</div>`))}
    ${sec("Termine", d.termine.map((e) => `<div class="listrow"><span class="bar" style="background:${colorOf(e.name)}"></span><div class="grow"><b>${esc(e.name)}</b><div class="muted">${fmtD(parseIso(e.date))} · ${fmtMin(e.start)}${e.room ? " · " + esc(e.room) : ""}</div></div></div>`))}
    <div class="sheet-actions"><button class="btn ghost" data-act="mclose">Schließen</button></div>`);
}
function showToast(html, ms = 5000) {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.innerHTML = html;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), ms);
}
document.addEventListener("change", (e) => {
  const k = e.target.dataset && e.target.dataset.sf;
  if (!k) return;
  ui[{ from: "calFrom", to: "calTo", type: "calType", mod: "calMod" }[k]] = e.target.value;
  render();
});

// ---------- Mensa-Karte (Speiseplan über die Supabase-Funktion "mensa") ----------
const MENSA_LS = "studienplaner-mensa-v3";
let mensaTried = null;   // Tag, für den schon geladen wurde (verhindert Schleifen)
let mensaErr = false;
let mensaBusy = false;
// Speicher: je Datum ein Eintrag, nur die letzten 10 Tage
function mensaCache() {
  try { return JSON.parse(localStorage.getItem(MENSA_LS) || "{}") || {}; } catch { return {}; }
}
function mensaTarget() { return ui.mensaDay || iso(new Date()); }
function mensaCardHTML() {
  const target = mensaTarget();
  const today = iso(new Date());
  const fresh = mensaCache()[target] || null;
  let body;
  if (fresh && fresh.gerichte && fresh.gerichte.length) {
    body = fresh.gerichte.map((g) =>
      `<div class="mensa-row"><span class="muted">${esc(g.label)}</span><span><b>${esc(g.name)}</b></span><span class="mensa-price">${esc(g.preis.stud)}</span></div>`
    ).join("") + `<div class="muted" style="font-size:12px;margin-top:8px">Preise für Studierende</div>`;
  } else if (fresh) {
    body = `<div class="muted">${esc(fresh.hinweis || "Kein Speiseplan für diesen Tag.")}</div>`;
  } else if (mensaErr) {
    body = `<div class="muted">Speiseplan gerade nicht erreichbar. Mit ↻ erneut versuchen.</div>`;
  } else {
    body = `<div class="muted">Speiseplan wird geladen …</div>`;
  }
  const hinweisDatum = fresh && fresh.datum && fresh.datum !== target
    ? `<div class="muted" style="font-size:12px;margin-bottom:6px">Angezeigt wird ${parseIso(fresh.datum).toLocaleDateString("de-DE", { weekday: "long" })}</div>` : "";
  const wochentag = parseIso(target).toLocaleDateString("de-DE", { weekday: "long" });
  const title = target === today ? "Mensa heute" : `Mensa · ${wochentag}`;
  const datumKlein = `<div class="muted" style="font-size:12px;margin-top:2px">${fmtD(parseIso(target))}</div>`;
  return `<div class="card mensa-card">
    <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:6px">
      <div><h3 style="margin:0">${title}</h3>${datumKlein}</div>
      <span class="row" style="gap:6px">
        <button class="btn ghost" data-act="mensanav" data-v="-1" title="Tag zurück">‹</button>
        <button class="btn ghost" data-act="mensanav" data-v="0" title="Zu heute">Heute</button>
        <button class="btn ghost" data-act="mensanav" data-v="1" title="Tag vor">›</button>
        <a class="btn ghost lay-keep" href="https://werkswelt.de/?id=mohm" target="_blank" rel="noopener" title="Speiseplan auf der Website öffnen">↗</a>
        <button class="btn ghost menu-btn" data-act="mensareload" title="Neu laden">↻</button>
      </span>
    </div>
    <div style="margin-top:10px">${hinweisDatum}${body}</div>
  </div>`;
}
async function loadMensa(force) {
  const target = mensaTarget();
  if (!force && (mensaCache()[target] || mensaTried === target)) return;
  if (mensaBusy || !cloudConfigured()) return;
  mensaBusy = true;
  mensaTried = target;
  try {
    const r = await fetch(SUPABASE_URL + "/functions/v1/mensa?tag=" + target, {
      headers: { Authorization: "Bearer " + SUPABASE_ANON_KEY, apikey: SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(20000),
    });
    const data = await r.json();
    mensaErr = false;
    if (data && Array.isArray(data.gerichte)) {
      const c = mensaCache();
      c[target] = data;
      const keep = {};
      Object.keys(c).sort().slice(-10).forEach((k) => { keep[k] = c[k]; });
      localStorage.setItem(MENSA_LS, JSON.stringify(keep));
    }
  } catch {
    mensaErr = true;
  } finally {
    mensaBusy = false;
  }
  if (ui.tab === "dashboard") render();
}

// ---------- Layout bearbeiten (Schloss-Symbol) ----------
// Karten liegen auf einem Raster mit 12 Spalten und Zeilen von je 40 px. Pro Gerät gespeichert.
const LAY_COLS = 12, LAY_ROW = 40, LAY_GAP = 10, LAY_STRIDE_Y = LAY_ROW + LAY_GAP;
const layNarrow = () => window.innerWidth < 800;
const layScopeSaved = (scope) => {
  const L = (state.settings.layouts || {})[scope];
  return !!(L && Object.keys(L).length);
};
// Ein Bereich wird nur als Raster gezeigt, wenn gerade bearbeitet wird oder schon ein Layout gespeichert ist
function laid(scope, items0, flowHtml, extraStyle = "") {
  if (!ui.layEdit && !layScopeSaved(scope)) return flowHtml;
  const items = items0.filter((it) => it.html);
  const saved = (state.settings.layouts || {})[scope] || {};
  const place = placeLayout(items, saved);
  const cards = items.map((it) => {
    const p = place[it.id];
    return `<div class="lcard" data-scope="${scope}" data-card="${esc(it.id)}" data-c="${p.c}" data-r="${p.r}" data-w="${p.w}" data-h="${p.h}" style="grid-column:${p.c} / span ${p.w};grid-row:${p.r} / span ${p.h}">${it.html}</div>`;
  }).join("");
  return `<div class="lay${ui.layEdit ? " lay-edit" : ""}" data-scope="${scope}" style="${extraStyle}">${cards}</div>`;
}
// Gespeicherte Positionen übernehmen, die übrigen Karten der Reihe nach einsortieren
function placeLayout(items, saved) {
  const occ = [];
  const used = (c, r, w, h) => {
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (occ[y] && occ[y][x]) return true;
    return false;
  };
  const mark = (c, r, w, h) => {
    for (let y = r; y < r + h; y++) { occ[y] = occ[y] || []; for (let x = c; x < c + w; x++) occ[y][x] = true; }
  };
  const out = {};
  items.forEach((it) => {
    const q = saved[it.id];
    if (!q) return;
    const w = Math.max(1, Math.min(LAY_COLS, Math.round(q.w)));
    const h = Math.max(1, Math.round(q.h));
    const c = Math.max(1, Math.min(LAY_COLS - w + 1, Math.round(q.c)));
    const r = Math.max(1, Math.round(q.r));
    out[it.id] = { c, r, w, h };
    mark(c, r, w, h);
  });
  items.forEach((it) => {
    if (out[it.id]) return;
    const w = layNarrow() ? LAY_COLS : Math.min(LAY_COLS, it.w || 6);
    const h = it.h || 6;
    for (let r = 1; ; r++) {
      let placed = false;
      for (let c = 1; c <= LAY_COLS - w + 1 && !placed; c++) {
        if (!used(c, r, w, h)) { out[it.id] = { c, r, w, h }; mark(c, r, w, h); placed = true; }
      }
      if (placed) break;
    }
  });
  return out;
}
// Lage aller Karten eines Bereichs speichern (aus dem Bildschirm), optional eine Karte ändern
function saveScopeLayout(scope, id, p) {
  pushLayHist("Layout verschoben");
  const map = {};
  document.querySelectorAll(`.lcard[data-scope="${scope}"]`).forEach((c) => {
    map[c.dataset.card] = { c: +c.dataset.c, r: +c.dataset.r, w: +c.dataset.w, h: +c.dataset.h };
  });
  if (id && p) map[id] = p;
  state.settings.layouts = { ...(state.settings.layouts || {}), [scope]: map };
  commit();
}
const layClamp = (v, a, b) => Math.min(b, Math.max(a, v));
function planLaid(html) { return laid("plan", [{ id: "tt", w: 12, h: 24, html }], html); }
function layOverlaps(scope, id, p) {
  return [...document.querySelectorAll(`.lcard[data-scope="${scope}"]`)].some((c) => {
    if (c.dataset.card === id) return false;
    const c0 = +c.dataset.c, r0 = +c.dataset.r, w0 = +c.dataset.w, h0 = +c.dataset.h;
    return p.c < c0 + w0 && c0 < p.c + p.w && p.r < r0 + h0 && r0 < p.r + p.h;
  });
}
// Stundenplan füllt den Bildschirm: Stundenhöhe so wählen, dass alle Stunden sichtbar sind (Höhe % = Anteil davon)
let fitting = false;
let planFitPx = null;   // zuletzt berechnete Stundenhöhe für den Stundenplan
function fitPlan() {
  if (fitting) return;
  const wk = document.querySelector(".week");
  if (!wk) return;
  const tb = document.querySelector(".tabbar");
  const tbH = tb && getComputedStyle(tb).display !== "none" ? tb.offsetHeight : 0;
  const top = wk.getBoundingClientRect().top;
  const hours = (END_MIN - START_MIN) / 60;
  const avail = window.innerHeight - top - tbH - 8 - 50;
  const zoom = state.settings.zoomY || 1;
  const px = Math.max(30, Math.floor(avail / hours)) * zoom;
  if (Math.abs(px - HOUR_PX) >= 1) {
    planFitPx = px;
    HOUR_PX = px;
    PX_PER_MIN = HOUR_PX / 60;
    fitting = true;
    render();
    fitting = false;
  }
}
// Leiste oben im Bearbeitungsmodus
function layBarHTML() {
  return `<div class="card laybar">
    <div class="grow"><b>Layout bearbeiten</b>
      <div class="muted" style="font-size:13px">Am Rand ziehen: Größe · in der Mitte ziehen: verschieben · einmal tippen: Zahlen eingeben</div></div>
    <button class="btn" data-act="cardnew">+ Karte</button>
    <button class="btn ghost" data-act="layreset">Zurücksetzen</button>
  </div>`;
}
function openLayoutModal(scope, id) {
  const card = [...document.querySelectorAll(`.lcard[data-scope="${scope}"]`)].find((c) => c.dataset.card === id);
  if (!card) return;
  openModal(`<h3>Karte anpassen</h3>
    <form data-form="layoutform" data-scope="${scope}" data-id="${esc(id)}">
      <div class="grid2">
        <div><label class="muted">Spalte (1–12)</label><input type="number" name="c" min="1" max="12" value="${card.dataset.c}"></div>
        <div><label class="muted">Breite (Spalten)</label><input type="number" name="w" min="1" max="12" value="${card.dataset.w}"></div>
      </div>
      <div class="grid2">
        <div><label class="muted">Zeile</label><input type="number" name="r" min="1" max="200" value="${card.dataset.r}"></div>
        <div><label class="muted">Höhe (Zeilen)</label><input type="number" name="h" min="1" max="200" value="${card.dataset.h}"></div>
      </div>
      <div class="sheet-actions">
        <button type="button" class="btn ghost" data-act="mclose">Abbrechen</button>
        <div class="right"><button class="btn">Übernehmen</button></div>
      </div>
    </form>`);
}

// Ziehen und Größe ändern im Layout-Modus. Rand (rechts/unten) = Größe, Mitte = verschieben.
let lay = null;
const LAY_EDGE = 16;
// Diese Bedienelemente funktionieren auch im Bearbeitungsmodus
const LAY_KEEP = '[data-act="cardnew"],[data-act="cardedit"],[data-act="mensareload"],.lay-keep';
function applyLayCell(el, p) {
  el.style.gridColumn = `${p.c} / span ${p.w}`;
  el.style.gridRow = `${p.r} / span ${p.h}`;
  el.dataset.c = p.c; el.dataset.r = p.r; el.dataset.w = p.w; el.dataset.h = p.h;
}
document.addEventListener("pointerdown", (e) => {
  if (!ui.layEdit || e.button > 0) return;
  const card = e.target.closest(".lay-edit .lcard");
  if (!card || e.target.closest(LAY_KEEP)) return;
  const rect = card.getBoundingClientRect();
  const nearEdge = rect.right - e.clientX < LAY_EDGE || rect.bottom - e.clientY < LAY_EDGE;
  lay = {
    el: card, grid: card.closest(".lay"), scope: card.dataset.scope, id: card.dataset.card,
    mode: nearEdge ? "size" : "move", sx: e.clientX, sy: e.clientY, moved: false,
    c0: +card.dataset.c, r0: +card.dataset.r, w0: +card.dataset.w, h0: +card.dataset.h,
  };
}, true);
document.addEventListener("pointermove", (e) => {
  if (!lay) return;
  const dx = e.clientX - lay.sx, dy = e.clientY - lay.sy;
  if (!lay.moved && Math.hypot(dx, dy) < 6) return;
  lay.moved = true;
  const gap = LAY_GAP;
  const colStep = (lay.grid.getBoundingClientRect().width - gap * (LAY_COLS - 1)) / LAY_COLS + gap;
  const dc = Math.round(dx / colStep), dr = Math.round(dy / LAY_STRIDE_Y);
  const p = lay.mode === "move"
    ? { c: layClamp(lay.c0 + dc, 1, LAY_COLS - lay.w0 + 1), r: Math.max(1, lay.r0 + dr), w: lay.w0, h: lay.h0 }
    : { c: lay.c0, r: lay.r0, w: layClamp(lay.w0 + dc, 1, LAY_COLS - lay.c0 + 1), h: Math.max(1, lay.h0 + dr) };
  if (layOverlaps(lay.scope, lay.id, p)) return;
  applyLayCell(lay.el, p);
});
document.addEventListener("pointerup", () => {
  const L = lay;
  lay = null;
  if (!L) return;
  if (L.moved) saveScopeLayout(L.scope);
  else openLayoutModal(L.scope, L.id);
});
document.addEventListener("pointercancel", () => { if (lay) { lay = null; render(); } });
// Im Layout-Modus öffnen Klicks in Karten kein Modul oder Menü, sondern nur das Zahlenfenster
document.addEventListener("click", (e) => {
  if (e.target.closest(".lay-edit .lcard") && !e.target.closest(LAY_KEEP)) { e.preventDefault(); e.stopPropagation(); }
}, true);

// Eigene Fenster statt Browser-Dialoge. Wer auf ein Fenster wartet, bekommt die Antwort über modalResolve.
let modalResolve = null;
function closeModal() {
  ui.dayPop = null;
  const pending = modalResolve;
  modalResolve = null;
  document.getElementById("modalRoot").innerHTML = "";
  ui.noteFor = null;
  ui.noteWindow = false;
  ui.editNote = null;
  if (pending) pending(null);
}
function appConfirm(text, okLabel = "Löschen") {
  return new Promise((resolve) => {
    modalResolve = (v) => resolve(!!v);
    openModal(`<h3>Bitte bestätigen</h3>
      <p style="white-space:pre-line;line-height:1.5">${esc(text)}</p>
      <div class="row" style="justify-content:flex-end;gap:8px;margin-top:16px">
        <button type="button" class="btn ghost" data-act="confno">Abbrechen</button>
        <button type="button" class="btn danger" data-act="confyes">${esc(okLabel)}</button>
      </div>`);
  });
}
function appPrompt(label, value = "") {
  return new Promise((resolve) => {
    modalResolve = (v) => resolve(v);
    openModal(`<h3>${esc(label)}</h3>
      <form data-form="appprompt">
        <input name="value" value="${esc(value)}">
        <div class="row" style="justify-content:flex-end;gap:8px;margin-top:14px">
          <button type="button" class="btn ghost" data-act="mclose">Abbrechen</button>
          <button class="btn">OK</button>
        </div>
      </form>`);
    setTimeout(() => { const i = document.querySelector('[data-form="appprompt"] input'); if (i) { i.focus(); i.select(); } }, 0);
  });
}
function appAlert(text) {
  openModal(`<h3>Hinweis</h3>
    <p style="white-space:pre-line;line-height:1.5">${esc(text)}</p>
    <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn" data-act="mclose">OK</button></div>`);
}

function openNoteModal(name, date, noteId, presetTopic) {
  const m = ensureModule(name);
  const note = noteId ? m.notes.find((x) => x.id === noteId) : null;
  const selTopic = note ? note.topicId : presetTopic;
  const dayKey = date || (note ? note.date : "");
  const hist = m.notes.filter((x) => x.date === dayKey && x.id !== noteId).sort(byDateDesc);
  const topicOpts = `<option value="">— kein Thema —</option>` +
    m.topics.map((t) => `<option value="${t.id}" ${selTopic === t.id ? "selected" : ""}>${esc(t.title)}</option>`).join("") +
    `<option value="__new">+ Neues Thema …</option>`;
  openModal(`
    <div class="row" style="justify-content:space-between"><h3 style="margin:0">${esc(name)}</h3>
      <button type="button" class="btn ghost" data-act="gotoprot" data-m="${enc(name)}">Im Protokoll →</button></div>
    <form data-form="note">
      <input type="hidden" name="module" value="${esc(name)}">
      <input type="hidden" name="id" value="${note ? note.id : ""}">
      <label class="muted">Datum</label>
      <input type="date" name="date" required value="${note ? note.date : date}">
      <label class="muted">Thema</label>
      <select name="topic">${topicOpts}</select>
      <div id="newTopicWrap" style="display:none"><label class="muted">Name des neuen Themas</label><input name="newTopic" placeholder="z. B. Matrizen"></div>
      <label class="muted">Notizen (was gemacht wurde und was noch zu lernen ist)</label>
      <textarea name="done" rows="6">${esc(note ? note.done : "")}</textarea>
      <div class="row"><button class="btn">Speichern</button><button type="button" class="btn ghost" data-act="mclose">Schließen</button></div>
    </form>
    <h4>Einträge am ${dayKey ? fmtD(parseIso(dayKey)) : ""}</h4>
    ${hist.map((x) => noteBlock(name, x)).join("") || `<div class="muted">Noch keine Einträge.</div>`}
  `);
}

function openTodoModal(id, date) {
  const t = id ? state.todos.find((x) => x.id === id) : null;
  const type = t ? t.type : "todo";
  const prio = t ? (t.priority || "mittel") : "mittel";
  const dur = t && t.duration ? t.duration : DEFAULT_DURATION;
  openModal(`
    <h3>${t ? "Eintrag bearbeiten" : "Neuer Eintrag"}</h3>
    <form data-form="todo">
      <input type="hidden" name="id" value="${t ? t.id : ""}">
      <label class="muted">Titel</label>
      <input name="title" required value="${esc(t ? t.title : "")}">
      <label class="muted">Art</label>
      <select name="type">
        ${[["todo", "To-Do"], ["klausur", "Klausur"], ["abgabe", "Abgabe"]].map(([v, l]) => `<option value="${v}" ${type === v ? "selected" : ""}>${l}</option>`).join("")}
      </select>
      <label class="muted">Priorität</label>
      <select name="priority">
        ${[["hoch", "hoch"], ["mittel", "mittel"], ["niedrig", "niedrig"]].map(([v, l]) => `<option value="${v}" ${prio === v ? "selected" : ""}>${l}</option>`).join("")}
      </select>
      <label class="muted">Datum (leer lassen = Termin folgt)</label>
      <input type="date" name="date" value="${t ? t.date : date || ""}">
      <div class="grid2">
        <div><label class="muted">Uhrzeit (leer = ganztägig oben)</label><input type="time" name="time" value="${t ? t.time : ""}"></div>
        <div><label class="muted">Dauer in Minuten</label><input type="number" name="duration" min="15" step="15" value="${dur}"></div>
      </div>
      <div class="row" style="margin-top:12px">
        <button class="btn">Speichern</button>
        ${t ? `<button type="button" class="btn danger" data-act="tdelm" data-id="${t.id}">Löschen</button>` : ""}
        <button type="button" class="btn ghost" data-act="mclose">Abbrechen</button>
      </div>
    </form>`);
}

// ---------- Langes Drücken & Wischen ----------
let pressTimer = null;
let pressStart = null;
let longFired = false;

document.addEventListener("pointerdown", (e) => {
  longFired = false;
  if (e.button > 0 || e.target.closest(".modal")) return;

  // Dashboard: langes Drücken auf To-Do oder Countdown-Eintrag öffnet die Bearbeitung
  if (ui.tab === "dashboard") {
    const item = e.target.closest("[data-lp]");
    if (!item || e.target.closest("button, input")) return;
    pressStart = { x: e.clientX, y: e.clientY, el: item };
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      longFired = true;
      const id = pressStart.el.dataset.lp;
      pressStart = null;
      if (navigator.vibrate) navigator.vibrate(15);
      openTodoModal(id);
    }, 500);
    return;
  }

  // Protokoll-Karte: langes Drücken öffnet das Optionsmenü
  if (ui.tab === "protokolle") {
    const card = e.target.closest(".modcard");
    if (!card || e.target.closest(".menu-btn")) return;
    pressStart = { x: e.clientX, y: e.clientY, el: card };
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      longFired = true;
      const name = dec(pressStart.el.dataset.m);
      pressStart = null;
      if (navigator.vibrate) navigator.vibrate(15);
      openModuleMenu(name);
    }, 500);
    return;
  }

  if (ui.tab !== "stundenplan") return;
  const target = e.target.closest(".ev, .grid");
  if (!target) return;
  if (target.classList.contains("ev") && target.dataset.kind !== "event") return;
  pressStart = { x: e.clientX, y: e.clientY, el: target };
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => {
    longFired = true;
    const { el, y } = pressStart;
    pressStart = null;
    if (navigator.vibrate) navigator.vibrate(15);
    if (el.classList.contains("ev")) {
      openEventEdit(el.dataset.id);
    } else {
      const rect = el.getBoundingClientRect();
      let min = START_MIN + (y - rect.top) / PX_PER_MIN;
      min = Math.round(min / 15) * 15;
      min = Math.max(START_MIN, Math.min(min, END_MIN - 30));
      openEventCreate(el.dataset.date, min);
    }
  }, 500);
});
document.addEventListener("pointermove", (e) => {
  if (pressStart && Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > 10) {
    clearTimeout(pressTimer);
    pressStart = null;
  }
});
["pointerup", "pointercancel"].forEach((ev) =>
  document.addEventListener(ev, () => { clearTimeout(pressTimer); pressStart = null; }));

let swipe = null;
document.addEventListener("touchstart", (e) => {
  if (ui.tab !== "stundenplan" || document.querySelector(".modal") || e.touches.length !== 1) { swipe = null; return; }
  const t = e.touches[0];
  swipe = { x: t.clientX, y: t.clientY, t: Date.now() };
}, { passive: true });
document.addEventListener("touchend", (e) => {
  if (!swipe) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - swipe.x;
  const dy = t.clientY - swipe.y;
  const dt = Date.now() - swipe.t;
  swipe = null;
  if (longFired) return;
  if (dt < 700 && Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > 1.6 * Math.abs(dy)) {
    navigate(dx < 0 ? 1 : -1);
  }
}, { passive: true });
document.addEventListener("touchcancel", () => { swipe = null; }, { passive: true });

// Streckung in Y-Richtung: zwei Finger auf dem Stundenplan (am PC: Strg + Mausrad)
let pinch = null;
let zoomTimer = null;
const zoomScope = (el) => (el.closest(".excerpt") ? "dash" : "plan");
const getZoom = (scope) => (scope === "dash" ? state.settings.dash.zoomY : state.settings.zoomY) || 1;
function setZoom(scope, z) {
  const v = Math.round(Math.min(2, Math.max(0.5, z)) * 100) / 100;
  if (scope === "dash") state.settings.dash.zoomY = v; else state.settings.zoomY = v;
}
// Beim Zoomen mit dem Finger wird NICHT neu gezeichnet (sonst verliert das Handy die Fingerbewegung).
// Stattdessen wird das Raster nur optisch gestreckt; beim Loslassen wird der echte Wert gespeichert.
document.addEventListener("touchstart", (e) => {
  if (e.touches.length !== 2) return;
  const el = e.target.closest(".week, .excerpt");
  if (!el) { pinch = null; return; }
  const scope = zoomScope(el);
  const [a, b] = e.touches;
  pinch = { el, scope, d0: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z0: getZoom(scope), zNow: getZoom(scope), moved: false };
}, { passive: true });
document.addEventListener("touchmove", (e) => {
  if (!pinch || e.touches.length !== 2) return;
  e.preventDefault();
  const [a, b] = e.touches;
  const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  const z = Math.round(Math.min(2, Math.max(0.5, pinch.z0 * d / pinch.d0)) * 100) / 100;
  pinch.zNow = z;
  pinch.moved = true;
  pinch.el.style.transformOrigin = "0 0";
  pinch.el.style.transform = `scaleY(${z / pinch.z0})`;
}, { passive: false });
const endPinch = () => {
  if (pinch && pinch.moved) { setZoom(pinch.scope, pinch.zNow); commit(); }
  pinch = null;
};
document.addEventListener("touchend", endPinch, { passive: true });
document.addEventListener("touchcancel", endPinch, { passive: true });
document.addEventListener("wheel", (e) => {
  if (!e.ctrlKey) return;
  const el = e.target.closest(".week, .excerpt");
  if (!el) return;
  e.preventDefault();
  const scope = zoomScope(el);
  setZoom(scope, getZoom(scope) * (e.deltaY < 0 ? 1.08 : 0.92));
  render();
  clearTimeout(zoomTimer);
  zoomTimer = setTimeout(commit, 400);
}, { passive: false });


// Doppeltippen (Handy) bzw. Doppelklick (PC) auf einen Kalendertag öffnet ihn in der Tagesansicht
let lastDayTap = { d: "", t: 0 };
let lastTabTap = { k: "", t: 0 };

// ---------- Klicks, Eingaben, Formulare ----------
document.addEventListener("click", async (e) => {
  if (longFired) { longFired = false; e.preventDefault(); e.stopPropagation(); return; }
  // Dashboard: Tippen auf eine leere Stelle im Tages-Stundenplan schließt das Notizfeld
  if (ui.tab === "dashboard" && e.target.closest(".excerpt .grid") && !e.target.closest(".ev")) {
    ui.noteFor = null;
    ui.editNote = null;
    ui.dashNoteDismissed = true;
    render();
    return;
  }
  const tabBtn = e.target.closest("[data-tab]");
  if (tabBtn) {
    const key = tabBtn.dataset.tab;
    const nowT = Date.now();
    const isDouble = key === ui.tab && lastTabTap.k === key && nowT - lastTabTap.t < 450;
    lastTabTap = { k: key, t: nowT };
    if (key === "stundenplan" && ui.tab === "stundenplan") { planToggle(); return; }
    if (isDouble && key === "stundenplan") {
      // Doppeltippen auf den aktiven Reiter: Woche ↔ Tag
      if (ui.view === "week") { ui.view = "day"; ui.dayDate = iso(new Date()); ui.anim = null; render(); }
      else toWeekView();
      return;
    }
    if (isDouble && key === "kalender") {
      // Doppeltippen: zurück zum heutigen Tag
      ui.month = new Date();
      ui.selDate = iso(new Date());
      render();
      return;
    }
    ui.tab = key;
    ui.modOpen = null;
    ui.topicOpen = null;
    render();
    window.scrollTo(0, 0);
    return;
  }
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const act = el.dataset.act;
  const id = el.dataset.id;
  const m = el.dataset.m ? dec(el.dataset.m) : null;

  switch (act) {
    case "mbg": if (e.target.classList.contains("modal")) closeModal(); break;
    case "confyes": { const r = modalResolve; modalResolve = null; closeModal(); if (r) r(true); break; }
    case "confno": closeModal(); break;
    case "mclose": closeModal(); break;
    case "undo": undo(); break;
    case "rueckblick": openRueckblick(); break;
    case "rueckrange": ui.rueckRange = el.dataset.v; openRueckblick(); break;
    case "calsfreset": ui.calFrom = ui.calTo = ui.calType = ui.calMod = ui.calSearch = ""; render(); break;
    case "redo": redo(); break;

    case "modetoggle": { const m = currentMode(); state.settings.themeMode = ""; state.settings.dark = m !== "dark"; commit(); break; }
    case "themeset": {
      const v = el.dataset.v;
      state.settings.themeMode = v === "system" ? "system" : "";
      if (v !== "system") state.settings.dark = v === "dark";
      commit(); break;
    }
    case "startset": state.settings.startTab = el.dataset.v; commit(); break;

    // Stundenplan
    case "wk": {
      const v = Number(el.dataset.v);
      if (v === 0) {
        if (ui.weekOffset !== 0) { ui.weekOffset = 0; render(); }          // erst aktuelle Woche
        else { ui.view = "day"; ui.dayDate = iso(new Date()); render(); }  // dann heutiger Tag
      } else navigate(v);
      break;
    }
    case "heutewoche": toWeekView(); break; // Tagesansicht → Woche des gewählten Tages
    case "dayopen": ui.view = "day"; ui.dayDate = el.dataset.d; render(); break;
    case "toweek": toWeekView(); break;
    case "dprev": navigate(-1); break;
    case "dnext": navigate(1); break;
    case "planmenu": openPlanMenu(); break;
    case "planreset":
      // Nur Hintergrund und Linie zurücksetzen; die Kategorie-Farben gelten überall und bleiben
      state.settings.plan = { ...state.settings.plan, grid: "", now: "" };
      commit(); openPlanMenu(); break;
    case "note": {
      const ev = state.events.find((x) => x.id === id);
      if (!ev) break;
      ensureModule(ev.name);
      ui.noteFor = { name: ev.name, date: ev.date };
      ui.editNote = null;
      ui.noteWindow = ui.tab === "stundenplan";
      ui.dashNoteDismissed = false;
      render();
      break;
    }
    case "npclose":
      closeModal();
      ui.noteFor = null;
      ui.editNote = null;
      ui.dashNoteDismissed = true;
      render();
      break;
    case "dashmenu": openDashMenu(); break;
    case "dashreset":
      state.settings.dash = { zoomY: 1, grid: "", now: "" };
      commit(); openDashMenu(); break;
    case "npedit": ui.editNote = id; render(); break;
    case "npcancel": ui.editNote = null; render(); break;
    case "npdelete": {
      const mod = state.modules[m];
      if (!mod) break;
      if (!(await appConfirm("Diesen Eintrag wirklich löschen?"))) break;
      mod.notes = mod.notes.filter((x) => x.id !== id);
      if (ui.editNote === id) ui.editNote = null;
      commit(); break;
    }
    case "ncheck": {
      const n = state.modules[m] && state.modules[m].notes.find((x) => x.id === id);
      if (n) { n.checked = !n.checked; commit(); }
      break;
    }
    case "evcolor": {
      const form = el.closest("form");
      form.elements.color.value = el.dataset.c;
      form.querySelectorAll(".sw").forEach((s) => s.classList.toggle("on", s === el));
      break;
    }
    case "evdelmenu": openDeleteChoice(id); break;
    case "evdelall": {
      const ev = state.events.find((x) => x.id === id);
      if (!ev) break;
      const all = state.events.filter((x) => x.name === ev.name);
      if (!(await appConfirm(`${all.length} Termine von „${ev.name}“ in den Papierkorb verschieben?`))) break;
      all.forEach((x) => trashAdd("event", x));
      state.events = state.events.filter((x) => x.name !== ev.name);
      closeModal(); commit(); break;
    }
    case "evdel": {
      if (!(await appConfirm("Diesen Termin in den Papierkorb verschieben?"))) break;
      const ev = state.events.find((x) => x.id === id);
      if (ev) trashAdd("event", ev);
      state.events = state.events.filter((x) => x.id !== id);
      closeModal(); commit(); break;
    }

    case "evdelfuture": {
      const ev = state.events.find((x) => x.id === id);
      if (!ev) break;
      const isLater = (x) => x.name === ev.name && x.date >= ev.date;
      const count = state.events.filter(isLater).length;
      if (!(await appConfirm(`${count} Termine von „${ev.name}“ ab ${fmtD(parseIso(ev.date))} in den Papierkorb verschieben?`))) break;
      state.events.filter(isLater).forEach((x) => trashAdd("event", x));
      state.events = state.events.filter((x) => !isLater(x));
      closeModal(); commit(); break;
    }

    // Kalender
    case "mon":
      ui.month = new Date(ui.month.getFullYear(), ui.month.getMonth() + Number(el.dataset.v), 1);
      render(); break;
    case "calToday":
      ui.month = new Date();
      ui.selDate = iso(new Date());
      render(); break;
    case "calfilter": ui.calFilter = el.dataset.v; render(); break;
    case "modkind": ui.modKind = el.dataset.v; render(); break;
    case "navside": {
      // Schaltfläche: wechselt die Reiterleiste; ohne Wahl ist sie links am PC und unten am Handy
      const wide = window.matchMedia("(min-width: 760px) and (orientation: landscape), (min-width: 1100px)").matches;
      const effective = state.settings.navSide || (wide ? "left" : "bottom");
      state.settings.navSide = effective === "left" ? "bottom" : "left";
      commit(); break;
    }
    case "navset": state.settings.navSide = el.dataset.v; commit(); break;
    case "calmenu": openCalMenu(); break;
    case "checkset": state.settings.checkSide = el.dataset.v; commit(); break;
    case "laytoggle": ui.layEdit = !ui.layEdit; render(); break;
    case "mensareload": loadMensa(true); break;
    case "dtoday": ui.dayDate = iso(new Date()); ui.anim = null; render(); break;
    case "planview": planToggle(); break;
    case "mensanav": {
      const v = Number(el.dataset.v);
      if (v === 0) ui.mensaDay = null;
      else {
        // Wochenende überspringen: Freitag → Montag und umgekehrt
        let d = addDays(parseIso(mensaTarget()), v);
        while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, v);
        ui.mensaDay = iso(d);
      }
      render();
      break;
    }
    case "layreset": {
      if (!(await appConfirm("Layout auf diesem Gerät auf die Standardanordnung zurücksetzen?", "Zurücksetzen"))) break;
      pushLayHist("Layout zurückgesetzt");
      state.settings.layouts = {};
      commit(); break;
    }

    case "calstyle": state.settings.cal = { ...calSet(), style: el.dataset.v }; commit(); openCalMenu(); break;
    case "calreset": state.settings.cal = { ...DEVICE_DEFAULTS.cal }; commit(); openCalMenu(); break;
    case "calshowdone": ui.calShowDone = el.checked; render(); break;
    case "calgo": {
      const d = parseIso(el.dataset.d);
      ui.selDate = el.dataset.d;
      ui.month = new Date(d.getFullYear(), d.getMonth(), 1);
      ui.calSearch = "";
      render(); break;
    }
    case "sel": openDayModal(el.dataset.d); break;
    case "calfiltertoggle": ui.calFilterOpen = !ui.calFilterOpen; render(); break;
    case "daypopopen":
      ui.tab = "stundenplan";
      ui.view = "day";
      ui.dayDate = el.dataset.d;
      ui.anim = null;
      closeModal();
      render();
      break;
    case "tnew": openTodoModal(null, ui.selDate); break;
    case "tedit": openTodoModal(id); break;
    case "tdelm": {
      if (!(await appConfirm("Eintrag in den Papierkorb verschieben?"))) break;
      const t = state.todos.find((x) => x.id === id);
      if (t) trashAdd("todo", t);
      state.todos = state.todos.filter((x) => x.id !== id);
      closeModal(); commit(); break;
    }
    case "tdone": {
      const t = state.todos.find((x) => x.id === id);
      if (!t) break;
      if (!canCheck(t)) { appAlert("Klausuren kannst du erst am Prüfungstag abhaken."); render(); break; }
      t.done = !t.done;
      t.doneAt = t.done ? iso(new Date()) : null;
      commit(); break;
    }

    // Protokolle
    case "showhidden": ui.showHidden = !ui.showHidden; render(); break;
    case "mopen": ui.modOpen = m; ui.topicOpen = null; render(); break;
    case "mback": ui.modOpen = null; ui.topicOpen = null; render(); break;
    case "mmenu": openModuleMenu(m); break;
    case "mcolor": state.modules[ui.modOpen].color = el.dataset.c; commit(); break;
    case "mcolorm": state.modules[m].color = el.dataset.c; commit(); openModuleEdit(m); break;
    case "medit": openModuleEdit(m); break;
    case "mtrash": {
      if (!(await appConfirm(`Protokoll „${m}“ in den Papierkorb verschieben? Die Termine im Stundenplan bleiben.`))) break;
      const mod = state.modules[m];
      if (mod) trashAdd("module", { color: mod.color, topics: mod.topics, notes: mod.notes }, { name: m });
      delete state.modules[m];
      ui.modOpen = null;
      closeModal(); commit(); break;
    }
    case "topen": ui.topicOpen = id; render(); break;
    case "tback": ui.topicOpen = null; render(); break;
    case "tdoneTopic": {
      const t = topicOf(state.modules[m], id);
      if (t) t.done = !t.done;
      commit(); break;
    }
    case "ttitle": {
      const t = topicOf(state.modules[m], id);
      const val = t && (await appPrompt("Thema umbenennen:", t.title));
      if (val && val.trim()) { t.title = val.trim(); commit(); }
      break;
    }
    case "tdel": {
      if (!(await appConfirm("Thema in den Papierkorb verschieben? Die Einträge bleiben erhalten."))) break;
      const mod = state.modules[m];
      const topic = topicOf(mod, id);
      const noteIds = mod.notes.filter((x) => x.topicId === id).map((x) => x.id);
      if (topic) trashAdd("topic", { topic, noteIds }, { module: m });
      mod.topics = mod.topics.filter((t) => t.id !== id);
      mod.notes.forEach((x) => { if (x.topicId === id) delete x.topicId; });
      ui.topicOpen = null;
      commit(); break;
    }
    case "nnew": openNoteModal(m, iso(new Date())); break;
    case "nnewt": openNoteModal(m, iso(new Date()), null, el.dataset.t); break;
    case "nedit": openNoteModal(m, null, id); break;
    case "ndel": {
      if (!(await appConfirm("Eintrag in den Papierkorb verschieben?"))) break;
      const n = state.modules[m].notes.find((x) => x.id === id);
      if (n) trashAdd("note", n, { module: m });
      state.modules[m].notes = state.modules[m].notes.filter((x) => x.id !== id);
      commit(); break;
    }

    // Papierkorb
    case "trestore": restoreTrash(id); break;
    case "tpurge":
      if (!(await appConfirm("Endgültig löschen? Das kann nicht rückgängig gemacht werden."))) break;
      purgeTrash(id); break;
    case "trashempty":
      if (!(await appConfirm("Papierkorb endgültig leeren?"))) break;
      state.trash = []; commit(); break;

    case "gotoprot":
      closeModal();
      ui.tab = "protokolle";
      ui.modOpen = m;
      ui.topicOpen = null;
      ui.modSearch = "";
      render();
      window.scrollTo(0, 0);
      break;

    // Design-Vorschläge
    case "preset": applyPreset(el.dataset.pid); break;
    case "designopen": openDesignModal(); break;
    case "dashnext": ui.dashNext = { stamp: iso(new Date()), date: iso(nextWorkday(new Date())) }; render(); break;
    case "dashtoday": ui.dashNext = null; render(); break;
    case "presetsave": {
      const name = await appPrompt("Name für dieses Design:");
      if (!name || !name.trim()) break;
      state.settings.presets = [...(state.settings.presets || []), {
        id: uid(), name: name.trim(),
        colors: JSON.parse(JSON.stringify(state.settings.colors)),
      }];
      commit(); break;
    }
    case "presetdel": {
      if (!(await appConfirm("Dieses Design löschen?"))) break;
      state.settings.presets = state.settings.presets.filter((p) => p.id !== el.dataset.pid.slice(2));
      commit(); break;
    }

    case "resetall": {
      if (!(await appConfirm("Wirklich ALLE Daten zurücksetzen? Stundenplan, Protokolle, To-Dos, Karten und Papierkorb werden gelöscht."))) break;
      if (!(await appConfirm("Letzte Warnung. Das lässt sich nur mit „Rückgängig“ wieder herstellen. Jetzt zurücksetzen?"))) break;
      state = { ...defaultState(), history: state.history || [] };
      commit(); break;
    }

    // Eigene Karten
    case "cardnew": openCardModal(); break;
    case "cardedit": openCardModal(id); break;
    case "carddel": {
      if (!(await appConfirm("Karte in den Papierkorb verschieben?"))) break;
      const c = state.cards.find((x) => x.id === id);
      if (c) trashAdd("card", c);
      state.cards = state.cards.filter((x) => x.id !== id);
      closeModal(); commit(); break;
    }

    // Einstellungen
    case "colorreset": state.settings.colors[currentMode()] = {}; commit(); break;
    case "export": exportBackup(); break;
    case "syncnow": cloudPull(); break;
    case "logout": cloudSignOut(); break;
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id === "calSearch") {
    const pos = e.target.selectionStart;
    ui.calSearch = e.target.value;
    render();
    const again = document.getElementById("calSearch");
    if (again) { again.focus(); again.setSelectionRange(pos, pos); }
    return;
  }
  if (e.target.id === "modSearch") {
    const pos = e.target.selectionStart;
    ui.modSearch = e.target.value;
    render();
    const again = document.getElementById("modSearch");
    if (again) { again.focus(); again.setSelectionRange(pos, pos); }
  }
  if (e.target.dataset.change === "catcolor") {
    state.settings.plan[e.target.dataset.key] = e.target.value;
    applyTheme();
    clearTimeout(colorTimer);
    colorTimer = setTimeout(commit, 400);
  }
  if (e.target.dataset.change === "color") {
    const mode = currentMode();
    state.settings.colors[mode] = { ...(state.settings.colors[mode] || {}), [e.target.dataset.key]: e.target.value };
    applyTheme();
    clearTimeout(colorTimer);
    colorTimer = setTimeout(commit, 400);
  }
});
let colorTimer = null;

document.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.name === "topic") {
    const w = document.getElementById("newTopicWrap");
    if (w) w.style.display = t.value === "__new" ? "block" : "none";
    const nt = t.form && t.form.querySelector("[data-newtopic]");
    if (nt) nt.style.display = t.value === "__new" ? "block" : "none";
  }
  if (t.name === "repeat") {
    const w = document.getElementById("untilWrap");
    if (w) w.style.display = t.value === "once" ? "none" : "block";
  }
  if (t.hasAttribute && t.hasAttribute("data-dash-zoom")) {
    state.settings.dash.zoomY = Number(t.value) / 100;
    commit();
    return;
  }
  if (t.dataset.change === "fontscale") {
    state.settings.fontScale = Number(t.value);
    saveDevice();
    applyTheme();
    return;
  }
  if (t.dataset.change === "scrollbars") {
    state.settings.scrollbars = t.checked;
    commit();
    return;
  }
  if (t.dataset.change === "autorange") {
    state.settings.autoRange = t.checked;
    commit();
    return;
  }
  if (t.dataset.dashColor) {
    state.settings.dash[t.dataset.dashColor] = t.value;
    commit();
    return;
  }
  if (t.dataset.calrange) {
    state.settings.cal = { ...calSet(), [t.dataset.calrange === "w" ? "w" : "h"]: Number(t.value) };
    commit();
    return;
  }
  if (t.hasAttribute && t.hasAttribute("data-plan-zoom")) {
    state.settings.zoomY = Number(t.value) / 100;
    commit();
    return;
  }
  if (t.dataset.planRange) {
    const key = t.dataset.planRange;
    const val = Number(t.value);
    const s = state.settings;
    const start = key === "dayStart" ? val : s.dayStart;
    const end = key === "dayEnd" ? val : s.dayEnd;
    if (end <= start) { appAlert("Das Ende muss nach dem Beginn liegen."); return; }
    s[key] = val;
    commit();
    return;
  }
  if (t.id === "evColorPick") {
    const f = t.closest("form");
    f.elements.color.value = t.value;
    f.querySelectorAll(".sw").forEach((s) => s.classList.remove("on"));
    return;
  }
  if (t.dataset.mcolorpick) {
    const mod = state.modules[dec(t.dataset.m)];
    if (mod) { mod.color = t.value; commit(); }
    return;
  }
  if (t.dataset.plan) {
    state.settings.plan[t.dataset.plan] = t.value;
    commit();
    return;
  }
  const kind = t.dataset.change;
  if (kind === "dark") { state.settings.dark = t.checked; commit(); }
  if (kind === "weekend") { state.settings.weekend = t.checked; commit(); }
  if (kind === "ics") {
    const file = t.files[0];
    if (!file) return;
    const events = parseICS(await file.text());
    if (!events.length) { appAlert("In dieser Datei wurden keine Termine gefunden."); return; }
    state.events = events;
    const removed = trashedModuleNames();
    events.forEach((ev) => { if (!removed.has(ev.name)) ensureModule(ev.name); });
    commit();
    appAlert(`${events.length} Termine wurden geladen.`);
  }
  if (kind === "import") {
    const file = t.files[0];
    if (!file) return;
    try {
      const obj = JSON.parse(await file.text());
      if (!obj.events || !obj.modules) throw new Error("falsches Format");
      if (!(await appConfirm("Alle aktuellen Daten durch das Backup ersetzen?"))) return;
      state = normalize(obj);
      commit();
    } catch {
      appAlert("Die Datei konnte nicht gelesen werden.");
    }
  }
});

document.addEventListener("submit", async (e) => {
  const f = e.target;
  if (!f.dataset.form) return;
  e.preventDefault();
  const data = Object.fromEntries(new FormData(f));

  if (f.dataset.form === "appprompt") {
    const r = modalResolve;
    modalResolve = null;
    closeModal();
    if (r) r(new FormData(f).get("value").trim());
    return;
  }
  switch (f.dataset.form) {
    case "layoutform": {
      const p = { c: parseInt(data.c, 10), r: parseInt(data.r, 10), w: parseInt(data.w, 10), h: parseInt(data.h, 10) };
      if ([p.c, p.r, p.w, p.h].some((n) => !Number.isFinite(n))) { await appAlert("Bitte nur ganze Zahlen eingeben."); break; }
      p.w = layClamp(p.w, 1, LAY_COLS);
      p.c = layClamp(p.c, 1, LAY_COLS - p.w + 1);
      p.r = Math.max(1, p.r);
      p.h = Math.max(1, p.h);
      if (layOverlaps(f.dataset.scope, f.dataset.id, p)) { await appAlert("Dort liegt schon eine andere Karte. Bitte andere Werte wählen."); break; }
      closeModal();
      saveScopeLayout(f.dataset.scope, f.dataset.id, p);
      break;
    }
    case "topic": {
      const mod = state.modules[dec(f.dataset.m)];
      mod.topics.push({ id: uid(), title: data.title.trim(), done: false });
      f.reset(); commit(); break;
    }
    case "note": {
      const mod = ensureModule(data.module);
      let topicId = data.topic || "";
      if (topicId === "__new") {
        const title = (data.newTopic || "").trim();
        if (title) { topicId = uid(); mod.topics.push({ id: topicId, title, done: false }); }
        else topicId = "";
      }
      if (data.id) {
        const n = mod.notes.find((x) => x.id === data.id);
        if (n) {
          Object.assign(n, { date: data.date, done: data.done.trim(), todo: "" });
          if (topicId) n.topicId = topicId; else delete n.topicId;
        }
      } else {
        const entry = { id: uid(), date: data.date, done: data.done.trim(), todo: "", created: Date.now() };
        if (topicId) entry.topicId = topicId;
        mod.notes.push(entry);
      }
      closeModal(); commit(); break;
    }
    case "evcreate": {
      const start = toMin(data.start);
      const end = toMin(data.end);
      if (!(end > start)) { appAlert("Das Ende muss nach dem Beginn liegen."); break; }
      const dates = seriesDates(data.date, data.repeat, data.until);
      if (!dates.length) { appAlert("Mit diesen Angaben entsteht kein Termin."); break; }
      const name = data.name.trim();
      dates.forEach((d) => state.events.push({
        id: uid(), name, date: d, start, end, room: (data.room || "").trim(), desc: "",
      }));
      if (data.protokoll) ensureModule(name);
      closeModal(); commit(); break;
    }
    case "evedit": {
      const ev = state.events.find((x) => x.id === f.dataset.id);
      if (!ev) break;
      const start = toMin(data.start);
      const end = toMin(data.end);
      if (!(end > start)) { appAlert("Das Ende muss nach dem Beginn liegen."); break; }
      const old = ev.name;
      const nw = (data.name || "").trim() || old;
      if (nw !== old) {
        state.events.forEach((x) => { if (x.name === old) x.name = nw; });
        if (state.modules[old]) {
          if (state.modules[nw]) {
            state.modules[nw].topics = [...state.modules[nw].topics, ...state.modules[old].topics];
            state.modules[nw].notes = [...state.modules[nw].notes, ...state.modules[old].notes];
          } else {
            state.modules[nw] = state.modules[old];
          }
          delete state.modules[old];
        }
      }
      ev.date = data.date;
      ev.start = start;
      ev.end = end;
      ev.room = (data.room || "").trim();
      if (state.modules[nw] || data.protokoll) ensureModule(nw).color = data.color;
      closeModal(); commit(); break;
    }
    case "todo": {
      const entry = {
        title: data.title.trim(),
        type: data.type,
        priority: data.priority || "mittel",
        date: data.date || "",
        time: data.time || "",
        duration: Math.max(15, Number(data.duration) || DEFAULT_DURATION),
      };
      if (data.id) {
        const t = state.todos.find((x) => x.id === data.id);
        if (t) Object.assign(t, entry);
      } else {
        state.todos.push({ id: uid(), done: false, ...entry });
      }
      closeModal(); commit(); break;
    }
    case "quicknote": {
      const text = (data.text || "").trim();
      if (!text) break;
      const mod = ensureModule(data.module);
      mod.notes.push({ id: uid(), date: iso(new Date()), done: text, todo: "", created: Date.now() });
      f.reset(); commit(); break;
    }
    case "notepanel": {
      const text = (data.text || "").trim();
      if (!text) break;
      const mod = ensureModule(dec(f.dataset.m));
      let topicId = data.topic && mod.topics.some((t) => t.id === data.topic) ? data.topic : "";
      if (data.topic === "__new") {
        const title = (data.newTopic || "").trim();
        if (title) { topicId = uid(); mod.topics.push({ id: topicId, title, done: false }); }
      }
      if (data.id) {
        const n = mod.notes.find((x) => x.id === data.id);
        if (n) {
          n.done = text;
          if (topicId) n.topicId = topicId; else delete n.topicId;
        }
        ui.editNote = null;
      } else {
        const entry = { id: uid(), date: f.dataset.date, done: text, todo: "", created: Date.now() };
        if (topicId) entry.topicId = topicId;
        mod.notes.push(entry);
      }
      commit(); break;
    }
    case "quicktodo": {
      const title = (data.title || "").trim();
      if (!title) break;
      state.todos.push({ id: uid(), title, type: "todo", priority: "mittel", date: data.date || "", time: "", duration: DEFAULT_DURATION, done: false });
      f.reset(); commit(); break;
    }
    case "card": {
      let url = (data.url || "").trim();
      if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
      const entry = { title: data.title.trim(), url, note: (data.note || "").trim(), color: data.color || "" };
      if (data.id) {
        const c = state.cards.find((x) => x.id === data.id);
        if (c) Object.assign(c, entry);
      } else {
        state.cards.push({ id: uid(), ...entry });
      }
      closeModal(); commit(); break;
    }
    case "semester":
      state.settings.semester = data.semester.trim();
      commit(); break;
    case "login":
      await cloudSignIn(data.email.trim(), data.password);
      break;
  }
});

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `studienplaner-backup-${iso(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- Cloud (Supabase) ----------
let sb = null;
let session = null;
let authChecked = false;
let pushTimer = null;

function loginScreen() {
  return `<div class="card login-card">
    <h2 style="margin-top:0">Studienplaner</h2>
    <p class="muted">Bitte anmelden, um deinen Stundenplan und deine Notizen zu sehen.</p>
    <form data-form="login">
      <label class="muted">E-Mail</label>
      <input type="email" name="email" required autocomplete="username">
      <label class="muted">Passwort</label>
      <input type="password" name="password" required autocomplete="current-password">
      <div class="row" style="margin-top:14px"><button class="btn">Anmelden</button></div>
    </form>
  </div>`;
}

function cloudConfigured() {
  return !!window.supabase
    && typeof SUPABASE_URL === "string" && !SUPABASE_URL.startsWith("HIER")
    && typeof SUPABASE_ANON_KEY === "string" && !SUPABASE_ANON_KEY.startsWith("HIER");
}

function setStatus(text) {
  document.querySelectorAll(".syncStatus").forEach((el) => (el.textContent = text));
}

function initCloud() {
  if (!cloudConfigured()) { setStatus("lokal"); return; }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  sb.auth.onAuthStateChange((_event, s) => {
    session = s;
    authChecked = true;
    render();
    if (s) cloudPull(); else setStatus("lokal");
  });
  sb.auth.getSession().then(({ data }) => {
    session = data.session;
    authChecked = true;
    render();
    if (session) cloudPull(); else setStatus("lokal");
  });
}

async function cloudSignIn(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) appAlert("Anmeldung fehlgeschlagen: " + error.message);
}

async function cloudSignOut() {
  await sb.auth.signOut();
  session = null;
  setStatus("lokal");
  render();
}

// Die neuere Version gewinnt. Papierkorb und Verlauf sind Teil des Stands und reisen mit.
async function cloudPull() {
  if (!session) return;
  setStatus("synchronisiere …");
  const { data, error } = await sb.from("user_data").select("data").eq("user_id", session.user.id).maybeSingle();
  if (error) { setStatus("Sync-Fehler"); return; }
  if (data && data.data && (data.data.updatedAt || 0) > state.updatedAt) {
    state = normalize(data.data);
    lastSnap = snapshot();
    saveLocal();
    saveDevice();
    setStatus("synchron");
    render();
  } else {
    await cloudPush();
  }
}

async function cloudPush() {
  if (!session) return;
  const { error } = await sb.from("user_data").upsert({
    user_id: session.user.id,
    data: { ...syncable(state), history: state.history, future: state.future, trash: state.trash },
    updated_at: new Date().toISOString(),
  });
  setStatus(error ? "Sync-Fehler" : "synchron");
}

function scheduleCloud() {
  if (!session) return;
  setStatus("speichert …");
  clearTimeout(pushTimer);
  pushTimer = setTimeout(cloudPush, 1200);
}

// ---------- Start ----------
lastSnap = snapshot();
ui.tab = state.settings.startTab || ui.tab;
initCloud();
render();
// Systemfarbe folgen: beim Wechsel des Geräte-Designs neu zeichnen
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (state.settings.themeMode === "system") render();
});
setInterval(() => { if (ui.tab === "stundenplan" && !document.querySelector(".modal")) render(); }, 60000);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// ---------- Kalender: To-dos per Ziehen auf einen anderen Tag verschieben ----------
// Maus: sofort ziehen. Handy: kurz gedrückt halten, dann ziehen (Scrollen bleibt sonst möglich).
let drag = null;
let suppressClick = false;

document.addEventListener("pointerdown", (e) => {
  if ((ui.tab !== "kalender" && ui.tab !== "stundenplan") || e.button > 0 || e.target.closest(".modal")) return;
  const row = e.target.closest("[data-drag]");
  if (!row) return;
  drag = {
    id: row.dataset.drag,
    title: (row.querySelector("b") || row).textContent.trim(),
    sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY,
    touch: e.pointerType !== "mouse", active: false, target: null, timer: null,
  };
  if (drag.touch) drag.timer = setTimeout(() => startDrag(), 350);
});

function startDrag() {
  if (!drag || drag.active) return;
  drag.active = true;
  if (navigator.vibrate) navigator.vibrate(15);
  const g = document.createElement("div");
  g.id = "dragGhost";
  g.className = "drag-ghost";
  g.textContent = drag.title;
  document.body.appendChild(g);
  document.body.classList.add("is-dragging");
  moveDrag(drag.x, drag.y);
}

function moveDrag(x, y) {
  const g = document.getElementById("dragGhost");
  if (g) g.style.transform = `translate(${x + 14}px, ${y - 12}px)`;
  document.querySelectorAll(".drop").forEach((c) => c.classList.remove("drop"));
  const under = document.elementFromPoint(x, y);
  const cell = under && under.closest(".mday[data-d]");
  const zone = under && under.closest("[data-dropnone]");
  const grid = under && under.closest(".grid[data-date]");
  if (grid && ui.tab === "stundenplan") { grid.classList.add("drop"); drag.target = grid.dataset.date; }
  else if (cell) { cell.classList.add("drop"); drag.target = cell.dataset.d; }
  else if (zone) { zone.classList.add("drop"); drag.target = ""; }
  else drag.target = null;
}

document.addEventListener("pointermove", (e) => {
  if (!drag) return;
  drag.x = e.clientX; drag.y = e.clientY;
  if (!drag.active) {
    const dist = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy);
    if (drag.touch) {
      if (dist > 12) { clearTimeout(drag.timer); drag = null; }
      return;
    }
    if (dist <= 6) return;
    startDrag();
  }
  moveDrag(e.clientX, e.clientY);
});

document.addEventListener("touchmove", (e) => {
  if (drag && drag.active) e.preventDefault();
}, { passive: false });

function endDrag(cancelled, x, y) {
  if (!drag) return;
  const d = drag;
  drag = null;
  clearTimeout(d.timer);
  if (!d.active) return;
  const g = document.getElementById("dragGhost");
  if (g) g.remove();
  document.body.classList.remove("is-dragging");
  document.querySelectorAll(".drop").forEach((c) => c.classList.remove("drop"));
  // Der nachfolgende Klick nach dem Ziehen soll nicht den Tag öffnen
  suppressClick = true;
  setTimeout(() => { suppressClick = false; }, 300);
  if (!cancelled && ui.tab === "stundenplan") {
    // Im Stundenplan: Uhrzeit aus der Höhe, auf 15 Minuten gerundet
    const under = x != null ? document.elementFromPoint(x, y) : null;
    const grid = under && under.closest(".grid[data-date]");
    const t = state.todos.find((q) => q.id === d.id);
    if (grid && t) {
      const r = grid.getBoundingClientRect();
      let min = START_MIN + (y - r.top) / PX_PER_MIN;
      min = Math.round(min / 15) * 15;
      min = Math.max(START_MIN, Math.min(min, END_MIN - 15));
      t.date = grid.dataset.date;
      t.time = fmtMin(min);
      ui.selDate = t.date;
      commit();
    }
    return;
  }
  if (cancelled || d.target === null) return;
  const t = state.todos.find((x) => x.id === d.id);
  if (!t || (t.date || "") === d.target) return;
  t.date = d.target;
  if (d.target) {
    const dt = parseIso(d.target);
    ui.selDate = d.target;
    ui.month = new Date(dt.getFullYear(), dt.getMonth(), 1);
  }
  commit();
}
// Am Handy: waagerecht wischen wechselt Tag bzw. Woche
let swipeStart = null;
document.addEventListener("touchstart", (e) => {
  swipeStart = null;
  if (ui.tab !== "stundenplan" || ui.layEdit || e.touches.length !== 1) return;
  if (!e.target.closest || !e.target.closest(".week")) return;
  const t = e.touches[0];
  swipeStart = { x: t.clientX, y: t.clientY, t: Date.now() };
}, { passive: true });
document.addEventListener("touchend", (e) => {
  const st = swipeStart;
  swipeStart = null;
  if (!st || (drag && drag.active) || e.changedTouches.length !== 1) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - st.x, dy = t.clientY - st.y;
  if (Date.now() - st.t > 700 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
  navigate(dx < 0 ? 1 : -1);
}, { passive: true });

// Kurzes Vibrieren beim Antippen der unteren Leiste (nur Geräte, die es unterstützen)
document.addEventListener("focusin", (e) => {
  if (e.target.id === "calSearch") {
    ui.calFilterOpen = true;
    document.getElementById("calFilters")?.classList.add("open");
  }
});
document.addEventListener("pointerdown", (e) => {
  if (e.target.closest && e.target.closest(".tabbar button") && navigator.vibrate) navigator.vibrate(6);
}, true);
document.addEventListener("pointerup", (e) => endDrag(false, e.clientX, e.clientY));
document.addEventListener("pointercancel", () => endDrag(true));
document.addEventListener("click", async (e) => {
  if (!suppressClick) return;
  suppressClick = false;
  e.stopPropagation();
  e.preventDefault();
}, true);
