import React from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import IntegrationStatusBanner from './IntegrationStatusBanner';
import {
  Send,
  Paperclip,
  Info,
  MessageSquare,
  Loader2,
  AlertCircle,
  Users,
  Mic,
  StopCircle,
  X,
  Sparkles,
  UserPlus,
  Image as ImageIcon,
  FileText,
  Video,
  Tag,
  User,
  Briefcase,
  Flame,
  TrendingUp,
  CheckSquare,
  Bug,
  ChevronLeft } from
"lucide-react";

// Logos SVG inline para cada canal
const WhatsAppLogo = () =>
<svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>;


const InstagramLogo = () =>
<svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" />
  </svg>;


const FacebookLogo = () =>
<svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>;


const GoToLogo = () =>
<svg viewBox="0 0 120 40" className="h-4" fill="currentColor">
    <rect x="0" y="28" width="40" height="8" fill="#FFD700" />
    <text x="5" y="22" fontFamily="Arial, sans-serif" fontSize="20" fontWeight="bold">GoTo</text>
  </svg>;

import MessageBubble from "./MessageBubble";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

import AIResponseAssistant from './AIResponseAssistant';
import BroadcastRecipientsList from './BroadcastRecipientsList';
import ChatSuggestions from './ChatSuggestions';
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import MediaAttachmentSystem from './MediaAttachmentSystem';
import CategorizadorRapido from './CategorizadorRapido';
import AtribuirConversaModal from './AtribuirConversaModal';
import CentralInteligenciaContato, {
  calcularScoreContato,
  getNivelTemperatura,
  getProximaAcaoSugerida,
  TIPOS_CONTATO } from
'./CentralInteligenciaContato';
import MessageInput from './MessageInput';
import AlertaPedidoTransferencia from './AlertaPedidoTransferencia';
import useScrollPaginacao from './useScrollPaginacao';
import NexusBrainSuggestions from './NexusBrainSuggestions';
import { useAudioRecorder } from './useAudioRecorder';
import FloatingConversationBubble from './FloatingConversationBubble';

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 GETTER UNIFICADO: Contagem de não lidas (externo + interno)
// ═══════════════════════════════════════════════════════════════════════════════
const getUnreadCount = (thread, userId) => {
  if (!thread) return 0;

  if (thread.thread_type === 'contact_external') {
    return thread.unread_count || 0;
  }

  if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
    return thread.unread_by?.[userId] || 0;
  }

  return 0;
};

export default function ChatWindow({
  thread = null,
  mensagens = [],
  usuario = null,
  contatoPreCarregado = null,
  onEnviarMensagem,
  onSendMessageOptimistic,
  onSendInternalMessageOptimistic,
  onShowContactInfo,
  onAtualizarMensagens,
  integracoes = [],
  selectedCategoria = 'all',
  modoSelecaoMultipla = false,
  contatosSelecionados = [],
  broadcastInterno = null,
  onCancelarSelecao,
  atendentes = [],
  allThreads = [],
  filterScope = 'all',
  selectedIntegrationId = 'all',
  selectedAttendantId = null,
  contatoAtivo = null,
  onFecharChat = null
}) {
  const queryClient = useQueryClient(); // ✅ CRÍTICO: Hook do React Query

  // ✅ ESTADOS REMOVIDOS DO PAI - Agora no MessageInput
  // mensagemTexto, pastedImage, pastedImagePreview, inputRef

  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState(null);
  const [contatoCompleto, setContatoCompleto] = React.useState(null);
  const [carregandoContato, setCarregandoContato] = React.useState(true);
  const [mostrarModalAtribuicao, setMostrarModalAtribuicao] = React.useState(false);
  const [mostrarModalCompartilhamento, setMostrarModalCompartilhamento] = React.useState(false);

  const [mensagemResposta, setMensagemResposta] = React.useState(null);
  const [modoSelecao, setModoSelecao] = React.useState(false);
  const [mensagensSelecionadas, setMensagensSelecionadas] = React.useState([]);

  const { gravando: gravandoAudio, iniciarGravacao: iniciarGravacaoBase, pararGravacao: pararGravacaoBase, audioBlob: audioBlobGravado } = useAudioRecorder();
  const [uploadingPastedFile, setUploadingPastedFile] = React.useState(false);
  const [mostrarSugestor, setMostrarSugestor] = React.useState(false);
  const [ultimaMensagemCliente, setUltimaMensagemCliente] = React.useState(null);
  const [mostrarReativacaoRapida, setMostrarReativacaoRapida] = React.useState(false);
  const [analiseComportamental, setAnaliseComportamental] = React.useState(null);
  const [canalSelecionado, setCanalSelecionado] = React.useState(null);
  const [mostrarMediaSystem, setMostrarMediaSystem] = React.useState(false);
  const [enviandoBroadcast, setEnviandoBroadcast] = React.useState(false);
  const [progressoBroadcast, setProgressoBroadcast] = React.useState({ enviados: 0, erros: 0, total: 0 });
  const messagesEndRef = React.useRef(null);
  const unreadSeparatorRef = React.useRef(null);
  const fotoJaBuscada = React.useRef(new Set());

  // ✅ Hook de scroll pagination com AbortController + validação de usuário
  const { chatContainerRef, loadingOlder, isHistoryStart, initTimestamp, permissionError } = useScrollPaginacao({
    thread,
    queryClient,
    allThreads,
    usuario
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ✅ NEXUS360 MIGRATION - VALIDAÇÃO DUPLA (Nexus360 + Legado Fallback)
  // ═══════════════════════════════════════════════════════════════════════
  const permNexus = usuario?.permissoes_acoes_nexus || {};
  const permLegado = usuario?.permissoes_comunicacao || {};

  // ✅ LÓGICA DE PERMISSÃO PARA THREADS EXTERNAS (WhatsApp/contact_external):
  // Qualquer usuário autenticado com permissão geral de envio pode enviar,
  // independente de a thread estar atribuída a outro usuário.
  // A atribuição é apenas para organização/responsabilidade, não bloqueio de envio.
  //
  // Para threads INTERNAS (team_internal/sector_group):
  // Apenas participantes e admins podem interagir.
  const podeInteragirNaThread = React.useMemo(() => {
    if (!usuario || !thread) return false;

    // Admin sempre pode
    if (usuario.role === 'admin') return true;

    const isThreadInterna = thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group';

    // Threads internas: verificar participação
    if (isThreadInterna) {
      const isParticipante = thread.participants?.includes(usuario.id);
      return !!isParticipante;
    }

    // ✅ Threads externas (WhatsApp/contact_external):
    // SEMPRE liberado para qualquer usuário com permissão geral de envio.
    // Obs: bloqueios por instância WhatsApp são verificados separadamente via podeEnviarPorInstancia.
    return true;
  }, [usuario, thread]);

  // ✅ FILTRAR INTEGRAÇÕES BASEADO NAS PERMISSÕES DO USUÁRIO
  const integracoesPermitidas = React.useMemo(() => {
    if (!usuario) return integracoes;
    if (usuario.role === 'admin') return integracoes;

    const whatsappPerms = usuario.whatsapp_permissions || [];

    // Se não tem permissões configuradas, mostrar todas
    if (whatsappPerms.length === 0) return integracoes;

    // Filtrar apenas integrações com permissão de enviar
    return integracoes.filter((int) => {
      const perm = whatsappPerms.find((p) => p.integration_id === int.id);
      return perm && perm.can_send === true;
    });
  }, [integracoes, usuario]);

  // ✅ VERIFICAR PERMISSÕES ESPECÍFICAS DA INSTÂNCIA
  const getPermissaoInstancia = (permissionKey) => {
    if (!thread?.whatsapp_integration_id || !usuario) return true;
    if (usuario.role === 'admin') return true;

    const whatsappPerms = usuario.whatsapp_permissions || [];
    if (whatsappPerms.length === 0) return true;

    const perm = whatsappPerms.find((p) => p.integration_id === thread.whatsapp_integration_id);
    
    // ✅ CRÍTICO: Se não há permissão configurada para esta instância, LIBERAR por padrão
    if (!perm) return true;
    
    return perm[permissionKey] ?? true;
  };

  const podeEnviarPorInstancia = getPermissaoInstancia('can_send');

  // 🔐 Construir userPermissions para o banner de status
  const userPermissions = React.useMemo(() => {
    if (!usuario) return null;
    
    const whatsappPerms = usuario.whatsapp_permissions || [];
    const integracoesMap = {};
    
    integracoes.forEach(integracao => {
      const perm = whatsappPerms.find(p => p.integration_id === integracao.id);
      integracoesMap[integracao.id] = {
        can_view: perm?.can_view ?? true,
        can_send: perm?.can_send ?? true,
        integration_name: integracao.nome_instancia
      };
    });
    
    return { integracoes: integracoesMap };
  }, [usuario, integracoes]);

  // ✅ NEXUS360: Prioriza novo sistema, fallback para legado, default liberado
  const temPermissaoGeralEnvio = permNexus.podeEnviarMensagens ?? permLegado.pode_enviar_mensagens ?? true;
  const temPermissaoGeralMidia = permNexus.podeEnviarMidias ?? permLegado.pode_enviar_midias ?? true;
  const temPermissaoGeralAudio = permNexus.podeEnviarAudios ?? permLegado.pode_enviar_audios ?? true;

  // Determina se está em modo de broadcast interno
  const isBroadcastInternoAtivo = !!broadcastInterno;

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔥 REGRA CRÍTICA: ATRIBUIÇÃO/TRANSFERÊNCIA É CHAVE MESTRA
  // Se thread está atribuída/transferida ao usuário, IGNORA bloqueios de instância
  // ═══════════════════════════════════════════════════════════════════════════════
  const norm = (v) => String(v || '').toLowerCase().trim();
  const isAtribuidaOuTransferida = 
    norm(thread?.assigned_user_id) === norm(usuario?.id) ||
    norm(thread?.transfer_requested_user_id) === norm(usuario?.id);

  // ✅ Threads internas NUNCA devem ser bloqueadas por permissões de instância WhatsApp
  const isThreadInterna = thread?.thread_type === 'team_internal' || thread?.thread_type === 'sector_group';

  // Lógica de permissão: Atribuição/Transferência OVERRIDE permissões de instância
  // ✅ MODO BROADCAST/MASSA: Se está em seleção múltipla, libera com permissão geral
  const podeEnviarMensagens = isBroadcastInternoAtivo 
    ? temPermissaoGeralEnvio 
    : modoSelecaoMultipla 
    ? temPermissaoGeralEnvio
    : isThreadInterna
    ? temPermissaoGeralEnvio  // Internas: apenas permissão geral, sem checar instância
    : (isAtribuidaOuTransferida && temPermissaoGeralEnvio) || (podeInteragirNaThread && temPermissaoGeralEnvio && podeEnviarPorInstancia);
    
  const podeEnviarMidias = isBroadcastInternoAtivo 
    ? temPermissaoGeralMidia 
    : modoSelecaoMultipla
    ? temPermissaoGeralMidia
    : isThreadInterna
    ? temPermissaoGeralMidia
    : (isAtribuidaOuTransferida && temPermissaoGeralMidia) || (podeInteragirNaThread && temPermissaoGeralMidia && podeEnviarPorInstancia);
    
  const podeEnviarAudios = isBroadcastInternoAtivo 
    ? temPermissaoGeralAudio 
    : modoSelecaoMultipla
    ? temPermissaoGeralAudio
    : isThreadInterna
    ? temPermissaoGeralAudio
    : (isAtribuidaOuTransferida && temPermissaoGeralAudio) || (podeInteragirNaThread && temPermissaoGeralAudio && podeEnviarPorInstancia);
    
  const podeApagarMensagens = permNexus.podeApagarMensagens ?? permLegado.pode_apagar_mensagens ?? false;
  const podeTransferirConversas = permNexus.podeTransferirConversa ?? true;

  const navigate = useNavigate();

  React.useEffect(() => {
    let isMounted = true;

    const carregarContato = async () => {
      // ✅ Threads internas não têm contact_id - marcar como carregado direto
      if (thread?.thread_type === 'team_internal' || thread?.thread_type === 'sector_group') {
        setContatoCompleto(null);
        setCarregandoContato(false);
        return;
      }

      if (!thread?.contact_id) {
        setContatoCompleto(null);
        setCarregandoContato(false);
        return;
      }

      // ✅ PRIORIDADE 1: Usar contato pré-carregado se disponível
      if (contatoPreCarregado && contatoPreCarregado.id === thread.contact_id) {
        console.log('[CHAT] ⚡ Usando contato pré-carregado (lista de priorização)');
        setContatoCompleto(contatoPreCarregado);
        setCarregandoContato(false);
        return;
      }

      setCarregandoContato(true);

      try {
        const contato = await base44.entities.Contact.get(thread.contact_id);
        if (!isMounted) return;

        setContatoCompleto(contato);
        setCarregandoContato(false);

        // ✅ AUTO-ENRIQUECIMENTO IMEDIATO: Contatos vazios buscam dados do WhatsApp
        const nome = (contato.nome || '').trim();
        const telefone = (contato.telefone || '').replace(/\D/g, '');
        const estaVazio = (
          (!nome || nome === contato.telefone || nome === '+' + telefone) &&
          !contato.empresa &&
          !contato.cargo
        );

        const isContatoReal = contato.telefone &&
          !/^[\+\d\s]+@(lid|broadcast|s\.whatsapp\.net|c\.us)/i.test(contato.telefone);

        if (estaVazio && isContatoReal && thread.whatsapp_integration_id) {
          console.log('[CHAT] 🔍 Contato vazio detectado - enriquecendo IMEDIATAMENTE...');

          // ✅ EXECUÇÃO IMEDIATA (sem setTimeout) após identificação
          (async () => {
            if (!isMounted) return;

            try {
              const resultado = await base44.functions.invoke('enriquecerContatoVazio', {
                contact_id: contato.id,
                integration_id: thread.whatsapp_integration_id
              });

              if (!isMounted) return;

              if (resultado?.data?.updated && resultado?.data?.contact) {
                console.log('[CHAT] ✅ Contato enriquecido:', resultado.data.dados_atualizados);
                setContatoCompleto(resultado.data.contact);

                // ✅ SINCRONIZAÇÃO CRÍTICA: Invalidar todas as queries de contatos
                // para atualizar sidebar com dados novos (nome/foto do WhatsApp)
                queryClient.invalidateQueries({ queryKey: ['contacts'] });
                queryClient.invalidateQueries({ queryKey: ['contacts-search'] });
                queryClient.invalidateQueries({ queryKey: ['threads'] }); // Rehidratar thread.contato

                toast.success('✅ Contato atualizado com dados do WhatsApp', { duration: 2000 });
              }
            } catch (error) {
              console.warn('[CHAT] ⚠️ Erro ao enriquecer contato:', error.message);
            }
          })();
        } else if (isContatoReal && thread.whatsapp_integration_id) {
          // Buscar foto se desatualizada (lógica existente para contatos completos)
          const deveBuscarFoto = !contato.foto_perfil_url ||
            !contato.foto_perfil_atualizada_em ||
            new Date() - new Date(contato.foto_perfil_atualizada_em) > 24 * 60 * 60 * 1000;

          const chaveCache = `${contato.id}-${thread.whatsapp_integration_id}`;

          if (deveBuscarFoto && !fotoJaBuscada.current.has(chaveCache)) {
            fotoJaBuscada.current.add(chaveCache);

            setTimeout(async () => {
              if (!isMounted) return;

              try {
                const resultadoFoto = await base44.functions.invoke('buscarFotoPerfilWhatsApp', {
                  integration_id: thread.whatsapp_integration_id,
                  phone: contato.telefone
                }).catch(() => null);

                if (!isMounted) return;

                if (resultadoFoto?.data?.success && resultadoFoto?.data?.profilePictureUrl) {
                  await base44.entities.Contact.update(contato.id, {
                    foto_perfil_url: resultadoFoto.data.profilePictureUrl,
                    foto_perfil_atualizada_em: new Date().toISOString()
                  });
                  
                  setContatoCompleto((prev) => 
                    prev?.id === contato.id ? {
                      ...prev,
                      foto_perfil_url: resultadoFoto.data.profilePictureUrl,
                      foto_perfil_atualizada_em: new Date().toISOString()
                    } : prev
                  );
                }
              } catch (error) {
                console.warn('[CHAT] Erro ao buscar foto:', error.message);
              }
            }, 1000);
          }
        }
      } catch (error) {
        if (!isMounted) return;

        console.error('Erro ao carregar contato:', error);
        setContatoCompleto(null);
        setCarregandoContato(false);

        if (!error.message?.includes('Rate limit') && !error.message?.includes('429')) {
          toast.error('Erro ao carregar contato');
        }
      }
    };

    carregarContato();

    return () => {
      isMounted = false;
    };
  }, [thread?.contact_id, thread?.whatsapp_integration_id, contatoPreCarregado]);

  // Inicializar canal selecionado com o da thread
  React.useEffect(() => {
    if (thread?.whatsapp_integration_id && integracoes.length > 0) {
      const integracaoAtual = integracoes.find((i) => i.id === thread.whatsapp_integration_id);
      if (integracaoAtual) {
        setCanalSelecionado(integracaoAtual.id);
      }
    }
  }, [thread?.whatsapp_integration_id, integracoes]);

  // ✅ REMOVIDO: handleAtribuirConversa - usa AtribuirConversaModal

  const autoAtribuirThreadSeNecessario = React.useCallback(async (threadAtual) => {
    if (!threadAtual || !usuario) return false;
    if (threadAtual.assigned_user_id || threadAtual.assigned_user_email) return false;
    try {
      await base44.entities.MessageThread.update(threadAtual.id, { assigned_user_id: usuario.id, status: 'aberta' });
      await base44.entities.AutomationLog.create({ acao: 'auto_atribuicao_resposta', contato_id: threadAtual.contact_id, thread_id: threadAtual.id, usuario_id: usuario.id, resultado: 'sucesso', timestamp: new Date().toISOString(), detalhes: { mensagem: 'Conversa auto-atribuída ao responder', atendente: usuario.full_name || usuario.email, trigger: 'primeira_resposta' }, origem: 'sistema', prioridade: 'normal' });
      return true;
    } catch (e) { console.warn('[CHAT] Auto-atribuição falhou:', e.message); return false; }
  }, [usuario]);

  const handleEnviarBroadcast = React.useCallback(async ({ texto = '', mediaUrl = null, mediaType = null, mediaCaption = null, isAudio = false } = {}) => {
    if (!podeEnviarMensagens) { toast.error("❌ Sem permissão para enviar mensagens"); return; }
    if (!texto.trim() && !mediaUrl) { toast.error("Digite uma mensagem ou anexe uma mídia"); return; }
    if (broadcastInterno?.destinations) {
      setEnviandoBroadcast(true);
      setProgressoBroadcast({ enviados: 0, erros: 0, total: broadcastInterno.destinations.length });
      let enviados = 0, erros = 0;
      for (const dest of broadcastInterno.destinations) {
        try {
          if (!dest.thread_id || !usuario?.id) { erros++; continue; }
          await base44.functions.invoke('sendInternalMessage', { thread_id: dest.thread_id, content: texto.trim() || (mediaUrl ? `[${mediaType}]` : ''), media_type: mediaType || 'none', media_url: mediaUrl, media_caption: mediaCaption });
          enviados++;
        } catch (_) { erros++; }
        setProgressoBroadcast({ enviados, erros, total: broadcastInterno.destinations.length });
        await new Promise(r => setTimeout(r, 300));
      }
      setEnviandoBroadcast(false);
      if (enviados > 0) toast.success(`✅ ${enviados} mensagem(ns) interna(s) enviada(s)!`);
      if (erros > 0) toast.error(`❌ ${erros} erro(s) no envio interno`);
      if (onCancelarSelecao) onCancelarSelecao();
      if (onAtualizarMensagens) onAtualizarMensagens();
      return;
    }
    if (contatosSelecionados.length === 0) { toast.error("Nenhum contato selecionado"); return; }
    setEnviandoBroadcast(true);
    setProgressoBroadcast({ enviados: 0, erros: 0, total: contatosSelecionados.length });
    try {
      let mensagemFinal = texto.trim();
      const nomeAtendente = usuario?.display_name || usuario?.full_name;
      if (nomeAtendente && usuario?.attendant_sector) mensagemFinal = `${mensagemFinal}\n\n_~ ${nomeAtendente.split(' ')[0]} (${usuario.attendant_sector})_`;
      const resultado = await base44.functions.invoke('enviarCampanhaLote', { contact_ids: contatosSelecionados.map(c => c.contact_id || c.id), modo: 'broadcast', mensagem: mensagemFinal, personalizar: false });
      setEnviandoBroadcast(false);
      if (resultado.data?.success) {
        const { enviados, erros } = resultado.data;
        if (enviados > 0) toast.success(`✅ ${enviados} mensagem(ns) enviada(s)!`);
        if (erros > 0) toast.warning(`⚠️ ${erros} contato(s) com erro`);
        setProgressoBroadcast({ enviados, erros, total: contatosSelecionados.length });
        queryClient.invalidateQueries({ queryKey: ['threads-externas'] });
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
      } else throw new Error(resultado.data?.error || 'Erro no envio em massa');
    } catch (error) {
      toast.error(`❌ Erro: ${error.message}`);
      setEnviandoBroadcast(false);
    }
    if (onCancelarSelecao) onCancelarSelecao();
    if (onAtualizarMensagens) onAtualizarMensagens();
  }, [podeEnviarMensagens, contatosSelecionados, broadcastInterno, usuario, onCancelarSelecao, onAtualizarMensagens, queryClient]);

  const enviarAudio = React.useCallback(async (audioBlob) => {
    if (!podeEnviarAudios) { toast.error("❌ Sem permissão para enviar áudios"); return; }
    setEnviando(true); setErro(null);
    try {
      if (thread?.thread_type === 'team_internal' || thread?.thread_type === 'sector_group') {
        if (onSendInternalMessageOptimistic) { onSendInternalMessageOptimistic({ audioBlob, replyToMessage: mensagemResposta }); setMensagemResposta(null); }
        else toast.error("Handler de envio interno não configurado");
        setEnviando(false); return;
      }
      const timestamp = new Date().getTime();
      const audioFile = new File([audioBlob], `audio-${timestamp}.ogg`, { type: 'audio/ogg; codecs=opus', lastModified: timestamp });
      toast.info('📤 Fazendo upload do áudio...');
      const { file_url: audioUrl } = await base44.integrations.Core.UploadFile({ file: audioFile });
      if (modoSelecaoMultipla && contatosSelecionados.length > 0) {
        await handleEnviarBroadcast({ mediaUrl: audioUrl, mediaType: 'audio', isAudio: true });
        setEnviando(false); return;
      }
      if (!thread || !usuario || carregandoContato || !contatoCompleto) { toast.error('Dados da conversa não disponíveis.'); setEnviando(false); return; }
      const telefone = contatoCompleto.telefone || contatoCompleto.celular;
      if (!telefone) { toast.error('Contato sem telefone.'); setEnviando(false); return; }
      const integrationIdParaUso = canalSelecionado || thread.whatsapp_integration_id;
      await autoAtribuirThreadSeNecessario(thread);
      const dadosEnvio = { integration_id: integrationIdParaUso, numero_destino: telefone, audio_url: audioUrl, media_type: 'audio' };
      if (mensagemResposta?.whatsapp_message_id) dadosEnvio.reply_to_message_id = mensagemResposta.whatsapp_message_id;
      const resultado = await base44.functions.invoke('enviarWhatsApp', dadosEnvio);
      if (resultado.data.success) {
        await base44.entities.Message.create({ thread_id: thread.id, sender_id: usuario.id, sender_type: "user", recipient_id: thread.contact_id, recipient_type: "contact", content: "[Áudio]", channel: "whatsapp", status: "enviada", whatsapp_message_id: resultado.data.message_id, sent_at: new Date().toISOString(), media_url: audioUrl, media_type: 'audio', reply_to_message_id: mensagemResposta?.id || null, metadata: { whatsapp_integration_id: integrationIdParaUso } });
        await base44.entities.MessageThread.update(thread.id, { last_message_content: "[Áudio]", last_message_at: new Date().toISOString(), last_message_sender: "user", last_human_message_at: new Date().toISOString(), whatsapp_integration_id: integrationIdParaUso, pre_atendimento_ativo: false });
        toast.success("✅ Áudio enviado!"); setMensagemResposta(null);
        if (onAtualizarMensagens) onAtualizarMensagens();
      } else throw new Error(resultado.data.error || 'Erro ao enviar áudio');
    } catch (error) { setErro(error.message); toast.error(error.message); } finally { setEnviando(false); }
  }, [podeEnviarAudios, modoSelecaoMultipla, contatosSelecionados, handleEnviarBroadcast, thread, usuario, carregandoContato, contatoCompleto, canalSelecionado, mensagemResposta, onAtualizarMensagens, autoAtribuirThreadSeNecessario, onSendInternalMessageOptimistic]);

  const iniciarGravacaoAudio = React.useCallback(async () => {
    if (!podeEnviarAudios) {
      toast.error("❌ Você não tem permissão para enviar áudios");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });

        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop());
          audioStreamRef.current = null;
        }

        if (audioBlob.size > 0) {
          await enviarAudio(audioBlob);
        } else {
          toast.error("❌ Gravação de áudio vazia.");
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setGravandoAudio(true);
      toast.info("🎤 Gravando áudio...", { duration: 999999 });
    } catch (error) {
      console.error('[CHAT] Erro ao acessar microfone:', error);
      toast.error("❌ Erro ao acessar microfone. Verifique as permissões.");
    }
  }, [podeEnviarAudios, enviarAudio]);

  const pararGravacaoAudio = React.useCallback(() => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setGravandoAudio(false);
      toast.dismiss();
    }
  }, [mediaRecorder]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 🖼️ ENVIAR IMAGEM COLADA - Declarada ANTES de handleEnviarFromInput
  // ═══════════════════════════════════════════════════════════════════════════
  const enviarImagemColada = React.useCallback(async (imagemFile, previewUrl, legendaTexto = '') => {
    if (!imagemFile || !podeEnviarMidias) {
      toast.error('Não foi possível enviar a imagem');
      return;
    }

    if (modoSelecaoMultipla && contatosSelecionados.length > 0) {
      setUploadingPastedFile(true);
      try {
        const timestamp = Date.now();
        let mimeType = imagemFile.type || 'image/png';
        if (!mimeType.startsWith('image/')) mimeType = 'image/png';
        const ext = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png';

        const imageFile = new File([imagemFile], `broadcast-${timestamp}.${ext}`, {
          type: mimeType,
          lastModified: timestamp
        });

        toast.info('📤 Fazendo upload da imagem...');
        const uploadResponse = await base44.integrations.Core.UploadFile({ file: imageFile });
        const imageUrl = uploadResponse.file_url;

        toast.info('📤 Enviando para os contatos selecionados...');

        await handleEnviarBroadcast({
          texto: legendaTexto,
          mediaUrl: imageUrl,
          mediaType: 'image',
          mediaCaption: legendaTexto.trim() || null
        });

      } catch (error) {
        console.error('[BROADCAST] Erro ao enviar imagem:', error);
        toast.error('Erro ao enviar imagem: ' + error.message);
      } finally {
        setUploadingPastedFile(false);
      }
      return;
    }

    if (!thread || !usuario) {
      toast.error('Dados da conversa não disponíveis');
      return;
    }

    const contatoTel = contatoCompleto?.telefone || contatoCompleto?.celular;
    if (!contatoTel) {
      toast.error('Contato sem telefone cadastrado.');
      return;
    }

    const integrationIdParaUso = canalSelecionado || thread.whatsapp_integration_id;
    if (!integrationIdParaUso) {
      toast.error('Thread sem integração WhatsApp configurada.');
      return;
    }

    await autoAtribuirThreadSeNecessario(thread);

    const imagemParaEnviar = imagemFile;
    const legendaImagem = legendaTexto.trim() || null;
    const respostaParaMensagem = mensagemResposta;

    setMensagemResposta(null);
    setUploadingPastedFile(true);
    setErro(null);

    let novaMensagem;
    try {
      novaMensagem = await base44.entities.Message.create({
        thread_id: thread.id,
        sender_id: usuario.id,
        sender_type: 'user',
        recipient_id: thread.contact_id,
        recipient_type: 'contact',
        content: legendaImagem || '[Imagem]',
        channel: 'whatsapp',
        status: 'enviando',
        sent_at: new Date().toISOString(),
        media_url: previewUrl,
        media_type: 'image',
        media_caption: legendaImagem,
        reply_to_message_id: respostaParaMensagem?.id || null,
        metadata: {
          whatsapp_integration_id: integrationIdParaUso,
          is_pasted_image: true,
          local_preview: true
        }
      });

      if (onAtualizarMensagens) {
        onAtualizarMensagens();
      }
    } catch (createError) {
      console.error('[CHAT] Erro ao criar mensagem:', createError);
      toast.error('Erro ao preparar envio.');
      setUploadingPastedFile(false);
      return;
    }

    (async () => {
      try {
        const timestamp = Date.now();
        let mimeType = imagemParaEnviar.type || 'image/png';
        if (!mimeType.startsWith('image/')) mimeType = 'image/png';
        const ext = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png';

        const imageFile = new File([imagemParaEnviar], `print-${timestamp}.${ext}`, {
          type: mimeType,
          lastModified: timestamp
        });

        const uploadResponse = await base44.integrations.Core.UploadFile({ file: imageFile });
        const imageUrl = uploadResponse.file_url;

        const dadosEnvio = {
          integration_id: integrationIdParaUso,
          numero_destino: contatoTel,
          media_url: imageUrl,
          media_type: 'image',
          media_caption: legendaImagem
        };
        if (respostaParaMensagem?.whatsapp_message_id) {
          dadosEnvio.reply_to_message_id = respostaParaMensagem.whatsapp_message_id;
        }

        const resultado = await base44.functions.invoke('enviarWhatsApp', dadosEnvio);

        if (resultado.data.success) {
          await base44.entities.Message.update(novaMensagem.id, {
            status: 'enviada',
            whatsapp_message_id: resultado.data.message_id,
            media_url: imageUrl
          });

          await base44.entities.MessageThread.update(thread.id, {
            last_message_content: '[Imagem]',
            last_message_at: new Date().toISOString(),
            last_message_sender: 'user',
            last_human_message_at: new Date().toISOString(),
            last_media_type: 'image',
            pre_atendimento_ativo: false
          });
        } else {
          await base44.entities.Message.update(novaMensagem.id, {
            status: 'falhou',
            erro_detalhes: resultado.data.error || 'Erro'
          });
          toast.error('Falha ao enviar imagem');
        }
      } catch (error) {
        console.error('[CHAT] Erro envio print:', error);
        await base44.entities.Message.update(novaMensagem.id, {
          status: 'falhou',
          erro_detalhes: error.message
        });
        toast.error('Erro ao enviar imagem');
      } finally {
        setUploadingPastedFile(false);
        if (onAtualizarMensagens) {
          setTimeout(() => onAtualizarMensagens(), 300);
        }
      }
    })();
  }, [podeEnviarMidias, modoSelecaoMultipla, contatosSelecionados, broadcastInterno, handleEnviarBroadcast, thread, usuario, contatoCompleto, canalSelecionado, mensagemResposta, onAtualizarMensagens, autoAtribuirThreadSeNecessario]);

  // 📎 ENVIAR ARQUIVO ANEXADO (imagem, vídeo, documento)
  const enviarArquivoAnexado = React.useCallback(async (file, fileType, legendaTexto = '') => {
    if (!file || !podeEnviarMidias) {
      toast.error('Não foi possível enviar o arquivo');
      return;
    }

    if (modoSelecaoMultipla && contatosSelecionados.length > 0) {
      setUploadingPastedFile(true);
      try {
        const timestamp = Date.now();
        const ext = file.name.split('.').pop() || 'file';
        const uploadFile = new File([file], `broadcast-${timestamp}.${ext}`, {
          type: file.type,
          lastModified: timestamp
        });

        toast.info('📤 Fazendo upload do arquivo...');
        const uploadResponse = await base44.integrations.Core.UploadFile({ file: uploadFile });
        const fileUrl = uploadResponse.file_url;

        toast.info('📤 Enviando para os contatos selecionados...');

        await handleEnviarBroadcast({
          texto: legendaTexto,
          mediaUrl: fileUrl,
          mediaType: fileType,
          mediaCaption: legendaTexto.trim() || null
        });

      } catch (error) {
        console.error('[BROADCAST] Erro ao enviar arquivo:', error);
        toast.error('Erro ao enviar arquivo: ' + error.message);
      } finally {
        setUploadingPastedFile(false);
      }
      return;
    }

    if (!thread || !usuario) {
      toast.error('Dados da conversa não disponíveis');
      return;
    }

    const contatoTel = contatoCompleto?.telefone || contatoCompleto?.celular;
    if (!contatoTel) {
      toast.error('Contato sem telefone cadastrado.');
      return;
    }

    const integrationIdParaUso = canalSelecionado || thread.whatsapp_integration_id;
    if (!integrationIdParaUso) {
      toast.error('Thread sem integração WhatsApp configurada.');
      return;
    }

    await autoAtribuirThreadSeNecessario(thread);

    const respostaParaMensagem = mensagemResposta;
    setMensagemResposta(null);
    setUploadingPastedFile(true);
    setErro(null);

    const contentPreview = fileType === 'image' ? '[Imagem]' :
    fileType === 'video' ? '[Vídeo]' :
    fileType === 'document' ? '[Documento]' : '[Arquivo]';

    let novaMensagem;
    try {
      novaMensagem = await base44.entities.Message.create({
        thread_id: thread.id,
        sender_id: usuario.id,
        sender_type: 'user',
        recipient_id: thread.contact_id,
        recipient_type: 'contact',
        content: legendaTexto || contentPreview,
        channel: 'whatsapp',
        status: 'enviando',
        sent_at: new Date().toISOString(),
        media_type: fileType,
        media_caption: legendaTexto,
        reply_to_message_id: respostaParaMensagem?.id || null,
        metadata: {
          whatsapp_integration_id: integrationIdParaUso,
          local_preview: true
        }
      });

      if (onAtualizarMensagens) {
        onAtualizarMensagens();
      }
    } catch (createError) {
      console.error('[CHAT] Erro ao criar mensagem:', createError);
      toast.error('Erro ao preparar envio.');
      setUploadingPastedFile(false);
      return;
    }

    (async () => {
      try {
        const timestamp = Date.now();
        const ext = file.name.split('.').pop() || 'file';
        const uploadFile = new File([file], `${fileType}-${timestamp}.${ext}`, {
          type: file.type,
          lastModified: timestamp
        });

        const uploadResponse = await base44.integrations.Core.UploadFile({ file: uploadFile });
        const fileUrl = uploadResponse.file_url;

        const dadosEnvio = {
          integration_id: integrationIdParaUso,
          numero_destino: contatoTel,
          media_url: fileUrl,
          media_type: fileType,
          media_caption: legendaTexto
        };
        if (respostaParaMensagem?.whatsapp_message_id) {
          dadosEnvio.reply_to_message_id = respostaParaMensagem.whatsapp_message_id;
        }

        const resultado = await base44.functions.invoke('enviarWhatsApp', dadosEnvio);

        if (resultado.data.success) {
          await base44.entities.Message.update(novaMensagem.id, {
            status: 'enviada',
            whatsapp_message_id: resultado.data.message_id,
            media_url: fileUrl
          });

          await base44.entities.MessageThread.update(thread.id, {
            last_message_content: contentPreview,
            last_message_at: new Date().toISOString(),
            last_message_sender: 'user',
            last_human_message_at: new Date().toISOString(),
            last_media_type: fileType,
            pre_atendimento_ativo: false
          });
        } else {
          await base44.entities.Message.update(novaMensagem.id, {
            status: 'falhou',
            erro_detalhes: resultado.data.error || 'Erro'
          });
          toast.error('Falha ao enviar arquivo');
        }
      } catch (error) {
        console.error('[CHAT] Erro envio arquivo:', error);
        await base44.entities.Message.update(novaMensagem.id, {
          status: 'falhou',
          erro_detalhes: error.message
        });
        toast.error('Erro ao enviar arquivo');
      } finally {
        setUploadingPastedFile(false);
        if (onAtualizarMensagens) {
          setTimeout(() => onAtualizarMensagens(), 300);
        }
      }
    })();
  }, [podeEnviarMidias, modoSelecaoMultipla, contatosSelecionados, broadcastInterno, handleEnviarBroadcast, thread, usuario, contatoCompleto, canalSelecionado, mensagemResposta, onAtualizarMensagens, autoAtribuirThreadSeNecessario]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ✅ Declarados ANTES de handleEnviarFromInput (que os usa nas dependências)
  // ═══════════════════════════════════════════════════════════════════════════
  const marcarComoLidaMutation = useMutation({
    mutationFn: async () => {
      if (!thread) return;
      if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
        await base44.functions.invoke('markThreadAsRead', { thread_id: thread.id });
        return;
      }
      const mensagensNaoLidas = mensagens.filter(
        (m) => m.sender_type === 'contact' && m.status !== 'lida' && m.status !== 'apagada'
      );
      if (mensagensNaoLidas.length === 0) return;
      for (const msg of mensagensNaoLidas) {
        await base44.entities.Message.update(msg.id, { status: 'lida', read_at: new Date().toISOString() });
      }
      if (thread.unread_count > 0) {
        await base44.entities.MessageThread.update(thread.id, { unread_count: 0 });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['threads'] });
      if (onAtualizarMensagens) onAtualizarMensagens();
    },
    onError: (error) => {
      console.error('[CHAT] ❌ Erro ao marcar como lida:', error);
    }
  });

  const marcarLidaAoResponder = React.useCallback(() => {
    if (!thread) return;
    const temNaoLidas =
      (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group')
        ? (thread.unread_by?.[usuario?.id] || 0) > 0
        : (thread.unread_count || 0) > 0;
    if (temNaoLidas && !marcarComoLidaMutation.isPending) {
      marcarComoLidaMutation.mutate();
    }
  }, [thread, usuario?.id, marcarComoLidaMutation]);

  // 🚀 HANDLER DE ENVIO - Recebe dados do MessageInput
  const handleEnviarFromInput = React.useCallback(async ({ texto, pastedImage, pastedImagePreview, attachedFile, attachedFileType }) => {
    // ═══════════════════════════════════════════════════════════════════════
    // 🎯 PRIORIDADE 1: BROADCAST INTERNO/EXTERNO (sem thread específica)
    // Deve ser checado ANTES de qualquer validação de thread
    // ═══════════════════════════════════════════════════════════════════════
    if (modoSelecaoMultipla && (contatosSelecionados.length > 0 || broadcastInterno)) {
      if (attachedFile) {
        await enviarArquivoAnexado(attachedFile, attachedFileType, texto);
        return;
      }
      if (pastedImage) {
        await enviarImagemColada(pastedImage, pastedImagePreview, texto);
        return;
      }
      await handleEnviarBroadcast({ texto });
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🎯 PRIORIDADE 2: THREAD INTERNA (team_internal / sector_group)
    // ═══════════════════════════════════════════════════════════════════════
    if (thread?.thread_type === 'team_internal' || thread?.thread_type === 'sector_group') {
      if (!usuario?.id || !thread?.id) {
        toast.error("⚠️ Contexto inválido. Recarregue a página.");
        return;
      }

      const isParticipante = thread.participants?.includes(usuario.id);
      const isAdmin = usuario.role === 'admin';

      if (!isParticipante && !isAdmin) {
        toast.error("❌ Você não é participante desta conversa interna");
        return;
      }

      if (onSendInternalMessageOptimistic) {
        marcarLidaAoResponder();
        onSendInternalMessageOptimistic({
          texto,
          pastedImage,
          pastedImagePreview,
          attachedFile,
          attachedFileType,
          replyToMessage: mensagemResposta
        });
        setMensagemResposta(null);
      } else {
        toast.error("Handler de envio interno não configurado");
      }
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // THREADS EXTERNAS (WhatsApp) - Lógica existente
    // ═══════════════════════════════════════════════════════════════════════

    // Se tem arquivo anexado, processar upload e envio
    if (attachedFile) {
      await enviarArquivoAnexado(attachedFile, attachedFileType, texto);
      return;
    }

    // Se tem imagem colada, processar como imagem
    if (pastedImage) {
      await enviarImagemColada(pastedImage, pastedImagePreview, texto);
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // THREAD EXTERNA (WhatsApp) - Validações de thread e contato
    // ═══════════════════════════════════════════════════════════════════════
    if (!thread?.whatsapp_integration_id) {
      toast.error('Thread sem integração WhatsApp configurada');
      return;
    }
    if (!contatoCompleto) {
      toast.error('Contato não carregado. Por favor, recarregue a página.');
      return;
    }
    const telefone = contatoCompleto.telefone || contatoCompleto.celular;
    if (!telefone) {
      toast.error('Este contato não possui telefone cadastrado.');
      return;
    }

    // Auto-atribuir thread se necessário
    await autoAtribuirThreadSeNecessario(thread);

    // Adicionar assinatura à mensagem
    let mensagemParaEnviar = texto.trim();
    const nomeAtendenteEnvio = usuario?.display_name || usuario?.full_name;
    if (nomeAtendenteEnvio && usuario?.attendant_sector) {
      const primeiroNome = nomeAtendenteEnvio.split(' ')[0];
      const setor = usuario.attendant_sector;
      mensagemParaEnviar = `${mensagemParaEnviar}\n\n_~ ${primeiroNome} (${setor})_`;
    }

    const integrationIdParaUso = canalSelecionado || thread.whatsapp_integration_id;

    // Limpar resposta
    setMensagemResposta(null);
    setMostrarSugestor(false);

    // ✅ Marcar mensagens recebidas como lidas ao responder
    marcarLidaAoResponder();

    // Tentar enviar otimista primeiro
    if (onSendMessageOptimistic) {
      onSendMessageOptimistic({
        texto: mensagemParaEnviar,
        integrationId: integrationIdParaUso,
        replyToMessage: mensagemResposta,
        thread: thread,
        usuario: usuario,
        contatoCompleto: contatoCompleto
      });
    } else if (onEnviarMensagem) {
      onEnviarMensagem({
        threadId: thread.id,
        contactId: thread.contact_id,
        senderId: usuario.id,
        content: mensagemParaEnviar,
        integrationId: integrationIdParaUso,
        replyToMessageId: mensagemResposta?.id || null
      });
    } else {
      toast.error("Nenhum método de envio de mensagem configurado.");
    }
  }, [modoSelecaoMultipla, contatosSelecionados, broadcastInterno, handleEnviarBroadcast, thread, contatoCompleto, autoAtribuirThreadSeNecessario, usuario, canalSelecionado, mensagemResposta, onSendMessageOptimistic, onEnviarMensagem, enviarImagemColada, enviarArquivoAnexado, marcarLidaAoResponder]);

  const handleResponderMensagem = React.useCallback((mensagem) => {
    setMensagemResposta(mensagem);
    setModoSelecao(false);
    setMensagensSelecionadas([]);
    setMostrarSugestor(false);
  }, []);

  const ativarModoSelecao = React.useCallback(() => {
    if (!podeApagarMensagens) { toast.error("❌ Sem permissão para apagar mensagens"); return; }
    setModoSelecao(true); setMensagensSelecionadas([]); setMensagemResposta(null); setMostrarSugestor(false);
  }, [podeApagarMensagens]);

  const cancelarModoSelecao = React.useCallback(() => { setModoSelecao(false); setMensagensSelecionadas([]); }, []);

  const toggleSelecionarMensagem = React.useCallback((mensagemId) => {
    setMensagensSelecionadas((prev) => prev.includes(mensagemId) ? prev.filter(id => id !== mensagemId) : [...prev, mensagemId]);
  }, []);

  const apagarMensagensSelecionadas = React.useCallback(async () => {
    if (!podeApagarMensagens) { toast.error("❌ Sem permissão para apagar mensagens"); return; }
    if (mensagensSelecionadas.length === 0) { toast.error("Selecione pelo menos uma mensagem."); return; }
    if (!confirm(`Apagar ${mensagensSelecionadas.length} mensagem(ns)? Irreversível.`)) return;
    setEnviando(true);
    try {
      let sucessos = 0, erros = 0;
      for (const mensagemId of mensagensSelecionadas) {
        try {
          const m = mensagens.find(msg => msg.id === mensagemId);
          if (!m?.whatsapp_message_id) { erros++; continue; }
          const r = await base44.functions.invoke('apagarWhatsAppMessage', { integration_id: thread.whatsapp_integration_id, whatsapp_message_id: m.whatsapp_message_id, thread_id: thread.id, message_db_id: m.id });
          r.data.success ? sucessos++ : erros++;
        } catch (_) { erros++; }
      }
      if (sucessos > 0) toast.success(`✅ ${sucessos} mensagem(ns) apagada(s)!`);
      if (erros > 0) toast.error(`❌ ${erros} não puderam ser apagadas.`);
      setModoSelecao(false); setMensagensSelecionadas([]);
      if (onAtualizarMensagens) onAtualizarMensagens();
    } catch (error) { toast.error(`Erro: ${error.message}`); } finally { setEnviando(false); }
  }, [podeApagarMensagens, mensagensSelecionadas, mensagens, thread, onAtualizarMensagens]);

  // marcarComoLidaMutation e marcarLidaAoResponder estão declarados ACIMA (antes de handleEnviarFromInput)

  // ✅ Inicializar o cursor quando as mensagens chegam
  React.useEffect(() => {
    if (mensagens.length > 0) {
      initTimestamp(mensagens);
    }
  }, [thread?.id, mensagens.length, initTimestamp]);

  const prevThreadIdRef = React.useRef(null);
  const scrollDoneRef = React.useRef(false);
  React.useEffect(() => {
    if (!mensagens.length) return;
    if (prevThreadIdRef.current !== thread?.id) {
      prevThreadIdRef.current = thread?.id;
      scrollDoneRef.current = false; // Sempre resetar ao trocar de thread
    }
    if (scrollDoneRef.current) return;
    const unreadIdx = mensagens.findIndex(m => m.sender_type === 'contact' && m.status !== 'lida' && m.status !== 'apagada');
    const t = setTimeout(() => {
      scrollDoneRef.current = true;
      if (unreadIdx !== -1 && thread?.unread_count > 0 && unreadSeparatorRef.current) {
        unreadSeparatorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      }
    }, 200);
    return () => clearTimeout(t);
  }, [mensagens.length, thread?.id, thread?.unread_count]);

  // ✅ PERF FIX: Buscar análise em background sem bloquear render.
  // Usa ref para evitar requisição duplicada para o mesmo contact_id.
  const analiseContactIdRef = React.useRef(null);
  React.useEffect(() => {
    if (!thread?.contact_id) {
      setAnaliseComportamental(null);
      return;
    }
    // Só busca se mudou o contato
    if (analiseContactIdRef.current === thread.contact_id) return;
    analiseContactIdRef.current = thread.contact_id;

    let cancelled = false;
    base44.entities.ContactBehaviorAnalysis.filter(
      { contact_id: thread.contact_id }, '-analyzed_at', 1
    ).then(analises => {
      if (cancelled) return;
      if (analises.length > 0) {
        setAnaliseComportamental(analises[0]);
        if ((analises[0].days_inactive_inbound || 0) >= 30) {
          setMostrarReativacaoRapida(true);
        }
      }
    }).catch(() => {}); // silencioso — não bloquear UI

    return () => { cancelled = true; };
  }, [thread?.contact_id]);

  React.useEffect(() => {
    if (mensagens && mensagens.length > 0) {
      const ultimaMensagem = mensagens[mensagens.length - 1];

      if (ultimaMensagem.sender_type === 'contact' && ultimaMensagem.content) {
        setUltimaMensagemCliente(ultimaMensagem.content);
        // ✅ NÃO abrir automaticamente - deixar usuário decidir
        setMostrarReativacaoRapida(false); // Fechar reativação se cliente respondeu
      } else {
        setUltimaMensagemCliente(null);
        setMostrarSugestor(false);
      }
    } else {
      setUltimaMensagemCliente(null);
      setMostrarSugestor(false);
    }
  }, [mensagens, thread]);

  React.useEffect(() => {
    if (erro) {
      const timer = setTimeout(() => setErro(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [erro]);

  // Handler global para criar oportunidade via chat (usado pelo MessageBubble)
  React.useEffect(() => {
    const criarOportunidade = async (mensagem, threadData, statusInicial = 'rascunho', destino = 'orcamentos') => {
      if (!contatoCompleto) { toast.error('Aguarde o carregamento do contato'); return; }
      const toastId = toast.loading('🤖 IA analisando e criando oportunidade...');
      try {
        let dadosExtraidos = null;
        if (mensagem.content?.trim().length > 10) {
          try { dadosExtraidos = await base44.integrations.Core.InvokeLLM({ prompt: `Analise esta mensagem e extraia dados para orçamento:\n${mensagem.content}\nRetorne JSON com itens, valor_total, condicao_pagamento, observacoes_extraidas.`, response_json_schema: { type: "object", properties: { itens: { type: "array", items: { type: "object", properties: { nome_produto: { type: "string" }, quantidade: { type: "number" }, valor_unitario: { type: "number" } } } }, valor_total: { type: "number" }, condicao_pagamento: { type: "string" }, observacoes_extraidas: { type: "string" } } } }); } catch (_) {}
        }
        const nomeRem = mensagem.sender_type === 'user' ? (usuario?.full_name || 'Atendente') : (contatoCompleto?.nome || 'Cliente');
        const obs = `[💬 Chat ${threadData.id?.slice(-8)} - ${new Date().toLocaleString('pt-BR')}]\n👤 ${nomeRem}\n\n${mensagem.content || `[${mensagem.media_type || 'Mídia'}]`}${dadosExtraidos?.observacoes_extraidas ? `\n\n📋 IA: ${dadosExtraidos.observacoes_extraidas}` : ''}`;
        if (destino === 'leads') {
          if (threadData.contact_id) await base44.entities.Contact.update(threadData.contact_id, { tipo_contato: 'lead' });
          const novoLead = await base44.entities.Cliente.create({ razao_social: contatoCompleto.nome || 'Lead do Chat', telefone: contatoCompleto.telefone || '', status: 'novo_lead', vendedor_id: usuario?.id || '', observacoes: obs, origem_campanha: { canal_entrada: 'whatsapp' } });
          if (threadData.contact_id && novoLead?.id) {
            await base44.entities.Contact.update(threadData.contact_id, { cliente_id: novoLead.id });
          }
          toast.dismiss(toastId); toast.success('🎯 Lead criado!', { duration: 5000, action: { label: 'Ver Leads', onClick: () => navigate(createPageUrl('LeadsQualificados') + '?tab=leads') } }); return;
        }
        if (destino === 'clientes') {
          const novoCliente = await base44.entities.Cliente.create({ razao_social: contatoCompleto.nome || 'Cliente do Chat', telefone: contatoCompleto.telefone || '', status: 'Ativo', vendedor_id: usuario?.id || '', observacoes: obs, origem_campanha: { canal_entrada: 'whatsapp' } });
          if (threadData.contact_id && novoCliente?.id) {
            await base44.entities.Contact.update(threadData.contact_id, { cliente_id: novoCliente.id });
          }
          toast.dismiss(toastId); toast.success('👥 Cliente criado!', { duration: 5000, action: { label: 'Ver Clientes', onClick: () => navigate(createPageUrl('Clientes')) } }); return;
        }
        const response = await base44.functions.invoke('criarOportunidadeDoChat', { message_id: mensagem.id, thread_id: threadData.id, contact_id: threadData.contact_id, cliente_nome: contatoCompleto.nome || '', cliente_telefone: contatoCompleto.telefone || '', cliente_email: contatoCompleto.email || '', vendedor: usuario?.full_name || '', status: statusInicial, valor_total: dadosExtraidos?.valor_total || 0, produtos: dadosExtraidos?.itens?.map(i => ({ nome: i.nome_produto || '', quantidade: i.quantidade || 1, valor_unitario: i.valor_unitario || 0, valor_total: (i.quantidade || 1) * (i.valor_unitario || 0) })) || [], observacoes: obs, media_url: mensagem.media_url || '', media_type: mensagem.media_type || 'text' });
        if (!response?.data?.success) throw new Error(response?.data?.error || 'Erro ao criar');
        toast.dismiss(toastId); toast.success(`✅ Oportunidade ${response.data.numero_orcamento} criada!`, { duration: 5000, action: { label: 'Ver Kanban', onClick: () => navigate(createPageUrl('Orcamentos')) } });
        window.dispatchEvent(new CustomEvent('orcamentos:refresh'));
      } catch (error) { toast.dismiss(toastId); toast.error('Erro ao criar oportunidade: ' + error.message); }
    };
    window.handleCriarOportunidadeDeChat = criarOportunidade;
    return () => { delete window.handleCriarOportunidadeDeChat; };
  }, [contatoCompleto, usuario, navigate]);

  // 🎯 MEMOIZAÇÃO: Processar mensagens ANTES de qualquer early return
  const mensagensProcessadas = React.useMemo(() => {
    if (mensagens.length === 0) return [];

    let mensagensFiltradas = mensagens;

    // Filtrar por categoria se necessário
    if (selectedCategoria && selectedCategoria !== 'all') {
      mensagensFiltradas = mensagens.filter((m) => {
        const temCategoria = m.categorias && Array.isArray(m.categorias) && m.categorias.includes(selectedCategoria);
        return temCategoria;
      });
    }

    // ✅ THREADS INTERNAS: Apenas mensagens entre USUÁRIOS (não contatos externos)
    // 🔧 REGRA SAGRADA: channel='interno' + sender_type='user' + recipient_type IN ['user', 'group']
    const isThreadInterna = thread?.thread_type === 'team_internal' || thread?.thread_type === 'sector_group';

    if (isThreadInterna) {
      return mensagensFiltradas.filter((m) => {
        const isInterna = m.channel === 'interno' && m.sender_type === 'user' &&
          (m.recipient_type === 'user' || m.recipient_type === 'group');
        if (!isInterna) return false;
        const content = (m.content || '').trim();
        const hasMidia = (m.media_type && m.media_type !== 'none') || m.media_url;
        return content.length > 0 || hasMidia;
      });
    }

    // ✅ Permissão de visibilidade: admin/gerente/coordenador veem TODAS as mensagens
    // senior/pleno/junior veem apenas suas mensagens + as do contato
    const podeVerTodasMensagens =
      usuario?.role === 'admin' ||
      ['gerente', 'coordenador'].includes(usuario?.attendant_role);

    // ✅ Para threads externas (WhatsApp): filtrar mensagens desta thread específica
    return mensagensFiltradas.filter((m) => {
      // CRÍTICO: Garantir que a mensagem pertence à thread atual
      if (m.thread_id !== thread?.id) {
        return false;
      }

      // Ocultar mensagens de outros atendentes se não tem permissão de ver todas
      if (
        !podeVerTodasMensagens &&
        m.sender_type === 'user' &&
        m.sender_id !== usuario?.id &&
        !m.metadata?.optimistic
      ) {
        return false;
      }

      if (m.metadata?.deleted) return true;
      if (m.metadata?.is_system_message) return true;
      if (m.metadata?.optimistic) return true;

      const content = (m.content || '').trim();

      if (m.media_url && m.media_type && m.media_type !== 'none') return true;
      if (!content && (!m.media_url || m.media_type === 'none' || !m.media_type)) return false;
      if (/[\+\-\d\s]*status@broadcast/i.test(content)) return false;
      if (/@(broadcast|lid|s\.whatsapp\.net|c\.us)/i.test(content)) return false;
      if (/status@/i.test(content)) return false;
      if (/^[\+\-\d\s]+@/i.test(content)) return false;
      if (/^\+?\d+@/i.test(content)) return false;
      if (/^(Adicionar|Referência|Mídia enviada|Media enviada)$/i.test(content)) return false;

      const conteudoInvalido = ['Mídia enviada', 'Media enviada', 'Adicionar', 'Referência', '[No content]', '[Message content missing]', '[Recovered message]', ''];
      if (conteudoInvalido.includes(content)) return false;
      // Bloquear apenas se parece um JID do WhatsApp (contém @) ou é número de telefone longo
      if (/^[\+\-\s\d@\.]+$/.test(content) && content.length < 50 && content.includes('@')) return false;
      if (/^\+?\d{10,}$/.test(content.replace(/[\s\-\.]/g, ''))) return false; // Telefone longo sem @
      if (content.startsWith('[Media type:')) return false;

      const tiposEspeciais = ['contact', 'location'];
      if (tiposEspeciais.includes(m.media_type) && content.length > 0) return true;
      if (m.media_url && m.media_type && m.media_type !== 'none') return true;
      if (content.length > 0) return true;

      return false;
    });
  }, [mensagens, selectedCategoria, thread?.thread_type]);

  // ✅ HANDLER ATUALIZAR CONTATO - Declarado ANTES dos early returns
  const handleAtualizarContato = React.useCallback(async (campo, valor) => {
    if (!contatoCompleto || !podeTransferirConversas) return;

    try {
      await base44.entities.Contact.update(contatoCompleto.id, { [campo]: valor });
      setContatoCompleto((prev) => ({ ...prev, [campo]: valor }));
    } catch (error) {
      console.error('[ChatWindow] Erro ao atualizar contato:', error);
      toast.error('Erro ao atualizar');
    }
  }, [contatoCompleto, podeTransferirConversas]);

  // 🎯 BUSCAR NOME + SETOR DO OUTRO PARTICIPANTE (threads internas 1:1)
  // PERF FIX: só busca quando thread interna muda, usando atendentes[] já disponível como cache primeiro
  const [outroParticipanteNome, setOutroParticipanteNome] = React.useState('');
  const outroParticipanteThreadIdRef = React.useRef(null);

  React.useEffect(() => {
    if (thread?.thread_type !== 'team_internal' || thread?.is_group_chat) {
      setOutroParticipanteNome('');
      return;
    }
    if (outroParticipanteThreadIdRef.current === thread.id) return;
    outroParticipanteThreadIdRef.current = thread.id;

    const outroId = thread.participants?.find(id => id !== usuario?.id);
    if (!outroId) { setOutroParticipanteNome('Usuário'); return; }

    // Tentar cache local (atendentes já carregados) antes de ir ao banco
    const atendenteLocal = atendentes.find(a => a.id === outroId);
    if (atendenteLocal) {
      const nome = atendenteLocal.display_name || atendenteLocal.full_name || atendenteLocal.email;
      const setor = atendenteLocal.attendant_sector || 'geral';
      setOutroParticipanteNome(`${nome} • ${setor}`);
      return;
    }

    // Fallback: buscar no banco apenas se não encontrado no cache
    let cancelled = false;
    base44.entities.User.get(outroId).then(outroUser => {
      if (cancelled) return;
      const nome = outroUser.full_name || outroUser.email;
      const setor = outroUser.attendant_sector || 'geral';
      setOutroParticipanteNome(`${nome} • ${setor}`);
    }).catch(() => { if (!cancelled) setOutroParticipanteNome('Usuário'); });

    return () => { cancelled = true; };
  }, [thread?.id, thread?.participants, usuario?.id, atendentes]);

  // Se está em modo broadcast com contatos selecionados, mostrar interface de envio
  const mostrarInterfaceBroadcast = modoSelecaoMultipla && (contatosSelecionados.length > 0 || broadcastInterno);

  if (!thread && !mostrarInterfaceBroadcast) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-center">
          <MessageSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-xl font-semibold text-slate-600">Selecione uma conversa</p>
          <p className="text-sm text-slate-400 mt-2">ou digite um número para criar contato</p>
        </div>
      </div>);

  }

  const contatoFallback = contatoCompleto || thread?.contato || null;
  const _c = contatoFallback;
  let nomeContato = [_c?.empresa, _c?.cargo, (_c?.nome !== _c?.telefone ? _c?.nome : null)].filter(Boolean).join(' - ') || _c?.telefone || 'Contato';
  const telefoneExibicao = _c?.telefone || _c?.celular || 'Sem telefone';

  const tipoAtual = TIPOS_CONTATO.find((t) => t.value === contatoCompleto?.tipo_contato);

  const getInitials = (name) => {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const isManager = usuario?.role === 'admin' || usuario?.role === 'supervisor' ||
    ['gerente', 'coordenador'].includes(usuario?.attendant_role);
  const canManageConversation = isManager || thread?.assigned_user_id === usuario?.id || !thread?.assigned_user_id;

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#efeae2] overflow-hidden">
        {/* Header - Modo Broadcast ou Central de Inteligência do Cliente */}
        {mostrarInterfaceBroadcast ?
        <div className={`text-white px-4 py-3 border-b flex-shrink-0 shadow-sm flex items-center justify-between ${
        broadcastInterno ?
        'bg-gradient-to-r from-purple-500 to-indigo-500' :
        'bg-gradient-to-r from-orange-500 to-amber-500'}`
        }>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">
                    {broadcastInterno ? 'Envio Interno' : 'Envio em Massa'}
                  </h3>
                  <p className="text-sm text-white/80">
                    {broadcastInterno ?
                `${broadcastInterno.destinations.length} destinatário(s) interno(s)` :
                `${contatosSelecionados.length} contato(s) selecionado(s)`
                }
                  </p>
                </div>
              </div>
              <button
            onClick={onCancelarSelecao}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">

                Cancelar
              </button>
            </div>
          </div> :

        <div className={`px-3 py-2 border-b flex-shrink-0 shadow-sm text-slate-50 ${
          thread?.thread_type === 'team_internal' || thread?.thread_type === 'sector_group'
            ? 'bg-gradient-to-r from-purple-600 to-indigo-600'
            : 'bg-[#a2bbcd]'
        } ${thread?.thread_type === 'sector_group' ? 'border-purple-300' : 'border-orange-200'}`}>
            {/* LINHA 1: Avatar + Identificação */}
            <div className="flex items-center gap-3">
              {/* Avatar + Próxima Ação */}
              <div className="relative flex-shrink-0">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg overflow-hidden ${
                  thread?.thread_type === 'team_internal' || thread?.thread_type === 'sector_group'
                    ? 'bg-gradient-to-br from-purple-400 to-indigo-600'
                    : 'bg-gradient-to-br from-amber-400 via-orange-500 to-red-500'
                }`}>
                  {thread?.thread_type === 'sector_group' ? (
                    'G'
                  ) : thread?.thread_type === 'team_internal' && thread?.is_group_chat ? (
                    'G'
                  ) : contatoCompleto?.foto_perfil_url ?
                <img
                  src={contatoCompleto.foto_perfil_url}
                  alt={nomeContato}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }} /> :
                <span>{getInitials(nomeContato)}</span>
                }
                </div>

              {/* Próxima Ação Sugerida - canto inferior */}
              {(() => {
              const proxAcao = getProximaAcaoSugerida(contatoCompleto);
              return (
                <div
                  className={`absolute -bottom-1 -right-1 w-5 h-5 ${proxAcao.cor} rounded-full flex items-center justify-center border-2 border-white shadow-md z-20`}
                  title={`Sugestão: ${proxAcao.label}`}>
                    <proxAcao.icon className="w-2.5 h-2.5 text-white" />
                  </div>);
            })()}
            </div>

            {/* Nome + Telefone/Setor */}
            <div className="flex-1 min-w-0">
              <h3 className="text-slate-50 font-bold text-sm truncate mb-1" translate="no">
                {thread?.thread_type === 'sector_group'
                  ? `Setor ${thread.sector_key?.replace('sector:', '') || 'Geral'}`
                  : thread?.thread_type === 'team_internal' && thread?.is_group_chat
                  ? thread.group_name || 'Grupo'
                  : thread?.thread_type === 'team_internal' && !thread?.is_group_chat
                  ? outroParticipanteNome || 'Contato'
                  : nomeContato}
              </h3>
              <p className="text-slate-200 text-xs" translate="no">
                {thread?.thread_type === 'team_internal' && !thread?.is_group_chat ? (
                  '1:1 interno'
                ) : thread?.thread_type === 'sector_group' ? (
                  `${thread.participants?.length || 0} membros`
                ) : thread?.thread_type === 'team_internal' && thread?.is_group_chat ? (
                  `${thread.participants?.length || 0} membros`
                ) : (
                  telefoneExibicao
                )}
              </p>
            </div>

            {/* Componentes de Inteligência Comprimidos + Ações */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <CentralInteligenciaContato
              contato={contatoCompleto}
              variant="mini"
              showSugestoes={true} />

              <CategorizadorRapido
              thread={thread}
              contato={contatoCompleto}
              onUpdate={onAtualizarMensagens} />

              {/* Botão Transferir */}
              {podeTransferirConversas &&
            <button
              onClick={() => setMostrarModalAtribuicao(true)}
              className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-lg p-1.5 shadow-md flex items-center justify-center hover:shadow-lg transition-all hover:from-amber-600 hover:to-amber-700"
              title="Transferir conversa">
                     <Users className="w-3.5 h-3.5" />
                </button>
            }

              {/* Botão Compartilhar */}
              {podeTransferirConversas &&
            <button
              onClick={() => setMostrarModalCompartilhamento(true)}
              className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-1.5 shadow-md flex items-center justify-center hover:shadow-lg transition-all hover:from-blue-600 hover:to-blue-700"
              title="Compartilhar conversa">
                     <UserPlus className="w-3.5 h-3.5" />
                </button>
            }

              {/* Botão Marcar como Lida */}
              {getUnreadCount(thread, usuario?.id) > 0 &&
            <button
              onClick={() => marcarComoLidaMutation.mutate()}
              disabled={marcarComoLidaMutation.isPending}
              className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-1.5 shadow-md flex items-center justify-center hover:from-green-600 hover:to-green-700 hover:shadow-lg transition-all disabled:opacity-50"
              title={`Marcar como lida (${getUnreadCount(thread, usuario?.id)})`}>
                  <CheckSquare className="w-3.5 h-3.5" />
                </button>
            }

              {/* Botão Ver Detalhes */}
              <button
              onClick={onShowContactInfo}
              className="bg-gradient-to-br from-slate-600 to-slate-700 text-white rounded-lg p-1.5 shadow-md flex items-center justify-center hover:from-slate-700 hover:to-slate-800 hover:shadow-lg transition-all"
              title="Ver detalhes">
                <Info className="w-3.5 h-3.5" />
              </button>

              {/* Botão Fechar - sempre visível se disponível */}
              {onFecharChat && (
                <button
                  onClick={onFecharChat}
                  className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg p-1.5 shadow-md flex items-center justify-center hover:from-red-600 hover:to-red-700 hover:shadow-lg transition-all"
                  title="Fechar chat">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* LINHA 2: Temperatura + Fidelizado + Ações */}
          <div className="flex items-center gap-3 justify-between">
            {/* Barra de Temperatura */}
            <div className="flex-1">
              {(() => {
              const score = calcularScoreContato(contatoCompleto);
              const nivel = getNivelTemperatura(score);
              const Icon = nivel.icon;
              return (
                <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${nivel.gradiente} flex items-center justify-center shadow-sm flex-shrink-0`}>
                      <Icon className="w-3 h-3 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-50 font-semibold text-xs truncate">{nivel.emoji} {nivel.label}</span>
                        <span className="text-[10px] font-bold text-slate-500 flex-shrink-0">{score}%</span>
                      </div>
                      <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                        <div
                        className={`h-full bg-gradient-to-r ${nivel.gradiente} transition-all duration-500`}
                        style={{ width: `${score}%` }} />
                      </div>
                    </div>
                  </div>);
            })()}
            </div>

            {/* Atendente Fidelizado */}
            {(() => {
            const setorAtual = thread?.sector_id || usuario?.attendant_sector || 'vendas';
            const camposFidelizacao = {
              'vendas': 'atendente_fidelizado_vendas',
              'assistencia': 'atendente_fidelizado_assistencia',
              'financeiro': 'atendente_fidelizado_financeiro',
              'fornecedor': 'atendente_fidelizado_fornecedor'
            };
            const campoFidelizado = camposFidelizacao[setorAtual] || 'vendedor_responsavel';
            const atendenteFidelizado = contatoCompleto?.[campoFidelizado] || contatoCompleto?.vendedor_responsavel;

            if (atendenteFidelizado) {
              return (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-100 border border-amber-300 rounded-full flex-shrink-0">
                    <span className="text-amber-600 text-xs">★</span>
                    <span className="text-[10px] font-semibold text-amber-700 truncate max-w-[80px]" translate="no">
                      {atendenteFidelizado.split(' ')[0]}
                    </span>
                  </div>);

            }
            return null;
            })()}
            </div>
        </div>
      }

        {/* Banner de Status da Integração */}
        {!mostrarInterfaceBroadcast && thread?.whatsapp_integration_id && userPermissions && (
          <IntegrationStatusBanner 
            integrationId={thread.whatsapp_integration_id}
            userPermissions={userPermissions}
          />
        )}

        {/* Alerta de Pedido de Transferência - Micro-URA */}
        {!mostrarInterfaceBroadcast && thread && (
          <AlertaPedidoTransferencia
            thread={thread}
            atendentes={atendentes}
            usuarioAtual={usuario}
            onTransferirAgora={async () => {
              const sector_id = thread.transfer_requested_sector_id;
              const user_id = thread.transfer_requested_user_id;
              if (user_id) {
                await base44.entities.MessageThread.update(thread.id, {
                  assigned_user_id: user_id,
                  sector_id: sector_id || thread.sector_id,
                  transfer_pending: false,
                  transfer_confirmed: false
                });
              } else if (sector_id) {
                await base44.entities.MessageThread.update(thread.id, {
                  sector_id: sector_id,
                  transfer_pending: false,
                  transfer_confirmed: false
                });
              }
              if (onAtualizarMensagens) onAtualizarMensagens();
              toast.success('✅ Conversa transferida!');
            }}
            onCancelar={() => {
              if (onAtualizarMensagens) onAtualizarMensagens();
            }}
          />
        )}

        {mensagemResposta && !mostrarInterfaceBroadcast &&
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-xs text-blue-600 font-semibold mb-1">
                Respondendo a {mensagemResposta.sender_type === 'user' ? 'você mesmo' : nomeContato}:
              </p>
              <p className="text-sm text-slate-700 line-clamp-2">
                {mensagemResposta.content || '[Mídia]'}
              </p>
            </div>
            <Button
            variant="ghost"
            size="icon"
            onClick={() => setMensagemResposta(null)}
            className="h-6 w-6">

              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      }

      {mostrarInterfaceBroadcast ?
      <BroadcastRecipientsList broadcastInterno={broadcastInterno} contatosSelecionados={contatosSelecionados} /> :

      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 pt-2 space-y-1 bg-[#efeae2]" style={{ backgroundImage: "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAMAAAAp4XiDAAAAUVBMVEWFhYWDg4N3d3dtbW17e3t1dXWBgYGHh4d5eXlzc3Oeli7////l5eXm5ubU1NTg4ODk5OTh4eHf39/e3t7d3d3c3NzS0tLX19fZ2dnPz8/R0dHLKKyVAAAAG3RSTlNAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAvEOwtAAABhklEQVRIx5WWW47DIAxFMTiYNwEC5NF9L/TPxFJpR5rMGRBfDhdn/XoXKMOGaVhmWQ/WwBEqLwKqrg6hcbKkSBAlR4qAIpNIYXAkI1IYFNEIMYJ4NAQKaAQQKKQRQKCYRgCBkhoAApU0AoiU1gAQKaMRQKSsRgCR8hoARCpoBBCpqBFApJJGAJEqGgBE6mgEEKmrAUCknkYAkfoaAEQaagQQaawRQKSJBgCR5hoBRFprBBBppxFApL1GAJEOGgBEOmoEEOmsEUCki0YAka4aAETaawQQGaIRQGSYRgCRkRoBRMZoBBCZoBFAZJJGAJGpGgFE5mkAEFmoEUBkqUYAkQ0aAUQ2agQQ2aQBQGSbRgCR7RoBRHZqBBDZpQFAZJ9GAJH9GgFEDmoEEDmkAUDkiEYAkaMaAUROaAQQOakBQOScRgCR8xoBRC5qBBC5pAFA5LpGAJEbGgFEbmoEELmjEUDkngYAkYcaAUSeaAQQeaoRQOSFBgCRtxoBRD5oBBD5pAFAhP4Bp4OMj0wjNOcAAAAASUVORK5CYII=')" }}>
        {/* ✅ Loading e marcador de início DENTRO do container */}
        {permissionError && (
          <div className="text-center text-xs text-red-500 py-2 px-4 bg-red-50 rounded">
            🚫 {permissionError}
          </div>
        )}

        {loadingOlder && !permissionError && (
          <div className="flex justify-center py-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span className="text-xs text-blue-600 ml-2">Carregando histórico...</span>
          </div>
        )}

        {isHistoryStart && !loadingOlder && !permissionError && (
          <div className="text-center text-xs text-slate-400 py-2">
            ✅ Início da conversa
          </div>
        )}

        {mensagens.length === 0 ?
        <div className="flex items-center justify-center h-full">
            <p className="text-slate-400">Nenhuma mensagem ainda. Inicie a conversa!</p>
          </div> :
        mensagensProcessadas.length === 0 && selectedCategoria !== 'all' ?
        <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Tag className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-semibold">Nenhuma mensagem com esta etiqueta</p>
              <p className="text-sm text-slate-400 mt-2">Remova o filtro para ver todas as mensagens</p>
            </div>
          </div> :

        mensagensProcessadas.map((mensagem, index) => {
          // ✅ PERF FIX: usar index direto em vez de find+indexOf O(n²)
          const prevMensagem = index > 0 ? mensagensProcessadas[index - 1] : null;
          const isFirstUnread =
          mensagem.sender_type === 'contact' &&
          mensagem.status !== 'lida' &&
          mensagem.status !== 'apagada' && (
          index === 0 ||
          prevMensagem && (
          prevMensagem.status === 'lida' ||
          prevMensagem.status === 'apagada' ||
          prevMensagem.sender_type === 'user'));

          return (
            <React.Fragment key={mensagem.id}>
                  {isFirstUnread && getUnreadCount(thread, usuario?.id) > 0 &&
              <div
                ref={unreadSeparatorRef}
                className="flex items-center justify-center my-4">

                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-red-300 to-transparent"></div>
                      <span className="px-4 py-1 text-xs font-semibold text-red-600 bg-red-50 rounded-full border border-red-200 shadow-sm">
                        {getUnreadCount(thread, usuario?.id)} {getUnreadCount(thread, usuario?.id) === 1 ? 'mensagem não lida' : 'mensagens não lidas'}
                      </span>
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-red-300 to-transparent"></div>
                    </div>
              }

                  <MessageBubble
                message={mensagem}
                isOwn={
                  thread?.thread_type === 'team_internal' || thread?.thread_type === 'sector_group'
                    ? mensagem.sender_id === usuario?.id  // Interno: só suas mensagens à direita
                    : mensagem.sender_type === 'user'     // Externo: qualquer atendente à direita
                }
                thread={thread}
                onResponder={handleResponderMensagem}
                modoSelecao={modoSelecao}
                selecionada={mensagensSelecionadas.includes(mensagem.id)}
                onToggleSelecao={toggleSelecionarMensagem}
                mensagens={mensagensProcessadas}
                indexInList={index}
                integracoes={integracoes}
                usuarioAtual={usuario}
                contato={contatoCompleto}
                atendentes={atendentes} />

                </React.Fragment>);

        })
        }
        <div ref={messagesEndRef} />
        </div>
      }

      {erro &&
      <div className="px-4 py-2 bg-red-50 border-t border-red-200 flex-shrink-0">
          <Alert className="bg-transparent border-0 p-0">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-sm text-red-800 ml-2">
              {erro}
            </AlertDescription>
          </Alert>
        </div>
      }

      {/* Sistema de Anexos Melhorado - Suporta envio individual e broadcast */}
      {mostrarMediaSystem &&
      <MediaAttachmentSystem
        onSend={() => {
          setMostrarMediaSystem(false);
          if (onAtualizarMensagens) {
            onAtualizarMensagens();
          }
        }}
        disabled={enviando || carregandoContato || gravandoAudio || modoSelecao}
        replyToMessage={mensagemResposta}
        thread={thread}
        usuario={usuario}
        integrationIdOverride={canalSelecionado}
        modoSelecaoMultipla={modoSelecaoMultipla}
        contatosSelecionados={contatosSelecionados}
        integracoes={integracoes}
        onCancelarSelecao={onCancelarSelecao} />

      }

      {/* ✅ COMPONENTE ISOLADO - Zero re-render no ChatWindow ao digitar */}
      <MessageInput
          onSendMessage={handleEnviarFromInput}
          mensagemResposta={mensagemResposta}
          onClearResposta={() => setMensagemResposta(null)}
          nomeContato={nomeContato}
          gravandoAudio={gravandoAudio}
          onStartRecording={iniciarGravacaoAudio}
          onStopRecording={pararGravacaoAudio}
          mostrarMediaSystem={mostrarMediaSystem}
          onToggleMediaSystem={() => setMostrarMediaSystem(!mostrarMediaSystem)}
          ultimaMensagemCliente={ultimaMensagemCliente}
          mostrarSugestor={mostrarSugestor}
          onToggleSugestor={() => setMostrarSugestor(!mostrarSugestor)}
          podeEnviarMensagens={podeEnviarMensagens}
          podeEnviarMidias={podeEnviarMidias}
          podeEnviarAudios={podeEnviarAudios}
          enviando={enviando}
          carregandoContato={carregandoContato}
          uploadingPastedFile={uploadingPastedFile}
          modoSelecao={modoSelecao}
          integracoes={integracoesPermitidas}
          canalSelecionado={canalSelecionado}
          onCanalChange={setCanalSelecionado}
          thread={thread}
          usuario={usuario}
          modoSelecaoMultipla={modoSelecaoMultipla}
          contatosSelecionados={contatosSelecionados}
          onCancelarSelecao={onCancelarSelecao}
          enviandoBroadcast={enviandoBroadcast}
          progressoBroadcast={progressoBroadcast}
        />


      {/* 🧠 NEXUS BRAIN SUGGESTIONS — sugestões copilot do agente */}
      {!mostrarInterfaceBroadcast && thread?.thread_type === 'contact_external' && (
        <NexusBrainSuggestions
          thread={thread}
          onUsar={(texto) => {
            // Injeta o texto sugerido no MessageInput via evento customizado
            window.dispatchEvent(new CustomEvent('nexus:inject_reply', { detail: { texto } }));
          }}
        />
      )}

      {/* 🎯 SISTEMA INTELIGENTE DE SUGESTÕES */}
      <ChatSuggestions
        thread={thread}
        ultimaMensagemCliente={ultimaMensagemCliente}
        mostrarSugestor={mostrarSugestor}
        mostrarReativacaoRapida={mostrarReativacaoRapida}
        contatoCompleto={contatoCompleto}
        analiseComportamental={analiseComportamental}
        usuario={usuario}
        onFecharReativacao={() => setMostrarReativacaoRapida(false)}
      />

      {/* Modal removido - agora usa MediaAttachmentSystem */}

      {/* MODAL DE ATRIBUIÇÃO/TRANSFERÊNCIA */}
      <AtribuirConversaModal
        isOpen={mostrarModalAtribuicao}
        onClose={() => setMostrarModalAtribuicao(false)}
        thread={thread}
        usuario={usuario}
        contatoNome={contatoCompleto?.nome || 'Cliente'}
        atendentes={atendentes}
        mode="transferir"
        onSuccess={async () => {
          await queryClient.invalidateQueries({ queryKey: ['threads'] });
          await queryClient.invalidateQueries({ queryKey: ['mensagens', thread?.id] });
          if (onAtualizarMensagens) {
            onAtualizarMensagens();
          }
        }} />

      {/* 💬 BOLHA FLUTUANTE - CONVERSA INTERNA SOBRE O CONTATO */}
      {thread?.thread_type === 'contact_external' && isManager && (
        <FloatingConversationBubble
          threadId={thread?.id}
          contato={contatoCompleto}
          usuarioAtual={usuario}
          atendentes={atendentes}
          hasPermission={isManager}
        />
      )}

      {/* MODAL DE COMPARTILHAMENTO */}
      <AtribuirConversaModal
        isOpen={mostrarModalCompartilhamento}
        onClose={() => setMostrarModalCompartilhamento(false)}
        thread={thread}
        usuario={usuario}
        contatoNome={contatoCompleto?.nome || 'Cliente'}
        atendentes={atendentes}
        mode="compartilhar"
        onSuccess={async () => {
          await queryClient.invalidateQueries({ queryKey: ['threads'] });
          await queryClient.invalidateQueries({ queryKey: ['mensagens', thread?.id] });
          if (onAtualizarMensagens) {
            onAtualizarMensagens();
          }
        }} />

    </div>);

}