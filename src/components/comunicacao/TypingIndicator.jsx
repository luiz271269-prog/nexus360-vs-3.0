import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * ⌨️ Indicador de "Digitando..." em tempo real
 * Mostra quando o contato está digitando
 */
export default function TypingIndicator({ thread }) {
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!thread) return;

    // Verificar a cada 2 segundos se há indicador de digitação recente
    const checkTyping = async () => {
      try {
        const logs = await base44.entities.AutomationLog.filter(
          {
            thread_id: thread.id,
            acao: 'typing_indicator'
          },
          '-timestamp',
          1
        );

        if (logs.length > 0) {
          const lastTyping = new Date(logs[0].timestamp);
          const agora = new Date();
          const diferencaSegundos = (agora - lastTyping) / 1000;

          // Se digitou nos últimos 3 segundos, mostrar indicador
          setIsTyping(diferencaSegundos < 3);
        } else {
          setIsTyping(false);
        }
      } catch (error) {
        console.error('[TYPING] Erro ao verificar:', error);
        setIsTyping(false);
      }
    };

    const interval = setInterval(checkTyping, 2000);
    checkTyping(); // Primeira verificação imediata

    return () => clearInterval(interval);
  }, [thread]);

  if (!isTyping) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-t border-blue-100">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
      </div>
      <span className="text-sm text-blue-600 font-medium">
        {thread.contato?.nome || 'Contato'} está digitando...
      </span>
    </div>
  );
}