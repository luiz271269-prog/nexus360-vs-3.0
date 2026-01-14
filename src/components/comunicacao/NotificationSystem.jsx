import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function NotificationSystem({ usuario }) {
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);
  const [novasMensagens, setNovasMensagens] = useState([]);
  // ⭐ REF para guardar estado anterior (evita re-renders)
  const lastStateRef = useRef({ totalUnread: 0, lastMessageDate: 0 });

  // ⭐ LÓGICA REFINADA: Validação dupla (Total + Timestamp)
  useEffect(() => {
    if (!usuario) return;

    // Sem threads aqui = NotificationSystem apenas renderiza, não causa re-renders
    // A lógica de monitoramento volta para a página Comunicacao (onde realmente precisa)
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