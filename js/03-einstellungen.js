// Einstellungen, modale Fenster, Nächste Frist, Mensa-Karte, Layout bearbeiten
// Teil von app.js (aufgeteilt). Reihenfolge der Dateien in index.html beachten.
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
  pages.geraete = [geraeteHTML()];
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
  { k: "geraete", t: "Angemeldete Geräte", d: "Wo du angemeldet bist, und einzelne Geräte abmelden", w: "geräte gerät angemeldet sitzung abmelden login anmeldung", ic: "📱", col: "#64748b" },
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
    <div class="modal-foot"><button class="btn ghost" data-act="mclose">Schließen</button></div>`);
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
let mensaRefreshing = false;  // läuft gerade ein Abruf (zeigt „Aktualisiere …“)
let mensaBusy = false;
// Speicher: je Datum ein Eintrag, nur die letzten 10 Tage
function mensaCache() {
  try { return JSON.parse(localStorage.getItem(MENSA_LS) || "{}") || {}; } catch { return {}; }
}
// Wochenende ausblenden, wenn es in den Einstellungen aus ist (Sa/So → Montag)
// Die Website hat nur Mo–Fr einer Woche. Angezeigt wird die aktuelle Woche; am Wochenende schon die nächste.
function mensaWeek() {
  const t = parseIso(iso(new Date()));
  const toMon = t.getDay() === 0 || t.getDay() === 6 ? (8 - t.getDay()) % 7 : -((t.getDay() + 6) % 7);
  const mon = addDays(t, toMon);
  return { mon: iso(mon), fri: iso(addDays(mon, 4)) };
}
function mensaTarget() {
  const w = mensaWeek();
  let d = iso(parseIso(ui.mensaDay || iso(new Date())));
  if (d < w.mon) d = w.mon;
  if (d > w.fri) d = w.fri;
  return d;
}
// Tag wechseln (v = ±1 mit Animation wie im Stundenplan); 0 = heute. Außerhalb der Woche passiert nichts.
function mensaStep(v) {
  if (v === 0) { ui.mensaDay = null; render(); return; }
  mensaGo(v);
}
function mensaCanGo(dir) {
  const w = mensaWeek();
  const d = iso(addDays(parseIso(mensaTarget()), dir));
  return d >= w.mon && d <= w.fri;
}
function mensaGo(dir) {
  if (pagerBusy || !mensaCanGo(dir)) return;
  pagerBusy = true;
  const d = iso(addDays(parseIso(mensaTarget()), dir));
  const title = document.querySelector(".mensa-title");
  if (title) title.innerHTML = mensaTitleHTML(d);
  const pages = document.querySelector(".mensa-pages");
  const after = () => { pagerBusy = false; ui.mensaDay = d; render(); };
  if (!pages) return after();
  pagerAnimate(pages, dir > 0 ? "translateX(-66.6667%)" : "translateX(0%)", after);
}
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
// Titel eines Tages (Kopfzeile der Karte; bleibt beim Wischen stehen, wie die Wochentage im Stundenplan)
function mensaTitleHTML(day) {
  const today = iso(new Date());
  const wochentag = parseIso(day).toLocaleDateString("de-DE", { weekday: "long" });
  const title = day === today ? "Mensa heute" : `Mensa · ${wochentag}`;
  return `<h3 style="margin:0">${title}</h3><div class="muted" style="font-size:12px;margin-top:2px">${fmtD(parseIso(day))}</div>`;
}
// Inhalt eines Tages: Gerichte oder Hinweis. Tage außerhalb der Woche bleiben leer.
function mensaBodyHTML(day, center) {
  const w = mensaWeek();
  if (day < w.mon || day > w.fri) return "";
  const cached = mensaCache()[day] || null;
  // Liefert der Speiseplan für diesen Tag nichts, wird kein anderer Tag angezeigt
  const offDay = !!(cached && cached.datum && cached.datum !== day);
  const fresh = offDay ? null : cached;
  const notice = center && mensaRefreshing ? `<div class="muted" style="font-size:12px;margin-bottom:6px">Aktualisiere … das kann bis zu einer Minute dauern</div>` : "";
  let body;
  if (offDay) {
    body = `<div class="muted">Keine Daten verfügbar.</div>`;
  } else if (fresh && fresh.gerichte && fresh.gerichte.length) {
    const shown = ui.mensaNoMeat ? fresh.gerichte.filter((g) => !(g.tags || []).some((t) => MENSA_MEAT_TAGS.includes(t))) : fresh.gerichte;
    body = (shown.length ? shown : fresh.gerichte).map((g) =>
      `<div class="mensa-row" style="border-left:4px solid ${mensaColor(g)};padding-left:8px"><span class="muted">${esc(g.label)}</span><span><b>${esc(g.name)}</b><span style="margin-left:6px">${mensaIcons(g)}</span>${g.allergene ? `<div class="muted" style="font-size:12px">Allergene: ${esc(g.allergene)}</div>` : ""}</span><span class="mensa-price">${esc(g.preis.stud)}</span></div>`
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
  return notice + body;
}
function mensaCardHTML() {
  const target = mensaTarget();
  const w = mensaWeek();
  // Drei Tage (davor, heute, danach) sind schon gebaut; nur der mittlere ist sichtbar hoch
  const pages = [-1, 0, 1].map((k) => {
    const day = iso(addDays(parseIso(target), k));
    return `<div class="mensa-page${k === 0 ? " is-center" : ""}">${mensaBodyHTML(day, k === 0)}</div>`;
  }).join("");
  mensaPrefetchNeighbors(target);
  return `<div class="card mensa-card" id="focus-mensa">
    <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:6px">
      <div class="mensa-title">${mensaTitleHTML(target)}</div>
      <span class="row" style="gap:6px">
        <button class="btn ghost" data-act="mensanav" data-v="-1" title="Tag zurück" ${target <= w.mon ? "disabled style=\"opacity:.35\"" : ""}>‹</button>
        <button class="btn ghost" data-act="mensanav" data-v="0" title="Zu heute">Heute</button>
        <button class="btn ghost" data-act="mensanav" data-v="1" title="Tag vor" ${target >= w.fri ? "disabled style=\"opacity:.35\"" : ""}>›</button>
        <a class="btn ghost lay-keep" href="https://werkswelt.de/?id=mohm" target="_blank" rel="noopener" title="Speiseplan auf der Website öffnen">${ICON.external}</a>
        <button class="btn ghost menu-btn" data-act="mensareload" title="Neu laden">${ICON.reload}</button>
      </span>
    </div>
    <div class="mensa-track" style="margin-top:10px"><div class="mensa-pages">${pages}</div></div>
  </div>`;
}
// Nachbartage im Hintergrund holen, damit beim Wischen schon Speisen da sind (höchstens alle 10 Minuten je Tag)
const mensaPrefetchAt = new Map();
function mensaPrefetchNeighbors(target) {
  const w = mensaWeek();
  for (const k of [-1, 1]) {
    const day = iso(addDays(parseIso(target), k));
    if (day < w.mon || day > w.fri || Date.now() - (mensaPrefetchAt.get(day) || 0) < 600000) continue;
    const c = mensaCache()[day];
    const complete = !!c && Array.isArray(c.gerichte) && c.gerichte.length > 0 && c.gerichte.every((g) => Array.isArray(g.bilder));
    if (complete || !cloudConfigured()) continue;
    mensaPrefetchAt.set(day, Date.now());
    fetch(SUPABASE_URL + "/functions/v1/mensa?tag=" + day, {
      headers: { Authorization: "Bearer " + ((session && session.access_token) || SUPABASE_ANON_KEY), apikey: SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(25000),
    }).then((r) => r.json()).then((data) => {
      if (!data || !Array.isArray(data.gerichte)) return;
      const cc = mensaCache();
      cc[day] = data;
      const keep = {};
      Object.keys(cc).sort().slice(-10).forEach((x) => { keep[x] = cc[x]; });
      localStorage.setItem(MENSA_LS, JSON.stringify(keep));
    }).catch(() => {});
  }
}
async function loadMensa(force) {
  const target = mensaTarget();
  // Gespeicherte Tage ohne Symbol-Bilder (ältere Version) werden einmal neu geholt
  const cachedDay = mensaCache()[target];
  // Leere Tage (noch kein Plan, als die Seite abgefragt wurde) gelten nicht als vollständig und werden erneut geholt
  const complete = !!cachedDay && Array.isArray(cachedDay.gerichte) && cachedDay.gerichte.length > 0 && cachedDay.gerichte.every((g) => Array.isArray(g.bilder));
  if (!force && ((cachedDay && complete) || mensaTried === target)) return;
  if (!cloudConfigured()) return;
  // Neu laden hat Vorrang: läuft gerade ein Abruf, wird er nicht stillschweigend verworfen
  if (mensaBusy && !force) return;
  mensaBusy = true;
  mensaRefreshing = true;
  mensaTried = target;
  if (ui.tab === "dashboard") render();
  try {
    const r = await fetch(SUPABASE_URL + "/functions/v1/mensa?tag=" + target + (force ? "&live=1" : ""), {
      headers: { Authorization: "Bearer " + ((session && session.access_token) || SUPABASE_ANON_KEY), apikey: SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(force ? 60000 : 25000),
    });
    const data = await r.json();
    if (data && Array.isArray(data.gerichte)) {
      mensaErr = false;
      const c = mensaCache();
      c[target] = data;
      const keep = {};
      Object.keys(c).sort().slice(-10).forEach((k) => { keep[k] = c[k]; });
      localStorage.setItem(MENSA_LS, JSON.stringify(keep));
    }
  } catch {
    // Hatte der Tag schon Daten, bleiben sie stehen
    if (!cachedDay) mensaErr = true;
    else showToast("Aktualisieren hat nicht geklappt, der alte Stand bleibt");
  } finally {
    mensaBusy = false;
    mensaRefreshing = false;
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
      <div class="modal-foot">
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

