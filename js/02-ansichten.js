// Dashboard, Suche, Protokoll-Export, Stundenplan, Kalender, Vorlesungs-Protokolle
// Teil von app.js (aufgeteilt). Reihenfolge der Dateien in index.html beachten.
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

// Dashboard: laufende oder nächste Vorlesung heute mit Raum, Restzeit und Notiz-Knopf
function nowLectureHTML(now) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const evs = state.events
    .filter((e) => e.date === iso(now) && !e.cancelled && e.end != null)
    .sort((a, b) => a.start - b.start);
  const running = evs.find((e) => e.start <= nowMin && nowMin < e.end);
  const next = running ? null : evs.find((e) => e.start > nowMin);
  const ev = running || next;
  if (!ev) return "";
  const min = running ? ev.end - nowMin : ev.start - nowMin;
  const restTxt = running ? `noch ${min} Min` : `in ${min} Min`;
  return `<div class="card now-card">
    <div class="now-info">
      <span class="muted">${running ? "Läuft jetzt" : "Als Nächstes"} · ${restTxt}</span>
      <b>${esc(ev.name)}</b>
      <span class="muted">${fmtMin(ev.start)}–${fmtMin(ev.end)}${ev.room ? " · " + esc(ev.room) : ""}</span>
    </div>
    <button class="btn" data-act="evnote" data-id="${ev.id}">Notiz</button>
  </div>`;
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
      ${iso(dashDay(now)) === iso(now) ? tomorrowHTML() : ""}
    </div>`;
  const todoCard = `<div class="card todo-compact">
        <h3>Anstehende To-Dos · diese Woche</h3>
        <form data-form="quicktodo" class="row quick-row">
          <input name="title" required placeholder="Neue Aufgabe …" style="flex:1">
          <input type="date" name="date" value="${iso(new Date())}">
          <button class="btn">+</button>
        </form>
        ${open.length ? open.slice(0, 5).map(todoItem).join("") : `<div class="empty"><div class="ei">${ICON.spark}</div>Diese Woche ist nichts offen.</div>`}
        ${open.length > 8 ? `<div class="muted" style="margin-top:10px">… und ${open.length - 8} weitere im Kalender.</div>` : ""}
      </div>`;
  const countCard = countdownBlock();
  const linksCard = linksFlow();
  const mensaCard = mensaCardHTML();
  const nextCard = nextDeadlineCard();
  const rueckCard = rueckblickCard();
  const nowCard = nowLectureHTML(now);
  const flow = `${nowCard ? `<div style="margin-bottom:18px">${nowCard}</div>` : ""}<div style="margin-bottom:18px">${nextCard}</div><div class="dash-main">${planCard}<div class="dash-side">${todoCard}${countCard}</div></div><div style="margin-top:18px">${mensaCard}</div><div style="margin-top:18px">${rueckCard}</div><div style="margin-top:18px">${linksCard}</div>`;
  h += searchBtnHTML() + laid("dash", [
    { id: "now", w: 12, h: 4, html: nowCard },
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
// Die späteren Termine derselben Stunde: gleicher Name, gleiche Uhrzeit, gleicher Wochentag
function seriesOf(ev) {
  const wd = parseIso(ev.date).getDay();
  return state.events.filter((x) => x !== ev && x.name === ev.name && x.start === ev.start && x.end === ev.end
    && x.date > ev.date && parseIso(x.date).getDay() === wd);
}

function openEventDrop(id, date, min) {
  const ev = state.events.find((x) => x.id === id);
  if (!ev) return;
  const [y, m, d] = date.split("-");
  const btn = (mode, label, cls) => `<button class="btn ${cls}" data-act="evdrop" data-mode="${mode}" data-id="${id}" data-d="${date}" data-min="${min}">${label}</button>`;
  const later = seriesOf(ev).length;
  openModal(`
    <h3>${esc(ev.name)}</h3>
    <p class="muted">Auf ${d}.${m}.${y} · ${fmtMin(min)} Uhr</p>
    <div class="menu-list">
      ${btn("move", "Nur diesen Termin verschieben", "")}
      ${later ? btn("series", `Diesen und alle ${later} späteren Termine verschieben`, "") : ""}
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
    <div class="modal-foot">
      <button type="button" class="btn ghost" data-act="mclose">Schließen</button>
      <button type="button" class="btn ghost" data-act="evnote" data-id="${ev.id}">Notizen</button>
      <button type="button" class="btn ghost" data-act="evcancel" data-id="${ev.id}">Ausfall</button>
      <button type="button" class="btn" data-act="evopen" data-id="${ev.id}">Bearbeiten</button>
    </div>`);
}

// Ausfall für einen Zeitraum: gilt für alle Termine derselben Vorlesung (gleicher Wochentag, gleiche Uhrzeit)
function openCancelRange(id) {
  const ev = state.events.find((x) => x.id === id);
  if (!ev) return;
  const bisDefault = iso(addDays(parseIso(ev.date), 14));
  openModal(`
    <h3>Ausfall eintragen</h3>
    <p class="muted">${esc(ev.name)} · ${fmtMin(ev.start)}–${fmtMin(ev.end)}</p>
    <form data-form="cancelrange" data-id="${ev.id}">
      <label class="muted">Aktion</label>
      <select name="mode">
        <option value="cancel">Fällt aus</option>
        <option value="restore">Findet wieder statt</option>
      </select>
      <div class="grid2" style="margin-top:10px">
        <div><label class="muted">Von</label><input type="date" name="von" required value="${ev.date}"></div>
        <div><label class="muted">Bis</label><input type="date" name="bis" required value="${bisDefault}"></div>
      </div>
      <p class="muted" style="font-size:13px">Gilt für alle Termine dieser Vorlesung im Zeitraum (gleicher Wochentag und Uhrzeit).</p>
      <label class="muted" style="margin-top:8px">Ersatztermin (optional, nur bei „Fällt aus“)</label>
      <div class="grid2">
        <div><input type="date" name="ersatz_datum"></div>
        <div><input type="time" name="ersatz_uhrzeit"></div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn ghost" data-act="mclose">Abbrechen</button>
        <button class="btn">Übernehmen</button>
      </div>
    </form>`);
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
      <label class="muted">Raum oder Uhrzeit ändern für</label>
      <select name="scope">
        <option value="one">Nur diesen Termin</option>
        <option value="future">Diesen und alle folgenden (gleicher Wochentag und Uhrzeit)</option>
      </select>
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
  const anchor = fold ? parseIso(ui.selDate || today) : null;
  const monthTitle = calTitleAt(0, m, fold, anchor);
  const animCls = ui.anim === "fold" || ui.anim === "week" ? " anim-fold" : "";
  // Seite pg: 0 = aktuell, -1 = davor, 1 = danach. Alle drei sind schon gebaut, damit das Wischen nahtlos ist
  const calCells = (pg) => {
  const grid0 = calPageStart(pg, m, fold, anchor);
  const pm = fold ? m : new Date(m.getFullYear(), m.getMonth() + pg, 1);
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
    const cls = ["mday", `style-${cal.style}`, d.getMonth() !== pm.getMonth() ? "other" : "", k === today ? "today" : "", k === ui.selDate ? "sel" : "", spans0.length ? "has-span" : "", brk ? "is-break" : ""].join(" ");
    const dots = state.events.filter((e) => e.date === k && !e.cancelled).slice(0, 3)
      .map((e) => `<i style="background:${(state.modules[e.name] || {}).color || "var(--accent)"}"></i>`).join("");
    cells += `<div class="${cls}" data-act="sel" data-d="${k}"${brk ? ` title="${esc(brk.name || "Vorlesungsfrei")}"` : ""} style="--i:${i};${border}">${calCellInner(cal.style, d, dayT, evCount)}${overlays}${dots ? `<span class="mdots">${dots}</span>` : ""}</div>`;
  }
  return `<div class="month${pg === 0 ? animCls : ""}" data-page="${pg}">${cells}</div>`;
  };
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
    <div class="cal-track"><div class="cal-pages">${calCells(-1)}${calCells(0)}${calCells(1)}</div></div>
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
    <div class="modal-foot"><button class="btn ghost" data-act="mclose">Schließen</button></div>
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

