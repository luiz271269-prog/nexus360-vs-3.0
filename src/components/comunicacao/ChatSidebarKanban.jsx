import React from "react";
import { format } from "date-fns";
import { CheckCheck, Check, Clock, AlertCircle, Image, Video, Mic, FileText, MapPin, Phone as PhoneIcon, UserCheck, Badge as BadgeIcon, Columns, Users, Send, ArrowRightLeft, Plus, CalendarCheck, AlertTriangle, MessagesSquare } from "lucide-react";
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

// ── Layout de LISTA completo (igual ChatSidebar) — usado na coluna "Minhas Conversas" ──
function ThreadRowMinhas({ thread, isAtiva, usuarioAtual, atendentes, integracoes, onSelecionarThread }) {
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

  // Número da integração (#últimos4)
  const integracao = integracoes?.find(i => i.id === thread.whatsapp_integration_id);
  const ultimos4 = integracao?.numero_telefone?.slice(-4);

  const getAtendenteFidelizado = (c) => getAtendenteFidelizadoAtualizado(c, atendentes);

  return (
    <div
      onClick={() => onSelecionarThread(thread)}
      className={`px-2 py-2 flex items-center gap-3 cursor-pointer transition-all hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 ${isAtiva ? 'bg-blue-50 border-l-4 border-l-orange-500' : ''}`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-base shadow-md overflow-hidden ${hasUnread ? 'bg-gradient-to-br from-amber-400 via-orange-500 to-red-500' : 'bg-gradient-to-br from-slate-400 to-slate-500'}`}>
          {contato?.foto_perfil_url && contato.foto_perfil_url !== 'null' && contato.foto_perfil_url !== 'undefined' ? (
            <img src={contato.foto_perfil_url} alt={nomeExibicao} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
          ) : (
            nomeExibicao.charAt(0).toUpperCase()
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {/* Linha 1: Nome + #canal + badge não lidas + horário */}
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <h3 className={`font-semibold truncate text-sm ${hasUnread ? 'text-slate-900' : 'text-slate-700'}`}>
              {nomeExibicao}
            </h3>
            {hasUnread && (
              <Badge className="rounded-full min-w-[18px] h-4 flex items-center justify-center p-0 px-1 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white text-[10px] font-bold border-0 shadow-lg flex-shrink-0">
                {getUnreadCount(thread, usuarioAtual?.id)}
              </Badge>
            )}
            {ultimos4 && (
              <span className="text-[9px] text-slate-400 flex-shrink-0">#{ultimos4}</span>
            )}
          </div>
          <span className={`text-[10px] flex-shrink-0 ml-2 ${hasUnread ? 'text-orange-600 font-medium' : 'text-slate-400'}`}>
            {formatarHorario(thread.last_message_at)}
          </span>
        </div>

        {/* Linha 2: Preview mensagem */}
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
          <span className="truncate">{thread.last_message_content || 'Sem mensagens'}</span>
          {thread.last_message_sender_name && (
            <span className="text-[9px] text-slate-400 italic flex-shrink-0">~ {thread.last_message_sender_name.split(' ')[0]}</span>
          )}
        </p>

        {/* Linha 3: Tipo + Tags + Atendente */}
        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white ${tipoCfg.bg} shadow-sm`}>
            {tipoCfg.emoji} {tipoCfg.label}
          </span>

          {/* Tags destaque */}
          {contato?.tags?.length > 0 && (() => {
            const destaques = etiquetasDB.filter(e => e.destaque === true);
            const nomes = destaques.map(e => e.nome);
            const tags = contato.tags
              .filter(t => nomes.includes(t))
              .sort((a, b) => (destaques.find(e => e.nome === a)?.ordem || 100) - (destaques.find(e => e.nome === b)?.ordem || 100))
              .slice(0, 1);
            return tags.map(etq => {
              const cfg = getEtiquetaConfigDinamico(etq);
              return (
                <span key={etq} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white ${cfg.cor || 'bg-slate-500'} shadow-sm`}>
                  {cfg.emoji || '🏷️'} {cfg.label?.substring(0, 6) || etq}
                </span>
              );
            });
          })()}

          {/* Atendente */}
          {thread.assigned_user_id ? (() => {
            const nome = getUserDisplayName(thread.assigned_user_id, atendentes);
            const vazio = nome === 'Carregando...' || nome === 'Usuário não encontrado';
            return vazio ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-slate-500 bg-slate-100 shadow-sm">
                <UserCheck className="w-3 h-3" />Restrito
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white bg-indigo-500 shadow-sm">
                <UserCheck className="w-3 h-3" />{nome.split(' ')[0]}
              </span>
            );
          })() : getAtendenteFidelizado(contato)?.id ? (() => {
            const af = getAtendenteFidelizado(contato);
            const nome = getUserDisplayName(af.id, atendentes);
            const vazio = nome === 'Carregando...' || nome === 'Usuário não encontrado';
            return vazio ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-slate-500 bg-slate-100 shadow-sm">VIP Restrito</span>
            ) : (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-amber-700 bg-amber-100 shadow-sm">
                VIP {nome.split(' ')[0]}
              </span>
            );
          })() : thread.is_contact_only ? (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-slate-500 bg-slate-100 shadow-sm">S/atend.</span>
          ) : (
            <AtribuidorAtendenteRapido
              contato={contato}
              thread={thread}
              tipoContato={contato?.tipo_contato || 'novo'}
              setorAtual={thread?.sector_id || 'geral'}
              variant="mini"
            />
          )}
        </div>
      </div>
    </div>
  );
}

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

  // Integração info (últimos 4 dígitos do número)
  const integracao = thread.whatsapp_integration_id
    ? atendentes.__integracoes?.find?.(i => i.id === thread.whatsapp_integration_id)
    : null;

  return (
    <div
      onClick={() => podeInteragir && onSelecionarThread(thread)}
      className={`rounded-lg border shadow-sm transition-all ${podeInteragir ? 'cursor-pointer hover:shadow-md hover:border-orange-300' : 'cursor-not-allowed opacity-50'} ${isAtiva ? 'border-orange-500 bg-orange-50 shadow-md shadow-orange-200 scale-[1.03] z-10 relative ring-2 ring-orange-400 ring-offset-1' : 'bg-white border-slate-200'}`}
      title={!podeInteragir ? 'Sem permissão para acessar esta conversa' : ''}
    >
      {/* Mesma estrutura do ChatSidebar: px-2 py-2 flex items-center gap-3 */}
      <div className="px-2 py-2 flex items-center gap-2">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md overflow-hidden ${hasUnread ? 'bg-gradient-to-br from-amber-400 via-orange-500 to-red-500' : 'bg-gradient-to-br from-slate-400 to-slate-500'}`}>
            {contato?.foto_perfil_url && contato.foto_perfil_url !== 'null' && contato.foto_perfil_url !== 'undefined' ? (
              <img src={contato.foto_perfil_url} alt={nomeExibicao} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              nomeExibicao.charAt(0).toUpperCase()
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {/* Linha 1: Nome + # canal + Horário + Badge não lidas */}
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <p className={`text-xs font-semibold truncate ${hasUnread ? 'text-slate-900' : 'text-slate-700'}`}>
                {nomeExibicao}
              </p>
              {hasUnread && (
                <Badge className="rounded-full min-w-[16px] h-3.5 flex items-center justify-center p-0 px-1 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white text-[9px] font-bold border-0 shadow-lg flex-shrink-0">
                  {getUnreadCount(thread, usuarioAtual?.id)}
                </Badge>
              )}
            </div>
            <span className={`text-[9px] flex-shrink-0 ml-1 ${hasUnread ? 'text-orange-600 font-medium' : 'text-slate-400'}`}>
              {formatarHorario(thread.last_message_at)}
            </span>
          </div>

          {/* Linha 2: Preview mensagem */}
          <p className={`text-[10px] truncate flex items-center gap-0.5 ${hasUnread ? 'text-slate-800' : 'text-slate-500'}`}>
            {thread.last_message_sender === 'user' && (() => {
              const status = thread.last_message_status;
              if (status === 'lida') return <CheckCheck className="w-2.5 h-2.5 text-blue-500 flex-shrink-0" />;
              if (status === 'entregue') return <CheckCheck className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />;
              if (status === 'enviada') return <Check className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />;
              if (status === 'falhou') return <AlertCircle className="w-2.5 h-2.5 text-red-500 flex-shrink-0" />;
              return <CheckCheck className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />;
            })()}
            {thread.last_media_type === 'image' && <Image className="w-2.5 h-2.5 text-blue-500 flex-shrink-0" />}
            {thread.last_media_type === 'video' && <Video className="w-2.5 h-2.5 text-purple-500 flex-shrink-0" />}
            {thread.last_media_type === 'audio' && <Mic className="w-2.5 h-2.5 text-green-500 flex-shrink-0" />}
            {thread.last_media_type === 'document' && <FileText className="w-2.5 h-2.5 text-orange-500 flex-shrink-0" />}
            <span className="truncate">{thread.last_message_content || 'Sem mensagens'}</span>
            {thread.last_message_sender_name && (
              <span className="text-[9px] text-slate-400 italic flex-shrink-0">~ {thread.last_message_sender_name.split(' ')[0]}</span>
            )}
          </p>

          {/* Linha 3: Tipo + Tags + Atendente */}
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {/* Tipo */}
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-white ${tipoCfg.bg} shadow-sm`}>
              {tipoCfg.emoji} {tipoCfg.label}
            </span>

            {/* Tags de destaque (1 máx) */}
            {contato?.tags && contato.tags.length > 0 && (() => {
              const etiquetasDestaqueDB = etiquetasDB.filter(e => e.destaque === true);
              const nomesDestaque = etiquetasDestaqueDB.map(e => e.nome);
              const tagsOrdenadas = contato.tags
                .filter(t => nomesDestaque.includes(t))
                .sort((a, b) => {
                  const ordemA = etiquetasDestaqueDB.find(e => e.nome === a)?.ordem || 100;
                  const ordemB = etiquetasDestaqueDB.find(e => e.nome === b)?.ordem || 100;
                  return ordemA - ordemB;
                })
                .slice(0, 1);
              return tagsOrdenadas.map(etq => {
                const cfg = getEtiquetaConfigDinamico(etq);
                return (
                  <span key={etq} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-white ${cfg.cor || 'bg-slate-500'} shadow-sm`}>
                    {cfg.emoji || '🏷️'} {cfg.label?.substring(0, 6) || etq}
                  </span>
                );
              });
            })()}

            {/* Atendente */}
            {thread.assigned_user_id ? (() => {
              const nomeAtendente = getUserDisplayName(thread.assigned_user_id, atendentes);
              const isCarregando = nomeAtendente === 'Carregando...' || nomeAtendente === 'Usuário não encontrado';
              if (isCarregando) return (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-slate-500 bg-slate-100 shadow-sm">
                  <UserCheck className="w-2.5 h-2.5" />Restrito
                </span>
              );
              return (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-white bg-indigo-500 shadow-sm">
                  <UserCheck className="w-2.5 h-2.5" />{nomeAtendente.split(' ')[0]}
                </span>
              );
            })() : getAtendenteFidelizado(contato)?.id ? (() => {
              const af = getAtendenteFidelizado(contato);
              const nomeFidelizado = getUserDisplayName(af.id, atendentes);
              const isCarregando = nomeFidelizado === 'Carregando...' || nomeFidelizado === 'Usuário não encontrado';
              if (isCarregando) return (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-slate-500 bg-slate-100 shadow-sm">VIP Restrito</span>
              );
              return (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-amber-700 bg-amber-100 shadow-sm">
                  VIP {nomeFidelizado.split(' ')[0]}
                </span>
              );
            })() : thread.is_contact_only ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-slate-500 bg-slate-100 shadow-sm">S/atend.</span>
            ) : (
              <AtribuidorAtendenteRapido
                contato={contato}
                thread={thread}
                tipoContato={contato?.tipo_contato || 'novo'}
                setorAtual={thread?.sector_id || 'geral'}
                variant="mini"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatSidebarKanban({ threads, threadAtiva, onSelecionarThread, onVoltar, usuarioAtual, integracoes = [], atendentes = [], onOpenKanbanNaoAtribuidos, onOpenKanbanRequerAtencao, onSelectInternalDestinations }) {
  const [kanbanMode, setKanbanMode] = React.useState('usuario'); // 'integracao' | 'usuario'
  const [internalComposerOpen, setInternalComposerOpen] = React.useState(false);
  const [delegateMode, setDelegateMode] = React.useState(false);
  const [criarGrupoOpen, setCriarGrupoOpen] = React.useState(false);
  const [agendaIAOpen, setAgendaIAOpen] = React.useState(false);
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

  // Integrações visíveis para o usuário atual
  const integracoesVisiveis = React.useMemo(() => {
    if (!usuarioAtual || integracoes.length === 0) return integracoes;
    if (usuarioAtual.role === 'admin') return integracoes;

    // Se o usuário tem lista restrita de integrações visíveis, filtrar
    const integracoesPermitidas = usuarioAtual.integracoes_visiveis || usuarioAtual.whatsapp_permissions?.integracoes_visiveis;
    if (integracoesPermitidas && integracoesPermitidas.length > 0) {
      return integracoes.filter(i => integracoesPermitidas.includes(i.id));
    }

    // Gerente/Coordenador vê todas
    if (['gerente', 'coordenador', 'supervisor'].includes(usuarioAtual.attendant_role)) return integracoes;

    // Atendente normal: mostrar apenas integrações onde tem conversas atribuídas a ele
    const idsComMinhas = new Set(
      threadsFiltradas
        .filter(t => t.assigned_user_id === usuarioAtual.id || t.shared_with_users?.includes(usuarioAtual.id) || t.atendentes_historico?.includes(usuarioAtual.id))
        .map(t => t.whatsapp_integration_id)
        .filter(Boolean)
    );
    return integracoes.filter(i => idsComMinhas.has(i.id));
  }, [integracoes, usuarioAtual, threadsFiltradas]);

  // Agrupar threads externas por integração
  const colunas = React.useMemo(() => {
    const externas = threadsFiltradas.filter(t =>
      t.thread_type === 'contact_external' || (!t.thread_type && t.contact_id)
    );

    if (integracoesVisiveis.length === 0) {
      // Sem integrações visíveis: mostrar apenas as threads do próprio usuário
      const minhas = externas.filter(t =>
        t.assigned_user_id === usuarioAtual?.id ||
        !t.assigned_user_id
      );
      return [{ id: 'sem_integracao', nome: 'Conversas', numero: '', threads: minhas, status: 'desconectado' }];
    }

    const mapa = {};
    const idsVisiveis = new Set(integracoesVisiveis.map(i => i.id));

    // Criar coluna para cada integração visível
    integracoesVisiveis.forEach(int => {
      mapa[int.id] = {
        id: int.id,
        nome: int.nome_instancia,
        numero: int.numero_telefone || '',
        status: int.status,
        cor: int.cor_chat || 'blue',
        threads: []
      };
    });

    // Distribuir threads nas colunas apenas para integrações visíveis
    externas.forEach(thread => {
      const integId = thread.whatsapp_integration_id;
      if (integId && mapa[integId]) {
        mapa[integId].threads.push(thread);
      } else if (!integId || !idsVisiveis.has(integId)) {
        // Thread sem integração ou de integração não visível: só admin vê na coluna "Outras"
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

  const isAdmin = usuarioAtual?.role === 'admin';
  const isGerente = ['gerente', 'coordenador', 'supervisor'].includes(usuarioAtual?.attendant_role);
  // Kanban por usuário: agrupar threads por atendente atribuído
  // Não-admin/não-gerente vê apenas "Minhas" + "Não Atribuídas"
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

      // Verificar se é "minha": atribuída, histórico ou shared
      const isMinhaThread =
        norm(uid) === norm(usuarioAtual?.id) ||
        thread.shared_with_users?.includes(usuarioAtual?.id) ||
        thread.atendentes_historico?.includes(usuarioAtual?.id);

      if (isMinhaThread) {
        if (!mapa['__minhas__'].threads.find(t => t.id === thread.id)) {
          mapa['__minhas__'].threads.push(thread);
        }
        // Se ainda assim está atribuída a outro E é gerente/admin, também cria coluna do outro
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

      // Colunas de outros atendentes: apenas para admin/gerente
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

    // Garantir que "Não Atribuídas" sempre existe (mesmo sem threads)
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
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar: Equipe Interna + Botões de Ação + toggle Canal/Atendente */}
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

        {/* Não Atribuídos */}
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

        <div className="h-px bg-purple-300/30" />

        {/* Toggle Canal/Atendente/Urgentes */}
        <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5 shadow-sm w-full">
          <button onClick={() => setKanbanMode('integracao')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all flex-1 justify-center ${kanbanMode === 'integracao' ? 'bg-orange-500 text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}>
            <Columns className="w-3 h-3" />Canal
          </button>
          <button onClick={() => setKanbanMode('usuario')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all flex-1 justify-center ${kanbanMode === 'usuario' ? 'bg-orange-500 text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}>
            <Users className="w-3 h-3" />Atendente
          </button>
          {onOpenKanbanRequerAtencao && (
            <button onClick={onOpenKanbanRequerAtencao}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all flex-1 justify-center text-amber-700 hover:bg-amber-100">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />Urgentes
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-1 overflow-x-auto p-2 bg-slate-100 min-h-0">
        {/* Coluna fixa: "Minhas Conversas" - layout lista igual ChatSidebar */}
        <div className="flex flex-col flex-shrink-0 w-72 min-w-[280px] bg-white rounded-xl border-2 border-orange-400 overflow-hidden shadow-md sticky left-0 z-20">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <UserCheck className="w-3.5 h-3.5 text-white flex-shrink-0" />
              <span className="text-white font-semibold text-xs truncate">Minhas Conversas</span>
            </div>
            <span className="text-white/80 text-[9px] flex-shrink-0">{minhasConversas.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {minhasConversas.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">Nenhuma conversa atribuída</div>
            ) : (
              minhasConversas.map(thread => (
                <ThreadRowMinhas
                  key={thread.id}
                  thread={thread}
                  isAtiva={threadAtiva?.id === thread.id}
                  usuarioAtual={usuarioAtual}
                  atendentes={atendentes}
                  integracoes={integracoes}
                  onSelecionarThread={onSelecionarThread}
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