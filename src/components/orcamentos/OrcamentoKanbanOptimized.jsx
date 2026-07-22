import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, DollarSign, User, Brain, Send, Building2, Handshake, Tags, PenLine, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { atualizarStatusOrcamento } from '@/functions/atualizarStatusOrcamento';
import OrcamentoTagModal from './OrcamentoTagModal';
import OrcamentoChatDrawer from './OrcamentoChatDrawer';
import RejeicaoMotivoModal from './RejeicaoMotivoModal';
import LegendaTotalizadoresOrcamentos, { classificarOrcamento } from './LegendaTotalizadoresOrcamentos';
import AnaliseProdutosPanel from '../inteligencia/AnaliseProdutosPanel';
import useChatIndicadores from '../crm/useChatIndicadores';

const statusLabels = {
  em_cotacao: 'Em Cotação',
  rascunho: 'Rascunho',
  aguardando_cotacao: 'Aguard. Cotação',
  analisando: 'Analisando',
  liberado: 'Liberado',
  enviado: 'Enviado',
  negociando: 'Negociando',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
  vencido: 'Fechado'
};

const statusGradients = {
  em_cotacao: { border: 'border-cyan-400/60', ring: 'ring-cyan-500', temp: '🛒 Cotando', header: 'from-slate-800 via-cyan-900 to-slate-900', accent: 'text-cyan-300', dot: 'bg-cyan-400' },
  rascunho: { border: 'border-indigo-400/60', ring: 'ring-indigo-500', temp: '❄️ Frio', header: 'from-slate-800 via-indigo-900 to-slate-900', accent: 'text-indigo-300', dot: 'bg-indigo-400' },
  aguardando_cotacao: { border: 'border-sky-400/60', ring: 'ring-sky-500', temp: '🌡️ Morno', header: 'from-slate-800 via-sky-900 to-slate-900', accent: 'text-sky-300', dot: 'bg-sky-400' },
  analisando: { border: 'border-violet-400/60', ring: 'ring-violet-600', temp: '🔥 Aquecendo', header: 'from-slate-800 via-violet-900 to-slate-900', accent: 'text-violet-300', dot: 'bg-violet-400' },
  liberado: { border: 'border-emerald-400/60', ring: 'ring-emerald-600', temp: '🔥 Quente', header: 'from-slate-800 via-emerald-900 to-slate-900', accent: 'text-emerald-300', dot: 'bg-emerald-400' },
  enviado: { border: 'border-amber-400/60', ring: 'ring-amber-600', temp: '⚡ Energizado', header: 'from-slate-800 via-amber-900 to-slate-900', accent: 'text-amber-300', dot: 'bg-amber-400' },
  negociando: { border: 'border-orange-400/60', ring: 'ring-orange-700', temp: '🔥 Fervendo', header: 'from-slate-800 via-orange-900 to-slate-900', accent: 'text-orange-300', dot: 'bg-orange-400' },
  aprovado: { border: 'border-green-400/60', ring: 'ring-green-700', temp: '✨ Explosão', header: 'from-slate-800 via-green-900 to-slate-900', accent: 'text-green-300', dot: 'bg-green-400' },
  rejeitado: { border: 'border-rose-400/60', ring: 'ring-rose-600', temp: '❄️ Congelado', header: 'from-slate-800 via-rose-900 to-slate-900', accent: 'text-rose-300', dot: 'bg-rose-400' },
  vencido: { border: 'border-teal-400/60', ring: 'ring-teal-700', temp: '✅ Fechado', header: 'from-slate-800 via-teal-900 to-slate-900', accent: 'text-teal-300', dot: 'bg-teal-400' }
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
    statuses: ['em_cotacao', 'enviado', 'negociando', 'aprovado', 'rejeitado', 'vencido'],
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

// Cores das etapas internas exibidas na coluna agregada "Em Cotação"
const coresEtapaCotacao = {
  rascunho: { chip: 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40', badge: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  aguardando_cotacao: { chip: 'bg-sky-500/30 text-sky-200 border border-sky-400/40', badge: 'bg-sky-100 text-sky-700 border-sky-300' },
  analisando: { chip: 'bg-violet-500/30 text-violet-200 border border-violet-400/40', badge: 'bg-violet-100 text-violet-700 border-violet-300' },
  liberado: { chip: 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40', badge: 'bg-emerald-100 text-emerald-700 border-emerald-300' }
};

// Borda radiante do card na cor da categoria de dias parados
const bordaCategoria = {
  criticos:  'border-slate-900 shadow-[0_0_10px_rgba(15,23,42,0.55)]',
  vermelhos: 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.55)]',
  amarelos:  'border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.55)]',
  ativos:    'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]',
};

// ─── Card memorizado ──────────────────────────────────────────────────────────
const OrcamentoCard = React.memo(({ orcamento, index, gradient, onEdit, onMostrarInsightsIA, onAbrirChat, onTag, onAtendido, etiquetasMap, isSaving, fotoVendedor, chatNaoLidas = 0, etapaCotacao = null }) => {
  const catParado = classificarOrcamento(orcamento);
  const bordaCat = bordaCategoria[catParado] || gradient.border;
  return (
    <Draggable draggableId={orcamento.id} index={index}>
      {(provided, snapshot) =>
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{
            ...provided.draggableProps.style,
            // ⚠️ NÃO desligar a transition durante o drop: a lib espera o
            // evento transitionend para finalizar o drop. Sem transition,
            // o card fica "pendurado" até a próxima interação.
            transition: (snapshot.isDragging && !snapshot.isDropAnimating)
              ? 'none'
              : provided.draggableProps.style?.transition
          }}
          className={`${etapaCotacao ? 'bg-cyan-50/80 border-dashed' : 'bg-white'} rounded-lg border-2 ${bordaCat} hover:shadow-lg cursor-grab active:cursor-grabbing group relative ${
            snapshot.isDragging && !snapshot.isDropAnimating ? 'shadow-2xl ring-2 ' + gradient.ring + ' rotate-1 opacity-95 scale-105 z-50' : ''
          }`}
        >
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
              {(() => {
                const refData = orcamento.data_orcamento || orcamento.created_date;
                if (!refData) return null;
                const diasParado = Math.floor((Date.now() - new Date(refData).getTime()) / (1000 * 60 * 60 * 24));
                const cat = classificarOrcamento(orcamento);
                const cor = {
                  criticos: 'bg-slate-900 text-white',
                  vermelhos: 'bg-red-500 text-white',
                  amarelos: 'bg-amber-400 text-amber-900',
                  ativos: 'bg-emerald-500 text-white'
                }[cat] || 'bg-slate-300 text-slate-700';
                return (
                  <span
                    title={`${diasParado} dia(s) parado nesta etapa`}
                    className={`flex-shrink-0 w-6 h-6 rounded-full flex flex-col items-center justify-center leading-none shadow-sm ${cor}`}
                  >
                    <span className="text-[10px] font-black">{diasParado}</span>
                    <span className="text-[5px] font-semibold uppercase opacity-80">dias</span>
                  </span>
                );
              })()}
            </div>

            {etapaCotacao && (
              <div className="pt-0.5">
                <span className={`inline-flex items-center px-1.5 py-px rounded-full text-[8px] font-bold uppercase border ${coresEtapaCotacao[etapaCotacao]?.badge || 'bg-cyan-100 text-cyan-700 border-cyan-300'}`}>
                  {statusLabels[etapaCotacao] || etapaCotacao}
                </span>
              </div>
            )}

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
                  {fotoVendedor ? (
                    <img src={fotoVendedor} alt={orcamento.vendedor} className="w-4 h-4 rounded-full object-cover flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <User className="w-2.5 h-2.5" />
                  )}
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
                      style={{ backgroundColor: et.cor || '#f59e0b' }}
                    >
                      {et.nome}
                      {et.observacao &&
                        <span className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-50 bg-slate-900 text-white text-[9px] rounded px-2 py-1 whitespace-nowrap shadow-xl max-w-[150px] break-words pointer-events-none">
                          {et.observacao}
                        </span>
                      }
                    </span>
                  );
                })}
              </div>
            }

            <div className="pt-1 rounded-none flex items-center gap-1 border-t border-slate-100">
              {orcamento.probabilidade &&
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
                  orcamento.probabilidade === 'Alta' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  orcamento.probabilidade === 'Média' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-red-50 text-red-700 border-red-200'
                }`}>
                  {orcamento.probabilidade}
                  {typeof orcamento.probabilidade_percentual === 'number' && ` · ${orcamento.probabilidade_percentual}%`}
                </span>
              }
              <div className="ml-auto flex gap-1">
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onTag?.(orcamento); }}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded text-[9px] font-semibold border border-amber-200 transition-all"
                  title="Etiquetas"
                >
                  <Tags className="w-2.5 h-2.5" />
                </button>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onAtendido?.(orcamento); }}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 bg-teal-50 hover:bg-teal-500 text-teal-600 hover:text-white rounded text-[9px] font-semibold border border-teal-200 transition-all"
                  title="Marcar como Atendido"
                >
                  <UserCheck className="w-2.5 h-2.5" />
                </button>
                {onMostrarInsightsIA &&
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onMostrarInsightsIA(orcamento); }}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded text-[9px] font-semibold border border-indigo-200 transition-all"
                  >
                    <Brain className="w-2.5 h-2.5" /> IA
                  </button>
                }
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onAbrirChat(orcamento); }}
                  className="relative flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[9px] font-semibold transition-all"
                  title={chatNaoLidas > 0 ? `${chatNaoLidas} mensagem(ns) não lida(s) — abrir chat` : 'Abrir chat'}
                >
                  <Send className="w-2.5 h-2.5" />
                  {chatNaoLidas > 0 && (
                    <span className="absolute -top-2 -right-2 min-w-[16px] h-[16px] px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                      {chatNaoLidas > 99 ? '99+' : chatNaoLidas}
                    </span>
                  )}
                </button>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onEdit?.(orcamento); }}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-50 hover:bg-orange-500 text-orange-500 hover:text-white rounded text-[9px] font-semibold border border-orange-200 transition-all"
                  title="Editar orçamento"
                >
                  <PenLine className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </Draggable>
  );
});
OrcamentoCard.displayName = 'OrcamentoCard';

// ─── Empty State ──────────────────────────────────────────────────────────────
const ColunasEmptyState = () =>
  <div className="flex flex-col items-center justify-center py-8 text-slate-400">
    <div className="text-3xl mb-2">📭</div>
    <span className="text-xs">Nenhum orçamento aqui</span>
  </div>;

// ─── Coluna Droppable memorizada ──────────────────────────────────────────────
const resolverFotoVendedor = (orcamento, fotosVendedorMap) => {
  if (!fotosVendedorMap) return null;
  if (orcamento.vendedor_id && fotosVendedorMap.byId[orcamento.vendedor_id]) return fotosVendedorMap.byId[orcamento.vendedor_id];
  const nome = (orcamento.vendedor || '').trim().toLowerCase();
  return nome ? (fotosVendedorMap.byName[nome] || null) : null;
};

const KanbanColumn = React.memo(({ status, etapaConfig, orcamentos: colOrcamentos, onEdit, onMostrarInsightsIA, onAbrirChat, onTag, onAtendido, etiquetasMap, savingId, fotosVendedorMap, chatBadges }) => {
  const gradient = statusGradients[status];
  const totalValor = useMemo(() => colOrcamentos.reduce((s, o) => s + (o.valor_total || 0), 0), [colOrcamentos]);
  const isCotacao = status === 'em_cotacao';
  const contagemEtapas = useMemo(() => {
    if (!isCotacao) return null;
    return colOrcamentos.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});
  }, [isCotacao, colOrcamentos]);

  return (
    // ✅ FIX 2: clamp() — cresce com viewport, respeita min/max
    <div style={{ width: 'clamp(175px, 22vw, 260px)', minWidth: 175, flexShrink: 0 }} className="flex flex-col">
      <div className={`relative bg-gradient-to-br ${gradient.header} p-2.5 rounded-t-xl shadow-2xl overflow-hidden border-t border-x ${gradient.border}`}>
        {/* Glow vibrante no canto */}
        <div className={`absolute -top-8 -right-8 w-24 h-24 ${gradient.dot} opacity-20 blur-2xl rounded-full pointer-events-none`} />
        <div className="relative flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${gradient.dot} shadow-lg shadow-current animate-pulse`} />
            <h3 className="font-bold text-[11px] text-white truncate tracking-wide uppercase">{statusLabels[status]}</h3>
          </div>
          <Badge className={`bg-white/10 backdrop-blur-sm ${gradient.accent} text-[10px] h-5 px-2 font-black border ${gradient.border}`}>
            {colOrcamentos.length}
          </Badge>
        </div>
        <div className="relative flex items-baseline gap-1">
          <DollarSign className={`w-3 h-3 ${gradient.accent} flex-shrink-0 self-center`} />
          <span className={`text-sm font-black ${gradient.accent} truncate tracking-tight`}>{formatCurrency(totalValor)}</span>
        </div>
        {isCotacao && (
          <div className="relative flex flex-wrap gap-1 mt-1.5">
            {etapasFluxo.interna.statuses.map((st) => (
              <span key={st} className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${coresEtapaCotacao[st]?.chip || 'bg-white/10 text-white'}`}>
                {statusLabels[st]}: {contagemEtapas?.[st] || 0}
              </span>
            ))}
          </div>
        )}
      </div>

      <Droppable droppableId={status}>
        {(provided, snapshot) =>
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            // ✅ FIX 3: borda por status (identidade visual restaurada)
            className={`px-1 pt-1.5 rounded-b-xl border-l-4 border-r-4 border-b-4 ${isCotacao ? 'border-dashed' : ''} ${gradient.border} space-y-1.5 flex-1 transition-colors duration-150 ${
              snapshot.isDraggingOver ? 'bg-orange-50' : (isCotacao ? 'bg-cyan-50/60' : 'bg-slate-50')
            }`}
            style={{ minHeight: 400 }}
          >
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
                  onAtendido={onAtendido}
                  etiquetasMap={etiquetasMap}
                  isSaving={savingId === orc.id}
                  fotoVendedor={resolverFotoVendedor(orc, fotosVendedorMap)}
                  chatNaoLidas={chatBadges?.[orc.id] || 0}
                  etapaCotacao={isCotacao ? orc.status : null}
              />
            )}
            {provided.placeholder}
          </div>
        }
      </Droppable>
    </div>
  );
});
KanbanColumn.displayName = 'KanbanColumn';

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function OrcamentoKanbanOptimized({ orcamentos: orcamentosProps, onUpdateStatus, usuario, onEdit, onMostrarInsightsIA, etapasVisiveis, atendentes = [] }) {
  const [tagModalOrcamento, setTagModalOrcamento] = useState(null);
  const [chatOrcamento, setChatOrcamento] = useState(null);
  const [etiquetas, setEtiquetas] = useState([]);
  const [localOrcamentos, setLocalOrcamentos] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [rejeicaoPendente, setRejeicaoPendente] = useState(null); // { orcamento, novoStatus, novaOrdem }
  const [categoriaPrioritaria, setCategoriaPrioritaria] = useState(null); // 'criticos' | 'vermelhos' | 'amarelos' | 'ativos' | null
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { getIndicadorCliente } = useChatIndicadores();

  useEffect(() => {
    base44.entities.EtiquetaOrcamento.list().then((data) => setEtiquetas(data || [])).catch(() => {});
  }, []);

  const etiquetasMap = useMemo(() => {
    return etiquetas.reduce((acc, et) => { acc[et.id] = et; return acc; }, {});
  }, [etiquetas]);

  // Mapa de fotos de vendedores (por id e por nome) para o avatar do card
  const fotosVendedorMap = useMemo(() => {
    const byId = {}, byName = {};
    (atendentes || []).forEach((a) => {
      if (!a?.foto_url) return;
      if (a.value) byId[a.value] = a.foto_url;
      if (a.label) byName[a.label.trim().toLowerCase()] = a.foto_url;
    });
    return { byId, byName };
  }, [atendentes]);

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

  // Mapa orcamento.id → nº de mensagens não lidas (mesma fonte da tela de Fidelizados)
  const chatBadges = useMemo(() => {
    const m = {};
    for (const o of orcamentos) {
      const info = getIndicadorCliente({
        id: o.cliente_id,
        telefone: o.cliente_telefone,
        celular: o.cliente_celular
      });
      if (info?.naoLidas) m[o.id] = info.naoLidas;
    }
    return m;
  }, [orcamentos, getIndicadorCliente]);

  const prevOrcamentosRef = useRef(orcamentosProps);
  useEffect(() => {
    // Só limpa o estado otimista se os dados do servidor REALMENTE mudaram (IDs ou status),
    // não apenas por troca de referência do array.
    const mudou = orcamentosProps.length !== prevOrcamentosRef.current.length ||
      orcamentosProps.some((o, i) => {
        const prev = prevOrcamentosRef.current[i];
        return !prev || prev.id !== o.id || prev.status !== o.status || prev.kanban_order !== o.kanban_order;
      });
    prevOrcamentosRef.current = orcamentosProps;
    if (mudou) setLocalOrcamentos(null);
  }, [orcamentosProps]);

  const orcamentosPorStatus = useMemo(() => {
    const todos = Object.values(etapasFluxo).flatMap((e) => e.statuses);
    return todos.reduce((acc, status) => {
      acc[status] = orcamentos
        .filter((o) => status === 'em_cotacao'
          ? etapasFluxo.interna.statuses.includes(o.status)
          : o.status === status)
        .sort((a, b) => {
          // Se há categoria priorizada, os orçamentos dela sobem para o topo
          if (categoriaPrioritaria) {
            const aPrio = classificarOrcamento(a) === categoriaPrioritaria ? 0 : 1;
            const bPrio = classificarOrcamento(b) === categoriaPrioritaria ? 0 : 1;
            if (aPrio !== bPrio) return aPrio - bPrio;
          }
          return (a.kanban_order ?? Infinity) - (b.kanban_order ?? Infinity);
        });
      return acc;
    }, {});
  }, [orcamentos, categoriaPrioritaria]);

  const onDragEnd = useCallback(async (result) => {
    // Remove o foco do card ao soltar — a lib devolve o foco para o drag handle,
    // o que deixa o card "marcado/focado" até clicar em outro lugar.
    requestAnimationFrame(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const novoStatus = destination.droppableId;
    // Coluna agregada "Em Cotação" é somente visualização — não recebe drops
    if (novoStatus === 'em_cotacao') return;
    // Se o card veio da coluna agregada, usa o status real do orçamento para rollback
    const baseAtual = localOrcamentos ?? orcamentosProps;
    const statusAnterior = source.droppableId === 'em_cotacao'
      ? (baseAtual.find((o) => o.id === draggableId)?.status || source.droppableId)
      : source.droppableId;

    // Calcula a posição (kanban_order) com base nos vizinhos no ponto do drop
    const colDestino = (orcamentosPorStatus[novoStatus] || []).filter((o) => o.id !== draggableId);
    const prevCard = colDestino[destination.index - 1];
    const nextCard = colDestino[destination.index];
    const ordPrev = prevCard?.kanban_order;
    const ordNext = nextCard?.kanban_order;
    let novaOrdem;
    if (typeof ordPrev === 'number' && typeof ordNext === 'number') novaOrdem = (ordPrev + ordNext) / 2;
    else if (typeof ordPrev === 'number') novaOrdem = ordPrev + 1000;
    else if (typeof ordNext === 'number') novaOrdem = ordNext - 1000;
    else novaOrdem = destination.index * 1000;

    setLocalOrcamentos((prev) => {
      const base = prev ?? orcamentosProps;
      return base.map((o) => o.id === draggableId ? { ...o, status: novoStatus, kanban_order: novaOrdem } : o);
    });

    // ✅ REJEITADO: abre tela de motivo antes de gravar (em vez de persistir direto)
    if (novoStatus === 'rejeitado' && statusAnterior !== 'rejeitado') {
      const base = localOrcamentos ?? orcamentosProps;
      const orc = base.find((o) => o.id === draggableId);
      setRejeicaoPendente({ orcamento: orc, novoStatus, novaOrdem, statusAnterior, draggableId });
      return;
    }

    setSavingId(draggableId);
    try {
      // Backend grava com service role — evita falha silenciosa de RLS
      // quando gerente move card de outro vendedor.
      const resp = await atualizarStatusOrcamento({
        orcamento_id: draggableId,
        novo_status: novoStatus,
        kanban_order: novaOrdem
      });
      if (resp?.data?.error || resp?.data?.success !== true) {
        throw new Error(resp?.data?.error || 'Falha ao salvar no servidor');
      }
      // Grava o novo status direto no cache do React Query — assim qualquer
      // re-render/refetch da página já reflete a posição salva imediatamente,
      // sem o card "voltar" até o próximo fetch.
      queryClient.setQueryData(['orcamentos'], (old) =>
        Array.isArray(old)
          ? old.map((o) => o.id === draggableId ? { ...o, status: novoStatus, kanban_order: novaOrdem } : o)
          : old
      );
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
  }, [onUpdateStatus, orcamentosProps, orcamentosPorStatus, queryClient]);

  const confirmarRejeicao = useCallback(async ({ motivo, observacao }) => {
    if (!rejeicaoPendente) return;
    const { orcamento, novoStatus, novaOrdem, statusAnterior, draggableId } = rejeicaoPendente;
    setSavingId(draggableId);
    try {
      // Garante a etiqueta "Rejeitado" no orçamento
      let etiquetaRejeitado = etiquetas.find((e) => (e.nome || '').toLowerCase() === 'rejeitado');
      if (!etiquetaRejeitado) {
        etiquetaRejeitado = await base44.entities.EtiquetaOrcamento.create({
          nome: 'Rejeitado', icone: 'AlertTriangle', cor: '#ef4444', cor_texto: '#ffffff', ativo: true
        });
        setEtiquetas((prev) => [...prev, etiquetaRejeitado]);
      }
      const etiquetasAtuais = orcamento?.etiquetas || [];
      const novasEtiquetas = etiquetasAtuais.includes(etiquetaRejeitado.id)
        ? etiquetasAtuais
        : [...etiquetasAtuais, etiquetaRejeitado.id];

      const novaEntradaHistorico = {
        id: `${Date.now()}`,
        data: new Date().toISOString(),
        tipo: 'nota',
        texto: `❌ Rejeitado — Motivo: ${motivo}. ${observacao || ''}`.trim()
      };
      const historicoAtual = Array.isArray(orcamento?.historico_interno) ? orcamento.historico_interno : [];

      await base44.entities.Orcamento.update(draggableId, {
        status: novoStatus,
        kanban_order: novaOrdem,
        observacoes: `[Rejeitado] ${motivo}${observacao && observacao !== motivo ? ' — ' + observacao : ''}`,
        etiquetas: novasEtiquetas,
        historico_interno: [...historicoAtual, novaEntradaHistorico]
      });

      setLocalOrcamentos((prev) => {
        const base = prev ?? orcamentosProps;
        return base.map((o) => o.id === draggableId
          ? { ...o, status: novoStatus, kanban_order: novaOrdem, etiquetas: novasEtiquetas }
          : o);
      });
      queryClient.setQueryData(['orcamentos'], (old) =>
        Array.isArray(old)
          ? old.map((o) => o.id === draggableId ? { ...o, status: novoStatus, kanban_order: novaOrdem, etiquetas: novasEtiquetas } : o)
          : old
      );
      toast.success('Orçamento rejeitado e etiquetado');
    } catch (error) {
      console.error('Erro ao rejeitar orçamento:', error);
      setLocalOrcamentos((prev) => {
        const base = prev ?? orcamentosProps;
        return base.map((o) => o.id === draggableId ? { ...o, status: statusAnterior } : o);
      });
      toast.error('Erro ao rejeitar. Revertendo...');
    } finally {
      setSavingId(null);
      setRejeicaoPendente(null);
    }
  }, [rejeicaoPendente, etiquetas, orcamentosProps, localOrcamentos, queryClient]);

  const cancelarRejeicao = useCallback(() => {
    if (!rejeicaoPendente) { setRejeicaoPendente(null); return; }
    const { statusAnterior, draggableId } = rejeicaoPendente;
    // Reverte o card para a coluna de origem
    setLocalOrcamentos((prev) => {
      const base = prev ?? orcamentosProps;
      return base.map((o) => o.id === draggableId ? { ...o, status: statusAnterior } : o);
    });
    setRejeicaoPendente(null);
  }, [rejeicaoPendente, orcamentosProps]);

  const onAtendido = useCallback(async (orcamento) => {
    const telefone = orcamento.cliente_telefone || orcamento.cliente_celular;
    if (!telefone) { toast.error('Telefone não cadastrado — não foi possível registrar atendimento'); return; }
    const raw = telefone.replace(/\D/g, '');
    const canonico = raw.startsWith('55') && raw.length > 11 ? raw.slice(2) : raw;
    try {
      const contatos = await base44.entities.Contact.filter({ telefone_canonico: canonico });
      if (contatos?.length > 0) {
        await base44.functions.invoke('atualizarAttentionGiven', { contactId: contatos[0].id, tipoAcao: 'kanban_orcamento' });
        toast.success(`✓ Atendimento registrado para ${orcamento.cliente_nome || 'cliente'}`);
      } else {
        toast.error('Contato não encontrado para registrar atendimento');
      }
    } catch { toast.error('Erro ao registrar atendimento'); }
  }, []);

  const onAbrirChat = useCallback((orcamento) => {
    const telefone = orcamento.cliente_telefone || orcamento.cliente_celular;
    if (!telefone) { toast.error('Telefone não cadastrado neste orçamento'); return; }
    setChatOrcamento(orcamento);
  }, []);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="space-y-1">
        <LegendaTotalizadoresOrcamentos
          orcamentos={orcamentos}
          categoriaAtiva={categoriaPrioritaria}
          onSelecionar={setCategoriaPrioritaria}
        />
        {/* 📦 Análise de Produtos — migrada da aba "Produtos" (só na etapa de Negociação) */}
        {(!etapasVisiveis || etapasVisiveis.includes('negociacao')) && (
          <details className="bg-white rounded-lg border border-slate-200 shadow-sm">
            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-lg">
              📦 Produtos — Ranking por família <span className="text-slate-400 font-normal ml-1">(clique para expandir)</span>
            </summary>
            <div className="p-3 border-t border-slate-100">
              <AnaliseProdutosPanel />
            </div>
          </details>
        )}
        {(() => {
          const etapasFiltradas = Object.entries(etapasFluxo).filter(
            ([key]) => !etapasVisiveis || etapasVisiveis.includes(key)
          );
          const defaultTab = etapasFiltradas[0]?.[0] || 'interna';
          return (
        <Tabs defaultValue={defaultTab} key={etapasVisiveis?.join(',') || 'all'} className="w-full">
          <TabsList className={`${etapasFiltradas.length === 1 ? 'hidden' : 'grid'} w-full grid-cols-2 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-1 rounded-xl shadow-2xl border border-slate-700`}>
            {etapasFiltradas.map(([key, etapa]) => {
              const Icon = etapa.icon;
              const statusesProprios = etapa.statuses.filter((st) => st !== 'em_cotacao');
              const total = statusesProprios.reduce((s, st) => s + (orcamentosPorStatus[st]?.length || 0), 0);
              const valor = statusesProprios.reduce((s, st) => s + (orcamentosPorStatus[st]?.reduce((a, o) => a + (o.valor_total || 0), 0) || 0), 0);
              return (
                <TabsTrigger key={key} value={key}
                  className="relative px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200
                    data-[state=inactive]:text-slate-400 data-[state=inactive]:hover:text-slate-200 data-[state=inactive]:hover:bg-slate-800/50
                    data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-400 data-[state=active]:via-orange-500 data-[state=active]:to-red-500
                    data-[state=active]:text-white data-[state=active]:shadow-xl data-[state=active]:shadow-orange-500/30
                    flex items-center justify-between gap-3"
                >
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

          {etapasFiltradas.map(([key, etapa]) =>
            <TabsContent key={key} value={key} className="mt-1">
              <div className={`${etapa.containerBg} rounded-2xl p-3 border-2 border-white/50 shadow-2xl`}>
                {/*
                  ✅ FIX 1: overflowY: 'auto' (resolve conflito CSS com overflowX: 'auto')
                  ✅ FIX 1: maxHeight dinâmico + minHeight absoluto — sem offset fixo de 260px
                */}
                <div
                  style={{
                    display: 'flex',
                    gap: 10,
                    overflowX: 'auto',
                    overflowY: 'auto',
                    minHeight: 420,
                    maxHeight: 'calc(100vh - 170px)',
                    paddingBottom: 16,
                    paddingTop: 4,
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#f97316 #1e293b'
                  }}
                  className="kanban-scroll"
                >
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
                      onAtendido={onAtendido}
                      etiquetasMap={etiquetasMap}
                      savingId={savingId}
                      fotosVendedorMap={fotosVendedorMap}
                      chatBadges={chatBadges}
                    />
                  )}
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
        );
        })()}
      </div>
      {tagModalOrcamento &&
        <OrcamentoTagModal
          orcamento={tagModalOrcamento}
          onClose={() => setTagModalOrcamento(null)}
          onSave={handleTagSave}
        />
      }
      <OrcamentoChatDrawer
        orcamento={chatOrcamento}
        isOpen={!!chatOrcamento}
        onClose={() => setChatOrcamento(null)}
      />
      {rejeicaoPendente &&
        <RejeicaoMotivoModal
          orcamento={rejeicaoPendente.orcamento}
          onConfirmar={confirmarRejeicao}
          onCancelar={cancelarRejeicao}
        />
      }
    </DragDropContext>
  );
}