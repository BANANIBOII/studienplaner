// Helfer, Daten, Zustand, Farben, Stundenplan-Import, Render
// Teil von app.js (aufgeteilt). Reihenfolge der Dateien in index.html beachten.
// Eigene Linien-Symbole (ersetzen Zeichen wie ✎ ⋮ ✕, die manche Handys als leeres Kästchen zeigen)
const ICON_SVG = (d, cls = "ico") => `<svg class="${cls}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  edit: ICON_SVG('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  more: ICON_SVG('<circle cx="12" cy="5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/>'),
  x: ICON_SVG('<path d="M6 6l12 12M18 6 6 18"/>'),
  check: ICON_SVG('<path d="M5 12.5l4.2 4.2L19 7"/>'),
  layout: ICON_SVG('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
  up: ICON_SVG('<path d="M6 14l6-6 6 6"/>', "ico ico-sm"),
  down: ICON_SVG('<path d="M6 10l6 6 6-6"/>', "ico ico-sm"),
  next: ICON_SVG('<path d="M9 6l6 6-6 6"/>', "ico ico-sm"),
  back: ICON_SVG('<path d="M15 6l-6 6 6 6"/>'),
  reload: ICON_SVG('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
  external: ICON_SVG('<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>', "ico ico-sm"),
  undo: ICON_SVG('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  redo: ICON_SVG('<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'),
  cup: ICON_SVG('<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3v2M11 3v2M14 3v2"/>'),
  spark: ICON_SVG('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/>'),
  book: ICON_SVG('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 20.5V5.5"/>'),
  note: ICON_SVG('<path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'),
  search: ICON_SVG('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>'),
  swap: ICON_SVG('<path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="M17 20l4-4-4-4"/><path d="M21 16H7"/>'),
};
// Fehleranzeige auf dem Bildschirm (hilft, Fehler am Handy zu finden). Tippen schließt sie.
function showJsError(msg, file = "", line = "") {
  try {
    let box = document.getElementById("jsErr");
    if (!box) {
      box = document.createElement("div");
      box.id = "jsErr";
      box.style.cssText = "position:fixed;left:8px;right:8px;bottom:70px;z-index:9999;background:#7f1d1d;color:#fff;font:12px/1.4 monospace;padding:8px 10px;border-radius:10px;white-space:pre-wrap;max-height:40vh;overflow:auto";
      box.onclick = () => box.remove();
      document.body.appendChild(box);
    }
    box.textContent += `${msg} ${file ? file.split("/").pop() + ":" + line : ""}\n`;
  } catch (_) {}
}
window.addEventListener("error", (e) => showJsError(e.message, e.filename, e.lineno));
window.addEventListener("unhandledrejection", (e) => showJsError("Promise: " + String(e.reason && (e.reason.message || e.reason))));
// ============================================================
//  Studienplaner – Hauptprogramm
// ============================================================

const LS_KEY = "studienplaner-v1";
// Zeitraum und Höhe des Stundenplans im Reiter. Mit „automatisch“ richtet er sich nach den
// sichtbaren Terminen (früheste Stunde −30 Min, späteste Stunde +30 Min).
let START_MIN = 7 * 60;
let END_MIN = 20 * 60;
let HOUR_PX = 42;
let planScreenH = 0;      // zuletzt gemessene Höhe des Stundenplan-Bereichs (render() setzt sie sofort wieder, bevor die Scrollposition zurückkommt)
let planGridAvail = 480;  // verfügbare Höhe für das Raster im Stundenplan (wird in fitPlan gemessen)
let PX_PER_MIN = HOUR_PX / 60;
function visibleDates() {
  if (ui.view === "day") return [ui.dayDate];
  const mon = addDays(mondayOf(new Date()), ui.weekOffset * 7);
  const n = state.settings.weekend ? 7 : 5;
  return Array.from({ length: n }, (_, i) => iso(addDays(mon, i)));
}
// Sichtbarer Zeitbereich für die übergebenen Tage (Termine und Aufgaben mit Uhrzeit)
function rangeFor(dates) {
  const s = state.settings;
  let start = (s.dayStart ?? 7) * 60;
  let end = (s.dayEnd ?? 20) * 60;
  const pts = [
    ...state.events.filter((e) => dates.includes(e.date)).map((e) => ({ start: e.start, end: e.end })),
    ...state.todos.filter((t) => t.time && (dates.includes(t.date) || dates.includes(t.endDate)))
      .map((t) => ({ start: toMin(t.time), end: toMin(t.time) + (Number(t.duration) || DEFAULT_DURATION) })),
  ];
  if (pts.length) {
    start = Math.max(0, Math.min(...pts.map((p) => p.start)) - 30);
    end = Math.min(24 * 60, Math.max(...pts.map((p) => p.end)) + 30);
  }
  return [start, end];
}
function applyDayRange(dates = visibleDates()) {
  const s = state.settings;
  let start = (s.dayStart ?? 7) * 60;
  let end = (s.dayEnd ?? 20) * 60;
  if (s.autoRange) [start, end] = rangeFor(dates);
  START_MIN = start;
  END_MIN = end;
  // Stundenplan: feste Höhe pro Stunde (nur durch Zoom oder Einstellung verändert), nicht nach Bildschirm berechnet
  // Wochenansicht: das Raster hat immer dieselbe Höhe, der sichtbare Zeitbereich wird darauf verteilt
  HOUR_PX = ui.tab === "stundenplan" ? planHourPx(s.zoomY) : 42 * (s.zoomY || 1);
  PX_PER_MIN = HOUR_PX / 60;
  document.documentElement.style.setProperty("--hour-px", HOUR_PX + "px");
  // Stundenplan-Positionen rechnen über diese Variable (CSS): beim Strecken genügt es, sie zu ändern
  document.documentElement.style.setProperty("--ppm", String(PX_PER_MIN));
}
// Stundenhöhe im Stundenplan (gleiche Formel wie bisher, nur ausgelagert)
function planHourPx(z) {
  return Math.max(20, Math.floor(planGridAvail / Math.max(1, (END_MIN - START_MIN) / 60))) * Math.max(1, z || 1);
}
// Länge in Minuten als CSS-Ausdruck, der sich beim Strecken über --ppm mitändert
const mpx = (mins) => `calc(${mins}px * var(--ppm))`;
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
const PLAN_DEFAULTS = { grid: "", now: "", todo: "#60a5fa", abgabe: "#f59e0b", klausur: "#f43f5e", done: "#22c55e" };

// Gerätespezifisch: bleibt im Browser dieses Geräts und geht NICHT in den Cloud-Abgleich
const DEVICE_LS = "studienplaner-device-v1";
const DEVICE_DEFAULTS = {
  dark: true, weekend: false, scrollbars: true, colors: { dark: {}, light: {} },
  themeMode: "", fontScale: 100, font: "inter", startTab: "dashboard", look: "glass", dynDay: false, daySlots: null,
  zoomY: 1, autoRange: false, dayStart: 7, dayEnd: 20, planStep: 30, planLines: false,
  dash: { zoomY: 1, grid: "", now: "" },
  planLook: { grid: "", now: "" },
  navSide: "",
  checkSide: "left",
  nfDev: { vib: "std", sound: true },
  layouts: {},
  cal: { style: "bar", w: 100, h: 100, fold: false },
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
  // Neue Presets (immer hinten anhängen, damit die Nummern der Presets stabil bleiben)
  { name: "Mint", colors: {
      dark:  { accent: "#2dd4bf", bg: "#071513", card: "#0e211e", text: "#d9fbf4", muted: "#7aa89f", now: "#fbbf24", line: "#17302b" },
      light: { accent: "#0f766e", bg: "#f0fbf8", card: "#ffffff", text: "#0b2a26", muted: "#5a7d77", now: "#d97706", line: "#d5ebe5" } } },
  { name: "Rosé", colors: {
      dark:  { accent: "#f9a8d4", bg: "#140a10", card: "#21121b", text: "#fce7f3", muted: "#b08aa0", now: "#fde047", line: "#311b28" },
      light: { accent: "#db2777", bg: "#fdf2f8", card: "#ffffff", text: "#3b0a22", muted: "#8f5a74", now: "#ca8a04", line: "#f5d4e5" } } },
  { name: "Kaffee", colors: {
      dark:  { accent: "#d6a77a", bg: "#120d09", card: "#1d1510", text: "#f5ebe0", muted: "#a08a78", now: "#f87171", line: "#2e221a" },
      light: { accent: "#8b5a2b", bg: "#faf6f1", card: "#ffffff", text: "#2b1d12", muted: "#7d6a58", now: "#b91c1c", line: "#ebe1d4" } } },
  { name: "Polarlicht", colors: {
      dark:  { accent: "#5eead4", bg: "#060b14", card: "#0d1626", text: "#e6fbff", muted: "#7f9bb5", now: "#c084fc", line: "#17243a" },
      light: { accent: "#0d9488", bg: "#f2f8fb", card: "#ffffff", text: "#0b1f2e", muted: "#5a7285", now: "#9333ea", line: "#dbe8f0" } } },
  { name: "Mitternacht", colors: {
      dark:  { accent: "#fcd34d", bg: "#05070f", card: "#0c1224", text: "#e8ecf8", muted: "#7d88a8", now: "#f472b6", line: "#1a2238" },
      light: { accent: "#92400e", bg: "#f7f5ef", card: "#ffffff", text: "#1f1a10", muted: "#7a6f58", now: "#be185d", line: "#e8e2d3" } } },
  { name: "Frühlingswiese", colors: {
      dark:  { accent: "#a3e635", bg: "#0a1108", card: "#131d10", text: "#f0fde4", muted: "#8ea27a", now: "#fb7185", line: "#1f2b18" },
      light: { accent: "#4d7c0f", bg: "#f7fbef", card: "#ffffff", text: "#1a2510", muted: "#66784f", now: "#e11d48", line: "#e0ebd0" } } },
];

// ---------- Tageszeit-Design: passt Hell/Dunkel und Farben an die Uhrzeit an (nur auf diesem Gerät) ----------
const DAY_SLOTS = [
  { from: 6, to: 11, label: "Morgen", def: { preset: "Mint", dark: false } },
  { from: 11, to: 17, label: "Tag", def: { preset: "Standard Türkis", dark: false } },
  { from: 17, to: 21, label: "Abend", def: { preset: "Sonnenuntergang", dark: true } },
  { from: 21, to: 30, label: "Nacht", def: { preset: "Mitternacht", dark: true } },   // 21–6 Uhr (Stunden 0–5 zählen als 24–29)
];
const dynOn = () => state.settings.dynDay === true;
// Design-ID eines Presets: "b:<Nummer>" für eingebaute, "u:<id>" für eigene
function presetColorsFor(pid) {
  if (!pid) return null;
  const key = pid.slice(2);
  const p = pid[0] === "b" ? BUILTIN_PRESETS[Number(key)] : (state.settings.presets || []).find((x) => x.id === key);
  return p ? p.colors : null;
}
// Gewählte Einstellung eines Abschnitts (Design-ID und Hell/Dunkel), sonst die Vorgabe
function slotSetting(i) {
  const d = DAY_SLOTS[i];
  const saved = (state.settings.daySlots || [])[i] || {};
  const bi = BUILTIN_PRESETS.findIndex((p) => p.name === d.def.preset);
  return {
    preset: saved.preset || (bi >= 0 ? "b:" + bi : "b:0"),
    dark: typeof saved.dark === "boolean" ? saved.dark : d.def.dark,
  };
}
function daySlot(date = new Date()) {
  let h = date.getHours();
  if (h < 6) h += 24;
  const found = DAY_SLOTS.findIndex((x) => h >= x.from && h < x.to);
  const i = found < 0 ? 1 : found;
  return { ...DAY_SLOTS[i], ...slotSetting(i) };
}

function applyPreset(pid) {
  const kind = pid[0];
  const key = pid.slice(2);
  const p = kind === "b" ? BUILTIN_PRESETS[Number(key)] : (state.settings.presets || []).find((x) => x.id === key);
  if (!p) return;
  state.settings.dynDay = false;
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
  if (dynOn()) return `Automatisch · ${daySlot().label}`;
  const all = [...BUILTIN_PRESETS, ...(state.settings.presets || [])];
  const hit = all.find((p) => designIsActive(p.colors));
  return hit ? hit.name : "Eigenes Design";
}

// Karte in den Einstellungen: zeigt das aktuelle Design und öffnet die Auswahl
function viewDesignCard() {
  const c = themeColors();
  const lookSel = (v, label) => `<button class="look-opt${(state.settings.look === "m3") === (v === "m3") ? " on" : ""}" data-act="looksel" data-v="${v}">${label}</button>`;
  return `<div class="card"><h3>Design</h3>
    <div class="look-toggle">${lookSel("glass", "Glas")}${lookSel("m3", "Material 3")}</div>
    <div class="row" style="justify-content:space-between;gap:12px;margin-top:12px">
      <div class="grow"><b>${esc(activeDesignName())}</b><div class="muted">Gilt nur für dieses Gerät</div></div>
      <div class="dprev-mini" style="background:${c.bg}"><span style="background:${c.card}"></span><i style="background:${c.accent}"></i></div>
    </div>
    <div style="margin-top:12px">${designListHTML()}</div>
  </div>`;
}

// Alle Designs direkt auf der Seite (kein eigenes Fenster mehr)
// KI-Key: nur Status lesen (Zeitpunkt), den Key selbst kann die App nicht auslesen
let keyStatusText = "Status wird geladen …";
let keyStatusLoaded = false;
async function refreshKeyStatus() {
  if (!sb || !session) { keyStatusText = "Anmelden, um den Key zu speichern."; return; }
  try {
    const { data, error } = await sb.from("user_secrets").select("updated_at").eq("user_id", session.user.id).maybeSingle();
    if (error) throw error;
    keyStatusText = data ? `✓ Key gespeichert (${new Date(data.updated_at).toLocaleString("de-DE")})` : "Kein Key gespeichert.";
  } catch (_) { keyStatusText = "Status gerade nicht abrufbar."; }
  const el = document.getElementById("geminiStatus");
  if (el) el.textContent = keyStatusText;
}
async function saveGeminiKey(key) {
  if (!sb || !session) { showToast("Zum Speichern bitte anmelden"); return false; }
  // Erst neu anlegen, bei vorhandenem Key ändern (Upsert braucht Leserechte, die der Key-Spalte fehlen)
  const row = { gemini_key: key, updated_at: new Date().toISOString() };
  let { error } = await sb.from("user_secrets").insert({ user_id: session.user.id, ...row });
  if (error && error.code === "23505") {
    ({ error } = await sb.from("user_secrets").update(row).eq("user_id", session.user.id));
  }
  if (error) { console.warn("Key speichern:", error); showToast("Speichern fehlgeschlagen"); return false; }
  return true;
}
// Erkannte Symbole (Bild → Merkmal): ansehen und korrigieren
let iconData = null;
let iconsLoaded = false;
let iconErr = "";
async function loadIcons() {
  if (!session) { iconErr = "Anmelden, um die Symbole zu sehen."; render(); return; }
  try {
    const r = await fetch(SUPABASE_URL + "/functions/v1/mensa?icons=1", {
      headers: { Authorization: "Bearer " + session.access_token, apikey: SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(15000),
    });
    const j = await r.json();
    if (!r.ok || !j.icons) throw new Error(j.fehler || "Fehler");
    iconData = j;
    iconErr = "";
  } catch (_) { iconErr = "Symbole gerade nicht abrufbar."; }
  render();
}
async function saveIcon(hash, tag) {
  if (!session) return;
  try {
    const r = await fetch(SUPABASE_URL + "/functions/v1/mensa?icon=1", {
      method: "POST",
      headers: { Authorization: "Bearer " + session.access_token, apikey: SUPABASE_ANON_KEY, "content-type": "application/json" },
      body: JSON.stringify({ hash, tag: tag || null }),
    });
    if (!r.ok) throw new Error("save");
    showToast("✓ Symbol gespeichert");
  } catch (_) { showToast("Speichern fehlgeschlagen"); }
  await loadIcons();
}
// Angemeldete Geräte (Sitzungen des Kontos), abrufbar über die Funktion geraete
let geraeteData = null;
let geraeteErr = "";
let geraeteBusy = false;
async function loadGeraete() {
  if (!session || geraeteBusy) return;
  geraeteBusy = true;
  try {
    const r = await fetch(SUPABASE_URL + "/functions/v1/geraete", {
      headers: { Authorization: "Bearer " + session.access_token, apikey: SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(15000),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.fehler || "fehler");
    geraeteData = j.geraete || [];
    geraeteErr = "";
  } catch (_) { geraeteErr = "Geräte gerade nicht abrufbar."; }
  geraeteBusy = false;
  render();
}
async function geraetAbmelden(id) {
  if (!(await appConfirm("Dieses Gerät abmelden? Dort musst du dich danach wieder anmelden.", "Abmelden"))) return;
  try {
    const r = await fetch(SUPABASE_URL + "/functions/v1/geraete", {
      method: "POST",
      headers: { Authorization: "Bearer " + session.access_token, apikey: SUPABASE_ANON_KEY, "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.fehler || "fehler");
    showToast("✓ Gerät abgemeldet");
  } catch (e) { showToast(String(e.message).includes("kann hier nicht") ? "Dieses Gerät kann hier nicht abgemeldet werden" : "Abmelden hat nicht geklappt"); }
  geraeteData = null;
  loadGeraete();
}
function geraeteHTML() {
  if (!session) return `<div class="card"><h3>Angemeldete Geräte</h3><p class="muted">Anmelden, um die Geräte zu sehen.</p></div>`;
  if (geraeteData === null && !geraeteErr) loadGeraete();
  const zeit = (s) => (s ? new Date(s).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "–");
  const liste = geraeteData
    ? (geraeteData.length
      ? geraeteData.map((g) => `<div class="listrow" style="align-items:center;gap:8px">
          <div class="grow"><b>${esc(g.name)}${g.aktuell ? " · dieses Gerät" : ""}</b>
            <div class="muted" style="font-size:13px">Zuletzt aktiv: ${esc(zeit(g.aktiv))} · angemeldet seit ${esc(zeit(g.angelegt))}</div>
            <div class="${g.push ? "st ok" : "muted"}" style="font-size:13px">${g.push ? "✓ Benachrichtigungen aktiv" : "Keine Benachrichtigungen auf diesem Gerät"}</div></div>
          ${g.aktuell ? "" : `<button class="btn ghost btn-sm" data-act="geraetabmelden" data-id="${esc(g.id)}">Abmelden</button>`}
        </div>`).join("")
      : `<div class="muted">Keine Anmeldungen gefunden.</div>`)
    : `<div class="muted">${esc(geraeteErr || "Lädt …")}</div>`;
  return `<div class="card"><h3>Angemeldete Geräte</h3>
    <p class="muted" style="margin-top:0">Hier siehst du, wo dein Konto angemeldet ist. Ein anderes Gerät kannst du abmelden, danach muss man sich dort neu anmelden.</p>
    ${liste}
    <div class="row" style="margin-top:10px"><button class="btn ghost btn-sm" data-act="geraeteneu">Aktualisieren</button></div>
  </div>`;
}
function iconsCardHTML() {
  if (!iconData) return `<div class="card"><h3>Erkannte Symbole</h3><p class="muted" style="margin:0">${iconErr || "Wird geladen …"}</p></div>`;
  const tagOf = new Map(iconData.icons.map((x) => [x.hash, x]));
  const imgOf = new Map();
  for (const u of iconData.urls) if (!imgOf.has(u.hash)) imgOf.set(u.hash, u.url);
  const rows = iconData.icons.map((ic) => {
    const opts = [...iconData.tags, "keines"].map((t) => `<option value="${t}" ${(ic.tag || "keines") === t ? "selected" : ""}>${t === "keines" ? "kein Merkmal" : t}</option>`).join("");
    return `<div class="row" style="gap:8px;align-items:center;padding:6px 0;border-top:1px solid var(--line)">
      ${imgOf.get(ic.hash) ? `<img src="${esc(imgOf.get(ic.hash))}" alt="" style="width:28px;height:28px;object-fit:contain">` : ""}
      <select class="grow" data-change="icontag" data-hash="${ic.hash}">${opts}</select>
      <span class="muted" style="font-size:12px">${ic.bestaetigt ? "✓" : "KI"}</span>
    </div>`;
  }).join("");
  return `<div class="card"><h3>Erkannte Symbole</h3>
    <p class="muted" style="margin-top:0">Die KI hat diese Bilder einmal zugeordnet. Stimmt eine Zuordnung nicht, kannst du sie hier ändern. „KI“ heißt: noch nicht bestätigt.</p>
    ${rows || '<p class="muted">Noch keine Symbole erkannt.</p>'}
  </div>`;
}
async function deleteGeminiKey() {
  if (!sb || !session) return;
  const { error } = await sb.from("user_secrets").delete().eq("user_id", session.user.id);
  if (error) { showToast("Entfernen fehlgeschlagen"); return; }
  showToast("Key entfernt");
  refreshKeyStatus();
}

// Auswahl aller Designs (eingebaute und eigene) für die Tageszeit-Abschnitte
function allPresetOpts(selected) {
  const all = [
    ...BUILTIN_PRESETS.map((p, i) => ["b:" + i, p.name]),
    ...(state.settings.presets || []).map((p) => ["u:" + p.id, p.name]),
  ];
  return all.map(([v, n]) => `<option value="${esc(v)}" ${v === selected ? "selected" : ""}>${esc(n)}</option>`).join("");
}
function dynCardHTML() {
  return `<div class="card"><h3>Automatisch nach Tageszeit</h3>
    <label class="row"><input type="checkbox" data-change="dynday" ${dynOn() ? "checked" : ""}> Design je nach Uhrzeit wechseln</label>
    <p class="muted" style="margin:8px 0 12px">Gilt nur für dieses Gerät. Für jeden Abschnitt wählst du Design und Hell oder Dunkel.</p>
    ${DAY_SLOTS.map((d, i) => {
      const cfg = slotSetting(i);
      return `<div class="dayslot" style="padding:10px 0;border-top:1px solid var(--line)">
        <div class="row" style="justify-content:space-between"><b>${d.label}</b><span class="muted">${d.from % 24}–${d.to % 24} Uhr</span></div>
        <div class="row" style="gap:8px;margin-top:6px">
          <select class="grow" data-change="dynslot" data-i="${i}" data-f="preset">${allPresetOpts(cfg.preset)}</select>
          <select data-change="dynslot" data-i="${i}" data-f="dark">
            <option value="light" ${cfg.dark ? "" : "selected"}>Hell</option>
            <option value="dark" ${cfg.dark ? "selected" : ""}>Dunkel</option>
          </select>
        </div>
      </div>`;
    }).join("")}
  </div>`;
}

function designListHTML() {
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
  return `<p class="muted" style="margin-top:0">Jedes Design hat eine helle und eine dunkle Variante. Die Auswahl gilt nur für dieses Gerät.</p>
    <div class="dgrid">
      ${BUILTIN_PRESETS.map((p, i) => row("b:" + i, p.name, p.colors, false)).join("")}
      ${mine.map((p) => row("u:" + p.id, p.name, p.colors, true)).join("")}
    </div>
    <div class="row" style="margin-top:14px"><button class="btn ghost" data-act="presetsave">Aktuelles Design speichern</button></div>`;
}

// Früher das Design-Fenster; wird nicht mehr genutzt, bleibt zur Sicherheit erhalten
function openDesignModal() {
  openModal(`<h3>Design wählen</h3>${designListHTML()}
    <div class="modal-foot"><button class="btn ghost" data-act="mclose">Schließen</button></div>`);
}

// Eigene Karten im Dashboard (Verknüpfungen, Notizen)
// Meine Karten: jede Karte steht für sich (keine Rahmenkarte mehr), damit sie im Layout frei beweglich ist
function linkItemHTML(c) {
  const inner = `<b>${esc(c.title)}</b>${c.note ? `<span class="muted">${esc(c.note)}</span>` : ""}${c.url ? `<span class="muted" style="font-size:12px">${ICON.external} ${esc(c.url.replace(/^https?:\/\//, ""))}</span>` : ""}`;
  const main = c.url
    ? `<a class="linkmain" href="${esc(c.url)}" target="_blank" rel="noopener">${inner}</a>`
    : `<div class="linkmain">${inner}</div>`;
  return `<div class="linkcard" style="border-color:${c.color || "var(--accent)"}">
    ${main}
    <div class="row" style="gap:4px;justify-content:flex-end"><button class="btn ghost" data-act="cardedit" data-id="${c.id}">${ICON.edit}</button></div>
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
    dayStart: s.dayStart, dayEnd: s.dayEnd, planStep: s.planStep || 30, planLines: !!s.planLines, dash: s.dash, navSide: s.navSide || "", checkSide: s.checkSide || "left", scrollbars: s.scrollbars !== false, themeMode: s.themeMode || "", dynDay: s.dynDay === true, daySlots: s.daySlots || null, fontScale: s.fontScale || 100, font: s.font || "inter", startTab: s.startTab || "dashboard", look: s.look || "glass", layouts: s.layouts || {}, cal: s.cal || DEVICE_DEFAULTS.cal, nfDev: { ...DEVICE_DEFAULTS.nfDev, ...(s.nfDev || {}) },
    planLook: { grid: (s.plan && s.plan.grid) || "", now: (s.plan && s.plan.now) || "" },
  };
}
function saveDevice() {
  const d = deviceFromSettings(state.settings);
  try { localStorage.setItem(DEVICE_LS, JSON.stringify(d)); } catch {}
  nfPrefsToDb(d.nfDev);
}
// Der Service Worker kann localStorage nicht lesen, daher liegt die Einstellung zusätzlich in IndexedDB (gleiche Datenbank wie in sw.js)
function nfPrefsToDb(v) {
  try {
    const req = indexedDB.open("studienplaner-device", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(v, "nfDev");
      tx.oncomplete = () => db.close();
    };
  } catch (_) {}
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
    showToast(`Rückgängig: ${meta.label} · Zu: ${TAB_NAMES[ui.tab] || ui.tab}`, 9000);
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

// Kategorie eines Protokolls: vom Nutzer gewählt (module.kind), sonst aus Namen bzw. ICS-Art erkannt
const KIND_LABEL = { vl: "Vorlesung", ueb: "Übung", tut: "Tutorium" };
function modKindOf(n) {
  const k = state.modules[n] && state.modules[n].kind;
  if (k) return k;
  const ev = state.events.find((x) => x.name === n && x.desc);
  const s = `${n} ${ev ? parseEventDesc(ev.desc).art || "" : ""}`;
  return /tutorium/i.test(s) ? "tut" : /übung/i.test(s) ? "ueb" : "vl";
}

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
// Erledigte Einträge bekommen eine eigene Farbe (in den Einstellungen anpassbar)
const calColor = (t) => (t.done ? catColor("done") : catColor(t.type));
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
  planEdit: false,
  showHidden: false,
  noteFor: null,
  editNote: null,
  noteWindow: false,
  dashNoteDismissed: false,
};

// ---------- Farben / Design ----------
function currentMode() {
  if (dynOn()) return daySlot().dark ? "dark" : "light";
  if (state.settings.themeMode === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return state.settings.dark ? "dark" : "light";
}
function themeColors() {
  const mode = currentMode();
  let custom = (state.settings.colors || {})[mode];
  if (dynOn()) {
    const pc = presetColorsFor(daySlot().preset);
    if (pc) custom = pc[mode];
  }
  return { ...THEME_DEFAULTS[mode], ...(custom || {}) };
}
// Schriftarten (pro Gerät). Serif und Rund werden erst geladen, wenn sie gewählt sind.
const FONT_STACKS = {
  inter: `"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
  system: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
  serif: `"Source Serif 4", Georgia, "Times New Roman", serif`,
  rounded: `"Nunito", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
};
const FONT_CSS = {
  serif: "https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600;700&display=swap",
  rounded: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap",
};
function applyFont() {
  const k = FONT_STACKS[state.settings.font] ? state.settings.font : "inter";
  if (FONT_CSS[k] && !document.querySelector(`link[data-font="${k}"]`)) {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = FONT_CSS[k];
    l.dataset.font = k;
    document.head.appendChild(l);
  }
  document.body.style.fontFamily = FONT_STACKS[k];
}

function applyTheme() {
  document.body.classList.toggle("dark", currentMode() === "dark");
  document.body.style.zoom = String((state.settings.fontScale || 100) / 100);
  applyFont();
  // Farbe der Statusleiste am Handy an den aktuellen Hintergrund anpassen
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.setAttribute("content", currentMode() === "dark" ? "#0a1414" : "#eef2f7");
  document.body.classList.toggle("look-m3", state.settings.look === "m3");
  document.body.classList.toggle("lite", isWeakDevice() && state.settings.look !== "glass-full");
  document.body.classList.toggle("nav-left", state.settings.navSide === "left");
  document.body.classList.toggle("nav-bottom", state.settings.navSide === "bottom");
  document.body.classList.toggle("check-right", state.settings.checkSide === "right");
  document.body.classList.toggle("no-scrollbars", state.settings.scrollbars === false);
  document.documentElement.classList.toggle("no-scrollbars", state.settings.scrollbars === false);
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
// Neuzeichnen, aber nicht unter dem Finger und nicht während die Ansicht noch ausläuft.
// Mehrere Anfragen in dieser Zeit ergeben einen einzigen Neuaufbau, sobald Ruhe ist.
let renderQueued = false;
function render() {
  if (scrollBusy()) {
    if (!renderQueued) { renderQueued = true; setTimeout(() => { renderQueued = false; render(); }, 200); }
    return;
  }
  renderNow();
}
function renderNow() {
  applyPendingSwipe();
  syncHistoryNav();
  requestAnimationFrame(fitEventNames);
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
  placeTabPill();
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
  // Scroll-Position des Rasters merken, damit es nach dem Wischen nicht nach oben springt
  const oldWeek = appEl.querySelector(".plan-screen > .week");
  const keepScroll = !tabChanged && oldWeek ? oldWeek.scrollTop : null;
  // Nur schreiben, wenn sich der Inhalt wirklich geändert hat: gleiche Ansicht bleibt unangetastet (Scroll, Fokus, Eingaben)
  const nextHtml = (ui.layEdit ? layBarHTML() : "") + (ui.planEdit && ui.tab === "stundenplan" ? planEditBarHTML() : "") + views[ui.tab]();
  if (tabChanged || appEl._html !== nextHtml) {
    appEl.innerHTML = nextHtml;
    appEl._html = nextHtml;
  }
  if (keepScroll != null) {
    const newWeek = appEl.querySelector(".plan-screen > .week");
    // Erst die Höhe des Bereichs setzen: ohne sie ist das Raster noch voll lang, es gibt nichts zu scrollen
    // und die gemerkte Position wird auf 0 gekürzt (Sprung nach oben).
    const newScreen = appEl.querySelector(".plan-screen");
    if (newScreen && planScreenH && !ui.layEdit) newScreen.style.height = planScreenH + "px";
    if (newWeek) newWeek.scrollTop = keepScroll;
  }
  appEl.dataset.shownTab = ui.tab;
  kiFabSync();
  document.documentElement.classList.toggle("plan-tab", ui.tab === "stundenplan");
  // Kopfzeile: zeigt den Titel der Seite (oder des geöffneten Bereichs)
  const headEl = document.querySelector(".topbar h1");
  if (headEl) {
    const sub = ui.tab === "einstellungen" && ui.setPage && SETTINGS_LIST.find((x) => x.k === ui.setPage);
    headEl.textContent = ui.tab === "protokolle" && ui.modOpen ? ui.modOpen : sub ? sub.t : (TAB_NAMES[ui.tab] || "Studienplaner");
  }
  const subEl = document.querySelector(".topbar-sub");
  if (subEl) subEl.textContent = topbarSub();
  const initEl = document.querySelector(".profile-init");
  if (initEl) initEl.textContent = session && session.user && session.user.email ? session.user.email.charAt(0).toUpperCase() : "S";
  syncPlanFab();
  syncTabBadge();
  // Einblenden nur beim Wechsel des Reiters, nicht bei jedem Haken oder Klick
  if (tabChanged && !document.body.classList.contains("tab-scrub")) {
    appEl.classList.remove("dir-fwd", "dir-back");
    appEl.classList.add("tab-in", dir);
    clearTimeout(appEl._tabIn);
    // Erst nach dem längsten Einblenden (Karten mit Verzögerung) wieder entfernen, sonst springt der Inhalt am Ende
    appEl._tabIn = setTimeout(() => appEl.classList.remove("tab-in", "dir-fwd", "dir-back"), 1000);
  }
  document.querySelectorAll(".lay-btn").forEach((b) => b.classList.toggle("on", ui.layEdit));
  if (ui.tab === "dashboard") loadMensa(false);
  if (ui.dayPop) openDayModal(ui.dayPop);
  if (ui.tab === "stundenplan" && !ui.layEdit) fitPlan();
  // Stundenplan: Eintragskarte als eigenes Fenster
  if (ui.tab === "stundenplan" && ui.noteFor && ui.noteWindow) openModal(notePanelHTML(ui.noteFor.name, ui.noteFor.date));
  ui.anim = null;
}

