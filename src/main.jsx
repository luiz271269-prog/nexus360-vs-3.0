import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// ═══════════════════════════════════════════════════════════════════
// SW/CACHE CLEANUP — remove qualquer service worker antigo registrado
// em sessões anteriores que possa estar servindo chunks JS stale (causa
// raiz do erro 'Cannot read properties of null (reading useState)':
// duas cópias de React em runtime quando SW serve chunk antigo).
// Roda 1x na inicialização. Não registra nenhum SW novo.
// ═══════════════════════════════════════════════════════════════════
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    if (regs.length > 0) {
      console.log('[SW Cleanup] Desregistrando', regs.length, 'service worker(s) antigo(s)');
      regs.forEach((reg) => reg.unregister().catch(() => {}));
      if (typeof caches !== 'undefined') {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k).catch(() => {})));
      }
    }
  }).catch(() => {});
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