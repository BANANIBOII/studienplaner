// Offline-Unterstützung: lädt immer aus dem Netz, nutzt den Cache nur wenn offline.
const CACHE = "studienplaner-v22";
const FILES = ["./", "index.html", "styles.css", "features.css", "app.js", "config.js", "manifest.json", "icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

// Vibration und Ton pro Gerät: die App legt die Einstellung in IndexedDB ab (localStorage kann der Service Worker nicht lesen)
const VIB_PATTERN = { kurz: [200], lang: [500, 200, 500, 200, 500], aus: [] };
function readNfPrefs() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open("studienplaner-device", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("kv");
      req.onerror = () => resolve({});
      req.onsuccess = () => {
        const db = req.result;
        const get = db.transaction("kv").objectStore("kv").get("nfDev");
        get.onsuccess = () => { db.close(); resolve(get.result || {}); };
        get.onerror = () => { db.close(); resolve({}); };
      };
    } catch (_) { resolve({}); }
  });
}

// Push vom Server: zeigt die Erinnerung an
self.addEventListener("push", (e) => {
  let data = { title: "Studienplaner", body: "" };
  try { data = { ...data, ...e.data.json() }; } catch (_) {}
  // „Notiz schreiben“ nur bei Modul-Erinnerungen
  const actions = data.noteUrl ? [{ action: "note", title: "Notiz schreiben" }] : [];
  e.waitUntil(readNfPrefs().then((prefs) => {
    const options = {
      body: data.body,
      icon: "icon.svg",
      badge: "icon.svg",
      tag: data.tag || "studienplaner",
      actions,
      data: { url: data.url || "./", noteUrl: data.noteUrl || null },
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
  const target = e.action === "note" && d.noteUrl ? d.noteUrl : (d.url || "./");
  // Immer ein Fenster mit dem Ziel öffnen (Android holt es so zuverlässig in den Vordergrund)
  e.waitUntil(clients.openWindow(target));
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
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
