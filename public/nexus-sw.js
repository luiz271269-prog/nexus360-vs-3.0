/* Nexus360 Wake-Up Service Worker — PUSH ONLY.
   IMPORTANTE: este SW NÃO intercepta fetch nem faz cache de assets.
   Cache de JS/CSS por SW causava "Cannot read properties of null (reading 'useState')"
   por servir chunks Vite antigos misturados com novos. */

// Ativa imediatamente e remove qualquer cache deixado por versões anteriores
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// SEM listener de fetch — o browser busca tudo direto da rede (sem cache do SW)

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}

  const title = data.title || 'Nexus360';
  const options = {
    body: data.body || 'Você tem uma nova notificação',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || 'nexus-notification',
    renotify: true,
    requireInteraction: data.tipo === 'call',
    vibrate: data.tipo === 'call' ? [300, 100, 300, 100, 300] : [200, 100, 200],
    data: { url: data.action_url || data.url || '/' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client && url !== '/') {
            try { await client.navigate(url); } catch (_) {}
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
