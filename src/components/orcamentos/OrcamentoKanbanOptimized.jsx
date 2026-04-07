import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, DollarSign, User, Brain, Send, Building2, Handshake, Tags, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from "@/api/base44Client";
import OrcamentoTagModal from './OrcamentoTagModal';

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
  rascunho: { border: 'border-indigo-300', ring: 'ring-indigo-500', temp: '❄️ Frio' },
  aguardando_cotacao: { border: 'border-sky-400', ring: 'ring-sky-500', temp: '🌡️ Morno' },
  analisando: { border: 'border-violet-400', ring: 'ring-violet-600', temp: '🔥 Aquecendo' },
  liberado: { border: 'border-emerald-500', ring: 'ring-emerald-600', temp: '🔥 Quente' },
  enviado: { border: 'border-amber-500', ring: 'ring-amber-600', temp: '⚡ Energizado' },
  negociando: { border: 'border-orange-600', ring: 'ring-orange-700', temp: '🔥 Fervendo' },
  aprovado: { border: 'border-green-600', ring: 'ring-green-700', temp: '✨ Explosão' },
  rejeitado: { border: 'border-red-500', ring: 'ring-red-600', temp: '❄️ Congelado' },
  vencido: { border: 'border-slate-500', ring: 'ring-slate-600', temp: '🧊 Inativo' }
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
const OrcamentoCard = React.memo(({ orcamento, index, gradient, onEdit, onMostrarInsightsIA, onAbrirChat, onTag, etiquetasMap, isSaving }) => {
  return (
    <Draggable draggableId={orcamento.id} index={index}>
      {(provided, snapshot) =>
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        style={{
          ...provided.draggableProps.style,
          transition: snapshot.isDragging ? 'none' : provided.draggableProps.style?.transition
        }}
        className={`bg-white rounded-lg border ${gradient.border} hover:shadow-md cursor-grab active:cursor-grabbing group relative ${
        snapshot.isDragging ? 'shadow-2xl ring-2 ' + gradient.ring + ' rotate-1 opacity-95 scale-105 z-50' : ''}`
        }>
        
          {isSaving &&
        <div className="absolute inset-0 bg-white/70 rounded-lg flex items-center justify-center z-10">
              <div className="w-4 h-4 border-2 border-slate-400 border-t-orange-500 rounded-full animate-spin" />
            </div>
        }
          <div className="p-2 space-y-0">
            <div className="flex items-start justify-between gap-1">
              <h4 className="font-semibold text-slate-800 text-[11px] leading-tight truncate flex-1 uppercase">
                {orcamento.cliente_nome || '—'}
              </h4>
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
              {orcamento.vendedor &&
            <div className="flex items-center gap-0.5">
                  <User className="w-2.5 h-2.5" />
                  <span className="truncate max-w-[60px]">{(orcamento.vendedor || '').split(' ')[0]}</span>
                </div>
            }
              {orcamento.data_orcamento &&
            <div className="flex items-center gap-0.5 ml-auto">
                  <Calendar className="w-2.5 h-2.5" />
                  <span>{formatDate(orcamento.data_orcamento)}</span>
                </div>
            }
            </div>

            {orcamento.etiquetas?.length > 0 &&
          <div className="flex flex-wrap gap-1">
                {orcamento.etiquetas.map((id) => {
              const et = etiquetasMap?.[id];
              if (!et) return null;
              return (
                <span
                  key={id}
                  className="relative group inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold text-white cursor-default"
                  style={{ backgroundColor: et.cor || '#f59e0b' }}>
                  
                      {et.nome}
                      {et.observacao &&
                  <span className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-50 bg-slate-900 text-white text-[9px] rounded px-2 py-1 whitespace-nowrap shadow-xl max-w-[150px] break-words pointer-events-none">
                          {et.observacao}
                        </span>
                  }
                    </span>);

            })}
              </div>
          }

            <div className="pt-1 rounded-none flex items-center gap-1 border-t border-slate-100">
              {orcamento.probabilidade &&
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
            orcamento.probabilidade === 'Alta' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            orcamento.probabilidade === 'Média' ? 'bg-amber-50 text-amber-700 border-amber-200' :
            'bg-red-50 text-red-700 border-red-200'}`
            }>{orcamento.probabilidade}</span>
            }
              <div className="ml-auto flex gap-1">
                <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {e.stopPropagation();onTag?.(orcamento);}}
                className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded text-[9px] font-semibold border border-amber-200 transition-all"
                title="Etiquetas">
                
                  <Tags className="w-2.5 h-2.5" />
                </button>
                {onMostrarInsightsIA &&
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {e.stopPropagation();onMostrarInsightsIA(orcamento);}}
                className="flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded text-[9px] font-semibold border border-indigo-200 transition-all">
                
                    <Brain className="w-2.5 h-2.5" /> IA
                  </button>
              }
                <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {e.stopPropagation();onAbrirChat(orcamento);}}
                className="flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[9px] font-semibold transition-all"
                title="Abrir chat">
                
                  <Send className="w-2.5 h-2.5" />
                </button>
                <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {e.stopPropagation();onEdit?.(orcamento);}}
                className="flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-50 hover:bg-orange-500 text-orange-500 hover:text-white rounded text-[9px] font-semibold border border-orange-200 transition-all"
                title="Editar orçamento">
                
                  <PenLine className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </Draggable>);

});
OrcamentoCard.displayName = 'OrcamentoCard';

// ─── Empty State ─────────────────────────────────────────────────────────────
const ColunasEmptyState = () =>
<div className="flex flex-col items-center justify-center py-8 text-slate-400">
    <div className="text-3xl mb-2">📭</div>
    <span className="text-xs">Nenhum orçamento aqui</span>
  </div>;


// ─── Coluna Droppable memorizada ──────────────────────────────────────────────
const KanbanColumn = React.memo(({ status, etapaConfig, orcamentos: colOrcamentos, onEdit, onMostrarInsightsIA, onAbrirChat, onTag, etiquetasMap, savingId }) => {
  const gradient = statusGradients[status];
  const totalValor = useMemo(() => colOrcamentos.reduce((s, o) => s + (o.valor_total || 0), 0), [colOrcamentos]);

  return (
    <div style={{ width: 160, minWidth: 160, flexShrink: 0 }} className="flex flex-col">
      <div className={`bg-gradient-to-r ${etapaConfig.headerGradient} p-2 rounded-t-xl shadow-xl`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            <h3 className="font-bold text-[11px] text-white truncate">{statusLabels[status]}</h3>
          </div>
          <Badge className={`bg-gradient-to-r ${etapaConfig.badgeGradient} text-white text-[10px] h-5 px-1.5 font-bold border-0`}>
            {colOrcamentos.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <DollarSign className="w-3 h-3 text-amber-300 flex-shrink-0" />
          <span className="text-[10px] text-amber-200 font-bold truncate">{formatCurrency(totalValor)}</span>
        </div>
      </div>

      <Droppable droppableId={status}>
        {(provided, snapshot) =>
        <div
          ref={provided.innerRef}
          {...provided.droppableProps} className="bg-slate-50 px-1 rounded-b-xl border-l-4 border-r-4 border-b-4 border-amber-500 space-y-1.5 flex-1 transition-colors duration-150"



          style={{ minHeight: 500 }}>
          
            {colOrcamentos.length === 0 && !snapshot.isDraggingOver && <ColunasEmptyState />}
            {colOrcamentos.map((orc, index) =>
          <OrcamentoCard
            key={orc.id}
            orcamento={orc}
            index={index}
            gradient={gradient}
            onEdit={onEdit}
            onMostrarInsightsIA={onMostrarInsightsIA}
            onAbrirChat={onAbrirChat}
            onTag={onTag}
            etiquetasMap={etiquetasMap}
            isSaving={savingId === orc.id} />

          )}
            {provided.placeholder}
          </div>
        }
      </Droppable>
    </div>);

});
KanbanColumn.displayName = 'KanbanColumn';

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function OrcamentoKanbanOptimized({ orcamentos: orcamentosProps, onUpdateStatus, usuario, onEdit, onMostrarInsightsIA }) {
  const [tagModalOrcamento, setTagModalOrcamento] = useState(null);
  const [etiquetas, setEtiquetas] = useState([]);
  const [localOrcamentos, setLocalOrcamentos] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    base44.entities.EtiquetaOrcamento.list().then((data) => setEtiquetas(data || [])).catch(() => {});
  }, []);

  const etiquetasMap = useMemo(() => {
    return etiquetas.reduce((acc, et) => {acc[et.id] = et;return acc;}, {});
  }, [etiquetas]);

  const handleTagSave = useCallback(async (orcamentoAtualizado) => {
    setLocalOrcamentos((prev) => {
      const base = prev ?? orcamentosProps;
      return base.map((o) => o.id === orcamentoAtualizado.id ? { ...o, etiquetas: orcamentoAtualizado.etiquetas } : o);
    });
    try {
      const data = await base44.entities.EtiquetaOrcamento.list();
      setEtiquetas(data || []);
    } catch {}
  }, [orcamentosProps]);

  const orcamentos = localOrcamentos ?? orcamentosProps;

  useEffect(() => {
    setLocalOrcamentos(null);
  }, [orcamentosProps]);

  const orcamentosPorStatus = useMemo(() => {
    const todos = Object.values(etapasFluxo).flatMap((e) => e.statuses);
    return todos.reduce((acc, status) => {
      acc[status] = orcamentos.filter((o) => o.status === status);
      return acc;
    }, {});
  }, [orcamentos]);

  const onDragEnd = useCallback(async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const novoStatus = destination.droppableId;
    const statusAnterior = source.droppableId;

    setLocalOrcamentos((prev) => {
      const base = prev ?? orcamentosProps;
      return base.map((o) => o.id === draggableId ? { ...o, status: novoStatus } : o);
    });

    if (typeof onUpdateStatus === 'function') {
      setSavingId(draggableId);
      try {
        await onUpdateStatus(draggableId, novoStatus);
        toast.success(`Movido para "${statusLabels[novoStatus] || novoStatus}"`);
      } catch (error) {
        console.error('Erro ao mover orçamento:', error);
        setLocalOrcamentos((prev) => {
          const base = prev ?? orcamentosProps;
          return base.map((o) => o.id === draggableId ? { ...o, status: statusAnterior } : o);
        });
        toast.error('Erro ao mover orçamento. Revertendo...');
      } finally {
        setSavingId(null);
      }
    }
  }, [onUpdateStatus, orcamentosProps]);

  const onAbrirChat = useCallback(async (orcamento) => {
    const telefone = orcamento.cliente_telefone || orcamento.cliente_celular;
    if (!telefone) {toast.error('Telefone não cadastrado neste orçamento');return;}
    // Normalização robusta: remove DDI 55 se presente, garante só dígitos
    const raw = telefone.replace(/\D/g, '');
    const canonico = raw.startsWith('55') && raw.length > 11 ? raw : raw;
    try {
      const contatos = await base44.entities.Contact.filter({ telefone_canonico: canonico });
      if (contatos?.length > 0) {
        navigate(`/Comunicacao?contact_id=${contatos[0].id}`);
      } else {
        toast.error('Contato não encontrado na Central de Comunicação');
      }
    } catch {toast.error('Erro ao buscar contato');}
  }, [navigate]);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="space-y-4">
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
                </TabsTrigger>);

            })}
          </TabsList>

          {Object.entries(etapasFluxo).map(([key, etapa]) =>
          <TabsContent key={key} value={key} className="mt-4">
              <div className={`${etapa.containerBg} rounded-2xl p-3 border-2 border-white/50 shadow-2xl`}>
                {/* Container com overflow-x visível para o drag funcionar em todas as colunas */}
                <div
                style={{
                  display: 'flex',
                  gap: 10,
                  overflowX: 'auto',
                  overflowY: 'visible',
                  minHeight: 560,
                  paddingBottom: 8,
                  WebkitOverflowScrolling: 'touch'
                }}>
                
                  {etapa.statuses.map((status) =>
                <KanbanColumn
                  key={status}
                  status={status}
                  etapaConfig={etapa}
                  orcamentos={orcamentosPorStatus[status] || []}
                  onEdit={onEdit}
                  onMostrarInsightsIA={onMostrarInsightsIA}
                  onAbrirChat={onAbrirChat}
                  onTag={setTagModalOrcamento}
                  etiquetasMap={etiquetasMap}
                  savingId={savingId} />

                )}
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
      {tagModalOrcamento &&
      <OrcamentoTagModal
        orcamento={tagModalOrcamento}
        onClose={() => setTagModalOrcamento(null)}
        onSave={handleTagSave} />

      }
    </DragDropContext>);

}