import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Sparkles } from 'lucide-react';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  BOTÃO NEXUS FLUTUANTE - CO-PILOTO DE VENDAS               ║
 * ║  Design: Pequeno, redondo, com badge de notificações       ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export default function BotaoNexusFlutuante({ 
  contadorLembretes = 0,
  onClick,
  className = ''
}) {
  return (
    <div
      className={`fixed bottom-24 right-6 z-50 ${className}`}
    >
      <Button
        onClick={onClick}
        className="relative w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:via-indigo-700 hover:to-blue-700 shadow-2xl shadow-purple-500/30 border-2 border-white/20 transition-all duration-300 hover:scale-110 p-0"
      >
        {/* Ícone Principal */}
        <Brain className="w-6 h-6 text-white" />
        
        {/* Efeito de Brilho */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-full" />
        
        {/* Animação de Pulse */}
        {contadorLembretes > 0 && (
          <div
            className="absolute inset-0 rounded-full bg-red-500/30 animate-pulse"
          />
        )}
        
        {/* Badge de Notificações */}
        {contadorLembretes > 0 && (
          <Badge className="absolute -top-1 -right-1 bg-red-500 text-white font-bold text-xs min-w-[22px] h-[22px] flex items-center justify-center rounded-full shadow-lg border-2 border-white animate-pulse">
            {contadorLembretes > 99 ? '99+' : contadorLembretes}
          </Badge>
        )}

        {/* Sparkles de Atividade */}
        {contadorLembretes > 0 && (
          <Sparkles className="absolute -top-1 -left-1 w-3 h-3 text-amber-400 animate-ping" />
        )}
      </Button>

      {/* Tooltip */}
      <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl">
        {contadorLembretes > 0 ? (
          <>
            <Brain className="w-3 h-3 inline mr-1" />
            {contadorLembretes} lembrete{contadorLembretes > 1 ? 's' : ''} da IA
          </>
        ) : (
          'Nexus Co-Piloto'
        )}
      </div>
    </div>
  );
}