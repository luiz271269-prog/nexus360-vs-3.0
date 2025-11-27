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
  FILAS_ATENDIMENTO
} from "./CentralInteligenciaContato";
import { 
  SETORES_ATENDIMENTO,
  podeAtenderContato,
  verificarPermissaoUsuario
} from "./MotorRoteamentoAtendimento";

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

    return threads.filter(thread => {
      const contato = thread.contato;

      // 1️⃣ Filtrar bloqueados
      if (contato && contato.bloqueado) return false;

      // 2️⃣ Admin vê tudo
      if (usuarioAtual?.role === 'admin') return true;

      // 3️⃣ Verificar permissões de conexão WhatsApp
      const whatsappPerms = usuarioAtual?.whatsapp_permissions || [];
      if (whatsappPerms.length > 0 && thread.whatsapp_integration_id) {
        const permissao = whatsappPerms.find(p => p.integration_id === thread.whatsapp_integration_id);
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
      const configSetor = SETORES_ATENDIMENTO.find(s => s.value === setorUsuario);
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
        {Array(5).fill(0).map((_, i) => (
          <div key={i} className="animate-pulse flex gap-3 mb-4">
            <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-slate-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Função para buscar nome e número da integração
  const getIntegracaoInfo = (thread) => {
    if (!thread.whatsapp_integration_id || integracoes.length === 0) return null;
    const integracao = integracoes.find(i => i.id === thread.whatsapp_integration_id);
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
      </div>
    );
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
              className="flex items-center gap-3 p-4 cursor-pointer transition-all border-b border-slate-100 hover:bg-slate-50"
            >
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

        return (
          <motion.div
            key={thread.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => handleClick(thread)}
            className={`flex items-center gap-3 p-4 cursor-pointer transition-all border-b border-slate-100 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 ${
              isAtiva ? 'bg-gradient-to-r from-amber-50 via-orange-50 to-red-50 border-l-4 border-l-orange-500' : ''
            }`}
          >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className={`relative w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md overflow-hidden ${
                hasUnread 
                  ? 'bg-gradient-to-br from-amber-400 via-orange-500 to-red-500' 
                  : 'bg-gradient-to-br from-slate-400 to-slate-500'
              }`}>
                {contato.foto_perfil_url ? (
                  <>
                    <img 
                      src={contato.foto_perfil_url} 
                      alt={nomeExibicao}
                      className="w-full h-full object-cover absolute inset-0"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <span className="relative z-10">{nomeExibicao.charAt(0).toUpperCase()}</span>
                  </>
                ) : (
                  nomeExibicao.charAt(0).toUpperCase()
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1 min-w-0 flex-1">
                    <h3 className={`font-semibold truncate ${hasUnread ? 'text-slate-900' : 'text-slate-700'}`}>
                      {nomeExibicao}
                    </h3>
                    {hasUnread && (
                      <Badge className="rounded-full min-w-[20px] h-5 flex items-center justify-center p-0 px-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white text-xs font-bold border-0 shadow-lg">
                        {thread.unread_count}
                      </Badge>
                    )}
                  </div>
                <span className={`text-xs flex-shrink-0 ml-2 ${
                  hasUnread ? 'text-orange-600 font-medium' : 'text-slate-500'
                }`}>
                  {formatarHorario(thread.last_message_at)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <p className={`text-sm truncate flex-1 flex items-center gap-1.5 ${
                  hasUnread ? 'text-slate-900 font-medium' : 'text-slate-600'
                }`}>
                  {thread.last_message_sender === 'user' && (
                    <CheckCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  )}
                  {/* Ícone de mídia baseado no tipo */}
                  {thread.last_media_type === 'image' && <Image className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                  {thread.last_media_type === 'video' && <Video className="w-4 h-4 text-purple-500 flex-shrink-0" />}
                  {thread.last_media_type === 'audio' && <Mic className="w-4 h-4 text-green-500 flex-shrink-0" />}
                  {thread.last_media_type === 'document' && <FileText className="w-4 h-4 text-orange-500 flex-shrink-0" />}
                  {thread.last_media_type === 'location' && <MapPin className="w-4 h-4 text-red-500 flex-shrink-0" />}
                  {thread.last_media_type === 'contact' && <PhoneIcon className="w-4 h-4 text-cyan-500 flex-shrink-0" />}
                  <span className="truncate">
                    {(() => {
                      const content = thread.last_message_content;
                      // Ocultar JIDs e mensagens vazias
                      if (!content || content === '[No content]' || /^[\+\d]+@(lid|s\.whatsapp\.net|c\.us)/.test(content)) {
                        // Mostrar tipo de mídia específico
                        if (thread.last_media_type === 'image') return "📷 Imagem";
                        if (thread.last_media_type === 'video') return "🎥 Vídeo";
                        if (thread.last_media_type === 'audio') return "🎤 Áudio";
                        if (thread.last_media_type === 'document') return "📄 Documento";
                        if (thread.last_media_type === 'location') return "📍 Localização";
                        if (thread.last_media_type === 'contact') return "👤 Contato";
                        if (thread.last_media_type === 'sticker') return "🎨 Sticker";
                        return "📎 Mídia";
                      }
                      // Se tem mídia mas também tem conteúdo de texto
                      if (thread.last_media_type && thread.last_media_type !== 'none') {
                        return content;
                      }
                      return content;
                    })()}
                  </span>
                </p>


              </div>
              
              {/* Rodapé com ícones + descrição */}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs text-slate-500">
                {/* Tipo do Contato com descrição */}
                {(() => {
                  const tipoContato = contato?.tipo_contato || 'novo';
                  const tipo = TIPOS_CONTATO.find(t => t.value === tipoContato);
                  if (!tipo) return null;
                  return (
                    <span className="flex items-center gap-1" title={tipo.label}>
                      <Tag className="w-3 h-3" />
                      {tipo.label}
                    </span>
                  );
                })()}

                {/* Separador */}
                {contato?.vendedor_responsavel && <span className="text-slate-300">•</span>}

                {/* Vendedor Responsável */}
                {contato?.vendedor_responsavel && (
                  <span className="flex items-center gap-1" title="Vendedor Responsável">
                    <User className="w-3 h-3" />
                    {contato.vendedor_responsavel}
                  </span>
                )}

                {/* Separador */}
                {thread.assigned_user_name && <span className="text-slate-300">•</span>}

                {/* Atribuição */}
                {thread.assigned_user_name && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-blue-500" />
                    {isAssignedToMe ? 'Minha' : thread.assigned_user_name}
                  </span>
                )}
                {isUnassigned && (
                  <span className="flex items-center gap-1 text-red-500 font-medium">
                    <AlertCircle className="w-3 h-3" />
                    Não Atribuída
                  </span>
                )}

                {/* Etiquetas especiais */}
                {contato?.tags && contato.tags.length > 0 && (
                  contato.tags.filter(t => ['vip', 'prioridade', 'fidelizado'].includes(t)).slice(0, 2).map(etq => {
                    const config = getEtiquetaConfig(etq);
                    return (
                      <Badge key={etq} variant="outline" className="text-xs py-0 px-1.5 h-4">
                        {config.emoji} {config.label}
                      </Badge>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}