// Cloud (Supabase), Start, Push, eigene Erinnerungen, App-Gefühl
// Teil von app.js (aufgeteilt). Reihenfolge der Dateien in index.html beachten.
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

// Abgleich pro Eintrag: Änderungen von zwei Geräten gehen nicht mehr verloren.
// Gemeinsam ist der Stand beim letzten Abgleich (syncBase). Hat nur ein Gerät einen Eintrag geändert, gilt diese Änderung.
// Haben beide denselben Eintrag geändert, gewinnt das Gerät, auf dem gerade gearbeitet wird.
const SYNC_BASE_LS = "studienplaner-sync-base";
let syncBase = (() => { try { return JSON.parse(localStorage.getItem(SYNC_BASE_LS) || "null"); } catch { return null; } })();
let syncing = false;
let syncAgain = false;
const sameVal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hasIds = (arr) => Array.isArray(arr) && arr.every((x) => x && typeof x === "object" && x.id !== undefined);
function mergeList(bl, ll, rl) {
  const byId = (arr) => new Map((arr || []).map((x) => [x.id, x]));
  const B = byId(bl), L = byId(ll), R = byId(rl);
  const out = [];
  const seen = new Set();
  for (const x of [...(ll || []), ...(rl || [])]) {
    if (seen.has(x.id)) continue;
    seen.add(x.id);
    const b = B.get(x.id), l = L.get(x.id), r = R.get(x.id);
    let keep = null;
    if (l && r) keep = !sameVal(l, b) ? l : (!sameVal(r, b) ? r : l);
    else if (l) keep = (!b || !sameVal(l, b)) ? l : null;   // auf dem anderen Gerät gelöscht, außer hier geändert
    else if (r) keep = (!b || !sameVal(r, b)) ? r : null;   // hier gelöscht, außer auf dem anderen Gerät geändert
    if (keep) out.push(keep);
  }
  return out;
}
function mergeDocs(base, local, remote) {
  const out = {};
  for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const l = local[k], r = remote[k], b = base[k];
    if (Array.isArray(l) && Array.isArray(r) && (hasIds(l) || !l.length) && (hasIds(r) || !r.length)) out[k] = mergeList(b, l, r);
    else if (r === undefined) out[k] = l;
    else if (l === undefined) out[k] = r;
    else out[k] = sameVal(l, b) ? r : l;
  }
  return out;
}
// Papierkorb und Verlauf sind Teil des Stands und reisen mit; für den gemeinsamen Stand zählen sie nicht
const docForCloud = (s) => ({ ...syncable(s), history: s.history, future: s.future, trash: s.trash });
async function cloudSync() {
  if (!session) return;
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  setStatus("synchronisiere …");
  try {
    const { data, error } = await sb.from("user_data").select("data").eq("user_id", session.user.id).maybeSingle();
    if (error) throw error;
    const local = docForCloud(state);
    const remote = data && data.data ? data.data : null;
    let merged = local;
    if (remote) {
      merged = mergeDocs(syncBase || {}, local, remote);
      merged.updatedAt = Math.max(local.updatedAt || 0, remote.updatedAt || 0);
      if (!sameVal(merged, local)) {
        // Während des Abrufs hat sich hier etwas geändert: erst den neuen Stand abgleichen
        if (!sameVal(docForCloud(state), local)) { syncing = false; syncAgain = true; return cloudSync(); }
        state = normalize(merged);
        lastSnap = snapshot();
        saveLocal();
        saveDevice();
        safeRender();
      }
    }
    const { error: werr } = await sb.from("user_data").upsert({
      user_id: session.user.id,
      data: merged,
      updated_at: new Date().toISOString(),
    });
    if (werr) throw werr;
    const { history, future, trash, ...core } = merged;
    syncBase = JSON.parse(JSON.stringify(core));
    try { localStorage.setItem(SYNC_BASE_LS, JSON.stringify(syncBase)); } catch {}
    setStatus("synchron");
  } catch (_) {
    setStatus("Sync-Fehler");
  } finally {
    syncing = false;
  }
  if (syncAgain) { syncAgain = false; cloudSync(); }
}
async function cloudPull() { return cloudSync(); }
async function cloudPush() { return cloudSync(); }

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
    <p style="margin:0 0 10px"><b>${!pushState.checked ? "Status wird geprüft …" : pushState.active ? "✓ Auf diesem Gerät aktiv" : "Auf diesem Gerät nicht aktiv"}</b></p>
    <div class="row" style="gap:6px;flex-wrap:wrap">
      <button class="btn" data-act="pushon">${pushState.checked && pushState.active ? "Erneut aktivieren" : "Aktivieren"}</button>
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
  // Startbildschirm-Verknüpfung „KI-Chat“
  if (p.get("kichat") === "1") {
    history.replaceState(null, "", location.pathname);
    ui.tab = "dashboard"; ui.modOpen = null;
    render();
    setTimeout(() => kiChatOpen(), 300);
  }
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

// Sitzungs-ID dieses Geräts (steckt im Anmelde-Token), damit das Push-Abo einer Sitzung zugeordnet werden kann
function aktuelleSitzung() {
  try {
    const b64 = session.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64)).session_id || null;
  } catch (_) { return null; }
}

// Wartet höchstens ms Millisekunden; sonst Fehler mit Schritt-Namen (statt stummem Hängen)
function pushStep(promise, ms, name) {
  let timer;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(name + " antwortet nicht (Zeitlimit)")), ms);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

async function enablePush() {
  if (!pushSupported()) return appAlert("Benachrichtigungen werden auf diesem Gerät nicht unterstützt.");
  if (!sb || !session) return appAlert("Bitte zuerst anmelden.");
  if (enablePush.busy) return;
  enablePush.busy = true;
  showToast("Benachrichtigungen werden aktiviert …", 3000);
  let step = "Erlaubnis";
  try {
    const perm = await pushStep(Notification.requestPermission(), 30000, "Die Erlaubnis-Abfrage");
    if (perm !== "granted") return appAlert("Ohne Erlaubnis kann ich keine Benachrichtigungen schicken. Du kannst sie in den Geräteeinstellungen (Website-Berechtigungen) erlauben.");

    step = "Hintergrunddienst";
    let reg = await pushStep(navigator.serviceWorker.getRegistration(), 8000, "Der Hintergrunddienst");
    if (!reg) {
      // Auf diesem Gerät noch nicht registriert: jetzt registrieren und den Fehler zeigen, falls es scheitert
      reg = await pushStep(navigator.serviceWorker.register("sw.js"), 15000, "Die Registrierung");
    }
    reg = await pushStep(navigator.serviceWorker.ready, 10000, "Der Hintergrunddienst");

    step = "Abo auf diesem Gerät";
    let sub = await pushStep(reg.pushManager.getSubscription(), 8000, "Die Abo-Abfrage");
    if (!sub) sub = await pushStep(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY) }), 20000, "Das Abo");

    step = "Speichern";
    const { error } = await pushStep(sb.from("push_subscriptions").upsert(
      { user_id: session.user.id, endpoint: sub.endpoint, subscription: sub.toJSON(), sitzung: aktuelleSitzung() },
      { onConflict: "endpoint" }), 15000, "Das Speichern");
    if (error) throw error;
    pushState = { checked: true, active: true };
    geraeteData = null; // Geräteliste neu laden, damit der Push-Status stimmt
    if (ui.tab === "einstellungen") render();
    appAlert("Benachrichtigungen sind aktiv. Du bekommst morgens eine Erinnerung für Fristen von heute und morgen.");
  } catch (err) {
    console.error("enablePush", step, err);
    const detail = err && err.message ? err.message : String(err);
    appAlert(`Das hat nicht geklappt (Schritt „${step}“): ${detail}` + (swRegError ? `\nHintergrunddienst-Fehler: ${swRegError.message || swRegError}` : ""));
  } finally {
    enablePush.busy = false;
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
    pushState = { checked: true, active: false };
    if (ui.tab === "einstellungen") render();
    appAlert("Benachrichtigungen sind auf diesem Gerät aus.");
  } catch (err) {
    appAlert("Das hat nicht geklappt: " + (err.message || err));
  }
}

// Fehler der Registrierung merken, damit „Aktivieren“ ihn anzeigen kann
let swRegError = null;
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch((e) => { swRegError = e; console.error("sw register", e); });
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
// Zwei Finger auf der Seite vergrößern nicht die ganze App (Dashboard, Protokolle usw.). Der Stundenplan streckt sich selbst.
document.addEventListener("touchstart", (e) => { if (e.touches.length > 1 && e.cancelable) e.preventDefault(); }, { passive: false });
document.addEventListener("touchmove", (e) => { if (e.touches.length > 1 && e.cancelable) e.preventDefault(); }, { passive: false });


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

