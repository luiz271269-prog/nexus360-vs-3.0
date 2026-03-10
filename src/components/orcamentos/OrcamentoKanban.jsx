import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Edit, Calendar, DollarSign, User, Filter, Brain, MessageSquare, Building2, Handshake, Zap, Flame } from 'lucide-react';
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from 'sonner';

const statusLabels = {
  rascunho: 'Rascunho',
  aguardando_cotacao: 'Aguard. Cotação',
  analisando: 'Analisando',
  liberado: 'Liberado',
  enviado: 'Enviado',
  negociando: 'Negociando',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
  vencido: 'Vencido'
};

// ✨ GRADIENTES ULTRA MODERNOS - SISTEMA DE ESQUENTAMENTO VIBRANTE
const statusGradients = {
  // 🧊 ETAPA INTERNA - Progressão de Frio para Quente (Cores Vibrantes)
  rascunho: {
    card: 'bg-gradient-to-br from-indigo-100 via-blue-50 to-cyan-100',
    border: 'border-indigo-300',
    hover: 'hover:from-indigo-200 hover:via-blue-100 hover:to-cyan-200',
    shadow: 'shadow-indigo-300/60',
    ring: 'ring-indigo-500',
    glow: 'shadow-xl shadow-indigo-400/30',
    temp: '❄️ Frio'
  },
  aguardando_cotacao: {
    card: 'bg-gradient-to-br from-sky-100 via-cyan-100 to-teal-100',
    border: 'border-sky-400',
    hover: 'hover:from-sky-200 hover:via-cyan-200 hover:to-teal-200',
    shadow: 'shadow-sky-400/70',
    ring: 'ring-sky-500',
    glow: 'shadow-xl shadow-sky-500/40',
    temp: '🌡️ Morno'
  },
  analisando: {
    card: 'bg-gradient-to-br from-violet-100 via-purple-100 to-pink-100',
    border: 'border-violet-400',
    hover: 'hover:from-violet-200 hover:via-purple-200 hover:to-pink-200',
    shadow: 'shadow-violet-400/70',
    ring: 'ring-violet-600',
    glow: 'shadow-xl shadow-violet-500/50',
    temp: '🔥 Aquecendo'
  },
  liberado: {
    card: 'bg-gradient-to-br from-emerald-100 via-teal-100 to-green-100',
    border: 'border-emerald-500',
    hover: 'hover:from-emerald-200 hover:via-teal-200 hover:to-green-200',
    shadow: 'shadow-emerald-500/80',
    ring: 'ring-emerald-600',
    glow: 'shadow-2xl shadow-emerald-500/60',
    temp: '🔥 Quente'
  },
  // 🔥 ETAPA DE NEGOCIAÇÃO - Esquentamento Explosivo (Cores Intensas)
  enviado: {
    card: 'bg-gradient-to-br from-amber-100 via-yellow-100 to-orange-100',
    border: 'border-amber-500',
    hover: 'hover:from-amber-200 hover:via-yellow-200 hover:to-orange-200',
    shadow: 'shadow-amber-500/70',
    ring: 'ring-amber-600',
    glow: 'shadow-2xl shadow-amber-500/50',
    temp: '⚡ Energizado'
  },
  negociando: {
    card: 'bg-gradient-to-br from-orange-100 via-red-100 to-rose-100',
    border: 'border-orange-600',
    hover: 'hover:from-orange-200 hover:via-red-200 hover:to-rose-200',
    shadow: 'shadow-orange-600/80',
    ring: 'ring-orange-700',
    glow: 'shadow-2xl shadow-orange-600/70',
    temp: '🔥 Fervendo'
  },
  aprovado: {
    card: 'bg-gradient-to-br from-green-100 via-emerald-100 to-teal-100',
    border: 'border-green-600',
    hover: 'hover:from-green-200 hover:via-emerald-200 hover:to-teal-200',
    shadow: 'shadow-green-600/90',
    ring: 'ring-green-700',
    glow: 'shadow-2xl shadow-green-600/80 animate-pulse',
    temp: '✨ Explosão'
  },
  rejeitado: {
    card: 'bg-gradient-to-br from-red-100 via-pink-100 to-rose-100',
    border: 'border-red-500',
    hover: 'hover:from-red-200 hover:via-pink-200 hover:to-rose-200',
    shadow: 'shadow-red-500/70',
    ring: 'ring-red-600',
    glow: 'shadow-xl shadow-red-500/40',
    temp: '❄️ Congelado'
  },
  vencido: {
    card: 'bg-gradient-to-br from-slate-100 via-gray-100 to-stone-100',
    border: 'border-slate-500',
    hover: 'hover:from-slate-200 hover:via-gray-200 hover:to-stone-200',
    shadow: 'shadow-slate-500/60',
    ring: 'ring-slate-600',
    glow: 'shadow-xl shadow-slate-600/50',
    temp: '🧊 Inativo'
  }
};

const etapasFluxo = {
  interna: {
    title: 'Etapa Interna',
    subtitle: 'Sistema • Compras • Gerência',
    statuses: ['rascunho', 'aguardando_cotacao', 'analisando', 'liberado'],
    color: 'from-cyan-400 via-blue-500 to-purple-600',
    headerGradient: 'from-slate-900 via-blue-900 to-purple-900',
    icon: Building2,
    badgeGradient: 'from-cyan-400 via-blue-500 to-purple-600',
    containerBg: 'bg-gradient-to-br from-slate-900/5 via-blue-900/10 to-purple-900/5'
  },
  negociacao: {
    title: 'Etapa de Negociação',
    subtitle: 'Vendedor • Cliente',
    statuses: ['enviado', 'negociando', 'aprovado', 'rejeitado', 'vencido'],
    color: 'from-yellow-400 via-orange-500 to-red-600',
    headerGradient: 'from-slate-900 via-orange-900 to-red-900',
    icon: Handshake,
    badgeGradient: 'from-yellow-400 via-orange-500 to-red-600',
    containerBg: 'bg-gradient-to-br from-amber-900/5 via-orange-900/10 to-red-900/5'
  }
};

export default function OrcamentoKanban({ orcamentos, onUpdateStatus, usuario, onEdit, onMostrarInsightsIA }) {
  const navigate = useNavigate();

  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    const novoStatus = destination.droppableId;

    if (typeof onUpdateStatus === 'function') {
      onUpdateStatus(draggableId, novoStatus);
      toast.success(`Orçamento movido para "${statusLabels[novoStatus] || novoStatus}"`);
    } else {
      console.error('onUpdateStatus não é uma função', onUpdateStatus);
      toast.error('Erro ao mover orçamento: função de atualização não disponível.');
    }
  };

  const formatCurrency = (value) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' });
  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  // Agrupar por status (directly use 'orcamentos' as there are no filters)
  const allStatusesFromEtapas = Object.values(etapasFluxo).flatMap((e) => e.statuses);
  const orcamentosPorStatus = allStatusesFromEtapas.reduce((acc, status) => {
    acc[status] = orcamentos.filter((o) => o.status === status);
    return acc;
  }, {});

  const abrirWhatsAppComContexto = async (orcamento) => {
    try {
      console.log('[KANBAN] 📱 Abrindo WhatsApp com contexto:', orcamento);

      const telefone = orcamento.cliente_telefone || orcamento.cliente_celular;

      if (!telefone || telefone.trim() === '') {
        toast.error('❌ Número de WhatsApp não encontrado', {
          description: 'Este orçamento não possui telefone cadastrado. Edite o cadastro do cliente.',
          duration: 5000
        });
        return;
      }

      const telefoneNormalizado = telefone.replace(/\D/g, '');

      if (telefoneNormalizado.length < 10) {
        toast.error('❌ Número de telefone inválido', {
          description: 'O número precisa ter pelo menos 10 dígitos.',
          duration: 5000
        });
        return;
      }

      const contexto = {
        orcamentoId: orcamento.id,
        orcamentoNumero: orcamento.numero_orcamento,
        clienteNome: orcamento.cliente_nome,
        clienteTelefone: telefoneNormalizado,
        valorTotal: orcamento.valor_total,
        origem: 'pipeline_orcamentos'
      };

      console.log('[KANBAN] 📦 Contexto preparado:', contexto);

      const urlParams = new URLSearchParams({
        orcamentoId: contexto.orcamentoId,
        clienteTelefone: contexto.clienteTelefone,
        clienteNome: contexto.clienteNome,
        orcamentoNumero: contexto.orcamentoNumero || '',
        valorTotal: contexto.valorTotal || 0
      });

      const urlComunicacao = `${createPageUrl('Comunicacao')}?${urlParams.toString()}`;

      toast.success('📱 Abrindo WhatsApp...', {
        description: `Iniciando conversa com ${contexto.clienteNome}`,
        duration: 2000
      });

      navigate(urlComunicacao);

    } catch (error) {
      console.error('[KANBAN] ❌ Erro ao abrir WhatsApp:', error);
      toast.error('Erro ao abrir WhatsApp', {
        description: error.message,
        duration: 5000
      });
    }
  };

  // Renderizar Kanban para uma etapa específica (sem DragDropContext — está no pai)
  const renderKanbanEtapa = (etapaConfig) => (
    <div
        className="grid gap-3 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100"
        style={{ gridTemplateColumns: `repeat(${etapaConfig.statuses.length}, minmax(250px, 1fr))` }}
      >
        {etapaConfig.statuses.map((status) => {
          const orcamentosStatus = orcamentosPorStatus[status];
          const totalValor = orcamentosStatus.reduce((sum, o) => sum + (o.valor_total || 0), 0);
          const gradient = statusGradients[status];

          return (
            <div key={status} className="flex flex-col">
              {/* Header da Coluna - GRADIENTE MODERNO FUTURISTA */}
              <div
                className={`bg-gradient-to-r ${etapaConfig.headerGradient} p-2.5 rounded-t-xl shadow-2xl border-b-4 border-opacity-80`}
                style={{ borderColor: `var(--${status}-color, #f59e0b)` }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-xs text-white truncate">{statusLabels[status]}</h3>
                    <span className="text-[8px] opacity-70 text-white">{gradient.temp}</span>
                  </div>
                  <Badge className={`bg-gradient-to-r ${etapaConfig.badgeGradient} text-white text-[10px] h-5 px-2 font-bold border-0 shadow-lg animate-pulse`}>
                    {orcamentosStatus.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-amber-300" />
                  <span className="text-[11px] text-amber-200 font-bold">
                    {formatCurrency(totalValor)}
                  </span>
                </div>
              </div>

              {/* Droppable Area */}
              <Droppable droppableId={status}>
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="bg-slate-50 p-2 rounded-b-xl border-l-4 border-r-4 border-b-4 border-indigo-300 min-h-[500px] space-y-2 shadow-xl shadow-indigo-400/30 transition-all duration-300 flex-1"
                  >
                    {orcamentosStatus.map((orcamento, index) => (
                      <Draggable key={orcamento.id} draggableId={orcamento.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.dragHandleProps}
                            {...provided.draggableProps}
                            className={`
                              ${gradient.card} ${gradient.hover}
                              p-2 rounded-xl border-2 ${gradient.border} 
                              ${gradient.shadow}
                              transition-all duration-300 cursor-pointer
                              ${snapshot.isDragging ? `ring-4 ${gradient.ring} shadow-2xl rotate-3 scale-110 ${gradient.glow}` : `hover:shadow-xl hover:scale-105 ${gradient.glow}`}
                              relative overflow-hidden
                              backdrop-blur-sm
                            `}
                          >

                            {/* Efeito de brilho no hover - NEON */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/30 to-white/0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

                            {/* Animação de pulso no canto */}
                            {status === 'negociando' &&
                              <div className="absolute top-1 right-1">
                                <Flame className="w-3 h-3 text-orange-500 animate-pulse" />
                              </div>
                            }
                            {status === 'aprovado' &&
                              <div className="absolute top-1 right-1">
                                <Zap className="w-3 h-3 text-green-500 animate-bounce" />
                              </div>
                            }

                            {/* Conteúdo do Card */}
                            <div className="relative z-10">
                              {/* Header do Card */}
                              <div className="flex items-start justify-between mb-1.5">
                                <h4 className="font-bold text-slate-900 text-[11px] leading-tight line-clamp-2 flex-1">
                                  {orcamento.cliente_nome}
                                </h4>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-500 hover:text-orange-600 hover:bg-white/50 p-0">
                                      <MoreHorizontal className="w-3.5 h-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="text-xs">
                                    <DropdownMenuItem onClick={() => onEdit && onEdit(orcamento)} className="text-xs py-1.5">
                                      <Edit className="w-3.5 h-3.5 mr-1.5" />
                                      Editar
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              {/* Informações */}
                              <div className="space-y-1 mb-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-slate-600 font-medium">
                                    #{orcamento.numero_orcamento?.slice(-4) || orcamento.id?.slice(-4)}
                                  </span>
                                  <div className="font-bold bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent text-[11px]">
                                    {formatCurrency(orcamento.valor_total)}
                                  </div>
                                </div>

                                {orcamento.vendedor &&
                                  <div className="flex items-center gap-1 text-[10px] text-slate-700">
                                    <User className="w-3 h-3" />
                                    <span className="truncate font-medium">{orcamento.vendedor}</span>
                                  </div>
                                }

                                {orcamento.data_orcamento &&
                                  <div className="flex items-center gap-1 text-[10px] text-slate-600">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(orcamento.data_orcamento)}
                                  </div>
                                }
                              </div>

                              {/* Badges */}
                              {orcamento.probabilidade &&
                                <div className="mb-1.5">
                                  <Badge
                                    variant="outline"
                                    className={`text-[9px] px-1.5 py-0.5 h-4 font-bold shadow-sm ${
                                      orcamento.probabilidade === 'Alta' ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-400' :
                                      orcamento.probabilidade === 'Média' ? 'bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800 border-yellow-400' :
                                      'bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border-red-400'}`
                                    }>

                                    {orcamento.probabilidade}
                                  </Badge>
                                </div>
                              }

                              {/* Botões de Ação */}
                              <div className="flex gap-1 pt-1.5 border-t border-slate-300/50">
                                {onMostrarInsightsIA &&
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onMostrarInsightsIA(orcamento);
                                    }}
                                    size="sm"
                                    className="flex-1 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:via-indigo-700 hover:to-blue-700 text-white text-[10px] h-6 px-1 shadow-md">

                                    <Brain className="w-3 h-3 mr-0.5" />
                                    IA
                                  </Button>
                                }

                                {abrirWhatsAppComContexto &&
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      abrirWhatsAppComContexto(orcamento);
                                    }}
                                    size="sm"
                                    className="flex-1 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 text-white text-[10px] h-6 px-1 shadow-md"
                                    title="Abrir conversa com cliente">

                                    <MessageSquare className="w-3 h-3 mr-0.5" />
                                    Msg
                                  </Button>
                                }
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
  );


  return (
    <DragDropContext onDragEnd={onDragEnd}>
    <div className="space-y-4">
      {/* Kanban Board - COM ABAS FUTURISTAS ESTILO MENU PRINCIPAL */}
      <Tabs defaultValue="interna" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-1 rounded-xl shadow-2xl border border-slate-700">
          {Object.entries(etapasFluxo).map(([key, etapa]) => {
            const IconComponent = etapa.icon;
            const totalEtapa = etapa.statuses.reduce((sum, status) => {
              return sum + (orcamentosPorStatus[status]?.length || 0);
            }, 0);
            const valorTotalEtapa = etapa.statuses.reduce((sum, status) => {
              return sum + (orcamentosPorStatus[status]?.reduce((s, o) => s + (o.valor_total || 0), 0) || 0);
            }, 0);

            return (
              <TabsTrigger
                key={key}
                value={key}
                className="
                  relative px-4 py-3 text-sm font-medium rounded-lg
                  transition-all duration-300 transform
                  data-[state=inactive]:text-slate-400 
                  data-[state=inactive]:hover:text-slate-200
                  data-[state=inactive]:hover:bg-slate-800/50
                  data-[state=active]:bg-gradient-to-r 
                  data-[state=active]:from-amber-400 
                  data-[state=active]:via-orange-500 
                  data-[state=active]:to-red-500
                  data-[state=active]:text-white
                  data-[state=active]:shadow-xl
                  data-[state=active]:shadow-orange-500/30
                  data-[state=active]:scale-105
                  flex items-center justify-between gap-3
                ">
                {/* Lado Esquerdo: Ícone + Título */}
                <div className="flex items-center gap-2">
                  <IconComponent className="w-5 h-5 flex-shrink-0" />
                  <span className="font-bold text-sm leading-tight whitespace-nowrap">{etapa.title}</span>
                </div>

                {/* Lado Direito: Métricas em linha */}
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold">{totalEtapa}</span>
                    <span className="opacity-75">orçamentos</span>
                  </div>
                  <span className="opacity-50">•</span>
                  <span className="font-semibold">{formatCurrency(valorTotalEtapa)}</span>
                </div>

                {/* Efeito de Brilho ao Ativar */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 data-[state=active]:opacity-100 rounded-lg pointer-events-none transition-opacity duration-300" />
              </TabsTrigger>
            );

          })}
        </TabsList>

        {Object.entries(etapasFluxo).map(([key, etapa]) =>
          <TabsContent key={key} value={key} className="mt-6">
            {/* Container com Fundo Moderno e Vibrante */}
            <div className={`${etapa.containerBg} rounded-2xl p-6 border-2 border-white/50 shadow-2xl backdrop-blur-sm`}>
              {/* Kanban Board - SEM HEADER */}
              {renderKanbanEtapa(etapa)}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}