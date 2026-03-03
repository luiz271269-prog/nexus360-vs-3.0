import React from "react";
import { format } from "date-fns";
import { CheckCheck, Image, Video, Mic, FileText, MapPin, Phone as PhoneIcon, UserCheck, Badge as BadgeIcon, Columns, Users, Send, ArrowRightLeft, Plus, CalendarCheck, AlertTriangle, MessagesSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getUserDisplayName } from "../lib/userHelpers";
import InternalMessageComposer from "./InternalMessageComposer";
import CriarGrupoModal from "./CriarGrupoModal";
import AgendaIAUnificada from "./AgendaIAUnificada";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

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

function ThreadCardKanban({ thread, isAtiva, usuarioAtual, atendentes, onSelecionarThread, podeInteragir, isDragging, onMouseDown }) {
  const contato = thread.contato;
  const hasUnread = getUnreadCount(thread, usuarioAtual?.id) > 0;

  let nomeExibicao = "";
  if (contato?.empresa) nomeExibicao += contato.empresa;
  if (contato?.cargo) nomeExibicao += (nomeExibicao ? " - " : "") + contato.cargo;
  if (contato?.nome && contato.nome !== contato?.telefone) nomeExibicao += (nomeExibicao ? " - " : "") + contato.nome;
  if (!nomeExibicao) nomeExibicao = contato?.telefone || "Sem Nome";

  const tiposConfig = {
    'novo': { label: 'Novo', bg: 'bg-slate-400' },
    'lead': { label: 'Lead', bg: 'bg-amber-500' },
    'cliente': { label: 'Cliente', bg: 'bg-emerald-500' },
    'fornecedor': { label: 'Fornec.', bg: 'bg-blue-500' },
    'parceiro': { label: 'Parceiro', bg: 'bg-purple-500' }
  };
  const tipoCfg = tiposConfig[contato?.tipo_contato || 'novo'] || tiposConfig['novo'];

  const nomeAtendente = thread.assigned_user_id
    ? getUserDisplayName(thread.assigned_user_id, atendentes)
    : null;

  return (
    <div
      onMouseDown={onMouseDown ? (e) => onMouseDown(e, thread) : undefined}
      onClick={() => podeInteragir && onSelecionarThread(thread)}
      className={`rounded-lg border shadow-sm p-2.5 transition-all select-none
        ${onMouseDown ? 'cursor-grab active:cursor-grabbing' : ''}
        ${podeInteragir && !onMouseDown ? 'cursor-pointer hover:shadow-md hover:border-orange-300' : ''}
        ${!podeInteragir ? 'cursor-not-allowed opacity-50' : ''}
        ${isDragging ? 'opacity-40 scale-95' : ''}
        ${isAtiva ? 'border-orange-500 bg-orange-50 shadow-md shadow-orange-200 scale-[1.03] z-10 relative ring-2 ring-orange-400 ring-offset-1' : 'bg-white border-slate-200'}`}
      title={!podeInteragir ? 'Sem permissão para acessar esta conversa' : (onMouseDown ? 'Arraste para reatribuir' : '')}
    >
      {/* Linha 1: Avatar + Nome + Horário */}
      <div className="flex items-start gap-2 mb-1.5">
        <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm overflow-hidden ${hasUnread ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-slate-400 to-slate-500'}`}>
          {contato?.foto_perfil_url ? (
            <img src={contato.foto_perfil_url} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
          ) : (
            nomeExibicao.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className={`text-xs font-semibold truncate ${hasUnread ? 'text-slate-900' : 'text-slate-700'}`}>
              {nomeExibicao}
            </p>
            <span className={`text-[9px] flex-shrink-0 ${hasUnread ? 'text-orange-600 font-medium' : 'text-slate-400'}`}>
              {formatarHorario(thread.last_message_at)}
            </span>
          </div>
          {/* Preview da última mensagem */}
          <p className="text-[10px] text-slate-500 truncate flex items-center gap-0.5 mt-0.5">
            {thread.last_message_sender === 'user' && <CheckCheck className="w-2.5 h-2.5 text-blue-500 flex-shrink-0" />}
            {thread.last_media_type === 'image' && <Image className="w-2.5 h-2.5 text-blue-500 flex-shrink-0" />}
            {thread.last_media_type === 'audio' && <Mic className="w-2.5 h-2.5 text-green-500 flex-shrink-0" />}
            {thread.last_media_type === 'document' && <FileText className="w-2.5 h-2.5 text-orange-500 flex-shrink-0" />}
            <span className="truncate">{thread.last_message_content || 'Sem mensagens'}</span>
          </p>
        </div>
      </div>

      {/* Linha 2: Badges */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-white ${tipoCfg.bg}`}>
          {tipoCfg.label}
        </span>
        {hasUnread && (
          <Badge className="rounded-full min-w-[16px] h-3.5 flex items-center justify-center p-0 px-1 bg-gradient-to-r from-amber-400 to-red-500 text-white text-[9px] font-bold border-0">
            {getUnreadCount(thread, usuarioAtual?.id)}
          </Badge>
        )}
        {nomeAtendente && nomeAtendente !== 'Usuário não encontrado' && (
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-white bg-indigo-500 flex items-center gap-0.5">
            <UserCheck className="w-2.5 h-2.5" />
            {nomeAtendente.split(' ')[0]}
          </span>
        )}
      </div>
    </div>
  );
}

// Ghost card que segue o mouse durante o drag
function DragGhost({ thread, position }) {
  if (!thread || !position) return null;
  const contato = thread.contato;
  let nomeExibicao = contato?.empresa || contato?.nome || contato?.telefone || "Contato";

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x + 12,
        top: position.y + 12,
        zIndex: 9999,
        pointerEvents: 'none',
        width: 180,
        opacity: 0.9,
        transform: 'rotate(3deg)',
      }}
      className="rounded-lg border-2 border-orange-400 bg-orange-50 shadow-2xl p-2.5"
    >
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-xs bg-gradient-to-br from-orange-400 to-amber-500">
          {nomeExibicao.charAt(0).toUpperCase()}
        </div>
        <p className="text-xs font-semibold truncate text-slate-800">{nomeExibicao}</p>
      </div>
    </div>
  );
}

export default function ChatSidebarKanban({ threads, threadAtiva, onSelecionarThread, onVoltar, usuarioAtual, integracoes = [], atendentes = [], onOpenKanbanNaoAtribuidos, onOpenKanbanRequerAtencao, onSelectInternalDestinations }) {
  const [kanbanMode, setKanbanMode] = React.useState('usuario');
  const [internalComposerOpen, setInternalComposerOpen] = React.useState(false);
  const [delegateMode, setDelegateMode] = React.useState(false);
  const [criarGrupoOpen, setCriarGrupoOpen] = React.useState(false);
  const [agendaIAOpen, setAgendaIAOpen] = React.useState(false);

  // Drag state usando mouse events
  const [draggingThread, setDraggingThread] = React.useState(null);
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });
  const [hoveredColuna, setHoveredColuna] = React.useState(null);
  const [isDraggingActive, setIsDraggingActive] = React.useState(false);
  const dragStartPos = React.useRef(null);
  const colunaRefs = React.useRef({});

  const isAdmin = usuarioAtual?.role === 'admin';
  const isGerente = ['gerente', 'coordenador', 'supervisor'].includes(usuarioAtual?.attendant_role);
  const podeReatribuir = isAdmin || isGerente;

  const handleMouseDown = React.useCallback((e, thread) => {
    if (!podeReatribuir) return;
    e.preventDefault();
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    setMousePos({ x: e.clientX, y: e.clientY });
    setDraggingThread(thread);
  }, [podeReatribuir]);

  React.useEffect(() => {
    if (!draggingThread) return;

    const onMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });

      if (!isDraggingActive) {
        const dx = Math.abs(e.clientX - (dragStartPos.current?.x || 0));
        const dy = Math.abs(e.clientY - (dragStartPos.current?.y || 0));
        if (dx > 5 || dy > 5) {
          setIsDraggingActive(true);
        }
      }

      // Detectar qual coluna está sendo hovereada
      if (isDraggingActive) {
        let found = null;
        Object.entries(colunaRefs.current).forEach(([colunaId, el]) => {
          if (!el) return;
          const rect = el.getBoundingClientRect();
          if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
            found = colunaId;
          }
        });
        setHoveredColuna(found);
      }
    };

    const onMouseUp = async (e) => {
      const thread = draggingThread;
      const targetColuna = hoveredColuna;
      setDraggingThread(null);
      setIsDraggingActive(false);
      setHoveredColuna(null);
      dragStartPos.current = null;

      if (!targetColuna || !isDraggingActive) return;

      const novoAtendente = targetColuna === '__sem_atendente__' ? null : targetColuna;
      if ((thread.assigned_user_id || null) === (novoAtendente || null)) return;

      try {
        const atendente = atendentes.find(a => a.id === novoAtendente);
        await base44.entities.MessageThread.update(thread.id, {
          assigned_user_id: novoAtendente || null,
          assigned_user_name: atendente?.full_name || null,
        });
        const nomeAtendente = atendente?.full_name || 'Não Atribuída';
        toast.success(`✅ Conversa atribuída a: ${nomeAtendente}`);
      } catch (err) {
        toast.error('Erro ao reatribuir conversa');
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [draggingThread, isDraggingActive, hoveredColuna, atendentes]);

  // ✅ APLICAR MESMA LÓGICA DE VISIBILIDADE DO CHATWINDOW
  const threadsFiltradas = React.useMemo(() => {
    if (!usuarioAtual || threads.length === 0) return [];
    if (usuarioAtual.role === 'admin') return threads;

    return threads.filter(thread => {
      if (!thread) return false;
      const norm = (v) => String(v || '').toLowerCase().trim();

      if (
        norm(thread.assigned_user_id) === norm(usuarioAtual.id) ||
        norm(thread.assigned_user_email) === norm(usuarioAtual.email) ||
        norm(thread.assigned_user_name) === norm(usuarioAtual.full_name) ||
        norm(thread.transfer_requested_user_id) === norm(usuarioAtual.id)
      ) return true;

      if (['gerente', 'coordenador', 'supervisor'].includes(usuarioAtual.attendant_role)) return true;
      if (!thread.assigned_user_id && !thread.assigned_user_name && !thread.assigned_user_email) return true;
      if (thread.shared_with_users?.includes(usuarioAtual.id)) return true;
      if (
        (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') &&
        thread.participants?.includes(usuarioAtual.id)
      ) return true;

      return false;
    });
  }, [threads, usuarioAtual]);

  const minhasConversas = React.useMemo(() => {
    const norm = (v) => String(v || '').toLowerCase().trim();
    return threadsFiltradas
      .filter(t => {
        if (norm(t.assigned_user_id) === norm(usuarioAtual?.id)) return true;
        if (t.shared_with_users?.includes(usuarioAtual?.id)) return true;
        if (t.atendentes_historico?.includes(usuarioAtual?.id)) return true;
        return false;
      })
      .sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
  }, [threadsFiltradas, usuarioAtual]);

  const integracoesVisiveis = React.useMemo(() => {
    if (!usuarioAtual || integracoes.length === 0) return integracoes;
    if (usuarioAtual.role === 'admin') return integracoes;

    const integracoesPermitidas = usuarioAtual.integracoes_visiveis || usuarioAtual.whatsapp_permissions?.integracoes_visiveis;
    if (integracoesPermitidas && integracoesPermitidas.length > 0) {
      return integracoes.filter(i => integracoesPermitidas.includes(i.id));
    }

    if (['gerente', 'coordenador', 'supervisor'].includes(usuarioAtual.attendant_role)) return integracoes;

    const idsComMinhas = new Set(
      threadsFiltradas
        .filter(t => t.assigned_user_id === usuarioAtual.id || t.shared_with_users?.includes(usuarioAtual.id) || t.atendentes_historico?.includes(usuarioAtual.id))
        .map(t => t.whatsapp_integration_id)
        .filter(Boolean)
    );
    return integracoes.filter(i => idsComMinhas.has(i.id));
  }, [integracoes, usuarioAtual, threadsFiltradas]);

  const colunas = React.useMemo(() => {
    const externas = threadsFiltradas.filter(t =>
      t.thread_type === 'contact_external' || (!t.thread_type && t.contact_id)
    );

    if (integracoesVisiveis.length === 0) {
      const minhas = externas.filter(t => t.assigned_user_id === usuarioAtual?.id || !t.assigned_user_id);
      return [{ id: 'sem_integracao', nome: 'Conversas', numero: '', threads: minhas, status: 'desconectado' }];
    }

    const mapa = {};
    const idsVisiveis = new Set(integracoesVisiveis.map(i => i.id));

    integracoesVisiveis.forEach(int => {
      mapa[int.id] = { id: int.id, nome: int.nome_instancia, numero: int.numero_telefone || '', status: int.status, cor: int.cor_chat || 'blue', threads: [] };
    });

    externas.forEach(thread => {
      const integId = thread.whatsapp_integration_id;
      if (integId && mapa[integId]) {
        mapa[integId].threads.push(thread);
      } else if (!integId || !idsVisiveis.has(integId)) {
        if (usuarioAtual?.role === 'admin') {
          if (!mapa['outras']) {
            mapa['outras'] = { id: 'outras', nome: 'Outras', numero: '', status: 'desconectado', cor: 'slate', threads: [] };
          }
          mapa['outras'].threads.push(thread);
        }
      }
    });

    Object.values(mapa).forEach(col => {
      col.threads.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
    });

    return Object.values(mapa).filter(c => c.threads.length > 0 || integracoesVisiveis.find(i => i.id === c.id));
  }, [threadsFiltradas, integracoesVisiveis, usuarioAtual]);

  const colunasPorUsuario = React.useMemo(() => {
    const externas = threadsFiltradas.filter(t =>
      t.thread_type === 'contact_external' || (!t.thread_type && t.contact_id)
    );

    const norm = (v) => String(v || '').toLowerCase().trim();
    const mapa = {};

    mapa['__minhas__'] = { id: '__minhas__', nome: 'Minhas Conversas', isMinhas: true, threads: [] };

    externas.forEach(thread => {
      const uid = thread.assigned_user_id;
      const isMinhaThread =
        norm(uid) === norm(usuarioAtual?.id) ||
        thread.shared_with_users?.includes(usuarioAtual?.id) ||
        thread.atendentes_historico?.includes(usuarioAtual?.id);

      if (isMinhaThread) {
        if (!mapa['__minhas__'].threads.find(t => t.id === thread.id)) {
          mapa['__minhas__'].threads.push(thread);
        }
        if (!isAdmin && !isGerente) return;
        if (norm(uid) === norm(usuarioAtual?.id) || !uid) return;
      }

      if (!uid) {
        if (!mapa['__sem_atendente__']) {
          mapa['__sem_atendente__'] = { id: '__sem_atendente__', nome: 'Não Atribuídas', isSemAtendente: true, threads: [] };
        }
        if (!mapa['__sem_atendente__'].threads.find(t => t.id === thread.id)) {
          mapa['__sem_atendente__'].threads.push(thread);
        }
        return;
      }

      if (!isAdmin && !isGerente) return;

      if (norm(uid) !== norm(usuarioAtual?.id)) {
        if (!mapa[uid]) {
          const atendente = atendentes.find(a => a.id === uid);
          const nome = atendente?.full_name || atendente?.display_name || uid.substring(0, 8);
          mapa[uid] = { id: uid, nome, threads: [], atendente };
        }
        if (!mapa[uid].threads.find(t => t.id === thread.id)) {
          mapa[uid].threads.push(thread);
        }
      }
    });

    Object.values(mapa).forEach(col => {
      col.threads.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
    });

    if (!mapa['__sem_atendente__']) {
      mapa['__sem_atendente__'] = { id: '__sem_atendente__', nome: 'Não Atribuídas', isSemAtendente: true, threads: [] };
    }

    return Object.values(mapa).sort((a, b) => {
      if (a.isMinhas) return -1;
      if (b.isMinhas) return 1;
      if (a.isSemAtendente) return -1;
      if (b.isSemAtendente) return 1;
      const idxA = atendentes.findIndex(at => at.id === a.id);
      const idxB = atendentes.findIndex(at => at.id === b.id);
      return (idxA === -1 ? 9999 : idxA) - (idxB === -1 ? 9999 : idxB);
    }).filter(c => c.isMinhas || c.isSemAtendente || c.threads.length > 0);
  }, [threadsFiltradas, usuarioAtual, atendentes, isAdmin, isGerente]);

  const corConfig = {
    blue: 'bg-blue-600', green: 'bg-green-600', purple: 'bg-purple-600',
    orange: 'bg-orange-600', pink: 'bg-pink-600', teal: 'bg-teal-600',
    indigo: 'bg-indigo-600', rose: 'bg-rose-600', slate: 'bg-slate-500'
  };

  const statusDot = {
    'conectado': 'bg-green-400',
    'desconectado': 'bg-red-400',
    'reconectando': 'bg-yellow-400',
    'pendente_qrcode': 'bg-yellow-400',
  };

  return (
    <div className="flex flex-col h-full min-h-0" style={{ userSelect: isDraggingActive ? 'none' : undefined }}>
      {/* Ghost que segue o mouse */}
      {isDraggingActive && draggingThread && (
        <DragGhost thread={draggingThread} position={mousePos} />
      )}

      {/* Toolbar */}
      <div className="flex-shrink-0 bg-purple-50/80 backdrop-blur-sm border-b border-purple-200 px-2 py-1.5 space-y-1.5">
        {/* Cabeçalho Equipe Interna */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm bg-gradient-to-br from-purple-500 to-indigo-600">
            <MessagesSquare className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 text-xs truncate">Equipe interna</h3>
            <p className="text-[10px] text-slate-600 truncate">Envio 1:1 / Setores / Grupos</p>
          </div>
        </div>

        {/* Botões de ação */}
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

        <div className="h-px bg-purple-300/30" />

        {/* Não Atribuídos + Parados */}
        <div className="grid grid-cols-2 gap-1">
          {onOpenKanbanNaoAtribuidos && (() => {
            const naoAtribuidos = threads?.filter(t => !t.assigned_user_id && t.contact_id && !t.is_contact_only).length || 0;
            return (
              <Button onClick={onOpenKanbanNaoAtribuidos}
                className="w-full bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white border-0 h-9 text-[10px] px-2 flex items-center justify-between font-semibold shadow-md">
                <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">Não Atribuídos</span></span>
                {naoAtribuidos > 0 && <Badge className="bg-white text-red-600 text-[9px] font-bold px-1 h-5 min-w-5 flex items-center justify-center rounded-full ml-1 flex-shrink-0">{naoAtribuidos}</Badge>}
              </Button>
            );
          })()}
          {onOpenKanbanRequerAtencao && (() => {
            const threadsComProblema = threads?.filter(t => {
              const c = t.contato;
              return c && (c.days_inactive_inbound >= 2 || c.deal_risk > 0 || c.prioridadeLabel === 'CRITICO' || c.prioridadeLabel === 'ALTO');
            }).length || 0;
            return (
              <Button onClick={onOpenKanbanRequerAtencao}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-0 h-9 text-[10px] px-2 flex items-center justify-between font-semibold shadow-md">
                <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">Parados</span></span>
                {threadsComProblema > 0 && <Badge className="bg-white text-amber-700 text-[9px] font-bold px-1 h-5 min-w-5 flex items-center justify-center rounded-full ml-1 flex-shrink-0">{threadsComProblema}</Badge>}
              </Button>
            );
          })()}
        </div>

        <div className="h-px bg-purple-300/30" />

        {/* Toggle Canal/Atendente */}
        <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5 shadow-sm w-full justify-center">
          <button onClick={() => setKanbanMode('integracao')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${kanbanMode === 'integracao' ? 'bg-orange-500 text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}>
            <Columns className="w-3 h-3" />Canal
          </button>
          <button onClick={() => setKanbanMode('usuario')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${kanbanMode === 'usuario' ? 'bg-orange-500 text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}>
            <Users className="w-3 h-3" />Atendente
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-1 overflow-x-auto p-2 bg-slate-100 min-h-0">
        {/* Coluna fixa: "Minhas Conversas" */}
        <div
          ref={el => colunaRefs.current['__minhas__'] = el}
          className={`flex flex-col flex-shrink-0 w-52 min-w-[200px] rounded-xl border-2 overflow-hidden shadow-md sticky left-0 z-20 transition-all
            ${hoveredColuna === '__minhas__' && isDraggingActive ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-400 scale-[1.02]' : 'border-orange-400 bg-slate-50'}`}
        >
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <UserCheck className="w-3.5 h-3.5 text-white flex-shrink-0" />
              <span className="text-white font-semibold text-xs truncate">Minhas Conversas</span>
            </div>
            <span className="text-white/80 text-[9px] flex-shrink-0">{minhasConversas.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5 min-h-[60px]">
            {minhasConversas.length === 0 ? (
              <div className={`text-center py-8 text-xs ${hoveredColuna === '__minhas__' && isDraggingActive ? 'text-orange-400 font-semibold' : 'text-slate-400'}`}>
                {hoveredColuna === '__minhas__' && isDraggingActive ? 'Solte aqui ↓' : 'Nenhuma conversa atribuída'}
              </div>
            ) : (
              minhasConversas.map(thread => (
                <ThreadCardKanban
                  key={thread.id}
                  thread={thread}
                  isAtiva={threadAtiva?.id === thread.id}
                  usuarioAtual={usuarioAtual}
                  atendentes={atendentes}
                  onSelecionarThread={onSelecionarThread}
                  podeInteragir={true}
                  isDragging={draggingThread?.id === thread.id && isDraggingActive}
                />
              ))
            )}
            {hoveredColuna === '__minhas__' && isDraggingActive && minhasConversas.length > 0 && (
              <div className="text-center py-2 text-orange-400 text-xs font-semibold border-t border-orange-200">Solte aqui ↓</div>
            )}
          </div>
        </div>

        {kanbanMode === 'usuario' ? (
          colunasPorUsuario.filter(c => !c.isMinhas).map(coluna => {
            const isSem = coluna.isSemAtendente;
            const headerClass = isSem ? 'bg-slate-600' : 'bg-gradient-to-r from-indigo-500 to-blue-600';
            const isHovered = hoveredColuna === coluna.id && isDraggingActive;

            return (
              <div
                key={coluna.id}
                ref={el => colunaRefs.current[coluna.id] = el}
                className={`flex flex-col flex-shrink-0 w-52 min-w-[200px] rounded-xl overflow-hidden shadow-sm transition-all
                  ${isSem ? 'border-2 border-slate-400 sticky left-[216px] z-10' : 'border border-slate-200'}
                  ${isHovered ? 'ring-2 ring-orange-400 bg-orange-50 scale-[1.02]' : 'bg-slate-50'}`}
              >
                <div className={`${headerClass} px-3 py-2 flex items-center justify-between`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                      {coluna.nome.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-white font-semibold text-xs truncate">{coluna.nome}</span>
                  </div>
                  <span className="text-white/80 text-[9px] flex-shrink-0">{coluna.threads.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5 min-h-[60px]">
                  {coluna.threads.length === 0 ? (
                    <div className={`text-center py-8 text-xs ${isHovered ? 'text-orange-400 font-semibold' : 'text-slate-400'}`}>
                      {isHovered ? 'Solte aqui ↓' : 'Sem conversas'}
                    </div>
                  ) : (
                    coluna.threads.map(thread => (
                      <ThreadCardKanban
                        key={thread.id}
                        thread={thread}
                        isAtiva={threadAtiva?.id === thread.id}
                        usuarioAtual={usuarioAtual}
                        atendentes={atendentes}
                        onSelecionarThread={onSelecionarThread}
                        podeInteragir={true}
                        isDragging={draggingThread?.id === thread.id && isDraggingActive}
                        onMouseDown={podeReatribuir ? handleMouseDown : undefined}
                      />
                    ))
                  )}
                  {isHovered && coluna.threads.length > 0 && (
                    <div className="text-center py-2 text-orange-400 text-xs font-semibold border-t border-orange-200">Solte aqui ↓</div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          colunas.map(coluna => {
            const totalNaoLidas = coluna.threads.reduce((sum, t) => sum + getUnreadCount(t, usuarioAtual?.id), 0);
            const headerCor = corConfig[coluna.cor] || 'bg-slate-600';
            const dotCor = statusDot[coluna.status] || 'bg-slate-400';

            return (
              <div key={coluna.id} className="flex flex-col flex-shrink-0 w-52 min-w-[200px] bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className={`${headerCor} px-3 py-2 flex items-center justify-between`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotCor}`} />
                    <span className="text-white font-semibold text-xs truncate">{coluna.nome}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {totalNaoLidas > 0 && (
                      <Badge className="rounded-full min-w-[18px] h-4 flex items-center justify-center p-0 px-1 bg-white/30 text-white text-[9px] font-bold border-0">
                        {totalNaoLidas}
                      </Badge>
                    )}
                    <span className="text-white/70 text-[9px]">{coluna.threads.length}</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
                  {coluna.threads.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">Sem conversas</div>
                  ) : (
                    coluna.threads.map(thread => {
                      const norm = (v) => String(v || '').toLowerCase().trim();
                      const isAtribuidoOuTransferido =
                        norm(thread.assigned_user_id) === norm(usuarioAtual?.id) ||
                        norm(thread.transfer_requested_user_id) === norm(usuarioAtual?.id);
                      const isGerenteLocal = ['gerente', 'coordenador', 'supervisor'].includes(usuarioAtual?.attendant_role);
                      const isNaoAtribuida = !thread.assigned_user_id && !thread.assigned_user_name && !thread.assigned_user_email;
                      const isCompartilhada = thread.shared_with_users?.includes(usuarioAtual?.id);
                      const isInterno = thread.participants?.includes(usuarioAtual?.id);
                      const podeInteragir = usuarioAtual?.role === 'admin' || isAtribuidoOuTransferido || isGerenteLocal || isNaoAtribuida || isCompartilhada || isInterno;
                      return (
                        <ThreadCardKanban
                          key={thread.id}
                          thread={thread}
                          isAtiva={threadAtiva?.id === thread.id}
                          usuarioAtual={usuarioAtual}
                          atendentes={atendentes}
                          onSelecionarThread={onSelecionarThread}
                          podeInteragir={podeInteragir}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            );
          })
        )}
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
      <CriarGrupoModal
        open={criarGrupoOpen}
        onClose={() => setCriarGrupoOpen(false)}
        usuarios={atendentes}
        currentUser={usuarioAtual}
        onSuccess={() => { setCriarGrupoOpen(false); toast.success('✅ Grupo criado!'); }}
      />
      <AgendaIAUnificada
        open={agendaIAOpen}
        onClose={() => setAgendaIAOpen(false)}
        usuario={usuarioAtual}
      />
    </div>
  );
}