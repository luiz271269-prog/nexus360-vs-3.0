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
const CACHE_CLEANUP_RELOAD_KEY = 'nexus360-cache-cleanup-reloaded-v2'

async function cleanupLegacyBrowserCaches() {
  if (typeof window === 'undefined') return false

  let removedSomething = false

  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations()
      if (regs.length > 0) {
        console.log('[SW Cleanup] Desregistrando', regs.length, 'service worker(s) antigo(s)')
        await Promise.all(regs.map((reg) => reg.unregister().catch(() => false)))
        removedSomething = true
      }
    } catch {
      // best-effort cleanup
    }
  }

  if (typeof caches !== 'undefined') {
    try {
      const keys = await caches.keys()
      if (keys.length > 0) {
        await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)))
        removedSomething = true
      }
    } catch {
      // best-effort cleanup
    }
  }

  return removedSomething
}

async function bootstrap() {
  const removedLegacyCache = await cleanupLegacyBrowserCaches()
  const alreadyReloaded = sessionStorage.getItem(CACHE_CLEANUP_RELOAD_KEY) === '1'

  if (removedLegacyCache && !alreadyReloaded) {
    sessionStorage.setItem(CACHE_CLEANUP_RELOAD_KEY, '1')
    window.location.reload()
    return
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    // <React.StrictMode>
    <App />
    // </React.StrictMode>,
  )
}

bootstrap()

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}