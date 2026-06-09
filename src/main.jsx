import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// ═══════════════════════════════════════════════════════════════════
// SW/CACHE CLEANUP — remove qualquer service worker antigo registrado
// em sessões anteriores que possa estar servindo chunks JS stale (causa
// raiz do erro 'Cannot read properties of null (reading useState)':
// duas cópias de React em runtime quando SW serve chunk antigo).
//
// Importante: limpar depois de renderizar não basta quando o HTML/chunks já
// vieram de cache antigo. Por isso o boot aguarda a limpeza e força 1 reload
// controlado quando encontra SW/Cache Storage legado.
// ═══════════════════════════════════════════════════════════════════
// Desregistra service workers antigos E limpa o Cache Storage que pode estar
// servindo chunks JS stale (causa raiz do crash de dupla cópia do React).
// Só força UM reload controlado quando encontra SW/cache legado de fato —
// usando sessionStorage como guard para nunca entrar em loop de reload.
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  (async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      const tinhaSW = regs.length > 0;
      await Promise.all(regs.map((reg) => reg.unregister().catch(() => {})));

      let tinhaCache = false;
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys().catch(() => []);
        tinhaCache = keys.length > 0;
        await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})));
      }

      const jaRecarregou = sessionStorage.getItem('nexus_sw_purged') === '1';
      if ((tinhaSW || tinhaCache) && !jaRecarregou) {
        sessionStorage.setItem('nexus_sw_purged', '1');
        window.location.reload();
      }
    } catch (_) { /* best-effort */ }
  })();
}

// Boot com guarda anti-stale: se o bundle em cache estiver corrompido
// (ex.: React resolvido como null → "Cannot read properties of null (reading 'useState')"),
// limpa caches/SW e força UM reload controlado para baixar o bundle fresco.
try {
  if (!React || typeof React.useState !== 'function') {
    throw new Error('React runtime inválido (bundle stale)');
  }
  ReactDOM.createRoot(document.getElementById('root')).render(
    // <React.StrictMode>
    <App />
    // </React.StrictMode>,
  );
} catch (bootErr) {
  console.error('[BOOT] Falha ao iniciar — purgando cache e recarregando:', bootErr);
  const jaPurgou = sessionStorage.getItem('nexus_boot_purged') === '1';
  if (!jaPurgou) {
    sessionStorage.setItem('nexus_boot_purged', '1');
    (async () => {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
        }
        if (typeof caches !== 'undefined') {
          const keys = await caches.keys().catch(() => []);
          await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})));
        }
      } catch (_) { /* best-effort */ }
      window.location.reload();
    })();
  }
}

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}