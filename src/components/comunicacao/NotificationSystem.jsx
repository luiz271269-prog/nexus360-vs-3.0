import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function NotificationSystem({ usuario, threads = [] }) {
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);
  const [novasMensagens, setNovasMensagens] = useState([]);
  // ⭐ REF para guardar estado anterior (evita re-renders)
  const lastStateRef = useRef({ totalUnread: 0, lastMessageDate: 0 });

  // ⭐ LÓGICA REFINADA: Validação dupla (Total + Timestamp)
  useEffect(() => {
    if (!usuario || !threads.length) return;

    try {
      // 1️⃣ Calcular total de não lidas
      const currentTotalUnread = threads.reduce((acc, thread) => acc + (thread.unread_count || 0), 0);
      
      // 2️⃣ Encontrar timestamp da mensagem mais recente
      const latestMessageDate = threads
        .map(t => t.last_message_at ? new Date(t.last_message_at).getTime() : 0)
        .reduce((max, curr) => Math.max(max, curr), 0);
      
      // 3️⃣ Recuperar estado anterior
      const { totalUnread: prevUnread, lastMessageDate: prevDate } = lastStateRef.current;
      
      // 4️⃣ 🎯 A LÓGICA DE OURO: Notificar APENAS se:
      // - Aumentou total de não lidas AND
      // - A data da última mensagem mudou (evita notificar reordenações)
      const isNovaMensagemReal = 
        currentTotalUnread > prevUnread && 
        latestMessageDate > (prevDate || 0);

      if (isNovaMensagemReal) {
        const diferenca = currentTotalUnread - prevUnread;
        
        // 📳 Vibração
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
        
        // 🔔 Toca som
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBCR9y/DajEYMF2S46Om4YRsDOpHW8M16LQUu');
          audio.volume = 0.3;
          audio.play().catch(() => {});
        } catch {}
        
        // 📢 Mostrar toast
        setNovasMensagens(prev => [...prev, { id: Date.now(), count: diferenca }]);
      }
      
      // 5️⃣ Atualizar ref para próximo ciclo
      lastStateRef.current = { totalUnread: currentTotalUnread, lastMessageDate: latestMessageDate };
      setTotalNaoLidas(currentTotalUnread);
      
    } catch (error) {
      console.error('[NotificationSystem] Erro:', error);
    }
  }, [usuario, threads]);

  // Remover notificações antigas
  useEffect(() => {
    if (novasMensagens.length > 0) {
      const timer = setTimeout(() => {
        setNovasMensagens(prev => prev.slice(1));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [novasMensagens]);

  return (
    <>
      {/* ⭐ CONTAINER BLINDADO: fixed + pointer-events-none evita empurrar sidebar */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {novasMensagens.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ x: 400, opacity: 0, scale: 0.8 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: 400, opacity: 0, scale: 0.8 }}
              className="pointer-events-auto"
            >
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg px-5 py-3 shadow-2xl flex items-center gap-3 border-2 border-white">
                <Bell className="w-5 h-5" />
                <div>
                  <p className="font-bold">Nova mensagem!</p>
                  <p className="text-sm opacity-90">+{msg.count}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}