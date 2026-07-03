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

  // Cor diferenciada por tipo de notificação (ícone colorido)
  const ICONES_POR_TIPO = {
    call: 'https://media.base44.com/images/public/68a7d067890527304dbe8477/b6a537353_generated_image.png',      // 🔴 chamada
    interna: 'https://media.base44.com/images/public/68a7d067890527304dbe8477/ab13770da_generated_image.png',   // 🟣 mensagem interna
    externa: 'https://media.base44.com/images/public/68a7d067890527304dbe8477/d26b0232f_generated_image.png',   // 🟢 mensagem de contato
    sistema: 'https://media.base44.com/images/public/68a7d067890527304dbe8477/27c47bcda_generated_image.png'    // 🟠 alertas do sistema
  };
  const categoria = data.tipo === 'call' ? 'call' : (data.categoria || 'sistema');
  const iconePadrao = ICONES_POR_TIPO[categoria] || '/icon-192.png';

  const options = {
    body: data.body || 'Você tem uma nova notificação',
    icon: data.icon || iconePadrao,
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
