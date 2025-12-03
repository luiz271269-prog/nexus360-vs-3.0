import React, { useMemo, useState } from "react";
import { CheckCheck, Clock, User, Users, AlertCircle, Image, Video, Mic, FileText, MapPin, Phone as PhoneIcon, Tag, Building2, Target, Truck, Handshake, HelpCircle, UserCheck, Send, X, CheckSquare, Square } from "lucide-react";
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
import AtribuidorAtendenteRapido from "./AtribuidorAtendenteRapido";
import {
  SETORES_ATENDIMENTO,
  podeAtenderContato,
  verificarPermissaoUsuario } from
"./MotorRoteamentoAtendimento";
import { useEtiquetasContato } from "./SeletorEtiquetasContato";
import { Button } from "@/components/ui/button";

export default function ChatSidebar({ 
  threads, 
  threadAtiva, 
  onSelecionarThread, 
  loading, 
  usuarioAtual, 
  integracoes = [],
  // Props para seleção múltipla (controlados pelo pai)
  modoSelecaoMultipla = false,
  setModoSelecaoMultipla,
  contatosSelecionados = [],
  setContatosSelecionados
}) {
  // Estado local apenas para compatibilidade
  const modoSelecao = modoSelecaoMultipla;

  // Buscar categorias dinâmicas
  const { data: categoriasDB = [] } = useQuery({
    queryKey: ['categorias-mensagens'],
    queryFn: () => base44.entities.CategoriasMensagens.filter({ ativa: true }, 'nome'),
    staleTime: 5 * 60 * 1000
  });

  // Buscar etiquetas dinâmicas do banco
  const { etiquetas: etiquetasDB, getConfig: getEtiquetaConfigDinamico } = useEtiquetasContato();

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔐 FILTRO DE VISIBILIDADE - REGRAS CLARAS:
  // 1. Contatos FIDELIZADOS: sempre visíveis para o atendente fidelizado
  // 2. Conversas ATRIBUÍDAS: visíveis apenas para o atendente atribuído
  // 3. Conversas NÃO ATRIBUÍDAS: visíveis se contato escolheu meu setor OU não tem setor
  // ═══════════════════════════════════════════════════════════════════════════════
  const threadsFiltradas = useMemo(() => {
    if (!threads || threads.length === 0) return [];

    // Campos de fidelização por setor
    const camposAtendenteFidelizado = {
      'vendas': 'atendente_fidelizado_vendas',
      'assistencia': 'atendente_fidelizado_assistencia',
      'financeiro': 'atendente_fidelizado_financeiro',
      'fornecedor': 'atendente_fidelizado_fornecedor'
    };

    return threads.filter((thread) => {
      const contato = thread.contato;

      // 0️⃣ Filtrar bloqueados
      if (contato && contato.bloqueado) return false;

      // 1️⃣ Admin vê tudo
      if (usuarioAtual?.role === 'admin') return true;

      // Dados do usuário atual
      const currentUserId = usuarioAtual?.id;
      const currentUserFullName = usuarioAtual?.full_name;
      const currentUserEmail = usuarioAtual?.email;
      const currentUserSector = usuarioAtual?.attendant_sector || 'geral';
      const podeVerTodos = verificarPermissaoUsuario(usuarioAtual, 'ver_todos');

      // 2️⃣ Gerentes/Coordenadores/Supervisores veem tudo do setor
      if (podeVerTodos) return true;

      // ════════════════════════════════════════════════════════════════
      // REGRA 1: MEUS FIDELIZADOS - SEMPRE VISÍVEIS
      // Contato fidelizado a mim em QUALQUER setor = sempre aparece
      // ════════════════════════════════════════════════════════════════
      let isFidelizadoAMim = false;
      let setorFidelizado = null;
      for (const [setor, campo] of Object.entries(camposAtendenteFidelizado)) {
        const valorCampo = contato?.[campo];
        if (valorCampo && (valorCampo === currentUserId || valorCampo === currentUserFullName || valorCampo === currentUserEmail)) {
          isFidelizadoAMim = true;
          setorFidelizado = setor;
          break;
        }
      }
      
      // Também verificar vendedor_responsavel
      const vendedorResp = contato?.vendedor_responsavel;
      if (vendedorResp && (vendedorResp === currentUserId || vendedorResp === currentUserFullName || vendedorResp === currentUserEmail)) {
        isFidelizadoAMim = true;
      }

      if (isFidelizadoAMim) {
        return true; // REGRA 1: Sempre visível para meu atendente fidelizado
      }

      // ════════════════════════════════════════════════════════════════
      // REGRA 2: CONVERSA ATRIBUÍDA A MIM
      // Se a conversa foi atribuída a mim, mostrar
      // ════════════════════════════════════════════════════════════════
      if (thread.assigned_user_id === currentUserId) {
        return true;
      }

      // ════════════════════════════════════════════════════════════════
      // REGRA 3: CONVERSA ATRIBUÍDA A OUTRO = NÃO MOSTRAR
      // Se já está atribuída a outro atendente, não mostrar
      // ════════════════════════════════════════════════════════════════
      if (thread.assigned_user_id && thread.assigned_user_id !== currentUserId) {
        return false; // REGRA 2: Só aparece para outro se atribuída
      }

      // ════════════════════════════════════════════════════════════════
      // REGRA: CONTATO FIDELIZADO A OUTRO = NÃO MOSTRAR
      // Se está fidelizado a outro atendente, não mostrar
      // ════════════════════════════════════════════════════════════════
      let isFidelizadoAOutro = false;
      for (const campo of Object.values(camposAtendenteFidelizado)) {
        const valorCampo = contato?.[campo];
        if (valorCampo && valorCampo !== currentUserId && valorCampo !== currentUserFullName && valorCampo !== currentUserEmail) {
          isFidelizadoAOutro = true;
          break;
        }
      }
      // Verificar vendedor_responsavel também
      if (vendedorResp && vendedorResp !== currentUserId && vendedorResp !== currentUserFullName && vendedorResp !== currentUserEmail) {
        isFidelizadoAOutro = true;
      }

      if (isFidelizadoAOutro) {
        return false; // Fidelizado a outro = não mostrar
      }

      // ════════════════════════════════════════════════════════════════
      // REGRA 3: CONTATO ESCOLHEU OUTRO SETOR
      // Se o contato escolheu um setor diferente do meu, não mostrar
      // ════════════════════════════════════════════════════════════════
      const setorThread = thread.sector_id || 'geral';
      const meuSetor = currentUserSector || 'geral';

      // Se tenho setor específico e a thread tem setor específico diferente
      if (meuSetor !== 'geral' && setorThread !== 'geral' && setorThread !== meuSetor) {
        return false; // REGRA 3: Contato escolheu outro setor
      }

      // ════════════════════════════════════════════════════════════════
      // CONVERSA SEM ATRIBUIÇÃO + SEM FIDELIZAÇÃO + MEU SETOR = MOSTRAR
      // ════════════════════════════════════════════════════════════════
      
      // Verificar permissões de conexão WhatsApp
      const whatsappPerms = usuarioAtual?.whatsapp_permissions || [];
      if (whatsappPerms.length > 0 && thread.whatsapp_integration_id) {
        const permissao = whatsappPerms.find((p) => p.integration_id === thread.whatsapp_integration_id);
        if (!permissao || !permissao.can_view) return false;
      }

      // Passou por todas as verificações = mostrar
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

    console.log('🖱️ [ChatSidebar] Click na thread:', thread.id, thread.contato?.nome);

    // Validação antes de chamar onSelecionarThread
    if (!thread || !thread.id) {
      console.error('❌ [ChatSidebar] Thread inválida:', thread);
      return;
    }

    if (!thread.contact_id) {
      console.error('❌ [ChatSidebar] Thread sem contact_id:', thread);
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

  // Função para obter nome do atendente fidelizado do contato
  const getAtendenteFidelizado = (contato) => {
    if (!contato) return null;
    return contato.vendedor_responsavel || 
           contato.atendente_fidelizado_vendas || 
           contato.atendente_fidelizado_assistencia ||
           contato.atendente_fidelizado_financeiro ||
           contato.atendente_fidelizado_fornecedor;
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

      {threadsSorted.map((thread, index) => {
        const contato = thread.contato;
        const isAtiva = threadAtiva?.id === thread.id;
        const hasUnread = thread.unread_count > 0;
        const isAssignedToMe = thread.assigned_user_id === usuarioAtual?.id;
        const isUnassigned = !thread.assigned_user_id;

        if (!contato) {
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
            </motion.div>);

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

        return (
          <motion.div
            key={thread.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={(e) => handleClick(thread, e)} 
            className={`px-2 py-2 flex items-center gap-3 cursor-pointer transition-all border-b border-slate-100 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 ${thread.is_contact_only ? 'bg-slate-50/50' : ''} ${isSelected ? 'bg-orange-100 border-l-4 border-l-orange-500' : ''}`}
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
                {contato.foto_perfil_url ?
                <>
                    <img
                    src={contato.foto_perfil_url}
                    alt={nomeExibicao}
                    className="w-full h-full object-cover absolute inset-0"
                    onError={(e) => {e.target.style.display = 'none';}} />

                    <span className="relative z-10">{nomeExibicao.charAt(0).toUpperCase()}</span>
                  </> :

                nomeExibicao.charAt(0).toUpperCase()
                }
              </div>
            </div>

            <div className="flex-1 min-w-0">
              {/* Linha 1: Nome + Horário */}
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1 min-w-0 flex-1">
                    <h3 className={`font-semibold truncate text-sm ${hasUnread ? 'text-slate-900' : 'text-slate-700'}`}>
                      {nomeExibicao}
                    </h3>
                    {hasUnread &&
                  <Badge className="rounded-full min-w-[18px] h-4 flex items-center justify-center p-0 px-1 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white text-[10px] font-bold border-0 shadow-lg">
                        {thread.unread_count}
                      </Badge>
                  }
                  </div>
                <span className={`text-[10px] flex-shrink-0 ml-2 ${
                hasUnread ? 'text-orange-600 font-medium' : 'text-slate-400'}`
                }>
                  {formatarHorario(thread.last_message_at)}
                </span>
              </div>

              {/* Linha 2: Preview mensagem */}
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
                        const content = thread.last_message_content;
                        if (!content || content === '[No content]' || /^[\+\d]+@(lid|s\.whatsapp\.net|c\.us)/.test(content)) {
                          if (thread.last_media_type === 'image') return "📷 Imagem";
                          if (thread.last_media_type === 'video') return "🎥 Vídeo";
                          if (thread.last_media_type === 'audio') return "🎤 Áudio";
                          if (thread.last_media_type === 'document') return "📄 Documento";
                          if (thread.last_media_type === 'location') return "📍 Localização";
                          if (thread.last_media_type === 'contact') return "👤 Contato";
                          if (thread.last_media_type === 'sticker') return "🎨 Sticker";
                          return "📎 Mídia";
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
                
                {/* ATENDENTE ATUAL DA CONVERSA ou FIDELIZADO */}
                {thread.assigned_user_name ? (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white bg-indigo-500 shadow-sm" title={`Atendendo: ${thread.assigned_user_name}`}>
                    <UserCheck className="w-3 h-3" />
                    {thread.assigned_user_name.split(' ')[0]}
                  </span>
                ) : getAtendenteFidelizado(contato) ? (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-amber-700 bg-amber-100 shadow-sm" title={`Fidelizado: ${getAtendenteFidelizado(contato)}`}>
                    ⭐ {String(getAtendenteFidelizado(contato)).split(' ')[0]}
                  </span>
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
          </motion.div>);

      })}

    </div>
  );

}