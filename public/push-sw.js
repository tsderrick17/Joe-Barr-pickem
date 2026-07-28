self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  const title = payload.title || "Joe Barr Memorial Pick'em";
  const options = {
    body: payload.body || "You have a Pick'em update.",
    data: { url: payload.url || "/" },
    tag: payload.tag || "pickem-reminder",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url || "/"));
});
