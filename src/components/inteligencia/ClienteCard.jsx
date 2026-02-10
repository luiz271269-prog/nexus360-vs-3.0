import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MessageSquare, 
  Copy, 
  AlertCircle, 
  TrendingUp,
  TrendingDown,
  Clock,
  Target
} from 'lucide-react';
import { toast } from 'sonner';

export default function ClienteCard({ cliente, onAbrirConversa }) {
  // ✅ Dados da análise V3
  const prioridadeLabel = cliente.prioridadeLabel || 'BAIXO';
  const dealRisk = cliente.deal_risk || 0;
  const buyIntent = cliente.buy_intent || 0;
  const health = cliente.health || 0;
  const engagement = cliente.engagement || 0;
  const rootCauses = cliente.root_causes || [];
  const suggestedMessage = cliente.suggested_message || '';
  const diasSemResponder = cliente.days_inactive_inbound || cliente.days_stalled || 0;
  const bucketInactive = cliente.bucket_inactive || 'active';

  const prioridadeConfig = {
    CRITICO: { 
      bg: 'bg-red-500', 
      border: 'border-red-500',
      text: 'text-red-500',
      dot: 'bg-red-500'
    },
    ALTO: { 
      bg: 'bg-orange-500', 
      border: 'border-orange-500',
      text: 'text-orange-500',
      dot: 'bg-orange-500'
    },
    MEDIO: { 
      bg: 'bg-yellow-500', 
      border: 'border-yellow-500',
      text: 'text-yellow-500',
      dot: 'bg-yellow-500'
    },
    BAIXO: { 
      bg: 'bg-blue-500', 
      border: 'border-blue-500',
      text: 'text-blue-500',
      dot: 'bg-blue-500'
    }
  };

  const config = prioridadeConfig[prioridadeLabel];

  const copiarMensagem = () => {
    if (!suggestedMessage) {
      toast.error('Nenhuma mensagem sugerida disponível');
      return;
    }
    navigator.clipboard.writeText(suggestedMessage);
    toast.success('✅ Mensagem copiada!');
  };

  return (
    <div className="group relative p-4 border-b border-slate-100 hover:bg-slate-50 transition-all cursor-pointer">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.bg}`} />

      <div className="flex justify-between items-start mb-2 pl-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-sm text-slate-800 truncate">
              {cliente.empresa || cliente.nome || cliente.telefone}
            </h4>
            <span className={`w-2 h-2 rounded-full ${config.dot} animate-pulse`} />
          </div>
          <div className="text-xs text-slate-500 space-y-1 mt-1">
            <div className="flex items-center gap-2">
              <Target className="w-3 h-3" />
              <span>Estágio: {cliente.stage_current || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3" />
              <span>{diasSemResponder} dias sem responder</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                Bucket: {bucketInactive}
              </Badge>
            </div>
          </div>
        </div>

        <Badge className={`${config.bg} text-white text-[10px] px-2 py-0.5 font-bold`}>
          {prioridadeLabel}
        </Badge>
      </div>

      {/* Root Causes */}
      {rootCauses.length > 0 && (
        <div className={`pl-3 mb-3 p-3 rounded-lg bg-blue-50 border-l-4 ${config.border}`}>
          <div className="flex items-start gap-2">
            <AlertCircle className={`w-4 h-4 ${config.text} flex-shrink-0 mt-0.5`} />
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">
                Causas Identificadas
              </p>
              <ul className="text-xs text-slate-700 space-y-0.5">
                {rootCauses.slice(0, 3).map((causa, i) => (
                  <li key={i}>• {causa}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Scores */}
      <div className="pl-3 flex gap-6 mb-4">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-red-500" />
          <div>
            <p className="text-[10px] text-slate-400 uppercase">Risco</p>
            <p className="text-sm font-bold text-red-600">{dealRisk}%</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-500" />
          <div>
            <p className="text-[10px] text-slate-400 uppercase">Intenção</p>
            <p className="text-sm font-bold text-green-600">{buyIntent}%</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${health > 70 ? 'bg-green-500' : health > 40 ? 'bg-yellow-500' : 'bg-red-500'}`} />
          <div>
            <p className="text-[10px] text-slate-400 uppercase">Saúde</p>
            <p className="text-sm font-bold text-blue-600">{health}%</p>
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="pl-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {suggestedMessage && (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              copiarMensagem();
            }}
            className="flex-1 text-xs"
          >
            <Copy className="w-3 h-3 mr-1" />
            Copiar Sugestão
          </Button>
        )}
        
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            if (onAbrirConversa) {
              onAbrirConversa(cliente);
            }
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2"
        >
          <MessageSquare className="w-3 h-3 mr-1" />
          Abrir
        </Button>
      </div>

      {/* Preview da mensagem */}
      {suggestedMessage && (
        <div className="pl-3 mt-2 p-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 text-xs text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="font-semibold mb-1.5 text-blue-700 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Sugestão da IA:
          </p>
          <p className="leading-relaxed">{suggestedMessage}</p>
        </div>
      )}
    </div>
  );
}