import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MoreHorizontal, Edit, Calendar, DollarSign, User, Filter, Brain, MessageSquare, Building2, Handshake, X } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from "@/api/base44Client";

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

const statusGradients = {
  rascunho:         { border: 'border-indigo-300', ring: 'ring-indigo-500', temp: '❄️ Frio' },
  aguardando_cotacao:{ border: 'border-sky-400',   ring: 'ring-sky-500',   temp: '🌡️ Morno' },
  analisando:       { border: 'border-violet-400', ring: 'ring-violet-600', temp: '🔥 Aquecendo' },
  liberado:         { border: 'border-emerald-500',ring: 'ring-emerald-600',temp: '🔥 Quente' },
  enviado:          { border: 'border-amber-500',  ring: 'ring-amber-600',  temp: '⚡ Energizado' },
  negociando:       { border: 'border-orange-600', ring: 'ring-orange-700', temp: '🔥 Fervendo' },
  aprovado:         { border: 'border-green-600',  ring: 'ring-green-700',  temp: '✨ Explosão' },
  rejeitado:        { border: 'border-red-500',    ring: 'ring-red-600',    temp: '❄️ Congelado' },
  vencido:          { border: 'border-slate-500',  ring: 'ring-slate-600',  temp: '🧊 Inativo' }
};

const etapasFluxo = {
  interna: {
    title: 'Etapa Interna',
    statuses: ['rascunho', 'aguardando_cotacao', 'analisando', 'liberado'],
    headerGradient: 'from-slate-900 via-blue-900 to-purple-900',
    icon: Building2,
    badgeGradient: 'from-cyan-400 via-blue-500 to-purple-600',
    containerBg: 'bg-gradient-to-br from-slate-900/5 via-blue-900/10 to-purple-900/5'
  },
  negociacao: {
    title: 'Etapa de Negociação',
    statuses: ['enviado', 'negociando', 'aprovado', 'rejeitado', 'vencido'],
    headerGradient: 'from-slate-900 via-orange-900 to-red-900',
    icon: Handshake,
    badgeGradient: 'from-yellow-400 via-orange-500 to-red-600',
    containerBg: 'bg-gradient-to-br from-amber-900/5 via-orange-900/10 to-red-900/5'
  }
};

const formatCurrency = (value) =>
  (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' });

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

// ─── Card memorizado ──────────────────────────────────────────────────────────
const OrcamentoCard = React.memo(({ orcamento, index, gradient, onEdit, onMostrarInsightsIA, onAbrirChat }) => {
  return (
    <Draggable draggableId={orcamento.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{
            ...provided.draggableProps.style,
            // ✅ Remove transições CSS durante o drag — evita o "rubber band"
            transition: snapshot.isDragging ? 'none' : provided.draggableProps.style?.transition,
          }}
          className={`bg-white rounded-lg border ${gradient.border} hover:shadow-md cursor-grab active:cursor-grabbing group ${
            snapshot.isDragging ? 'shadow-2xl ring-2 ' + gradient.ring + ' rotate-1 opacity-95 scale-105 z-50' : ''
          }`}
        >
          <div className="p-2 space-y-1.5">
            <div className="flex items-start justify-between gap-1">
              <h4 className="font-semibold text-slate-800 text-[11px] leading-tight truncate flex-1 uppercase">
                {orcamento.cliente_nome || '—'}
              </h4>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost" size="icon"
                    className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 flex-shrink-0"
                    // ✅ Impede que o menu dispare o drag
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-xs">
                  <DropdownMenuItem onClick={() => onEdit?.(orcamento)} className="text-xs py-1.5">
                    <Edit className="w-3 h-3 mr-1.5" /> Editar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-400">
                {orcamento.numero_orcamento ? `#${orcamento.numero_orcamento}` : `#${orcamento.id?.slice(-4)}`}
              </span>
              <span className="text-[11px] font-bold text-green-600">
                {formatCurrency(orcamento.valor_total)}
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500">
              {orcamento.vendedor && (
                <div className="flex items-center gap-0.5">
                  <User className="w-2.5 h-2.5" />
                  <span className="truncate max-w-[70px]">{(orcamento.vendedor || '').split(' ')[0]}</span>
                </div>
              )}
              {orcamento.data_orcamento && (
                <div className="flex items-center gap-0.5 ml-auto">
                  <Calendar className="w-2.5 h-2.5" />
                  <span>{formatDate(orcamento.data_orcamento)}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 pt-1 border-t border-slate-100">
              {orcamento.probabilidade && (
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
                  orcamento.probabilidade === 'Alta'  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  orcamento.probabilidade === 'Média' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-red-50 text-red-700 border-red-200'
                }`}>{orcamento.probabilidade}</span>
              )}
              <div className="ml-auto flex gap-1">
                {onMostrarInsightsIA && (
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onMostrarInsightsIA(orcamento); }}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded text-[9px] font-semibold border border-indigo-200"
                  >
                    <Brain className="w-2.5 h-2.5" /> IA
                  </button>
                )}
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onAbrirChat(orcamento); }}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 bg-green-500 hover:bg-green-600 text-white rounded text-[9px] font-semibold"
                >
                  <MessageSquare className="w-2.5 h-2.5" /> Msg
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
});
OrcamentoCard.displayName = 'OrcamentoCard';

// ─── Coluna Droppable memorizada ──────────────────────────────────────────────
const KanbanColumn = React.memo(({ status, etapaConfig, orcamentos: colOrcamentos, onEdit, onMostrarInsightsIA, onAbrirChat }) => {
  const gradient = statusGradients[status];
  const totalValor = useMemo(() => colOrcamentos.reduce((s, o) => s + (o.valor_total || 0), 0), [colOrcamentos]);

  return (
    <div className="flex flex-col min-w-[190px]">
      <div className={`bg-gradient-to-r ${etapaConfig.headerGradient} p-2.5 rounded-t-xl shadow-xl`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <h3 className="font-bold text-xs text-white truncate">{statusLabels[status]}</h3>
            <span className="text-[8px] opacity-60 text-white">{gradient.temp}</span>
          </div>
          <Badge className={`bg-gradient-to-r ${etapaConfig.badgeGradient} text-white text-[10px] h-5 px-2 font-bold border-0`}>
            {colOrcamentos.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <DollarSign className="w-3 h-3 text-amber-300" />
          <span className="text-[11px] text-amber-200 font-bold">{formatCurrency(totalValor)}</span>
        </div>
      </div>

      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`p-2 rounded-b-xl border-l-4 border-r-4 border-b-4 ${gradient.border} min-h-[500px] space-y-2 flex-1 transition-colors duration-150 ${
              snapshot.isDraggingOver ? 'bg-orange-50' : 'bg-slate-50'
            }`}
          >
            {colOrcamentos.map((orc, index) => (
              <OrcamentoCard
                key={orc.id}
                orcamento={orc}
                index={index}
                gradient={gradient}
                onEdit={onEdit}
                onMostrarInsightsIA={onMostrarInsightsIA}
                onAbrirChat={onAbrirChat}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
});
KanbanColumn.displayName = 'KanbanColumn';

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function OrcamentoKanbanOptimized({ orcamentos: orcamentosProps, onUpdateStatus, usuario, onEdit, onMostrarInsightsIA }) {
  const [chatAberto, setChatAberto] = useState(false);
  const [orcamentoChat, setOrcamentoChat] = useState(null);
  const [filtroVendedor, setFiltroVendedor] = useState('todos');

  // ✅ OPTIMISTIC STATE: estado local que antecipa a mudança sem esperar o servidor
  const [localOrcamentos, setLocalOrcamentos] = useState(null);

  // Sincroniza quando chegam novos dados do servidor
  const orcamentos = localOrcamentos ?? orcamentosProps;

  // Quando props mudam (fetch concluído), limpa o estado local
  useEffect(() => {
    setLocalOrcamentos(null);
  }, [orcamentosProps]);

  const isAdmin = usuario?.role === 'admin';

  const pertenceAoUsuario = useCallback((orcamento) => {
    if (!usuario) return false;
    const v = (orcamento.vendedor || '').toLowerCase().trim();
    const fn = (usuario.full_name || '').toLowerCase().trim();
    const el = (usuario.email || '').toLowerCase().split('@')[0];
    const ep = el.split(/[\.\-\_]/)[0];
    return v === fn || v === el || v === ep || fn.includes(v) || v.includes(ep);
  }, [usuario]);

  const orcamentosFiltrados = useMemo(() => {
    return orcamentos.filter(o => {
      if (isAdmin) return filtroVendedor === 'todos' ? true : o.vendedor === filtroVendedor;
      return pertenceAoUsuario(o);
    });
  }, [orcamentos, isAdmin, filtroVendedor, pertenceAoUsuario]);

  const orcamentosPorStatus = useMemo(() => {
    const todos = Object.values(etapasFluxo).flatMap(e => e.statuses);
    return todos.reduce((acc, status) => {
      acc[status] = orcamentosFiltrados.filter(o => o.status === status);
      return acc;
    }, {});
  }, [orcamentosFiltrados]);

  const vendedoresUnicos = useMemo(() =>
    isAdmin ? [...new Set(orcamentos.map(o => (o.vendedor || '').trim()).filter(Boolean))].sort() : []
  , [orcamentos, isAdmin]);

  // ✅ DRAG com confirmação: o card fica na nova posição SÓ após sucesso do servidor
  const onDragEnd = useCallback(async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const novoStatus = destination.droppableId;
    const statusAnterior = source.droppableId;

    // 1. Atualiza LOCAL imediatamente (feedback visual instantâneo)
    setLocalOrcamentos(prev => {
      const base = prev ?? orcamentosProps;
      return base.map(o => o.id === draggableId ? { ...o, status: novoStatus } : o);
    });

    // 2. Envia para servidor e AGUARDA confirmação
    if (typeof onUpdateStatus === 'function') {
      try {
        // Aguarda a resposta do servidor (await)
        await onUpdateStatus(draggableId, novoStatus);
        toast.success(`Movido para "${statusLabels[novoStatus] || novoStatus}"`);
      } catch (error) {
        console.error('Erro ao mover orçamento:', error);
        // Se falhar, reverte para a posição anterior
        setLocalOrcamentos(prev => {
          const base = prev ?? orcamentosProps;
          return base.map(o => o.id === draggableId ? { ...o, status: statusAnterior } : o);
        });
        toast.error('Erro ao mover orçamento. Revertendo...');
      }
    }
  }, [onUpdateStatus, orcamentosProps]);

  const onAbrirChat = useCallback(async (orcamento) => {
    const telefone = orcamento.cliente_telefone || orcamento.cliente_celular;
    if (!telefone) { toast.error('Telefone não cadastrado'); return; }
    try {
      const contatos = await base44.entities.Contact.filter({ telefone_canonico: telefone.replace(/\D/g, '') });
      if (contatos?.length > 0) {
        setOrcamentoChat({ ...orcamento, contact_id: contatos[0].id });
        setChatAberto(true);
      } else {
        toast.error('Contato não encontrado');
      }
    } catch { toast.error('Erro ao buscar contato'); }
  }, []);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="space-y-4">

        {/* Chat flutuante */}
        {chatAberto && orcamentoChat && (
          <div className="fixed inset-0 bg-black/30 z-40 flex items-end md:items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full md:w-96 h-[500px] flex flex-col border border-slate-200">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 rounded-t-2xl flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">{orcamentoChat.cliente_nome}</h3>
                <button onClick={() => setChatAberto(false)} className="text-white hover:bg-white/20 p-1 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 bg-slate-50 flex items-center justify-center text-slate-500 text-sm">
                💬 Abrindo conversa com {orcamentoChat.cliente_nome}...
              </div>
            </div>
          </div>
        )}

        {/* Filtro de vendedor (admin) */}
        {isAdmin && (
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg border border-slate-200">
            <Filter className="w-4 h-4 text-slate-600" />
            <label className="text-xs font-medium text-slate-600">Filtrar por Vendedor:</label>
            <select
              value={filtroVendedor}
              onChange={e => setFiltroVendedor(e.target.value)}
              className="text-xs px-2 py-1 border border-slate-300 rounded bg-white cursor-pointer hover:border-orange-400 focus:ring-2 focus:ring-orange-400"
            >
              <option value="todos">Todos os Vendedores</option>
              {vendedoresUnicos.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        )}

        {/* Tabs por etapa */}
        <Tabs defaultValue="negociacao" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-1 rounded-xl shadow-2xl border border-slate-700">
            {Object.entries(etapasFluxo).map(([key, etapa]) => {
              const Icon = etapa.icon;
              const total = etapa.statuses.reduce((s, st) => s + (orcamentosPorStatus[st]?.length || 0), 0);
              const valor = etapa.statuses.reduce((s, st) => s + (orcamentosPorStatus[st]?.reduce((a, o) => a + (o.valor_total || 0), 0) || 0), 0);
              return (
                <TabsTrigger key={key} value={key}
                  className="relative px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200
                    data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:text-slate-200 data-[state=inactive]:hover:bg-slate-800/50
                    data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-400 data-[state=active]:via-orange-500 data-[state=active]:to-red-500
                    data-[state=active]:text-white data-[state=active]:shadow-xl data-[state=active]:shadow-orange-500/30
                    flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-bold text-sm whitespace-nowrap">{etapa.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold">{total}</span>
                    <span className="opacity-60">orç.</span>
                    <span className="opacity-40">•</span>
                    <span className="font-semibold">{formatCurrency(valor)}</span>
                  </div>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {Object.entries(etapasFluxo).map(([key, etapa]) => (
            <TabsContent key={key} value={key} className="mt-4">
              <div className={`${etapa.containerBg} rounded-2xl p-4 border-2 border-white/50 shadow-2xl`}>
                <div
                  className="flex gap-3 overflow-x-auto pb-4"
                  style={{ minHeight: 560 }}
                >
                  {etapa.statuses.map(status => (
                    <KanbanColumn
                      key={status}
                      status={status}
                      etapaConfig={etapa}
                      orcamentos={orcamentosPorStatus[status] || []}
                      onEdit={onEdit}
                      onMostrarInsightsIA={onMostrarInsightsIA}
                      onAbrirChat={onAbrirChat}
                    />
                  ))}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DragDropContext>
  );
}