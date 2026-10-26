/* Lead Pipe Locks service worker: notifications and the icon badge, nothing else. It has no fetch handler on purpose: picks and grades must always be live. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : "" }; }
  const title = typeof data.title === "string" && data.title ? data.title : "Lead Pipe Locks";
  const options = {
    body: typeof data.body === "string" ? data.body : "",
    icon: "/icons/icon-192.png",
    data: { url: typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//") ? data.url : "/" },
  };
  if (typeof data.tag === "string" && data.tag) options.tag = data.tag;
  const work = [self.registration.showNotification(title, options)];
  // The number on the app icon: set from the push so it is right even when the app is closed.
  if (Number.isInteger(data.badge) && data.badge >= 0 && self.navigator) {
    if (data.badge > 0 && self.navigator.setAppBadge) work.push(self.navigator.setAppBadge(data.badge));
    if (data.badge === 0 && self.navigator.clearAppBadge) work.push(self.navigator.clearAppBadge());
  }
  event.waitUntil(Promise.allSettled(work));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Only ever a page on this site, however the address was written.
  const wanted = new URL(event.notification.data && event.notification.data.url ? event.notification.data.url : "/", self.location.origin);
  const target = wanted.origin === self.location.origin ? wanted.href : self.location.origin + "/";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
    for (const client of windows) {
      if (!("focus" in client)) continue;
      const moved = "navigate" in client ? await client.navigate(target).catch(() => null) : client;
      return (moved || client).focus();
    }
    return self.clients.openWindow(target);
  }));
});
