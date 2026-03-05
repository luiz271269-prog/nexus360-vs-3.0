import React from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  MessageCircle,
  Heart,
  Clock
} from 'lucide-react';

export default function ClienteCard({ cliente, onAbrirConversa }) {
  const prioridadeLabel = cliente.prioridadeLabel || 'BAIXO';
  const lastMessageAt = cliente.ultima_interacao || cliente.last_message_at;
  const messageCount = cliente.total_mensagens || 0;

  const prioridadeConfig = {
    CRITICO: { bg: 'bg-red-500', border: 'border-red-500' },
    ALTO: { bg: 'bg-orange-500', border: 'border-orange-500' },
    MEDIO: { bg: 'bg-yellow-500', border: 'border-yellow-500' },
    BAIXO: { bg: 'bg-blue-500', border: 'border-blue-500' }
  };

  const config = prioridadeConfig[prioridadeLabel];

  // ✅ Formatar timestamp relativo
  const formatarTempo = (data) => {
    if (!data) return 'N/A';
    const date = new Date(data);
    const agora = new Date();
    const diff = Math.floor((agora - date) / 1000 / 60); // minutos

    if (diff < 1) return 'Agora';
    if (diff < 60) return `${diff}min`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h`;
    return `${Math.floor(diff / 1440)}d`;
  };

  // ✅ Extrair inicial para avatar
  const nomeExibido = cliente.empresa || cliente.nome || cliente.telefone || 'N/A';
  const inicial = nomeExibido.charAt(0).toUpperCase();

  return (
    <div 
      className="group relative bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-md transition-all cursor-pointer"
      onClick={() => onAbrirConversa && onAbrirConversa(cliente)}
    >
      {/* Barra lateral colorida */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.bg}`} />

      <div className="p-4 pl-3">
        {/* Cabeçalho com Avatar e Nome */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`${config.bg} w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
            {inicial}
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-slate-800 truncate">
              {nomeExibido}
            </h4>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3" />
              {formatarTempo(lastMessageAt)}
            </p>
          </div>
        </div>

        {/* Contadores */}
        <div className="flex items-center gap-3 mb-3 text-xs">
          <div className="flex items-center gap-1 text-slate-600">
            <MessageCircle className="w-3 h-3 text-slate-400" />
            <span className="font-semibold">{messageCount}</span>
            <span className="text-slate-400">mensagens</span>
          </div>
          
          <div className="flex items-center gap-1 text-slate-600">
            <Heart className="w-3 h-3 text-slate-400" />
            <span className="font-semibold">99d</span>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1">
          <Badge className={`${config.bg} text-white text-[10px]`}>
            {prioridadeLabel}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            Lead
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            Tiago
          </Badge>
        </div>
      </div>
    </div>
  );
}