// Offline-Unterstützung: lädt immer aus dem Netz, nutzt den Cache nur wenn offline.
const CACHE = "studienplaner-v42";
const FILES = ["./", "index.html", "styles.css", "features.css", "js/01-kern.js", "js/02-ansichten.js", "js/03-einstellungen.js", "js/04-gesten-kalender.js", "js/05-klicks-backup.js", "js/06-cloud-start.js", "config.js", "manifest.json", "icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

// Alte Caches (frühere Versionen) entfernen
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Vibration und Ton pro Gerät: die App legt die Einstellung in IndexedDB ab (localStorage kann der Service Worker nicht lesen)
const VIB_PATTERN = { kurz: [200], lang: [500, 200, 500, 200, 500], aus: [] };
function readNfPrefs() {
  // Mit Zeitlimit: wenn IndexedDB nicht antwortet, wird die Erinnerung trotzdem angezeigt (ohne Einstellungen)
  const read = new Promise((resolve) => {
    try {
      const req = indexedDB.open("studienplaner-device", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("kv");
      req.onerror = () => resolve({});
      req.onblocked = () => resolve({});
      req.onsuccess = () => {
        const db = req.result;
        try {
          const get = db.transaction("kv").objectStore("kv").get("nfDev");
          get.onsuccess = () => { db.close(); resolve(get.result || {}); };
          get.onerror = () => { db.close(); resolve({}); };
        } catch (_) { db.close(); resolve({}); }
      };
    } catch (_) { resolve({}); }
  });
  const limit = new Promise((resolve) => setTimeout(() => resolve({}), 1500));
  return Promise.race([read, limit]);
}

// Push vom Server: zeigt die Erinnerung an
self.addEventListener("push", (e) => {
  let data = { title: "Studienplaner", body: "" };
  try { data = { ...data, ...e.data.json() }; } catch (_) {}
  // „Notiz schreiben“ nur bei Modul-Erinnerungen
  const actions = data.noteUrl ? [{ action: "note", title: "Notiz schreiben" }] : [];
  // „Erledigt“: hakt die Aufgabe im Hintergrund ab (signierter Link). Ohne Link öffnet es die App.
  if (data.todoId) actions.push({ action: "done", title: "Erledigt" });
  e.waitUntil(readNfPrefs().then((prefs) => {
    const options = {
      body: data.body,
      icon: "icon.svg",
      badge: "icon.svg",
      tag: data.tag || "studienplaner",
      actions,
      data: { url: data.url || "./", noteUrl: data.noteUrl || null, todoId: data.todoId || null, doneUrl: data.doneUrl || null, doneTitle: data.doneTitle || null },
      silent: prefs.sound === false,
    };
    if (prefs.vib && VIB_PATTERN[prefs.vib] !== undefined) options.vibrate = VIB_PATTERN[prefs.vib];
    return self.registration.showNotification(data.title, options);
  }));
});

// Tippen auf die Nachricht öffnet die App, „Notiz schreiben“ öffnet das Notizfenster des Moduls
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const d = e.notification.data || {};
  // „Erledigt“ mit signiertem Link: im Hintergrund abhaken und eine kurze Bestätigung zeigen
  if (e.action === "done" && d.doneUrl) {
    e.waitUntil(fetch(d.doneUrl).then((r) => {
      if (!r.ok) throw new Error("erledigt");
      return self.registration.showNotification("Erledigt", {
        body: d.doneTitle || "Aufgabe abgehakt",
        icon: "icon.svg",
        badge: "icon.svg",
        tag: "done-" + (d.todoId || ""),
        silent: true,
        data: { url: "./?tab=kalender" },
      });
    }).catch(() => clients.openWindow("./?done=" + encodeURIComponent(d.todoId || ""))));
    return;
  }
  let target = e.action === "note" && d.noteUrl ? d.noteUrl : (d.url || "./");
  if (e.action === "done" && d.todoId) target = "./?done=" + encodeURIComponent(d.todoId);
  // Immer ein Fenster mit dem Ziel öffnen (Android holt es so zuverlässig in den Vordergrund)
  e.waitUntil(clients.openWindow(target));
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // Nur die App-Dateien aus dem eigenen Ursprung zwischenspeichern, nie Antworten von Supabase oder anderen Diensten
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
