// Movie Horse service worker: shows push notifications and opens the right screen when tapped.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.png",
      badge: "/icon.png",
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      // Leave a note for the app too: iPhones bring an open app forward but often ignore
      // navigate(), so the app checks this note when it comes to the front.
      const notes = await caches.open("mh-open");
      await notes.put("/__open", new Response(JSON.stringify({ url, at: Date.now() })));

      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((c) => new URL(c.url).origin === self.location.origin);
      if (open) {
        try {
          await open.focus();
        } catch {}
        open.postMessage({ type: "open", url });
        try {
          await open.navigate(url);
        } catch {}
        return;
      }
      return self.clients.openWindow(url);
    })(),
  );
});
