import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

const SW_CACHE_CLEANUP_RELOAD_KEY = 'nexus360-sw-cache-cleanup-reloaded-v2'
const WAKE_UP_SW_PATH = '/nexus-sw.js'

async function cleanupLegacyServiceWorkersAndCaches() {
  if (typeof window === 'undefined') return false

  let cleaned = false

  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      const legacyRegistrations = registrations.filter((registration) => {
        const scriptURL = registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL || ''
        return !scriptURL.endsWith(WAKE_UP_SW_PATH)
      })

      if (legacyRegistrations.length > 0) {
        console.log('[SW Cleanup] Desregistrando', legacyRegistrations.length, 'service worker(s) legado(s)')
        await Promise.all(legacyRegistrations.map((registration) => registration.unregister().catch(() => false)))
        cleaned = true
      }

      if (navigator.serviceWorker.controller) {
        const controllerUrl = navigator.serviceWorker.controller.scriptURL || ''
        if (!controllerUrl.endsWith(WAKE_UP_SW_PATH)) cleaned = true
      }
    } catch (error) {
      console.warn('[SW Cleanup] Falha ao verificar service workers antigos:', error)
    }
  }

  if ('caches' in window) {
    try {
      const cacheKeys = await window.caches.keys()
      if (cacheKeys.length > 0) {
        console.log('[SW Cleanup] Limpando', cacheKeys.length, 'cache(s) antigo(s)')
        await Promise.all(cacheKeys.map((key) => window.caches.delete(key).catch(() => false)))
        cleaned = true
      }
    } catch (error) {
      console.warn('[SW Cleanup] Falha ao limpar Cache Storage:', error)
    }
  }

  return cleaned
}

async function bootstrap() {
  const cleaned = await cleanupLegacyServiceWorkersAndCaches()
  const alreadyReloaded = window.sessionStorage.getItem(SW_CACHE_CLEANUP_RELOAD_KEY) === 'true'

  if (cleaned && !alreadyReloaded) {
    window.sessionStorage.setItem(SW_CACHE_CLEANUP_RELOAD_KEY, 'true')
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
