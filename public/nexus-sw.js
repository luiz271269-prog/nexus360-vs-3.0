self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_error) {
    payload = { title: 'Nexus360', body: event.data ? event.data.text() : 'Nova atividade' };
  }

  const title = payload.title || 'Nexus360';
  const options = {
    body: payload.body || 'Nova atividade no Nexus360',
    tag: payload.tag || `nexus-${Date.now()}`,
    renotify: payload.renotify !== false,
    requireInteraction: payload.requireInteraction !== false,
    silent: payload.silent === true,
    vibrate: payload.vibrate || [200, 100, 200],
    data: payload.data || {},
    actions: payload.actions || [{ action: 'open', title: 'Abrir' }]
  };

  if (payload.icon) options.icon = payload.icon;
  if (payload.badge) options.badge = payload.badge;

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const actionUrl = data.action_url || data.url || '/Comunicacao';
  const targetUrl = new URL(actionUrl, self.location.origin).href;

  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(targetUrl);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
});
