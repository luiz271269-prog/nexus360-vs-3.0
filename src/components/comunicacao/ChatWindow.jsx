import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  CheckSquare } from
"lucide-react";
import MessageBubble from "./MessageBubble";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

import SugestorRespostasRapidas from './SugestorRespostasRapidas';
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
  onEnviarMensagem,
  onSendMessageOptimistic,
  onShowContactInfo,
  onAtualizarMensagens,
  integracoes = [],
  selectedCategoria = 'all',
  // Props para seleção múltipla (broadcast)
  modoSelecaoMultipla = false,
  contatosSelecionados = [],
  broadcastInterno = null, // { destinations: [...] } para broadcast interno
  onCancelarSelecao,
  atendentes = [] // ✅ PROP: Recebe lista completa de atendentes do pai (Comunicacao.jsx)
}) {
  // ✅ ESTADOS REMOVIDOS DO PAI - Agora no MessageInput
  // mensagemTexto, pastedImage, pastedImagePreview, inputRef
  
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [contatoCompleto, setContatoCompleto] = useState(null);
  const [carregandoContato, setCarregandoContato] = useState(true);
  const [mostrarModalAtribuicao, setMostrarModalAtribuicao] = useState(false);

  const [mensagemResposta, setMensagemResposta] = useState(null);
  const [modoSelecao, setModoSelecao] = useState(false);
  const [mensagensSelecionadas, setMensagensSelecionadas] = useState([]);

  const [gravandoAudio, setGravandoAudio] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const audioStreamRef = useRef(null);
  const [uploadingPastedFile, setUploadingPastedFile] = useState(false);

  const [mostrarSugestor, setMostrarSugestor] = useState(false);
  const [ultimaMensagemCliente, setUltimaMensagemCliente] = useState(null);

  const [canalSelecionado, setCanalSelecionado] = useState(null);

  const [mostrarMediaSystem, setMostrarMediaSystem] = useState(false);

  // Estados para broadcast
  const [enviandoBroadcast, setEnviandoBroadcast] = useState(false);
  const [progressoBroadcast, setProgressoBroadcast] = useState({ enviados: 0, erros: 0, total: 0 });

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const unreadSeparatorRef = useRef(null);
  const fotoJaBuscada = useRef(new Set());

  const permissoes = usuario?.permissoes_comunicacao || {};

  // ✅ VERIFICAR PERMISSÕES ESPECÍFICAS DA INSTÂNCIA
  const getPermissaoInstancia = (permissionKey) => {
    if (!thread?.whatsapp_integration_id || !usuario) return true;
    if (usuario.role === 'admin') return true;

    const whatsappPerms = usuario.whatsapp_permissions || [];
    if (whatsappPerms.length === 0) return true;

    const perm = whatsappPerms.find((p) => p.integration_id === thread.whatsapp_integration_id);
    return perm ? perm[permissionKey] : false;
  };

  const podeEnviarPorInstancia = getPermissaoInstancia('can_send');
  const podeEnviarMensagens = permissoes.pode_enviar_mensagens !== false && podeEnviarPorInstancia;
  const podeEnviarMidias = permissoes.pode_enviar_midias !== false && podeEnviarPorInstancia;
  const podeEnviarAudios = permissoes.pode_enviar_audios !== false && podeEnviarPorInstancia;
  const podeApagarMensagens = permissoes.pode_apagar_mensagens === true;
  const podeTransferirConversas = true;

  const navigate = useNavigate();

  useEffect(() => {
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

      setCarregandoContato(true);

      try {
        const contato = await base44.entities.Contact.get(thread.contact_id);
        if (!isMounted) return;

        setContatoCompleto(contato);
        setCarregandoContato(false);

        // Buscar foto/nome em background (não bloqueia UI)
        const isContatoReal = contato.telefone &&
        !/^[\+\d\s]+@(lid|broadcast|s\.whatsapp\.net|c\.us)/i.test(contato.telefone);

        if (isContatoReal && thread.whatsapp_integration_id) {
          const deveBuscarFoto = !contato.foto_perfil_url ||
          !contato.foto_perfil_atualizada_em ||
          new Date() - new Date(contato.foto_perfil_atualizada_em) > 24 * 60 * 60 * 1000;

          const chaveCache = `${contato.id}-${thread.whatsapp_integration_id}`;

          if (deveBuscarFoto && !fotoJaBuscada.current.has(chaveCache)) {
            fotoJaBuscada.current.add(chaveCache);

            setTimeout(async () => {
              if (!isMounted) return;

              try {
                const [resultadoFoto, resultadoNome] = await Promise.all([
                base44.functions.invoke('buscarFotoPerfilWhatsApp', {
                  integration_id: thread.whatsapp_integration_id,
                  phone: contato.telefone
                }).catch(() => null),
                base44.functions.invoke('buscarNomeContatoWhatsApp', {
                  integration_id: thread.whatsapp_integration_id,
                  phone: contato.telefone
                }).catch(() => null)]
                );

                if (!isMounted) return;

                const updates = {};

                if (resultadoFoto?.data?.success && resultadoFoto?.data?.profilePictureUrl) {
                  updates.foto_perfil_url = resultadoFoto.data.profilePictureUrl;
                  updates.foto_perfil_atualizada_em = new Date().toISOString();
                }

                if (resultadoNome?.data?.success && resultadoNome?.data?.contactName) {
                  const nomeAtualGenerico = !contato.nome ||
                  contato.nome === contato.telefone ||
                  /^[\+\d\s\-\(\)]+$/.test(contato.nome);

                  if (nomeAtualGenerico) {
                    updates.nome = resultadoNome.data.contactName;
                  }
                }

                if (Object.keys(updates).length > 0 && isMounted) {
                  await base44.entities.Contact.update(contato.id, updates);
                  setContatoCompleto((prev) => prev?.id === contato.id ? { ...prev, ...updates } : prev);
                }
              } catch (error) {
                console.warn('Erro ao buscar dados:', error.message);
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
  }, [thread?.contact_id, thread?.whatsapp_integration_id]);

  // Inicializar canal selecionado com o da thread
  useEffect(() => {
    if (thread?.whatsapp_integration_id && integracoes.length > 0) {
      const integracaoAtual = integracoes.find((i) => i.id === thread.whatsapp_integration_id);
      if (integracaoAtual) {
        setCanalSelecionado(integracaoAtual.id);
      }
    }
  }, [thread?.whatsapp_integration_id, integracoes]);

  // ✅ REMOVIDO: handleAtribuirConversa - usa AtribuirConversaModal

  const autoAtribuirThreadSeNecessario = useCallback(async (threadAtual) => {
    if (!threadAtual || !usuario) return;
    
    const isThreadOrfa = !threadAtual.assigned_user_id && !threadAtual.assigned_user_email;
    
    if (isThreadOrfa) {
      
      try {
        await base44.entities.MessageThread.update(threadAtual.id, {
          assigned_user_id: usuario.id,
          // ✅ assigned_user_name/email REMOVIDOS - buscados dinamicamente do User
          status: 'aberta'
        });
        
        // Registrar log de atribuição automática
        await base44.entities.AutomationLog.create({
          acao: 'auto_atribuicao_resposta',
          contato_id: threadAtual.contact_id,
          thread_id: threadAtual.id,
          usuario_id: usuario.id,
          resultado: 'sucesso',
          timestamp: new Date().toISOString(),
          detalhes: {
            mensagem: `Conversa auto-atribuída ao responder`,
            atendente: usuario.full_name || usuario.email,
            trigger: 'primeira_resposta'
          },
          origem: 'sistema',
          prioridade: 'normal'
        });
        
        return true;
      } catch (autoAssignError) {
        console.warn('[CHAT] ⚠️ Erro na auto-atribuição:', autoAssignError.message);
        return false;
      }
    }
    return false;
  }, [usuario]);

  const handleEnviarBroadcast = useCallback(async (opcoes = {}) => {
    const { 
      texto = '',
      mediaUrl = null, 
      mediaType = null, 
      mediaCaption = null,
      isAudio = false 
    } = opcoes;

    if (!podeEnviarMensagens) {
      toast.error("❌ Você não tem permissão para enviar mensagens");
      return;
    }

    // Validar: precisa ter texto OU mídia
    const temTexto = texto.trim().length > 0;
    const temMidia = !!mediaUrl;

    if (!temTexto && !temMidia) {
      toast.error("Digite uma mensagem ou anexe uma mídia");
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MODO BROADCAST INTERNO (team_internal)
    // ═══════════════════════════════════════════════════════════════════════
    if (broadcastInterno && broadcastInterno.destinations) {
      setEnviandoBroadcast(true);
      setProgressoBroadcast({ enviados: 0, erros: 0, total: broadcastInterno.destinations.length });

      let enviados = 0;
      let erros = 0;

      for (const dest of broadcastInterno.destinations) {
        try {
          await base44.functions.invoke('sendInternalMessage', {
            thread_id: dest.thread_id,
            content: texto.trim() || (mediaUrl ? `[${mediaType}]` : ''),
            media_type: mediaType || 'none',
            media_url: mediaUrl,
            media_caption: mediaCaption,
            metadata: { broadcast: true, destination_type: dest.type }
          });
          enviados++;
        } catch (err) {
          console.error(`Erro ao enviar interno para ${dest.name}:`, err);
          erros++;
        }

        setProgressoBroadcast({ enviados, erros, total: broadcastInterno.destinations.length });
        await new Promise(r => setTimeout(r, 300));
      }

      setEnviandoBroadcast(false);

      if (enviados > 0) {
        toast.success(`✅ ${enviados} mensagem(ns) interna(s) enviada(s)!`);
      }
      if (erros > 0) {
        toast.error(`❌ ${erros} erro(s) no envio interno`);
      }

      if (onCancelarSelecao) {
        onCancelarSelecao();
      }
      
      if (onAtualizarMensagens) {
        onAtualizarMensagens();
      }
      
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MODO BROADCAST EXTERNO (WhatsApp)
    // ═══════════════════════════════════════════════════════════════════════
    if (contatosSelecionados.length === 0) {
      toast.error("Nenhum contato selecionado");
      return;
    }

    // Usar canal selecionado ou buscar integração ativa
    const integracaoParaUsar = canalSelecionado 
      ? integracoes.find(i => i.id === canalSelecionado && i.status === 'conectado')
      : integracoes.find(i => i.status === 'conectado');

    if (!integracaoParaUsar) {
      toast.error("Nenhuma integração WhatsApp ativa");
      return;
    }

    setEnviandoBroadcast(true);
    setProgressoBroadcast({ enviados: 0, erros: 0, total: contatosSelecionados.length });

    // 📝 ASSINATURA: Adicionar setor e nome do atendente ao final da mensagem
    // Usa display_name (editável) > full_name (login) como fallback
    let mensagemParaEnviar = texto.trim();
    const nomeAtendente = usuario?.display_name || usuario?.full_name;
    if (nomeAtendente && usuario?.attendant_sector) {
      const primeiroNome = nomeAtendente.split(' ')[0];
      const setor = usuario.attendant_sector;
      mensagemParaEnviar = `${mensagemParaEnviar}\n\n_~ ${primeiroNome} (${setor})_`;
    }
    
    let enviados = 0;
    let erros = 0;

    for (const contato of contatosSelecionados) {
      const telefone = contato.telefone || contato.celular;

      if (!telefone) {
        erros++;
        setProgressoBroadcast(prev => ({ ...prev, erros }));
        continue;
      }

      try {
        // Preparar dados de envio
        const dadosEnvio = {
          integration_id: integracaoParaUsar.id,
          numero_destino: telefone
        };

        // Adicionar mídia se houver
        if (mediaUrl && mediaType) {
          if (isAudio || mediaType === 'audio') {
            dadosEnvio.audio_url = mediaUrl;
            dadosEnvio.media_type = 'audio';
          } else {
            dadosEnvio.media_url = mediaUrl;
            dadosEnvio.media_type = mediaType;
            if (mediaCaption || mensagemParaEnviar) {
              dadosEnvio.media_caption = mediaCaption || mensagemParaEnviar;
            }
          }
        } else if (mensagemParaEnviar) {
          dadosEnvio.mensagem = mensagemParaEnviar;
        }

        const resultado = await base44.functions.invoke('enviarWhatsApp', dadosEnvio);

        if (resultado.data.success) {
          enviados++;
          
          // Buscar ou criar thread para registrar a mensagem
          let threads = await base44.entities.MessageThread.filter({ contact_id: contato.id });
          let threadContato = threads && threads.length > 0 ? threads[0] : null;
          
          const contentPreview = mediaUrl 
            ? (mediaType === 'image' ? '[Imagem]' : mediaType === 'audio' ? '[Áudio]' : mediaType === 'video' ? '[Vídeo]' : '[Arquivo]')
            : mensagemParaEnviar.substring(0, 100);

          if (!threadContato) {
            threadContato = await base44.entities.MessageThread.create({
              contact_id: contato.id,
              whatsapp_integration_id: integracaoParaUsar.id,
              status: 'aberta',
              last_message_content: contentPreview,
              last_message_at: new Date().toISOString(),
              last_message_sender: 'user',
              last_media_type: mediaType || 'none'
            });
          } else {
            await base44.entities.MessageThread.update(threadContato.id, {
              last_message_content: contentPreview,
              last_message_at: new Date().toISOString(),
              last_message_sender: 'user',
              last_human_message_at: new Date().toISOString(),
              last_media_type: mediaType || 'none',
              pre_atendimento_ativo: false
            });
          }

          // Registrar a mensagem na thread
          await base44.entities.Message.create({
            thread_id: threadContato.id,
            sender_id: usuario?.id || 'system',
            sender_type: 'user',
            recipient_id: contato.id,
            recipient_type: 'contact',
            content: mediaCaption || mensagemParaEnviar || contentPreview,
            channel: 'whatsapp',
            status: 'enviada',
            whatsapp_message_id: resultado.data.message_id,
            sent_at: new Date().toISOString(),
            media_url: mediaUrl || null,
            media_type: mediaType || 'none',
            media_caption: mediaCaption,
            metadata: {
              whatsapp_integration_id: integracaoParaUsar.id,
              broadcast: true
            }
          });
        } else {
          erros++;
        }
      } catch (error) {
        console.error(`[BROADCAST] Erro ao enviar para ${telefone}:`, error);
        erros++;
      }

      setProgressoBroadcast({ enviados, erros, total: contatosSelecionados.length });
      
      // Pequeno delay entre envios para evitar rate limit
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setEnviandoBroadcast(false);
    
    if (enviados > 0) {
      toast.success(`✅ ${enviados} mensagem(ns) enviada(s) com sucesso!`);
    }
    if (erros > 0) {
      toast.error(`❌ ${erros} erro(s) no envio`);
    }

    // Cancelar modo seleção após envio
    if (onCancelarSelecao) {
      onCancelarSelecao();
    }

    if (onAtualizarMensagens) {
      onAtualizarMensagens();
    }
  }, [podeEnviarMensagens, contatosSelecionados, broadcastInterno, usuario, onCancelarSelecao, onAtualizarMensagens, integracoes, canalSelecionado]);

  const enviarAudio = useCallback(async (audioBlob) => {
    if (!podeEnviarAudios) {
      toast.error("❌ Você não tem permissão para enviar áudios");
      return;
    }

    setEnviando(true);
    setErro(null);

    try {
      const timestamp = new Date().getTime();
      const audioFile = new File([audioBlob], `audio-${timestamp}.ogg`, {
        type: 'audio/ogg; codecs=opus',
        lastModified: timestamp
      });

      toast.info('📤 Fazendo upload do áudio...');
      const uploadResponse = await base44.integrations.Core.UploadFile({
        file: audioFile
      });

      const audioUrl = uploadResponse.file_url;

      // ═══════════════════════════════════════════════════════════════════
      // MODO BROADCAST: Enviar áudio para múltiplos contatos
      // ═══════════════════════════════════════════════════════════════════
      if (modoSelecaoMultipla && contatosSelecionados.length > 0) {
        toast.info('📤 Enviando áudio para os contatos selecionados...');
        
        await handleEnviarBroadcast({
          mediaUrl: audioUrl,
          mediaType: 'audio',
          isAudio: true
        });

        setEnviando(false);
        return;
      }

      // ═══════════════════════════════════════════════════════════════════
      // MODO INDIVIDUAL: Enviar para um contato específico
      // ═══════════════════════════════════════════════════════════════════
      if (!thread || !usuario || carregandoContato) {
        toast.error("Dados da conversa ou contato não disponíveis para enviar áudio.");
        setEnviando(false);
        return;
      }

      if (!contatoCompleto) {
        toast.error('Contato não carregado. Por favor, recarregue a página.');
        setEnviando(false);
        return;
      }

      const telefone = contatoCompleto.telefone || contatoCompleto.celular;
      if (!telefone) {
        toast.error('Este contato não possui telefone cadastrado para enviar áudio.');
        setEnviando(false);
        return;
      }

      const integrationIdParaUso = canalSelecionado || thread.whatsapp_integration_id;

      // 🎯 AUTO-ATRIBUIÇÃO: Se thread sem dono, atribuir ao atendente
      await autoAtribuirThreadSeNecessario(thread);

      const dadosEnvio = {
        integration_id: integrationIdParaUso,
        numero_destino: telefone,
        audio_url: audioUrl,
        media_type: 'audio'
      };

      if (mensagemResposta?.whatsapp_message_id) {
        dadosEnvio.reply_to_message_id = mensagemResposta.whatsapp_message_id;
      }

      const resultado = await base44.functions.invoke('enviarWhatsApp', dadosEnvio);

      if (resultado.data.success) {
        await base44.entities.Message.create({
          thread_id: thread.id,
          sender_id: usuario.id,
          sender_type: "user",
          recipient_id: thread.contact_id,
          recipient_type: "contact",
          content: "[Áudio]",
          channel: "whatsapp",
          status: "enviada",
          whatsapp_message_id: resultado.data.message_id,
          sent_at: new Date().toISOString(),
          media_url: audioUrl,
          media_type: 'audio',
          reply_to_message_id: mensagemResposta?.id || null,
          metadata: {
            whatsapp_integration_id: integrationIdParaUso
          }
        });

        await base44.entities.MessageThread.update(thread.id, {
          last_message_content: "[Áudio]",
          last_message_at: new Date().toISOString(),
          last_message_sender: "user",
          last_human_message_at: new Date().toISOString(),
          whatsapp_integration_id: integrationIdParaUso,
          pre_atendimento_ativo: false
        });

        toast.success("✅ Áudio enviado com sucesso!");
        setMensagemResposta(null);

        if (onAtualizarMensagens) {
          onAtualizarMensagens();
        }
      } else {
        throw new Error(resultado.data.error || 'Erro desconhecido ao enviar áudio pelo WhatsApp');
      }
    } catch (error) {
      console.error('[CHAT] ❌ Erro ao enviar áudio:', error);
      const mensagemErro = error.message || 'Erro ao enviar áudio';
      setErro(mensagemErro);
      toast.error(mensagemErro);
    } finally {
      setEnviando(false);
    }
  }, [podeEnviarAudios, modoSelecaoMultipla, contatosSelecionados, broadcastInterno, handleEnviarBroadcast, thread, usuario, carregandoContato, contatoCompleto, canalSelecionado, mensagemResposta, onAtualizarMensagens, autoAtribuirThreadSeNecessario]);

  const iniciarGravacaoAudio = useCallback(async () => {
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

  const pararGravacaoAudio = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setGravandoAudio(false);
      toast.dismiss();
    }
  }, [mediaRecorder]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 🖼️ ENVIAR IMAGEM COLADA - Declarada ANTES de handleEnviarFromInput
  // ═══════════════════════════════════════════════════════════════════════════
  const enviarImagemColada = useCallback(async (imagemFile, previewUrl, legendaTexto = '') => {
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
  const enviarArquivoAnexado = useCallback(async (file, fileType, legendaTexto = '') => {
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

  // 🚀 HANDLER DE ENVIO - Recebe dados do MessageInput
  const handleEnviarFromInput = useCallback(async ({ texto, pastedImage, pastedImagePreview, attachedFile, attachedFileType }) => {
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

    // Se estiver em modo broadcast (externo ou interno), chamar o handler de broadcast
    if (modoSelecaoMultipla && (contatosSelecionados.length > 0 || broadcastInterno)) {
      await handleEnviarBroadcast({ texto });
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // THREAD INTERNA (team_internal ou sector_group) - ENVIO INDIVIDUAL
    // ═══════════════════════════════════════════════════════════════════════
    if (thread?.thread_type === 'team_internal' || thread?.thread_type === 'sector_group') {
      setEnviando(true);

      try {
        // ✅ LÓGICA CIRÚRGICA: Upload de mídia ANTES de enviar (igual Z-API)
        let mediaUrlFinal = null;
        let mediaTypeFinal = 'none';
        let mediaCaptionFinal = null;

        // Se tem imagem colada
        if (pastedImage) {
          toast.info('📤 Fazendo upload da imagem...');
          const timestamp = Date.now();
          let mimeType = pastedImage.type || 'image/png';
          if (!mimeType.startsWith('image/')) mimeType = 'image/png';
          const ext = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png';

          const imageFile = new File([pastedImage], `internal-${timestamp}.${ext}`, { 
            type: mimeType,
            lastModified: timestamp
          });

          const uploadResponse = await base44.integrations.Core.UploadFile({ file: imageFile });
          mediaUrlFinal = uploadResponse.file_url;
          mediaTypeFinal = 'image';
          mediaCaptionFinal = texto.trim() || null;
        }
        // Se tem arquivo anexado
        else if (attachedFile) {
          toast.info('📤 Fazendo upload do arquivo...');
          const timestamp = Date.now();
          const ext = attachedFile.name.split('.').pop() || 'file';
          const uploadFile = new File([attachedFile], `internal-${timestamp}.${ext}`, { 
            type: attachedFile.type,
            lastModified: timestamp
          });

          const uploadResponse = await base44.integrations.Core.UploadFile({ file: uploadFile });
          mediaUrlFinal = uploadResponse.file_url;
          mediaTypeFinal = attachedFileType;
          mediaCaptionFinal = texto.trim() || null;
        }

        // Validação: precisa texto OU mídia
        if (!texto.trim() && !mediaUrlFinal) {
          toast.error('Digite uma mensagem ou anexe uma mídia');
          setEnviando(false);
          return;
        }

        const result = await base44.functions.invoke('sendInternalMessage', {
          thread_id: thread.id,
          content: texto.trim() || (mediaUrlFinal ? `[${mediaTypeFinal}]` : ''),
          media_type: mediaTypeFinal,
          media_url: mediaUrlFinal,
          media_caption: mediaCaptionFinal,
          reply_to_message_id: mensagemResposta?.id || null
        });

        console.log('[CHAT] ✅ Resposta sendInternalMessage:', result);

        if (result?.data?.success || result?.success) {
          setMensagemResposta(null);
          toast.success('✅ Mensagem enviada!');

          if (onAtualizarMensagens) {
            onAtualizarMensagens();
          }
        } else {
          throw new Error(result?.data?.error || 'Erro ao enviar mensagem interna');
        }
      } catch (error) {
        console.error('[CHAT] Erro ao enviar mensagem interna:', error);
        toast.error('Erro ao enviar: ' + error.message);
      } finally {
        setEnviando(false);
      }
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
  }, [modoSelecaoMultipla, contatosSelecionados, broadcastInterno, handleEnviarBroadcast, thread, contatoCompleto, autoAtribuirThreadSeNecessario, usuario, canalSelecionado, mensagemResposta, onSendMessageOptimistic, onEnviarMensagem, enviarImagemColada, enviarArquivoAnexado]);

  const handleResponderMensagem = useCallback((mensagem) => {
    setMensagemResposta(mensagem);
    setModoSelecao(false);
    setMensagensSelecionadas([]);
    setMostrarSugestor(false);
  }, []);

  const ativarModoSelecao = useCallback(() => {
    if (!podeApagarMensagens) {
      toast.error("❌ Você não tem permissão para apagar mensagens");
      return;
    }

    setModoSelecao(true);
    setMensagensSelecionadas([]);
    setMensagemResposta(null);
    setMostrarSugestor(false);
  }, [podeApagarMensagens]);

  const cancelarModoSelecao = useCallback(() => {
    setModoSelecao(false);
    setMensagensSelecionadas([]);
  }, []);

  const toggleSelecionarMensagem = useCallback((mensagemId) => {
    setMensagensSelecionadas((prev) => {
      if (prev.includes(mensagemId)) {
        return prev.filter((id) => id !== mensagemId);
      } else {
        return [...prev, mensagemId];
      }
    });
  }, []);

  const apagarMensagensSelecionadas = useCallback(async () => {
    if (!podeApagarMensagens) {
      toast.error("❌ Você não tem permissão para apagar mensagens");
      return;
    }

    if (mensagensSelecionadas.length === 0) {
      toast.error("Selecione pelo menos uma mensagem para apagar.");
      return;
    }

    if (!confirm(`Tem certeza que deseja apagar ${mensagensSelecionadas.length} mensagem(ns)? Esta ação é irreversível e tentará apagar para todos na conversa.`)) {
      return;
    }

    setEnviando(true);
    try {
      let sucessos = 0;
      let erros = 0;

      for (const mensagemId of mensagensSelecionadas) {
        try {
          const messageToDelete = mensagens.find((m) => m.id === mensagemId);
          if (!messageToDelete || !messageToDelete.whatsapp_message_id) {
            erros++;
            continue;
          }

          const resultado = await base44.functions.invoke('apagarWhatsAppMessage', {
            integration_id: thread.whatsapp_integration_id,
            whatsapp_message_id: messageToDelete.whatsapp_message_id,
            thread_id: thread.id,
            message_db_id: messageToDelete.id
          });

          if (resultado.data.success) {
            sucessos++;
          } else {
            erros++;
          }
        } catch (error) {
          erros++;
        }
      }

      if (sucessos > 0) {
        toast.success(`✅ ${sucessos} mensagem(ns) apagada(s) do WhatsApp!`);
      }

      if (erros > 0) {
        toast.error(`❌ ${erros} mensagem(ns) não puderam ser apagadas do WhatsApp.`);
      }

      setModoSelecao(false);
      setMensagensSelecionadas([]);

      if (onAtualizarMensagens) {
        onAtualizarMensagens();
      }
    } catch (error) {
      console.error('[CHAT] ❌ Erro geral ao apagar mensagens:', error);
      toast.error(`Erro inesperado ao tentar apagar mensagens: ${error.message}`);
    } finally {
      setEnviando(false);
    }
  }, [podeApagarMensagens, mensagensSelecionadas, mensagens, thread, onAtualizarMensagens]);



  useEffect(() => {
    if (!thread || !usuario || !mensagens.length) return;

    const marcarComoLida = async () => {
      try {
        // ✅ THREAD INTERNA - usar markThreadAsRead
        if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
          await base44.functions.invoke('markThreadAsRead', {
            thread_id: thread.id
          });

          if (onAtualizarMensagens) {
            onAtualizarMensagens();
          }
          return;
        }

        // ✅ THREAD EXTERNA - lógica existente (não mexer)
        const mensagensNaoLidas = mensagens.filter(
          (m) => m.sender_type === 'contact' && m.status !== 'lida' && m.status !== 'apagada'
        );

        if (mensagensNaoLidas.length === 0) return;

        for (const msg of mensagensNaoLidas) {
          await base44.entities.Message.update(msg.id, {
            status: 'lida',
            read_at: new Date().toISOString()
          });
        }

        if (thread.unread_count > 0) {
          await base44.entities.MessageThread.update(thread.id, {
            unread_count: 0
          });
        }

        if (onAtualizarMensagens) {
          onAtualizarMensagens();
        }
      } catch (error) {
        console.error('[CHAT] ❌ Erro ao marcar como lida:', error);
      }
    };

    const timer = setTimeout(marcarComoLida, 1000);
    return () => clearTimeout(timer);
  }, [thread?.id, mensagens.length, usuario?.id, onAtualizarMensagens]);

  // ✅ Foco automático removido - agora é responsabilidade do MessageInput

  useEffect(() => {
    if (!mensagens.length) return;

    const primeiraLidaIndex = mensagens.findIndex(
      (m) => m.sender_type === 'contact' && m.status !== 'lida' && m.status !== 'apagada'
    );

    // Delay maior para garantir DOM renderizado
    const timer = setTimeout(() => {
      if (primeiraLidaIndex !== -1 && thread?.unread_count > 0) {
        if (unreadSeparatorRef.current) {
          unreadSeparatorRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        } else {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        // ✅ Scroll para última mensagem (mais recente)
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [mensagens, thread?.id, thread?.unread_count]);

  useEffect(() => {
    if (mensagens && mensagens.length > 0) {
      const ultimaMensagem = mensagens[mensagens.length - 1];

      if (ultimaMensagem.sender_type === 'contact' && ultimaMensagem.content) {
        setUltimaMensagemCliente(ultimaMensagem.content);
      } else {
        setUltimaMensagemCliente(null);
        setMostrarSugestor(false);
      }
    } else {
      setUltimaMensagemCliente(null);
      setMostrarSugestor(false);
    }
  }, [mensagens, thread]);

  useEffect(() => {
    if (erro) {
      const timer = setTimeout(() => setErro(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [erro]);

  useEffect(() => {
    window.handleCriarOportunidadeDeChat = async (mensagem, threadData) => {
      if (!contatoCompleto) {
        toast.error('Aguarde o carregamento do contato');
        return;
      }

      let conteudoMensagem = '';
      let mediaUrl = null;

      if (mensagem.content) {
        conteudoMensagem = mensagem.content;
      } else if (mensagem.media_type === 'audio') {
        conteudoMensagem = '[Áudio gravado]';
      } else if (mensagem.media_type === 'image') {
        conteudoMensagem = '[Imagem/Print enviada]';
        mediaUrl = mensagem.media_url;
        if (mensagem.media_url) {
          conteudoMensagem += `\n\nURL da imagem: ${mensagem.media_url}`;
        }
      } else if (mensagem.media_type === 'video') {
        conteudoMensagem = '[Vídeo enviado]';
      } else if (mensagem.media_type === 'document') {
        conteudoMensagem = '[Documento anexado]';
      } else {
        conteudoMensagem = '[Mensagem sem texto]';
      }

      const tipoRemetente = mensagem.sender_type === 'user' ? 'Atendente' : 'Cliente';
      const nomeRemetente = mensagem.sender_type === 'user' ?
      usuario?.full_name || 'Atendente' :
      contatoCompleto?.nome || 'Cliente';

      // Extração inteligente de dados estruturados com IA
      let dadosExtraidos = null;
      if (mensagem.content && mensagem.content.trim().length > 10) {
        try {
          toast.info('🤖 IA analisando mensagem para extrair dados...', { duration: 2000 });

          const prompt = `Analise esta mensagem de chat e extraia dados estruturados para criar um orçamento comercial.

    MENSAGEM DO CLIENTE:
    ${mensagem.content}

    INSTRUÇÕES:
    1. Identifique produtos/serviços mencionados com quantidades e valores (se houver)
    2. Extraia condições de pagamento, prazos ou datas mencionadas
    3. Capture observações importantes ou requisitos específicos
    4. Se não houver dados claros, retorne campos vazios

    Retorne JSON estruturado.`;

          const schema = {
            type: "object",
            properties: {
              itens: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    nome_produto: { type: "string" },
                    descricao: { type: "string" },
                    quantidade: { type: "number" },
                    valor_unitario: { type: "number" },
                    referencia: { type: "string" }
                  }
                }
              },
              numero_orcamento: { type: "string" },
              condicao_pagamento: { type: "string" },
              data_vencimento: { type: "string" },
              observacoes_extraidas: { type: "string" }
            }
          };

          const resultado = await base44.integrations.Core.InvokeLLM({
            prompt: prompt,
            response_json_schema: schema
          });

          dadosExtraidos = resultado;

          if (resultado.itens && resultado.itens.length > 0) {
            toast.success(`✅ IA identificou ${resultado.itens.length} item(ns)!`, { duration: 2000 });
          }
        } catch (error) {
          console.error('[CHAT] Erro ao extrair dados com IA:', error);
          toast.warning('⚠️ Não foi possível extrair dados automaticamente', { duration: 2000 });
        }
      }

      const observacoesBase = `[Oportunidade criada a partir do Chat WhatsApp - ${new Date().toLocaleString('pt-BR')}]

    📱 Thread ID: ${threadData.id}
    👤 Remetente: ${nomeRemetente} (${tipoRemetente})
    📅 Data: ${new Date(mensagem.created_date || mensagem.sent_at).toLocaleString('pt-BR')}
    ${mensagem.media_type ? `📎 Tipo: ${mensagem.media_type}` : ''}

    💬 Conteúdo da Mensagem:
    ${conteudoMensagem}`;

      const observacoesFinal = dadosExtraidos?.observacoes_extraidas ?
      `${observacoesBase}\n\n📋 Observações Extraídas pela IA:\n${dadosExtraidos.observacoes_extraidas}\n\n---\n✅ Status inicial: Enviado (Aguardando resposta do cliente)\n🎯 Próximos passos: Revisar itens extraídos e enviar proposta formal` :
      `${observacoesBase}\n\n---\n✅ Status inicial: Enviado (Aguardando resposta do cliente)\n🎯 Próximos passos: Adicionar itens, valores e enviar proposta formal`;

      const queryParams = new URLSearchParams({
        origem: 'chat',
        thread_id: threadData.id,
        message_id: mensagem.id,

        cliente_nome: contatoCompleto.nome || '',
        cliente_telefone: contatoCompleto.telefone || '',
        cliente_celular: contatoCompleto.celular || contatoCompleto.telefone || '',
        cliente_email: contatoCompleto.email || '',
        cliente_empresa: contatoCompleto.empresa || '',

        vendedor: usuario?.full_name || usuario?.email || '',
        data_orcamento: new Date().toISOString().slice(0, 10),
        status: 'rascunho',

        observacoes: observacoesFinal
      });

      // Adicionar dados extraídos se houver
      if (dadosExtraidos) {
        if (dadosExtraidos.numero_orcamento) {
          queryParams.set('numero_orcamento', dadosExtraidos.numero_orcamento);
        }
        if (dadosExtraidos.condicao_pagamento) {
          queryParams.set('condicao_pagamento', dadosExtraidos.condicao_pagamento);
        }
        if (dadosExtraidos.data_vencimento) {
          queryParams.set('data_vencimento', dadosExtraidos.data_vencimento);
        }
        if (dadosExtraidos.itens && dadosExtraidos.itens.length > 0) {
          queryParams.set('itens_extraidos', encodeURIComponent(JSON.stringify(dadosExtraidos.itens)));
        }
      }

      // Adicionar media_url se for imagem
      if (mediaUrl) {
        queryParams.set('media_url', mediaUrl);
      }

      navigate(createPageUrl('OrcamentoDetalhes') + '?' + queryParams.toString());

      toast.success('🎯 Oportunidade criada! Preencha os detalhes do orçamento.', { duration: 3000 });
    };

    return () => {
      delete window.handleCriarOportunidadeDeChat;
    };
  }, [contatoCompleto, usuario, navigate]);

  // 🎯 MEMOIZAÇÃO: Processar mensagens ANTES de qualquer early return
  const mensagensProcessadas = useMemo(() => {
    if (mensagens.length === 0) return [];

    let mensagensFiltradas = mensagens;

    // Filtrar por categoria se necessário
    if (selectedCategoria && selectedCategoria !== 'all') {
      mensagensFiltradas = mensagens.filter((m) => {
        const temCategoria = m.categorias && Array.isArray(m.categorias) && m.categorias.includes(selectedCategoria);
        return temCategoria;
      });
    }

    // ✅ THREADS INTERNAS: mostrar TODAS as mensagens, sem filtros de WhatsApp
    const isThreadInterna = thread?.thread_type === 'team_internal' || thread?.thread_type === 'sector_group';
    
    if (isThreadInterna) {
      return mensagensFiltradas.filter((m) => {
        // Mensagens apagadas: mostrar placeholder
        if (m.metadata?.deleted) return true;
        // Mensagens de sistema (transferências, etc.)
        if (m.metadata?.is_system_message) return true;
        // Mensagens otimistas (enviando)
        if (m.metadata?.optimistic) return true;
        
        // ✅ FILTRO SIMPLIFICADO: conteúdo OU mídia válida
        const content = (m.content || '').trim();
        const hasMidia = m.media_url && m.media_type && m.media_type !== 'none';
        
        return content.length > 0 || hasMidia;
      });
    }

    // ✅ Para threads externas (WhatsApp): aplicar filtros de limpeza existentes
    return mensagensFiltradas.filter((m) => {
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
      if (/^[\+\-\s\d@\.]+$/.test(content) && content.length < 50) return false;
      if (content.startsWith('[Media type:')) return false;

      const tiposEspeciais = ['contact', 'location'];
      if (tiposEspeciais.includes(m.media_type) && content.length > 0) return true;
      if (m.media_url && m.media_type && m.media_type !== 'none') return true;
      if (content.length > 0) return true;

      return false;
    });
  }, [mensagens, selectedCategoria, thread?.thread_type]);

  // ✅ HANDLER ATUALIZAR CONTATO - Declarado ANTES dos early returns
  const handleAtualizarContato = useCallback(async (campo, valor) => {
    if (!contatoCompleto || !podeTransferirConversas) return;

    try {
      await base44.entities.Contact.update(contatoCompleto.id, { [campo]: valor });
      setContatoCompleto((prev) => ({ ...prev, [campo]: valor }));
    } catch (error) {
      console.error('[ChatWindow] Erro ao atualizar contato:', error);
      toast.error('Erro ao atualizar');
    }
  }, [contatoCompleto, podeTransferirConversas]);

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

  if (carregandoContato && !mostrarInterfaceBroadcast) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-slate-600">Carregando informações do contato...</p>
        </div>
      </div>);

  }

  // Nome formatado: Empresa + Cargo + Nome
  let nomeContato = "";
  if (contatoCompleto?.empresa) nomeContato += contatoCompleto.empresa;
  if (contatoCompleto?.cargo) nomeContato += (nomeContato ? " - " : "") + contatoCompleto.cargo;
  if (contatoCompleto?.nome && contatoCompleto.nome !== contatoCompleto.telefone) {
    nomeContato += (nomeContato ? " - " : "") + contatoCompleto.nome;
  }
  if (!nomeContato || nomeContato.trim() === '') {
    nomeContato = contatoCompleto?.telefone || thread?.contato?.telefone || 'Contato';
  }

  const telefoneExibicao = contatoCompleto?.telefone || thread?.contato?.telefone || contatoCompleto?.celular || thread?.contato?.celular || 'Sem telefone';

  const tipoAtual = TIPOS_CONTATO.find((t) => t.value === contatoCompleto?.tipo_contato);

  const getInitials = (name) => {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const isManager = usuario?.role === 'admin' || usuario?.role === 'supervisor';
  const canManageConversation = isManager || thread?.assigned_user_id === usuario?.id || !thread?.assigned_user_id;

  return (
    <div className="flex flex-col h-full bg-white">
        {/* Header - Modo Broadcast ou Central de Inteligência do Cliente */}
        {mostrarInterfaceBroadcast ? (
          <div className={`text-white px-4 py-3 border-b flex-shrink-0 shadow-sm ${
            broadcastInterno 
              ? 'bg-gradient-to-r from-purple-500 to-indigo-500' 
              : 'bg-gradient-to-r from-orange-500 to-amber-500'
          }`}>
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
                    {broadcastInterno 
                      ? `${broadcastInterno.destinations.length} destinatário(s) interno(s)` 
                      : `${contatosSelecionados.length} contato(s) selecionado(s)`
                    }
                  </p>
                </div>
              </div>
              <button
                onClick={onCancelarSelecao}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
        <div className="bg-[#a2bbcd] text-slate-50 px-2 opacity-100 from-amber-50 via-orange-50 to-rose-50 border-b border-orange-200 flex-shrink-0 shadow-sm">
        <div className="text-[#6e94c9] rounded-md flex items-center gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg overflow-hidden relative bg-gradient-to-br from-amber-400 via-orange-500 to-red-500">
              {contatoCompleto?.foto_perfil_url ?
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
                  className={`absolute -bottom-1 -right-1 w-6 h-6 ${proxAcao.cor} rounded-full flex items-center justify-center border-2 border-white shadow-md z-20`}
                  title={`Sugestão: ${proxAcao.label}`}>

                  <proxAcao.icon className="w-3 h-3 text-white" />
                </div>);

            })()}
          </div>

          {/* Nome, Telefone e Barra de Temperatura */}
          <div className="flex-1 min-w-0">
            <div className="bg-transparent text-black mb-1 flex items-center gap-2">
              <h3 className="text-slate-800 text-lg font-bold truncate">{nomeContato}</h3>
              <CentralInteligenciaContato
                contato={contatoCompleto}
                variant="mini"
                showSugestoes={true} />

              <CategorizadorRapido
                thread={thread}
                contato={contatoCompleto}
                onUpdate={onAtualizarMensagens} />
            </div>
            <div className="flex items-center gap-3 mb-2">
              <p className="text-slate-50 text-xs">{telefoneExibicao}</p>

              {/* Barra de Temperatura Visual */}
              {(() => {
                const score = calcularScoreContato(contatoCompleto);
                const nivel = getNivelTemperatura(score);
                const Icon = nivel.icon;
                return (
                  <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                    <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${nivel.gradiente} flex items-center justify-center shadow-sm`}>
                      <Icon className="w-3 h-3 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-slate-50 font-semibold">{nivel.emoji} {nivel.label}</span>
                        <span className="text-[10px] font-bold text-slate-500">{score}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${nivel.gradiente} transition-all duration-500`}
                          style={{ width: `${score}%` }} />

                      </div>
                    </div>
                  </div>);

              })()}

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
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-100 border border-amber-300 rounded-full">
                      <span className="text-amber-600 text-xs">⭐</span>
                      <span className="text-[11px] font-semibold text-amber-700 truncate max-w-[100px]">
                        {atendenteFidelizado.split(' ')[0]}
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>


          </div>

          {/* Ações */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Botão Transferir - Somente para quem tem permissão */}
            {podeTransferirConversas && (
              <button
                onClick={() => setMostrarModalAtribuicao(true)}
                className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-lg px-3 py-2 shadow-md flex items-center gap-2 hover:shadow-lg transition-all text-xs font-medium">
                  <Users className="w-4 h-4" />
                  Transferir
              </button>
            )}

            {/* Botão Ver Detalhes */}
            <button
              onClick={onShowContactInfo}
              className="bg-gradient-to-br from-slate-600 to-slate-700 text-white rounded-lg px-3 py-2 shadow-md flex items-center gap-2 hover:from-slate-700 hover:to-slate-800 hover:shadow-lg transition-all">

              <Info className="w-4 h-4" />
              <span className="text-xs font-medium">Detalhes</span>
            </button>
          </div>
        </div>


      </div>
        )}

        {/* Alerta de Pedido de Transferência - Micro-URA */}
        {!mostrarInterfaceBroadcast && thread && (
          <div className="px-4 pt-3">
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
          </div>
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

      {mostrarInterfaceBroadcast ? (
      <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="max-w-2xl mx-auto">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">
            {broadcastInterno ? 'Destinatários internos:' : 'Contatos selecionados:'}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto">
            {broadcastInterno ? (
              broadcastInterno.destinations.map((dest) => (
                <div key={dest.thread_id} className="bg-white rounded-lg p-2 border border-purple-200 flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {dest.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-800 truncate">{dest.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {dest.type === 'user' ? '👤 1:1' : dest.type === 'sector' ? '🏢 Setor' : '👥 Grupo'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              contatosSelecionados.map((contato) => (
                <div key={contato.id} className="bg-white rounded-lg p-2 border border-orange-200 flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {(contato.nome || contato.telefone || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-800 truncate">{contato.nome || 'Sem nome'}</p>
                    <p className="text-[10px] text-slate-500 truncate">{contato.telefone}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    ) : (
    <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-1 bg-[#efeae2]" style={{ backgroundImage: "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAMAAAAp4XiDAAAAUVBMVEWFhYWDg4N3d3dtbW17e3t1dXWBgYGHh4d5eXlzc3Oeli7////l5eXm5ubU1NTg4ODk5OTh4eHf39/e3t7d3d3c3NzS0tLX19fZ2dnPz8/R0dHLKKyVAAAAG3RSTlNAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAvEOwtAAABhklEQVRIx5WWW47DIAxFMTiYNwEC5NF9L/TPxFJpR5rMGRBfDhdn/XoXKMOGaVhmWQ/WwBEqLwKqrg6hcbKkSBAlR4qAIpNIYXAkI1IYFNEIMYJ4NAQKaAQQKKQRQKCYRgCBkhoAApU0AoiU1gAQKaMRQKSsRgCR8hoARCpoBBCpqBFApJJGAJEqGgBE6mgEEKmrAUCknkYAkfoaAEQaagQQaawRQKSJBgCR5hoBRFprBBBppxFApL1GAJEOGgBEOmoEEOmsEUCki0YAka4aAETaawQQGaIRQGSYRgCRkRoBRMZoBBCZoBFAZJJGAJGpGgFE5mkAEFmoEUBkqUYAkQ0aAUQ2agQQ2aQBQGSbRgCR7RoBRHZqBBDZpQFAZJ9GAJH9GgFEDmoEEDmkAUDkiEYAkaMaAUROaAQQOakBQOScRgCR8xoBRC5qBBC5pAFA5LpGAJEbGgFEbmoEELmjEUDkngYAkYcaAUSeaAQQeaoRQOSFBgCRtxoBRD5oBBD5pAFAhP4Bp4OMj0wjNOcAAAAASUVORK5CYII=')" }}>
        {mensagens.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-400">Nenhuma mensagem ainda. Inicie a conversa!</p>
          </div>
        ) : mensagensProcessadas.length === 0 && selectedCategoria !== 'all' ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Tag className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-semibold">Nenhuma mensagem com esta etiqueta</p>
              <p className="text-sm text-slate-400 mt-2">Remova o filtro para ver todas as mensagens</p>
            </div>
          </div>
        ) : (
        mensagensProcessadas.map((mensagem, index) => {
            const msgCompleta = mensagens.find(m => m.id === mensagem.id);
            const indexOriginal = mensagens.indexOf(msgCompleta);
            const isFirstUnread =
            mensagem.sender_type === 'contact' &&
            mensagem.status !== 'lida' &&
            mensagem.status !== 'apagada' && (
            indexOriginal === 0 ||
            mensagens[indexOriginal - 1] && (
            mensagens[indexOriginal - 1].status === 'lida' ||
            mensagens[indexOriginal - 1].status === 'apagada' ||
            mensagens[indexOriginal - 1].sender_type === 'user'));

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
                  isOwn={mensagem.sender_type === 'user'}
                  thread={thread}
                  onResponder={handleResponderMensagem}
                  modoSelecao={modoSelecao}
                  selecionada={mensagensSelecionadas.includes(mensagem.id)}
                  onToggleSelecao={toggleSelecionarMensagem}
                  mensagens={mensagensProcessadas}
                  integracoes={integracoes}
                  usuarioAtual={usuario}
                  contato={contatoCompleto}
                  atendentes={atendentes} />

                </React.Fragment>);

                })
        )}
        <div ref={messagesEndRef} />
        </div>
        )}

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
        integracoes={integracoes}
        canalSelecionado={canalSelecionado}
        onCanalChange={setCanalSelecionado}
        thread={thread}
        modoSelecaoMultipla={modoSelecaoMultipla}
        contatosSelecionados={contatosSelecionados}
        onCancelarSelecao={onCancelarSelecao}
        enviandoBroadcast={enviandoBroadcast}
        progressoBroadcast={progressoBroadcast}
      />

      {mostrarSugestor &&
        <div className="px-3 pb-3">
          <div className="border border-purple-200 rounded-lg bg-purple-50/50 p-3">
            <SugestorRespostasRapidas
              mensagemCliente={ultimaMensagemCliente}
              threadId={thread.id}
              contactId={thread.contact_id}
              onUseResposta={(conteudo) => {
                // Não podemos mais setar mensagemTexto aqui diretamente
                // Precisamos de uma forma de comunicar com MessageInput
                setMostrarSugestor(false);
                toast.info('💡 Sugestão copiada! Cole no campo de mensagem.');
                navigator.clipboard.writeText(conteudo);
              }}
              onClose={() => setMostrarSugestor(false)}
            />
          </div>
        </div>
      }

      {/* Modal removido - agora usa MediaAttachmentSystem */}

      {/* MODAL DE ATRIBUIÇÃO/TRANSFERÊNCIA - NOVO COMPONENTE */}
      <AtribuirConversaModal
        isOpen={mostrarModalAtribuicao}
        onClose={() => setMostrarModalAtribuicao(false)}
        thread={thread}
        usuario={usuario}
        contatoNome={contatoCompleto?.nome || 'Cliente'}
        atendentes={atendentes}
        onSuccess={() => {
          if (onAtualizarMensagens) {
            onAtualizarMensagens();
          }
        }}
      />
    </div>);

}