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
    <div class="row" style="margin-top:14px"><button class="btn ghost" data-act="mclose">Schließen</button></div>`);
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
function render() {
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
  appEl.innerHTML = (ui.layEdit ? layBarHTML() : "") + (ui.planEdit && ui.tab === "stundenplan" ? planEditBarHTML() : "") + views[ui.tab]();
  if (keepScroll != null) {
    const newWeek = appEl.querySelector(".plan-screen > .week");
    // Erst die Höhe des Bereichs setzen: ohne sie ist das Raster noch voll lang, es gibt nichts zu scrollen
    // und die gemerkte Position wird auf 0 gekürzt (Sprung nach oben).
    const newScreen = appEl.querySelector(".plan-screen");
    if (newScreen && planScreenH && !ui.layEdit) newScreen.style.height = planScreenH + "px";
    if (newWeek) newWeek.scrollTop = keepScroll;
  }
  appEl.dataset.shownTab = ui.tab;
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
  const hi = hour < 5 ? "Gute Nacht!" : hour < 11 ? "Guten Morgen!" : hour < 17 ? "Hallo!" : "Guten Abend!";
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
  return `<div class="row" style="margin-top:10px"><button class="btn ghost" data-act="dashnext">Nächster Tag: ${WEEKDAYS_LONG[(nextWorkday(now).getDay() + 6) % 7]} ${ICON.next}</button></div>`;
}

// ---------- Suche ----------
// Kleiner Kontext unter dem Titel der Kopfzeile
function topbarSub() {
  const today = new Date();
  if (ui.tab === "dashboard") return `${WEEKDAYS_LONG[(today.getDay() + 6) % 7]}, ${fmtD(today)}`;
  if (ui.tab === "stundenplan") {
    const mon = addDays(mondayOf(today), ui.weekOffset * 7);
    if (ui.view === "day") return `KW ${kwOf(mon)} · ${fmtD(parseIso(ui.dayDate))}`;
    return `KW ${kwOf(mon)} · ${fmtD(mon)} – ${fmtD(addDays(mon, 6))}`;
  }
  if (ui.tab === "kalender") return (ui.month || today).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  return "";
}
function searchBtnHTML() {
  return `<button class="btn ghost search-btn dash-search" data-act="search">🔍 Suchen in To-Dos, Terminen und Protokollen</button>`;
}

// Suche: Ergebnisse direkt beim Tippen aktualisieren
document.addEventListener("input", (e) => {
  if (e.target.id === "searchQ") document.getElementById("searchRes").innerHTML = searchResultsHTML(e.target.value);
});

// ---------- Rückgängig nach dem Löschen ----------
function showUndo(text) {
  document.getElementById("undoBar")?.remove();
  const bar = document.createElement("div");
  bar.id = "undoBar";
  bar.className = "undo-bar";
  bar.innerHTML = `<span>${esc(text)}</span><button type="button" id="undoBtn">Rückgängig</button>`;
  document.body.appendChild(bar);
  bar.querySelector("#undoBtn").onclick = () => { bar.remove(); undo(); };
  setTimeout(() => bar.remove(), 6000);
}

// ---------- Protokoll als Textdatei ----------
function exportModuleText(name) {
  const m = state.modules[name];
  if (!m) return;
  const byDate = (a, b) => (a.date || "").localeCompare(b.date || "");
  const noteLine = (n) => `- ${n.date || ""}: ${(n.done || "").trim()}${n.todo ? `\n  To-Do: ${n.todo}` : ""}`;
  const lines = [name, `Kategorie: ${KIND_LABEL[modKindOf(name)]}`, ""];
  for (const tp of m.topics || []) {
    lines.push(`## ${tp.title}`);
    (m.notes || []).filter((n) => n.topicId === tp.id).sort(byDate).forEach((n) => lines.push(noteLine(n)));
    lines.push("");
  }
  const loose = (m.notes || []).filter((n) => !n.topicId).sort(byDate);
  if (loose.length) { lines.push("## Ohne Thema"); loose.forEach((n) => lines.push(noteLine(n))); }
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name.replace(/[^\w.-]+/g, "_")}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// Beim Ziehen eines Termins an den linken oder rechten Rand: nach kurzem Halten Woche bzw. Tag weiterschalten
function shiftForDrag(dir) {
  if (!drag || !drag.active || ui.tab !== "stundenplan") return;
  if (ui.view === "day") ui.dayDate = iso(addDays(parseIso(ui.dayDate), dir));
  else ui.weekOffset += dir;
  ui.anim = null;
  drag.edge = 0;
  render();
  moveDrag(drag.x, drag.y);
}

// Fortschritt des Tages: wie viele Termine schon vorbei sind
function dayProgressHTML(todays, now) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const past = todays.filter((e) => e.end != null && e.end <= nowMin).length;
  const pct = Math.round((past / todays.length) * 100);
  return `<div class="day-progress"><div class="dp-label"><span>${past} von ${todays.length} Terminen vorbei</span><b>${pct} %</b></div><div class="dp-bar"><div style="width:${pct}%"></div></div></div>`;
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
    <div class="hero-stats"><span><b>${todays.length}</b> ${todays.length === 1 ? "Termin" : "Termine"} heute</span><span><b>${open.length}</b> offen diese Woche</span></div>
    ${todays.length ? dayProgressHTML(todays, now) : ""}
  </div>`;

  // Karten: Stundenplan heute, To-Dos, Countdown, Links. Ohne Layout-Bearbeitung wie bisher.
  const planCard = `<div class="card">
      <div class="row" style="justify-content:space-between"><h3 style="margin:0">${iso(dashDay(now)) === iso(now) ? "Heute im Stundenplan" : "Stundenplan"}</h3>
        <button class="btn ghost menu-btn" data-act="dashmenu" title="Einstellungen">${ICON.more}</button></div>
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
          <button type="button" class="btn ghost" data-act="kitodo" title="Mit KI aus dem Text Datum und Uhrzeit erkennen">✨ KI</button>
        </form>
        ${open.length ? open.slice(0, 5).map(todoItem).join("") : `<div class="empty"><div class="ei">${ICON.spark}</div>Diese Woche ist nichts offen.</div>`}
        ${open.length > 8 ? `<div class="muted" style="margin-top:10px">… und ${open.length - 8} weitere im Kalender.</div>` : ""}
      </div>`;
  const countCard = countdownBlock();
  const linksCard = linksFlow();
  const mensaCard = mensaCardHTML();
  const nextCard = nextDeadlineCard();
  const rueckCard = rueckblickCard();
  const flow = `<div style="margin-bottom:18px">${nextCard}</div><div class="dash-main">${planCard}<div class="dash-side">${todoCard}${countCard}</div></div><div style="margin-top:18px">${mensaCard}</div><div style="margin-top:18px">${rueckCard}</div><div style="margin-top:18px">${linksCard}</div>`;
  h += searchBtnHTML() + laid("dash", [
    { id: "plan", w: 7, nw: 7, h: 20, html: planCard },
    { id: "todo", w: 5, nw: 5, h: 12, html: todoCard },
    { id: "count", w: 5, nw: 5, h: 8, html: countCard },
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
  // Aufgaben mit Uhrzeit zählen für den Ausschnitt mit (am Starttag und am letzten Tag)
  const tds = state.todos.filter((t) => t.time && (t.date === today || t.endDate === today))
    .map((t) => ({ start: toMin(t.time), end: toMin(t.time) + (Number(t.duration) || DEFAULT_DURATION) }));
  const pts = [...evs.map((e) => ({ start: e.start, end: e.end })), ...tds];
  if (!pts.length) return `<div class="empty"><div class="ei">${ICON.cup}</div>${today === iso(now) ? "Heute" : "An diesem Tag"} keine Termine.</div>`;
  const from = Math.max(0, Math.min(...pts.map((p) => p.start)) - 30);
  const to = Math.min(24 * 60, Math.max(...pts.map((p) => p.end)) + 30);
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
  return ""; // Notizen öffnen sich als Popup
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
      <button class="btn ghost" data-act="npclose" title="Schließen">${ICON.x}</button>
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
        <button class="btn ghost" data-act="npedit" data-id="${x.id}" title="Bearbeiten">${ICON.edit}</button>
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
  return head + evs.map((e) => `<div class="listrow" data-act="modgo" data-m="${enc(e.name)}" style="cursor:pointer">
      <span class="pdot" style="background:${colorOf(e.name)}"></span>
      <div class="grow"><b>${esc(e.name)}</b><div class="muted">${fmtMin(e.start)}–${fmtMin(e.end)}${e.room ? " · " + esc(e.room) : ""}</div></div>
    </div>`).join("");
}

// Countdown: je Kategorie die nächsten drei, nach kürzester Frist sortiert
function countdownBlock() {
  const today = iso(new Date());
  const groups = [["todo", "To-Dos"], ["abgabe", "Abgaben"], ["klausur", "Klausuren"]];
  const sortFn = (a, b) => (a.date || "9999").localeCompare(b.date || "9999");
  // Drei Spalten nebeneinander (je Art die nächsten drei). Tippen öffnet den Eintrag, Gedrückthalten wie überall.
  return `<div class="card"><h3>Countdown</h3><div class="cd-grid">${groups.map(([type, label]) => {
    const items = state.todos
      .filter((t) => t.type === type && !t.done && (!t.date || t.date >= today))
      .sort(sortFn).slice(0, 3);
    return `<div class="cd-col" style="--c:${catColor(type)}"><div class="cd-label">${label}</div>${items.length
      ? items.map((t) => `<button class="cd-item" data-lp="${t.id}" data-act="todoopen" data-id="${t.id}">
          <b>${esc(t.title)}</b><span style="color:${dueColor(t.date, type)}">${t.date ? countdownText(t.date) : "Termin folgt"}</span></button>`).join("")
      : `<div class="muted cd-none">Keine</div>`}</div>`;
  }).join("")}</div></div>`;
}

// Vibration nur, wenn sie in den Benachrichtigungs-Einstellungen dieses Geräts nicht aus ist
function buzz(ms) {
  try {
    if (navigator.vibrate && (state.settings.nfDev || {}).vib !== "aus") navigator.vibrate(ms);
  } catch (_) {}
}
// Schwache Geräte: Unschärfe-Effekte aus (spart Akku und ruckelt weniger)
function isWeakDevice() {
  return (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3;
}

function todoItem(t) {
  const sub = CAT_LABEL[t.type] || "To-Do";
  const due = t.date ? ` · fällig ${dateText(t)}` : " · Termin folgt";
  const prio = t.priority || "mittel";
  const subs = t.subs || [];
  const subTxt = subs.length ? ` · ${subs.filter((s) => s.done).length}/${subs.length} Unterpunkte` : "";
  return `<div class="item" data-lp="${t.id}" data-act="todoopen" data-id="${t.id}">
    <input type="checkbox" data-act="tdone" data-id="${t.id}" ${canCheck(t) ? "" : "disabled"}>
    <div class="grow"><b>${esc(t.title)}</b><div class="muted">${sub}${due}${t.time ? " · " + esc(t.time) : ""}${subTxt}</div></div>
    <span class="prio ${prio}">${prio}</span>
    <button class="btn ghost" data-act="tedit" data-id="${t.id}" title="Bearbeiten">${ICON.edit}</button>
  </div>`;
}

// ---------- Stundenplan ----------
// Abstand der Zeitachse in Minuten (Einstellung im Stundenplan-Menü, nur auf diesem Gerät)
const PLAN_STEPS = [5, 10, 15, 20, 30, 45, 60, 90, 120];
function planStepMin() {
  const v = Number(state.settings.planStep);
  return PLAN_STEPS.includes(v) ? v : 30;
}
const planLinesCls = () => (state.settings.planLines ? " steplines" : "");
// Eigene Leisten im Raster: eine Uhrzeit = Linie, Uhrzeit + Ende = Band (z. B. Pause)
const toMinSafe = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
function marksHTML() {
  let out = "";
  (state.settings.planMarks || []).forEach((mk) => {
    const s = toMinSafe(mk.time);
    if (s == null) return;
    const e = toMinSafe(mk.end);
    const band = e != null && e > s;
    const from = Math.max(s, START_MIN);
    const to = Math.min(band ? e : s, END_MIN);
    if (to < START_MIN || from > END_MIN || (band && to <= from)) return;
    const top = mpx(from - START_MIN);
    const h = band ? mpx(to - from) : "0px";
    out += `<div class="pmark${band ? " band" : ""}" style="top:${top};${band ? `height:${h};` : ""}">${mk.label ? `<span>${esc(mk.label)}</span>` : ""}</div>`;
  });
  return out;
}
const stepStyle = () => `--step-px:${mpx(planStepMin())};`;
function axisHTML(offset = 50) {
  const step = planStepMin();
  // Beschriftung nur so oft, dass zwischen zwei Zeiten mindestens ca. 14 px Platz bleiben
  const every = Math.max(1, Math.ceil(14 / (step * PX_PER_MIN)));
  let out = "";
  let i = 0;
  // Beschriftung zu vollen Zeiten (z. B. 08:00, 08:45): erster Punkt ist die nächste volle Einheit nach Beginn
  for (let m = Math.ceil(START_MIN / step) * step; m <= END_MIN; m += step, i++) {
    if (i % every) continue;
    const half = m % 60 !== 0;
    const top = `calc(${offset}px + ${mpx(m - START_MIN)} - ${half ? 4 : 8}px)`;
    out += `<div class="axis-h${half ? " half" : ""}" style="top:${top}">${pad(Math.floor(m / 60))}:${pad(m % 60)}</div>`;
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
      <button class="btn ghost" data-act="tedit" data-id="${t.id}">${ICON.edit}</button>
    </div>`;
  }).join("")}</div>`;
}

// Aufgaben ohne Uhrzeit: stehen unter der Navigation, pro Wochentag in dessen Spalte
function dayTodoChips(k) {
  const items = todosOn(k).filter((t) => !t.time)
    .sort((a, b) => Number(a.done) - Number(b.done) || (PRIO_ORDER[a.priority] ?? 1) - (PRIO_ORDER[b.priority] ?? 1));
  return items.map((t) => {
    const c = calColor(t);
    return `<div class="dchip ${t.done ? "is-done" : ""}${ui.popId === t.id ? " pop" : ""}" data-act="tedit" data-id="${t.id}" style="--c:${c}">
      <input type="checkbox" data-act="tdone" data-id="${t.id}" ${t.done ? "checked" : ""} ${canCheck(t) ? "" : "disabled"}>
      <span>${esc(t.title)}</span></div>`;
  }).join("");
}
// Hintergrund des Wochentag-Kopfes in der Farbe der offenen Aufgaben des Tages
function dayTintStyle(k) {
  // Mehrtägige Zeiträume stehen in der Leiste oben, hier nur einzelne Tage
  const all = todosOn(k).filter((t) => !(t.endDate && t.endDate > t.date));
  if (!all.length) return "";
  const open = all.filter((t) => !t.done);
  // Offene Aufgaben: ihre Farben; sind alle fertig, zeigt der Kopf die Farbe "erledigt" (grün)
  const src = open.length ? open : all;
  const colorFor = (t) => (open.length ? catColor(t.type) : catColor("done"));
  const bg = src.reduce((acc, t) => `color-mix(in srgb, ${colorFor(t)} 12%, ${acc})`, "var(--card, #142025)");
  // Nur ein farbiger Strich am unteren Rand, kein Rahmen mehr
  const bar = open.length ? catColor(open[0].type) : `color-mix(in srgb, ${catColor("done")} 50%, transparent)`;
  return `background:${bg};box-shadow:inset 0 -4px 0 ${bar};`;
}

// Mehrtägige To-Dos (Zeiträume) als Balken über den Tagen, statt im Tageskopf
// bare: nur die Balken ohne Zeitachsen-Spalte (für den mitwischenden Streifen)
function alldayStripHTML(mon, dayCount, bare = false) {
  const monK = iso(mon);
  const sunK = iso(addDays(mon, 6));
  const idx = (k) => Math.round((parseIso(k) - mon) / 86400000);
  const items = state.todos
    // Zeiträume über mehrere Tage, dazu Aufgaben ohne Uhrzeit an einem Tag (die mit Uhrzeit stehen im Raster)
    .filter((t) => t.date && t.date <= sunK && (t.endDate && t.endDate > t.date ? t.endDate >= monK : (!t.time && t.date >= monK)))
    .map((t) => ({ t, s: Math.max(0, idx(t.date)), e: Math.min(dayCount - 1, idx(t.endDate && t.endDate > t.date ? t.endDate : t.date)) }))
    .filter((x) => x.s <= x.e)
    .sort((a, b) => a.s - b.s || b.e - a.e);
  // Leerer Streifen behält seine feste Höhe, damit die Stunden in jeder Woche gleich hoch bleiben
  if (!items.length) return `<div class="allday-strip plan-strip" aria-hidden="true"></div>`;
  const off = bare ? 1 : 2;   // Spaltennummer des ersten Tages (Zeitachse davor, falls vorhanden)
  // Überlappende Balken untereinander in eigene Zeilen legen
  const rowEnds = [];
  items.forEach((x) => {
    let r = rowEnds.findIndex((end) => end < x.s);
    if (r < 0) { r = rowEnds.length; rowEnds.push(x.e); } else rowEnds[r] = x.e;
    x.row = r;
  });
  const tk = iso(new Date());
  const ti = Math.round((parseIso(tk) - mon) / 86400000);
  const todayCell = ti >= 0 && ti < dayCount ? `<div class="strip-today" style="grid-column:${ti + off} / ${ti + off + 1};grid-row:1 / 9"></div>` : "";
  const bars = todayCell + items.map((x) => {
    const c = catColor(x.t.done ? "done" : x.t.type);
    return `<div class="allday-bar${x.t.done ? " is-done" : ""} is-${x.t.type}" data-act="tedit" data-id="${x.t.id}" style="grid-column:${x.s + off} / ${x.e + off + 1};grid-row:${x.row + 1};--c:${c}"><span>${esc(x.t.title)}</span><small>${esc(dateText(x.t))}</small></div>`;
  }).join("");
  if (bare) return `<div class="allday-strip plan-strip" style="grid-template-columns:repeat(${dayCount}, minmax(0, 1fr));">${bars}</div>`;
  return `<div class="allday-strip" style="grid-template-columns:var(--axis-w, 28px) repeat(${dayCount}, minmax(0, 1fr));"><div></div>${bars}</div>`;
}
// Die Tagesspalten einer Woche (Wochentag ausgeschrieben, wenn die Spalte breit genug ist, darunter das Datum)
function weekColsHTML(mon, dayCount, today) {
  let cols = "";
  for (let i = 0; i < dayCount; i++) {
    const d = addDays(mon, i);
    cols += dayColumn(iso(d), `<span class="wd"><span class="wd-l">${WEEKDAYS_LONG[i]}</span><span class="wd-s">${WEEKDAYS[i]}</span></span><span class="dd">${pad(d.getDate())}.${pad(d.getMonth() + 1)}.</span>`, false, today);
  }
  return cols;
}
// Wochentage als fester Kopf über dem Aufgaben-Streifen (gleiche Spalten wie der Streifen)
// Die Karten wischen mit den Wochen mit (wie der Aufgaben-Streifen); die Zeitachse bleibt stehen
function dayCountOf(k) {
  return state.events.filter((e) => e.date === k).length + todosOn(k).filter((t) => !t.done).length;
}
// Knopf zum Ein- und Ausklappen der Aufgaben ohne Uhrzeit (in der Ecke über der Zeitspalte)
function planCornerHTML(count, open) {
  return `<button class="plan-corner${open ? " on" : ""}" data-act="planTasks" aria-label="Aufgaben ein- und ausblenden"><span>${open ? ICON.up : ICON.down}</span><small>${count}</small></button>`;
}
// Gibt es Aufgaben ohne Uhrzeit im Zeitraum (dann gibt es eine Leiste und einen Knopf)
function untimedInRange(from, to) {
  const f = iso(from), t2 = iso(to);
  return state.todos.some((t) => t.date && !t.time && t.date <= t2 && ((t.endDate && t.endDate > t.date) ? t.endDate >= f : t.date >= f));
}
function weekHeadHTML(mon, dayCount, today, compact = "", corner = "") {
  const todayK = iso(today);
  const cellsOf = (m) => {
    let cells = "";
    for (let i = 0; i < dayCount; i++) {
      const d = addDays(m, i);
      const k = iso(d);
      const n = dayCountOf(k);
      cells += `<div class="dayhead${k === todayK ? " today" : ""}" data-act="dayopen" data-d="${k}" style="${dayTintStyle(k)}"><span class="wd"><span class="wd-l">${WEEKDAYS_LONG[i]}</span><span class="wd-s">${WEEKDAYS[i]}</span></span><span class="dd">${pad(d.getDate())}.${pad(d.getMonth() + 1)}.</span></div>`;
    }
    return cells;
  };
  return `<div class="plan-days plan-days-week${compact}"><div class="plan-topspacer">${corner}</div><div class="plan-dwrap">${pagesGroup((k) => `<div class="plan-dheads" style="grid-template-columns:repeat(${dayCount}, minmax(0, 1fr));">${cellsOf(addDays(mon, k * 7))}</div>`)}</div></div>`;
}
// Ein Knopf für die Stundenplan-Einstellungen, außerhalb des Bereichs, der beim Wischen verschoben wird
function syncPlanFab() {
  const old = document.getElementById("planFab");
  const want = ui.tab === "stundenplan" && !ui.layEdit;
  if (!want) { if (old) old.remove(); return; }
  if (!old) document.body.insertAdjacentHTML("beforeend", `<button id="planFab" class="plan-fab" data-act="planmenu" title="Einstellungen">${ICON.more}</button>`);
}
// Einträge, die an einem Tag liegen (auch Zeiträume über mehrere Tage)
function todosOn(k) {
  return state.todos.filter((t) => t.date && (t.endDate && t.endDate > t.date
    ? t.date <= k && k <= t.endDate
    : t.date === k));
}
// Datumstext: "5. Nov" oder "3. Nov – 7. Nov"
function dateText(t) {
  if (!t.date) return "";
  const a = fmtD(parseIso(t.date));
  return t.endDate && t.endDate > t.date ? `${a} – ${fmtD(parseIso(t.endDate))}` : a;
}

function timedTodoItems(k) {
  // Mit Uhrzeit: am Starttag und am letzten Tag eines Zeitraums
  return state.todos
    .filter((t) => t.time && (t.date === k || (t.endDate && t.endDate > t.date && t.endDate === k)))
    .map((t) => {
      const s = toMin(t.time);
      const dur = Number(t.duration) || DEFAULT_DURATION;
      return { id: t.id, kind: t.type, name: t.title, date: k, start: s, end: Math.min(s + dur, END_MIN), done: !!t.done };
    })
    .filter((x) => x.start >= START_MIN && x.start < END_MIN);
}

function dayColumn(k, label, wide, today, noNav = false, chips = "") {
  const isToday = k === iso(today);
  const evs = state.events.filter((e) => e.date === k).map((e) => ({ ...e, kind: "event" }));
  const clipped = [...evs, ...timedTodoItems(k)]
    .filter((x) => x.end > START_MIN && x.start < END_MIN)
    .map((x) => ({ ...x, start: Math.max(x.start, START_MIN), end: Math.min(x.end, END_MIN) }));
  const items = layout(clipped);
  const plan = PLAN_OVERRIDE || state.settings.plan;
  const blocks = items.map((it) => {
    const w = 100 / it._cols;
    const pos = `top:${mpx(it.start - START_MIN)};height:calc(max(26px, ${mpx(it.end - it.start)}) - 2px);left:calc(${it._col * w}% + 2px);width:calc(${w}% - 4px);`;
    if (it.kind === "event") {
      // Block zeigt Kürzel (falls gesetzt), Dozent statt Uhrzeit und einen dunkleren Rahmen
      const ec = colorOf(it.name);
      const who = dozentOf(it);
      return `<div class="ev${it.cancelled ? " is-cancelled" : ""}" data-act="note" data-kind="event" data-id="${it.id}"${ui.planEdit ? ` data-drag="${it.id}"` : ""} style="${pos}background:${ec};color:${textOn(ec)};border:2px solid color-mix(in srgb, ${ec} 55%, #000)">
        <b class="ev-name" data-long="${esc(it.name)}" data-short="${esc(it.short || "")}">${esc(it.name)}</b><small>${esc(who || `${fmtMin(it.start)}–${fmtMin(it.end)}`)}</small><small>${esc(it.room)}</small></div>`;
    }
    const c = catColor(it.kind);
    if (it.done) {
      const g = catColor("done");
      return `<div class="ev block-outline is-done${ui.popId === it.id ? " pop" : ""}" data-drag="${it.id}" data-act="tedit" data-id="${it.id}" style="${pos}border:1px dashed color-mix(in srgb, ${g} 50%, transparent);background:color-mix(in srgb, ${g} 6%, transparent);opacity:.7">
        <b>${esc(it.name)}</b><small>${fmtMin(it.start)} · erledigt</small></div>`;
    }
    if (it.kind === "todo") {
      return `<div class="ev block-todo" data-drag="${it.id}" data-act="tedit" data-id="${it.id}" style="${pos}border:2px dashed ${c};background:color-mix(in srgb, ${c} 10%, transparent)">
        <b>${esc(it.name)}</b><small>${fmtMin(it.start)} · To-Do</small></div>`;
    }
    return `<div class="ev block-outline" data-drag="${it.id}" data-act="tedit" data-id="${it.id}" style="${pos}border:2px dashed ${c};background:color-mix(in srgb, ${c} 10%, transparent)">
      <b>${esc(it.name)}</b><small>${fmtMin(it.start)} · ${CAT_LABEL[it.kind]}</small></div>`;
  }).join("");
  let now = "";
  if (isToday) {
    const t = new Date();
    const m = t.getHours() * 60 + t.getMinutes();
    if (m >= START_MIN && m <= END_MIN) {
      now = `<div class="nowline" style="top:${mpx(m - START_MIN)};${plan.now ? `background:${plan.now};` : ""}"></div>`;
    }
  }
  const gridStyle = ` style="height:${mpx(END_MIN - START_MIN)};${plan.grid ? `background-color:${plan.grid};` : ""}"`;
  const headAct = noNav ? "" : (wide ? "toweek" : "dayopen");
  const marks = ui.tab === "stundenplan" ? marksHTML() : "";
  return `<div class="daycol${wide ? " wide" : ""}">
    <div class="dayhead ${isToday ? "today" : ""}" data-act="${headAct}" data-d="${k}" style="${dayTintStyle(k)}">${label}</div>
    ${chips}
    <div class="grid" data-date="${k}"${gridStyle}>${marks}${blocks}${now}</div></div>`;
}

function viewPlan() {
  const today = new Date();
  const animCls = ui.anim ? ` anim-${ui.anim}` : "";
  const menuBtn = `<button class="btn ghost" data-act="planmenu" title="Einstellungen">${ICON.more}</button>`;

  if (ui.view === "day") {
    const d = parseIso(ui.dayDate);
    const wd = WEEKDAYS_LONG[(d.getDay() + 6) % 7];
    // Tagesansicht: Aufgaben ohne Uhrzeit stehen direkt unter dem Wochentag
    const dayChips = dayTodoChips(ui.dayDate);
    const chipsHtml = dayChips ? `<div class="dchips">${dayChips}</div>` : "";
    // Aufklappbar wie in der Wochenansicht: Knopf in der Ecke, Leiste nur wenn es Aufgaben ohne Uhrzeit gibt
    const dayUntimedCount = todosOn(ui.dayDate).filter((t) => !t.time && !t.done).length;
    const dayUntimed = dayUntimedCount > 0;
    const dayOpen = dayUntimed && ui.planTasksOpen === true;
    const dayCorner = dayUntimed ? planCornerHTML(dayUntimedCount, dayOpen) : "";
    const dayTop = dayUntimed ? `<div class="plan-top-wrap${dayOpen ? " open" : ""}"><div class="plan-top"><div class="plan-topspacer"></div><div class="plan-stripwrap"><div class="plan-dchips">${dayChips || ""}</div></div></div></div>` : "";
    // Vorgeladene Tage, alle mit derselben Zeitachse
    applyDayRange(pagesDates());
    const dayGroup = pagesGroup((k) => `<div class="plan-cols">${dayColumn(iso(addDays(d, k)), "", true, today, false, "")}</div>`);
    return `${planNavHTML(`KW ${kwOf(d)} · ${fmtD(d)}`, "day")}
    <div class="${animCls}">${planLaid(`<div class="plan-screen${planLinesCls()}${ui.planEdit ? " editing" : ""}" style="--grid-h:${mpx(END_MIN - START_MIN)};${stepStyle()}">${dayTop}<div class="plan-days" style="grid-template-columns:var(--axis-w, 28px) minmax(0,1fr);"><div>${dayCorner}</div><div class="dayhead${iso(d) === iso(today) ? " today" : ""}" data-act="toweek" title="Zur Wochenansicht"><b class="daytitle">${wd}</b><span class="dd">${pad(d.getDate())}.${pad(d.getMonth() + 1)}.</span></div></div><div class="week day-week"><div class="plan-rows"><div class="axis" style="height:${mpx(END_MIN - START_MIN)}">${axisHTML(0)}</div><div class="plan-track" style="height:${mpx(END_MIN - START_MIN)}">${dayGroup}</div></div></div></div>`)}</div>${emptyPlanHint()}${planFabHTML()}`;
  }

  const mon = addDays(mondayOf(today), ui.weekOffset * 7);
  const sun = addDays(mon, 6);
  const dayCount = state.settings.weekend ? 7 : 5;
  const weekDates = Array.from({ length: 7 }, (_, i) => iso(addDays(mon, i)));
  let h = planNavHTML(`KW ${kwOf(mon)} (${parityOf(mon)}) · ${fmtD(mon)} – ${fmtD(sun)}`, "week");

  // Vorgeladene Wochen (links und rechts), alle mit derselben Zeitachse
  applyDayRange(pagesDates());
  const colsGroup = pagesGroup((k) => `<div class="plan-cols">${weekColsHTML(addDays(mon, k * 7), dayCount, today)}</div>`);
  // Aufgaben-Streifen: steht oben und wischt mit den Wochen mit (Spalte für die Zeitachse daneben)
  // Nur die sichtbare Woche entscheidet: Knopf und Leiste gibt es nur, wenn hier Aufgaben ohne Uhrzeit stehen
  const weekUntimed = state.todos.filter((t) => !t.done && t.date && !t.time && t.date <= iso(sun) && ((t.endDate && t.endDate > t.date) ? t.endDate >= iso(mon) : t.date >= iso(mon))).length;
  const hasUntimed = weekUntimed > 0;
  const tasksOpen = hasUntimed && ui.planTasksOpen === true;
  // Der Aufklapp-Knopf sitzt in der leeren Ecke über der Zeitspalte, oben stehen nur die Wochentage
  const corner = hasUntimed ? planCornerHTML(weekUntimed, tasksOpen) : "";
  // Die Leiste bleibt im Dokument und klappt per CSS auf/zu (siehe plan-top-wrap)
  const topHTML = hasUntimed ? `<div class="plan-top-wrap${tasksOpen ? " open" : ""}"><div class="plan-top"><div class="plan-topspacer"></div><div class="plan-stripwrap">${pagesGroup((k) => alldayStripHTML(addDays(mon, k * 7), dayCount, true))}</div></div></div>` : "";
  const compact = state.settings.planHead === "kompakt" ? " compact" : "";
  // Oben fest: Wochentage, dann Aufgaben-Streifen. Nur das Raster darunter scrollt.
  const head = weekHeadHTML(mon, dayCount, today, compact, corner);
  // Zeitachse und Kopf stehen fest, nur die Modul-Spalten (plan-track) wischen
  h += `<div class="${animCls}">${planLaid(`<div class="plan-screen${planLinesCls()}${ui.planDense ? " dense" : ""}${ui.planEdit ? " editing" : ""}" style="${stepStyle()}">${topHTML}${head}<div class="week${compact}"><div class="plan-rows"><div class="axis" style="height:${mpx(END_MIN - START_MIN)}">${axisHTML(0)}</div><div class="plan-track" style="height:${mpx(END_MIN - START_MIN)}">${colsGroup}</div></div></div></div>`)}</div>${emptyPlanHint()}`;
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
  return ""; // der Knopf wird in syncPlanFab() außerhalb der Ansicht eingefügt
}
// Wochen- und Tagesansicht umschalten (einmal antippen auf den Reiter oder den Knopf)
function planToggle() {
  if (ui.view === "week") { ui.view = "day"; ui.dayDate = iso(new Date()); ui.anim = "zoom"; render(); }
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
  const zoomPct = Math.round(getZoom("plan") * 100);
  const range = (key, lbl, from, to, sel) => `<label class="pm-cell"><span>${lbl}</span><select data-plan-range="${key}" ${s.autoRange ? "disabled" : ""}>${opts(from, to, sel)}</select></label>`;
  openModal(`
    <h3>Stundenplan</h3>
    <button class="pm-link" data-act="planedit">Termine verschieben oder kopieren<span aria-hidden="true">›</span></button>

    <div class="pm-sec">Ansicht</div>
    <label class="pm-row"><span>Samstag und Sonntag</span><input type="checkbox" data-change="weekend" ${s.weekend ? "checked" : ""}></label>
    <label class="pm-row"><span>Zeitachse an Vorlesungen anpassen</span><input type="checkbox" data-change="autorange" ${s.autoRange ? "checked" : ""}></label>
    <label class="pm-row"><span>Abstand der Zeitachse</span><select data-plan-step>${PLAN_STEPS.map((v) => `<option value="${v}" ${v === planStepMin() ? "selected" : ""}>${v === 60 ? "1 Std" : `${v} Min`}</option>`).join("")}</select></label>
    <label class="pm-row"><span>Waagerechte Linien in gleichem Abstand</span><input type="checkbox" data-change="planlines" ${s.planLines ? "checked" : ""}></label>
    <label class="pm-row"><span>Höhe: ${zoomPct} %</span><input type="range" min="50" max="200" step="5" value="${zoomPct}" data-plan-zoom></label>
    <p class="muted pm-hint">Zoomen geht auch mit zwei Fingern.</p>

    <div class="pm-sec">Zeitraum${s.autoRange ? " (automatisch)" : ""}</div>
    <div class="pm-pair">${range("dayStart", "Beginn", 6, 11.5, s.dayStart)}${range("dayEnd", "Ende", 14, 23.5, s.dayEnd)}</div>

    <div class="pm-sec">Farben</div>
    <div class="pm-pair">
      <label class="pm-cell"><span>Hintergrund</span><input type="color" value="${gridVal}" data-plan="grid"></label>
      <label class="pm-cell"><span>Jetzt-Linie</span><input type="color" value="${nowVal}" data-plan="now"></label>
    </div>

    <div class="pm-sec">Leisten & Pausen</div>
    <p class="muted pm-hint">Ohne Ende eine Linie, mit Ende ein Band, z. B. für die Mittagspause.</p>
    ${(s.planMarks || []).map((mk) => `<div class="pm-mark">
      <input type="time" value="${mk.time || ""}" data-mark="time" data-id="${mk.id}" title="Beginn">
      <input type="time" value="${mk.end || ""}" data-mark="end" data-id="${mk.id}" title="Ende (leer = nur Linie)">
      <input value="${esc(mk.label || "")}" data-mark="label" data-id="${mk.id}" placeholder="Name">
      <button class="btn ghost menu-btn" data-act="markdel" data-id="${mk.id}" title="Löschen">${ICON.x}</button>
    </div>`).join("")}
    <button class="btn ghost" data-act="markadd">+ Leiste hinzufügen</button>

    <div class="sheet-actions">
      <button class="btn ghost" data-act="planreset">Standard</button>
      <div class="right"><button class="btn" data-act="mclose">Fertig</button></div>
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
  ui.anim = "zoom";
  render();
}

// Zerlegt die ICS-Beschreibung ("Art: Vorlesung\nDozent: ...") in Schlüssel/Wert
function parseEventDesc(desc) {
  const info = {};
  String(desc || "").split(/\r?\n|\\n/).forEach((line) => {
    const i = line.indexOf(":");
    if (i > 0) info[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  });
  return info;
}

// Termin auf einen anderen Tag gezogen: fragen, ob verschoben oder kopiert werden soll
function openEventDrop(id, date, min) {
  const ev = state.events.find((x) => x.id === id);
  if (!ev) return;
  const [y, m, d] = date.split("-");
  const btn = (mode, label, cls) => `<button class="btn ${cls}" data-act="evdrop" data-mode="${mode}" data-id="${id}" data-d="${date}" data-min="${min}">${label}</button>`;
  openModal(`
    <h3>${esc(ev.name)}</h3>
    <p class="muted">Auf ${d}.${m}.${y} · ${fmtMin(min)} Uhr</p>
    <div class="menu-list">
      ${btn("move", "Verschieben", "")}
      ${btn("copy", "Kopieren", "ghost")}
    </div>
    <div class="row"><button class="btn ghost" data-act="mclose">Abbrechen</button></div>`);
}

// Kurzer Tipp auf einen To-Do/Abgabe/Klausur im Stundenplan: Aktionen anbieten
function openTodoActions(id) {
  const t = state.todos.find((x) => x.id === id);
  if (!t) return;
  const sub = [CAT_LABEL[t.type] || "Aufgabe", t.date ? fmtD(parseIso(t.date)) : "", t.time ? esc(t.time) : ""].filter(Boolean).join(" · ");
  openModal(`
    <h3>${esc(t.title)}</h3>
    <p class="muted">${sub}</p>
    ${t.date ? `<button type="button" class="btn ghost" data-act="todocal" data-d="${t.date}" style="margin-bottom:10px">Im Kalender zeigen</button>` : ""}
    <div class="sheet-actions">
      <button type="button" class="btn ghost danger-text" data-act="tdelm" data-id="${t.id}">Löschen</button>
      <div class="right">
        <button type="button" class="btn ghost" data-act="tdone" data-id="${t.id}">${t.done ? "Wieder öffnen" : "Erledigt"}</button>
        <button type="button" class="btn" data-act="todoedit" data-id="${t.id}">Bearbeiten</button>
      </div>
    </div>`);
}

// Dozent: eigene Eingabe (ev.dozent) hat Vorrang vor dem Wert aus der ICS-Beschreibung
const dozentOf = (ev) => (ev.dozent !== undefined ? ev.dozent : parseEventDesc(ev.desc).dozent || "");
// Termin-Namen: passt der lange Name nicht in eine Zeile, wird das Kürzel angezeigt (falls vorhanden)
function fitEventNames() {
  document.querySelectorAll(".ev-name[data-short]").forEach((el) => {
    el.textContent = el.dataset.long;
    if (el.dataset.short && el.scrollWidth > el.clientWidth + 1) el.textContent = el.dataset.short;
  });
}
window.addEventListener("resize", () => requestAnimationFrame(fitEventNames));

// Kurzer Tipp auf einen Stundenplan-Termin: Infos anzeigen
function openEventInfo(id) {
  const ev = state.events.find((x) => x.id === id);
  if (!ev) return;
  modalTintName = ev.name;
  const info = parseEventDesc(ev.desc);
  const [y, m, d] = ev.date.split("-");
  const row = (label, val) => `<div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(128,128,128,.25)"><span class="muted">${label}</span><b>${esc(val)}</b></div>`;
  openModal(`
    <h3>${esc(ev.name)}</h3>
    <div>
      ${row("Datum", `${d}.${m}.${y}`)}
      ${row("Zeit", `${fmtMin(ev.start)}–${fmtMin(ev.end)}`)}
      ${row("Raum", ev.room || info.raum || "–")}
      ${row("Dozent", dozentOf(ev) || "–")}
      ${row("Art", info.art || "–")}
      ${row("Woche", info.woche || "–")}
    </div>
    ${dozentOf(ev) ? "" : `<p class="muted" style="font-size:13px">Kein Dozent hinterlegt? Termine, die vor dieser Version importiert wurden, einmal über die ICS-Datei in den Einstellungen neu importieren.</p>`}
    <div class="sheet-actions">
      <button type="button" class="btn ghost" data-act="evopen" data-id="${ev.id}">Bearbeiten</button>
      <div class="right">
        <button type="button" class="btn ghost" data-act="evnote" data-id="${ev.id}">Notizen</button>
        <button type="button" class="btn" data-act="mclose">Schließen</button>
      </div>
    </div>`);
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
      <label class="muted">Kürzel (optional, wird im Stundenplan angezeigt)</label>
      <input name="short" maxlength="16" value="${esc(ev.short || "")}" placeholder="z.B. Mathe I">
      <label class="muted">Dozent (gilt für alle Termine dieser Vorlesung)</label>
      <input name="dozent" value="${esc(dozentOf(ev))}" placeholder="z.B. Prof. Müller">

      <div class="grid2">
        <div><label class="muted">Datum</label><input type="date" name="date" required value="${ev.date}"></div>
        <div><label class="muted">Raum</label><input name="room" value="${esc(ev.room)}"></div>
      </div>
      <div class="grid2">
        <div><label class="muted">Beginn</label><input type="time" name="start" required value="${fmtMin(ev.start)}"></div>
        <div><label class="muted">Ende</label><input type="time" name="end" required value="${fmtMin(ev.end)}"></div>
      </div>
      <label class="row" style="margin:12px 0"><input type="checkbox" name="cancelled" ${ev.cancelled ? "checked" : ""}> Diese Stunde fällt aus</label>
      <label class="muted">Farbe</label>
      <input type="hidden" name="color" value="${color}">
      <div class="row" style="margin-bottom:8px"><span class="muted">Farbe wählen:</span><input type="color" id="evColorPick" value="${color}"></div>
      ${mod ? "" : `<label class="row" style="margin-top:12px"><input type="checkbox" name="protokoll"> Auch im Vorlesungs-Protokoll anlegen</label>`}
      ${evReminderRows(ev)}
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
    return `<div class="mnum">${num}</div><div class="micons">${dayT.filter((t) => !(t.endDate && t.endDate > t.date) || t.endDate === iso(d)).slice(0, 3).map((t) => typeIcon(t.type, calColor(t), 13)).join("")}${evCount ? `<span class="dot" style="background:var(--muted)"></span>` : ""}</div>`;
  }
  if (style === "ring") {
    const top = ["klausur", "abgabe", "todo"].find((ty) => dayT.some((t) => t.type === ty && !t.done));
    const ring = top ? catColor(top) : "var(--line)";
    return `<div class="mring" style="--ring:${ring}">${num}</div>${dayT.length ? `<div class="mcount">${dayT.length}</div>` : ""}${evCount ? `<span class="dot" style="background:var(--muted)"></span>` : ""}`;
  }
  // Pillen (Standard)
  const k = iso(d);
  const pill = (t) => {
    const cont = t.endDate && t.endDate > t.date && t.date !== k;
    const c = calColor(t);
    return `<span class="mpill ${t.done ? "is-done" : ""} ${t.endDate ? "mspan" : ""} ${cont ? "mcont" : ""}" style="--pc:${c}">${cont ? "" : typeIcon(t.type, c, 11)}<span>${cont ? "&nbsp;" : esc(shortTitle(t.title))}</span></span>`;
  };
  return `<div class="mnum">${num}</div><div class="mpills">${dayT.slice(0, 2).map(pill).join("")}${dayT.length > 2 ? `<span class="mmore">+${dayT.length - 2}</span>` : ""}${evCount ? `<span class="dot" style="background:var(--muted)"></span>` : ""}</div>`;
}

// Inhalt eines Tages (Einträge, To-Dos, erledigte eingeklappt) — für das Tages-Fenster
function dayPanelHTML(date) {
  const doneBox = (list) => list.length ? `<details class="donebox"><summary>Erledigt (${list.length})</summary>${list.map(todoRow).join("")}</details>` : "";
  const dayAll = todosOn(date).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  const dayEvents = layout(state.events.filter((e) => e.date === date).map((e) => ({ ...e })));
  const emptyDay = !dayEvents.length && !dayAll.length
    ? `<div class="empty-day"><span>Nichts an diesem Tag.</span><button class="btn ghost" data-act="tnewday" data-d="${date}">+ Aufgabe anlegen</button></div>` : "";
  return `${emptyDay}${dayEvents.map((e) => `<div class="listrow" data-act="modgo" data-m="${enc(e.name)}" style="cursor:pointer"><span class="pdot" style="background:${colorOf(e.name)}"></span><div class="grow"><b>${esc(e.name)}</b><div class="muted">${fmtMin(e.start)}–${fmtMin(e.end)} · ${esc(e.room)}</div></div></div>`).join("")}
    ${dayAll.filter((t) => !t.done).map(todoRow).join("")}
    ${!dayAll.length && !dayEvents.length ? `<div class="empty"><div class="ei">${ICON.spark}</div>Nichts an diesem Tag.</div>` : ""}
    ${dayAll.filter((t) => t.done).map(todoRow).join("")}`;
}
// Tippen auf einen Tag: kleines Fenster mit den Einträgen dieses Tages
function openDayModal(date) {
  ui.selDate = date;
  openModal(`<div class="row" style="justify-content:space-between;margin-bottom:8px"><h3 style="margin:0">${fmtD(parseIso(date))}</h3>
      <button class="btn ghost" data-act="mclose" title="Schließen">${ICON.x}</button></div>
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
    h += `<div class="card"><h4 style="margin-top:0">${total} Treffer</h4>${tRows.join("")}${eRows.join("")}${total ? "" : `<div class="empty"><div class="ei">${ICON.search}</div>Nichts gefunden.</div>`}</div>`;
    return h + searchBar;
  }

  // Links: Monat. Rechts: Tagesliste und Übersicht. Am Handy untereinander.
  const m = ui.month;
  // Eingeklappt: nur die Woche des gewählten Tages. Aufgeklappt: ganzer Monat.
  const fold = !!cal.fold;
  const grid0 = mondayOf(fold ? parseIso(ui.selDate || today) : new Date(m.getFullYear(), m.getMonth(), 1));
  const weekEnd = addDays(grid0, 6);
  const monthTitle = fold
    ? `${grid0.getDate()}. ${MONTHS[grid0.getMonth()].slice(0, 3)} – ${weekEnd.getDate()}. ${MONTHS[weekEnd.getMonth()].slice(0, 3)} ${weekEnd.getFullYear()}`
    : `${MONTHS[m.getMonth()]} ${m.getFullYear()}`;
  const animCls = ui.anim === "fold" || ui.anim === "week" ? " anim-fold" : "";
  let cells = WEEKDAYS.map((w) => `<div class="mwd">${w}</div>`).join("");
  for (let i = 0; i < (fold ? 7 : 42); i++) {
    const d = addDays(grid0, i);
    const k = iso(d);
    const dayT = todosOn(k).sort((a, b) => Number(a.done) - Number(b.done));
    const evCount = state.events.filter((e) => e.date === k).length;
    const topType = ["klausur", "abgabe", "todo"].find((ty) => dayT.some((t) => t.type === ty && !t.done));
    const spans0 = todosOn(k).filter((t) => t.endDate && t.endDate > t.date);
    let border = cal.style !== "ring" && topType && !spans0.length ? `border-color:${catColor(topType)};` : "";
    // Mehrtägige Einträge: jeder Eintrag bekommt einen eigenen Rahmen über seine Tage (pro Woche)
    // Bei Überlappung liegen die Rahmen ineinander; der Tag bekommt einen leichten Farbton
    const spans = todosOn(k).filter((t) => t.endDate && t.endDate > t.date);
    let overlays = "";
    spans.forEach((sp, i) => {
      const same = (kk) => todosOn(kk).some((t) => t.id === sp.id);
      const L = d.getDay() === 1 || !same(iso(addDays(d, -1)));
      const R = d.getDay() === 0 || !same(iso(addDays(d, 1)));
      const T = !same(iso(addDays(d, -7)));
      const B = !same(iso(addDays(d, 7)));
      const rr = Math.max(4, 14 - i * 4);
      overlays += `<span class="sp${sp.done ? " is-done" : ""}" style="inset:${i * 4}px;border-color:${calColor(sp)};border-width:${T ? 1 : 0}px ${R ? 1 : 0}px ${B ? 1 : 0}px ${L ? 1 : 0}px;border-radius:${T && L ? rr : 0}px ${T && R ? rr : 0}px ${B && R ? rr : 0}px ${B && L ? rr : 0}px"></span>`;
    });
    if (spans.length && k !== ui.selDate && k !== today) {
      // Überlappende Zeiträume: Farben werden ineinander gemischt
      const tint = spans.reduce((acc, sp) => `color-mix(in srgb, ${calColor(sp)} 14%, ${acc})`, "var(--bg)");
      border += `background-color:${tint};`;
    }
    const brk = breakOn(k);
    const cls = ["mday", `style-${cal.style}`, d.getMonth() !== m.getMonth() ? "other" : "", k === today ? "today" : "", k === ui.selDate ? "sel" : "", spans0.length ? "has-span" : "", brk ? "is-break" : ""].join(" ");
    const dots = state.events.filter((e) => e.date === k && !e.cancelled).slice(0, 3)
      .map((e) => `<i style="background:${(state.modules[e.name] || {}).color || "var(--accent)"}"></i>`).join("");
    cells += `<div class="${cls}" data-act="sel" data-d="${k}"${brk ? ` title="${esc(brk.name || "Vorlesungsfrei")}"` : ""} style="--i:${i};${border}">${calCellInner(cal.style, d, dayT, evCount)}${overlays}${dots ? `<span class="mdots">${dots}</span>` : ""}</div>`;
  }
  const navAct = fold ? "calweek" : "mon";
  const monthCard = `<div class="card">
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <button class="btn ghost" data-act="${navAct}" data-v="-1">‹</button>
      <b class="calTitle">${monthTitle}</b>
      <button class="btn ghost" data-act="${navAct}" data-v="1">›</button>
    </div>
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <button class="btn ghost" data-act="calToday">Heute</button>
      <div class="row" style="gap:6px">
        <button class="btn ghost calfold${fold ? "" : " is-open"}" data-act="calfold" title="${fold ? "Monat anzeigen" : "Nur diese Woche zeigen"}" aria-label="${fold ? "Ausklappen" : "Einklappen"}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg></button>
        <button class="btn ghost menu-btn" data-act="calmenu" title="Darstellung">${ICON.more}</button>
      </div>
    </div>
    <div class="month${animCls}">${cells}</div>
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
    <div class="row chip-row" style="gap:6px;margin-bottom:8px">${chip("alle", "Alle")}${chip("klausur", "Klausuren")}${chip("abgabe", "Abgaben")}${chip("todo", "To-Dos")}</div>
    <label class="row" style="font-size:14px;margin-bottom:6px"><input type="checkbox" data-act="calshowdone" ${showDone ? "checked" : ""}> Erledigte zeigen</label>
    ${body || `<div class="empty"><div class="ei">${ICON.spark}</div>Nichts in dieser Auswahl.</div>`}
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
  return `<div class="listrow${ui.popId === t.id ? " pop" : ""}" data-drag="${t.id}">
    <input type="checkbox" data-act="tdone" data-id="${t.id}" ${t.done ? "checked" : ""} ${canCheck(t) ? "" : "disabled"}>
    <div class="grow"><span class="${t.done ? "done-title" : ""}"><b>${esc(t.title)}</b></span>
      <div class="muted" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="color:${c};display:inline-flex;align-items:center;gap:4px">${typeIcon(t.type, c, 13)}${CAT_LABEL[t.type] || "To-Do"}</span>${t.time ? " · " + esc(t.time) : ""}${t.date ? "" : " · Termin folgt"}</div></div>
    <span class="prio ${prio}">${prio}</span>
    <button class="btn ghost" data-act="tedit" data-id="${t.id}">${ICON.edit}</button>
  </div>`;
}

// ---------- Vorlesungs-Protokolle ----------
function viewModules() {
  if (ui.modOpen && state.modules[ui.modOpen]) return viewModuleDetail(ui.modOpen);

  let h = `<h2 style="margin-bottom:14px">Vorlesungs-Protokolle</h2>
    <div class="prot-search"><span aria-hidden="true">🔍</span><input id="modSearch" placeholder="Module und Mitschriften durchsuchen …" value="${esc(ui.modSearch)}"></div>`;
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
  const kindOf = modKindOf;
  const kindLabel = { vl: "Vorlesungen", ueb: "Übungen", tut: "Tutorien" };
  const kindChip = (v, label) => `<button class="btn ${kf === v ? "" : "ghost"}" data-act="modkind" data-v="${v}">${label}</button>`;
  h += `<div class="row chip-row" style="gap:6px;margin-bottom:10px">${kindChip("alle", "Alle")}${kindChip("vl", "Vorlesungen")}${kindChip("ueb", "Übungen")}${kindChip("tut", "Tutorien")}</div>`;
  h += `<div class="row" style="justify-content:flex-end;margin-bottom:10px"><label class="row" style="font-size:14px"><input type="checkbox" data-act="showhidden" ${ui.showHidden ? "checked" : ""}> Ausgeblendete anzeigen</label></div>`;

  if (!visible.length && !(ui.showHidden && hidden.length)) {
    return h + `<div class="card muted">Noch keine Protokolle. Ein Protokoll entsteht, sobald du dazu eine Notiz oder ein Thema anlegst.</div>`;
  }

  const groups = ["vl", "ueb", "tut"].filter((k) => kf === "alle" || kf === k);
  h += groups.map((k) => {
    const list = visible.filter((n) => kindOf(n) === k);
    if (!list.length) return "";
    return (kf === "alle" ? `<h4 style="margin-top:18px">${kindLabel[k]}</h4>` : "") +
      laid("prot-" + k, list.map((n) => ({ id: n, w: 4, h: 3, html: cardHTML(n, false) })), `<div class="dash-grid mod-grid">` + list.map((n) => cardHTML(n, false)).join("") + `</div>`);
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
      <button class="btn ghost menu-btn" data-act="mmenu" data-m="${enc(name)}" title="Optionen">${ICON.more}</button>
    </div>
    <div class="progress"><div style="width:${pct}%;background:${m.color}"></div></div>
  </div>`;
}

function openModuleMenu(name) {
  modalTintName = name;
  const n = enc(name);
  openModal(`
    <h3>${esc(name)}</h3>
    <div class="menu-list">
      <button class="btn" data-act="mkind" data-m="${n}">Kategorie: ${KIND_LABEL[modKindOf(name)]} ändern</button>
      <button class="btn" data-act="mexport" data-m="${n}">Als Textdatei speichern</button>
      <button class="btn" data-act="medit" data-m="${n}">Bearbeiten (Farbe)</button>
      <button class="btn danger" data-act="mtrash" data-m="${n}">In den Papierkorb</button>
    </div>
    <div class="row"><button class="btn ghost" data-act="mclose">Schließen</button></div>
    <p class="muted">Die Termine im Stundenplan bleiben erhalten.</p>`);
}

function openKindPicker(name) {
  const n = enc(name);
  openModal(`
    <h3>Kategorie von „${esc(name)}“</h3>
    <div class="menu-list">
      <button class="btn ${modKindOf(name) === "vl" ? "" : "ghost"}" data-act="mkindset" data-m="${n}" data-v="vl">Vorlesung</button>
      <button class="btn ${modKindOf(name) === "ueb" ? "" : "ghost"}" data-act="mkindset" data-m="${n}" data-v="ueb">Übung</button>
      <button class="btn ${modKindOf(name) === "tut" ? "" : "ghost"}" data-act="mkindset" data-m="${n}" data-v="tut">Tutorium</button>
    </div>
    <div class="row"><button class="btn ghost" data-act="mclose">Abbrechen</button></div>`);
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

// Zahl am Kalender-Reiter: offene Aufgaben bis Sonntag (überfällige eingeschlossen)
function syncTabBadge() {
  const btn = document.querySelector('.tabbar button[data-tab="kalender"]');
  if (!btn) return;
  const weekEnd = iso(addDays(mondayOf(new Date()), 6));
  const n = state.todos.filter((t) => !t.done && t.date && t.date <= weekEnd).length;
  let b = btn.querySelector(".tab-badge");
  if (!n) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement("span"); b.className = "tab-badge"; btn.appendChild(b); }
  b.textContent = n > 99 ? "99+" : String(n);
}
// Links und Quellen pro Modul (z. B. NotebookLM)
function openModLinkEdit(name, id) {
  const m = state.modules[name];
  const l = id && m.links ? m.links.find((x) => x.id === id) : null;
  const v = l || { title: "", url: "https://" };
  openModal(`<h3>Link · ${esc(name)}</h3>
    <form data-form="modlink" data-m="${enc(name)}" data-id="${l ? l.id : ""}">
      <label class="muted">Titel</label>
      <input name="title" required value="${esc(v.title)}" placeholder="z. B. NotebookLM Skript Kap. 3">
      <label class="muted">Link</label>
      <input name="url" type="url" required value="${esc(v.url)}" placeholder="https://…">
      <div class="sheet-actions">
        ${l ? `<button type="button" class="danger-text" data-act="mldel" data-m="${enc(name)}" data-id="${l.id}">Löschen</button>` : "<span></span>"}
        <div class="right"><button type="button" class="btn ghost" data-act="mclose">Abbrechen</button><button class="btn">Speichern</button></div>
      </div>
    </form>`);
}
function linksCardHTML(name, m) {
  const n = enc(name);
  const links = m.links || [];
  const rows = links.map((l) => `<div class="listrow" style="align-items:center;gap:8px">
      <div class="grow"><b>${esc(l.title)}</b><div class="muted" style="font-size:12px;word-break:break-all">${esc(l.url)}</div></div>
      <a class="btn ghost" href="${esc(l.url)}" target="_blank" rel="noopener">Öffnen</a>
      <button class="btn ghost" data-act="mledit" data-m="${n}" data-id="${l.id}">${ICON.edit}</button>
    </div>`).join("");
  return `<div class="card">
      <div class="row" style="justify-content:space-between">
        <div class="sec-title" style="margin:0">Links & Quellen</div>
        <button class="btn btn-sm" data-act="mlnew" data-m="${n}">+ Link</button>
      </div>
      ${rows || `<div class="muted">Noch kein Link, z. B. zu NotebookLM oder einer Quelle.</div>`}
    </div>`;
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
        <button class="btn ghost back-btn" data-act="mback" title="Zurück">${ICON.back}</button>
        <div class="grow"><div class="mod-title" style="color:${m.color}">${esc(name)}</div>
          <div class="muted">${done} von ${total} Themen fertig</div></div>
        <button class="btn ghost menu-btn" data-act="mmenu" data-m="${n}" title="Optionen">${ICON.more}</button>
      </div>
      <div class="progress"><div style="width:${pct}%;background:${m.color}"></div></div>
    </div>
    ${linksCardHTML(name, m)}
    <div class="card">
      <div class="sec-title">Themen</div>
      <form data-form="topic" data-m="${n}" class="row quick-row">
        <input name="title" placeholder="Neues Thema …" required style="flex:1"><button class="btn">+</button>
      </form>
      ${m.topics.map((t) => topicCard(name, t)).join("") || `<div class="empty"><div class="ei">${ICON.book}</div>Noch keine Themen. Lege oben das erste an.</div>`}
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
    ${complete ? `<span class="pct" style="background:${m.color};color:${textOn(m.color)}">${ICON.check} 100 %</span>` : ""}
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
        <button class="btn ghost back-btn" data-act="tback" title="Zurück">${ICON.back}</button>
        <div class="grow"><div class="mod-title">${esc(t.title)}</div><div class="muted">${esc(name)}</div></div>
        ${complete ? `<span class="pct" style="background:${m.color};color:${textOn(m.color)}">${ICON.check} 100 %</span>` : ""}
        <button class="btn ghost" data-act="ttitle" data-id="${t.id}" data-m="${n}" title="Umbenennen">${ICON.edit}</button>
      </div>
    </div>
    <div class="card">
      <div class="row" style="justify-content:space-between">
        <div class="sec-title" style="margin:0">Einträge</div>
        <button class="btn" data-act="nnewt" data-m="${n}" data-t="${t.id}">+ Eintrag</button>
      </div>
      ${list.map((x) => noteBlock(name, x)).join("") || `<div class="empty"><div class="ei">${ICON.note}</div>Noch keine Einträge. Lege den ersten an.</div>`}
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
    <button class="btn ghost" data-act="nedit" data-id="${x.id}" data-m="${enc(name)}" title="Bearbeiten">${ICON.edit}</button>
    <button class="btn ghost" data-act="ndel" data-id="${x.id}" data-m="${enc(name)}" title="Löschen">${ICON.x}</button>
  </div>`;
}

// ---------- Einstellungen ----------
function phoneToolsHTML() {
  return `<div class="card phone-tools">
    <h3 style="margin-top:0">Werkzeuge</h3>
    <div class="row" style="gap:8px;flex-wrap:wrap">
      <button class="btn ghost" data-act="undo">${ICON.undo} Rückgängig</button>
      <button class="btn ghost" data-act="redo">${ICON.redo} Wiederholen</button>
      <button class="btn ghost lay-btn" data-act="laytoggle">Layout bearbeiten</button>
      <button class="btn ghost" data-act="navside">${ICON.swap} Leiste wechseln</button>
    </div>
    <p class="muted" style="margin:10px 0 0">Sync: <span class="syncStatus sync">lokal</span></p>
  </div>`;
}
// Kopfzeile im Stundenplan: normal (ausgeschriebener Tag + Datum) oder kompakt (nur Tag)
function headCardHTML() {
  const v = state.settings.planHead === "kompakt" ? "kompakt" : "normal";
  return `<div class="card"><h3>Kopfzeile im Stundenplan</h3>
    <p class="muted" style="margin:0 0 10px">Normal: Wochentag ausgeschrieben, wenn Platz ist, und das Datum. Kompakt: nur der Wochentag.</p>
    <div class="row" style="gap:6px">
      <button class="btn ${v === "normal" ? "" : "ghost"}" data-act="headset" data-v="normal">Normal</button>
      <button class="btn ${v === "kompakt" ? "" : "ghost"}" data-act="headset" data-v="kompakt">Kompakt</button>
    </div></div>
  <div class="card"><h3>Stundenhöhe</h3>
    <p class="muted" style="margin:0 0 10px">Wie hoch eine Stunde im Stundenplan ist. Zwei Finger auf dem Stundenplan zoomen geht genauso. Das Raster hat in jeder Woche dieselbe Höhe, die Stunden passen sich an. Bei 100 % passt das Raster genau auf den Bildschirm.</p>
    <div class="row" style="gap:6px;align-items:center">
      <button class="btn ghost" data-act="zoomstep" data-v="-0.1">−</button>
      <b>${Math.round((state.settings.zoomY || 1) * 100)} %</b>
      <button class="btn ghost" data-act="zoomstep" data-v="0.1">+</button>
      <button class="btn ghost" data-act="zoomstep" data-v="reset">Standard</button>
    </div></div>`;
}

// Abschnitte der Einstellungen (Schlüssel = Seitenname). Jede Karte ist eine klar benannte Gruppe.
function settingsPages() {
  const s = state.settings;
  const mode = currentMode();
  const c = themeColors();
  const pages = {};
  const btns = (items, cur, act) => `<div class="row" style="gap:6px;flex-wrap:wrap">${items.map(([v, l]) =>
    `<button class="btn ${cur === v ? "" : "ghost"}" data-act="${act}" data-v="${v}">${l}</button>`).join("")}</div>`;
  const themeNow = s.themeMode === "system" ? "system" : s.dark ? "dark" : "light";
  const zoomBtns = `<div class="row" style="gap:6px;align-items:center">
      <button class="btn ghost" data-act="zoomstep" data-v="-0.1">−</button>
      <b>${Math.round((s.zoomY || 1) * 100)} %</b>
      <button class="btn ghost" data-act="zoomstep" data-v="0.1">+</button>
      <button class="btn ghost" data-act="zoomstep" data-v="reset">Standard</button>
    </div>`;

  // KI-Assistent: Gemini-Key, wird auf dem Server gespeichert und ist für andere nicht lesbar
  if (ui.setPage === "ki" && !keyStatusLoaded) { keyStatusLoaded = true; setTimeout(refreshKeyStatus, 0); }
  if (ui.setPage === "ki" && !iconsLoaded) { iconsLoaded = true; setTimeout(loadIcons, 0); }
  pages.ki = [`<div class="card"><h3>Gemini-Key</h3>
      <p class="muted" style="margin-top:0">Den kostenlosen Key holst du bei Google AI Studio. Er wird auf dem Server gespeichert, nicht auf diesem Gerät, und ist danach nicht mehr auslesbar. Auf allen deinen angemeldeten Geräten steht er dann zur Verfügung.</p>
      <div id="geminiStatus" class="muted" style="margin-bottom:10px">${keyStatusText}</div>
      <form data-form="geminikey" class="row" style="gap:8px">
        <input name="key" type="password" autocomplete="off" placeholder="Key einfügen" style="flex:1" required>
        <button class="btn">Speichern</button>
      </form>
      <div class="row" style="margin-top:10px"><button class="btn ghost" data-act="geminidel">Key entfernen</button></div>
    </div>`, iconsCardHTML()];
  // Erscheinungsbild: Modus, Designs, Schrift, Farben
  pages.darst = [
    `<div class="card"><h3>Hell oder dunkel</h3>
      <p class="muted" style="margin-top:0">Gilt nur für dieses Gerät.</p>
      ${btns([["light", "Hell"], ["dark", "Dunkel"], ["system", "Wie Gerät"]], themeNow, "themeset")}</div>`,
    viewDesignCard(),
    dynCardHTML(),
    `<div class="card"><h3>Schrift & Anzeige</h3>
      <label class="muted" style="display:block;margin-bottom:6px">Schriftgröße: ${s.fontScale || 100} % (nur auf diesem Gerät)</label>
      <input type="range" min="80" max="150" step="5" value="${s.fontScale || 100}" data-change="fontscale" style="width:100%;margin-bottom:14px">
      <label class="muted" style="display:block;margin:4px 0 6px">Schriftart (nur auf diesem Gerät)</label>
      ${btns([["inter", "Inter"], ["system", "System"], ["serif", "Serif"], ["rounded", "Rund"]], FONT_STACKS[s.font] ? s.font : "inter", "fontsel")}
      <div style="height:12px"></div>
      <label class="row"><input type="checkbox" data-change="scrollbars" ${s.scrollbars !== false ? "checked" : ""}> Scrollbalken anzeigen (nur auf diesem Gerät)</label>
    </div>`,
    `<div class="card"><h3>Farben (${mode === "dark" ? "Dunkel" : "Hell"}-Modus)</h3>
      <p class="muted" style="margin-top:0">Jeder Modus hat eigene Farben.</p>
      ${Object.keys(THEME_LABELS).map((key) => `<label class="muted" style="display:block;margin-top:10px">${THEME_LABELS[key]}</label>
        <input type="color" value="${c[key]}" data-change="color" data-key="${key}">`).join("")}
      <div class="row" style="margin-top:14px"><button class="btn ghost" data-act="colorreset">Standardfarben wiederherstellen</button></div>
    </div>`,
    `<div class="card"><h3>Kategorie-Farben</h3>
      <p class="muted" style="margin-top:0">Gelten auf allen Geräten gleich.</p>
      ${[["todo", "To-Do"], ["abgabe", "Abgabe"], ["klausur", "Klausur"], ["done", "Erledigt (im Kalender)"]].map(([key, label]) =>
        `<label class="muted" style="display:block;margin-top:10px">${label}</label>
        <input type="color" value="${s.plan[key] || PLAN_DEFAULTS[key]}" data-change="catcolor" data-key="${key}">`).join("")}
    </div>`,
  ].join("");

  // Stundenplan: Semester, Datei, Anzeige. Zeitachse, Wochenende und Termine stehen im Menü des Stundenplans.
  pages.stunden = [
    `<div class="card"><h3>Semester</h3>
      <form data-form="semester"><label class="muted">Semester-Bezeichnung</label>
        <input name="semester" value="${esc(s.semester)}"><button class="btn">Speichern</button></form></div>`,
    `<div class="card"><h3>Vorlesungsfreie Zeit &amp; Feiertage</h3>
      <p class="muted" style="margin-top:0">Diese Tage sind im Kalender markiert, damit man sieht, wann keine Vorlesung ist.</p>
      ${breaksListHTML()}
      <form data-form="break" class="break-form">
        <input name="name" placeholder="Bezeichnung, z. B. Weihnachtsferien" required maxlength="80">
        <div class="grid2">
          <div><label class="muted">Von</label><input type="date" name="from" required></div>
          <div><label class="muted">Bis (leer = ein Tag)</label><input type="date" name="to"></div>
        </div>
        <div class="row" style="margin-top:8px"><button class="btn">Hinzufügen</button></div>
      </form></div>`,
    `<div class="card"><h3>Stundenplan-Datei</h3>
      <p class="muted" style="margin-top:0">Ersetzt den bisherigen Stundenplan. Module werden automatisch angelegt, vorhandene Einträge bleiben erhalten. Aktuell: ${state.events.length} Termine.</p>
      <input type="file" accept=".ics,text/calendar" data-change="ics"></div>`,
    `<div class="card"><h3>Anzeige</h3>
      <label class="muted" style="display:block;margin-bottom:6px">Kopfzeile: Normal zeigt Wochentag und Datum, Kompakt nur den Wochentag</label>
      ${btns([["normal", "Normal"], ["kompakt", "Kompakt"]], s.planHead === "kompakt" ? "kompakt" : "normal", "headset")}
      <label class="muted" style="display:block;margin:16px 0 6px">Stundenhöhe (zwei Finger auf dem Stundenplan geht auch)</label>
      ${zoomBtns}
      <p class="muted" style="margin-bottom:0">Zeitachse, Wochenende und Termine stellst du im Menü des Stundenplans ein.</p>
    </div>`,
  ].join("");

  // Bedienung: Startseite, Reiterleiste, Haken, Werkzeuge
  pages.navi = [
    `<div class="card"><h3>Startseite</h3>
      <p class="muted" style="margin-top:0">Dieser Reiter wird beim Öffnen der App zuerst gezeigt. Nur auf diesem Gerät.</p>
      ${btns([["dashboard", "Dashboard"], ["stundenplan", "Stundenplan"], ["kalender", "Kalender"], ["protokolle", "Protokolle"], ["einstellungen", "Einstellungen"]], s.startTab || "dashboard", "startset")}</div>`,
    `<div class="card"><h3>Reiterleiste</h3>
      ${btns([["", "Automatisch"], ["left", "Links"], ["bottom", "Unten"]], s.navSide || "", "navset")}
      <p class="muted" style="margin-bottom:0">Automatisch: links am PC, unten am Handy. Nur auf diesem Gerät.</p></div>`,
    `<div class="card"><h3>Haken bei Listen</h3>
      ${btns([["left", "Links vom Namen"], ["right", "Rechts vom Namen"]], s.checkSide || "left", "checkset")}</div>`,
    phoneToolsHTML(),
  ].join("");

  // Daten & Cloud: Sicherung, Cloud, Papierkorb, Zurücksetzen
  pages.daten = [
    `<div class="card"><h3>Sicherung</h3>
      <p class="muted" style="margin-top:0">Backup: du wählst, was hinein soll. Beim Wiederherstellen wählst du, was ersetzt wird. Vollständige Kopie: alle Daten ohne Auswahl.</p>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <button class="btn" data-act="export">Backup speichern (JSON)</button>
        <button class="btn ghost" data-act="exportdata">Vollständige Kopie</button>
      </div>
      <label class="muted" style="display:block;margin-top:14px">Backup wiederherstellen</label>
      <input type="file" accept=".json,application/json" data-change="import"></div>`,
    `<div class="card"><h3>Cloud-Sync (Supabase)</h3>${cloudSection()}</div>`,
    trashSection(),
    `<div class="card"><h3>Alles zurücksetzen</h3>
      <p class="muted">Löscht Stundenplan, Protokolle, To-Dos, Karten und den Papierkorb. Mit „Rückgängig“ lässt sich das wieder zurücknehmen. Die Änderung wird auch in der Cloud gespeichert.</p>
      <button class="btn danger" data-act="resetall">Alle Daten zurücksetzen</button></div>`,
  ].join("");
  return pages;
}

// Unterseiten der Benachrichtigungen
const NF_SUBS = [
  { k: "push", t: "Gerät & Aktivierung", d: "Aktivieren, deaktivieren" },
  { k: "geraet", t: "Vibration & Ton", d: "Nur auf diesem Gerät" },
  { k: "test", t: "Testnachrichten", d: "Beispiel für jede Art senden" },
  { k: "mod", t: "Modul-Erinnerungen", d: "Vorwarnzeit, Module ein- und ausschalten" },
  { k: "custom", t: "Eigene Erinnerungen", d: "Feste Uhrzeit oder vor einer Vorlesung" },
  { k: "mensa", t: "Mensa", d: "An/aus und Uhrzeit" },
  { k: "fristen", t: "Fristen am Morgen", d: "An/aus und Uhrzeit" },
  { k: "vorschau", t: "Vorschau nächste Woche", d: "Freitag, Samstag, Sonntag" },
  { k: "quiet", t: "Ruhezeit", d: "Keine Nachrichten in dieser Zeit" },
  { k: "log", t: "Verlauf", d: "Alle gesendeten Nachrichten" },
];
const SET_ROW = "display:flex;align-items:center;gap:10px;width:100%;padding:14px;border:0;border-bottom:1px solid var(--line);background:none;text-align:left;color:inherit;min-height:56px;font:inherit";

// Verlauf: alle gesendeten Nachrichten aus der Cloud
async function loadNotifyLog() {
  if (!sb || !session || ui.nfLogBusy) return;
  ui.nfLogBusy = true;
  const { data, error } = await sb.from("sent_notifications")
    .select("title, body, created_at")
    .not("title", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);
  ui.nfLogBusy = false;
  ui.nfLog = error ? [] : (data || []);
  render();
}

function notifyLogHTML() {
  if (!sb || !session) return `<p class="muted">Zum Anzeigen bitte anmelden.</p>`;
  if (!ui.nfLog) {
    loadNotifyLog();
    return `<p class="muted">Lade …</p>`;
  }
  if (!ui.nfLog.length) return `<p class="muted">Noch keine Nachrichten verschickt.</p>`;
  const when = (t) => new Date(t).toLocaleString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `<div class="card" style="padding:0;overflow:hidden">${ui.nfLog.map((r) =>
    `<div class="listrow" style="align-items:flex-start"><div class="grow"><b>${esc(r.title)}</b><div class="muted" style="white-space:pre-line;font-size:13px">${esc(r.body || "")}</div></div><span class="muted" style="font-size:12px;white-space:nowrap">${when(r.created_at)}</span></div>`).join("")}</div>`;
}

// Einstellungen: Hauptliste mit Suche, jeder Punkt öffnet einen Bereich
// Symbole für die Einstellungs-Bereiche (Linien-Stil statt Emojis)
const SET_ICON = {
  darst: ICON_SVG('<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.2" fill="currentColor"/><circle cx="12" cy="7.5" r="1.2" fill="currentColor"/><circle cx="16" cy="10" r="1.2" fill="currentColor"/>'),
  stunden: ICON_SVG('<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  benach: ICON_SVG('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  navi: ICON_SVG('<path d="M4 7h16M4 12h10M4 17h13"/>'),
  daten: ICON_SVG('<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>'),
  gear: ICON_SVG('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
};
const SETTINGS_LIST = [
  { k: "darst", t: "Erscheinungsbild", d: "Hell/Dunkel, Designs, Schrift, Farben", w: "design vorlage preset hell dunkel schrift scrollbalken farben kategorie akzent", ic: "🎨", col: "#ec4899" },
  { k: "stunden", t: "Stundenplan", d: "Semester, Stundenplan-Datei, Kopfzeile, Höhe", w: "stundenplan semester ics termine kopfzeile höhe zoom ferien feiertage vorlesungsfrei", ic: "📅", col: "#0ea5e9" },
  { k: "benach", t: "Benachrichtigungen", d: "Module, Mensa, Fristen, Ruhezeit, Tests", w: "benachrichtigung mensa fristen modul ruhezeit test vorwarnzeit push", ic: "🔔", col: "#f59e0b" },
  { k: "navi", t: "Bedienung", d: "Startseite, Reiterleiste, Werkzeuge", w: "bedienung startseite reiterleiste navigation haken werkzeuge rückgängig layout", ic: "🧭", col: "#8b5cf6" },
  { k: "ki", t: "KI-Assistent", d: "Gemini-Key für Mensa, Erinnerungen und mehr", w: "ki ai gemini key schlüssel api assistent mensa erinnerung", ic: "✨", col: "#6366f1" },
  { k: "daten", t: "Daten & Cloud", d: "Sicherung, Cloud-Sync, Papierkorb, Zurücksetzen", w: "backup sicherung export import papierkorb zurücksetzen cloud sync anmelden", ic: "☁️", col: "#10b981" },
];

function viewSettings() {
  const pages = settingsPages();
  // Benachrichtigungen: eigene Liste mit Unterseiten
  if (ui.setPage === "benach") {
    const back = (title, act) => `<div class="row" style="gap:10px;margin-bottom:12px"><button class="btn ghost" data-act="${act}">‹ Zurück</button><h2 style="margin:0">${title}</h2></div>`;
    if (!ui.nfOnly) {
      const rows = NF_SUBS.map((x) => `<button data-act="nfopen" data-k="${x.k}" style="${SET_ROW}"><div class="grow"><b>${x.t}</b><div class="muted" style="font-size:13px">${x.d}</div></div><span class="muted">›</span></button>`).join("");
      return back("Benachrichtigungen", "setback") + `<div class="card" style="padding:0;overflow:hidden">${rows}</div>`;
    }
    const info = NF_SUBS.find((x) => x.k === ui.nfOnly);
    const body = ui.nfOnly === "geraet" ? deviceNotifyHTML() : ui.nfOnly === "push" ? pushCardHTML() : ui.nfOnly === "log" ? notifyLogHTML() : ui.nfOnly === "custom" ? customNotifyHTML() : notifyDetailsHTML();
    return back(info ? info.t : "", "nfback") + body;
  }
  if (ui.setPage && pages[ui.setPage] !== undefined) {
    const info = SETTINGS_LIST.find((x) => x.k === ui.setPage);
    return `<div class="row" style="gap:10px;margin-bottom:12px"><button class="btn ghost" data-act="setback">‹ Zurück</button><h2 style="margin:0;display:flex;align-items:center;gap:8px"><span class="setic" style="--c:${info ? info.col : "#64748b"}">${info ? info.ic : ""}</span>${info ? info.t : ""}</h2></div>${pages[ui.setPage]}`;
  }
  const q = (ui.setQuery || "").trim().toLowerCase();
  const rows = SETTINGS_LIST.filter((x) => !q || `${x.t} ${x.d} ${x.w}`.toLowerCase().includes(q));
  return `<h2 style="margin-bottom:10px">Einstellungen</h2>
    <input type="search" data-setq="1" placeholder="Einstellungen suchen" value="${esc(ui.setQuery || "")}" style="width:100%;margin-bottom:12px">
    <div class="card setcard">
      ${rows.map((x) => `<button data-act="setopen" data-k="${x.k}" class="setrow" style="--c:${x.col || "#64748b"}"><span class="setic">${SET_ICON[x.k] || SET_ICON.gear}</span><span class="grow"><b>${x.t}</b><span class="muted setd">${x.d}</span></span><span class="setchev">›</span></button>`).join("") || `<div class="muted" style="padding:14px">Nichts gefunden.</div>`}
    </div>`;
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
// Zurück-Taste: ein Fenster schließt zuerst, dann erst die Seite (siehe popstate weiter unten)
let ignorePop = 0;   // Anzahl selbst ausgelöster history.back()-Aufrufe, die nicht als Zurück gelten
let modalTok = 0;    // verhindert, dass ein ausblendendes Fenster ein neu geöffnetes wieder entfernt
// Kurzes Antippen: alles Antippbare wird kurz kleiner und federt zurück (nicht beim Wischen oder Scrollen)
const TAP_SEL = "button, a, [data-act], .card, .modcard, .listrow, .ev, .dchip, .mday, .plan-corner, .look-opt, .tabbar button, .item";
let tapStart = null;
document.addEventListener("pointerdown", (e) => {
  tapStart = { x: e.clientX, y: e.clientY, el: e.target.closest ? e.target.closest(TAP_SEL) : null };
}, true);
document.addEventListener("pointerup", (e) => {
  const s = tapStart;
  tapStart = null;
  if (!s || !s.el || Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10 || s.el.matches("input, textarea, select")) return;
  const el = s.el;
  el.classList.remove("tap-pulse");
  void el.offsetWidth; // Neustart der Animation
  el.classList.add("tap-pulse");
  el.addEventListener("animationend", () => el.classList.remove("tap-pulse"), { once: true });
}, true);
// Pop-ups wachsen aus dem zuletzt angetippten Element heraus und schrumpfen beim Schließen dorthin
let tapOrigin = null, modalFrom = null, modalTintName = null;
document.addEventListener("pointerdown", (e) => {
  const el = e.target.closest ? e.target.closest("[data-act], .item, .ev, .dchip, .mday, .card, .modcard, .listrow") : null;
  tapOrigin = el ? { r: el.getBoundingClientRect(), t: Date.now() } : null;
}, true);
function growFromTap(sheet) {
  const o = tapOrigin;
  tapOrigin = null;
  modalFrom = null;
  if (!sheet || !o || Date.now() - o.t > 900 || !sheet.animate || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  sheet.style.animation = "none"; // erst die CSS-Animation aus, damit die Maße stimmen
  const s = sheet.getBoundingClientRect(), r = o.r;
  if (!s.width || !r.width) return;
  const x = r.left + r.width / 2 - (s.left + s.width / 2);
  const y = r.top + r.height / 2 - (s.top + s.height / 2);
  // Breite und Höhe der Karte getrennt übernehmen, damit das Pop-up in deren Format startet
  const sx = Math.max(0.2, Math.min(1, r.width / s.width));
  const sy = Math.max(0.12, Math.min(1, r.height / s.height));
  modalFrom = { x, y, sx, sy };
  sheet.animate([
    { opacity: 0, transform: `translate(${x}px, ${y}px) scale(${sx}, ${sy})` },
    { opacity: 1, transform: "none" },
  ], { duration: 520, easing: "cubic-bezier(.32,.72,0,1)" });
}

function openModal(html) {
  ui.dayPop = null;
  const root = document.getElementById("modalRoot");
  modalTok++;
  // Eigener Verlaufseintrag für das Fenster, damit die Zurück-Taste es zuerst schließt
  if (!(history.state && history.state.sp === "modal")) { try { history.pushState({ sp: "modal" }, ""); } catch (_) {} }
  root.innerHTML = `<div class="modal" data-act="mbg"><div class="sheet">${html}</div></div>`;
  const sheet = root.querySelector(".sheet");
  const tint = modalTintName;
  modalTintName = null;
  const color = tint && (state.modules[tint] || {}).color;
  if (color && sheet) { sheet.classList.add("mod-tint"); sheet.style.setProperty("--mod", color); }
  growFromTap(sheet);
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
  return `<div class="card deadline" data-act="todoopen" data-id="${next.id}" style="border-left:6px solid ${col};cursor:pointer">
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
    `<div class="listrow" data-act="tedit" data-id="${t.id}" style="cursor:pointer"><span class="pdot" style="background:${catColor(t.type)}"></span><div class="grow"><b>${esc(t.title)}</b></div></div>`).join("");
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
    ${sec("Erledigt", d.done.map((t) => `<div class="listrow" data-act="tedit" data-id="${t.id}" style="cursor:pointer"><span class="pdot" style="background:${catColor(t.type)}"></span><div class="grow"><b>${esc(t.title)}</b><div class="muted">${CAT_LABEL[t.type] || "Aufgabe"} · ${fmtD(parseIso(t.date))}</div></div></div>`))}
    ${sec("Protokolle", d.notes.map(({ name, n }) => `<div class="note"><div class="muted">${fmtD(parseIso(n.date))} · <b>${esc(name)}</b></div>${esc(n.done)}${n.todo ? `<div class="muted" style="margin-top:6px">Noch zu lernen: ${esc(n.todo)}</div>` : ""}</div>`))}
    ${sec("Termine", d.termine.map((e) => `<div class="listrow" data-act="modgo" data-m="${enc(e.name)}" style="cursor:pointer"><span class="bar" style="background:${colorOf(e.name)}"></span><div class="grow"><b>${esc(e.name)}</b><div class="muted">${fmtD(parseIso(e.date))} · ${fmtMin(e.start)}${e.room ? " · " + esc(e.room) : ""}</div></div></div>`))}
    <div class="sheet-actions"><button class="btn ghost" data-act="mclose">Schließen</button></div>`);
}
document.addEventListener("change", (e) => {
  const k = e.target.dataset && e.target.dataset.sf;
  if (!k) return;
  ui[{ from: "calFrom", to: "calTo", type: "calType", mod: "calMod" }[k]] = e.target.value;
  render();
});

// ---------- Mensa-Karte (Speiseplan über die Supabase-Funktion "mensa") ----------
const MENSA_LS = "studienplaner-mensa-v4";
let mensaTried = null;   // Tag, für den schon geladen wurde (verhindert Schleifen)
let mensaErr = false;
let mensaBusy = false;
// Speicher: je Datum ein Eintrag, nur die letzten 10 Tage
function mensaCache() {
  try { return JSON.parse(localStorage.getItem(MENSA_LS) || "{}") || {}; } catch { return {}; }
}
// Wochenende ausblenden, wenn es in den Einstellungen aus ist (Sa/So → Montag)
function mensaTarget() {
  let d = parseIso(ui.mensaDay || iso(new Date()));
  if (!state.settings.weekend) while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
  return iso(d);
}
// Tag wechseln (v = ±1); 0 = heute. Ausgeblendete Wochentage werden übersprungen.
function mensaStep(v) {
  if (v === 0) { ui.mensaDay = null; render(); return; }
  let d = addDays(parseIso(mensaTarget()), v);
  if (!state.settings.weekend) while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, v);
  ui.mensaDay = iso(d);
  render();
}
// Wischen über die Mensa-Karte wechselt den Tag
let mensaTouch = null;
document.addEventListener("touchstart", (e) => {
  const c = e.target.closest && e.target.closest(".mensa-card");
  mensaTouch = c && e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
}, { passive: true });
document.addEventListener("touchend", (e) => {
  if (!mensaTouch) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - mensaTouch.x, dy = t.clientY - mensaTouch.y;
  mensaTouch = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) mensaStep(dx < 0 ? 1 : -1);
}, { passive: true });
document.addEventListener("touchcancel", () => { mensaTouch = null; }, { passive: true });
// Hinweis: Die Speisedaten sagen nicht, ob ein Gericht vegetarisch ist. Das wird anhand des Namens geschätzt.
const MEAT_RE = /(fleisch|schwein|rind|hähnchen|huhn|pute|geflügel|fisch|lachs|speck|wurst|schinken|kalb|lamm|hack|gyros|döner|salami|ente|bratwurst)/i;
// Symbole je Gericht. Kommen aus den gespeicherten Icon-Erkennungen (Job um 8 Uhr).
const MENSA_MEAT_TAGS = ["schwein", "rind", "gefluegel", "fisch", "lamm"];
// Farbe je Gericht: Fleisch rot, Fisch blau, vegetarisch grün, vegan dunkelgrün, Dessert gelb
const MENSA_COLORS = { fleisch: "#ef4444", fisch: "#3b82f6", vegetarisch: "#22c55e", vegan: "#15803d", dessert: "#eab308", sonst: "#94a3b8" };
const MENSA_DESSERT_RE = /vanille|zimt|kuchen|pudding|(^|\s)eis(\s|$)|dessert|nachspeise|kirsch|schoko|creme|mousse|gri(ß|ss)|michel|waffel|apfel|obst|beeren|dampfnudel|muffin|crumble|strudel|kompott|sahne|nachtisch/i;
function mensaColor(g) {
  const t = g.tags || [];
  if (MENSA_DESSERT_RE.test(g.name)) return MENSA_COLORS.dessert;
  if (t.some((x) => ["schwein", "rind", "gefluegel", "lamm"].includes(x))) return MENSA_COLORS.fleisch;
  if (t.includes("fisch")) return MENSA_COLORS.fisch;
  if (t.includes("vegan")) return MENSA_COLORS.vegan;
  if (t.includes("vegetarisch")) return MENSA_COLORS.vegetarisch;
  return MENSA_COLORS.sonst;
}
// Symbole der Mensa-Seite als Bilder (werden vom Job je Gericht mitgespeichert)
function mensaIcons(g) {
  return (g.bilder || []).map((u) => `<img src="${esc(u)}" alt="" loading="lazy" style="width:18px;height:18px;vertical-align:middle;margin-right:3px">`).join("");
}
function mensaCardHTML() {
  const target = mensaTarget();
  const today = iso(new Date());
  const cached = mensaCache()[target] || null;
  // Liefert der Speiseplan für diesen Tag nichts, wird kein anderer Tag angezeigt
  const offDay = !!(cached && cached.datum && cached.datum !== target);
  const fresh = offDay ? null : cached;
  let body;
  if (offDay) {
    body = `<div class="muted">Keine Daten verfügbar.</div>`;
  } else if (fresh && fresh.gerichte && fresh.gerichte.length) {
    const shown = ui.mensaNoMeat ? fresh.gerichte.filter((g) => !(g.tags || []).some((t) => MENSA_MEAT_TAGS.includes(t))) : fresh.gerichte;
    body = (shown.length ? shown : fresh.gerichte).map((g) =>
      `<div class="mensa-row" style="border-left:4px solid ${mensaColor(g)};padding-left:8px"><span class="muted">${esc(g.label)}</span><span><span style="margin-right:4px">${mensaIcons(g)}</span><b>${esc(g.name)}</b>${g.allergene ? `<div class="muted" style="font-size:12px">Allergene: ${esc(g.allergene)}</div>` : ""}</span><span class="mensa-price">${esc(g.preis.stud)}</span></div>`
    ).join("") + `<div class="muted" style="font-size:12px;margin-top:8px">Symbole von der Mensa-Seite · Farben: rot Fleisch, blau Fisch, grün vegetarisch, dunkelgrün vegan, gelb Dessert${fresh.symbole ? "" : " · Für diesen Tag keine Symbole erkannt"}</div>
      <div class="muted" style="font-size:12px">Preise für Studierende</div>
      ${fresh.symbole ? `<button class="btn ghost btn-sm" data-act="mensafilter" style="margin-top:8px">${ui.mensaNoMeat ? "Alle anzeigen" : "Nur ohne Fleisch"}</button>` : ""}`;
  } else if (fresh) {
    body = `<div class="muted">${esc(fresh.hinweis || "Kein Speiseplan für diesen Tag.")}</div>`;
  } else if (mensaErr) {
    body = `<div class="muted">Speiseplan gerade nicht erreichbar. Mit ${ICON.reload} erneut versuchen.</div>`;
  } else {
    body = `<div class="muted">Speiseplan wird geladen …</div>`;
  }
  const hinweisDatum = false
    ? `<div class="muted" style="font-size:12px;margin-bottom:6px">Angezeigt wird ${parseIso(fresh.datum).toLocaleDateString("de-DE", { weekday: "long" })}</div>` : "";
  const wochentag = parseIso(target).toLocaleDateString("de-DE", { weekday: "long" });
  const title = target === today ? "Mensa heute" : `Mensa · ${wochentag}`;
  const datumKlein = `<div class="muted" style="font-size:12px;margin-top:2px">${fmtD(parseIso(target))}</div>`;
  return `<div class="card mensa-card" id="focus-mensa">
    <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:6px">
      <div><h3 style="margin:0">${title}</h3>${datumKlein}</div>
      <span class="row" style="gap:6px">
        <button class="btn ghost" data-act="mensanav" data-v="-1" title="Tag zurück">‹</button>
        <button class="btn ghost" data-act="mensanav" data-v="0" title="Zu heute">Heute</button>
        <button class="btn ghost" data-act="mensanav" data-v="1" title="Tag vor">›</button>
        <a class="btn ghost lay-keep" href="https://werkswelt.de/?id=mohm" target="_blank" rel="noopener" title="Speiseplan auf der Website öffnen">${ICON.external}</a>
        <button class="btn ghost menu-btn" data-act="mensareload" title="Neu laden">${ICON.reload}</button>
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
    const r = await fetch(SUPABASE_URL + "/functions/v1/mensa?tag=" + target + (force ? "&live=1" : ""), {
      headers: { Authorization: "Bearer " + ((session && session.access_token) || SUPABASE_ANON_KEY), apikey: SUPABASE_ANON_KEY },
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
    const w = layNarrow() ? (it.nw || LAY_COLS) : Math.min(LAY_COLS, it.w || 6);
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
  const screen = document.querySelector(".plan-screen");
  const tb = document.querySelector(".tabbar");
  const tbH = tb && getComputedStyle(tb).display !== "none" ? tb.offsetHeight + 12 : 0; // +12: schwebende Leiste hat Abstand unten
  const top = (screen || wk).getBoundingClientRect().top;
  // Die Stundenhöhe bleibt fest (Zoom/Einstellung). Der Bereich füllt nur den Bildschirm,
  // oben bleiben Wochentage und Aufgaben stehen, das Raster scrollt bei Bedarf.
  if (!screen) return;
  const screenH = Math.max(160, window.innerHeight - top - tbH - 8);
  screen.style.height = screenH + "px";
  planScreenH = screenH;
  // Platz, den das Raster hat (ohne Wochentage und Aufgaben oben)
  const avail = Math.max(120, Math.floor(screenH - (wk.getBoundingClientRect().top - top) - 8));
  if (Math.abs(avail - planGridAvail) >= 2) {
    planGridAvail = avail;
    fitting = true;
    render();
    fitting = false;
    // render() baut den Stundenplan neu auf und verwirft dabei die Höhe. Sie wird hier wieder gesetzt,
    // sonst wächst das Raster auf seine volle Länge und die ganze Seite scrollt statt des Rasters.
    const s2 = document.querySelector(".plan-screen");
    if (s2) s2.style.height = screenH + "px";
  }
}
// Leiste oben im Bearbeitungsmodus
// Bearbeiten im Stundenplan: Termine per Gedrückthalten auf einen Tag ziehen (verschieben oder kopieren)
function planEditBarHTML() {
  return `<div class="card laybar">
    <div class="grow"><b>Termine bearbeiten</b>
      <div class="muted" style="font-size:13px">Termin gedrückt halten und auf einen Tag ziehen. Danach fragt die App: verschieben oder kopieren.</div></div>
    <button class="btn" data-act="planeditdone">Fertig</button>
  </div>`;
}
function layBarHTML() {
  return `<div class="card laybar">
    <div class="grow"><b>Layout bearbeiten</b>
      <div class="muted" style="font-size:13px">Am Rand ziehen: Größe · in der Mitte ziehen: verschieben · einmal tippen: Zahlen eingeben</div></div>
    ${ui.tab === "dashboard" ? `<button class="btn" data-act="cardnew">+ Karte</button>` : `<span class="muted" style="font-size:13px">Karten fügst du im Dashboard hinzu.</span>`}
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
  const root = document.getElementById("modalRoot");
  if (root.innerHTML && history.state && history.state.sp === "modal") {
    ignorePop++;   // das folgende popstate ist unser eigenes Schließen, kein Zurück
    try { history.back(); } catch (_) { ignorePop--; }
  }
  hideModal();
}
// Fenster ausblenden (kurze Animation), Zustand zurücksetzen
function hideModal() {
  const root = document.getElementById("modalRoot");
  ui.dayPop = null;
  const pending = modalResolve;
  modalResolve = null;
  ui.noteFor = null;
  ui.noteWindow = false;
  ui.editNote = null;
  const m = root.querySelector(".modal");
  if (m && !m.classList.contains("out")) {
    const sh = m.querySelector(".sheet");
    const f = modalFrom;
    modalFrom = null;
    m.classList.add("out");
    const tok = ++modalTok;
    if (f && sh && sh.animate) {
      // Zurück in das Element schrumpfen, aus dem das Pop-up gewachsen ist
      sh.style.animation = "none";
      m.style.animation = "none";
      sh.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: `translate(${f.x}px, ${f.y}px) scale(${f.sx}, ${f.sy})` }],
        { duration: 340, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" });
      m.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 340, easing: "ease-in", fill: "forwards" });
      setTimeout(() => { if (tok === modalTok) root.innerHTML = ""; }, 340);
    } else {
      setTimeout(() => { if (tok === modalTok) root.innerHTML = ""; }, 170);
    }
  } else {
    root.innerHTML = "";
  }
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
  modalTintName = name;
  const m = ensureModule(name);
  const note = noteId ? m.notes.find((x) => x.id === noteId) : null;
  const dayKey = date || (note ? note.date : iso(new Date()));
  const selTopic = note ? note.topicId : presetTopic;
  let topicTxt = (selTopic && m.topics.find((t) => t.id === selTopic)?.title) || "";
  let text = note ? note.done : "";
  // Entwurf merken: neue Notiz bleibt erhalten, wenn das Fenster versehentlich schließt
  const draftKey = note ? "" : `studienplaner-draft-${name}-${dayKey}`;
  if (draftKey) {
    try {
      const d = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (d) { text = d.text || ""; topicTxt = d.topic || ""; }
    } catch (_) {}
  }
  const hist = m.notes.filter((x) => x.date === dayKey && x.id !== noteId).sort(byDateDesc);
  openModal(`
    <div class="note-sheet">
      <div class="row" style="justify-content:space-between;align-items:center;gap:8px">
        <b class="grow" style="font-size:17px;color:${m.color}">${esc(name)}</b>
        <button type="button" class="btn ghost" data-act="gotoprot" data-m="${enc(name)}">Protokoll</button>
        <button type="button" class="btn ghost" data-act="mclose" title="Schließen">${ICON.x}</button>
      </div>
      <form data-form="note" ${draftKey ? `data-draft="${esc(draftKey)}"` : ""} class="note-form">
        <input type="hidden" name="module" value="${esc(name)}">
        <input type="hidden" name="id" value="${note ? note.id : ""}">
        <div class="note-meta">
          <label class="date-chip">${fmtD(parseIso(dayKey))}<input type="date" name="date" required value="${dayKey}"></label>
          <input name="topic" class="topic-input" list="topicList" autocomplete="off" placeholder="Thema" value="${esc(topicTxt)}">
          <datalist id="topicList">${m.topics.map((t) => `<option value="${esc(t.title)}">`).join("")}</datalist>
        </div>
        <textarea name="done" class="autogrow" rows="3" placeholder="Schreib einfach los. Stichpunkte reichen.">${esc(text)}</textarea>
        <button class="btn wide">${note ? "Ändern" : "Speichern"}</button>
      </form>
      ${hist.length ? `<h4 class="note-hist-title">Früher an diesem Tag</h4>` + hist.map((x) => noteBlock(name, x)).join("") : ""}
    </div>`);
  const ta = document.querySelector("#modalRoot textarea.autogrow");
  if (ta) growNoteBox(ta);
}
// Textbox wächst mit dem Text, bis etwa 60 % der Bildschirmhöhe
function growNoteBox(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight + 2, Math.round(innerHeight * 0.6)) + "px";
}
document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.matches && t.matches("textarea.autogrow")) growNoteBox(t);
  const f = t.form;
  if (f && f.dataset && f.dataset.draft) {
    try {
      localStorage.setItem(f.dataset.draft, JSON.stringify({
        text: f.elements.done ? f.elements.done.value : "",
        topic: f.elements.topic ? f.elements.topic.value : "",
      }));
    } catch (_) {}
  }
});

// Vorlesungsfreie Zeit und Feiertage: Zeiträume aus den Einstellungen (werden über die Cloud synchronisiert)
function breakOn(k) {
  return (state.settings.breaks || []).find((b) => b.from <= k && k <= (b.to || b.from));
}
function breaksListHTML() {
  const list = state.settings.breaks || [];
  if (!list.length) return `<p class="muted">Noch keine Zeiträume eingetragen.</p>`;
  return `<div class="break-list">${list.map((b) => {
    const same = !b.to || b.to === b.from;
    const range = same ? fmtD(parseIso(b.from)) : `${fmtD(parseIso(b.from))} – ${fmtD(parseIso(b.to))}`;
    return `<div class="sub-row">
      <div class="grow"><b>${esc(b.name)}</b><div class="muted" style="font-size:13px">${range}</div></div>
      <button type="button" class="btn ghost" data-act="brkdel" data-id="${b.id}" title="Entfernen">×</button>
    </div>`;
  }).join("")}</div>`;
}

// Unteraufgaben: kleine Checkliste innerhalb einer Aufgabe (t.subs = [{id, title, done}])
function subsSectionHTML(t) {
  const subs = t.subs || [];
  const n = subs.filter((s) => s.done).length;
  return `<div class="subs" data-subs="${t.id}">
    <label class="muted">Unteraufgaben${subs.length ? ` (${n}/${subs.length})` : ""}</label>
    ${subs.map((s) => `<div class="sub-row${s.done ? " is-done" : ""}">
      <input type="checkbox" data-act="subdone" data-tid="${t.id}" data-sid="${s.id}" ${s.done ? "checked" : ""}>
      <span class="grow">${esc(s.title)}</span>
      <button type="button" class="btn ghost" data-act="subdel" data-tid="${t.id}" data-sid="${s.id}" title="Entfernen">×</button>
    </div>`).join("")}
    <div class="sub-add">
      <input type="text" data-subinput="${t.id}" placeholder="Neue Unteraufgabe" maxlength="120">
      <button type="button" class="btn ghost" data-act="subadd" data-tid="${t.id}">Hinzufügen</button>
    </div>
  </div>`;
}
// Nur den Unteraufgaben-Teil neu zeichnen, damit andere Eingaben im Fenster erhalten bleiben
function refreshSubs(tid) {
  const t = state.todos.find((x) => x.id === tid);
  const box = document.querySelector(`[data-subs="${tid}"]`);
  if (t && box) box.outerHTML = subsSectionHTML(t);
}
// Enter im Feld „Neue Unteraufgabe“ fügt sie hinzu, statt das ganze Formular abzuschicken
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || !e.target.matches || !e.target.matches("[data-subinput]")) return;
  e.preventDefault();
  const btn = document.querySelector(`[data-act="subadd"][data-tid="${e.target.dataset.subinput}"]`);
  if (btn) btn.click();
});

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
      <div class="grid2">
        <div><label class="muted">Datum</label><input type="date" name="date" value="${t ? t.date : date || ""}"></div>
        <div><label class="muted">Bis (optional)</label><input type="date" name="endDate" value="${t && t.endDate ? t.endDate : ""}"></div>
      </div>
      <div class="grid2">
        <div><label class="muted">Uhrzeit</label><input type="time" name="time" value="${t ? t.time : ""}"></div>
        <div><label class="muted">Dauer in Minuten</label><input type="number" name="duration" min="15" step="15" value="${dur}"></div>
      </div>
      ${t ? subsSectionHTML(t) : `<p class="muted" style="font-size:.85em">Unteraufgaben kannst du hinzufügen, sobald die Aufgabe gespeichert ist.</p>`}
      <div class="row" style="margin-top:12px">
        <button class="btn">Speichern</button>
        ${t ? `<button type="button" class="btn danger" data-act="tdelm" data-id="${t.id}">Löschen</button>` : ""}
        <button type="button" class="btn ghost" data-act="mclose">Abbrechen</button>
      </div>
    </form>`);
}

// ---------- Langes Drücken & Wischen ----------
// Gedrückthalten öffnet kein Browser-Menü (Kopieren, Suchen …), außer in Eingabefeldern
document.addEventListener("contextmenu", (e) => {
  if (!e.target.closest || !e.target.closest("input, textarea, [contenteditable='true']")) e.preventDefault();
});
let pressTimer = null;
let pressStart = null;
let longFired = false;

document.addEventListener("pointerdown", (e) => {
  longFired = false;
  if (e.button > 0 || e.target.closest(".modal")) return;

  // Dashboard: langes Drücken auf To-Do oder Countdown-Eintrag öffnet die Bearbeitung
  if (ui.tab === "dashboard") {
    const item = e.target.closest("[data-lp], .ev[data-kind='event']");
    if (!item || e.target.closest("button, input")) return;
    pressStart = { x: e.clientX, y: e.clientY, el: item };
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      longFired = true;
      const el0 = pressStart.el;
      pressStart = null;
      buzz(15);
      // Langes Drücken: Termin = Notiz-Popup, To-Do/Countdown = Bearbeiten (wie im Stundenplan)
      if (el0.classList.contains("ev")) {
        const ev = state.events.find((x) => x.id === el0.dataset.id);
        if (ev) openNoteModal(ev.name, ev.date);
        return;
      }
      openTodoModal(el0.dataset.lp);
    }, 500);
    return;
  }

  // Protokoll: langes Drücken auf ein Thema benennt es um (falls Schreibfehler)
  if (ui.tab === "protokolle" && e.target.closest(".topic-card") && !e.target.closest("button")) {
    const tc = e.target.closest(".topic-card");
    pressStart = { x: e.clientX, y: e.clientY, el: tc };
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      longFired = true;
      const id = pressStart.el.dataset.id;
      const name = dec(pressStart.el.dataset.m);
      pressStart = null;
      hapt(15);
      topicMenu(name, id);
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
      buzz(15);
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
    buzz(15);
    if (el.classList.contains("ev")) {
      // Langes Drücken auf einen Termin = Notiz-Popup (im Bearbeitungsmodus stattdessen zum Verschieben)
      const ev = state.events.find((x) => x.id === el.dataset.id);
      if (ev && !ui.planEdit) openNoteModal(ev.name, ev.date);
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

// Wischen im Stundenplan: die Ansicht gleitet mit dem Finger, die nächste Woche bzw. der nächste Tag kommt von der Seite
let swipe = null;
// ---------- Vorausladen: einige Wochen (bzw. Tage) links und rechts liegen schon bereit ----------
const PRELOAD = 3;
// Tage, die eine Seite (k Wochen bzw. Tage vom aktuellen Stand) zeigt
function pageDates(k) {
  if (ui.view === "day") return [iso(addDays(parseIso(ui.dayDate), k))];
  const mon = addDays(mondayOf(new Date()), (ui.weekOffset + k) * 7);
  const n = state.settings.weekend ? 7 : 5;
  return Array.from({ length: n }, (_, i) => iso(addDays(mon, i)));
}
// Alle Tage aller vorgeladenen Seiten: daraus ergibt sich ein gemeinsamer Zeitbereich
function pagesDates() {
  const out = [];
  for (let k = -PRELOAD; k <= PRELOAD; k++) out.push(...pageDates(k));
  return out;
}
// Eine Gruppe mit allen vorgeladenen Seiten nebeneinander (die mittlere ist die aktuelle)
function pagesGroup(build) {
  let s = "";
  for (let k = -PRELOAD; k <= PRELOAD; k++) s += build(k);
  return `<div class="plan-group">${s}</div>`;
}
// Wochenwechsel ohne Ruckeln: Die Seiten sind vorgeladen, beim Wischen gleitet nur die Gruppe.
// Der teure Neuaufbau (render) kommt erst später im Stillen. Bis dahin merkt sich swipePage, um wie viele Seiten die Ansicht verschoben ist.
var swipePage = 0, swipeFlushTimer = 0;
// Wie viele Finger liegen gerade auf dem Display (für alles, was nicht unter dem Finger neu aufbauen darf)
var touchDown = 0, lastTouchEnd = 0, lastScrollAt = 0;
function scrollBusy() { return touchDown || Date.now() - lastScrollAt < 250; }   // Finger liegt, oder die Ansicht läuft noch aus
// Neuzeichnen von außen (Anmeldung, Sync): erst wenn nichts scrollt, sonst reißt es das Raster unter dem Finger weg
function safeRender() {
  if (scrollBusy() || swipe || pinch) { setTimeout(safeRender, 200); return; }
  render();
}
["touchstart", "touchend", "touchcancel"].forEach((n) => document.addEventListener(n, (e) => {
  touchDown = e.touches.length;
  if (n !== "touchstart") lastTouchEnd = Date.now();
}, { passive: true, capture: true }));
function swipeRestPx() {
  if (!swipePage) return 0;
  const tr = document.querySelector(".plan-screen .plan-track");
  return tr ? -swipePage * tr.offsetWidth : 0;
}
function applyPendingSwipe() {
  if (!swipePage) return;
  if (ui.view === "day") ui.dayDate = iso(addDays(parseIso(ui.dayDate), swipePage));
  else ui.weekOffset += swipePage;
  swipePage = 0;
  clearTimeout(swipeFlushTimer);
}
function scheduleSwipeFlush() {
  clearTimeout(swipeFlushTimer);
  swipeFlushTimer = setTimeout(function flush() {
    if (!swipePage) return;
    // Nie unter einem Finger neu aufbauen
    if (scrollBusy() || swipe || pinch) { swipeFlushTimer = setTimeout(flush, 200); return; }
    render();
  }, 380);
}
// Wie weit man wischen muss, um die Woche/den Tag zu wechseln (Anteil der Breite). Kurzer, schneller Wisch zählt schon ab SWIPE_FLICK.
const SWIPE_FRAC = 0.14, SWIPE_FLICK = 0.05;
let swipeAnim = 0;   // Nummer der laufenden Auslauf-Animation; ein neuer Finger macht ältere Aufräum-Timer ungültig
function resetSwipeTrack(app) {
  document.body.classList.remove("swiping");
  const rest = swipeRestPx();
  document.querySelectorAll(".plan-screen .plan-group").forEach((g) => { g.style.transition = ""; g.style.transform = rest ? `translateX(${rest}px)` : ""; });
  if (!app) return;
  app.style.transition = "";
  app.style.transform = "";
  app.style.position = "";
  app.querySelectorAll(".plan-fab").forEach((f) => { f.style.transition = ""; f.style.transform = ""; });
}
function abortSwipe() {
  if (!swipe) return;
  resetSwipeTrack(document.getElementById("app"));
  swipe = null;
}
// Wischen: die vorgeladenen Gruppen werden verschoben, Zeitachse und Kopf bleiben stehen
// Wischen beginnen, an der Stelle, an der der Finger gerade liegt
function startSwipe(t, target) {
  if (swipe) abortSwipe();
  if (ui.tab !== "stundenplan" || ui.layEdit || ui.planEdit || document.querySelector(".modal")) { swipe = null; return; }
  if (!target || !target.closest || !target.closest(".plan-screen")) { swipe = null; return; }
  const track = document.querySelector(".plan-screen .plan-track");
  const groups = [...document.querySelectorAll(".plan-screen .plan-group")];
  if (!track || !groups.length) { swipe = null; return; }
  // „swiping“ erst bei echter Wischgeste setzen: sonst bekommt jeder senkrechte Scroll schon den Zustand, der Sprünge auslöst
  swipeAnim++;
  let base = 0;
  try { base = new DOMMatrix(getComputedStyle(groups[0]).transform).m41 || 0; } catch (_) {}
  swipe = { x: t.clientX, y: t.clientY, t: Date.now(), dx: 0, mode: null, dir: 0, track, groups, base };
}
document.addEventListener("touchstart", (e) => {
  if (e.touches.length !== 1) { abortSwipe(); return; }
  startSwipe(e.touches[0], e.target);
}, { passive: true });
document.addEventListener("touchmove", (e) => {
  if (!swipe) return;
  if (e.touches.length !== 1) { abortSwipe(); return; }
  if (swipe.mode === "h" && e.cancelable) e.preventDefault();   // Browser-Zoom/Scrollen beim Wischen verhindern
  const t = e.touches[0];
  const dx = t.clientX - swipe.x;
  const dy = t.clientY - swipe.y;
  if (!swipe.mode) {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    if (Math.abs(dx) < 1.3 * Math.abs(dy)) { abortSwipe(); return; }   // senkrecht: normal scrollen
    swipe.mode = "h";
    document.body.classList.add("swiping");
  }
  swipe.dx = dx;
  // Verschieben nur einmal pro Bildwiederholung (ruhiger Lauf)
  if (!swipe.raf) swipe.raf = requestAnimationFrame(() => {
    if (!swipe) return;
    swipe.raf = 0;
    swipe.groups.forEach((g) => { g.style.transition = "none"; g.style.transform = `translateX(${swipe.base + swipe.dx}px)`; });
  });
}, { passive: false });
document.addEventListener("touchend", () => {
  const sw = swipe;
  swipe = null;
  if (!sw) return;
  if (sw.raf) cancelAnimationFrame(sw.raf);
  const app = document.getElementById("app");
  if (!sw.mode || longFired) { resetSwipeTrack(app); return; }
  const W = sw.track.offsetWidth;
  const rel = sw.base + sw.dx + swipePage * W;         // Abstand von der aktuellen Ruheseite
  const quick = Date.now() - sw.t < 300 && Math.abs(sw.dx) > W * SWIPE_FLICK;
  const commit = Math.abs(rel) > W * SWIPE_FRAC || quick;
  const dir = (quick ? sw.dx : rel) < 0 ? 1 : -1;      // nach links = nächste Woche/Tag
  if (commit) swipePage = Math.max(-PRELOAD, Math.min(PRELOAD, swipePage + dir));
  const ease = "transform .32s cubic-bezier(.2,.8,.2,1)";
  sw.groups.forEach((g) => { g.style.transition = ease; g.style.transform = `translateX(${-swipePage * W}px)`; });
  document.body.classList.remove("swiping");
  const id = ++swipeAnim;
  if (swipePage) scheduleSwipeFlush();
  else setTimeout(() => { if (id === swipeAnim) resetSwipeTrack(document.getElementById("app")); }, 340);
}, { passive: true });
document.addEventListener("touchcancel", () => abortSwipe(), { passive: true });

// Gummiband (überall, wo etwas scrollt): am oberen/unteren Ende gibt der Inhalt beim Weiterziehen kurz nach
// und federt zurück; auch wenn ein schneller Wisch (Schwung) am Ende anstößt. Nur optisch, die Scrollposition bleibt unberührt.
// Stundenplan: das Raster (.plan-rows) bewegt sich, Wochentage und Aufgaben bleiben stehen. Andere Reiter: die ganze Seite (#app).
const BAND_MAX = 48;
let band = null;
const bandShow = (raw) => (raw < 0 ? -1 : 1) * BAND_MAX * (1 - Math.exp(-Math.abs(raw) / 70));
function bandContext(target) {
  if (!target || !target.closest || ui.layEdit || ui.planEdit || document.querySelector(".modal")) return null;
  const wk = target.closest(".plan-screen > .week");
  if (wk) { const rows = wk.querySelector(".plan-rows"); return rows ? { sc: wk, el: rows } : null; }
  if (ui.tab === "stundenplan") return null;
  const app = document.getElementById("app");
  if (!app || !app.contains(target)) return null;
  // Liegt der Finger in einem eigenen scrollbaren Feld (Liste, Textfeld), bewegt sich die Seite nicht
  for (let n = target; n && n !== app; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 1) return null;
  }
  return { sc: document.scrollingElement || document.documentElement, el: app };
}
const bandAtTop = (sc) => sc.scrollTop <= 2;
const bandAtBottom = (sc) => sc.scrollTop >= sc.scrollHeight - sc.clientHeight - 2;
function bandRelease() {
  const b = band;
  band = null;
  if (!b || !b.raw || !b.el) return;
  const el = b.el;
  el.style.transition = "transform .6s cubic-bezier(.22,.7,.28,1)";
  el.style.transform = "";
  setTimeout(() => { el.style.transition = ""; }, 620);
}
document.addEventListener("touchstart", (e) => {
  if (band) bandRelease();
  if (e.touches.length !== 1) return;
  const ctx = bandContext(e.target);
  if (!ctx) return;
  const run = bounceAnim.get(ctx.el);
  if (run) { run.cancel(); bounceAnim.delete(ctx.el); }
  ctx.el.style.transition = "none";
  band = { sc: ctx.sc, el: ctx.el, last: e.touches[0].clientY, raw: 0 };
}, { passive: true });
document.addEventListener("touchmove", (e) => {
  if (!band) return;
  if (e.touches.length !== 1 || (swipe && swipe.mode === "h") || pinch) { band.el.style.transform = ""; band = null; return; }
  const y = e.touches[0].clientY;
  const d = y - band.last;
  band.last = y;
  if (band.raw === 0) {
    // erst ab dem Rand: nach unten ziehen am Anfang, nach oben ziehen am Ende
    if (!((bandAtTop(band.sc) && d > 0) || (bandAtBottom(band.sc) && d < 0))) return;
  }
  const next = band.raw + d;
  band.raw = (band.raw !== 0 && Math.sign(next) !== Math.sign(band.raw)) ? 0 : next;
  band.el.style.transform = band.raw ? `translateY(${bandShow(band.raw)}px)` : "";
}, { passive: true });
document.addEventListener("touchend", () => bandRelease(), { passive: true });
document.addEventListener("touchcancel", () => bandRelease(), { passive: true });

// Schwung: stößt ein schneller Wisch am Ende an (Finger ist schon oben), gibt der Inhalt weich nach und kommt langsam zurück.
// Stärke und Dauer hängen von der Geschwindigkeit ab. Stößt man währenddessen am anderen Ende an, geht es von der aktuellen Stelle aus weiter.
const flingLast = new WeakMap();
const bounceAnim = new WeakMap();
document.addEventListener("scroll", (e) => {
  lastScrollAt = Date.now();
  if (touchDown) { return; }
  const t = e.target;
  const sc = t === document ? (document.scrollingElement || document.documentElement) : t;
  if (!sc || sc.scrollTop === undefined) return;
  const now = performance.now();
  const prev = flingLast.get(sc);
  const top = sc.scrollTop;
  flingLast.set(sc, { top, t: now });
  if (!prev) return;
  const dt = now - prev.t;
  if (dt < 1 || dt > 120) return;
  const v = (top - prev.top) / dt;            // px pro ms, negativ = nach oben
  const hitTop = v < -0.15 && bandAtTop(sc);
  const hitBottom = v > 0.15 && bandAtBottom(sc);
  if (!hitTop && !hitBottom) return;
  const ctx = bandContext(t === document ? document.getElementById("app") : t);
  if (!ctx || ctx.sc !== sc || !ctx.el.animate) return;
  const el = ctx.el;
  const speed = Math.abs(v);
  const peak = Math.min(36, 4 + speed * 9) * (hitTop ? 1 : -1);      // langsam: kaum zu sehen, schnell: bis ca. 36 px
  const dur = Math.round(Math.min(1100, 600 + Math.abs(peak) * 10));  // 600–1000 ms
  // Läuft noch eine Animation: von der aktuellen Stelle weitermachen statt neu bei 0
  let y0 = 0;
  const run = bounceAnim.get(el);
  if (run) {
    try { y0 = new DOMMatrix(getComputedStyle(el).transform).m42 || 0; } catch (_) {}
    run.cancel();
  }
  const anim = el.animate(
    [
      { transform: `translateY(${y0}px)`, easing: "cubic-bezier(.2,.6,.3,1)" },
      { transform: `translateY(${peak}px)`, offset: 0.34, easing: "cubic-bezier(.4,0,.2,1)" },
      { transform: `translateY(${-peak * 0.08}px)`, offset: 0.74, easing: "cubic-bezier(.4,0,.2,1)" },
      { transform: "translateY(0)" },
    ],
    { duration: dur }
  );
  bounceAnim.set(el, anim);
  anim.onfinish = anim.oncancel = () => { if (bounceAnim.get(el) === anim) bounceAnim.delete(el); };
}, { capture: true, passive: true });

// Streckung in Y-Richtung: zwei Finger auf dem Stundenplan (am PC: Strg + Mausrad)
let pinch = null;
const zoomScope = (el) => (el.closest(".excerpt") ? "dash" : "plan");
const getZoom = (scope) => (scope === "dash" ? state.settings.dash.zoomY : state.settings.zoomY) || 1;
// Stundenplan: nicht kleiner als 100 %, sonst bleibt unten Platz frei. Dashboard wie bisher bis 50 %.
const zoomMin = (scope) => (scope === "dash" ? 0.5 : 1);
function setZoom(scope, z) {
  const v = Math.round(Math.min(2, Math.max(zoomMin(scope), z)) * 100) / 100;
  if (scope === "dash") state.settings.dash.zoomY = v; else state.settings.zoomY = v;
}
// Stundenplan live: beim Zwei-Finger-Zoom ändern sich nur die Variablen (--hour-px, --ppm).
// Das DOM wird dabei NICHT neu aufgebaut: sonst verliert der Browser das Element unter den Fingern
// und Wischen sowie Zoomen hängen sich auf. Oben bleibt das Raster stehen, nach unten wächst es.
function livePlanZoom(z) {
  const wk = document.querySelector(".plan-screen > .week");
  if (!wk) return;
  state.settings.zoomY = z;
  HOUR_PX = planHourPx(z);
  PX_PER_MIN = HOUR_PX / 60;
  const st = document.documentElement.style;
  st.setProperty("--hour-px", HOUR_PX + "px");
  st.setProperty("--ppm", String(PX_PER_MIN));
  wk.scrollTop = Math.min(wk.scrollTop, Math.max(0, wk.scrollHeight - wk.clientHeight));
}
function livePinchFrame() {
  if (!pinch) return;
  pinch.raf = 0;
  if (pinch.zShown === pinch.zNow) return;
  pinch.zShown = pinch.zNow;
  livePlanZoom(pinch.zNow);
}
document.addEventListener("touchstart", (e) => {
  if (e.touches.length !== 2) return;
  // Eine noch laufende Wisch-Geste beenden, sonst bleibt das Raster beim Scrollen hängen
  abortSwipe();
  document.body.classList.remove("swiping");
  const el = e.target.closest(".week, .excerpt");
  if (!el || el.classList.contains("excerpt")) { pinch = null; return; }
  const scope = zoomScope(el);
  const [a, b] = e.touches;
  const z0 = getZoom(scope);
  pinch = {
    el, scope, d0: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z0,
    zNow: z0, zShown: z0, midY: (a.clientY + b.clientY) / 2, moved: false, raf: 0,
  };
}, { passive: true });
document.addEventListener("touchmove", (e) => {
  if (!pinch || e.touches.length !== 2) return;
  e.preventDefault();
  const [a, b] = e.touches;
  const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  const z = Math.round(Math.min(2, Math.max(zoomMin(pinch.scope), pinch.z0 * d / pinch.d0)) * 100) / 100;
  pinch.zNow = z;
  pinch.midY = (a.clientY + b.clientY) / 2;
  pinch.moved = true;
  if (pinch.scope === "plan") {
    if (!pinch.raf) pinch.raf = requestAnimationFrame(livePinchFrame);
  } else {
    pinch.el.style.transformOrigin = "0 0";
    pinch.el.style.transform = `scaleY(${z / pinch.z0})`;
  }
}, { passive: false });
// Zoomwert merken; gespeichert (und neu gezeichnet) wird erst, wenn alle Finger weg sind
let pinchSavePending = false;
function finishPinch() {
  if (!pinch) return false;
  if (pinch.raf) cancelAnimationFrame(pinch.raf);
  if (pinch.moved) { setZoom(pinch.scope, pinch.zNow); pinchSavePending = true; }
  pinch = null;
  return true;
}
document.addEventListener("touchend", (e) => {
  const wasPinch = finishPinch();
  // Bleibt ein Finger liegen, startet das Wischen sofort (ohne Neuzeichnen, sonst ginge sein Ziel verloren)
  if (wasPinch && e.touches.length === 1) {
    const t = e.touches[0];
    startSwipe(t, document.elementFromPoint(t.clientX, t.clientY));
  }
  if (pinchSavePending && e.touches.length === 0) { pinchSavePending = false; commit(); }
}, { passive: true });
document.addEventListener("touchcancel", (e) => {
  finishPinch();
  if (pinchSavePending && e.touches.length === 0) { pinchSavePending = false; commit(); }
}, { passive: true });
document.addEventListener("wheel", (e) => {
  if (!e.ctrlKey) return;
  const el = e.target.closest(".week, .excerpt");
  if (!el || el.classList.contains("excerpt")) return;
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

// Profil-Fenster oben rechts: Konto, Sync-Status und Schnellzugriffe
function openProfileSheet() {
  const email = session && session.user ? session.user.email : "";
  const sync = (document.querySelector(".syncStatus") || {}).textContent || "";
  // Eigene Linien-Symbole statt Zeichen: die Zeichen (z. B. ⎋) zeigen manche Handys nur als leeres Kästchen
  const ico = (d) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I = {
    gear: ico('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'),
    undo: ico('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
    redo: ico('<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'),
    layout: ico('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
    logout: ico('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>'),
  };
  openModal(`<div class="prof-head">
      <div class="prof-av">${esc(email ? email.charAt(0).toUpperCase() : "S")}</div>
      <div><b>${email ? esc(email) : "Nur auf diesem Gerät"}</b><div class="muted">${esc(sync || (email ? "Synchronisiert" : "Lokal gespeichert"))}</div></div>
    </div>
    <div class="prof-list">
      <button class="prof-row" data-act="profgo" data-v="einstellungen"><span>${I.gear}</span>Einstellungen</button>
      <button class="prof-row" data-act="profgo" data-v="undo"><span>${I.undo}</span>Rückgängig</button>
      <button class="prof-row" data-act="profgo" data-v="redo"><span>${I.redo}</span>Wiederholen</button>
      <button class="prof-row" data-act="profgo" data-v="layout"><span>${I.layout}</span>Layout bearbeiten</button>
      ${email ? `<button class="prof-row prof-out" data-act="profgo" data-v="logout"><span>${I.logout}</span>Abmelden</button>` : ""}
    </div>`);
}

// Gleitende Markierung unter dem aktiven Reiter (untere Leiste)
function placeTabPill() {
  const pill = document.querySelector(".tab-pill");
  const act = document.querySelector(".tabbar button.active");
  if (!pill || !act) return;
  pill.style.width = act.offsetWidth + "px";
  pill.style.transform = `translateX(${act.offsetLeft}px)`;
}
window.addEventListener("resize", placeTabPill);

// Wischen über die untere Leiste: Finger bleibt drauf und zieht seitlich, die Seite zeigt den Reiter unter dem Finger.
// Bleibt der Finger still, öffnet sich wie bisher das Schnellmenü (siehe oben).
let tabScrub = null;
function tabUnderX(x) {
  const btns = [...document.querySelectorAll(".tabbar button[data-tab]")];
  let best = null, dist = Infinity;
  for (const b of btns) {
    const r = b.getBoundingClientRect();
    if (x >= r.left && x <= r.right) return b;
    const d = Math.min(Math.abs(x - r.left), Math.abs(x - r.right));
    if (d < dist) { dist = d; best = b; }
  }
  return best;
}
document.addEventListener("pointerdown", (e) => {
  if (e.button > 0 || !(e.target.closest && e.target.closest(".tabbar"))) return;
  tabScrub = { id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false };
}, true);
document.addEventListener("pointermove", (e) => {
  if (!tabScrub || e.pointerId !== tabScrub.id) return;
  const dx = e.clientX - tabScrub.x0, dy = e.clientY - tabScrub.y0;
  if (!tabScrub.on) {
    if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;   // noch kein seitliches Wischen
    tabScrub.on = true;
    clearTimeout(tabPressTimer);     // Gedrückthalten zählt nicht mehr: es ist ein Wischen
    document.body.classList.add("tab-scrub");
  }
  const btn = tabUnderX(e.clientX);
  if (btn && btn.dataset.tab !== ui.tab) {
    ui.tab = btn.dataset.tab;
    ui.modOpen = null;
    ui.topicOpen = null;
    buzz(4);
    render();
  }
}, true);
function endTabScrub(e) {
  if (!tabScrub || (e && e.pointerId !== tabScrub.id)) return;
  const wasOn = tabScrub.on;
  tabScrub = null;
  if (!wasOn) return;
  document.body.classList.remove("tab-scrub");
  tabPressFired = true;              // der Klick nach dem Loslassen darf nicht noch einmal umschalten
  setTimeout(() => { tabPressFired = false; }, 300);
  window.scrollTo(0, 0);
  // Nach dem Wischen einmal sanft einblenden, damit der neue Reiter nicht einfach „da“ ist
  const appEl = document.getElementById("app");
  if (appEl) { appEl.classList.remove("dir-fwd", "dir-back"); void appEl.offsetWidth; appEl.classList.add("tab-in", "dir-fwd"); clearTimeout(appEl._tabIn); appEl._tabIn = setTimeout(() => appEl.classList.remove("tab-in", "dir-fwd", "dir-back"), 1000); }
}
document.addEventListener("pointerup", endTabScrub, true);
document.addEventListener("pointercancel", endTabScrub, true);

// ---------- Schnellmenü am Reiter und globale Suche ----------
let tabPressTimer = null;
let tabPressFired = false;
document.addEventListener("pointerdown", (e) => {
  tabPressFired = false;
  const btn = e.target.closest(".tabbar button[data-tab]");
  clearTimeout(tabPressTimer);
  if (!btn || e.button > 0) return;
  tabPressTimer = setTimeout(() => {
    tabPressFired = true;
    buzz(12);
    openQuickSheet();
  }, 500);
}, true);
["pointerup", "pointercancel", "pointerleave"].forEach((ev) =>
  document.addEventListener(ev, () => clearTimeout(tabPressTimer), true));

function openQuickSheet() {
  openModal(`<h3>Schnell</h3>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn" data-act="qa" data-v="event">+ Neuer Termin</button>
      <button class="btn" data-act="qa" data-v="todo">+ Neuer Eintrag (To-Do, Abgabe, Klausur)</button>
      <button class="btn" data-act="qa" data-v="reminder">⏰ Schnell-Erinnerung (z. B. „Fr 7:30 Zirkel mitnehmen“)</button>
      <button class="btn ghost" data-act="qa" data-v="search">🔍 Suchen</button>
    </div>`);
}

// Schnell-Erinnerung: Text antippen, Tage oder Datum wählen, Uhrzeit wählen
function openQuickReminder() {
  // Vorgabe: heute, außer die Uhrzeit (07:30) ist schon vorbei, dann morgen
  const soon = new Date(); if (soon.getHours() * 60 + soon.getMinutes() >= 450) soon.setDate(soon.getDate() + 1);
  const today = iso(soon);
  openModal(`<h3>Schnell-Erinnerung</h3>
    <form data-form="qkrem">
      <label class="muted">Was?</label>
      <input name="title" required autocomplete="off" placeholder="z. B. Zirkel mitnehmen" style="width:100%">
      <label class="muted" style="display:block;margin:12px 0 6px">Wie oft?</label>
      <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px">
        <button type="button" class="btn" data-act="qkkind" data-v="once">Einmal</button>
        <button type="button" class="btn ghost" data-act="qkkind" data-v="weekly">Jede Woche</button>
      </div>
      <input type="hidden" name="kind" value="once">
      <div data-qk="once">
        <label class="muted" style="display:block;margin:8px 0 6px">Datum</label>
        <input type="date" name="date" value="${today}" style="width:auto">
      </div>
      <div data-qk="weekly" hidden>
        <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px">
          <button type="button" class="btn ghost" data-act="qkday" data-v="mf">Mo–Fr</button>
          <button type="button" class="btn ghost" data-act="qkday" data-v="all">Jeden Tag</button>
          <button type="button" class="btn ghost" data-act="qkday" data-v="none">Keine</button>
        </div>
        <div class="row" style="gap:10px;flex-wrap:wrap;margin-bottom:8px">
          ${DAY_ORDER.map((d) => `<label class="row" style="gap:4px"><input type="checkbox" name="d" value="${d}"> ${WD_SHORT[d]}</label>`).join("")}
        </div>
      </div>
      <label class="muted" style="display:block;margin:12px 0 6px">Uhrzeit</label>
      <input type="time" name="time" required value="07:30" style="width:auto">
      <p class="qkerr" style="color:#ef4444;margin:8px 0 0;min-height:1em;font-size:14px"></p>
      <div class="sheet-actions">
        <span></span>
        <div class="right">
          <button type="button" class="btn ghost" data-act="mclose">Abbrechen</button>
          <button class="btn">Speichern</button>
        </div>
      </div>
    </form>`);
}
// Einmal oder jede Woche umschalten
function quickKind(f, v) {
  f.querySelector('[name="kind"]').value = v;
  f.querySelectorAll("[data-qk]").forEach((x) => { x.hidden = x.dataset.qk !== v; });
  f.querySelectorAll('[data-act="qkkind"]').forEach((b) => { b.className = b.dataset.v === v ? "btn" : "btn ghost"; });
}
// Schnellauswahl der Tage im Schnell-Fenster
function quickDays(f, v) {
  const set = v === "mf" ? [1, 2, 3, 4, 5] : v === "all" ? [0, 1, 2, 3, 4, 5, 6] : [];
  f.querySelectorAll('input[name="d"]').forEach((x) => { x.checked = set.includes(Number(x.value)); });
}

function openSearch() {
  openModal(`<h3>Suchen</h3>
    <input type="search" data-qsearch="1" placeholder="Termine, To-Dos, Module, Einstellungen …" style="width:100%;margin-bottom:10px">
    <div id="qsRes"><p class="muted">Tippe einen Begriff ein.</p></div>`);
  setTimeout(() => { const i = document.querySelector('[data-qsearch]'); if (i) i.focus(); }, 0);
}

function searchResultsHTML(q) {
  q = (q || "").trim().toLowerCase();
  if (!q) return `<p class="muted">Tippe einen Begriff ein.</p>`;
  const hit = (s) => (s || "").toLowerCase().includes(q);
  const out = [];
  Object.keys(state.modules).filter((n) => hit(n)).forEach((n) => out.push(
    `<button class="listbtn" data-act="qaopen" data-k="mod" data-id="${enc(n)}"><b>${esc(n)}</b><span class="muted">Protokoll</span></button>`));
  state.todos.filter((t) => hit(t.title) || hit(t.desc)).forEach((t) => out.push(
    `<button class="listbtn" data-act="qaopen" data-k="todo" data-id="${t.id}"><b>${esc(t.title)}</b><span class="muted">${t.date ? fmtD(parseIso(t.date)) : "ohne Datum"}</span></button>`));
  state.events.filter((e) => hit(e.name) || hit(e.room)).forEach((e) => out.push(
    `<button class="listbtn" data-act="qaopen" data-k="ev" data-id="${e.id}"><b>${esc(e.name)}</b><span class="muted">${fmtD(parseIso(e.date))} ${fmtMin(e.start)}</span></button>`));
  SETTINGS_LIST.filter((x) => hit(x.t) || hit(x.w)).forEach((x) => out.push(
    `<button class="listbtn" data-act="qaopen" data-k="set" data-id="${x.k}"><b>${esc(x.t)}</b><span class="muted">Einstellungen</span></button>`));
  return out.slice(0, 40).join("") || `<p class="muted">Nichts gefunden.</p>`;
}

// ---------- Klicks, Eingaben, Formulare ----------
// Erneutes Tippen auf den aktiven Reiter (jeder Reiter hat seine eigene Abfolge)
function activeTabTap(key) {
  if (key === "dashboard") return dashNextCard();
  if (key === "stundenplan") return planActiveTap();
  if (key === "kalender") return calActiveTap();
  if (key === "einstellungen") { ui.setPage = null; ui.nfOnly = null; ui.setQuery = ""; render(); window.scrollTo(0, 0); return; }
  window.scrollTo(0, 0);
}
// Dashboard: zur nächsten Karte springen, nach der letzten wieder ganz nach oben
function dashNextCard() {
  const y = window.scrollY + 70;
  const cards = [...document.querySelectorAll(".card")].filter((c) => c.offsetParent && !(c.parentElement && c.parentElement.closest(".card")));
  const next = cards.find((c) => c.getBoundingClientRect().top + window.scrollY > y + 8);
  if (next) window.scrollTo({ top: next.getBoundingClientRect().top + window.scrollY - 64, behavior: "smooth" });
  else window.scrollTo({ top: 0, behavior: "smooth" });
}
// Stundenplan: aktuelle Woche → heute → Wochenansicht
function planActiveTap() {
  const todayK = iso(new Date());
  if (ui.view === "day") {
    if (ui.dayDate !== todayK) { ui.dayDate = todayK; ui.anim = "zoom"; render(); }
    else toWeekView();
    return;
  }
  if (ui.weekOffset) { ui.weekOffset = 0; ui.anim = "zoom"; render(); return; }
  ui.view = "day"; ui.dayDate = todayK; ui.anim = "zoom"; render();
}
// Kalender: heutiger Tag → Filter und Suche zurücksetzen → nach oben
function calActiveTap() {
  const now = new Date();
  const todayK = iso(now);
  const curMonth = ui.month && ui.month.getFullYear() === now.getFullYear() && ui.month.getMonth() === now.getMonth();
  if (!curMonth || ui.selDate !== todayK) { ui.month = new Date(now.getFullYear(), now.getMonth(), 1); ui.selDate = todayK; render(); return; }
  if (ui.calSearch || ui.calFrom || ui.calTo || ui.calType || ui.calMod || ui.calFilterOpen) {
    ui.calSearch = ""; ui.calFrom = ""; ui.calTo = ""; ui.calType = ""; ui.calMod = ""; ui.calFilterOpen = false; render(); return;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("click", async (e) => {
  if (longFired) { longFired = false; e.preventDefault(); e.stopPropagation(); return; }
  if (tabPressFired) { tabPressFired = false; e.preventDefault(); e.stopPropagation(); return; }
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
    if (key === ui.tab) { activeTabTap(key); return; }
    ui.tab = key;
    ui.modOpen = null;
    ui.topicOpen = null;
    // Zurück-Taste: springt vom Reiter aus zurück zum Startbildschirm
    render();
    window.scrollTo(0, 0);
    return;
  }
  const el = e.target.closest("[data-act]");
  // Bearbeiten nur per Doppeltippen: To-Dos, Abgaben, Klausuren (✎-Button bleibt direkt)
  const editRow = e.target.closest(".listrow[data-drag]");
  const editId = el && el.dataset.act === "tedit" && !el.classList.contains("btn") ? el.dataset.id
    : (editRow && !e.target.closest("button, input, select, textarea, label") ? editRow.dataset.drag : null);
  if (editId && e.target.closest("#modalRoot")) { hapt(8); openTodoModal(editId); return; }  // im Tagesfenster: ein Tipp
  // Stundenplan: ein kurzer Tipp öffnet die Aktionen (bearbeiten, abhaken, löschen)
  if (editId && (ui.tab === "stundenplan" || ui.tab === "dashboard")) { hapt(8); openTodoActions(editId); return; }
  if (editId) {
    const now = Date.now();
    const dbl = lastEditTap.id === editId && now - lastEditTap.t < 450;
    lastEditTap = dbl ? { id: null, t: 0 } : { id: editId, t: now };
    if (dbl) { hapt(10); openTodoModal(editId); }
    return;
  }
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
    case "profile": openProfileSheet(); break;
    case "profgo": {
      const v = el.dataset.v;
      closeModal();
      if (v === "einstellungen") { ui.tab = "einstellungen"; ui.setPage = null; ui.nfOnly = null; render(); window.scrollTo(0, 0); }
      else if (v === "layout") { ui.layEdit = true; render(); }
      else if (v === "undo") undo();
      else if (v === "redo") redo();
      else if (v === "logout") { if (await appConfirm("Wirklich abmelden? Deine Daten bleiben in der Cloud und sind nach dem Anmelden wieder da.", "Abmelden")) cloudSignOut(); }
      break;
    }
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
    case "dayopen": ui.view = "day"; ui.dayDate = el.dataset.d; ui.anim = "zoom"; render(); break;
    case "toweek": toWeekView(); break;
    case "dprev": navigate(-1); break;
    case "dnext": navigate(1); break;
    case "planmenu": openPlanMenu(); break;
    case "mensafilter": ui.mensaNoMeat = !ui.mensaNoMeat; render(); break;
    case "planedit": clearModalQuiet(); ui.planEdit = true; render(); break;
    case "planeditdone": ui.planEdit = false; render(); break;
    case "evdrop": {
      const ev = state.events.find((x) => x.id === id);
      if (!ev) break;
      const start = Number(el.dataset.min), dur = ev.end - ev.start, date = el.dataset.d;
      if (el.dataset.mode === "copy") state.events.push({ ...ev, id: uid(), date, start, end: start + dur });
      else Object.assign(ev, { date, start, end: start + dur });
      ui.selDate = date;
      clearModalQuiet();
      commit(); break;
    }
    case "markadd":
      state.settings.planMarks = [...(state.settings.planMarks || []), { id: uid(), time: "12:00", end: "", label: "" }];
      commit(); openPlanMenu(); break;
    case "markdel":
      state.settings.planMarks = (state.settings.planMarks || []).filter((mk) => mk.id !== el.dataset.id);
      commit(); openPlanMenu(); break;
    case "planreset":
      // Nur Hintergrund und Linie zurücksetzen; die Kategorie-Farben gelten überall und bleiben
      state.settings.plan = { ...state.settings.plan, grid: "", now: "" };
      commit(); openPlanMenu(); break;
    case "note": {
      const ev = state.events.find((x) => x.id === id);
      if (!ev) break;
      hapt(8);
      // Stundenplan: kurz tippen = Infos. Dashboard: Notiz-Popup.
      if (ui.tab === "stundenplan" || ui.tab === "dashboard") { openEventInfo(ev.id); break; }
      openNoteModal(ev.name, ev.date);
      break;
    }
    case "evnote": {
      const ev = state.events.find((x) => x.id === id);
      if (!ev) break;
      openNoteModal(ev.name, ev.date);
      break;
    }
    case "evopen": openEventEdit(id); break;
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
      showUndo("Termin gelöscht");
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
    case "calfold": {
      const c = calSet();
      const old = document.querySelector(".month");
      const h0 = old ? old.getBoundingClientRect().height : 0;
      state.settings.cal = { ...c, fold: !c.fold };
      ui.anim = "fold";
      commit();
      // Höhe sanft von alt nach neu übergehen lassen, statt zu springen
      const el = document.querySelector(".month");
      const h1 = el ? el.getBoundingClientRect().height : 0;
      if (el && h0 && Math.abs(h1 - h0) > 4 && el.animate) {
        el.animate([{ height: h0 + "px", overflow: "hidden" }, { height: h1 + "px", overflow: "hidden" }],
          { duration: 460, easing: "cubic-bezier(.32,.72,0,1)" });
      }
      break;
    }
    case "calweek": {
      const d = addDays(parseIso(ui.selDate || iso(new Date())), 7 * Number(el.dataset.v));
      ui.selDate = iso(d);
      ui.month = new Date(d.getFullYear(), d.getMonth(), 1);
      ui.anim = "week";
      render(); break;
    }
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
    case "kitodo": {
      // Freier Satz → KI erkennt Titel, Datum und Uhrzeit; vor dem Anlegen wird bestätigt
      const form = el.closest("form");
      const text = (form?.elements.title?.value || "").trim();
      if (!text) { showToast("Erst eine Aufgabe eintippen"); break; }
      if (!session) { showToast("Zum Nutzen bitte anmelden"); break; }
      showToast("KI liest den Text …", 2000);
      let res = null;
      try {
        const r = await fetch(SUPABASE_URL + "/functions/v1/ki-todo", {
          method: "POST",
          headers: { Authorization: "Bearer " + session.access_token, apikey: SUPABASE_ANON_KEY, "content-type": "application/json" },
          body: JSON.stringify({ text }),
          signal: AbortSignal.timeout(30000),
        });
        res = await r.json().catch(() => ({}));
        if (!r.ok && !res.fehler) res.fehler = "fehler";
      } catch (_) { res = { fehler: "netz" }; }
      if (res.fehler) {
        showToast(res.fehler === "kein-key" ? "Erst einen Gemini-Key im KI-Assistenten eintragen" : "KI gerade nicht erreichbar");
        break;
      }
      const datum = res.datum || form.elements.date?.value || (res.uhrzeit ? iso(new Date()) : "");
      const when = [datum ? parseIso(datum).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }) : "ohne Datum", res.uhrzeit ? "um " + res.uhrzeit + " Uhr" : ""].filter(Boolean).join(" ");
      if (!(await appConfirm(`Aufgabe anlegen?\n\n${res.titel}\n${when}`, "Anlegen"))) break;
      state.todos.push({ id: uid(), title: res.titel, type: "todo", priority: "mittel", date: datum, time: res.uhrzeit || "", duration: DEFAULT_DURATION, done: false });
      form.reset(); commit();
      showToast("✓ Aufgabe angelegt");
      break;
    }
    case "dtoday": ui.dayDate = iso(new Date()); ui.anim = null; render(); break;
    case "planview": planToggle(); break;
    case "mensanav": mensaStep(Number(el.dataset.v)); break;
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
      clearModalQuiet();
      render();
      break;
    case "tnew": openTodoModal(null, ui.selDate); break;
    case "tnewday": openTodoModal(null, el.dataset.d); break;
    case "exportdata": exportData(); break;
    case "pushon": enablePush(); break;
    case "pushoff": disablePush(); break;
    case "pushtest": pushTest(el.dataset.kind); break;
    case "setopen": ui.setPage = el.dataset.k; ui.nfOnly = null; render(); break;
    case "headset": state.settings.planHead = el.dataset.v; commit(); break;
    case "zoomstep": {
      const z = el.dataset.v === "reset" ? 1 : (state.settings.zoomY || 1) + Number(el.dataset.v);
      state.settings.zoomY = Math.round(Math.min(2, Math.max(zoomMin("plan"), z)) * 100) / 100;
      commit();
      break;
    }
    case "setback": ui.setPage = null; ui.nfOnly = null; render(); break;
    case "qkkind": { const f = el.closest("form"); if (f) quickKind(f, el.dataset.v); break; }
    case "qkday": { const f = el.closest("form"); if (f) quickDays(f, el.dataset.v); break; }
    case "looksel": state.settings.look = el.dataset.v; saveDevice(); render(); break;
    case "geminidel": if (await appConfirm("Gemini-Key wirklich entfernen?", "Entfernen")) deleteGeminiKey(); break;
    case "fontsel": state.settings.font = el.dataset.v; saveDevice(); applyFont(); render(); break;
    case "nfvib": state.settings.nfDev = { ...(state.settings.nfDev || {}), vib: el.dataset.v }; saveDevice(); render(); break;
    case "nfopen":
      ui.nfOnly = el.dataset.k;
      if (ui.nfOnly === "log") ui.nfLog = undefined;
      render();
      break;
    case "nfback": ui.nfOnly = null; render(); break;
    case "tedit": openTodoModal(id); break;
    case "todoedit": openTodoModal(id); break;
    case "todoopen": openTodoActions(id); break;
    case "evinfo": openEventInfo(id); break;
    case "todocal": {
      clearModalQuiet();
      ui.tab = "kalender";
      ui.selDate = el.dataset.d;
      ui.dayPop = el.dataset.d;
      render();
      break;
    }
    case "search": openSearch(); break;
    case "tdelm": {
      if (!(await appConfirm("Eintrag in den Papierkorb verschieben?"))) break;
      const t = state.todos.find((x) => x.id === id);
      if (t) trashAdd("todo", t);
      state.todos = state.todos.filter((x) => x.id !== id);
      showUndo("Aufgabe gelöscht");
      closeModal(); commit(); break;
    }
    case "subadd": {
      const tid = el.dataset.tid;
      const t = state.todos.find((x) => x.id === tid);
      const inp = document.querySelector(`[data-subinput="${tid}"]`);
      const title = inp ? inp.value.trim() : "";
      if (!t || !title) { if (inp) inp.focus(); break; }
      t.subs = [...(t.subs || []), { id: uid(), title, done: false }];
      commit(); refreshSubs(tid);
      const again = document.querySelector(`[data-subinput="${tid}"]`);
      if (again) again.focus();
      break;
    }
    case "subdone": {
      const t = state.todos.find((x) => x.id === el.dataset.tid);
      const s = t && (t.subs || []).find((x) => x.id === el.dataset.sid);
      if (!s) break;
      s.done = el.checked;
      commit(); refreshSubs(t.id); break;
    }
    case "subdel": {
      const t = state.todos.find((x) => x.id === el.dataset.tid);
      if (!t) break;
      t.subs = (t.subs || []).filter((x) => x.id !== el.dataset.sid);
      commit(); refreshSubs(t.id); break;
    }
    case "brkdel": {
      const b = (state.settings.breaks || []).find((x) => x.id === el.dataset.id);
      if (!b) break;
      if (!(await appConfirm(`„${b.name}“ entfernen?`, "Entfernen"))) break;
      state.settings.breaks = state.settings.breaks.filter((x) => x.id !== b.id);
      commit(); break;
    }
    case "tdone": {
      const t = state.todos.find((x) => x.id === id);
      if (!t) break;
      if (!canCheck(t)) { appAlert("Klausuren kannst du erst am Prüfungstag abhaken."); render(); break; }
      // Abgaben werden erst nach einer Bestätigung als erledigt markiert
      if (!t.done && t.type === "abgabe") {
        if (!(await appConfirm(`Abgabe „${t.title}“ als erledigt markieren?`, "Ja, erledigt"))) { render(); break; }
      }
      t.done = !t.done;
      t.doneAt = t.done ? iso(new Date()) : null;
      // Rückmeldung, sobald heute (und alles Überfällige) erledigt ist
      if (t.done) {
        const todayIso = iso(new Date());
        const leftOver = state.todos.some((x) => x.id !== t.id && !x.done && x.date && x.date <= todayIso);
        if (!leftOver) setTimeout(() => showToast("Alles für heute erledigt"), 400);
      }
      ui.popId = id;
      setTimeout(() => { ui.popId = null; }, 900);
      if (el.closest("#modalRoot")) closeModal();   // aus dem Aktionsfenster heraus: schließen
      commit(); break;
    }

    // Protokolle
    case "showhidden": ui.showHidden = !ui.showHidden; render(); break;
    case "mopen": ui.modOpen = m; ui.topicOpen = null; render(); break;
    case "ntopic": {
      const inp = document.querySelector('#modalRoot form[data-form="note"] input[name="topic"]');
      if (inp) { inp.value = dec(el.dataset.t); inp.dispatchEvent(new Event("input", { bubbles: true })); }
      break;
    }
    case "modgo": ui.tab = "protokolle"; ui.modOpen = state.modules[m] ? m : null; ui.topicOpen = null; render(); window.scrollTo(0, 0); break;
    case "mback": ui.modOpen = null; ui.topicOpen = null; render(); break;
    case "mmenu": openModuleMenu(m); break;
    case "mkind": openKindPicker(m); break;
    case "mexport": exportModuleText(m); break;
    case "mkindset": {
      const mod = state.modules[m];
      if (mod) mod.kind = el.dataset.v;
      clearModalQuiet();
      commit(); break;
    }
    case "mcolor": state.modules[ui.modOpen].color = el.dataset.c; commit(); break;
    case "mcolorm": state.modules[m].color = el.dataset.c; commit(); openModuleEdit(m); break;
    case "medit": openModuleEdit(m); break;
    case "cnnew": openCustomEdit(null); break;
    case "cnedit": openCustomEdit(id); break;
    case "cndel": {
      if (!(await appConfirm("Diese Erinnerung löschen?"))) break;
      const list = customList();
      const i = list.findIndex((x) => x.id === id);
      if (i >= 0) list.splice(i, 1);
      closeModal(); commit(); break;
    }
    case "qa": {
      const v = el.dataset.v;
      if (v === "search") { openSearch(); break; }
      if (v === "reminder") { openQuickReminder(); break; }
      const today = iso(new Date());
      const now = new Date();
      if (v === "todo") { openTodoModal(null, today); break; }
      const nm = now.getHours() * 60 + now.getMinutes();
      openEventCreate(today, Math.min(Math.ceil(nm / 30) * 30, END_MIN - 90));
      break;
    }
    case "qaopen": {
      const k = el.dataset.k;
      const key = dec(el.dataset.id);
      closeModal();
      if (k === "mod") { ui.tab = "protokolle"; ui.modOpen = key; ui.topicOpen = null; commit(); window.scrollTo(0, 0); }
      else if (k === "todo") openTodoModal(key);
      else if (k === "ev") openEventEdit(key);
      else if (k === "set") { ui.tab = "einstellungen"; ui.setPage = key; ui.nfOnly = null; commit(); }
      break;
    }
    case "planTasks": {
      // Nur umschalten, nicht neu aufbauen: so läuft die Leiste sanft auf und zu
      ui.planTasksOpen = ui.planTasksOpen !== true;
      const wrap = document.querySelector(".plan-top-wrap");
      const btn = document.querySelector(".plan-corner");
      if (wrap && btn) {
        wrap.classList.toggle("open", ui.planTasksOpen);
        btn.classList.toggle("on", ui.planTasksOpen);
        btn.querySelector("span").innerHTML = ui.planTasksOpen ? ICON.up : ICON.down;
      } else render();
      break;
    }
    case "planDense": ui.planDense = !ui.planDense; render(); break;
    case "mlnew": openModLinkEdit(m, null); break;
    case "mledit": openModLinkEdit(m, id); break;
    case "mldel": {
      if (!(await appConfirm("Diesen Link löschen?"))) break;
      const mod = state.modules[m];
      if (mod && mod.links) mod.links = mod.links.filter((x) => x.id !== id);
      closeModal(); commit(); break;
    }
    case "evrnew": openEvReminderEdit(id, null); break;
    case "evredit": openEvReminderEdit(id, el.dataset.rid); break;
    case "evrdel": {
      if (!(await appConfirm("Diese Erinnerung löschen?"))) break;
      const ev = state.events.find((x) => x.id === id);
      if (ev && ev.reminders) ev.reminders = ev.reminders.filter((x) => x.id !== el.dataset.rid);
      closeModal(); commit(); break;
    }
    case "mtrash": {
      if (!(await appConfirm(`Protokoll „${m}“ in den Papierkorb verschieben? Die Termine im Stundenplan bleiben.`))) break;
      const mod = state.modules[m];
      if (mod) trashAdd("module", { color: mod.color, topics: mod.topics, notes: mod.notes }, { name: m });
      delete state.modules[m];
      ui.modOpen = null;
      showUndo("Protokoll gelöscht");
      closeModal(); commit(); break;
    }
    case "topen": ui.topicOpen = id; render(); break;
    case "tback": ui.topicOpen = null; render(); break;
    case "tdoneTopic": {
      const t = topicOf(state.modules[m], id);
      if (t) t.done = !t.done;
      commit(); break;
    }
    case "ttitle": await renameTopicFlow(m, id); break;
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
      showUndo("Eintrag gelöscht");
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

    case "gotoprot": {
      ui.dayPop = null; ui.noteFor = null; ui.editNote = null; ui.noteWindow = false;
      ui.tab = "protokolle";
      ui.modOpen = m;
      ui.topicOpen = null;
      ui.modSearch = "";
      clearModalQuiet();
      render();
      window.scrollTo(0, 0);
      break;
    }

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
    case "cardnew": if (ui.tab === "dashboard") openCardModal(); break;
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
    case "impgo": applyPendingImport(); break;
    case "expgo": doExport(); break;
    case "syncnow": cloudPull(); break;
    case "logout": cloudSignOut(); break;
  }
});

// Beschriftung eines Reglers wird beim Ziehen sofort aktualisiert (nicht erst beim Öffnen neu)
function updateRangeLabel(t) {
  const v = t.value;
  let txt = null;
  if (t.dataset.change === "fontscale") txt = `Schriftgröße: ${v} % (nur auf diesem Gerät)`;
  else if (t.hasAttribute("data-dash-zoom") || t.hasAttribute("data-plan-zoom")) txt = `Höhe: ${v} %`;
  else if (t.dataset.calrange === "w") txt = `Breite des Kalenders: ${v} %`;
  else if (t.dataset.calrange === "h") txt = `Höhe der Tage: ${v} %`;
  const lab = t.previousElementSibling;
  if (txt && lab && lab.tagName === "LABEL") lab.textContent = txt;
}

document.addEventListener("input", (e) => {
  if (e.target.type === "range") updateRangeLabel(e.target);
  if (e.target.dataset && e.target.dataset.qsearch) { const r = document.getElementById("qsRes"); if (r) r.innerHTML = searchResultsHTML(e.target.value); return; }
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
  if (t.dataset.cnon) { const c = customList().find((x) => x.id === t.dataset.cnon); if (c) c.on = t.checked; commit(); return; }
  if (t.dataset.evrnon) { const [eid, rid] = t.dataset.evrnon.split("|"); const ev = state.events.find((x) => x.id === eid); const r = ev && (ev.reminders || []).find((x) => x.id === rid); if (r) r.on = t.checked; commit(); return; }
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
  if (t.dataset.change === "nfsound") {
    state.settings.nfDev = { ...(state.settings.nfDev || {}), sound: t.checked };
    saveDevice();
    return;
  }
  if (t.dataset.change === "fontscale") {
    state.settings.fontScale = Number(t.value);
    saveDevice();
    applyTheme();
    return;
  }
  if (t.dataset.change === "icontag") {
    await saveIcon(t.dataset.hash, t.value);
    return;
  }
  if (t.dataset.change === "dynslot") {
    const cur = DAY_SLOTS.map((_, j) => slotSetting(j));
    const i = Number(t.dataset.i);
    cur[i] = t.dataset.f === "dark" ? { ...cur[i], dark: t.value === "dark" } : { ...cur[i], preset: t.value };
    state.settings.daySlots = cur;
    commit();
    return;
  }
  if (t.dataset.change === "dynday") {
    state.settings.dynDay = t.checked;
    commit();
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
  if (t.hasAttribute && t.hasAttribute("data-plan-step")) {
    state.settings.planStep = Number(t.value);
    commit();
    return;
  }
  if (t.dataset.mark) {
    const mk = (state.settings.planMarks || []).find((x) => x.id === t.dataset.id);
    if (mk) mk[t.dataset.mark] = t.value;
    commit();
    return;
  }
  if (t.dataset.change === "planlines") {
    state.settings.planLines = t.checked;
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
  if (kind === "notify") { notifySet(t); return; }
  if (kind === "dark") { state.settings.dark = t.checked; commit(); }
  if (kind === "weekend") { state.settings.weekend = t.checked; commit(); }
  if (kind === "ics") {
    const file = t.files[0];
    if (!file) return;
    const events = parseICS(await file.text());
    if (!events.length) { appAlert("In dieser Datei wurden keine Termine gefunden."); return; }
    // Protokolle entstehen nicht mehr automatisch beim Import, nur wenn du eine Notiz oder ein Thema anlegst
    state.events = events;
    commit();
    appAlert(`${events.length} Termine wurden geladen.`);
  }
  if (kind === "import") {
    const file = t.files[0];
    if (!file) return;
    try {
      pendingImport = readBackup(JSON.parse(await file.text()));
      openImportChoice();
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

  if (f.dataset.form === "geminikey") {
    const key = (data.key || "").trim();
    if (!key) return;
    if (await saveGeminiKey(key)) {
      showToast("✓ Key gespeichert");
      await refreshKeyStatus();   // holt das Datum vom Server
      render();
    }
    return;
  }

  if (f.dataset.form === "appprompt") {
    const r = modalResolve;
    modalResolve = null;
    closeModal();
    if (r) r(new FormData(f).get("value").trim());
    return;
  }
  switch (f.dataset.form) {
    case "qkrem": {
      const err = f.querySelector(".qkerr");
      const fail = (t) => { if (err) err.textContent = t; };
      const title = (data.title || "").trim();
      if (!title) { fail("Bitte einen Text schreiben."); break; }
      if (data.kind === "once") {
        if (!data.date) { fail("Bitte ein Datum wählen."); break; }
        if (timeAlreadyPast(data.date, data.time)) { fail("Diese Uhrzeit ist heute schon vorbei. Wähle ein späteres Datum oder eine spätere Uhrzeit."); break; }
        pruneExpiredOnce();
        customList().push({ id: uid(), title, body: "", time: data.time, days: [], date: data.date, on: true });
        setTimeout(() => showToast(`Erinnerung gespeichert: ${fmtD(parseIso(data.date))} um ${data.time}`), 300);
      } else {
        const days = [...f.querySelectorAll('input[name="d"]:checked')].map((x) => Number(x.value));
        if (!days.length) { fail("Bitte mindestens einen Tag wählen."); break; }
        customList().push({ id: uid(), title, body: "", time: data.time, days, on: true });
        setTimeout(() => showToast(`Erinnerung gespeichert: ${daysLabel(days)} um ${data.time}`), 300);
      }
      closeModal(); commit(); break;
    }
    case "cnsave": {
      const list = customList();
      const old = f.dataset.id ? list.find((x) => x.id === f.dataset.id) : null;
      const base = { id: old ? old.id : uid(), title: (data.title || "").trim(), body: (data.body || "").trim(), time: data.time, on: old ? old.on : true };
      let item;
      if (data.kind === "once") {
        if (!data.date) { appAlert("Bitte ein Datum wählen."); break; }
        if (timeAlreadyPast(data.date, data.time)) { appAlert("Diese Uhrzeit ist heute schon vorbei. Wähle ein späteres Datum oder eine spätere Uhrzeit."); break; }
        item = { ...base, days: [], date: data.date };
      } else {
        const days = [...f.querySelectorAll('input[name="d"]:checked')].map((x) => Number(x.value));
        if (!days.length) { appAlert("Bitte mindestens einen Tag wählen."); break; }
        item = { ...base, days };
      }
      if (old) { delete old.date; Object.assign(old, item); } else list.push(item);
      pruneExpiredOnce();
      closeModal(); commit(); break;
    }
    case "modlink": {
      const name = dec(f.dataset.m);
      const m = state.modules[name];
      if (!m) break;
      if (!Array.isArray(m.links)) m.links = [];
      const url = (data.url || "").trim();
      if (!/^https?:\/\//i.test(url)) { appAlert("Der Link muss mit https:// beginnen."); break; }
      const old = f.dataset.id ? m.links.find((x) => x.id === f.dataset.id) : null;
      const item = { id: old ? old.id : uid(), title: (data.title || "").trim(), url };
      if (old) Object.assign(old, item); else m.links.push(item);
      closeModal(); commit(); break;
    }
    case "evrsave": {
      const ev = state.events.find((x) => x.id === f.dataset.id);
      if (!ev) break;
      if (!Array.isArray(ev.reminders)) ev.reminders = [];
      const old = f.dataset.rid ? ev.reminders.find((x) => x.id === f.dataset.rid) : null;
      const item = { id: old ? old.id : uid(), before: Math.max(0, Math.min(1440, Math.round(Number(data.before)) || 0)), title: (data.title || "").trim(), body: (data.body || "").trim(), repeat: ["once", "weekly", "even", "odd"].includes(data.repeat) ? data.repeat : "once", on: old ? old.on : true };
      if (old) Object.assign(old, item); else ev.reminders.push(item);
      closeModal(); commit(); break;
    }
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
      const title = (data.topic || "").trim();
      let topicId = "";
      // Beim Ändern einer Notiz: ist der neue Name nur ein Schreibfehler-Abstand zum bisherigen Thema, wird dieses umbenannt
      const editing = data.id ? mod.notes.find((x) => x.id === data.id) : null;
      const curTopic = editing && editing.topicId ? mod.topics.find((t) => t.id === editing.topicId) : null;
      if (title && curTopic && curTopic.title.toLowerCase() !== title.toLowerCase()
        && !mod.topics.some((t) => t.title.toLowerCase() === title.toLowerCase())
        && similarTitle(curTopic.title, title)) {
        curTopic.title = title;
        topicId = curTopic.id;
      } else if (title) {
        const hit = mod.topics.find((t) => t.title.toLowerCase() === title.toLowerCase());
        if (hit) topicId = hit.id;
        else { topicId = uid(); mod.topics.push({ id: topicId, title, done: false }); }
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
        if (f.dataset.draft) { try { localStorage.removeItem(f.dataset.draft); } catch (_) {} }
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
      // Nur diese Stunde fällt aus (gilt nicht für die anderen Termine der Vorlesung)
      ev.cancelled = !!data.cancelled;
      // Kürzel gilt für alle Termine dieser Vorlesung (wie der Titel)
      const short = (data.short || "").trim();
      const doz = (data.dozent || "").trim();
      state.events.forEach((x) => { if (x.name === nw) { x.short = short; x.dozent = doz; } });
      if (state.modules[nw] || data.protokoll) ensureModule(nw).color = data.color;
      closeModal(); commit(); break;
    }
    case "todo": {
      const entry = {
        title: data.title.trim(),
        type: data.type,
        priority: data.priority || "mittel",
        date: data.date || "",
        endDate: data.date && data.endDate && data.endDate > data.date ? data.endDate : "",
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
    case "break": {
      const name = (data.name || "").trim();
      const from = data.from || "";
      const to = data.to || from;
      if (!name || !from) break;
      if (to < from) { appAlert("Das Ende liegt vor dem Anfang. Bitte prüfe die Daten."); break; }
      state.settings.breaks = [...(state.settings.breaks || []), { id: uid(), name, from, to }]
        .sort((a, b) => a.from.localeCompare(b.from));
      f.reset(); commit(); break;
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

// ---------- Backup: Teile einzeln wählen ----------
// Design-Einstellungen; alle übrigen Einstellungen gehören zu „Einstellungen“
const DESIGN_KEYS = ["dark", "colors", "plan", "zoomY", "dash", "presets"];
let pendingImport = null;
const pickDesign = (s) => Object.fromEntries(DESIGN_KEYS.filter((k) => k in s).map((k) => [k, s[k]]));
const pickRest = (s) => Object.fromEntries(Object.entries(s).filter(([k]) => !DESIGN_KEYS.includes(k)));

// Vor dem Speichern wählen, was ins Backup soll
function exportBackup() {
  openModal(`<h3>Backup speichern</h3>
    <p class="muted">Wähle, was ins Backup soll. Nicht gewählte Teile fehlen in der Datei.</p>
    ${[["plan", "Stundenplan, Module, Aufgaben & Karten"], ["design", "Design & Darstellung"], ["einstellungen", "Einstellungen"]]
      .map(([k, l]) => `<label class="row" style="margin:10px 0"><input type="checkbox" data-exp="${k}" checked> ${l}</label>`).join("")}
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:16px">
      <button type="button" class="btn ghost" data-act="mclose">Abbrechen</button>
      <button type="button" class="btn" data-act="expgo">Speichern</button>
    </div>`);
}
function doExport() {
  const chosen = [...document.querySelectorAll("[data-exp]:checked")].map((x) => x.dataset.exp);
  if (!chosen.length) { appAlert("Bitte wähle mindestens einen Teil aus."); return; }
  const s = state.settings;
  const out = { format: "studienplaner-backup", version: 2 };
  if (chosen.includes("plan")) out.plan = { events: state.events, modules: state.modules, todos: state.todos, cards: state.cards || [] };
  if (chosen.includes("design")) out.design = pickDesign(s);
  if (chosen.includes("einstellungen")) out.einstellungen = pickRest(s);
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `studienplaner-backup-${iso(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  closeModal();
}
// Liest eine Backup-Datei: neues Format mit Teilen oder das alte Format (alles in einer Datei)
function readBackup(obj) {
  if (obj && obj.format === "studienplaner-backup") {
    return { plan: obj.plan || null, design: obj.design || null, einstellungen: obj.einstellungen || null };
  }
  if (!obj || !obj.events || !obj.modules) throw new Error("falsches Format");
  const s = obj.settings || {};
  return {
    plan: { events: obj.events, modules: obj.modules, todos: obj.todos || [], cards: obj.cards || [] },
    design: pickDesign(s),
    einstellungen: pickRest(s),
  };
}
function openImportChoice() {
  const labels = [
    ["plan", "Stundenplan, Module, Aufgaben & Karten"],
    ["design", "Design & Darstellung"],
    ["einstellungen", "Einstellungen"],
  ].filter(([k]) => pendingImport[k]);
  if (!labels.length) { pendingImport = null; appAlert("Im Backup wurde nichts gefunden, was sich einspielen lässt."); return; }
  openModal(`<h3>Backup einspielen</h3>
    <p class="muted">Wähle, was aus dem Backup übernommen werden soll. Das Gewählte ersetzt die aktuellen Daten, Nicht-Gewähltes bleibt unverändert.</p>
    ${labels.map(([k, l]) => `<label class="row" style="margin:10px 0"><input type="checkbox" data-imp="${k}" checked> ${l}</label>`).join("")}
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:16px">
      <button type="button" class="btn ghost" data-act="mclose">Abbrechen</button>
      <button type="button" class="btn danger" data-act="impgo">Einspielen</button>
    </div>`);
}
function applyPendingImport() {
  if (!pendingImport) return;
  const chosen = [...document.querySelectorAll("[data-imp]:checked")].map((x) => x.dataset.imp);
  if (!chosen.length) { appAlert("Bitte wähle mindestens einen Teil aus."); return; }
  const next = { ...state, settings: { ...state.settings } };
  if (chosen.includes("plan") && pendingImport.plan) Object.assign(next, pendingImport.plan);
  if (chosen.includes("design") && pendingImport.design) Object.assign(next.settings, pendingImport.design);
  if (chosen.includes("einstellungen") && pendingImport.einstellungen) Object.assign(next.settings, pendingImport.einstellungen);
  pendingImport = null;
  state = normalize(next);
  commit();
  closeModal();
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
  // Kleiner Punkt am Profilknopf: grün = gespeichert, gelb = arbeitet, rot = Fehler, grau = nur auf diesem Gerät
  const mode = text === "synchron" ? "ok" : text === "Sync-Fehler" ? "err" : text === "lokal" ? "local" : "busy";
  document.querySelectorAll(".profile-btn").forEach((el) => (el.dataset.sync = mode));
}

function initCloud() {
  if (!cloudConfigured()) { setStatus("lokal"); return; }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  sb.auth.onAuthStateChange((_event, s) => {
    session = s;
    authChecked = true;
    safeRender();
    if (s) cloudPull(); else setStatus("lokal");
  });
  sb.auth.getSession().then(({ data }) => {
    session = data.session;
    authChecked = true;
    safeRender();
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
    safeRender();
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
// Verlauf für die Zurück-Taste: Grundeintrag (= Startbildschirm) und aktueller Reiter
// Alles, was der Zurück-Taste als "Seite" gilt: Reiter, geöffnete Vorlesung, geöffnetes Thema
function navSnap() {
  return { tab: ui.tab, modOpen: ui.modOpen || null, topicOpen: ui.topicOpen || null, view: ui.view || "week", dayDate: ui.view === "day" ? ui.dayDate : null, setPage: ui.setPage || null, nfOnly: ui.nfOnly || null };
}
const navKey = (x) => [x.tab, x.modOpen, x.topicOpen, x.view || "week", x.setPage || "", x.nfOnly || ""].join("|");
let navRestoring = false;
// Wird bei jedem Neuzeichnen aufgerufen: neue Unterseite = neuer Verlaufseintrag, neuer Reiter = ersetzen
// Eigene Liste der Verlaufseinträge (Kennung je Eintrag), damit „Zurück in der App“ nur dann den Verlauf nutzt, wenn der Eintrag davor wirklich passt
let navSeqC = 0;
let navHist = [];
function navPush(snap, prev) {
  const seq = ++navSeqC;
  navHist.push(seq);
  history.pushState({ sp: "nav", nav: { ...snap, seq, prev } }, "");
}
function syncHistoryNav() {
  if (navRestoring) return;
  try {
    const cur = history.state;
    if (!cur || cur.sp !== "nav" || !cur.nav) return;
    const snap = navSnap();
    const kNow = navKey(snap);
    if (navKey(cur.nav) === kNow) {
      // nur der Tag hat sich geändert: Eintrag ersetzen, sonst müsste man beim Zurück jeden Tag einzeln durchgehen
      if (snap.dayDate !== cur.nav.dayDate) history.replaceState({ sp: "nav", nav: { ...snap, seq: cur.nav.seq, prev: cur.nav.prev } }, "");
      return;
    }
    const top = navHist[navHist.length - 1];
    const below = navHist[navHist.length - 2];
    // In-App-Zurück (‹ Zurück, Woche/Tag, Reiter): den Verlaufseintrag zurücknehmen, wenn er wirklich der vorherige ist
    if (cur.nav.prev && top === cur.nav.seq && below === cur.nav.prev.seq && navKey(cur.nav.prev) === kNow) {
      navHist.pop();
      history.back();
      return;
    }
    // Neue Ansicht: neuer Verlaufseintrag, der sich die vorherige Ansicht merkt
    navPush(snap, { ...cur.nav, prev: undefined });
  } catch (_) {}
}
try {
  history.replaceState({ sp: "base" }, "");
  navPush(navSnap(), undefined);
} catch (_) {}
let lastRootBack = 0;
// Ganz vorne in der App: erstes Zurück zeigt einen Hinweis, zweites Zurück innerhalb von 2 s beendet die App
function handleBackAtRoot() {
  const now = Date.now();
  if (now - lastRootBack < 2000) { try { history.back(); } catch (_) {} return; }
  lastRootBack = now;
  showToast("Zum Beenden nochmal zurück tippen");
  try { navPush(navSnap(), undefined); } catch (_) {}
}
window.addEventListener("popstate", (e) => {
  if (ignorePop > 0) { ignorePop--; return; }   // eigenes Schließen eines Fensters
  const st = e.state || {};
  const root = document.getElementById("modalRoot");
  // Ein offenes Fenster schließt sich zuerst, die Seite bleibt wie sie ist
  if (root && root.innerHTML) { hideModal(); return; }
  if (!st.sp || st.sp === "base") { handleBackAtRoot(); return; }
  const start = state.settings.startTab || "dashboard";
  const x = st.sp === "nav" && st.nav ? st.nav : { tab: start, modOpen: null, topicOpen: null };
  const sameTab = x.tab === ui.tab;
  const viewChanged = (x.view || "week") !== (ui.view || "week");
  ui.tab = x.tab;
  ui.modOpen = x.modOpen;
  ui.topicOpen = x.topicOpen;
  ui.view = x.view || "week";
  if (x.dayDate) ui.dayDate = x.dayDate;
  ui.setPage = x.setPage || null;
  ui.nfOnly = x.nfOnly || null;
  if (viewChanged) ui.anim = "zoom";
  navRestoring = true;
  try { render(); } finally { navRestoring = false; }
  const at = navHist.indexOf(x.seq);
  if (at >= 0) navHist = navHist.slice(0, at + 1); else navHist = x.seq ? [x.seq] : navHist;
  try { history.replaceState({ sp: "nav", nav: { ...navSnap(), seq: x.seq, prev: x.prev } }, ""); } catch (_) {}
  if (!sameTab) window.scrollTo(0, 0);
});
initCloud();
render();
handleLaunch();
// Systemfarbe folgen: beim Wechsel des Geräte-Designs neu zeichnen
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (state.settings.themeMode === "system") render();
});
// Der Neuaufbau tauscht die Elemente aus: liegt gerade ein Finger darauf, bricht das Scrollen ab und hängt, bis man neu ansetzt.
function tickPlan() {
  if (scrollBusy() || Date.now() - lastTouchEnd < 1500 || swipe || pinch || document.body.classList.contains("swiping")) { setTimeout(tickPlan, 1600); return; }
  if (ui.tab === "stundenplan" && !document.querySelector(".modal")) render();
}
setInterval(tickPlan, 60000);
// Tageszeit-Design: alle 5 Minuten prüfen, ob ein anderer Abschnitt des Tages begonnen hat
setInterval(() => { if (dynOn()) applyTheme(); }, 5 * 60 * 1000);

// ---------- Push-Benachrichtigungen ----------
const VAPID_PUBLIC_KEY = "BET0TZ9SGPPKXHs2r3t3WPyzHyE7QNsyOGEk4uipfwjV6-HbB1G5nrNjYZjtLkhTL6X_-iBxAFMI9uvTfE_kbjA";

function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function b64ToBytes(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function pushNeedsHomeScreen() {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
  return isIOS && !standalone;
}

// Ist auf diesem Gerät wirklich ein Abo aktiv? (wird beim Start geprüft)
let pushState = { checked: false, active: false };
async function checkPushState() {
  try {
    if (!pushSupported() || Notification.permission !== "granted") pushState = { checked: true, active: false };
    else {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg && (await reg.pushManager.getSubscription());
      pushState = { checked: true, active: !!sub };
    }
  } catch (_) { pushState = { checked: true, active: false }; }
  if (ui.tab === "einstellungen") render();
}
// Welche eigenen Erinnerungen heute schon verschickt wurden (für „verpasst“ / „gesendet“)
let todaySent = { day: "", keys: new Set(), at: 0 };
async function loadTodaySent() {
  const day = iso(new Date());
  if (!sb || !session || (todaySent.day === day && Date.now() - todaySent.at < 60000)) return;
  const { data, error } = await sb.from("sent_notifications").select("key").like("key", `cu:%:${day}`);
  if (error) return;
  todaySent = { day, keys: new Set((data || []).map((r) => r.key)), at: Date.now() };
  if (ui.tab === "einstellungen" && ui.nfOnly === "custom") render();
}
// Status einer eigenen Erinnerung für heute: gesendet, verpasst oder noch offen
// Wann die Erinnerung als Nächstes kommt
function nextCustomFire(c) {
  if (!c.on) return "";
  const now = new Date();
  const [h, m] = String(c.time || "").split(":").map(Number);
  if (Number.isNaN(h)) return "";
  const at = (d) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x; };
  let when = null;
  if (c.date) { const x = at(parseIso(c.date)); if (x >= now) when = x; }
  else if (Array.isArray(c.days) && c.days.length) {
    for (let k = 0; k < 8 && !when; k++) {
      const d = new Date(now); d.setDate(now.getDate() + k);
      const x = at(d);
      if (c.days.includes(d.getDay()) && x >= now) when = x;
    }
  }
  if (!when) return "";
  const isToday = iso(when) === iso(now);
  const day = isToday ? "heute" : when.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
  return `<div class="muted nextfire">Nächste: ${day} · ${esc(c.time)}</div>`;
}
function customTodayStatus(c) {
  const now = new Date();
  const day = iso(now);
  const dueToday = c.date ? c.date === day : Array.isArray(c.days) && c.days.includes(now.getDay());
  if (!c.on || !dueToday) return "";
  const [h, m] = String(c.time || "").split(":").map(Number);
  if (Number.isNaN(h)) return "";
  const t0 = h * 60 + m, nowMin = now.getHours() * 60 + now.getMinutes();
  if (todaySent.day !== day) return "";
  if (todaySent.keys.has(`cu:${c.id}:${day}`)) return `<span class="st ok">heute gesendet</span>`;
  if (nowMin >= t0 + 120) return `<span class="st miss">heute verpasst</span>`;
  if (nowMin >= t0) return `<span class="st wait">wird gerade gesendet…</span>`;
  return `<span class="st wait">heute um ${c.time}</span>`;
}
function pushWarnHTML() {
  if (!pushState.checked || pushState.active || !pushSupported()) return "";
  return `<div class="card push-warn"><b>Benachrichtigungen sind auf diesem Gerät aus.</b>
    <p class="muted" style="margin:6px 0 0">Erinnerungen kommen erst, wenn du sie unter Einstellungen → Benachrichtigungen aktivierst.</p></div>`;
}
function pushCardHTML() {
  if (!pushSupported()) {
    return `<div class="card"><h3>Benachrichtigungen</h3><p class="muted" style="margin:0">Dieser Browser unterstützt keine Benachrichtigungen.</p></div>`;
  }
  if (pushNeedsHomeScreen()) {
    return `<div class="card"><h3>Benachrichtigungen</h3><p class="muted" style="margin:0">Auf dem iPhone geht das nur, wenn du die App zuerst über „Teilen → Zum Home-Bildschirm“ hinzufügst und von dort aus öffnest.</p></div>`;
  }
  return `<div class="card"><h3>Benachrichtigungen</h3>
    <p class="muted" style="margin:0 0 10px">Erinnerungen für Termine, Mensa und Fristen. Weitere Einstellungen findest du in den Unterseiten.</p>
    <div class="row" style="gap:6px;flex-wrap:wrap">
      <button class="btn" data-act="pushon">Aktivieren</button>
      <button class="btn ghost" data-act="pushoff">Deaktivieren</button>
      <button class="btn ghost" data-act="pushtest">Testnachricht senden</button>
    </div></div>`;
}

// ---------- Benachrichtigungs-Einstellungen (werden mit der Cloud synchronisiert) ----------
const NOTIFY_DEFAULTS = {
  lead: 15,
  quiet: { on: false, from: "22:00", to: "07:00" },
  mensa: { on: true, time: "07:30" },
  mensa2: { on: false, time: "12:30" },
  fristen: { on: true, time: "08:00" },
  vorschau: { on: true, time: "17:00" },
  mods: {},
};

function notifyCfg() {
  if (!state.settings.notify) state.settings.notify = {};
  const n = state.settings.notify;
  for (const [k, v] of Object.entries(NOTIFY_DEFAULTS)) {
    if (n[k] === undefined) n[k] = JSON.parse(JSON.stringify(v));
    else if (typeof v === "object" && !Array.isArray(v)) n[k] = { ...v, ...n[k] };
  }
  return n;
}

// Vorlesungen sind standardmäßig an, Übungen und Tutorien aus (sofern nicht anders eingestellt)
function modNotifyOn(name, n) {
  const m = n.mods[name];
  return m && m.on !== undefined ? m.on : modKindOf(name) === "vl";
}

function notifyDetailsHTML() {
  const n = notifyCfg();
  const open = (k) => (ui.nfOpen && ui.nfOpen[k] ? " open" : "");
  const chk = (k, v) => `<input type="checkbox" data-change="notify" data-k="${k}" ${v ? "checked" : ""}>`;
  const tm = (k, v) => `<input type="time" data-change="notify" data-k="${k}" value="${v}" style="width:auto">`;
  // Auf einer Unterseite wird nur dieser eine Bereich gezeigt
  const sec = (key, title, body) => (ui.nfOnly && ui.nfOnly !== key) ? "" : `<details class="card" data-nf="${key}"${ui.nfOnly ? " open" : open(key)}><summary style="cursor:pointer;font-weight:600">${title}</summary><div style="margin-top:10px">${body}</div></details>`;

  const names = [...new Set(state.events.map((e) => e.name))].sort((a, b) => a.localeCompare(b, "de"));
  const groups = { vl: [], ueb: [], tut: [] };
  names.forEach((name) => { groups[modKindOf(name)] ? groups[modKindOf(name)].push(name) : groups.vl.push(name); });
  const modRow = (name) => {
    const m = n.mods[name] || {};
    const on = modNotifyOn(name, n);
    return `<div class="listrow" style="align-items:center;gap:8px">
      <div class="grow"><b>${esc(name)}</b></div>
      <label class="row" style="gap:4px">${chk("mod", on).replace("data-k=\"mod\"", `data-k="mod" data-m="${enc(name)}"`)} an</label>
      <input type="number" min="0" max="180" placeholder="${n.lead}" value="${m.lead != null ? m.lead : ""}" data-change="notify" data-k="modlead" data-m="${enc(name)}" style="width:70px"> <span class="muted">min</span>
    </div>`;
  };
  const modGroup = (title, arr) => arr.length ? `<h4 style="margin:12px 0 4px">${title}</h4>${arr.map(modRow).join("")}` : "";

  let h = "";
  h += sec("test", "Testnachrichten",
    `<p class="muted" style="margin:0 0 10px">Schickt sofort eine Beispielnachricht an dieses Gerät, damit du Knöpfe und Aktionen prüfen kannst.</p>
     <div class="row" style="gap:6px;flex-wrap:wrap">
       <button class="btn" data-act="pushtest" data-kind="mod">Modul</button>
       <button class="btn ghost" data-act="pushtest" data-kind="mensa">Mensa</button>
       <button class="btn ghost" data-act="pushtest" data-kind="fristen">Fristen morgens</button>
       <button class="btn ghost" data-act="pushtest" data-kind="vorschau">Vorschau</button>
     </div>`);
  h += sec("mod", "Modul-Erinnerungen",
    `<p class="muted" style="margin:0 0 10px">Vor jedem Termin kommt eine Nachricht mit Name, Uhrzeit, Raum und Dozent. Der Knopf „Notiz schreiben“ öffnet direkt das Notizfenster.</p>
     <label class="row" style="gap:8px">Vorwarnzeit für alle <input type="number" min="0" max="180" value="${n.lead}" data-change="notify" data-k="lead" style="width:80px"> min</label>
     <p class="muted" style="margin:12px 0 0">Pro Modul: an/aus und eigene Vorwarnzeit (leer = die allgemeine Zeit).</p>
     ${modGroup("Vorlesungen", groups.vl)}${modGroup("Übungen", groups.ueb)}${modGroup("Tutorien", groups.tut)}
     ${names.length ? "" : `<p class="muted">Noch keine Termine geladen.</p>`}`);
  h += sec("mensa", "Mensa",
    `<label class="row" style="gap:8px">${chk("mensa.on", n.mensa.on)} Mensa-Nachricht an (Mo–Fr)</label>
     <label class="row" style="gap:8px;margin-top:8px">Uhrzeit ${tm("mensa.time", n.mensa.time)}</label>
     <label class="row" style="gap:8px;margin-top:14px">${chk("mensa2.on", n.mensa2.on)} Zweite Mensa-Nachricht (z. B. vor der Mittagspause)</label>
     <label class="row" style="gap:8px;margin-top:8px">Uhrzeit ${tm("mensa2.time", n.mensa2.time)}</label>`);
  h += sec("fristen", "Fristen am Morgen",
    `<label class="row" style="gap:8px">${chk("fristen.on", n.fristen.on)} an (jeden Tag, alle offenen Fristen der Woche)</label>
     <label class="row" style="gap:8px;margin-top:8px">Uhrzeit ${tm("fristen.time", n.fristen.time)}</label>`);
  h += sec("vorschau", "Vorschau nächste Woche",
    `<label class="row" style="gap:8px">${chk("vorschau.on", n.vorschau.on)} an (Fr, Sa, So)</label>
     <label class="row" style="gap:8px;margin-top:8px">Frühestens um ${tm("vorschau.time", n.vorschau.time)}</label>
     <p class="muted" style="margin:8px 0 0">Endet am Freitag eine Veranstaltung nach der Uhrzeit, kommt die Nachricht 30 Minuten nach ihrem Ende.</p>`);
  h += sec("quiet", "Ruhezeit",
    `<label class="row" style="gap:8px">${chk("quiet.on", n.quiet.on)} Keine Nachrichten in dieser Zeit</label>
     <label class="row" style="gap:8px;margin-top:8px">Von ${tm("quiet.from", n.quiet.from)} bis ${tm("quiet.to", n.quiet.to)}</label>`);
  return h;
}

// ---------- Eigene Erinnerungen ----------
// Feste Erinnerungen (Uhrzeit + Tage): settings.notify.custom
// Erinnerungen am Termin: ev.reminders = [{id, before, title, body, repeat, on}]
// repeat: once (nur dieser Termin) | weekly (jede Woche, gleicher Wochentag und Zeit) | even/odd (gerade/ungerade KW)
const WD_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Montag zuerst
const REPEAT_LABEL = { once: "nur dieser Termin", weekly: "jede Woche", even: "gerade KW", odd: "ungerade KW" };
// Einmal-Erinnerungen, deren Tag vorbei ist, werden entfernt (Server schickt sie ohnehin nicht mehr)
function pruneExpiredOnce() {
  const todayIso = iso(new Date());
  const list = customList();
  for (let i = list.length - 1; i >= 0; i--) if (list[i].date && list[i].date < todayIso) list.splice(i, 1);
}
// Heute mit einer Uhrzeit, die schon vorbei ist, würde nie gesendet
function timeAlreadyPast(date, time) {
  if (date !== iso(new Date())) return false;
  const [h, m] = String(time || "00:00").split(":").map(Number);
  const now = new Date();
  return h * 60 + m <= now.getHours() * 60 + now.getMinutes();
}
function customList() {
  const n = notifyCfg();
  if (!Array.isArray(n.custom)) n.custom = [];
  return n.custom;
}
function daysLabel(days) {
  if (!days || !days.length) return "keine Tage";
  if (days.length === 7) return "jeden Tag";
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return "Mo–Fr";
  return DAY_ORDER.filter((d) => days.includes(d)).map((d) => WD_SHORT[d]).join(", ");
}
// Alle Erinnerungen am Termin, sortiert nach Termin
function eventRules() {
  const out = [];
  for (const ev of state.events) for (const r of (ev.reminders || [])) out.push({ ev, r });
  return out.sort((a, b) => a.ev.date.localeCompare(b.ev.date) || a.ev.start - b.ev.start);
}

// Liste unter Einstellungen → Benachrichtigungen → Eigene Erinnerungen
// Vibration und Ton: gelten nur für dieses Gerät (localStorage, zusätzlich IndexedDB für den Service Worker)
function deviceNotifyHTML() {
  const p = { vib: "std", sound: true, ...(state.settings.nfDev || {}) };
  const opt = (v, l) => `<button class="btn ${p.vib === v ? "" : "ghost"}" data-act="nfvib" data-v="${v}">${l}</button>`;
  return `<div class="card"><h3>Vibration</h3>
      <p class="muted" style="margin-top:0">Gilt für alle Benachrichtigungen auf diesem Gerät. Die Vibration funktioniert vor allem mit Android und Chrome.</p>
      <div class="row" style="gap:6px;flex-wrap:wrap">${opt("std", "Standard")}${opt("kurz", "Kurz")}${opt("lang", "Lang")}${opt("aus", "Aus")}</div>
    </div>
    <div class="card"><h3>Ton</h3>
      <label class="row" style="gap:8px"><input type="checkbox" data-change="nfsound" ${p.sound ? "checked" : ""}> Ton bei Benachrichtigungen</label>
      <p class="muted" style="font-size:13px;margin-bottom:0">Auf Android kann der Ton zusätzlich in den Benachrichtigungs-Einstellungen von Chrome oder des Systems festgelegt werden. Diese haben Vorrang.</p>
    </div>`;
}
function customNotifyHTML() {
  const todayIso = iso(new Date());
  loadTodaySent();
  const list = customList().filter((c) => !c.date || c.date >= todayIso);
  const fixed = list.length
    ? list.map((c) => `<div class="listrow" style="align-items:center;gap:8px">
        <div class="grow"><b>${esc(c.title || "Erinnerung")}</b>
          <div class="muted" style="font-size:13px">${esc(c.time)} · ${c.date ? "einmalig am " + fmtD(parseIso(c.date)) : daysLabel(c.days)}${c.body ? " · " + esc(c.body) : ""}</div>
          ${customTodayStatus(c)}${nextCustomFire(c)}</div>
        <input type="checkbox" data-cnon="${c.id}" ${c.on ? "checked" : ""} title="an/aus">
        <button class="btn ghost" data-act="cnedit" data-id="${c.id}">Bearbeiten</button>
      </div>`).join("")
    : `<p class="muted">Noch keine feste Erinnerung.</p>`;
  const rules = eventRules().filter(({ ev, r }) => (r.repeat || "once") !== "once" || ev.date >= todayIso).map(({ ev, r }) => `<div class="listrow" style="align-items:center;gap:8px">
        <div class="grow"><b>${esc(r.title || ev.name)}</b>
          <div class="muted" style="font-size:13px">${esc(ev.name)} · ${fmtD(parseIso(ev.date))} ${fmtMin(ev.start)} · ${r.before} Min vorher · ${REPEAT_LABEL[r.repeat || "once"]}</div></div>
        <input type="checkbox" data-evrnon="${ev.id}|${r.id}" ${r.on !== false ? "checked" : ""} title="an/aus">
        <button class="btn ghost" data-act="evredit" data-id="${ev.id}" data-rid="${r.id}">Bearbeiten</button>
      </div>`).join("");
  return `${pushWarnHTML()}<div class="card"><h3>Feste Erinnerungen</h3>
      <p class="muted" style="margin-top:0">Eine Nachricht zu einer festen Uhrzeit an den gewählten Tagen, zum Beispiel „Losgehen“ um 7:30.</p>
      ${fixed}
      <button class="btn" data-act="cnnew" style="margin-top:12px">+ Neue Erinnerung</button>
    </div>
    <div class="card"><h3>Vor Terminen</h3>
      <p class="muted" style="margin-top:0">Erinnerungen vor einzelnen Terminen im Stundenplan, z. B. 25 Min vorher. Neue legst du an, indem du einen Termin antippst und „Erinnerung“ wählst.</p>
      ${rules || `<p class="muted">Noch keine Erinnerung vor einem Termin.</p>`}
    </div>`;
}

// Fenster für eine feste Erinnerung (neu oder bearbeiten)
function openCustomEdit(id) {
  const c = id ? customList().find((x) => x.id === id) : null;
  const once = !!(c && c.date);
  const v = c || { title: "", body: "", time: "07:30", days: [1, 2, 3, 4, 5] };
  const today = iso(new Date());
  openModal(`<h3>${c ? "Erinnerung bearbeiten" : "Neue Erinnerung"}</h3>
    <form data-form="cnsave" data-id="${c ? c.id : ""}">
      <label class="muted">Titel</label>
      <input name="title" required value="${esc(v.title)}" placeholder="z. B. Losgehen">
      <label class="muted">Text (optional)</label>
      <textarea name="body" rows="2" placeholder="z. B. Bus 7:52 ab Haltestelle">${esc(v.body || "")}</textarea>
      <label class="muted" style="display:block;margin:12px 0 6px">Wie oft?</label>
      <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px">
        <button type="button" class="btn ${once ? "" : "ghost"}" data-act="qkkind" data-v="once">Einmal</button>
        <button type="button" class="btn ${once ? "ghost" : ""}" data-act="qkkind" data-v="weekly">Jede Woche</button>
      </div>
      <input type="hidden" name="kind" value="${once ? "once" : "weekly"}">
      <div data-qk="once" ${once ? "" : "hidden"}>
        <label class="muted" style="display:block;margin:8px 0 6px">Datum</label>
        <input type="date" name="date" value="${once ? c.date : today}" style="width:auto">
      </div>
      <div data-qk="weekly" ${once ? "hidden" : ""}>
        <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:8px">
          <button type="button" class="btn ghost" data-act="qkday" data-v="mf">Mo–Fr</button>
          <button type="button" class="btn ghost" data-act="qkday" data-v="all">Jeden Tag</button>
        </div>
        <div class="row" style="gap:10px;flex-wrap:wrap;margin-bottom:8px">
          ${DAY_ORDER.map((d) => `<label class="row" style="gap:4px"><input type="checkbox" name="d" value="${d}" ${!once && v.days.includes(d) ? "checked" : ""}> ${WD_SHORT[d]}</label>`).join("")}
        </div>
      </div>
      <label class="muted" style="display:block;margin:12px 0 6px">Uhrzeit</label>
      <input type="time" name="time" required value="${v.time}" style="width:auto">
      <div class="sheet-actions">
        ${c ? `<button type="button" class="danger-text" data-act="cndel" data-id="${c.id}">Löschen</button>` : "<span></span>"}
        <div class="right">
          <button type="button" class="btn ghost" data-act="mclose">Abbrechen</button>
          <button class="btn">Speichern</button>
        </div>
      </div>
    </form>`);
}

// Gilt eine Erinnerung von Termin „src“ auch für Termin „ev“? (gleiche Logik wie in der Function)
function ruleApplies(src, r, ev) {
  if (ev.name !== src.name || ev.start == null) return false;
  const rep = r.repeat || "once";
  if (rep === "once") return ev.id === src.id;
  if (ev.start !== src.start || ev.date < src.date) return false;
  if (parseIso(ev.date).getDay() !== parseIso(src.date).getDay()) return false;
  if (rep === "weekly") return true;
  const even = kwOf(parseIso(ev.date)) % 2 === 0;
  return rep === "even" ? even : !even;
}
// Alle Erinnerungen, die für diesen Termin gelten (eigene und geerbte aus der Serie)
function effectiveRules(ev) {
  const out = [];
  for (const src of state.events) for (const r of (src.reminders || [])) if (ruleApplies(src, r, ev)) out.push({ src, r });
  return out;
}

// Liste der Erinnerungen im Termin-Fenster. Geerbte Regeln sind zu sehen und werden am Ursprung bearbeitet.
function evReminderRows(ev) {
  const rows = effectiveRules(ev).map(({ src, r }) => `<div class="listrow" style="align-items:center;gap:8px">
      <div class="grow"><b>${esc(r.title || ev.name)}</b>
        <div class="muted" style="font-size:13px">${r.before} Min vorher · ${REPEAT_LABEL[r.repeat || "once"]}${src.id !== ev.id ? ` · festgelegt am ${fmtD(parseIso(src.date))} ${fmtMin(src.start)}` : ""}</div></div>
      <button type="button" class="btn ghost" data-act="evredit" data-id="${src.id}" data-rid="${r.id}">Bearbeiten</button>
    </div>`).join("");
  return `<div class="muted" style="margin:10px 0 4px">Erinnerungen für diesen Termin</div>${rows || `<p class="muted" style="margin:4px 0">Keine.</p>`}
    <button type="button" class="btn ghost" data-act="evrnew" data-id="${ev.id}" style="margin-bottom:6px">+ Erinnerung</button>`;
}

// Fenster für eine Erinnerung an einem Termin
function openEvReminderEdit(evId, rid) {
  const ev = state.events.find((x) => x.id === evId);
  if (!ev) return;
  const r = rid ? (ev.reminders || []).find((x) => x.id === rid) : null;
  const v = r || { before: 25, title: "", body: "", repeat: "once" };
  openModal(`<h3>Erinnerung</h3>
    <p class="muted" style="margin-top:0">${esc(ev.name)} · ${fmtD(parseIso(ev.date))} ${fmtMin(ev.start)}</p>
    <form data-form="evrsave" data-id="${ev.id}" data-rid="${r ? r.id : ""}">
      <label class="muted">Wie viele Minuten vorher?</label>
      <input type="number" name="before" min="0" max="1440" required value="${v.before}">
      <label class="muted">Titel</label>
      <input name="title" required value="${esc(v.title)}" placeholder="z. B. Losgehen">
      <label class="muted">Text (optional)</label>
      <textarea name="body" rows="2" placeholder="z. B. Mit dem Rad, 12 Min">${esc(v.body || "")}</textarea>
      <label class="muted">Wiederholung</label>
      <select name="repeat">${Object.entries(REPEAT_LABEL).map(([k, l]) => `<option value="${k}" ${(v.repeat || "once") === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <p class="muted">„Jede Woche“ gilt für Termine dieser Vorlesung am gleichen Wochentag und zur gleichen Uhrzeit. Gerade/ungerade KW nur in jeder zweiten Woche.</p>
      <div class="sheet-actions">
        ${r ? `<button type="button" class="danger-text" data-act="evrdel" data-id="${ev.id}" data-rid="${r.id}">Löschen</button>` : "<span></span>"}
        <div class="right">
          <button type="button" class="btn ghost" data-act="mclose">Abbrechen</button>
          <button class="btn">Speichern</button>
        </div>
      </div>
    </form>`);
}

// Wird bei jeder Eingabe in den Benachrichtigungs-Einstellungen aufgerufen
function notifySet(t) {
  const n = notifyCfg();
  const k = t.dataset.k;
  const v = t.type === "checkbox" ? t.checked : t.value;
  if (k === "mod" || k === "modlead") {
    const name = dec(t.dataset.m);
    n.mods[name] = n.mods[name] || {};
    if (k === "mod") n.mods[name].on = v;
    else n.mods[name].lead = t.value === "" ? null : Math.min(180, Math.max(0, Math.round(Number(t.value)) || 0));
  } else if (k === "lead") {
    n.lead = Math.min(180, Math.max(0, Math.round(Number(t.value)) || 0));
  } else {
    const [a, b] = k.split(".");
    if (b && t.type === "time" && !t.value) return;
    n[a][b] = v;
  }
  commit();
}

// Offene Abschnitte in den Einstellungen bleiben beim Neuzeichnen offen
document.addEventListener("toggle", (e) => {
  const key = e.target && e.target.dataset && e.target.dataset.nf;
  if (!key) return;
  ui.nfOpen = { ...(ui.nfOpen || {}), [key]: e.target.open };
}, true);

// Suchfeld in den Einstellungen: Liste sofort filtern, Cursor bleibt im Feld
document.addEventListener("input", (e) => {
  if (!e.target.dataset || e.target.dataset.setq === undefined) return;
  ui.setQuery = e.target.value;
  render();
  requestAnimationFrame(() => {
    const el = document.querySelector("[data-setq]");
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
});

// Öffnet die Notiz, wenn die App über den „Notiz schreiben“-Knopf der Benachrichtigung gestartet wurde
function handleLaunch() {
  const p = new URLSearchParams(location.search);
  const name = p.get("m");
  const date = p.get("d");
  const tab = p.get("tab");
  const focus = p.get("focus");
  const tabs = ["dashboard", "stundenplan", "kalender", "protokolle", "einstellungen"];
  if (p.get("new") === "todo") {
    history.replaceState(null, "", location.pathname);
    ui.tab = "dashboard"; ui.modOpen = null;
    render();
    setTimeout(() => openTodoModal(null, iso(new Date())), 250);
  }
  // „Erledigt“ aus einer Benachrichtigung: Aufgabe abhaken und die Adresse aufräumen
  const doneId = p.get("done");
  if (doneId) {
    history.replaceState(null, "", location.pathname);
    const t = state.todos.find((x) => x.id === doneId);
    if (t && !t.done && canCheck(t)) {
      t.done = true;
      t.doneAt = iso(new Date());
      commit();
      showToast(`„${t.title}“ erledigt`);
    }
  }
  if (tab && tabs.includes(tab)) {
    ui.tab = tab;
    ui.modOpen = null;
    history.replaceState(null, "", location.pathname);
    render();
  }
  // Zu einem bestimmten Bereich scrollen (z. B. die Mensa-Karte)
  if (focus) {
    setTimeout(() => {
      const el = document.getElementById("focus-" + focus);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 400);
  }
  if (p.get("note") && name && date) {
    history.replaceState(null, "", location.pathname);
    setTimeout(() => openNoteModal(name, date), 300);
  }
}

async function enablePush() {
  if (!pushSupported()) return appAlert("Benachrichtigungen werden auf diesem Gerät nicht unterstützt.");
  if (!sb || !session) return appAlert("Bitte zuerst anmelden.");
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return appAlert("Ohne Erlaubnis kann ich keine Benachrichtigungen schicken. Du kannst sie in den Geräteeinstellungen erlauben.");
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY) });
    const { error } = await sb.from("push_subscriptions").upsert(
      { user_id: session.user.id, endpoint: sub.endpoint, subscription: sub.toJSON() },
      { onConflict: "endpoint" });
    if (error) throw error;
    appAlert("Benachrichtigungen sind aktiv. Du bekommst morgens eine Erinnerung für Fristen von heute und morgen.");
  } catch (err) {
    appAlert("Das hat nicht geklappt: " + (err.message || err));
  }
}

// Sofortige Testnachricht an dieses Gerät (kommt in wenigen Sekunden)
async function pushTest(kind) {
  if (!sb || !session) return appAlert("Bitte zuerst anmelden.");
  try {
    const r = await fetch(SUPABASE_URL + "/functions/v1/notify", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer " + session.access_token, apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ test: true, kind: kind || "mod" }),
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    appAlert(j.sent ? "Testnachricht ist unterwegs. Sie sollte in wenigen Sekunden kommen." : "Kein Gerät gefunden. Bitte zuerst „Aktivieren“ tippen.");
  } catch (err) {
    appAlert("Der Test hat nicht geklappt: " + (err.message || err));
  }
}

async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      if (sb && session) await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    appAlert("Benachrichtigungen sind auf diesem Gerät aus.");
  } catch (err) {
    appAlert("Das hat nicht geklappt: " + (err.message || err));
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// ---------- Kalender: To-dos per Ziehen auf einen anderen Tag verschieben ----------
// Maus: sofort ziehen. Handy: kurz gedrückt halten, dann ziehen (Scrollen bleibt sonst möglich).
let drag = null;
let suppressClick = false;
let zoomTimer = null;

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
  if (drag.touch) drag.timer = setTimeout(() => startDrag(), 500);
});

function startDrag() {
  if (!drag || drag.active) return;
  drag.active = true;
  buzz(15);
  const g = document.createElement("div");
  g.id = "dragGhost";
  g.className = "drag-ghost";
  g.textContent = drag.title;
  document.body.appendChild(g);
  document.body.classList.add("is-dragging");
  moveDrag(drag.x, drag.y);
}

// Vorschau beim Ziehen im Stundenplan: zeigt die Umrandung, wo der Termin auf 15 Minuten gerundet landen würde
function dropPreview(grid, y) {
  let p = document.getElementById("dropPreview");
  if (!grid || !drag) { if (p) p.remove(); return; }
  const r = grid.getBoundingClientRect();
  let min = Math.round((START_MIN + (y - r.top) / PX_PER_MIN) / 15) * 15;
  min = Math.max(START_MIN, Math.min(min, END_MIN - 15));
  const t = state.todos.find((q) => q.id === drag.id);
  const ev = state.events.find((q) => q.id === drag.id);
  const len = ev && ev.start != null && ev.end != null ? ev.end - ev.start : (t && t.duration) || 60;
  if (!p) { p = document.createElement("div"); p.id = "dropPreview"; p.className = "drop-preview"; }
  if (p.parentNode !== grid) grid.appendChild(p);
  p.style.top = (min - START_MIN) * PX_PER_MIN + "px";
  p.style.height = Math.max(24, len * PX_PER_MIN) + "px";
  p.textContent = `${fmtMin(min)} – ${fmtMin(min + len)}`;
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
  dropPreview(grid && ui.tab === "stundenplan" ? grid : null, y);
  // Am linken oder rechten Rand: nach kurzem Halten weiterschalten
  const edge = ui.tab === "stundenplan" && x != null ? (x < 40 ? -1 : x > innerWidth - 40 ? 1 : 0) : 0;
  if (edge !== drag.edge) {
    clearTimeout(drag.edgeT);
    drag.edge = edge;
    if (edge) drag.edgeT = setTimeout(() => shiftForDrag(edge), 600);
  }
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
  document.getElementById("dropPreview")?.remove();
  document.querySelectorAll(".drop").forEach((c) => c.classList.remove("drop"));
  // Der nachfolgende Klick nach dem Ziehen soll nicht den Tag öffnen
  suppressClick = true;
  setTimeout(() => { suppressClick = false; }, 300);
  if (!cancelled && ui.tab === "stundenplan") {
    // Im Stundenplan: Uhrzeit aus der Höhe, auf 15 Minuten gerundet
    const under = x != null ? document.elementFromPoint(x, y) : null;
    let grid = under && under.closest(".grid[data-date]");
    // Am linken oder rechten Rand losgelassen: auf den nächstliegenden sichtbaren Tag ablegen
    if (!grid && x != null && (x < 40 || x > innerWidth - 40)) {
      const grids = [...document.querySelectorAll(".week .grid[data-date]")];
      if (grids.length) grid = x < 40 ? grids[0] : grids[grids.length - 1];
    }
    const t = state.todos.find((q) => q.id === d.id);
    const ev = state.events.find((q) => q.id === d.id);
    if (grid && (t || ev)) {
      const r = grid.getBoundingClientRect();
      let min = START_MIN + (y - r.top) / PX_PER_MIN;
      min = Math.round(min / 15) * 15;
      min = Math.max(START_MIN, Math.min(min, END_MIN - 15));
      if (ev && !t) { openEventDrop(ev.id, grid.dataset.date, min); return; }
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

// Kein Browser-Zoom per Pinch (iPhone/Safari); die eigene Streckung des Stundenplans bleibt
["gesturestart", "gesturechange", "gestureend"].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));


// ---------- App-Gefühl ----------
let lastEditTap = { id: null, t: 0 };
const hapt = (ms = 8) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (_) {} };

// 2) Kurzes Vibrieren bei Häkchen und Buttons
document.addEventListener("click", (e) => {
  if (e.target.closest && e.target.closest('input[type="checkbox"], .btn')) hapt(8);
}, true);

// 1) Wischen auf einem To-Do: nach rechts abhaken, nach links bearbeiten
let rowSwipe = null;
document.addEventListener("touchstart", (e) => {
  rowSwipe = null;
  if (ui.layEdit || e.touches.length !== 1) return;
  const row = e.target.closest && e.target.closest(".listrow[data-drag]");
  if (!row) return;
  const t = e.touches[0];
  rowSwipe = { row, x: t.clientX, y: t.clientY, dx: 0 };
}, { passive: true });
document.addEventListener("touchmove", (e) => {
  if (!rowSwipe) return;
  const t = e.touches[0];
  rowSwipe.dx = t.clientX - rowSwipe.x;
  if (Math.abs(t.clientY - rowSwipe.y) > Math.abs(rowSwipe.dx)) { rowSwipe.row.style.transform = ""; rowSwipe = null; return; }
  rowSwipe.row.style.transition = "none";
  rowSwipe.row.style.transform = `translateX(${Math.max(-90, Math.min(90, rowSwipe.dx)) * 0.6}px)`;
}, { passive: true });
document.addEventListener("touchend", () => {
  const sw = rowSwipe;
  rowSwipe = null;
  if (!sw) return;
  sw.row.style.transition = "transform .25s ease";
  sw.row.style.transform = "";
  if (Math.abs(sw.dx) < 90) return;
  if (sw.dx > 0) {
    const cb = sw.row.querySelector('input[data-act="tdone"]');
    if (cb && !cb.disabled) { hapt(12); cb.click(); }
  }
}, { passive: true });

// 4) Fenster nach unten wischen (am oberen Rand des Fensters)
let sheetDrag = null;
document.addEventListener("touchstart", (e) => {
  sheetDrag = null;
  const sheet = e.target.closest && e.target.closest(".modal .sheet");
  if (!sheet || e.touches.length !== 1) return;
  const t = e.touches[0];
  if (t.clientY - sheet.getBoundingClientRect().top > 56 || sheet.scrollTop > 0) return;
  sheetDrag = { sheet, y: t.clientY, dy: 0 };
}, { passive: true });
document.addEventListener("touchmove", (e) => {
  if (!sheetDrag) return;
  sheetDrag.dy = Math.max(0, e.touches[0].clientY - sheetDrag.y);
  sheetDrag.sheet.style.transition = "none";
  sheetDrag.sheet.style.transform = `translateY(${sheetDrag.dy}px)`;
}, { passive: true });
document.addEventListener("touchend", () => {
  if (!sheetDrag) return;
  const { sheet, dy } = sheetDrag;
  sheetDrag = null;
  if (dy > 110) { hapt(10); closeModal(); return; }
  sheet.style.transition = "transform .25s ease";
  sheet.style.transform = "";
}, { passive: true });

// 5) Kurze Rückmeldung nach dem Speichern eines Formulars
function showToast(text, ms = 1300) {
  let el = document.getElementById("appToast");
  if (!el) { el = document.createElement("div"); el.id = "appToast"; document.body.appendChild(el); }
  el.textContent = text;
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), ms);
}
document.addEventListener("submit", () => showToast("✓ Gespeichert"));

// 6) Zum Aktualisieren nach unten ziehen (ganz oben auf der Seite)
let pull = null;
document.addEventListener("touchstart", (e) => {
  pull = null;
  // Im Stundenplan scrollt nur das Raster (die Seite selbst nie): dort würde jeder Wisch nach unten als „Ziehen zum Aktualisieren“ zählen
  if (window.scrollY > 0 || e.touches.length !== 1 || document.querySelector(".modal") || ui.layEdit || ui.tab === "stundenplan") return;
  pull = { y: e.touches[0].clientY, dy: 0 };
}, { passive: true });
document.addEventListener("touchmove", (e) => { if (pull) pull.dy = e.touches[0].clientY - pull.y; }, { passive: true });
document.addEventListener("touchend", async () => {
  if (!pull) return;
  const dy = pull.dy;
  pull = null;
  if (dy < 90 || !session) return;
  hapt(10);
  await cloudPull();
  // Neu zeichnen erst, wenn nichts mehr scrollt oder unter dem Finger liegt
  const redraw = () => { if (scrollBusy()) setTimeout(redraw, 200); else render(); };
  redraw();
}, { passive: true });

// 7) Enter springt zum nächsten Feld; das Feld rutscht über die Tastatur in die Mitte
const FIELD_SEL = "input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=button]):not([type=submit]):not([type=hidden]), select, textarea";
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.shiftKey || e.isComposing || e.target.tagName === "TEXTAREA") return;
  const el = e.target;
  if (!el.form || !el.matches(FIELD_SEL)) return;
  const fields = [...el.form.querySelectorAll(FIELD_SEL)].filter((f) => !f.disabled && f.offsetParent !== null);
  const i = fields.indexOf(el);
  if (i >= 0 && i < fields.length - 1) { e.preventDefault(); fields[i + 1].focus(); }
}, true);
document.addEventListener("focusin", (e) => {
  if (!e.target.matches || !e.target.matches(FIELD_SEL)) return;
  setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 320);
});

// 8) Startbildschirm nur wenn die App vom Homescreen gestartet wird
(() => {
  const sp = document.getElementById("splash");
  if (!sp) return;
  if (!(matchMedia("(display-mode: standalone)").matches || navigator.standalone)) { sp.remove(); return; }
  setTimeout(() => sp.classList.add("gone"), 700);
  setTimeout(() => sp.remove(), 1200);
})();

// Thema umbenennen (✎ oder langes Drücken)
async function renameTopicFlow(name, id) {
  const t = topicOf(state.modules[name], id);
  const val = t && (await appPrompt("Thema umbenennen:", t.title));
  if (val && val.trim()) { t.title = val.trim(); commit(); }
}

// Ähnlichkeit zweier Themennamen (Schreibfehler, Groß-/Kleinschreibung, ein Buchstabe mehr oder weniger)
function similarTitle(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  const n = a.length, m = b.length;
  if (!n || !m) return false;
  const prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur = [i];
    for (let j = 1; j <= m; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev.splice(0, prev.length, ...cur);
  }
  const dist = prev[m];
  return dist <= Math.max(1, Math.floor(Math.max(n, m) / 4));
}

// Thema-Menü (langes Drücken): umbenennen oder löschen
function topicMenu(name, id) {
  const m = state.modules[name];
  const t = topicOf(m, id);
  if (!t) return;
  const used = m.notes.filter((n) => n.topicId === id).length;
  openModal(`<h3 style="margin:0 0 4px">${esc(t.title)}</h3>
    <div class="muted" style="margin-bottom:12px">${used} ${used === 1 ? "Eintrag" : "Einträge"}</div>
    <div style="display:grid;gap:8px">
      <button type="button" class="btn" data-act="ttitle" data-id="${esc(id)}" data-m="${enc(name)}">Umbenennen</button>
      <button type="button" class="btn ghost" data-act="tdel" data-id="${esc(id)}" data-m="${enc(name)}">Löschen</button>
      <button type="button" class="btn ghost" data-act="mclose">Abbrechen</button>
    </div>`);
}

// Fenster schließen, wenn gleich ein anderer Reiter angezeigt wird: ohne Zurück-Schritt,
// damit die Zurück-Logik die neue Ansicht nicht gleich wieder umstellt
function clearModalQuiet() {
  const root = document.getElementById("modalRoot");
  if (root) root.innerHTML = "";
  modalTok++;
  modalResolve = null;
  ui.dayPop = null;
  try {
    if (history.state && history.state.sp === "modal") history.replaceState({ sp: "nav", nav: navSnap() }, "");
  } catch (_) {}
}

// Countdown: unter 3 Tagen wird die Farbe warnend
function dueColor(dateStr, type) {
  if (!dateStr) return catColor(type);
  const days = Math.round((parseIso(dateStr) - parseIso(iso(new Date()))) / 86400000);
  return days <= 3 && days >= 0 ? "#f43f5e" : catColor(type);
}

function exportData() {
  try {
    const payload = { app: "studienplaner", exported: new Date().toISOString(), data: syncable(state) };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `studienplaner-${iso(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    showToast("✓ Export erstellt");
  } catch (_) { showToast("Export hat nicht geklappt"); }
}

// 8) Offline-Hinweis
function updateOnlineBanner(offline) {
  let el = document.getElementById("offlineBar");
  if (!el) { el = document.createElement("div"); el.id = "offlineBar"; el.textContent = "Offline – Änderungen werden auf diesem Gerät gespeichert"; document.body.appendChild(el); }
  el.classList.toggle("show", !!offline);
}
window.addEventListener("online", () => updateOnlineBanner(false));
window.addEventListener("offline", () => updateOnlineBanner(true));
updateOnlineBanner(!navigator.onLine);

// Wischen nach rechts erledigt eine Aufgabe (nur Berührung, nur waagerecht; senkrecht scrollt die Seite weiter)
(function () {
  let sw = null;
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch" || !e.target.closest) return;
    const row = e.target.closest(".item[data-id]");
    if (!row || e.target.closest("button, input, select, textarea, a")) return;
    const cb = row.querySelector('input[data-act="tdone"]');
    if (!cb || cb.disabled) return;
    sw = { row, cb, x: e.clientX, y: e.clientY, dx: 0, axis: null, id: e.pointerId };
  }, { passive: true });
  document.addEventListener("pointermove", (e) => {
    if (!sw || e.pointerId !== sw.id) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (sw.axis === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      sw.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (sw.axis !== "x") { sw = null; return; }
    sw.dx = Math.max(0, Math.min(dx, 160));
    sw.row.style.transition = "none";
    sw.row.style.transform = `translateX(${sw.dx}px)`;
    sw.row.classList.toggle("swipe-ready", sw.dx > 90);
  }, { passive: true });
  const end = () => {
    if (!sw) return;
    const s = sw; sw = null;
    s.row.style.transition = "transform .25s ease";
    s.row.style.transform = "";
    s.row.classList.remove("swipe-ready");
    if (s.axis === "x") s.row._swiped = Date.now();
    if (s.axis === "x" && s.dx > 90) s.cb.click();
  };
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
  // Nach einem Wisch soll der Eintrag nicht zusätzlich geöffnet werden
  document.addEventListener("click", (e) => {
    const row = e.target.closest && e.target.closest(".item[data-id]");
    if (e.target.matches && e.target.matches('input[data-act="tdone"]')) return; // der Klick, der die Aufgabe erledigt, bleibt
    if (row && row._swiped && Date.now() - row._swiped < 400) { e.stopPropagation(); e.preventDefault(); }
  }, true);
})();

checkPushState();
setTimeout(loadTodaySent, 1500);

// Pop-up am Handy nach unten wischen zum Schließen (nur wenn der Inhalt ganz oben steht; X, Zurück und Hintergrund bleiben)
(function () {
  let d = null;
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch" || !e.target.closest) return;
    const sheet = e.target.closest("#modalRoot .sheet");
    if (!sheet || sheet.scrollTop > 0 || e.target.closest("input, textarea, select")) return;
    d = { sheet, y: e.clientY, dy: 0, id: e.pointerId };
  }, { passive: true });
  document.addEventListener("pointermove", (e) => {
    if (!d || e.pointerId !== d.id) return;
    d.dy = e.clientY - d.y;
    if (d.dy > 0) {
      d.sheet.style.transition = "none";
      d.sheet.style.transform = `translateY(${Math.min(d.dy, 320)}px)`;
    }
  }, { passive: true });
  const end = () => {
    if (!d) return;
    const s = d; d = null;
    s.sheet.style.transition = "transform .2s ease";
    s.sheet.style.transform = "";
    if (s.dy > 110) closeModal();
  };
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
})();
