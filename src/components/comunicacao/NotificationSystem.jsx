import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function NotificationSystem({ usuario }) {
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);
  const [novasMensagens, setNovasMensagens] = useState([]);
  const ultimoTotalRef = useRef(0);

  useEffect(() => {
    if (!usuario) return;

    const verificarMensagens = async () => {
      try {
        // Buscar threads com mensagens não lidas
        const threads = await base44.entities.MessageThread.list('-last_message_at', 100);
        
        // Calcular total de não lidas
        const total = threads.reduce((acc, thread) => acc + (thread.unread_count || 0), 0);
        
        // Se aumentou o número de não lidas = novas mensagens
        if (total > ultimoTotalRef.current) {
          const diferenca = total - ultimoTotalRef.current;
          
          // Vibrar
          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }
          
          // Notificação visual
          setNovasMensagens(prev => [...prev, { id: Date.now(), count: diferenca }]);
          
          // Tocar som (opcional)
          try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBCR9y/DajEYMF2S46Om4YRsDOpHW8M16LQUu');
            audio.volume = 0.3;
            audio.play().catch(() => {});
          } catch {}
        }
        
        ultimoTotalRef.current = total;
        setTotalNaoLidas(total);
        
      } catch (error) {
        console.error('[NotificationSystem] Erro:', error);
      }
    };

    verificarMensagens();
    const interval = setInterval(verificarMensagens, 5000);
    
    return () => clearInterval(interval);
  }, [usuario]);

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
      {/* Notificações toast apenas para NOVAS mensagens */}
      <AnimatePresence>
        {novasMensagens.map((msg, index) => (
          <motion.div
            key={msg.id}
            initial={{ x: 400, opacity: 0, scale: 0.8 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 400, opacity: 0, scale: 0.8 }}
            className="fixed right-4 z-50"
            style={{ top: `${20 + index * 70}px` }}
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
    </>
  );
}