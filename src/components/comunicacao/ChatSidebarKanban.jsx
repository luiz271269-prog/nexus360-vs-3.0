import React from "react";
import { format } from "date-fns";
import {
  CheckCheck, Check, AlertCircle, Image, Video, Mic, FileText,
  UserCheck, Columns, Users, Send, ArrowRightLeft, Plus, CalendarCheck,
  AlertTriangle, MessagesSquare, Pause, Zap, LayoutList, CheckSquare, BookOpen, Bot
} from "lucide-react";
import ManualJarvis from "./ManualJarvis";
import ContatosRequerendoAtencaoKanban from "./ContatosRequerendoAtencaoKanban";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getUserDisplayName } from "../lib/userHelpers";
import InternalMessageComposer from "./InternalMessageComposer";
import CriarGrupoModal from "./CriarGrupoModal";
import AgendaIAUnificada from "./AgendaIAUnificada";
import { useEtiquetasContato } from "./SeletorEtiquetasContato";
import AtribuidorAtendenteRapido from "./AtribuidorAtendenteRapido";
import { getAtendenteFidelizadoAtualizado } from "../lib/userMatcher";
import { toast } from "sonner";

// ─── Helpers ────────────────────────────────────────────────────────────────

const getUnreadCount = (thread, currentUserId) => {
  if (!thread) return 0;
  if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
    return thread.unread_by?.[currentUserId] || 0;
  }
  return thread.unread_count || 0;
};

const formatarHorario = (timestamp) => {
  if (!timestamp) return "";
  try {
    const agora = new Date();
    const dataMsg = new Date(timestamp);
    if (agora.toDateString() === dataMsg.toDateString()) return format(dataMsg, 'HH:mm');
    const diffDias = Math.floor((agora - dataMsg) / (1000 * 60 * 60 * 24));
    if (diffDias < 7) {
      const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      return dias[dataMsg.getDay()];
    }
    return format(dataMsg, 'dd/MM');
  } catch { return ""; }
};

// ─── Card compacto para colunas Kanban (Parados / Atendente / Instância) ────

function ThreadCardKanban({ thread, isAtiva, usuarioAtual, atendentes, onSelecionarThread, podeInteragir }) {
  const contato = thread.contato;
  const hasUnread = getUnreadCount(thread, usuarioAtual?.id) > 0;
  const { etiquetas: etiquetasDB, getConfig: getEtiquetaConfigDinamico } = useEtiquetasContato();

  let nomeExibicao = "";
  if (contato?.empresa) nomeExibicao += contato.empresa;
  if (contato?.cargo) nomeExibicao += (nomeExibicao ? " - " : "") + contato.cargo;
  if (contato?.nome && contato.nome !== contato?.telefone) nomeExibicao += (nomeExibicao ? " - " : "") + contato.nome;
  if (!nomeExibicao) nomeExibicao = contato?.telefone || "Sem Nome";

  const tiposConfig = {
    'novo': { emoji: '?', label: 'Novo', bg: 'bg-slate-400' },
    'lead': { emoji: 'L', label: 'Lead', bg: 'bg-amber-500' },
    'cliente': { emoji: 'C', label: 'Cliente', bg: 'bg-emerald-500' },
    'fornecedor': { emoji: 'F', label: 'Fornec.', bg: 'bg-blue-500' },
    'parceiro': { emoji: 'P', label: 'Parceiro', bg: 'bg-purple-500' }
  };
  const tipoCfg = tiposConfig[contato?.tipo_contato || 'novo'] || tiposConfig['novo'];
  const getAtendenteFidelizado = (c) => getAtendenteFidelizadoAtualizado(c, atendentes);

  return (
    <div
      onClick={() => podeInteragir && onSelecionarThread(thread)}
      className={`rounded-lg border shadow-sm transition-all ${podeInteragir ? 'cursor-pointer hover:shadow-md hover:border-orange-300' : 'cursor-not-allowed opacity-50'} ${isAtiva ? 'border-orange-500 bg-orange-50 shadow-md shadow-orange-200 scale-[1.02] z-10 relative ring-2 ring-orange-400 ring-offset-1' : 'bg-white border-slate-200'}`}
    >
      <div className="px-2 py-2 flex items-center gap-2">
        <div className="relative flex-shrink-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md overflow-hidden ${hasUnread ? 'bg-gradient-to-br from-amber-400 via-orange-500 to-red-500' : 'bg-gradient-to-br from-slate-400 to-slate-500'}`}>
            {contato?.foto_perfil_url && contato.foto_perfil_url !== 'null' ? (
              <img src={contato.foto_perfil_url} alt={nomeExibicao} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
            ) : nomeExibicao.charAt(0).toUpperCase()}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <p className={`text-xs font-semibold truncate ${hasUnread ? 'text-slate-900' : 'text-slate-700'}`}>{nomeExibicao}</p>
              {hasUnread && (
                <Badge className="rounded-full min-w-[16px] h-3.5 flex items-center justify-center p-0 px-1 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white text-[9px] font-bold border-0 shadow-lg flex-shrink-0">
                  {getUnreadCount(thread, usuarioAtual?.id)}
                </Badge>
              )}
            </div>
            <span className={`text-[9px] flex-shrink-0 ml-1 ${hasUnread ? 'text-orange-600 font-medium' : 'text-slate-400'}`}>{formatarHorario(thread.last_message_at)}</span>
          </div>
          <p className={`text-[10px] truncate flex items-center gap-0.5 ${hasUnread ? 'text-slate-800' : 'text-slate-500'}`}>
            {thread.last_message_sender === 'user' && (() => {
              const s = thread.last_message_status;
              if (s === 'lida') return <CheckCheck className="w-2.5 h-2.5 text-blue-500 flex-shrink-0" />;
              if (s === 'entregue') return <CheckCheck className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />;
              if (s === 'enviada') return <Check className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />;
              if (s === 'falhou') return <AlertCircle className="w-2.5 h-2.5 text-red-500 flex-shrink-0" />;
              return <CheckCheck className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />;
            })()}
            {thread.last_media_type === 'image' && <Image className="w-2.5 h-2.5 text-blue-500 flex-shrink-0" />}
            {thread.last_media_type === 'video' && <Video className="w-2.5 h-2.5 text-purple-500 flex-shrink-0" />}
            {thread.last_media_type === 'audio' && <Mic className="w-2.5 h-2.5 text-green-500 flex-shrink-0" />}
            {thread.last_media_type === 'document' && <FileText className="w-2.5 h-2.5 text-orange-500 flex-shrink-0" />}
            <span className="truncate">{thread.last_message_content || 'Sem mensagens'}</span>
          </p>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-white ${tipoCfg.bg} shadow-sm`}>
              {tipoCfg.emoji} {tipoCfg.label}
            </span>
            {contato?.tags?.length > 0 && (() => {
              const destaques = etiquetasDB.filter(e => e.destaque === true);
              const nomes = destaques.map(e => e.nome);
              const tags = contato.tags.filter(t => nomes.includes(t)).slice(0, 1);
              return tags.map(etq => {
                const cfg = getEtiquetaConfigDinamico(etq);
                return (
                  <span key={etq} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-white ${cfg.cor || 'bg-slate-500'} shadow-sm`}>
                    {cfg.emoji || '🏷️'} {cfg.label?.substring(0, 6) || etq}
                  </span>
                );
              });
            })()}
            {thread.assigned_user_id ? (() => {
              const nome = getUserDisplayName(thread.assigned_user_id, atendentes);
              const vazio = nome === 'Carregando...' || nome === 'Usuário não encontrado';
              return vazio ? (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-slate-500 bg-slate-100 shadow-sm"><UserCheck className="w-2.5 h-2.5" />Restrito</span>
              ) : (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-white bg-indigo-500 shadow-sm"><UserCheck className="w-2.5 h-2.5" />{nome.split(' ')[0]}</span>
              );
            })() : getAtendenteFidelizado(contato)?.id ? (() => {
              const af = getAtendenteFidelizado(contato);
              const nome = getUserDisplayName(af.id, atendentes);
              const vazio = nome === 'Carregando...' || nome === 'Usuário não encontrado';
              return vazio ? (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-slate-500 bg-slate-100 shadow-sm">VIP Restrito</span>
              ) : (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-amber-700 bg-amber-100 shadow-sm">VIP {nome.split(' ')[0]}</span>
              );
            })() : thread.is_contact_only ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-slate-500 bg-slate-100 shadow-sm">S/atend.</span>
            ) : (
              <AtribuidorAtendenteRapido contato={contato} thread={thread} tipoContato={contato?.tipo_contato || 'novo'} setorAtual={thread?.sector_id || 'geral'} variant="mini" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Linha de lista completa (estilo ChatSidebar) — para a barra de contatos ─

function ThreadRowSidebar({ thread, isAtiva, usuarioAtual, atendentes, integracoes, onSelecionarThread }) {
  const contato = thread.contato;
  const hasUnread = getUnreadCount(thread, usuarioAtual?.id) > 0;
  const { etiquetas: etiquetasDB, getConfig: getEtiquetaConfigDinamico } = useEtiquetasContato();

  let nomeExibicao = "";
  if (contato?.empresa) nomeExibicao += contato.empresa;
  if (contato?.cargo) nomeExibicao += (nomeExibicao ? " - " : "") + contato.cargo;
  if (contato?.nome && contato.nome !== contato?.telefone) nomeExibicao += (nomeExibicao ? " - " : "") + contato.nome;
  if (!nomeExibicao) nomeExibicao = contato?.telefone || "Sem Nome";

  const tiposConfig = {
    'novo': { emoji: '?', label: 'Novo', bg: 'bg-slate-400' },
    'lead': { emoji: 'L', label: 'Lead', bg: 'bg-amber-500' },
    'cliente': { emoji: 'C', label: 'Cliente', bg: 'bg-emerald-500' },
    'fornecedor': { emoji: 'F', label: 'Fornec.', bg: 'bg-blue-500' },
    'parceiro': { emoji: 'P', label: 'Parceiro', bg: 'bg-purple-500' }
  };
  const tipoCfg = tiposConfig[contato?.tipo_contato || 'novo'] || tiposConfig['novo'];
  const getAtendenteFidelizado = (c) => getAtendenteFidelizadoAtualizado(c, atendentes);
  const integracao = integracoes?.find(i => i.id === thread.whatsapp_integration_id);
  const ultimos4 = integracao?.numero_telefone?.slice(-4);

  return (
    <div
      onClick={() => onSelecionarThread(thread)}
      className={`px-2 py-2 flex items-center gap-2.5 cursor-pointer transition-all hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 ${isAtiva ? 'bg-blue-50 border-l-[3px] border-l-orange-500' : 'border-l-[3px] border-l-transparent'}`}
    >
      <div className="relative flex-shrink-0">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md overflow-hidden ${hasUnread ? 'bg-gradient-to-br from-amber-400 via-orange-500 to-red-500' : 'bg-gradient-to-br from-slate-400 to-slate-500'}`}>
          {contato?.foto_perfil_url && contato.foto_perfil_url !== 'null' ? (
            <img src={contato.foto_perfil_url} alt={nomeExibicao} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
          ) : nomeExibicao.charAt(0).toUpperCase()}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <h3 className={`font-semibold truncate text-sm ${hasUnread ? 'text-slate-900' : 'text-slate-700'}`}>{nomeExibicao}</h3>
            {hasUnread && (
              <Badge className="rounded-full min-w-[18px] h-4 flex items-center justify-center p-0 px-1 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white text-[10px] font-bold border-0 shadow-lg flex-shrink-0">
                {getUnreadCount(thread, usuarioAtual?.id)}
              </Badge>
            )}
            {ultimos4 && <span className="text-[9px] text-slate-400 flex-shrink-0">#{ultimos4}</span>}
          </div>
          <span className={`text-[10px] flex-shrink-0 ml-2 ${hasUnread ? 'text-orange-600 font-medium' : 'text-slate-400'}`}>{formatarHorario(thread.last_message_at)}</span>
        </div>
        <p className={`text-xs truncate flex items-center gap-1 ${hasUnread ? 'text-slate-800' : 'text-slate-500'}`}>
          {thread.last_message_sender === 'user' && (() => {
            const s = thread.last_message_status;
            if (s === 'lida') return <CheckCheck className="w-3 h-3 text-blue-500 flex-shrink-0" />;
            if (s === 'entregue') return <CheckCheck className="w-3 h-3 text-slate-400 flex-shrink-0" />;
            if (s === 'enviada') return <Check className="w-3 h-3 text-slate-400 flex-shrink-0" />;
            if (s === 'falhou') return <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />;
            return <CheckCheck className="w-3 h-3 text-slate-400 flex-shrink-0" />;
          })()}
          {thread.last_media_type === 'image' && <Image className="w-3 h-3 text-blue-500 flex-shrink-0" />}
          {thread.last_media_type === 'video' && <Video className="w-3 h-3 text-purple-500 flex-shrink-0" />}
          {thread.last_media_type === 'audio' && <Mic className="w-3 h-3 text-green-500 flex-shrink-0" />}
          {thread.last_media_type === 'document' && <FileText className="w-3 h-3 text-orange-500 flex-shrink-0" />}
          <span className="truncate">{(() => {
             const c = thread.last_message_content;
             if (c && /^(⏰|✅ Tarefa|💬 Lembrete|🔔 Lembrete|🤖 Sistema|📊)/.test(c)) return 'Nova mensagem';
             return c || 'Sem mensagens';
           })()}</span>
          {thread.last_message_sender_name && (() => {
           // Suprimir nomes internos técnicos (sem espaço, letras+números, nomes de instância)
           const nome = thread.last_message_sender_name;
            const ehNomeTecnico = /^[a-z0-9_-]+$/i.test(nome) && !nome.includes(' ');
            if (ehNomeTecnico) return null;
            return <span className="text-[9px] text-slate-400 italic flex-shrink-0">~ {nome.split(' ')[0]}</span>;
          })()}
        </p>
        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white ${tipoCfg.bg} shadow-sm`}>
            {tipoCfg.emoji} {tipoCfg.label}
          </span>
          {contato?.tags?.length > 0 && (() => {
            const destaques = etiquetasDB.filter(e => e.destaque === true);
            const nomes = destaques.map(e => e.nome);
            const tags = contato.tags.filter(t => nomes.includes(t)).slice(0, 1);
            return tags.map(etq => {
              const cfg = getEtiquetaConfigDinamico(etq);
              return (
                <span key={etq} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white ${cfg.cor || 'bg-slate-500'} shadow-sm`}>
                  {cfg.emoji || '🏷️'} {cfg.label?.substring(0, 6) || etq}
                </span>
              );
            });
          })()}
          {thread.assigned_user_id ? (() => {
            const nome = getUserDisplayName(thread.assigned_user_id, atendentes);
            const vazio = nome === 'Carregando...' || nome === 'Usuário não encontrado';
            return vazio ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-slate-500 bg-slate-100 shadow-sm"><UserCheck className="w-3 h-3" />Restrito</span>
            ) : (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white bg-indigo-500 shadow-sm"><UserCheck className="w-3 h-3" />{nome.split(' ')[0]}</span>
            );
          })() : getAtendenteFidelizado(contato)?.id ? (() => {
            const af = getAtendenteFidelizado(contato);
            const nome = getUserDisplayName(af.id, atendentes);
            const vazio = nome === 'Carregando...' || nome === 'Usuário não encontrado';
            return vazio ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-slate-500 bg-slate-100 shadow-sm">VIP Restrito</span>
            ) : (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-amber-700 bg-amber-100 shadow-sm">VIP {nome.split(' ')[0]}</span>
            );
          })() : thread.is_contact_only ? (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-slate-500 bg-slate-100 shadow-sm">S/atend.</span>
          ) : (
            <AtribuidorAtendenteRapido contato={contato} thread={thread} tipoContato={contato?.tipo_contato || 'novo'} setorAtual={thread?.sector_id || 'geral'} variant="mini" />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ───────────────────────────────────────────────────

export default function ChatSidebarKanban({
  threads,
  threadAtiva,
  onSelecionarThread,
  onVoltar,
  usuarioAtual,
  integracoes = [],
  atendentes = [],
  onOpenKanbanNaoAtribuidos,
  onOpenKanbanRequerAtencao,
  onSelectInternalDestinations,
  // Props do modo lista (passadas de Comunicacao)
  sidebarViewMode,
  onSidebarViewModeChange,
  modoSelecaoMultipla = false,
  onModoSelecaoMultiplaChange,
}) {
  // Modos válidos — qualquer modo não listado aqui cai no fallback do renderKanbanBody
  const MODOS_VALIDOS = ['parados', 'usuario', 'integracao', 'urgentes', 'jarvis'];
  const [kanbanMode, setKanbanMode] = React.useState('usuario');
  const [internalComposerOpen, setInternalComposerOpen] = React.useState(false);
  const [delegateMode, setDelegateMode] = React.useState(false);
  const [criarGrupoOpen, setCriarGrupoOpen] = React.useState(false);
  const [agendaIAOpen, setAgendaIAOpen] = React.useState(false);
  const [manualJarvisOpen, setManualJarvisOpen] = React.useState(false);

  const isAdmin = usuarioAtual?.role === 'admin';
  const isGerente = ['gerente', 'coordenador', 'supervisor'].includes(usuarioAtual?.attendant_role);

  // ── Threads filtradas por visibilidade ──────────────────────────────────
  const threadsFiltradas = React.useMemo(() => {
    if (!usuarioAtual || threads.length === 0) return [];
    if (isAdmin) return threads;
    const norm = (v) => String(v || '').toLowerCase().trim();
    return threads.filter(thread => {
      if (!thread) return false;
      if (norm(thread.assigned_user_id) === norm(usuarioAtual.id) || norm(thread.assigned_user_email) === norm(usuarioAtual.email) || norm(thread.transfer_requested_user_id) === norm(usuarioAtual.id)) return true;
      if (isGerente) return true;
      if (!thread.assigned_user_id && !thread.assigned_user_name && !thread.assigned_user_email) return true;
      if (thread.shared_with_users?.includes(usuarioAtual.id)) return true;
      if ((thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') && thread.participants?.includes(usuarioAtual.id)) return true;
      return false;
    });
  }, [threads, usuarioAtual, isAdmin, isGerente]);

  // ── "Minhas Conversas" (coluna fixa de lista) ────────────────────────────
  // Apenas threads externas com contato real (clientes/leads), excluindo grupos de setor.
  const minhasConversas = React.useMemo(() => {
    const norm = (v) => String(v || '').toLowerCase().trim();
    return threadsFiltradas
      .filter(t => {
        // Excluir grupos internos de setor — eles ficam no painel de comunicação interna
        if (t.thread_type === 'team_internal' || t.thread_type === 'sector_group') return false;
        // Só threads com contato real
        if (!t.contact_id) return false;
        if (norm(t.assigned_user_id) === norm(usuarioAtual?.id)) return true;
        if (t.shared_with_users?.includes(usuarioAtual?.id)) return true;
        if (t.atendentes_historico?.includes(usuarioAtual?.id)) return true;
        return false;
      })
      .sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
  }, [threadsFiltradas, usuarioAtual]);

  // ── Só threads externas (clientes reais) para os painéis kanban ─────────
  // CRÍTICO: excluir explicitamente team_internal e sector_group para não
  // poluir "Parados", "Atendente" e "Canal" com grupos internos de setor.
  const externasKanban = React.useMemo(() =>
    threadsFiltradas.filter(t =>
      t.contact_id &&
      t.thread_type !== 'team_internal' &&
      t.thread_type !== 'sector_group' &&
      (t.thread_type === 'contact_external' || !t.thread_type)
    ),
    [threadsFiltradas]
  );

  // ── VISUALIZAÇÃO 1: Parados (sem resposta do atendente há mais de X horas) ─
  // Apenas contatos externos reais (leads/clientes) aguardando resposta.
  const HORAS_PARADO = 24;
  const threadsParadas = React.useMemo(() => {
    const limiteMs = HORAS_PARADO * 60 * 60 * 1000;
    const agora = Date.now();
    return externasKanban
      .filter(t => {
        // Garantia extra: nunca incluir grupos/setores internos
        if (t.thread_type === 'team_internal' || t.thread_type === 'sector_group') return false;
        if (!t.contact_id) return false;
        const lastAt = t.last_message_at ? new Date(t.last_message_at).getTime() : 0;
        const isOld = (agora - lastAt) >= limiteMs;
        const aguardaResposta = t.last_message_sender === 'contact';
        return isOld && aguardaResposta;
      })
      .sort((a, b) => new Date(a.last_message_at || 0) - new Date(b.last_message_at || 0)); // mais antigo primeiro
  }, [externasKanban]);

  // ── VISUALIZAÇÃO 2: Por atendente ────────────────────────────────────────
  const colunasPorUsuario = React.useMemo(() => {
    const norm = (v) => String(v || '').toLowerCase().trim();
    const mapa = {};
    mapa['__sem_atendente__'] = { id: '__sem_atendente__', nome: 'Não Atribuídas', isSemAtendente: true, threads: [] };

    externasKanban.forEach(thread => {
      const uid = thread.assigned_user_id;
      if (!uid) {
        if (!mapa['__sem_atendente__'].threads.find(t => t.id === thread.id))
          mapa['__sem_atendente__'].threads.push(thread);
        return;
      }
      if (!isAdmin && !isGerente && norm(uid) !== norm(usuarioAtual?.id)) return;
      if (!mapa[uid]) {
        const at = atendentes.find(a => a.id === uid);
        mapa[uid] = { id: uid, nome: at?.full_name || at?.display_name || uid.substring(0, 8), threads: [], atendente: at };
      }
      if (!mapa[uid].threads.find(t => t.id === thread.id))
        mapa[uid].threads.push(thread);
    });

    Object.values(mapa).forEach(col => col.threads.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0)));

    return Object.values(mapa).sort((a, b) => {
      if (a.isSemAtendente) return -1;
      if (b.isSemAtendente) return 1;
      const idxA = atendentes.findIndex(at => at.id === a.id);
      const idxB = atendentes.findIndex(at => at.id === b.id);
      return (idxA === -1 ? 9999 : idxA) - (idxB === -1 ? 9999 : idxB);
    }).filter(c => c.isSemAtendente || c.threads.length > 0);
  }, [externasKanban, usuarioAtual, atendentes, isAdmin, isGerente]);

  // ── VISUALIZAÇÃO 3: Por instância/canal ─────────────────────────────────
  const integracoesVisiveis = React.useMemo(() => {
    if (!usuarioAtual || integracoes.length === 0) return integracoes;
    if (isAdmin || isGerente) return integracoes;
    const integracoesPermitidas = usuarioAtual.integracoes_visiveis || usuarioAtual.whatsapp_permissions?.integracoes_visiveis;
    if (integracoesPermitidas?.length > 0) return integracoes.filter(i => integracoesPermitidas.includes(i.id));
    const idsComMinhas = new Set(externasKanban.filter(t => t.assigned_user_id === usuarioAtual.id).map(t => t.whatsapp_integration_id).filter(Boolean));
    return integracoes.filter(i => idsComMinhas.has(i.id));
  }, [integracoes, usuarioAtual, externasKanban, isAdmin, isGerente]);

  const colunasPorInstancia = React.useMemo(() => {
    if (integracoesVisiveis.length === 0) {
      const minhas = externasKanban.filter(t => t.assigned_user_id === usuarioAtual?.id || !t.assigned_user_id);
      return [{ id: 'sem_integracao', nome: 'Conversas', numero: '', threads: minhas, status: 'desconectado', cor: 'slate' }];
    }
    const mapa = {};
    const idsVisiveis = new Set(integracoesVisiveis.map(i => i.id));
    integracoesVisiveis.forEach(int => {
      mapa[int.id] = { id: int.id, nome: int.nome_instancia, numero: int.numero_telefone || '', status: int.status, cor: int.cor_chat || 'blue', threads: [] };
    });
    externasKanban.forEach(thread => {
      const integId = thread.whatsapp_integration_id;
      if (integId && mapa[integId]) {
        mapa[integId].threads.push(thread);
      } else if (isAdmin) {
        if (!mapa['outras']) mapa['outras'] = { id: 'outras', nome: 'Outras', numero: '', status: 'desconectado', cor: 'slate', threads: [] };
        mapa['outras'].threads.push(thread);
      }
    });
    Object.values(mapa).forEach(col => col.threads.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0)));
    return Object.values(mapa).filter(c => c.threads.length > 0 || integracoesVisiveis.find(i => i.id === c.id));
  }, [externasKanban, integracoesVisiveis, usuarioAtual, isAdmin]);

  // ── VISUALIZAÇÃO 4: Por atendente — monitorado pelo Jarvis ─────────────
  const colunasPorJarvis = React.useMemo(() => {
    const norm = (v) => String(v || '').toLowerCase().trim();
    const mapa = {};
    // Threads que o Jarvis monitorou (tem jarvis_alerted_at ou jarvis_last_playbook)
    const threadsJarvis = externasKanban.filter(t => t.jarvis_alerted_at || t.jarvis_last_playbook);

    threadsJarvis.forEach(thread => {
      const uid = thread.assigned_user_id || '__sem_atendente__';
      if (!isAdmin && !isGerente && norm(uid) !== norm(usuarioAtual?.id) && uid !== '__sem_atendente__') return;

      if (!mapa[uid]) {
        const at = atendentes.find(a => a.id === uid);
        mapa[uid] = {
          id: uid,
          nome: uid === '__sem_atendente__' ? 'Não Atribuídas' : (at?.full_name || at?.display_name || uid.substring(0, 8)),
          isSemAtendente: uid === '__sem_atendente__',
          threads: []
        };
      }
      if (!mapa[uid].threads.find(t => t.id === thread.id))
        mapa[uid].threads.push(thread);
    });

    Object.values(mapa).forEach(col => col.threads.sort((a, b) => {
      // Ordenar por score do Jarvis (prioridade mais alta primeiro)
      const scoreA = a._analiseComportamental?.priority_score || 0;
      const scoreB = b._analiseComportamental?.priority_score || 0;
      return scoreB - scoreA;
    }));

    return Object.values(mapa)
      .sort((a, b) => {
        if (a.isSemAtendente) return -1;
        if (b.isSemAtendente) return 1;
        return b.threads.length - a.threads.length;
      })
      .filter(c => c.threads.length > 0);
  }, [externasKanban, usuarioAtual, atendentes, isAdmin, isGerente]);

  const corConfig = {
    blue: 'bg-blue-600', green: 'bg-green-600', purple: 'bg-purple-600',
    orange: 'bg-orange-600', pink: 'bg-pink-600', teal: 'bg-teal-600',
    indigo: 'bg-indigo-600', rose: 'bg-rose-600', slate: 'bg-slate-500'
  };
  const statusDot = {
    'conectado': 'bg-green-400', 'desconectado': 'bg-red-400',
    'reconectando': 'bg-yellow-400', 'pendente_qrcode': 'bg-yellow-400',
  };

  // ─── Sub-funções de render por modo ────────────────────────────────────

  const renderModoUrgentes = () => (
    <div className="flex-1 min-w-0 overflow-hidden rounded-xl">
      <ContatosRequerendoAtencaoKanban
        usuario={usuarioAtual}
        onSelecionarContato={onSelecionarThread}
        onClose={() => setKanbanMode('usuario')}
        threads={threads}
        integracoes={integracoes}
        atendentes={atendentes}
      />
    </div>
  );

  const renderModoParados = () => (
    <div className="flex flex-col flex-shrink-0 w-72 min-w-[260px] bg-white rounded-xl border-2 border-yellow-400 overflow-hidden shadow-md">
      <div className="bg-gradient-to-r from-yellow-500 to-amber-500 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pause className="w-4 h-4 text-white" />
          <span className="text-white font-semibold text-xs">Parados (+{HORAS_PARADO}h)</span>
        </div>
        <span className="text-white/80 text-[10px]">{threadsParadas.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {threadsParadas.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">Nenhuma conversa parada</div>
        ) : threadsParadas.map(thread => (
          <ThreadRowSidebar key={thread.id} thread={thread} isAtiva={threadAtiva?.id === thread.id}
            usuarioAtual={usuarioAtual} atendentes={atendentes} integracoes={integracoes} onSelecionarThread={onSelecionarThread} />
        ))}
      </div>
    </div>
  );

  const renderModoUsuario = () => colunasPorUsuario.map(coluna => {
    const headerCor = coluna.isSemAtendente
      ? 'bg-gradient-to-r from-slate-500 to-slate-600'
      : 'bg-gradient-to-r from-indigo-500 to-indigo-600';
    return renderColuna(coluna, headerCor, (
      <div className="flex items-center gap-1.5 min-w-0">
        <Users className="w-3.5 h-3.5 text-white/80 flex-shrink-0" />
        <span className="text-white font-semibold text-xs truncate">{coluna.nome}</span>
      </div>
    ));
  });

  const renderModoIntegracao = () => colunasPorInstancia.map(coluna => {
    const totalNaoLidas = coluna.threads.reduce((sum, t) => sum + getUnreadCount(t, usuarioAtual?.id), 0);
    const headerCor = corConfig[coluna.cor] || 'bg-slate-600';
    const dotCor = statusDot[coluna.status] || 'bg-slate-400';
    return renderColuna(coluna, headerCor, (
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotCor}`} />
        <span className="text-white font-semibold text-xs truncate">{coluna.nome}</span>
        {totalNaoLidas > 0 && (
          <Badge className="rounded-full min-w-[18px] h-4 flex items-center justify-center p-0 px-1 bg-white/30 text-white text-[9px] font-bold border-0">
            {totalNaoLidas}
          </Badge>
        )}
      </div>
    ));
  });

  const renderModoJarvis = () => {
    if (colunasPorJarvis.length === 0) return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-slate-400">
          <Bot className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium">Nenhum alerta Jarvis ativo</p>
          <p className="text-xs mt-1">Quando o Jarvis alertar sobre uma conversa, ela aparecerá aqui.</p>
        </div>
      </div>
    );
    return colunasPorJarvis.map(coluna => {
      const headerCor = coluna.isSemAtendente ? 'bg-slate-600' : 'bg-gradient-to-r from-violet-600 to-purple-700';
      return renderColuna(coluna, headerCor, (
        <div className="flex items-center gap-1.5 min-w-0">
          <Bot className="w-3.5 h-3.5 text-white/80 flex-shrink-0" />
          <span className="text-white font-semibold text-xs truncate">{coluna.nome}</span>
          <span className="text-white/60 text-[9px] flex-shrink-0">Jarvis</span>
        </div>
      ));
    });
  };

  // ─── Dispatcher principal — ÚNICO ponto de controle de modos ───────────
  // Adicionar novo modo: 1) inclui no MODOS_VALIDOS 2) cria renderModoXxx() 3) adiciona chave aqui.
  const renderKanbanBody = () => {
    const modoAtivo = MODOS_VALIDOS.includes(kanbanMode) ? kanbanMode : 'usuario';
    const modos = {
      urgentes:   renderModoUrgentes,
      parados:    renderModoParados,
      usuario:    renderModoUsuario,
      integracao: renderModoIntegracao,
      jarvis:     renderModoJarvis,
    };
    return modos[modoAtivo]();
  };

  // ─── Render coluna kanban genérica ─────────────────────────────────────
  const renderColuna = (coluna, headerCor, headerContent) => (
    <div key={coluna.id} className={`flex flex-col flex-shrink-0 w-52 min-w-[200px] bg-slate-50 rounded-xl overflow-hidden shadow-sm border border-slate-200`}>
      <div className={`${headerCor} px-3 py-2 flex items-center justify-between`}>
        {headerContent}
        <span className="text-white/80 text-[9px] flex-shrink-0 ml-2">{coluna.threads.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
        {coluna.threads.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">Sem conversas</div>
        ) : coluna.threads.map(thread => {
          const norm = (v) => String(v || '').toLowerCase().trim();
          const isAtribuidoOuTransferido = norm(thread.assigned_user_id) === norm(usuarioAtual?.id) || norm(thread.transfer_requested_user_id) === norm(usuarioAtual?.id);
          const isNaoAtribuida = !thread.assigned_user_id && !thread.assigned_user_name;
          const isCompartilhada = thread.shared_with_users?.includes(usuarioAtual?.id);
          const podeInteragir = isAdmin || isAtribuidoOuTransferido || isGerente || isNaoAtribuida || isCompartilhada;
          return (
            <ThreadCardKanban key={thread.id} thread={thread} isAtiva={threadAtiva?.id === thread.id}
              usuarioAtual={usuarioAtual} atendentes={atendentes} onSelecionarThread={onSelecionarThread} podeInteragir={podeInteragir} />
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 overflow-hidden">

      {/* ════ PAINEL ESQUERDO: Barra de Contatos (sempre visível) ════ */}
      <div className="flex flex-col flex-shrink-0 w-72 min-w-[260px] bg-white border-r border-slate-200 overflow-hidden">

        {/* Header ações internas */}
        <div className="flex-shrink-0 bg-purple-50/80 border-b border-purple-200 px-2 py-1.5 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white shadow-sm bg-gradient-to-br from-purple-500 to-indigo-600 flex-shrink-0">
              <MessagesSquare className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 text-xs truncate">Equipe interna</h3>
              <p className="text-[10px] text-slate-500 truncate">Envio 1:1 / Setores / Grupos</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1">
            <Button onClick={() => { setDelegateMode(false); setInternalComposerOpen(true); }} variant="outline" size="sm"
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white border-0 h-8 text-xs px-1">
              <Send className="w-3 h-3 mr-0.5 flex-shrink-0" /><span>Enviar</span>
            </Button>
            <Button onClick={() => { setDelegateMode(true); setInternalComposerOpen(true); }} variant="outline" size="sm"
              className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white border-0 h-8 text-xs px-1">
              <ArrowRightLeft className="w-3 h-3 mr-0.5 flex-shrink-0" /><span>Transfer</span>
            </Button>
            <Button onClick={() => setCriarGrupoOpen(true)} variant="outline" size="sm"
              className="bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white border-0 h-8 text-xs px-1">
              <Plus className="w-3 h-3 mr-0.5 flex-shrink-0" /><span>Grupo</span>
            </Button>
            <Button onClick={() => setAgendaIAOpen(true)} variant="outline" size="sm"
              className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white border-0 h-8 text-xs px-1">
              <CalendarCheck className="w-3 h-3 mr-0.5 flex-shrink-0" /><span>Agenda</span>
            </Button>
          </div>
        </div>

        {/* Título "Minhas Conversas" */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-white flex-shrink-0" />
            <span className="text-white font-semibold text-xs">Minhas Conversas</span>
          </div>
          <span className="text-white/80 text-[10px]">{minhasConversas.length}</span>
        </div>

        {/* Lista de contatos */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {minhasConversas.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">Nenhuma conversa atribuída</div>
          ) : minhasConversas.map(thread => (
            <ThreadRowSidebar
              key={thread.id}
              thread={thread}
              isAtiva={threadAtiva?.id === thread.id}
              usuarioAtual={usuarioAtual}
              atendentes={atendentes}
              integracoes={integracoes}
              onSelecionarThread={onSelecionarThread}
            />
          ))}
        </div>
      </div>

      {/* ════ PAINEL DIREITO: Visualizações Kanban ════ */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-slate-100">

        {/* Toolbar: toggle de visualização */}
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-3 py-2 flex items-center gap-2 flex-wrap">

          {/* Toggle Lista / Kanban */}
          {sidebarViewMode && onSidebarViewModeChange && (
            <div className="flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded-lg p-0.5">
              <button
                onClick={() => { onSidebarViewModeChange('list'); localStorage.setItem('sidebarViewMode', 'list'); }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all ${sidebarViewMode === 'list' ? 'bg-orange-500 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-white'}`}
                title="Lista"
              >
                <LayoutList className="w-3.5 h-3.5" />Lista
              </button>
              <button
                onClick={() => { onSidebarViewModeChange('kanban'); localStorage.setItem('sidebarViewMode', 'kanban'); }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all ${sidebarViewMode === 'kanban' ? 'bg-orange-500 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-white'}`}
                title="Kanban"
              >
                <Columns className="w-3.5 h-3.5" />Kanban
              </button>
            </div>
          )}

          {/* Seleção múltipla */}
          {onModoSelecaoMultiplaChange && (
            <button
              onClick={() => onModoSelecaoMultiplaChange(!modoSelecaoMultipla)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all border ${modoSelecaoMultipla ? 'bg-orange-500 text-white border-orange-500 shadow' : 'text-slate-500 bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
              title="Selecionar múltiplos para envio em massa"
            >
              <CheckSquare className="w-3.5 h-3.5" />Selecionar
            </button>
          )}

          <div className="h-5 w-px bg-slate-200" />

          {/* Não Atribuídos */}
          {onOpenKanbanNaoAtribuidos && (() => {
            const cnt = threads?.filter(t =>
              !t.assigned_user_id &&
              t.contact_id &&
              !t.is_contact_only &&
              t.thread_type !== 'team_internal' &&
              t.thread_type !== 'sector_group'
            ).length || 0;
            return (
              <Button onClick={onOpenKanbanNaoAtribuidos} size="sm"
                className="bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white border-0 h-8 text-xs px-2.5 flex items-center gap-1 font-semibold shadow-sm">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />Não Atribuídos
                {cnt > 0 && <Badge className="bg-white text-red-600 text-[9px] font-bold px-1 h-4 min-w-4 flex items-center justify-center rounded-full ml-0.5">{cnt}</Badge>}
              </Button>
            );
          })()}

          <div className="h-5 w-px bg-slate-200" />

          {/* Toggle 3 visualizações */}
          <div className="flex items-center gap-0.5 bg-slate-100 border border-slate-200 rounded-lg p-0.5">
            <button onClick={() => setKanbanMode('parados')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${kanbanMode === 'parados' ? 'bg-yellow-500 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-white'}`}>
              <Pause className="w-3 h-3" />Parados
            </button>
            <button onClick={() => setKanbanMode('usuario')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${kanbanMode === 'usuario' ? 'bg-indigo-500 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-white'}`}>
              <Users className="w-3 h-3" />Atendente
            </button>
            <button onClick={() => setKanbanMode('integracao')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${kanbanMode === 'integracao' ? 'bg-orange-500 text-white shadow' : 'text-slate-500 hover:text-slate-800 hover:bg-white'}`}>
              <Columns className="w-3 h-3" />Canal
            </button>
          </div>

          {/* Urgentes */}
          <button onClick={() => setKanbanMode('urgentes')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${kanbanMode === 'urgentes' ? 'bg-purple-600 text-white shadow' : 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100'}`}>
            <Zap className="w-3.5 h-3.5 flex-shrink-0" />Urgentes
          </button>

          {/* Jarvis */}
          <button onClick={() => setKanbanMode('jarvis')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${kanbanMode === 'jarvis' ? 'bg-violet-600 text-white shadow' : 'text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100'}`}>
            <Bot className="w-3.5 h-3.5 flex-shrink-0" />Jarvis
          </button>

          <div className="h-5 w-px bg-slate-200" />

          {/* Manual de Bolso */}
          <button onClick={() => setManualJarvisOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100"
            title="Manual de Bolso — Alertas do Jarvis">
            <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />Manual
          </button>
        </div>

        {/* Colunas Kanban */}
        <div className="flex gap-2 flex-1 overflow-x-auto p-2 min-h-0">

          {/* ── VISUALIZAÇÃO: URGENTES (Contatos Requerendo Atenção) ── */}
          {kanbanMode === 'urgentes' && (
            <div className="flex-1 min-w-0 overflow-hidden rounded-xl">
              <ContatosRequerendoAtencaoKanban
                usuario={usuarioAtual}
                onSelecionarContato={onSelecionarThread}
                onClose={() => setKanbanMode('usuario')}
                threads={threads}
                integracoes={integracoes}
                atendentes={atendentes}
              />
            </div>
          )}

          {/* ── VISUALIZAÇÃO: PARADOS ── */}
          {kanbanMode === 'parados' && (
            <div className="flex flex-col flex-shrink-0 w-72 min-w-[260px] bg-white rounded-xl border-2 border-yellow-400 overflow-hidden shadow-md">
              <div className="bg-gradient-to-r from-yellow-500 to-amber-500 px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Pause className="w-4 h-4 text-white" />
                  <span className="text-white font-semibold text-xs">Parados (+{HORAS_PARADO}h)</span>
                </div>
                <span className="text-white/80 text-[10px]">{threadsParadas.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {threadsParadas.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">Nenhuma conversa parada</div>
                ) : threadsParadas.map(thread => (
                  <ThreadRowSidebar key={thread.id} thread={thread} isAtiva={threadAtiva?.id === thread.id}
                    usuarioAtual={usuarioAtual} atendentes={atendentes} integracoes={integracoes} onSelecionarThread={onSelecionarThread} />
                ))}
              </div>
            </div>
          )}

          {/* ── VISUALIZAÇÃO: POR ATENDENTE ── */}
          {kanbanMode === 'usuario' && colunasPorUsuario.map(coluna => {
            const headerCor = coluna.isSemAtendente
              ? 'bg-gradient-to-r from-slate-500 to-slate-600'
              : 'bg-gradient-to-r from-indigo-500 to-indigo-600';
            return renderColuna(coluna, headerCor, (
              <div className="flex items-center gap-1.5 min-w-0">
                <Users className="w-3.5 h-3.5 text-white/80 flex-shrink-0" />
                <span className="text-white font-semibold text-xs truncate">{coluna.nome}</span>
              </div>
            ));
          })}

          {/* ── VISUALIZAÇÃO: JARVIS (por atendente monitorado) ── */}
          {kanbanMode === 'jarvis' && colunasPorJarvis.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-slate-400">
                <Bot className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">Nenhum alerta Jarvis ativo</p>
                <p className="text-xs mt-1">Quando o Jarvis alertar sobre uma conversa, ela aparecerá aqui.</p>
              </div>
            </div>
          )}
          {kanbanMode === 'jarvis' && colunasPorJarvis.map(coluna => {
            const headerCor = coluna.isSemAtendente ? 'bg-slate-600' : 'bg-gradient-to-r from-violet-600 to-purple-700';
            return renderColuna(coluna, headerCor, (
              <div className="flex items-center gap-1.5 min-w-0">
                <Bot className="w-3.5 h-3.5 text-white/80 flex-shrink-0" />
                <span className="text-white font-semibold text-xs truncate">{coluna.nome}</span>
                <span className="text-white/60 text-[9px] flex-shrink-0">Jarvis</span>
              </div>
            ));
          })}

          {/* ── VISUALIZAÇÃO: POR INSTÂNCIA/CANAL ── */}
          {kanbanMode === 'integracao' && colunasPorInstancia.map(coluna => {
            const totalNaoLidas = coluna.threads.reduce((sum, t) => sum + getUnreadCount(t, usuarioAtual?.id), 0);
            const headerCor = corConfig[coluna.cor] || 'bg-slate-600';
            const dotCor = statusDot[coluna.status] || 'bg-slate-400';
            return renderColuna(coluna, headerCor, (
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotCor}`} />
                <span className="text-white font-semibold text-xs truncate">{coluna.nome}</span>
                {totalNaoLidas > 0 && (
                  <Badge className="rounded-full min-w-[18px] h-4 flex items-center justify-center p-0 px-1 bg-white/30 text-white text-[9px] font-bold border-0">
                    {totalNaoLidas}
                  </Badge>
                )}
              </div>
            ));
          })}
        </div>
      </div>

      {/* Modals */}
      <InternalMessageComposer
        open={internalComposerOpen}
        onClose={() => { setInternalComposerOpen(false); setDelegateMode(false); }}
        currentUser={usuarioAtual}
        mode={delegateMode ? 'delegate' : 'compose'}
        onSelectDestinations={(selection) => {
          setInternalComposerOpen(false);
          setDelegateMode(false);
          if (onSelectInternalDestinations) onSelectInternalDestinations(selection);
        }}
      />
      <CriarGrupoModal open={criarGrupoOpen} onClose={() => setCriarGrupoOpen(false)}
        usuarios={atendentes} currentUser={usuarioAtual}
        onSuccess={() => { setCriarGrupoOpen(false); toast.success('✅ Grupo criado!'); }} />
      <AgendaIAUnificada open={agendaIAOpen} onClose={() => setAgendaIAOpen(false)} usuario={usuarioAtual} />
      <ManualJarvis open={manualJarvisOpen} onClose={() => setManualJarvisOpen(false)} />
    </div>
  );
}