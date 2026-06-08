import React, { useEffect, useRef, useState, useCallback } from 'react';
import { registrarUserDevice } from '@/functions/registrarUserDevice';
import { getVapidPublicKey } from '@/functions/getVapidPublicKey';
import NotificationPermissionBanner from '@/components/global/NotificationPermissionBanner';

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
  // 'granted' | 'denied' | 'default' | 'unsupported' | null
  const [permState, setPermState] = useState(null);
  const [bannerFechado, setBannerFechado] = useState(false);

  const suportado = typeof navigator !== 'undefined'
    && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  // Detecta ambiente DEV/preview onde NÃO devemos registrar o SW
  const isDevLike = (() => {
    if (typeof window === 'undefined') return true;
    const host = window.location.hostname;
    return import.meta.env.DEV
      || host === 'localhost'
      || host === '127.0.0.1'
      || host.includes('preview-sandbox')
      || (host.includes('base44.app') === false && host.includes('-preview'));
  })();

  // Faz o registro completo (SW + push + device). Só efetiva se permission=granted.
  const registrar = useCallback(async () => {
    if (!suportado || isDevLike) return;
    try {
      const registration = await navigator.serviceWorker.register('/nexus-sw.js');
      await navigator.serviceWorker.ready;

      const resp = await getVapidPublicKey();
      const VAPID_PUBLIC_KEY = resp?.data?.publicKey;
      if (!VAPID_PUBLIC_KEY) {
        console.warn('[WakeUp] chave VAPID pública indisponível');
        return;
      }

      // Pede permissão (se já decidiu, retorna o estado atual sem prompt)
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      setPermState(permission);
      if (permission !== 'granted') {
        console.log('[WakeUp] Permissão não concedida:', permission);
        return;
      }

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
  }, [suportado, isDevLike]);

  // A CADA abertura/login: reavalia o estado da permissão e tenta registrar.
  useEffect(() => {
    if (!usuario?.id) return;

    if (!suportado) { setPermState('unsupported'); return; }

    if (isDevLike) {
      navigator.serviceWorker.getRegistrations?.()
        .then(regs => regs.forEach(r => r.unregister()))
        .catch(() => {});
      if (window.caches?.keys) {
        caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
      }
      setPermState('granted'); // não incomoda no preview
      return;
    }

    const atual = Notification.permission;
    setPermState(atual);
    setBannerFechado(false); // reabre o pedido a cada abertura

    // Se já concedida → registra direto (garante device sempre ativo).
    // Se 'default' → tenta pedir agora (prompt nativo).
    if (atual === 'granted' || atual === 'default') {
      registrar();
    }
    // Se 'denied' → o banner persistente vai insistir (prompt nativo é bloqueado pelo browser)
  }, [usuario?.id, suportado, isDevLike, registrar]);

  // Banner: mostra sempre que NÃO está concedida (e não foi fechado nesta sessão de view)
  const mostrarBanner = !!usuario?.id
    && suportado
    && !isDevLike
    && !bannerFechado
    && (permState === 'denied' || permState === 'default');

  const handleAtivar = () => {
    if (permState === 'denied') {
      // Browser não reabre o prompt: orienta o usuário a reativar manualmente
      alert(
        'As notificações estão bloqueadas neste dispositivo.\n\n' +
        '📱 Celular: abra as configurações do site/app → Notificações → Permitir.\n' +
        '💻 Computador: clique no cadeado 🔒 ao lado do endereço → Notificações → Permitir.\n\n' +
        'Depois, recarregue o app.'
      );
      return;
    }
    registrar();
  };

  return (
    <NotificationPermissionBanner
      visivel={mostrarBanner}
      bloqueado={permState === 'denied'}
      onAtivar={handleAtivar}
      onFechar={() => setBannerFechado(true)}
    />
  );
}