import React from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  MessageCircle,
  Heart,
  Clock
} from 'lucide-react';

export default function ClienteCard({ cliente, onAbrirConversa }) {
  const prioridadeLabel = cliente.prioridadeLabel || 'BAIXO';
  const tipoContato = cliente.tipo_contato || 'Lead';
  const vendedor = cliente.vendedor_responsavel || cliente.atendente_fidelizado_vendas || 'Sem atendente';
  const isVip = cliente.is_vip || false;
  const telefone = cliente.telefone_canonico || cliente.telefone || '';
  const messageCount = cliente.total_mensagens || 0;
  const diasSemResponder = cliente.days_inactive_inbound || cliente.days_stalled || 0;

  const prioridadeConfig = {
    CRITICO: { bg: 'bg-red-500' },
    ALTO: { bg: 'bg-orange-500' },
    MEDIO: { bg: 'bg-yellow-500' },
    BAIXO: { bg: 'bg-blue-500' }
  };

  const config = prioridadeConfig[prioridadeLabel];
  const nomeExibido = cliente.empresa || cliente.nome || cliente.telefone || 'N/A';
  const inicial = nomeExibido.charAt(0).toUpperCase();

  return (
    <div 
      className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-md transition-all cursor-pointer p-3"
      onClick={() => onAbrirConversa && onAbrirConversa(cliente)}
    >
      {/* Cabeçalho com Avatar */}
      <div className="flex items-start gap-2 mb-2">
        <div className={`${config.bg} w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
          {inicial}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-xs text-slate-800 truncate leading-tight">
            {nomeExibido}
          </h4>
          {telefone && (
            <p className="text-[11px] text-slate-500 truncate">
              {telefone}
            </p>
          )}
        </div>
      </div>

      {/* Contador de mensagens + dias */}
      <div className="flex items-center gap-1 mb-2 text-[11px] text-slate-600">
        <MessageCircle className="w-3 h-3 text-slate-400" />
        <span className="font-semibold">{messageCount}</span>
        <span className="text-slate-400">sem mensagens</span>
        <span className="font-semibold text-slate-700">{diasSemResponder}d</span>
      </div>

      {/* Badges: tipo contato + VIP + atendente */}
      <div className="flex flex-wrap gap-1 mb-2">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-fit">
          {tipoContato}
        </Badge>
        {isVip && (
          <Badge className="bg-yellow-500 text-white text-[10px] px-1.5 py-0.5 h-fit">
            ⭐ VIP
          </Badge>
        )}
        <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-fit">
          {vendedor}
        </Badge>
      </div>

      {/* Badge de prioridade */}
      <Badge className={`${config.bg} text-white text-[10px] px-1.5 py-0.5 w-fit`}>
        {prioridadeLabel}
      </Badge>
    </div>
  );
}