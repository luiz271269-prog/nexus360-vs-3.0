import React from "react";
import { format } from "date-fns";
import { CheckCheck, Image, Video, Mic, FileText, MapPin, Phone as PhoneIcon, UserCheck, Badge as BadgeIcon, Columns, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getUserDisplayName } from "../lib/userHelpers";

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

function ThreadCardKanban({ thread, isAtiva, usuarioAtual, atendentes, onSelecionarThread, podeInteragir }) {
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
      onClick={() => podeInteragir && onSelecionarThread(thread)}
      className={`bg-white rounded-lg border shadow-sm p-2.5 transition-all ${podeInteragir ? 'cursor-pointer hover:shadow-md hover:border-orange-300' : 'cursor-not-allowed opacity-50'} ${isAtiva ? 'border-orange-400 bg-orange-50' : 'border-slate-200'}`}
      title={!podeInteragir ? 'Sem permissão para acessar esta conversa' : ''}
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

export default function ChatSidebarKanban({ threads, threadAtiva, onSelecionarThread, onVoltar, usuarioAtual, integracoes = [], atendentes = [] }) {
  const [kanbanMode, setKanbanMode] = React.useState('usuario'); // 'integracao' | 'usuario'
  // ✅ APLICAR MESMA LÓGICA DE VISIBILIDADE DO CHATWINDOW
  const threadsFiltradas = React.useMemo(() => {
    if (!usuarioAtual || threads.length === 0) return [];

    // Admin vê tudo
    if (usuarioAtual.role === 'admin') return threads;

    // Filtrar threads visíveis para o usuário
    return threads.filter(thread => {
      if (!thread) return false;

      // Normalizar função
      const norm = (v) => String(v || '').toLowerCase().trim();

      // P1: Atribuído ao usuário → sempre visível
      if (
        norm(thread.assigned_user_id) === norm(usuarioAtual.id) ||
        norm(thread.assigned_user_email) === norm(usuarioAtual.email) ||
        norm(thread.assigned_user_name) === norm(usuarioAtual.full_name) ||
        norm(thread.transfer_requested_user_id) === norm(usuarioAtual.id)
      ) {
        return true;
      }

      // P2: Gerente/Coordenador → vê tudo
      if (['gerente', 'coordenador', 'supervisor'].includes(usuarioAtual.attendant_role)) {
        return true;
      }

      // P3: Thread não atribuída → qualquer usuário vê
      if (!thread.assigned_user_id && !thread.assigned_user_name && !thread.assigned_user_email) {
        return true;
      }

      // P4: Compartilhada com o usuário
      if (thread.shared_with_users?.includes(usuarioAtual.id)) {
        return true;
      }

      // P5: Threads internas (team_internal) onde é participante
      if (
        (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') &&
        thread.participants?.includes(usuarioAtual.id)
      ) {
        return true;
      }

      // Bloqueado: atribuída a outro usuário
      return false;
    });
  }, [threads, usuarioAtual]);

  // Coluna fixa: "Minhas Conversas"
  // Inclui: atribuídas ao usuário + shared_with_users + atendentes_historico
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

  // Agrupar threads externas por integração
  const colunas = React.useMemo(() => {
    const externas = threadsFiltradas.filter(t =>
      t.thread_type === 'contact_external' || (!t.thread_type && t.contact_id)
    );

    if (integracoes.length === 0) {
      return [{ id: 'sem_integracao', nome: 'Conversas', numero: '', threads: externas, status: 'desconectado' }];
    }

    const mapa = {};

    // Criar coluna para cada integração
    integracoes.forEach(int => {
      mapa[int.id] = {
        id: int.id,
        nome: int.nome_instancia,
        numero: int.numero_telefone || '',
        status: int.status,
        cor: int.cor_chat || 'blue',
        threads: []
      };
    });

    // Distribuir threads nas colunas
    externas.forEach(thread => {
      const integId = thread.whatsapp_integration_id;
      if (integId && mapa[integId]) {
        mapa[integId].threads.push(thread);
      } else {
        if (!mapa['outras']) {
          mapa['outras'] = { id: 'outras', nome: 'Outras', numero: '', status: 'desconectado', cor: 'slate', threads: [] };
        }
        mapa['outras'].threads.push(thread);
      }
    });

    Object.values(mapa).forEach(col => {
      col.threads.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
    });

    const isAdmin = usuarioAtual?.role === 'admin';
    return Object.values(mapa).filter(c => {
      if (c.id === 'outras' && !isAdmin) return false;
      return c.threads.length > 0 || integracoes.find(i => i.id === c.id);
    });
  }, [threads, integracoes]);

  // Kanban por usuário: agrupar threads por atendente atribuído
  const colunasPorUsuario = React.useMemo(() => {
    const externas = threadsFiltradas.filter(t =>
      t.thread_type === 'contact_external' || (!t.thread_type && t.contact_id)
    );

    const norm = (v) => String(v || '').toLowerCase().trim();
    const mapa = {};

    // Coluna "Minhas" sempre primeiro
    mapa['__minhas__'] = { id: '__minhas__', nome: 'Minhas Conversas', isMinhas: true, threads: [] };

    externas.forEach(thread => {
      const uid = thread.assigned_user_id;
      if (!uid) {
        if (!mapa['__sem_atendente__']) {
          mapa['__sem_atendente__'] = { id: '__sem_atendente__', nome: 'Não Atribuídas', isSemAtendente: true, threads: [] };
        }
        mapa['__sem_atendente__'].threads.push(thread);
        return;
      }

      if (norm(uid) === norm(usuarioAtual?.id)) {
        mapa['__minhas__'].threads.push(thread);
        return;
      }

      // Também inclui histórico (shared/atendentes_historico) sem duplicar
      const jaEmMinhas =
        thread.shared_with_users?.includes(usuarioAtual?.id) ||
        thread.atendentes_historico?.includes(usuarioAtual?.id);
      if (jaEmMinhas && !mapa['__minhas__'].threads.find(t => t.id === thread.id)) {
        mapa['__minhas__'].threads.push(thread);
        return;
      }

      if (!mapa[uid]) {
        const atendente = atendentes.find(a => a.id === uid);
        const nome = atendente?.full_name || atendente?.display_name || uid.substring(0, 8);
        mapa[uid] = { id: uid, nome, threads: [], atendente };
      }
      mapa[uid].threads.push(thread);
    });

    Object.values(mapa).forEach(col => {
      col.threads.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
    });

    // Garantir que "Não Atribuídas" sempre existe (mesmo sem threads)
    if (!mapa['__sem_atendente__']) {
      mapa['__sem_atendente__'] = { id: '__sem_atendente__', nome: 'Não Atribuídas', isSemAtendente: true, threads: [] };
    }

    // Ordenar: minhas primeiro (fixa), não atribuídas segundo (fixa), depois pela ordem do array atendentes (cadastro)
    return Object.values(mapa).sort((a, b) => {
      if (a.isMinhas) return -1;
      if (b.isMinhas) return 1;
      if (a.isSemAtendente) return -1;
      if (b.isSemAtendente) return 1;
      // Preservar ordem do cadastro de atendentes
      const idxA = atendentes.findIndex(at => at.id === a.id);
      const idxB = atendentes.findIndex(at => at.id === b.id);
      const posA = idxA === -1 ? 9999 : idxA;
      const posB = idxB === -1 ? 9999 : idxB;
      return posA - posB;
    }).filter(c => c.isMinhas || c.isSemAtendente || c.threads.length > 0);
  }, [threadsFiltradas, usuarioAtual, atendentes]);

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
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar: toggle modo Canal/Atendente */}
      <div className="flex-shrink-0 px-2 py-1.5 bg-slate-100 border-b border-slate-200 flex items-center justify-start gap-2">
        <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5 shadow-sm">
          <button
            onClick={() => setKanbanMode('integracao')}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-[10px] font-semibold transition-all ${kanbanMode === 'integracao' ? 'bg-orange-500 text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}
            title="Por canal/integração"
          >
            <Columns className="w-3 h-3" />
            Canal
          </button>
          <button
            onClick={() => setKanbanMode('usuario')}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-[10px] font-semibold transition-all ${kanbanMode === 'usuario' ? 'bg-orange-500 text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}
            title="Por atendente"
          >
            <Users className="w-3 h-3" />
            Atendente
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-1 overflow-x-auto p-2 bg-slate-100 min-h-0">
        {/* Coluna fixa: "Minhas Conversas" - SEMPRE VISÍVEL */}
        <div className="flex flex-col flex-shrink-0 w-52 min-w-[200px] bg-slate-50 rounded-xl border-2 border-orange-400 overflow-hidden shadow-md sticky left-0 z-20">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <UserCheck className="w-3.5 h-3.5 text-white flex-shrink-0" />
              <span className="text-white font-semibold text-xs truncate">Minhas Conversas</span>
            </div>
            <span className="text-white/80 text-[9px] flex-shrink-0">{minhasConversas.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
            {minhasConversas.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">Nenhuma conversa atribuída</div>
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
                />
              ))
            )}
          </div>
        </div>

        {kanbanMode === 'usuario' ? (
          // ── MODO: POR ATENDENTE ──
          // Minhas e Não Atribuídas são fixas (já renderizadas separado ou aqui)
          colunasPorUsuario.filter(c => !c.isMinhas).map(coluna => {
            const isSem = coluna.isSemAtendente;
            const headerClass = isSem
              ? 'bg-slate-600'
              : 'bg-gradient-to-r from-indigo-500 to-blue-600';

            return (
              <div key={coluna.id} className={`flex flex-col flex-shrink-0 w-52 min-w-[200px] bg-slate-50 rounded-xl overflow-hidden shadow-sm ${isSem ? 'border-2 border-slate-400 sticky left-[216px] z-10' : 'border border-slate-200'}`}>
                <div className={`${headerClass} px-3 py-2 flex items-center justify-between`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                      {coluna.nome.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-white font-semibold text-xs truncate">{coluna.nome}</span>
                  </div>
                  <span className="text-white/80 text-[9px] flex-shrink-0">{coluna.threads.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
                  {coluna.threads.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">Sem conversas</div>
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
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })
        ) : (
          // ── MODO: POR CANAL/INTEGRAÇÃO ──
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
                      const isGerente = ['gerente', 'coordenador', 'supervisor'].includes(usuarioAtual?.attendant_role);
                      const isNaoAtribuida = !thread.assigned_user_id && !thread.assigned_user_name && !thread.assigned_user_email;
                      const isCompartilhada = thread.shared_with_users?.includes(usuarioAtual?.id);
                      const isInterno = thread.participants?.includes(usuarioAtual?.id);
                      const podeInteragir = usuarioAtual?.role === 'admin' || isAtribuidoOuTransferido || isGerente || isNaoAtribuida || isCompartilhada || isInterno;
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

    </div>
  );
}