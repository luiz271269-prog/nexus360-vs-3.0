import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Edit, Calendar, DollarSign, User, Filter, MessageSquare, Building2, Handshake, Zap, Flame, Hash, TrendingUp, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import KanbanChatWindow from './KanbanChatWindow';

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
  const [chatAberto, setChatAberto] = useState(false);
  const [orcamentoChatAtivo, setOrcamentoChatAtivo] = useState(null);
  const [filtroVendedor, setFiltroVendedor] = useState('todos');

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

  // ✅ FILTRO POR USUÁRIO: Mostrar apenas orçamentos do usuário ou todos (admin)
  const isAdmin = usuario?.role === 'admin';
  const vendedorAtual = usuario?.full_name || usuario?.email?.split('@')[0];
  
  const orcamentosFiltrados = orcamentos.filter(o => {
    // Admin vê todos, ou filtra por vendedor específico se selecionado
    if (isAdmin) {
      return filtroVendedor === 'todos' ? true : o.vendedor === filtroVendedor;
    }
    // Usuário normal vê apenas seus orçamentos (match por full_name ou email)
    return o.vendedor === vendedorAtual;
  });

  // Agrupar por status (com filtro aplicado)
  const allStatusesFromEtapas = Object.values(etapasFluxo).flatMap((e) => e.statuses);
  const orcamentosPorStatus = allStatusesFromEtapas.reduce((acc, status) => {
    acc[status] = orcamentosFiltrados.filter((o) => o.status === status);
    return acc;
  }, {});

  // Lista de vendedores únicos para filtro (apenas admin)
  const vendedoresUnicos = isAdmin ? [...new Set(orcamentos.map(o => o.vendedor).filter(Boolean))] : [];

  const abrirChatComCliente = (orcamento) => {
    setOrcamentoChatAtivo(orcamento);
    setChatAberto(true);
  };

  // Renderizar Kanban para uma etapa específica
  const renderKanbanEtapa = (etapaConfig) => (
    <div
      className="flex gap-3 overflow-x-auto pb-4"
      style={{ minHeight: '600px' }}
    >
      {etapaConfig.statuses.map((status) => {
        const orcamentosStatus = orcamentosPorStatus[status];
        const totalValor = orcamentosStatus.reduce((sum, o) => sum + (o.valor_total || 0), 0);
        const gradient = statusGradients[status];

        return (
          <div key={status} className="flex flex-col flex-shrink-0 w-64">
            {/* Header da Coluna */}
            <div className={`bg-gradient-to-r ${etapaConfig.headerGradient} px-3 py-2.5 rounded-t-xl shadow-lg`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">{statusLabels[status]}</h3>
                  <span className="text-[9px] text-white/60">{gradient.temp}</span>
                </div>
                <span className={`bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full`}>
                  {orcamentosStatus.length}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <DollarSign className="w-3 h-3 text-amber-300" />
                <span className="text-xs text-amber-200 font-semibold">{formatCurrency(totalValor)}</span>
              </div>
            </div>

            {/* Droppable Area */}
            <Droppable droppableId={status}>
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={`
                    flex-1 p-2 rounded-b-xl border-x-2 border-b-2 ${gradient.border}
                    min-h-[520px] space-y-2 transition-colors duration-200
                    ${snapshot.isDraggingOver ? 'bg-blue-50/80 border-dashed' : 'bg-slate-100/80'}
                  `}
                >
                  {orcamentosStatus.map((orcamento, index) => (
                    <Draggable key={orcamento.id} draggableId={orcamento.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`
                            bg-white rounded-xl border ${gradient.border}
                            shadow-sm transition-all duration-200 overflow-hidden
                            ${snapshot.isDragging
                              ? 'shadow-2xl ring-2 ring-orange-400 ring-offset-1 rotate-1 scale-105 opacity-95'
                              : 'hover:shadow-md hover:-translate-y-0.5'
                            }
                          `}
                        >
                          {/* Drag Handle - topo colorido clicável */}
                          <div
                            {...provided.dragHandleProps}
                            className={`${gradient.card} px-3 py-2 flex items-center justify-between cursor-grab active:cursor-grabbing`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <GripVertical className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <h4 className="font-bold text-slate-800 text-xs leading-tight truncate">
                                {orcamento.cliente_nome}
                              </h4>
                            </div>
                            <button
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); onEdit && onEdit(orcamento); }}
                              className="ml-1 p-1 rounded hover:bg-white/60 flex-shrink-0 transition-colors"
                            >
                              <Edit className="w-3 h-3 text-slate-500" />
                            </button>
                          </div>

                          {/* Corpo do Card */}
                          <div className="px-3 py-2 space-y-2">
                            {/* Valor em destaque */}
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-emerald-600 text-sm">
                                {formatCurrency(orcamento.valor_total)}
                              </span>
                              {orcamento.probabilidade && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                  orcamento.probabilidade === 'Alta' ? 'bg-green-100 text-green-700' :
                                  orcamento.probabilidade === 'Média' ? 'bg-amber-100 text-amber-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {orcamento.probabilidade}
                                </span>
                              )}
                            </div>

                            {/* Infos */}
                            <div className="space-y-1">
                              {orcamento.numero_orcamento && (
                                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                  <Hash className="w-2.5 h-2.5" />
                                  <span className="font-mono">{orcamento.numero_orcamento}</span>
                                </div>
                              )}
                              {orcamento.vendedor && (
                                <div className="flex items-center gap-1 text-[10px] text-slate-600">
                                  <User className="w-2.5 h-2.5 text-indigo-400" />
                                  <span className="truncate font-medium">{orcamento.vendedor}</span>
                                </div>
                              )}
                              {orcamento.data_orcamento && (
                                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                  <Calendar className="w-2.5 h-2.5 text-slate-400" />
                                  <span>{formatDate(orcamento.data_orcamento)}</span>
                                  {orcamento.data_vencimento && (
                                    <span className="text-red-400 ml-1">→ {formatDate(orcamento.data_vencimento)}</span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Status badge especial + botão msg */}
                            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                              {status === 'negociando' && (
                                <span className="flex items-center gap-1 text-[9px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-200">
                                  <Flame className="w-2.5 h-2.5" />Quente
                                </span>
                              )}
                              {status === 'aprovado' && (
                                <span className="flex items-center gap-1 text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200">
                                  <Zap className="w-2.5 h-2.5" />Fechado
                                </span>
                              )}
                              <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); e.preventDefault(); abrirChatComCliente(orcamento); }}
                                className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-white bg-green-500 hover:bg-green-600 px-2.5 py-1 rounded-lg transition-colors shadow-sm"
                              >
                                <MessageSquare className="w-3 h-3" />
                                Msg
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  {orcamentosStatus.length === 0 && !snapshot.isDraggingOver && (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-300">
                      <TrendingUp className="w-8 h-8 mb-2 opacity-40" />
                      <span className="text-xs">Arraste aqui</span>
                    </div>
                  )}
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
      <div className="space-y-4 relative">
        {/* Chat flutuante compacto */}
        {chatAberto && orcamentoChatAtivo && (
          <KanbanChatWindow
            orcamento={orcamentoChatAtivo}
            usuario={usuario}
            onClose={() => { setChatAberto(false); setOrcamentoChatAtivo(null); }}
          />
        )}

      {/* FILTRO POR VENDEDOR - Apenas para ADMIN */}
      {isAdmin && (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg border border-slate-200">
          <Filter className="w-4 h-4 text-slate-600" />
          <label className="text-xs font-medium text-slate-600">Filtrar por Vendedor:</label>
          <select
            value={filtroVendedor}
            onChange={(e) => setFiltroVendedor(e.target.value)}
            className="text-xs px-2 py-1 border border-slate-300 rounded bg-white cursor-pointer hover:border-orange-400 focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          >
            <option value="todos">Todos os Vendedores</option>
            {vendedoresUnicos.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
      )}

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
    </DragDropContext>
  );
}