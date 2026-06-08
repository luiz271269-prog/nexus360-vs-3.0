/* Nexus360 Service Worker — Web Push (Wake-Up) */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Nexus360', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Nexus360';
  const tipo = data.tipo || 'message';

  // Vibração: usa a do payload; senão um padrão forte. Internas mandam o "dobro".
  const vibrate = Array.isArray(data.vibrate) && data.vibrate.length > 0
    ? data.vibrate
    : (tipo === 'call' ? [600, 200, 600, 200, 600] : [300, 120, 300]);

  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: '/badge-72.png',
    tag: data.tag || `nexus-${tipo}`,
    renotify: data.renotify !== undefined ? data.renotify : true,
    vibrate,
    requireInteraction: tipo === 'call',
    data: {
      action_url: data.action_url || '/',
      tipo,
    },
    actions: [
      { action: 'open', title: 'Abrir' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.action_url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            try { client.navigate(url); } catch { /* ignore */ }
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
