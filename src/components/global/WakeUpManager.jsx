import React, { useEffect, useRef } from 'react';
import { registrarUserDevice } from '@/functions/registrarUserDevice';
import { getVapidPublicKey } from '@/functions/getVapidPublicKey';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function getDeviceId() {
  let id = localStorage.getItem('nexus_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('nexus_device_id', id);
  }
  return id;
}

function detectarPlataforma() {
  const ua = navigator.userAgent;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isStandalone) return isMobile ? 'pwa_mobile' : 'pwa_desktop';
  return isMobile ? 'web_mobile' : 'web_desktop';
}

/**
 * WakeUpManager — registra Service Worker + Web Push para receber
 * notificações com som mesmo com o app fechado. Sem UI (silencioso).
 * Pede permissão uma vez; depois mantém o device registrado.
 */
export default function WakeUpManager({ usuario }) {
  const jaRegistrou = useRef(false);

  useEffect(() => {
    if (!usuario?.id || jaRegistrou.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    // Em DEV / preview-sandbox: NÃO registrar SW (evita cache-first servir
    // chunks JS quebrados → React duplicado → "Cannot read properties of null").
    // Também desregistra qualquer SW existente e limpa caches nesses ambientes.
    const host = window.location.hostname;
    const isDevLike = import.meta.env.DEV
      || host === 'localhost'
      || host === '127.0.0.1'
      || host.includes('preview-sandbox')
      || host.includes('base44.app') === false && host.includes('-preview');
    if (isDevLike) {
      navigator.serviceWorker.getRegistrations?.()
        .then(regs => regs.forEach(r => r.unregister()))
        .catch(() => {});
      if (window.caches?.keys) {
        caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
      }
      return;
    }

    const registrar = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/nexus-sw.js');
        await navigator.serviceWorker.ready;

        // Busca a chave pública VAPID do backend (função leve, sem web-push)
        const resp = await getVapidPublicKey();
        const VAPID_PUBLIC_KEY = resp?.data?.publicKey;
        if (!VAPID_PUBLIC_KEY) {
          console.warn('[WakeUp] chave VAPID pública indisponível');
          return;
        }

        // Pede permissão (só mostra prompt 1x; se já decidiu, retorna direto)
        let permission = Notification.permission;
        if (permission === 'default') {
          permission = await Notification.requestPermission();
        }
        if (permission !== 'granted') {
          console.log('[WakeUp] Permissão de notificação não concedida:', permission);
          return;
        }

        // Cria/reusa a subscription Web Push
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
          });
        }

        const json = subscription.toJSON();

        await registrarUserDevice({
          device_id: getDeviceId(),
          platform: detectarPlataforma(),
          push_endpoint: subscription.endpoint,
          push_keys_p256dh: json.keys?.p256dh,
          push_keys_auth: json.keys?.auth,
          device_label: `${navigator.platform || ''} ${navigator.vendor || ''}`.trim(),
          user_agent: navigator.userAgent
        });

        jaRegistrou.current = true;
        console.log('[WakeUp] ✅ Device registrado para notificações push');
      } catch (err) {
        console.error('[WakeUp] ❌ Erro ao registrar push:', err);
      }
    };

    registrar();
  }, [usuario?.id]);

  return null;
}