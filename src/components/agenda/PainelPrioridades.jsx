import React, { useRef, useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ListTodo, Flame, Star, Zap, TrendingUp, Filter } from 'lucide-react';

export default function PainelPrioridades({ tarefas = [], tarefaSelecionada, onSelectTarefa, loading }) {

  const getPriorityInfo = (prioridade) => {
    switch (prioridade) {
      case 'critica': return { icon: Flame, color: 'text-red-500', bg: 'bg-red-50' };
      case 'alta': return { icon: Star, color: 'text-amber-500', bg: 'bg-amber-50' };
      case 'media': return { icon: Zap, color: 'text-blue-500', bg: 'bg-blue-50' };
      default: return { icon: TrendingUp, color: 'text-slate-500', bg: 'bg-slate-50' };
    }
  };

  const getTipoLabel = (tipo) => {
    const labels = {
      'ligacao_urgente': 'Ligação Urgente',
      'follow_up_orcamento': 'Follow-up',
      'reuniao_fechamento': 'Reunião',
      'reativacao_cliente': 'Reativação',
      'envio_proposta': 'Proposta',
      'negociacao': 'Negociação'
    };
    return labels[tipo] || tipo || 'Tarefa';
  };

  // Garantir que tarefas é sempre um array
  const tarefasSeguras = Array.isArray(tarefas) ? tarefas : [];

  return (
    <Card className="h-full flex flex-col shadow-xl border-slate-200">
      <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-white">
        <CardTitle className="flex items-center gap-2">
          <ListTodo className="w-5 h-5 text-indigo-600" />
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Fila de Ações Prioritárias
          </span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto px-2 pb-2 pt-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
              <p className="text-slate-500 text-sm">Carregando tarefas...</p>
            </div>
          </div>
        ) : tarefasSeguras.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
            <ListTodo className="w-12 h-12 mb-4 opacity-50" />
            <h3 className="font-semibold text-lg">Nenhuma tarefa pendente</h3>
            <p className="text-sm mt-2">Clique em "Gerar Tarefas IA" para analisar seus clientes</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tarefasSeguras.map(tarefa => {
              // Proteção: verificar se tarefa existe e tem os campos necessários
              if (!tarefa || !tarefa.id) {
                return null;
              }

              const prioridade = tarefa.prioridade || 'media';
              const { icon: Icon, color, bg } = getPriorityInfo(prioridade);
              const isSelected = tarefaSelecionada?.id === tarefa.id;
              
              // Calcular dias até o prazo com proteção
              let diasAtePrazo = 0;
              let prazoTexto = 'Sem prazo';
              
              if (tarefa.data_prazo) {
                try {
                  diasAtePrazo = Math.ceil((new Date(tarefa.data_prazo) - new Date()) / (1000 * 60 * 60 * 24));
                  prazoTexto = diasAtePrazo === 0 ? 'Hoje' : diasAtePrazo < 0 ? 'Atrasada' : `${diasAtePrazo}d`;
                } catch (error) {
                  console.error('Erro ao calcular prazo:', error);
                  prazoTexto = 'Sem prazo';
                }
              }

              return (
                <button 
                  key={tarefa.id} 
                  onClick={() => onSelectTarefa && onSelectTarefa(tarefa)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-200 ${
                    isSelected 
                      ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-400 shadow-lg scale-[1.02]' 
                      : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-indigo-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className={`font-semibold text-sm ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                        {tarefa.titulo || 'Sem título'}
                      </p>
                      <p className={`text-xs mt-1 ${isSelected ? 'text-indigo-700' : 'text-slate-600'}`}>
                        {tarefa.cliente_nome || 'Cliente não especificado'}
                      </p>
                    </div>
                    <div className={`p-2 rounded-lg ${bg}`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs capitalize bg-white">
                      {getTipoLabel(tarefa.tipo_tarefa)}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        diasAtePrazo < 0 ? 'bg-red-50 text-red-700 border-red-200' : 
                        diasAtePrazo === 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                        'bg-slate-50 text-slate-600'
                      }`}
                    >
                      {prazoTexto}
                    </Badge>
                    
                    {/* Indicador de Confiança da IA */}
                    {tarefa.contexto_ia?.confianca_ia && (
                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                        🤖 {tarefa.contexto_ia.confianca_ia}%
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}