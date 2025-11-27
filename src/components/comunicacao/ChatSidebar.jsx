import React, { useMemo } from "react";
import { CheckCheck, Clock, User, Users, AlertCircle, Image, Video, Mic, FileText, MapPin, Phone as PhoneIcon, Tag, Building2, Target, Truck, Handshake, HelpCircle } from "lucide-react";
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
import {
  SETORES_ATENDIMENTO,
  podeAtenderContato,
  verificarPermissaoUsuario } from
"./MotorRoteamentoAtendimento";

export default function ChatSidebar({ threads, threadAtiva, onSelecionarThread, loading, usuarioAtual, integracoes = [] }) {
  // Buscar categorias dinâmicas
  const { data: categoriasDB = [] } = useQuery({
    queryKey: ['categorias-mensagens'],
    queryFn: () => base44.entities.CategoriasMensagens.filter({ ativa: true }, 'nome'),
    staleTime: 5 * 60 * 1000
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔐 FILTRO INTELIGENTE: Tipo Contato + Conexão WhatsApp + Hierarquia Usuário
  // ═══════════════════════════════════════════════════════════════════════════════
  const threadsFiltradas = useMemo(() => {
    if (!threads || threads.length === 0) return [];

    return threads.filter((thread) => {
      const contato = thread.contato;

      // 1️⃣ Filtrar bloqueados
      if (contato && contato.bloqueado) return false;

      // 2️⃣ Admin vê tudo
      if (usuarioAtual?.role === 'admin') return true;

      // 3️⃣ Verificar permissões de conexão WhatsApp
      const whatsappPerms = usuarioAtual?.whatsapp_permissions || [];
      if (whatsappPerms.length > 0 && thread.whatsapp_integration_id) {
        const permissao = whatsappPerms.find((p) => p.integration_id === thread.whatsapp_integration_id);
        if (!permissao || !permissao.can_view) return false;
      }

      // 4️⃣ Verificar hierarquia Setor → Função → Nível
      const setorUsuario = usuarioAtual?.attendant_sector;
      const podeVerTodos = verificarPermissaoUsuario(usuarioAtual, 'ver_todos');

      // Se pode ver todos (gerente/coordenador/supervisor), passa
      if (podeVerTodos) return true;

      // 5️⃣ NOVA REGRA: Conversas não atribuídas são visíveis para todos com acesso à conexão
      //    - Usuário tem acesso à conexão (já verificado acima)
      //    - Contato NÃO é fidelizado (fidelizado = tem atendente fixo)
      const isNaoAtribuida = !thread.assigned_user_id;
      const isContatoNaoFidelizado = !contato?.is_cliente_fidelizado;

      // Conversas não atribuídas E de contatos não fidelizados são visíveis para TODOS
      // Ignora verificação de setor/tipo de contato para essas conversas
      if (isNaoAtribuida && isContatoNaoFidelizado) {
        return true;
      }

      // 6️⃣ Verificar setor da conversa vs setor do atendente (apenas para conversas atribuídas ou fidelizadas)
      const setorThread = thread.sector_id;
      if (setorThread && setorUsuario && setorThread !== setorUsuario && setorUsuario !== 'geral') {
        return false;
      }

      // 7️⃣ Verificar tipo de contato vs setor do atendente
      const tipoContato = contato?.tipo_contato || 'novo';
      const configSetor = SETORES_ATENDIMENTO.find((s) => s.value === setorUsuario);
      if (configSetor && !configSetor.tipos_contato_aceitos.includes(tipoContato)) {
        if (thread.assigned_user_id !== usuarioAtual?.id) {
          return false;
        }
      }

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

  const handleClick = (thread) => {
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

  return (
    <div>
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

        return (
          <motion.div
            key={thread.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => handleClick(thread)} className="px-2 py-2 flex items-center gap-3 cursor-pointer transition-all border-b border-slate-100 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50">




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

                {/* DESTAQUES (max 2) */}
                {contato?.tags && contato.tags.length > 0 && (() => {
                  const etiquetasDestaque = {
                    'vip': { emoji: '👑', label: 'VIP', bg: 'bg-yellow-500' },
                    'prioridade': { emoji: '⚡', label: 'Prior.', bg: 'bg-red-500' },
                    'fidelizado': { emoji: '💎', label: 'Fidel.', bg: 'bg-cyan-500' },
                    'potencial': { emoji: '🚀', label: 'Potenc.', bg: 'bg-violet-500' }
                  };
                  const ordem = ['vip', 'prioridade', 'fidelizado', 'potencial'];
                  const tagsOrdenadas = contato.tags
                    .filter(t => ordem.includes(t))
                    .sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b))
                    .slice(0, 2);

                  return tagsOrdenadas.map(etq => {
                    const cfg = etiquetasDestaque[etq];
                    return (
                      <span key={etq} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white ${cfg.bg} shadow-sm`}>
                        {cfg.emoji} {cfg.label}
                      </span>
                    );
                  });
                })()}

                {/* ATENDENTE */}
                {(thread.assigned_user_name || contato?.vendedor_responsavel) ? (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 truncate max-w-[70px]">
                    <Users className="w-2.5 h-2.5 text-blue-500 flex-shrink-0" />
                    {thread.assigned_user_name 
                      ? (isAssignedToMe ? 'Eu' : thread.assigned_user_name.split(' ')[0])
                      : contato?.vendedor_responsavel?.split(' ')[0]
                    }
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-500">
                    <AlertCircle className="w-2.5 h-2.5" />
                    S/atend.
                  </span>
                )}
              </div>
            </div>
          </motion.div>);

      })}
    </div>);

}