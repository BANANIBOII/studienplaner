// Langes Drücken und Wischen, Vorausladen, Kalender-Seiten, Schnellmenü
// Teil von app.js (aufgeteilt). Reihenfolge der Dateien in index.html beachten.
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

// Wischen in Kalender und Mensa wie im Stundenplan: die Seiten davor, aktuell und danach sind schon gebaut.
// Beim Wischen gleitet die Gruppe mit dem Finger; beim Loslassen rutscht sie weiter, und danach wird die neue Mitte gezeichnet.
let pager = null, pagerBusy = false;
const PAGER_KIND = {
  cal: { pages: ".cal-pages", canGo: () => true, go: (dir) => calGo(dir) },
  mensa: { pages: ".mensa-pages", canGo: (dir) => mensaCanGo(dir), go: (dir) => mensaGo(dir) },
};
function pagerAnimate(pages, target, after) {
  pages.style.transition = "transform .3s cubic-bezier(.2, .8, .2, 1)";
  pages.style.transform = target;
  setTimeout(after, 310);
}
function pagerReset(s) {
  if (s && s.pages) { s.pages.style.transition = ""; s.pages.style.transform = ""; }
}
document.addEventListener("touchstart", (e) => {
  pager = null;
  if (e.touches.length !== 1 || pagerBusy || ui.layEdit || document.querySelector(".modal")) return;
  const host = e.target.closest ? e.target.closest(".cal-track, .mensa-track") : null;
  if (!host) return;
  const kind = host.classList.contains("cal-track") ? "cal" : "mensa";
  pager = { kind, host, pages: host.querySelector(PAGER_KIND[kind].pages), x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), dx: 0, mode: null };
}, { passive: true });
document.addEventListener("touchmove", (e) => {
  const s = pager;
  if (!s) return;
  // Halten (zum Verschieben eines To-Dos) oder zweiter Finger: kein Wischen
  if (e.touches.length !== 1 || longFired || drag) { pagerReset(s); pager = null; return; }
  const dx = e.touches[0].clientX - s.x;
  const dy = e.touches[0].clientY - s.y;
  if (!s.mode) {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    if (Math.abs(dx) < 1.3 * Math.abs(dy)) { pager = null; return; }   // senkrecht: normal scrollen
    s.mode = "h";
  }
  if (e.cancelable) e.preventDefault();
  s.dx = dx;
  s.pages.style.transition = "none";
  s.pages.style.transform = `translateX(calc(-33.3333% + ${dx}px))`;
}, { passive: false });
document.addEventListener("touchend", () => {
  const s = pager;
  pager = null;
  if (!s) return;
  if (s.mode !== "h" || longFired) { pagerReset(s); return; }
  const W = s.host.offsetWidth || 1;
  const quick = Date.now() - s.t < 300 && Math.abs(s.dx) > 30;
  const commit = Math.abs(s.dx) > W * 0.2 || quick;
  const dir = s.dx < 0 ? 1 : -1;   // nach links = nächster Monat/Tag
  const cfg = PAGER_KIND[s.kind];
  if (commit && cfg.canGo(dir)) { cfg.go(dir); return; }
  // Zu wenig gewischt (oder Wochenende-Grenze): zurück in die Mitte
  s.pages.style.transition = "transform .22s cubic-bezier(.2, .8, .2, 1)";
  s.pages.style.transform = "";
  setTimeout(() => { if (s.pages.isConnected) s.pages.style.transition = ""; }, 240);
}, { passive: true });
document.addEventListener("touchcancel", () => { pagerReset(pager); pager = null; }, { passive: true });

// ---------- Kalender: Seiten und Wechsel ----------
// Anfang der Seite pg: Woche (eingeklappt) bzw. Monatsraster (aufgeklappt)
function calPageStart(pg, m, fold, anchor) {
  return fold ? mondayOf(addDays(anchor, 7 * pg)) : mondayOf(new Date(m.getFullYear(), m.getMonth() + pg, 1));
}
// Titel der Seite pg (0 = aktuell)
function calTitleAt(pg, m, fold, anchor) {
  if (fold) {
    const g = calPageStart(pg, m, true, anchor);
    const e = addDays(g, 6);
    return `${g.getDate()}. ${MONTHS[g.getMonth()].slice(0, 3)} – ${e.getDate()}. ${MONTHS[e.getMonth()].slice(0, 3)} ${e.getFullYear()}`;
  }
  const x = new Date(m.getFullYear(), m.getMonth() + pg, 1);
  return `${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
}
// Pfeile und Wischen: die Seite gleitet, der Titel wechselt sofort, danach wird die neue Mitte gezeichnet
function calGo(dir) {
  if (pagerBusy) return;
  pagerBusy = true;
  const cal = calSet();
  const anchor = cal.fold ? parseIso(ui.selDate || iso(new Date())) : null;
  const title = document.querySelector(".calTitle");
  if (title) title.textContent = calTitleAt(dir, ui.month, !!cal.fold, anchor);
  const pages = document.querySelector(".cal-pages");
  const after = () => { pagerBusy = false; calStep(dir); };
  if (!pages) return after();
  pagerAnimate(pages, dir > 0 ? "translateX(-66.6667%)" : "translateX(0%)", after);
}
function calStep(dir) {
  if (calSet().fold) {
    const d = addDays(parseIso(ui.selDate || iso(new Date())), 7 * dir);
    ui.selDate = iso(d);
    ui.month = new Date(d.getFullYear(), d.getMonth(), 1);
  } else {
    ui.month = new Date(ui.month.getFullYear(), ui.month.getMonth() + dir, 1);
  }
  ui.anim = null;
  render();
}

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
  if (e.touches.length !== 1 || (swipe && swipe.mode === "h") || (pager && pager.mode === "h") || pinch) { band.el.style.transform = ""; band = null; return; }
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

