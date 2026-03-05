import React from "react";
import { 
  CheckCheck, 
  Check,
  Clock, 
  User, 
  Users, 
  AlertCircle, 
  AlertTriangle,
  Image, 
  Video, 
  Mic, 
  FileText, 
  MapPin, 
  Phone as PhoneIcon, 
  Tag, 
  Building2,
  Target, 
  Truck, 
  Handshake, 
  HelpCircle, 
  UserCheck, 
  Send, 
  X, 
  CheckSquare, 
  Square, 
  MessagesSquare, 
  ArrowRightLeft, 
  Plus,
  CalendarCheck
} from "lucide-react";
import InternalMessageComposer from "./InternalMessageComposer";
import ContadorNaoAtribuidas from "./ContadorNaoAtribuidas";
import ContatosRequerendoAtencao from "./ContatosRequerendoAtencao";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { CATEGORIAS_FIXAS, getCategoriaConfig } from "./CategorizadorRapido";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import CentralInteligenciaContato, {
  calcularScoreContato,
  getNivelTemperatura,
  getProximaAcaoSugerida,
  getEtiquetaConfig,
  TIPOS_CONTATO,
  FILAS_ATENDIMENTO } from
"./CentralInteligenciaContato";
import CriarGrupoModal from './CriarGrupoModal';
import { toast } from 'sonner';
import AtribuidorAtendenteRapido from "./AtribuidorAtendenteRapido";
import AgendaIAUnificada from './AgendaIAUnificada';
import {
  SETORES_ATENDIMENTO,
  podeAtenderContato,
  verificarPermissaoUsuario } from
"./MotorRoteamentoAtendimento";
import { useEtiquetasContato } from "./SeletorEtiquetasContato";
import { Button } from "@/components/ui/button";
import { 
  contatoFidelizadoAoUsuario, 
  contatoFidelizadoAOutro, 
  getAtendenteFidelizadoAtualizado 
} from "../lib/userMatcher";
import { getUserDisplayName } from "../lib/userHelpers";
import UsuarioDisplay from "./UsuarioDisplay";
import { canUserSeeThreadBase } from "../lib/threadVisibility";
import { decidirVisibilidade } from "@/components/lib/decisionEngine";
import MensagemReativacaoRapida from './MensagemReativacaoRapida';

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 GETTER UNIFICADO: Badge de não lidas (externo + interno)
// ═══════════════════════════════════════════════════════════════════════════════
const getUnreadCount = (thread, currentUserId) => {
  if (!thread) return 0;
  
  // INTERNO: usar unread_by[userId]
  if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
    return thread.unread_by?.[currentUserId] || 0;
  }
  
  // EXTERNO: usar unread_count
  return thread.unread_count || 0;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 RESOLVER UI: Título/Avatar/Badge para threads (externo + interno)
// ═══════════════════════════════════════════════════════════════════════════════
const resolveThreadUI = (thread, currentUser, atendentes = []) => {
  // ✅ USUÁRIOS INTERNOS
    if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
      // 1:1 interno: buscar o outro usuario participante
    if (thread.thread_type === 'team_internal' && !thread.is_group_chat) {
      const outroUserId = thread.participants?.find(id => id !== currentUser?.id);

      // ✅ FIX: Usuários internos podem não ter outros participants (group chats) ou estar incompletos
      // Mostrar thread mesmo sem encontrar o outro usuario
    if (outroUserId) {
    const outroUser = atendentes.find(a => a.id === outroUserId);
    const nome = outroUser?.full_name || outroUser?.email || 'Usuário';
    const avatar = outroUser?.full_name?.charAt(0)?.toUpperCase() || outroUser?.email?.charAt(0)?.toUpperCase() || 'U';

    // ✅ CORREÇÃO: Usar foto_perfil_url do User quando disponível
    const avatarUrl = outroUser?.foto_perfil_url || null;

    return {
      isInternal: true,
      title: nome,
      badge: '',
      avatar: avatar,
      avatarUrl: avatarUrl,
      subtitle: '1:1 interno',
      setorCor: outroUser?.attendant_sector || 'geral'
    };
    }

    // ✅ Se não encontrou outro usuario, mostrar como incompleto
    return {
      isInternal: true,
      title: 'Chat Interno',
      badge: '',
      avatar: 'C',
      avatarUrl: null,
      subtitle: '1:1 usuario interno (incompleto)',
      setorCor: 'geral'
    };
    }
    
    // Grupo de setor
    if (thread.thread_type === 'sector_group') {
      const setor = thread.sector_key?.replace('sector:', '') || 'geral';
      return {
        isInternal: true,
        title: `Setor ${setor}`,
        badge: '',
        avatar: 'G',
        subtitle: `Grupo • ${thread.participants?.length || 0} membros`,
        setorCor: setor
      };
    }
    
    // Grupo customizado
    if (thread.is_group_chat) {
      return {
        isInternal: true,
        title: thread.group_name || 'Grupo',
        badge: '',
        avatar: 'G',
        subtitle: `${thread.participants?.length || 0} membros`,
        setorCor: 'geral'
      };
    }
  }
  
  // ✅ THREADS EXTERNAS (manter compatibilidade)
  return {
    isInternal: false
  };
};

export default function ChatSidebar({ 
  threads, 
  threadAtiva, 
  onSelecionarThread, 
  loading, 
  usuarioAtual, 
  integracoes = [],
  atendentes = [], // Lista de Users para buscar nomes atualizados
  // Props para seleção múltipla (controlados pelo pai)
  modoSelecaoMultipla = false,
  setModoSelecaoMultipla,
  contatosSelecionados = [],
  setContatosSelecionados,
  onSelectInternalDestinations, // Callback para seleção interna
  // Props para botões de ação
  onFilterScopeChange,
  onSelectedIntegrationChange,
  filterScope,
  contatos = [], // Para ContatosRequerendoAtencao
  onOpenKanbanRequerAtencao, // Callback para abrir Kanban em tela cheia
  onOpenKanbanNaoAtribuidos // Callback para abrir Kanban de não atribuídos
}) {
  // Estado local apenas para compatibilidade
  const modoSelecao = modoSelecaoMultipla;

  // Estado para o composer de mensagens internas
  const [internalComposerOpen, setInternalComposerOpen] = React.useState(false);
  const [delegateMode, setDelegateMode] = React.useState(false);
  const [criarGrupoOpen, setCriarGrupoOpen] = React.useState(false);
  const [agendaIAOpen, setAgendaIAOpen] = React.useState(false);

  // Buscar categorias dinâmicas
  const { data: categoriasDB = [] } = useQuery({
    queryKey: ['categorias-mensagens'],
    queryFn: () => base44.entities.CategoriasMensagens.filter({ ativa: true }, 'nome'),
    staleTime: 5 * 60 * 1000
  });

  // Buscar etiquetas dinâmicas do banco
  const { etiquetas: etiquetasDB, getConfig: getEtiquetaConfigDinamico } = useEtiquetasContato();

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🛡️ FILTRO DE VISIBILIDADE - Nexus360 + Legacy
  // ═══════════════════════════════════════════════════════════════════════════════
  const threadsFiltradas = React.useMemo(() => {
    if (!threads || threads.length === 0) return [];

    // A lista de threads que chega já foi filtrada pela lógica de `Comunicacao.jsx`.
    // O filtro aqui foi removido para evitar duplicidade e conflitos.
    return threads;
  }, [threads, usuarioAtual, integracoes]);

  const threadsSorted = React.useMemo(() => {
    return [...threadsFiltradas].sort((a, b) => {
      const dateA = new Date(a.last_message_at || 0);
      const dateB = new Date(b.last_message_at || 0);
      return dateB - dateA;
    });
  }, [threadsFiltradas]);
  
  // Verificar se houve transferência recente (últimos 10 segundos)
  const foiTransferidaRecentemente = (thread) => {
    const transferencia = thread.metadata?.transferencia_recente;
    if (!transferencia) return false;
    const tempoDecorrido = Date.now() - new Date(transferencia.transferido_em).getTime();
    return tempoDecorrido < 10000; // 10 segundos
  };

  const formatarHorario = (timestamp) => {
    if (!timestamp) return "";
    try {
      const agora = new Date();
      const dataMsg = new Date(timestamp);

      if (agora.toDateString() === dataMsg.toDateString()) {
        return format(dataMsg, 'HH:mm');
      }

      const diffDias = Math.floor((agora - dataMsg) / (1000 * 60 * 60 * 24));
      if (diffDias < 7) {
        const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        return diasSemana[dataMsg.getDay()];
      }

      return format(dataMsg, 'dd/MM');
    } catch {
      return "";
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        {Array(5).fill(0).map((_, i) =>
        <div key={i} className="animate-pulse flex gap-3 mb-4">
            <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-slate-200 rounded w-1/2"></div>
            </div>
          </div>
        )}
      </div>);

  }

  // Função para buscar nome e número da integração
  const getIntegracaoInfo = (thread) => {
    if (!thread.whatsapp_integration_id || integracoes.length === 0) return null;
    const integracao = integracoes.find((i) => i.id === thread.whatsapp_integration_id);
    if (!integracao) return null;
    return {
      nome: integracao.nome_instancia,
      numero: integracao.numero_telefone
    };
  };

  if (threadsSorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-6">
        <Clock className="w-12 h-12 text-slate-300 mb-3" />
        <p className="font-semibold text-slate-600">Nenhuma conversa</p>
        <p className="text-sm text-slate-500 mt-1">
          Use a busca acima para iniciar
        </p>
      </div>);

  }

  const handleClick = (thread, e) => {
    // Se está em modo seleção, toggle do contato
    if (modoSelecao) {
      e?.stopPropagation();
      toggleSelecaoContato(thread.contato);
      return;
    }

    console.log('🖱️ [ChatSidebar] Click na thread:', thread.id, thread.thread_type);

    // Validação antes de chamar onSelecionarThread
    if (!thread || !thread.id) {
      console.error('❌ [ChatSidebar] Thread inválida:', thread);
      return;
    }

    // ✅ Threads internas não precisam de contact_id
    if (!thread.contact_id && thread.thread_type !== 'team_internal' && thread.thread_type !== 'sector_group') {
      console.error('❌ [ChatSidebar] Thread externa sem contact_id:', thread);
      return;
    }

    // 🔧 AUTO-REDIRECIONAR para thread canônica se a atual for não-canônica
    let threadParaAbrir = thread;
    if (thread.status === 'merged' && thread.merged_into) {
      console.log(`[ChatSidebar] 🔀 Auto-redirecionando thread merged ${thread.id} → ${thread.merged_into}`);
      const threadCanonica = threads.find(t => t.id === thread.merged_into);
      if (threadCanonica) {
        threadParaAbrir = threadCanonica;
      }
    }

    // Chamar callback com a thread correta
    onSelecionarThread(threadParaAbrir);
  };

  // Toggle seleção de contato
  const toggleSelecaoContato = (contato) => {
    if (!contato || !setContatosSelecionados) return;
    
    setContatosSelecionados(prev => {
      const jaExiste = prev.find(c => c.id === contato.id);
      if (jaExiste) {
        return prev.filter(c => c.id !== contato.id);
      } else {
        return [...prev, contato];
      }
    });
  };

  // Cancelar modo seleção
  const cancelarSelecao = () => {
    if (setModoSelecaoMultipla) setModoSelecaoMultipla(false);
    if (setContatosSelecionados) setContatosSelecionados([]);
  };

  // Selecionar todos visíveis
  const selecionarTodos = () => {
    if (!setContatosSelecionados) return;
    const todosContatos = threadsSorted
      .map(t => t.contato)
      .filter(c => c && c.telefone);
    setContatosSelecionados(todosContatos);
  };

  // Função para obter User atualizado do atendente fidelizado
  const getAtendenteFidelizado = (contato) => {
    return getAtendenteFidelizadoAtualizado(contato, atendentes);
  };

  return (
    <div className="relative">
      {/* Barra de Ações de Seleção Múltipla */}
      {modoSelecao ? (
        <div className="sticky top-0 z-10 bg-gradient-to-r from-orange-500 to-amber-500 p-2 flex items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={cancelarSelecao}
              className="text-white hover:bg-white/20 h-8 px-2"
            >
              <X className="w-4 h-4" />
            </Button>
            <span className="text-white text-sm font-medium">
              {contatosSelecionados.length} selecionado(s)
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={selecionarTodos}
              className="text-white hover:bg-white/20 h-8 px-2 text-xs"
            >
              Todos
            </Button>
          </div>
        </div>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SUPER CONTATO FIXO - EQUIPE INTERNA / SETOR */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {!modoSelecao && (
        <div className="sticky top-0 z-10 bg-purple-50/80 backdrop-blur-sm border-b border-purple-200 px-2 py-1 space-y-1">
          {/* Linha única: ícone + label + 4 botões + 2 botões de ação */}
          <div className="flex items-center gap-1">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white shadow-sm bg-gradient-to-br from-purple-500 to-indigo-600 flex-shrink-0">
              <MessagesSquare className="w-3 h-3" />
            </div>
            <span className="text-[10px] font-semibold text-slate-700 flex-shrink-0 mr-1">Equipe</span>
            <Button onClick={() => { setDelegateMode(false); setInternalComposerOpen(true); }} size="sm"
              className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-0 h-6 text-[9px] px-1.5 flex-1 min-w-0">
              <Send className="w-2.5 h-2.5 mr-0.5 flex-shrink-0" /><span>Enviar</span>
            </Button>
            <Button onClick={() => { setDelegateMode(true); setInternalComposerOpen(true); }} size="sm"
              className="bg-gradient-to-r from-orange-500 to-amber-600 text-white border-0 h-6 text-[9px] px-1.5 flex-1 min-w-0">
              <ArrowRightLeft className="w-2.5 h-2.5 mr-0.5 flex-shrink-0" /><span>Transf</span>
            </Button>
            <Button onClick={() => setCriarGrupoOpen(true)} size="sm"
              className="bg-gradient-to-r from-slate-500 to-slate-600 text-white border-0 h-6 text-[9px] px-1.5 flex-1 min-w-0">
              <Plus className="w-2.5 h-2.5 mr-0.5 flex-shrink-0" /><span>Grupo</span>
            </Button>
            <Button onClick={() => setAgendaIAOpen(true)} size="sm"
              className="bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 h-6 text-[9px] px-1.5 flex-1 min-w-0">
              <CalendarCheck className="w-2.5 h-2.5 mr-0.5 flex-shrink-0" /><span>Agenda</span>
            </Button>
          </div>

          {/* ✅ BOTÕES AÇÃO - Não Atribuídos + Contatos Parados */}
           <div className="grid grid-cols-2 gap-1">
             {onOpenKanbanNaoAtribuidos && (() => {
               const naoAtribuidos = threads?.filter(t => !t.assigned_user_id && t.contact_id && !t.is_contact_only).length || 0;
               return (
                 <Button
                   onClick={() => onOpenKanbanNaoAtribuidos()}
                   className="w-full bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white border-0 h-9 text-[10px] px-2 flex items-center justify-between font-semibold shadow-md"
                 >
                   <span className="flex items-center gap-1">
                     <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                     <span className="truncate">Não Atribuídos</span>
                   </span>
                   {naoAtribuidos > 0 && (
                     <Badge className="bg-white text-red-600 text-[9px] font-bold px-1 h-5 min-w-5 flex items-center justify-center rounded-full ml-1 flex-shrink-0">
                       {naoAtribuidos}
                     </Badge>
                   )}
                 </Button>
               );
             })()}
             {onOpenKanbanRequerAtencao && (() => {
               const threadsComProblema = threads?.filter(t => {
                 const contato = t.contato;
                 return contato && 
                   (contato.days_inactive_inbound >= 2 || 
                    contato.deal_risk > 0 || 
                    contato.prioridadeLabel === 'CRITICO' || 
                    contato.prioridadeLabel === 'ALTO');
               }).length || 0;

               return (
                 <Button
                   onClick={() => onOpenKanbanRequerAtencao()}
                   className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-0 h-9 text-[10px] px-2 flex items-center justify-between font-semibold shadow-md"
                 >
                   <span className="flex items-center gap-1">
                     <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                     <span className="truncate">Parados</span>
                   </span>
                   {threadsComProblema > 0 && (
                     <Badge className="bg-white text-amber-700 text-[9px] font-bold px-1 h-5 min-w-5 flex items-center justify-center rounded-full ml-1 flex-shrink-0">
                       {threadsComProblema}
                     </Badge>
                   )}
                 </Button>
               );
             })()}
           </div>
        </div>
      )}

      {/* Seletor de Destinatários Internos */}
      <InternalMessageComposer
        open={internalComposerOpen}
        onClose={() => {
          setInternalComposerOpen(false);
          setDelegateMode(false);
        }}
        currentUser={usuarioAtual}
        mode={delegateMode ? 'delegate' : 'compose'}
        onSelectDestinations={(selection) => {
          setInternalComposerOpen(false);
          setDelegateMode(false);
          if (onSelectInternalDestinations) {
            onSelectInternalDestinations(selection);
          }
        }}
      />

      {/* Modal de Criar Grupo */}
      <CriarGrupoModal
        open={criarGrupoOpen}
        onClose={() => setCriarGrupoOpen(false)}
        usuarios={atendentes}
        currentUser={usuarioAtual}
        onSuccess={() => {
          setCriarGrupoOpen(false);
          toast.success('✅ Grupo criado!');
        }}
      />

      {/* Modal Agenda IA Unificada */}
      <AgendaIAUnificada
        open={agendaIAOpen}
        onClose={() => setAgendaIAOpen(false)}
        usuario={usuarioAtual}
      />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* LISTA NORMAL DE THREADS */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {threadsSorted.map((thread, index) => {
        const isAtiva = threadAtiva?.id === thread.id;

        // 🔍 PRIORIDADE: Verificar PRIMEIRO se é thread interna EXPLÍCITA
        const isThreadInterna = thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group';

        // ✅ USUÁRIOS INTERNOS - Renderizar com UI resolvida
        if (isThreadInterna) {
          const threadUI = resolveThreadUI(thread, usuarioAtual, atendentes);
          const isSelected = contatosSelecionados.find(c => c.id === thread.id);
          const hasUnread = getUnreadCount(thread, usuarioAtual?.id) > 0;
          const setorConfig = {
            'vendas': { cor: 'bg-emerald-500' },
            'assistencia': { cor: 'bg-blue-500' },
            'financeiro': { cor: 'bg-purple-500' },
            'fornecedor': { cor: 'bg-orange-500' },
            'geral': { cor: 'bg-slate-500' }
          };
          const corAvatar = setorConfig[threadUI.setorCor || 'geral']?.cor || 'bg-indigo-500';
          
          // ✅ Usar getUserDisplayName para exibir nome do outro participante
          const outroUserId = thread.participants?.find(id => id !== usuarioAtual?.id);
          const nomeExibicao = outroUserId 
            ? getUserDisplayName(outroUserId, atendentes) 
            : threadUI.title;

          return (
            <motion.div
              key={thread.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={(e) => handleClick(thread, e)} 
              className={`px-2 py-2 flex items-center gap-3 cursor-pointer transition-all border-b border-purple-100 hover:bg-gradient-to-r hover:from-purple-50 hover:to-indigo-50 ${isAtiva ? 'bg-purple-100' : ''} ${isSelected ? 'bg-purple-100 border-l-4 border-l-purple-500' : ''}`}
            >
              {modoSelecao && (
                <div className="flex-shrink-0">
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-purple-500" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              )}

              <div className="relative flex-shrink-0">
                <div className={`relative w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md overflow-hidden ${corAvatar}`}>
                  {threadUI.avatarUrl ? (
                    <img 
                      src={threadUI.avatarUrl} 
                      alt={threadUI.title} 
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    threadUI.avatar
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    <h3 className={`font-semibold truncate text-sm ${hasUnread ? 'text-slate-900' : 'text-slate-700'}`}>
                      {threadUI.badge} {thread.thread_type === 'team_internal' && !thread.is_group_chat ? (
                        <>
                          {nomeExibicao}
                          {(() => {
                            const outroUserId = thread.participants?.find(id => id !== usuarioAtual?.id);
                            const outroUser = atendentes.find(a => a.id === outroUserId);
                            if (outroUser?.attendant_sector) {
                              return (
                                <>
                                  <span className="text-slate-400 mx-1">•</span>
                                  <span className="text-slate-600 font-normal text-xs">{outroUser.attendant_sector}</span>
                                </>
                              );
                            }
                            return null;
                          })()}
                        </>
                      ) : threadUI.title}
                    </h3>
                    {hasUnread && (
                      <Badge className="rounded-full min-w-[18px] h-4 flex items-center justify-center p-0 px-1 bg-gradient-to-r from-purple-400 via-indigo-500 to-blue-500 text-white text-[10px] font-bold border-0 shadow-lg">
                        {getUnreadCount(thread, usuarioAtual?.id)}
                      </Badge>
                    )}
                  </div>
                  <span className={`text-[10px] flex-shrink-0 ml-2 ${hasUnread ? 'text-purple-600 font-medium' : 'text-slate-400'}`}>
                    {formatarHorario(thread.last_message_at)}
                  </span>
                </div>

                {/* ✅ PREVIEW MENSAGEM INTERNA - Usar metadata se disponível */}
                <p className={`text-xs truncate flex items-center gap-1 ${hasUnread ? 'text-slate-800' : 'text-slate-500'}`}>
                  {thread.last_message_sender === 'user' && <CheckCheck className="w-3 h-3 text-indigo-500 flex-shrink-0" />}
                  {thread.last_media_type === 'image' && <Image className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                  {thread.last_media_type === 'video' && <Video className="w-3 h-3 text-purple-500 flex-shrink-0" />}
                  {thread.last_media_type === 'audio' && <Mic className="w-3 h-3 text-green-500 flex-shrink-0" />}
                  {thread.last_media_type === 'document' && <FileText className="w-3 h-3 text-orange-500 flex-shrink-0" />}
                  <span className="truncate">
                    {thread.last_message_content || "💬 Sem mensagens"}
                  </span>
                  {thread.last_message_sender_name && (
                    <span className="text-[9px] text-indigo-400 italic">
                      ~ {thread.last_message_sender_name.split(' ')[0]}
                    </span>
                  )}
                </p>

                <div className="flex items-center gap-1 mt-1 overflow-hidden">
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white bg-indigo-500 shadow-sm">
                    {threadUI.subtitle}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        }

        // ✅ THREADS EXTERNAS (WhatsApp Z-API, W-API, etc.) - PADRÃO
        // Se não é interna explícita, é EXTERNA
        if (!isThreadInterna) {
          const contato = thread.contato;

          // ✅ DEBUG: Log de contadores para esta thread
          if (thread.id && (thread.unread_count || 0) > 0) {
            console.log(`[SIDEBAR] 📬 Thread ${thread.id.substring(0, 8)}... tem ${thread.unread_count} não lidas`);
          }

          if (!contato) {
            // Se é um cliente sem contato cadastrado, mostrar com indicador especial
            if (thread.is_cliente_only) {
              return (
                <motion.div
                  key={thread.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleClick(thread)}
                  className="flex items-center gap-3 p-4 cursor-pointer transition-all border-b border-slate-100 hover:bg-gradient-to-r hover:from-emerald-50 hover:to-green-50 bg-emerald-50/30">

                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md bg-gradient-to-br from-emerald-400 to-green-500">
                    C
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-700">Cliente sem Contato</h3>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded-full">
                        CRIAR CONTATO
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">Clique para cadastrar</p>
                  </div>
                </motion.div>
              );
            }

            const hasUnread = getUnreadCount(thread, usuarioAtual?.id) > 0;

            return (
              <motion.div
                key={thread.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleClick(thread)}
                className="flex items-center gap-3 p-4 cursor-pointer transition-all border-b border-slate-100 hover:bg-amber-50 border-l-2 border-l-amber-400">

                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md bg-gradient-to-br from-amber-400 to-orange-500">
                  📝
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-700">Cadastro incompleto</h3>
                  <p className="text-xs text-slate-600">Clique para preencher dados</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">ID: {thread.contact_id?.substring(0, 16)}...</p>
                </div>
              </motion.div>
            );
          }

          // Nome formatado: Empresa + Cargo + Nome
          let nomeExibicao = "";

          if (contato.empresa) nomeExibicao += contato.empresa;
          if (contato.cargo) nomeExibicao += (nomeExibicao ? " - " : "") + contato.cargo;
          if (contato.nome && contato.nome !== contato.telefone) nomeExibicao += (nomeExibicao ? " - " : "") + contato.nome;

          if (!nomeExibicao || nomeExibicao.trim() === '') {
            nomeExibicao = contato.telefone || "Sem Nome";
          }

          const isSelected = contatosSelecionados.find(c => c.id === contato?.id);
          const hasUnread = getUnreadCount(thread, usuarioAtual?.id) > 0;

          return (
            <motion.div
              key={thread.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={(e) => handleClick(thread, e)} 
              className={`px-2 py-2 flex items-center gap-3 cursor-pointer transition-all border-b border-slate-100 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 ${thread.is_contact_only ? 'bg-slate-50/50' : ''} ${isAtiva ? 'bg-blue-50' : ''} ${isSelected ? 'bg-orange-100 border-l-4 border-l-orange-500' : ''}`}
            >
              {/* Checkbox em modo seleção */}
              {modoSelecao && (
                <div className="flex-shrink-0">
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-orange-500" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              )}

              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className={`relative w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md overflow-hidden ${
                hasUnread ?
                'bg-gradient-to-br from-amber-400 via-orange-500 to-red-500' :
                'bg-gradient-to-br from-slate-400 to-slate-500'}`
                }>
                  {contato.foto_perfil_url && contato.foto_perfil_url !== 'null' && contato.foto_perfil_url !== 'undefined' ? (
                    <img
                      src={contato.foto_perfil_url}
                      alt={nomeExibicao}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.textContent = nomeExibicao.charAt(0).toUpperCase();
                      }}
                    />
                  ) : (
                    nomeExibicao.charAt(0).toUpperCase()
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                {/* ⭐ AVISO DE TRANSFERÊNCIA RECENTE */}
                {foiTransferidaRecentemente(thread) && (
                  <div className="bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-300 rounded-md px-2 py-1 mb-1 animate-pulse">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-800">
                      <ArrowRightLeft className="w-3 h-3 text-amber-600" />
                      <span>
                        Transferido: {thread.metadata.transferencia_recente.transferido_de} → {thread.metadata.transferencia_recente.transferido_para}
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Linha 1: Nome + Número Conexão + Horário */}
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                      <h3 className={`font-semibold truncate text-sm ${hasUnread ? 'text-slate-900' : 'text-slate-700'}`}>
                        {nomeExibicao}
                      </h3>
                      {hasUnread && (
                        <Badge className="rounded-full min-w-[18px] h-4 flex items-center justify-center p-0 px-1 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white text-[10px] font-bold border-0 shadow-lg">
                          {getUnreadCount(thread, usuarioAtual?.id)}
                        </Badge>
                      )}
                    {(() => {
                      const info = getIntegracaoInfo(thread);
                      if (!info) return null;

                      const ultimos4 = info.numero?.slice(-4) || '0000';
                      return (
                        <span className="text-[9px] text-slate-400 ml-1 flex-shrink-0" title={`Canal: ${info.nome} (${info.numero})`}>
                          #{ultimos4}
                        </span>
                      );
                    })()}
                    </div>
                  <span className={`text-[10px] flex-shrink-0 ml-2 ${
                  hasUnread ? 'text-orange-600 font-medium' : 'text-slate-400'}`
                  }>
                    {formatarHorario(thread.last_message_at)}
                  </span>
                </div>

                {/* ✅ LINHA 2: Preview mensagem - LÓGICA SEPARADA (interno vs externo) */}
                <p className={`text-xs truncate flex items-center gap-1 ${hasUnread ? 'text-slate-800' : 'text-slate-500'}`}>
                  {thread.is_contact_only ? (
                    <span className="text-slate-400 italic">Sem conversa ativa</span>
                  ) : (
                    <>
                      {thread.last_message_sender === 'user' && (() => {
                        const status = thread.last_message_status;
                        if (status === 'lida') return <CheckCheck className="w-3 h-3 text-blue-500 flex-shrink-0" />;
                        if (status === 'entregue') return <CheckCheck className="w-3 h-3 text-slate-400 flex-shrink-0" />;
                        if (status === 'enviada') return <Check className="w-3 h-3 text-slate-400 flex-shrink-0" />;
                        if (status === 'enviando') return <Clock className="w-3 h-3 text-slate-300 flex-shrink-0" />;
                        if (status === 'falhou') return <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />;
                        // fallback: duplo check padrão
                        return <CheckCheck className="w-3 h-3 text-slate-400 flex-shrink-0" />;
                      })()}
                      {thread.last_media_type === 'image' && <Image className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                      {thread.last_media_type === 'video' && <Video className="w-3 h-3 text-purple-500 flex-shrink-0" />}
                      {thread.last_media_type === 'audio' && <Mic className="w-3 h-3 text-green-500 flex-shrink-0" />}
                      {thread.last_media_type === 'document' && <FileText className="w-3 h-3 text-orange-500 flex-shrink-0" />}
                      {thread.last_media_type === 'location' && <MapPin className="w-3 h-3 text-red-500 flex-shrink-0" />}
                      {thread.last_media_type === 'contact' && <PhoneIcon className="w-3 h-3 text-cyan-500 flex-shrink-0" />}
                      <span className="truncate">
                        {(() => {
                          let content = thread.last_message_content;
                          
                          // ✅ THREADS EXTERNAS: Filtros agressivos de limpeza
                          if (!content || content === '[No content]' || /^[\+\d]+@(lid|s\.whatsapp\.net|c\.us)/.test(content)) {
                            if (thread.last_media_type === 'image') return "[Imagem]";
                            if (thread.last_media_type === 'video') return "[Video]";
                            if (thread.last_media_type === 'audio') return "[Audio]";
                            if (thread.last_media_type === 'document') return "[Documento]";
                            if (thread.last_media_type === 'location') return "[Localizacao]";
                            if (thread.last_media_type === 'contact') return "[Contato]";
                            if (thread.last_media_type === 'sticker') return "[Sticker]";
                            return "Nova mensagem";
                          }
                          
                          return content;
                        })()}
                      </span>
                      {thread.last_message_sender_name && (
                        <span className="text-[9px] text-slate-400 italic">
                          ~ {thread.last_message_sender_name.split(' ')[0]}
                        </span>
                      )}
                    </>
                  )}
                </p>

                {/* Linha 3: TIPO + DESTAQUE + ATENDENTE (horizontal compacto com labels) */}
                <div className="flex items-center gap-1 mt-1 overflow-hidden">
                  {/* TIPO */}
                  {(() => {
                    const tipoContato = contato?.tipo_contato || 'novo';
                    const tiposConfig = {
                      'novo': { emoji: '?', label: 'Novo', bg: 'bg-slate-400' },
                      'lead': { emoji: 'L', label: 'Lead', bg: 'bg-amber-500' },
                      'cliente': { emoji: 'C', label: 'Cliente', bg: 'bg-emerald-500' },
                      'fornecedor': { emoji: 'F', label: 'Fornec.', bg: 'bg-blue-500' },
                      'parceiro': { emoji: 'P', label: 'Parceiro', bg: 'bg-purple-500' }
                    };
                    const cfg = tiposConfig[tipoContato] || tiposConfig['novo'];
                    return (
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white ${cfg.bg} shadow-sm`}>
                        {cfg.emoji} {cfg.label}
                      </span>
                    );
                  })()}

                  {/* 📤 BROADCAST RECENTE - Mostrar se última mensagem foi en massa */}
                  {(() => {
                    // Detectar se última mensagem foi enviada em massa
                    const ultimaMensagemBroadcast = thread.metadata?.ultima_mensagem_origem === 'broadcast_massa' || 
                      thread.last_message_content?.includes('[Broadcast]');
                    const ultimaMensagemHoras = thread.last_message_at 
                      ? Math.floor((Date.now() - new Date(thread.last_message_at).getTime()) / (1000 * 60 * 60))
                      : null;
                    
                    if (ultimaMensagemBroadcast && ultimaMensagemHoras !== null && ultimaMensagemHoras < 24) {
                      return (
                        <span 
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white bg-gradient-to-r from-blue-500 to-cyan-500 shadow-sm animate-pulse"
                          title={`Broadcast há ${ultimaMensagemHoras}h`}
                        >
                          📤 Broadcast
                        </span>
                      );
                    }
                    
                    return null;
                  })()}

                 {/* ✅ MENSAGEM REATIVAÇÃO RÁPIDA */}
                  {(() => {
                    const analise = thread._analiseComportamental;
                    const diasInativo = analise?.days_inactive_inbound || 0;
                    
                    // Mostrar sugestão rápida se inativo 30+ dias
                    if (diasInativo >= 30) {
                      return (
                        <MensagemReativacaoRapida
                          contato={contato}
                          analise={analise}
                          variant="badge"
                          onUsarMensagem={(msg) => {
                            // Abrir conversa e preparar mensagem
                            handleClick(thread);
                          }}
                        />
                      );
                    }
                    
                    // Senão, mostrar análise de prioridade
                    if (analise?.priority_label) {
                      const badgeConfig = {
                        'CRITICO': { emoji: '🔴', label: 'Crítico', bg: 'bg-red-500' },
                        'ALTO': { emoji: '🟠', label: 'Alto', bg: 'bg-orange-500' },
                        'MEDIO': { emoji: '🟡', label: 'Médio', bg: 'bg-yellow-500' },
                        'BAIXO': { emoji: '🟢', label: 'Baixo', bg: 'bg-green-500' }
                      };
                      
                      const cfg = badgeConfig[analise.priority_label] || badgeConfig['MEDIO'];
                      
                      return (
                        <span 
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white ${cfg.bg} shadow-sm`}
                          title={`${diasInativo} dias sem responder`}
                        >
                          {cfg.emoji} {cfg.label}
                        </span>
                      );
                    }
                    
                    return null;
                  })()}

                  {/* DESTAQUES (max 2) - DINÂMICO */}
                  {contato?.tags && contato.tags.length > 0 && (() => {
                    // Buscar etiquetas de destaque do banco
                    const etiquetasDestaqueDB = etiquetasDB.filter(e => e.destaque === true);
                    const nomesDestaque = etiquetasDestaqueDB.map(e => e.nome);

                    const tagsOrdenadas = contato.tags
                      .filter(t => nomesDestaque.includes(t))
                      .sort((a, b) => {
                        const ordemA = etiquetasDestaqueDB.find(e => e.nome === a)?.ordem || 100;
                        const ordemB = etiquetasDestaqueDB.find(e => e.nome === b)?.ordem || 100;
                        return ordemA - ordemB;
                      })
                      .slice(0, 1); // ✅ Reduzido para 1 (espaço para análise IA)

                    return tagsOrdenadas.map(etq => {
                      const cfg = getEtiquetaConfigDinamico(etq);
                      return (
                        <span key={etq} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white ${cfg.cor || 'bg-slate-500'} shadow-sm`}>
                          {cfg.emoji || '🏷️'} {cfg.label?.substring(0, 6) || etq}
                        </span>
                      );
                    });
                  })()}

                  {/* FIDELIZADO - Mostra se contato tem atendente fidelizado */}
                  {contato?.is_cliente_fidelizado && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-amber-700 bg-amber-100 shadow-sm" title="Cliente Fidelizado">
                      VIP
                    </span>
                  )}
                  
                  {/* ATENDENTE: Badge compacto com UsuarioDisplay no tooltip */}
                  {thread.assigned_user_id ? (
                    (() => {
                      const nomeAtendente = getUserDisplayName(thread.assigned_user_id, atendentes);
                      const isCarregando = nomeAtendente === 'Carregando...' || nomeAtendente === 'Usuário não encontrado';
                      
                      if (isCarregando) {
                        return (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-slate-500 bg-slate-100 shadow-sm" title="Atendente não visível">
                            <UserCheck className="w-3 h-3" />
                            Restrito
                          </span>
                        );
                      }
                      
                      return (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white bg-indigo-500 shadow-sm">
                          <UserCheck className="w-3 h-3" />
                          {nomeAtendente.split(' ')[0]}
                        </span>
                      );
                    })()
                  ) : getAtendenteFidelizado(contato)?.id ? (
                    (() => {
                      const atendenteFidelizado = getAtendenteFidelizado(contato);
                      const nomeFidelizado = getUserDisplayName(atendenteFidelizado.id, atendentes);
                      const isCarregando = nomeFidelizado === 'Carregando...' || nomeFidelizado === 'Usuário não encontrado';
                      
                      if (isCarregando) {
                        return (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-slate-500 bg-slate-100 shadow-sm" title="Atendente fidelizado não visível">
                            VIP Restrito
                          </span>
                        );
                      }
                      
                      return (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-amber-700 bg-amber-100 shadow-sm">
                          VIP {nomeFidelizado.split(' ')[0]}
                        </span>
                      );
                    })()
                  ) : thread.is_contact_only ? (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-slate-500 bg-slate-100 shadow-sm">
                      S/atend.
                    </span>
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
            </motion.div>
          );
        }

        return null; // Fallback para casos não tratados
      })}

    </div>
  );

}