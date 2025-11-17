import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * 🔔 Componente para tocar som de notificação quando chega mensagem nova
 * Usa Web Audio API para máxima compatibilidade
 */
export default function NotificationSound({ threadAtiva }) {
  const queryClient = useQueryClient();
  const lastMessageCountRef = useRef(0);
  const audioContextRef = useRef(null);

  useEffect(() => {
    // Inicializar Audio Context (só funciona após interação do usuário)
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
    };

    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('keydown', initAudio, { once: true });

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!threadAtiva) return;

    // Listener para mudanças nas mensagens
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.type === 'updated' && event?.query?.queryKey?.[0] === 'mensagens') {
        const mensagens = event.query.state.data || [];
        
        // Verificar se é thread ativa
        if (event.query.queryKey[1] !== threadAtiva?.id) return;

        // Verificar se há novas mensagens do contato
        const mensagensContato = mensagens.filter(m => m.sender_type === 'contact');
        const currentCount = mensagensContato.length;

        if (currentCount > lastMessageCountRef.current && lastMessageCountRef.current > 0) {
          // Nova mensagem detectada!
          tocarNotificacao();
        }

        lastMessageCountRef.current = currentCount;
      }
    });

    return unsubscribe;
  }, [threadAtiva, queryClient]);

  const tocarNotificacao = () => {
    if (!audioContextRef.current) return;

    try {
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Som tipo "ding" - frequências agradáveis
      oscillator.frequency.setValueAtTime(800, ctx.currentTime);
      oscillator.frequency.setValueAtTime(600, ctx.currentTime + 0.1);

      // Envelope de volume
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);

      console.log('[NOTIFICATION] 🔔 Som tocado');

      // Vibração (se disponível)
      if ('vibrate' in navigator) {
        navigator.vibrate(200);
      }

      // Notificação do navegador (se permitido)
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Nova mensagem', {
          body: 'Você recebeu uma nova mensagem no WhatsApp',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'whatsapp-message',
          renotify: false
        });
      }

    } catch (error) {
      console.error('[NOTIFICATION] Erro ao tocar som:', error);
    }
  };

  // Componente não renderiza nada
  return null;
}