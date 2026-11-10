// Offline-Unterstützung: lädt immer aus dem Netz, nutzt den Cache nur wenn offline.
const CACHE = "studienplaner-v3";
const FILES = ["./", "index.html", "styles.css", "app.js", "config.js", "manifest.json", "icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

// Push vom Server: zeigt die Erinnerung an
self.addEventListener("push", (e) => {
  let data = { title: "Studienplaner", body: "" };
  try { data = { ...data, ...e.data.json() }; } catch (_) {}
  // „Notiz schreiben“ nur bei Modul-Erinnerungen
  const actions = data.noteUrl ? [{ action: "note", title: "Notiz schreiben" }] : [];
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: "icon.svg",
    badge: "icon.svg",
    tag: data.tag || "studienplaner",
    actions,
    data: { url: data.url || "./", noteUrl: data.noteUrl || null },
  }));
});

// Tippen auf die Nachricht öffnet die App, „Notiz schreiben“ öffnet das Notizfenster des Moduls
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const d = e.notification.data || {};
  const target = e.action === "note" && d.noteUrl ? d.noteUrl : (d.url || "./");
  e.waitUntil((async () => {
    const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const win = all[0];
    if (win) {
      try { await win.navigate(target); } catch (_) {}
      return win.focus();
    }
    return clients.openWindow(target);
  })());
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
