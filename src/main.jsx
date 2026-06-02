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

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
  <App />
  // </React.StrictMode>,
)

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}