import React, { useMemo, useState } from "react";
import { CheckCheck, Clock, User, Users, AlertCircle, Image, Video, Mic, FileText, MapPin, Phone as PhoneIcon, Tag, Building2, Target, Truck, Handshake, HelpCircle, UserCheck, Send, X, CheckSquare, Square, MessagesSquare, ArrowRightLeft, Plus } from "lucide-react";
import InternalMessageComposer from "./InternalMessageComposer";
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
  // ✅ THREADS INTERNAS
  if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
    // 1:1 interno: buscar o outro participante
    if (thread.thread_type === 'team_internal' && !thread.is_group_chat) {
      const outroUserId = thread.participants?.find(id => id !== currentUser?.id);
      if (outroUserId) {
        const outroUser = atendentes.find(a => a.id === outroUserId);
        const nome = outroUser?.full_name || outroUser?.email || 'Usuário';
        const avatar = outroUser?.full_name?.charAt(0)?.toUpperCase() || outroUser?.email?.charAt(0)?.toUpperCase() || 'U';
        
        // ✅ CORREÇÃO: Usar foto_perfil_url do User quando disponível
        const avatarUrl = outroUser?.foto_perfil_url || null;
        
        return {
          isInternal: true,
          title: nome,
          badge: '💬',
          avatar: avatar,
          avatarUrl: avatarUrl,
          subtitle: '1:1 interno',
          setorCor: outroUser?.attendant_sector || 'geral'
        };
      }
    }
    
    // Grupo de setor
    if (thread.thread_type === 'sector_group') {
      const setor = thread.sector_key?.replace('sector:', '') || 'geral';
      return {
        isInternal: true,
        title: `Setor ${setor}`,
        badge: '🏢',
        avatar: <Building2 className="w-6 h-6" />,
        subtitle: `Grupo • ${thread.participants?.length || 0} membros`,
        setorCor: setor
      };
    }
    
    // Grupo customizado
    if (thread.is_group_chat) {
      return {
        isInternal: true,
        title: thread.group_name || 'Grupo',
        badge: '👥',
        avatar: <Users className="w-6 h-6" />,
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
  onSelectInternalDestinations // Callback para seleção interna
}) {
  // Estado local apenas para compatibilidade
  const modoSelecao = modoSelecaoMultipla;

  // Estado para o composer de mensagens internas
  const [internalComposerOpen, setInternalComposerOpen] = useState(false);
  const [delegateMode, setDelegateMode] = useState(false);
  const [criarGrupoOpen, setCriarGrupoOpen] = useState(false);

  // Buscar categorias dinâmicas
  const { data: categoriasDB = [] } = useQuery({
    queryKey: ['categorias-mensagens'],
    queryFn: () => base44.entities.CategoriasMensagens.filter({ ativa: true }, 'nome'),
    staleTime: 5 * 60 * 1000
  });

  // Buscar etiquetas dinâmicas do banco
  const { etiquetas: etiquetasDB, getConfig: getEtiquetaConfigDinamico } = useEtiquetasContato();

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🛡️ FILTRO BLINDADO - Aceita thread_type null (Z-API/W-API antiga)
  // ═══════════════════════════════════════════════════════════════════════════════
  const threadsFiltradas = useMemo(() => {
    if (!threads || threads.length === 0) return [];

    return threads.filter((thread) => {
      // 1️⃣ INTERNOS: Restritivo - Precisa ser participante ou admin
      if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
        const isParticipant = thread.participants?.includes(usuarioAtual?.id);
        const isAdmin = usuarioAtual?.role === 'admin';
        return Boolean(isParticipant || isAdmin);
      }
      
      // 2️⃣ EXTERNOS (ou thread_type ausente): Permissivo - Mostra tudo exceto bloqueados
      // ✅ Aceita Z-API/W-API que não preenchem thread_type
      const contato = thread.contato;
      if (contato && contato.bloqueado) return false;
      return true;
    });
  }, [threads, usuarioAtual]);

  const threadsSorted = useMemo(() => {
    return [...threadsFiltradas].sort((a, b) => {
      const dateA = new Date(a.last_message_at || 0);
      const dateB = new Date(b.last_message_at || 0);
      return dateB - dateA;
    });
  }, [threadsFiltradas]);

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

    // Chamar callback
    onSelecionarThread(thread);
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
        <div className="sticky top-0 z-10 bg-purple-50/80 backdrop-blur-sm border-b border-purple-200 px-2 py-1.5">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm bg-gradient-to-br from-purple-500 to-indigo-600">
              <MessagesSquare className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 text-xs truncate">
                🏢 Equipe interna
              </h3>
              <p className="text-[10px] text-slate-600 truncate">
                Envio • 1:1 / Setores / Grupos
              </p>
            </div>
          </div>
          
          <div className="flex gap-1">
            <Button
              onClick={() => {
                setDelegateMode(false);
                setInternalComposerOpen(true);
              }}
              variant="outline"
              size="sm"
              className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white border-0 h-7 text-[10px] px-2"
            >
              <Send className="w-3 h-3 mr-0.5" />
              Enviar
            </Button>
            <Button
              onClick={() => {
                setDelegateMode(true);
                setInternalComposerOpen(true);
              }}
              variant="outline"
              size="sm"
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white border-0 h-7 text-[10px] px-2"
            >
              <ArrowRightLeft className="w-3 h-3 mr-0.5" />
              Transferir
            </Button>
            <Button
              onClick={() => setCriarGrupoOpen(true)}
              variant="outline"
              size="sm"
              className="flex-1 bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white border-0 h-7 text-[10px] px-2"
            >
              <Plus className="w-3 h-3 mr-0.5" />
              Grupo
            </Button>
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

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* LISTA NORMAL DE THREADS */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {threadsSorted.map((thread, index) => {
        const isAtiva = threadAtiva?.id === thread.id;

        // 🔍 PRIORIDADE: Verificar PRIMEIRO se é thread interna EXPLÍCITA
        const isThreadInterna = thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group';

        // ✅ THREADS INTERNAS - Renderizar com UI resolvida
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
                      {threadUI.badge} {thread.thread_type === 'team_internal' && !thread.is_group_chat ? nomeExibicao : threadUI.title}
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

                <p className={`text-xs truncate flex items-center gap-1 ${hasUnread ? 'text-slate-800' : 'text-slate-500'}`}>
                  {thread.last_message_sender === 'user' && <CheckCheck className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                  {thread.last_media_type === 'image' && <Image className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                  {thread.last_media_type === 'video' && <Video className="w-3 h-3 text-purple-500 flex-shrink-0" />}
                  {thread.last_media_type === 'audio' && <Mic className="w-3 h-3 text-green-500 flex-shrink-0" />}
                  {thread.last_media_type === 'document' && <FileText className="w-3 h-3 text-orange-500 flex-shrink-0" />}
                  <span className="truncate">
                    {thread.last_message_content || "💬 Aguardando mensagem..."}
                  </span>
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
                    💎
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
                className="flex items-center gap-3 p-4 cursor-pointer transition-all border-b border-slate-100 hover:bg-slate-50">

                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md bg-gradient-to-br from-slate-400 to-slate-500">
                  ?
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-700">Contato Desconhecido</h3>
                  <p className="text-sm text-slate-600">ID: {thread.contact_id}</p>
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
                {/* Linha 1: Nome + Número Conexão + Horário */}
                <div className="flex items-center justify-between mb-0.5">
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                      <h3 className={`font-semibold truncate text-sm ${hasUnread ? 'text-slate-900' : 'text-slate-700'}`}>
                        {nomeExibicao}
                      </h3>
                      {hasUnread &&
                      <Badge className="rounded-full min-w-[18px] h-4 flex items-center justify-center p-0 px-1 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white text-[10px] font-bold border-0 shadow-lg">
                          {getUnreadCount(thread, usuarioAtual?.id)}
                        </Badge>
                      }
                    {(() => {
                      const info = getIntegracaoInfo(thread);
                      if (!info) return null;
                      
                      // Extrair apenas últimos 4 dígitos do número
                      const ultimos4 = info.numero?.slice(-4) || '????';
                      return (
                        <span className="text-[9px] text-slate-400 ml-1 flex-shrink-0" title={`Canal: ${info.nome} (${info.numero})`}>
                          •{ultimos4}
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

                {/* Linha 2: Preview mensagem - IGNORAR MENSAGENS DE SISTEMA */}
                <p className={`text-xs truncate flex items-center gap-1 ${
                  hasUnread ? 'text-slate-800' : 'text-slate-500'}`
                  }>
                  {thread.is_contact_only ? (
                    <span className="text-slate-400 italic">📋 Sem conversa ativa</span>
                  ) : (
                    <>
                      {thread.last_message_sender === 'user' &&
                        <CheckCheck className="w-3 h-3 text-blue-500 flex-shrink-0" />
                      }
                      {thread.last_media_type === 'image' && <Image className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                      {thread.last_media_type === 'video' && <Video className="w-3 h-3 text-purple-500 flex-shrink-0" />}
                      {thread.last_media_type === 'audio' && <Mic className="w-3 h-3 text-green-500 flex-shrink-0" />}
                      {thread.last_media_type === 'document' && <FileText className="w-3 h-3 text-orange-500 flex-shrink-0" />}
                      {thread.last_media_type === 'location' && <MapPin className="w-3 h-3 text-red-500 flex-shrink-0" />}
                      {thread.last_media_type === 'contact' && <PhoneIcon className="w-3 h-3 text-cyan-500 flex-shrink-0" />}
                      <span className="truncate">
                        {(() => {
                          let content = thread.last_message_content;
                          
                          // ✅ Se não há conteúdo válido, usar ícone de mídia
                          if (!content || content === '[No content]' || /^[\+\d]+@(lid|s\.whatsapp\.net|c\.us)/.test(content)) {
                            if (thread.last_media_type === 'image') return "📷 Imagem";
                            if (thread.last_media_type === 'video') return "🎥 Vídeo";
                            if (thread.last_media_type === 'audio') return "🎤 Áudio";
                            if (thread.last_media_type === 'document') return "📄 Documento";
                            if (thread.last_media_type === 'location') return "📍 Localização";
                            if (thread.last_media_type === 'contact') return "👤 Contato";
                            if (thread.last_media_type === 'sticker') return "🎨 Sticker";
                            return "💬 Nova mensagem";
                          }
                          
                          return content;
                        })()}
                      </span>
                    </>
                  )}
                </p>

                {/* Linha 3: TIPO + DESTAQUE + ATENDENTE (horizontal compacto com labels) */}
                <div className="flex items-center gap-1 mt-1 overflow-hidden">
                  {/* TIPO */}
                  {(() => {
                    const tipoContato = contato?.tipo_contato || 'novo';
                    const tiposConfig = {
                      'novo': { emoji: '❓', label: 'Novo', bg: 'bg-slate-400' },
                      'lead': { emoji: '🎯', label: 'Lead', bg: 'bg-amber-500' },
                      'cliente': { emoji: '💎', label: 'Cliente', bg: 'bg-emerald-500' },
                      'fornecedor': { emoji: '🏭', label: 'Fornec.', bg: 'bg-blue-500' },
                      'parceiro': { emoji: '🤝', label: 'Parceiro', bg: 'bg-purple-500' }
                    };
                    const cfg = tiposConfig[tipoContato] || tiposConfig['novo'];
                    return (
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white ${cfg.bg} shadow-sm`}>
                        {cfg.emoji} {cfg.label}
                      </span>
                    );
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
                      .slice(0, 2);

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
                      ⭐
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
                            ⭐ Restrito
                          </span>
                        );
                      }
                      
                      return (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-amber-700 bg-amber-100 shadow-sm">
                          ⭐ {nomeFidelizado.split(' ')[0]}
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