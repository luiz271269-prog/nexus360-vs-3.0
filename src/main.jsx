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
// Best-effort: desregistra service workers antigos, SEM reload forçado
// (reload mid-otimização causava o crash de dupla cópia do React).
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => regs.forEach((reg) => reg.unregister().catch(() => {})))
    .catch(() => {});
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