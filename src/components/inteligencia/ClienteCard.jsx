import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MessageSquare, 
  Copy, 
  AlertCircle, 
  TrendingUp,
  TrendingDown,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

export default function ClienteCard({ contato, onAbrirConversa }) {
  // Prioridade e scores vindos do backend (motor unificado)
  const prioridadeLabel = contato.prioridadeLabel || 'BAIXO';
  const dealRisk = contato.dealRisk || 0;
  const buyIntent = contato.buyIntent || 0;
  const health = contato.health || 0;
  const rootCause = contato.rootCause || 'Aguardando análise...';
  const suggestedMessage = contato.suggestedMessage || '';
  const diasParado = contato.diasSemMensagem || 0;

  // 🎨 Cores baseadas na prioridade (calculada no backend)
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
    toast.success('✅ Mensagem copiada! Pronta para colar no chat.');
  };

  return (
    <div className="group relative p-4 border-b border-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer">
      {/* Indicador lateral de prioridade */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.bg}`} />

      {/* Header: Nome e Badge */}
      <div className="flex justify-between items-start mb-2 pl-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-sm text-slate-800 dark:text-white truncate">
              {contato.empresa || contato.nome || contato.telefone}
            </h4>
            <span className={`w-2 h-2 rounded-full ${config.dot} animate-pulse`} />
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Clock className="w-3 h-3 text-slate-400" />
            <span className="text-xs text-slate-500">
              Parado há {diasParado} dias
            </span>
          </div>
        </div>

        <Badge className={`${config.bg} text-white text-[10px] px-2 py-0.5 font-bold`}>
          {prioridadeLabel}
        </Badge>
      </div>

      {/* 🧠 Diagnóstico IA: O "Porquê" da Atenção (Turning Point) */}
      <div className={`pl-3 mb-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border-l-4 ${config.border}`}>
        <div className="flex items-start gap-2">
          <AlertCircle className={`w-4 h-4 ${config.text} flex-shrink-0 mt-0.5`} />
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1">
              Causa Raiz (IA)
            </p>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {rootCause}
            </p>
          </div>
        </div>
      </div>

      {/* 📊 Mini Scores de Saúde */}
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

      {/* 🎯 Ações Rápidas (visíveis no hover) */}
      <div className="pl-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
            Copiar Sugestão IA
          </Button>
        )}
        
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            if (onAbrirConversa) {
              onAbrirConversa(contato);
            }
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <MessageSquare className="w-4 h-4" />
        </Button>
      </div>

      {/* Preview da mensagem sugerida (tooltip ao copiar) */}
      {suggestedMessage && (
        <div className="pl-3 mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded text-[10px] text-slate-600 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="font-semibold mb-1">💡 Sugestão da IA:</p>
          <p className="line-clamp-2">{suggestedMessage}</p>
        </div>
      )}
    </div>
  );
}