// Klicks, Eingaben und Formulare, Backup
// Teil von app.js (aufgeteilt). Reihenfolge der Dateien in index.html beachten.
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
      else if (el.dataset.mode === "series") {
        // Alle späteren Termine um dieselbe Anzahl Tage verschieben und auf die neue Uhrzeit setzen
        const shift = Math.round((parseIso(date) - parseIso(ev.date)) / 86400000);
        seriesOf(ev).forEach((x) => { x.date = iso(addDays(parseIso(x.date), shift)); x.start = start; x.end = start + dur; });
        Object.assign(ev, { date, start, end: start + dur });
      } else Object.assign(ev, { date, start, end: start + dur });
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
    case "evcancel": openCancelRange(id); break;
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
    case "mon": calGo(Number(el.dataset.v)); break;
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
    case "calweek": calGo(Number(el.dataset.v)); break;
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
    case "kichat": kiChatOpen(); break;
    case "kichatopt": kiChatSend(el.dataset.text); break;
    case "kichatanlegen": await kiChatAnlegen(el.dataset.id); break;
    case "kichatclear": await kiChatClear(); break;
    case "kichatedit": kiChatEdit(el.dataset.id); break;
    case "kichatkal": kiChatKal(el.dataset.id); break;
    case "kichatretry": await kiChatRetry(el.dataset.id); break;
    case "kichatdrop": await kiChatDrop(el.dataset.id); break;
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
    case "geraetabmelden": await geraetAbmelden(el.dataset.id); break;
    case "geraeteneu": geraeteData = null; geraeteErr = ""; render(); break;
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

// KI-Knopf in der oberen Leiste: auf allen Seiten außer Einstellungen, nur wenn angemeldet
function kiFabSync() {
  const b = document.getElementById("kiTop");
  if (!b) return;
  if (!b.dataset.ready) { b.innerHTML = ICON.spark; b.dataset.ready = "1"; }
  b.hidden = ui.tab === "einstellungen" || !session;
  const last = kiLastAnswer();
  b.classList.toggle("has-unread", !!last && String(last.id) !== kiReadGet());
}

// KI-Chat: Verlauf in der Tabelle ki_chat (nur eigene Zeilen), die Antworten kommen von der Funktion ki-chat
let kiChatMsgs = [];
let kiServerMsgs = [];
let kiLastPaint = "";
let kiChatBusy = false;
const KI_ART_LABEL = { todo: "To-Do", abgabe: "Abgabe", klausur: "Klausur", erinnerung: "Erinnerung" };
const KI_REP_LABEL = { einmal: "einmalig", woechentlich: "jede Woche", gerade_kw: "gerade KW", ungerade_kw: "ungerade KW" };
const kiDateLabel = (s) => (s ? parseIso(s).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }) : "ohne Datum");
function kiChatHTML() {
  return `<h3>KI-Chat</h3>
    <div id="kiChatBox" style="max-height:55vh;overflow:auto;display:flex;flex-direction:column;gap:8px;margin-bottom:10px"></div>
    <form data-form="kichat" class="row" style="gap:8px">
      <textarea name="text" required rows="2" maxlength="500" placeholder="z. B. Was ist heute fällig?" style="flex:1"></textarea>
      <button class="btn" id="kiChatSendBtn">Senden</button>
    </form>
    <div style="text-align:right;margin-top:8px"><button type="button" class="btn ghost btn-sm" data-act="kichatclear">Verlauf löschen</button></div>`;
}
function kiChatPaint() {
  const box = document.getElementById("kiChatBox");
  if (!box) return;
  if (!session) { box.innerHTML = `<div class="muted">Zum Chatten bitte anmelden.</div>`; return; }
  let html = kiChatMsgs.length ? "" : `<div class="muted">Frag z. B. „Was ist heute fällig?“ oder sag „Erinnere mich jeden Montag um 8 Uhr an Wäsche“.</div>`;
  const letzte = [...kiChatMsgs].reverse().find((m) => m.rolle !== "user");
  for (const m of kiChatMsgs) {
    const user = m.rolle === "user";
    html += `<div style="align-self:${user ? "flex-end" : "flex-start"};max-width:85%;padding:8px 12px;border-radius:12px;background:${user ? "#2563eb" : "rgba(127,127,127,.15)"};color:${user ? "#fff" : "inherit"};white-space:pre-line;line-height:1.45">${esc(m.text)}${m.unsent ? `<div style="font-size:12px;opacity:.85;margin-top:4px">Nicht gesendet${m.fehler ? ": " + esc(m.fehler) : ""}</div>` : ""}</div>`;
    if (m.unsent) html += `<div class="row" style="justify-content:flex-end;gap:6px"><button type="button" class="btn ghost btn-sm" data-act="kichatretry" data-id="${esc(m.id)}">↻ Erneut senden</button><button type="button" class="btn ghost btn-sm" data-act="kichatdrop" data-id="${esc(m.id)}">Verwerfen</button></div>`;
    if (!user && m === letzte && m.optionen?.length && !kiChatBusy) {
      html += `<div class="row" style="flex-wrap:wrap;gap:6px">${m.optionen.map((o) => `<button type="button" class="btn ghost btn-sm" data-act="kichatopt" data-text="${esc(o)}">${esc(o)}</button>`).join("")}</div>`;
    }
    const v = m.vorschlag;
    if (!user && v && !v.erledigt) {
      const wann = [kiDateLabel(v.datum), v.uhrzeit ? "um " + v.uhrzeit + " Uhr" : ""].filter(Boolean).join(" ");
      const aendern = v.typ === "erledigt" || v.typ === "verschieben";
      const rep = !aendern && v.art === "erinnerung" ? " · " + (KI_REP_LABEL[v.wiederholung] || "einmalig") : "";
      const kopf = v.typ === "erledigt" ? "Als erledigt markieren" : v.typ === "verschieben" ? "Verschieben" : KI_ART_LABEL[v.art] || "Aufgabe";
      const titel = aendern ? v.ziel_titel : v.titel;
      const zeile = v.typ === "erledigt" ? "" : (v.typ === "verschieben" && !v.datum && !v.uhrzeit ? "" : wann);
      html += `<div class="card" style="align-self:stretch;padding:10px">
        <div class="muted" style="font-size:12px">${esc(kopf)}</div>
        <b>${esc(titel)}</b>
        <div class="muted" style="font-size:13px">${esc(zeile)}${esc(rep)}</div>
        <div class="row" style="gap:6px;margin-top:6px">${aendern ? "" : `<button type="button" class="btn ghost btn-sm" data-act="kichatedit" data-id="${esc(m.id)}">Bearbeiten</button>`}<button type="button" class="btn btn-sm" data-act="kichatanlegen" data-id="${esc(m.id)}">${aendern ? "Ausführen" : "Anlegen"}</button></div>
      </div>`;
    }
    if (!user && v && v.erledigt && v.ziel_datum) {
      html += `<div><button type="button" class="btn ghost btn-sm" data-act="kichatkal" data-id="${esc(m.id)}">Im Kalender zeigen</button></div>`;
    }
  }
  if (kiChatBusy) html += `<div class="muted">KI denkt nach …</div>`;
  box.innerHTML = html;
  box.scrollTop = box.scrollHeight;
  const btn = document.getElementById("kiChatSendBtn");
  if (btn) btn.disabled = kiChatBusy;
}
async function kiChatLoad() {
  if (sb && session) {
    const { data, error } = await sb.from("ki_chat").select("id, rolle, text, optionen, vorschlag").eq("user_id", session.user.id).order("erstellt", { ascending: true }).order("id", { ascending: true }).limit(200);
    if (!error) kiServerMsgs = data || [];
  }
  // Erste Nutzung auf diesem Gerät: vorhandene Antworten gelten als gelesen
  if (!kiReadGet() && kiLastAnswer()) kiMarkRead();
  kiChatMsgs = [...kiServerMsgs, ...kiUnsentGet().map((u) => ({ id: u.id, rolle: "user", text: u.text, fehler: u.fehler, unsent: true }))];
  const sig = JSON.stringify(kiChatMsgs);
  if (sig !== kiLastPaint) { kiLastPaint = sig; kiChatPaint(); }
  kiFabSync();
}
function kiChatOpen() {
  openModal(kiChatHTML());
  kiLastPaint = "";
  kiChatPaint();
  kiChatLoad().then(kiMarkRead);
  setTimeout(() => document.querySelector('form[data-form="kichat"] textarea')?.focus(), 50);
}
async function kiChatSend(text) {
  text = String(text || "").trim();
  if (!text || kiChatBusy) return;
  if (!session) { showToast("Zum Chatten bitte anmelden"); return; }
  kiChatBusy = true;
  kiChatMsgs = [...kiChatMsgs, { id: "tmp", rolle: "user", text }];
  kiChatPaint();
  let fehler = "";
  try {
    const r = await fetch(SUPABASE_URL + "/functions/v1/ki-chat", {
      method: "POST",
      headers: { Authorization: "Bearer " + session.access_token, apikey: SUPABASE_ANON_KEY, "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(60000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.fehler) {
      fehler = j.fehler === "kein-key" ? "Erst einen Gemini-Key im KI-Assistenten eintragen" : "KI gerade nicht erreichbar";
      showToast(fehler);
    }
  } catch (_) { fehler = "KI gerade nicht erreichbar"; showToast(fehler); }
  kiChatBusy = false;
  // Schlägt das Senden fehl, bleibt die Nachricht als „nicht gesendet“ stehen (auch nach Neustart der App)
  if (fehler) kiUnsentSet([...kiUnsentGet(), { id: "u" + Date.now(), text, fehler }]);
  await kiChatLoad();
}
function kiUnsentGet() { try { return JSON.parse(localStorage.getItem("studienplaner-ki-unsent") || "[]"); } catch (_) { return []; } }
function kiUnsentSet(a) { try { localStorage.setItem("studienplaner-ki-unsent", JSON.stringify(a)); } catch (_) {} }
function kiReadGet() { try { return localStorage.getItem("studienplaner-ki-gelesen") || ""; } catch (_) { return ""; } }
function kiLastAnswer() { return [...kiServerMsgs].reverse().find((m) => m.rolle !== "user"); }
function kiMarkRead() {
  const last = kiLastAnswer();
  try { if (last) localStorage.setItem("studienplaner-ki-gelesen", String(last.id)); } catch (_) {}
  kiFabSync();
}
async function kiChatRetry(id) {
  if (kiChatBusy) { showToast("Bitte kurz warten, die KI antwortet noch"); return; }
  const list = kiUnsentGet();
  const u = list.find((x) => x.id === id);
  if (!u) return;
  kiUnsentSet(list.filter((x) => x.id !== id));
  await kiChatSend(u.text);
}
async function kiChatDrop(id) {
  kiUnsentSet(kiUnsentGet().filter((x) => x.id !== id));
  await kiChatLoad();
}
function kiChatKal(id) {
  const m = kiChatMsgs.find((x) => String(x.id) === String(id));
  const d = m && m.vorschlag && m.vorschlag.ziel_datum;
  if (!d) return;
  clearModalQuiet();
  ui.tab = "kalender";
  ui.selDate = d;
  ui.dayPop = d;
  render();
}
function kiChatEdit(id) {
  const m = kiChatMsgs.find((x) => String(x.id) === String(id));
  const v = m && m.vorschlag;
  if (!v || v.erledigt || v.typ !== "anlegen") return;
  openModal(`<h3>Vorschlag bearbeiten</h3>
    <form data-form="kichatedit" data-id="${esc(m.id)}">
      <label class="muted">Art</label>
      <select name="art">${Object.keys(KI_ART_LABEL).map((k) => `<option value="${k}"${k === v.art ? " selected" : ""}>${KI_ART_LABEL[k]}</option>`).join("")}</select>
      <label class="muted" style="margin-top:8px">Titel</label>
      <input name="titel" required value="${esc(v.titel)}">
      <div class="grid2" style="margin-top:8px">
        <div><label class="muted">Datum</label><input type="date" name="datum" value="${esc(v.datum || "")}"></div>
        <div><label class="muted">Uhrzeit</label><input type="time" name="uhrzeit" value="${esc(v.uhrzeit || "")}"></div>
      </div>
      <label class="muted" style="margin-top:8px">Wiederholung (nur Erinnerungen)</label>
      <select name="wiederholung">${Object.keys(KI_REP_LABEL).map((k) => `<option value="${k}"${k === (v.wiederholung || "einmal") ? " selected" : ""}>${KI_REP_LABEL[k]}</option>`).join("")}</select>
      <div class="modal-foot">
        <button type="button" class="btn ghost" data-act="mclose">Abbrechen</button>
        <button class="btn">Speichern</button>
      </div>
    </form>`);
}
async function kiChatAnlegen(id) {
  const m = kiChatMsgs.find((x) => String(x.id) === String(id));
  const v = m && m.vorschlag;
  if (!v || v.erledigt) return;
  let ziel = {};
  // Bestehende Aufgabe abhaken oder verschieben
  if (v.typ === "erledigt" || v.typ === "verschieben") {
    const t = state.todos.find((x) => x.id === v.ziel_id);
    if (!t || t.done) { showToast("Die Aufgabe gibt es nicht mehr"); return; }
    if (v.typ === "erledigt") { t.done = true; t.doneAt = iso(new Date()); }
    else { if (v.datum) t.date = v.datum; if (v.uhrzeit) t.time = v.uhrzeit; }
    await sb.from("ki_chat").update({ vorschlag: { ...v, erledigt: true } }).eq("id", m.id);
    commit();
    showToast("✓ Geändert");
    await kiChatLoad();
    return;
  }
  if (v.art === "erinnerung") {
    const rep = v.wiederholung || "einmal";
    const c = { id: uid(), on: true, title: v.titel, body: "", time: v.uhrzeit || "08:00" };
    if (rep === "einmal" && v.datum) c.date = v.datum;
    else {
      if (!v.datum) { showToast("Bitte ein Datum nennen"); return; }
      c.days = [parseIso(v.datum).getDay()];
      if (rep === "gerade_kw") c.kw = "even";
      if (rep === "ungerade_kw") c.kw = "odd";
    }
    customList().push(c);
  } else {
    const tid = uid();
    state.todos.push({ id: tid, title: v.titel, type: v.art === "abgabe" || v.art === "klausur" ? v.art : "todo", priority: "mittel", date: v.datum || iso(new Date()), time: v.uhrzeit || "", duration: DEFAULT_DURATION, done: false });
    ziel = { ziel_id: tid, ziel_datum: v.datum || iso(new Date()) };
  }
  await sb.from("ki_chat").update({ vorschlag: { ...v, erledigt: true, ...ziel } }).eq("id", m.id);
  commit();
  showToast("✓ Angelegt");
  await kiChatLoad();
}
async function kiChatClear() {
  if (!session) return;
  if (!(await appConfirm("Den ganzen KI-Chat-Verlauf löschen?", "Löschen"))) return;
  await sb.from("ki_chat").delete().eq("user_id", session.user.id);
  kiChatMsgs = [];
  showToast("Verlauf gelöscht");
}

document.addEventListener("submit", async (e) => {
  const f = e.target;
  if (!f.dataset.form) return;
  e.preventDefault();
  const data = Object.fromEntries(new FormData(f));

  if (f.dataset.form === "kichat") {
    const t = String(data.text || "").trim();
    f.reset();
    await kiChatSend(t);
    return;
  }
  if (f.dataset.form === "kichatedit") {
    const m = kiChatMsgs.find((x) => String(x.id) === String(f.dataset.id));
    const v = m && m.vorschlag;
    const titel = String(data.titel || "").trim();
    if (!v || v.erledigt || !titel || !session) return;
    const neu = { ...v, art: data.art || v.art, titel, datum: data.datum || "", uhrzeit: data.uhrzeit || "", wiederholung: data.wiederholung || "einmal" };
    await sb.from("ki_chat").update({ vorschlag: neu }).eq("id", m.id);
    kiChatOpen();
    return;
  }
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
    case "cancelrange": {
      const ev = state.events.find((x) => x.id === f.dataset.id);
      if (!ev) break;
      let von = data.von || ev.date;
      let bis = data.bis || von;
      if (bis < von) [von, bis] = [bis, von];
      const wd = parseIso(ev.date).getDay();
      const cancel = data.mode !== "restore";
      state.events.forEach((x) => {
        if (x.name !== ev.name || x.start !== ev.start || x.end !== ev.end) return;
        if (x.date < von || x.date > bis) return;
        if (parseIso(x.date).getDay() !== wd) return;
        x.cancelled = cancel;
      });
      closeModal(); commit(); break;
    }
    case "evedit": {
      const ev = state.events.find((x) => x.id === f.dataset.id);
      if (!ev) break;
      const start = toMin(data.start);
      const end = toMin(data.end);
      if (!(end > start)) { appAlert("Das Ende muss nach dem Beginn liegen."); break; }
      const old = ev.name;
      const oldDate = ev.date, oldStart = ev.start, oldEnd = ev.end;
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
      // Auf Wunsch auch alle späteren Termine derselben Stunde (gleicher Wochentag, gleiche Uhrzeit)
      if (data.scope === "future") {
        const wd = new Date(oldDate + "T12:00:00Z").getUTCDay();
        state.events.forEach((x) => {
          if (x === ev || x.name !== nw || x.start !== oldStart || x.end !== oldEnd || x.date <= oldDate) return;
          if (new Date(x.date + "T12:00:00Z").getUTCDay() !== wd) return;
          x.room = ev.room;
          x.start = start;
          x.end = end;
        });
      }
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
    <div class="modal-foot">
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
    <div class="modal-foot">
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

// KI-Chat: Verlauf aktualisieren, wenn die App wieder sichtbar wird und regelmäßig (Sync zwischen Geräten)
document.addEventListener("visibilitychange", () => { if (!document.hidden && session) kiChatLoad(); });
setInterval(() => { if (!document.hidden && session) kiChatLoad(); }, 60000);
