// Offline-Unterstützung: lädt immer aus dem Netz, nutzt den Cache nur wenn offline.
const CACHE = "studienplaner-v2";
const FILES = ["./", "index.html", "styles.css", "app.js", "config.js", "manifest.json", "icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

// Push vom Server: zeigt die Erinnerung an
self.addEventListener("push", (e) => {
  let data = { title: "Studienplaner", body: "Du hast Fristen anstehend." };
  try { data = { ...data, ...e.data.json() }; } catch (_) {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: "icon.svg",
    badge: "icon.svg",
    tag: "studienplaner-fristen",
  }));
});

// Tippen auf die Erinnerung öffnet die App
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
    if (all.length) return all[0].focus();
    return clients.openWindow("./");
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
