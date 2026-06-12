import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const DEVICE_ID_KEY = 'nexus360-wakeup-device-id-v1';
const SW_PATH = '/nexus-sw.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function getOrCreateDeviceId() {
  const current = window.localStorage.getItem(DEVICE_ID_KEY);
  if (current) return current;
  const next = `web-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  window.localStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}

function detectPlatform() {
  const ua = navigator.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isStandalone && isMobile) return 'pwa_mobile';
  if (isStandalone) return 'pwa_desktop';
  return isMobile ? 'web_mobile' : 'web_desktop';
}

function detectBrowser() {
  const ua = navigator.userAgent || '';
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/Chrome\//i.test(ua)) return 'Chrome';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Safari\//i.test(ua)) return 'Safari';
  return 'Desconhecido';
}

function detectOS() {
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Desconhecido';
}

async function ensurePermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

async function getVapidPublicKey() {
  try {
    const response = await base44.functions.invoke('getVapidPublicKey', {});
    if (response?.data?.publicKey) return response.data.publicKey;
  } catch (error) {
    console.warn('[WakeUpManager] getVapidPublicKey indisponível; tentando fallback:', error);
  }

  const fallback = await base44.functions.invoke('enviarWakeUpPush', { action: 'get_public_key' });
  const publicKey = fallback?.data?.publicKey;
  if (!publicKey) throw new Error(fallback?.data?.error || 'VAPID_PUBLIC_KEY ausente');
  return publicKey;
}

async function registerWakeUpDevice() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  const allowed = await ensurePermission();
  if (!allowed) return;

  const publicKey = await getVapidPublicKey();
  const registration = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
  }

  const payload = subscription.toJSON();
  await base44.functions.invoke('registrarUserDevice', {
    device_id: getOrCreateDeviceId(),
    platform: detectPlatform(),
    push_endpoint: payload.endpoint,
    push_keys_p256dh: payload.keys?.p256dh,
    push_keys_auth: payload.keys?.auth,
    device_label: `${detectBrowser()} ${detectOS()}`,
    browser: detectBrowser(),
    os: detectOS(),
    user_agent: navigator.userAgent,
    can_wake_call: true,
    can_wake_message: true
  });
}

export default function WakeUpManager({ usuario }) {
  const registeredForUser = useRef(null);

  useEffect(() => {
    if (!usuario?.id) return;
    if (registeredForUser.current === usuario.id) return;
    if (typeof window === 'undefined') return;

    registeredForUser.current = usuario.id;
    const timer = window.setTimeout(() => {
      registerWakeUpDevice().catch((error) => {
        console.warn('[WakeUpManager] Falha ao registrar push:', error);
      });
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [usuario?.id]);

  return null;
}
