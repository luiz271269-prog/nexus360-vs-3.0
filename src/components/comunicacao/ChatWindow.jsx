import React, { useState, useRef, useEffect } from "react";
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
  CheckSquare,
  UserCheck } from
"lucide-react";
import MessageBubble from "./MessageBubble";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
// import html2canvas from "html2canvas"; // Desativado temporariamente
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription } from
"@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
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

export default function ChatWindow({
  thread = null,
  mensagens = [],
  usuario = null,
  onEnviarMensagem,
  onShowContactInfo,
  onAtualizarMensagens,
  integracoes = [],
  selectedCategoria = 'all',
  // Props para seleção múltipla (broadcast)
  modoSelecaoMultipla = false,
  contatosSelecionados = [],
  onCancelarSelecao
}) {
  const [mensagemTexto, setMensagemTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [contatoCompleto, setContatoCompleto] = useState(null);
  const [carregandoContato, setCarregandoContato] = useState(true);
  const [mostrarModalAtribuicao, setMostrarModalAtribuicao] = useState(false);
  const [atendentes, setAtendentes] = useState([]);
  const [carregandoAtendentes, setCarregandoAtendentes] = useState(false);
  const [atribuindo, setAtribuindo] = useState(false);
  const [capturandoTela, setCapturandoTela] = useState(false);
  const [mensagemTransferencia, setMensagemTransferencia] = useState("");

  const [mensagemResposta, setMensagemResposta] = useState(null);
  const [modoSelecao, setModoSelecao] = useState(false);
  const [mensagensSelecionadas, setMensagensSelecionadas] = useState([]);

  const [gravandoAudio, setGravandoAudio] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const audioStreamRef = useRef(null);
  const [uploadingPastedFile, setUploadingPastedFile] = useState(false);
  const [pastedImage, setPastedImage] = useState(null);
  const [pastedImagePreview, setPastedImagePreview] = useState(null);

  const [mostrarSugestor, setMostrarSugestor] = useState(false);
  const [ultimaMensagemCliente, setUltimaMensagemCliente] = useState(null);

  const [canalSelecionado, setCanalSelecionado] = useState(null);

  const [mostrarMediaSystem, setMostrarMediaSystem] = useState(false);

  const [vendedores, setVendedores] = useState([]);
  const [atendentesLista, setAtendentesLista] = useState([]);

  // Estados para broadcast
  const [enviandoBroadcast, setEnviandoBroadcast] = useState(false);
  const [progressoBroadcast, setProgressoBroadcast] = useState({ enviados: 0, erros: 0, total: 0 });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatContainerRef = useRef(null);
  const unreadSeparatorRef = useRef(null);
  const fotoJaBuscada = useRef(new Set());

  const permissoes = usuario?.permissoes_comunicacao || {};

  // ✅ VERIFICAR PERMISSÕES ESPECÍFICAS DA INSTÂNCIA
  const getPermissaoInstancia = (permissionKey) => {
    if (!thread?.whatsapp_integration_id || !usuario) return true; // Sem restrições se não tiver thread
    if (usuario.role === 'admin') return true; // Admin sempre pode tudo

    const whatsappPerms = usuario.whatsapp_permissions || [];
    if (whatsappPerms.length === 0) return true; // Sem restrições configuradas

    const perm = whatsappPerms.find((p) => p.integration_id === thread.whatsapp_integration_id);
    return perm ? perm[permissionKey] : false;
  };

  const podeEnviarPorInstancia = getPermissaoInstancia('can_send');
  const podeEnviarMensagens = permissoes.pode_enviar_mensagens !== false && podeEnviarPorInstancia;
  const podeEnviarMidias = permissoes.pode_enviar_midias !== false && podeEnviarPorInstancia;
  const podeEnviarAudios = permissoes.pode_enviar_audios !== false && podeEnviarPorInstancia;
  const podeApagarMensagens = permissoes.pode_apagar_mensagens === true;
  const podeTransferirConversas = true; // Qualquer usuário pode transferir

  const navigate = useNavigate();

  // ✅ TODOS OS useEffect NO TOPO - ANTES DE QUALQUER RETURN
  useEffect(() => {
    const carregarDados = async () => {
      try {
        const [vend, atend] = await Promise.all([
        base44.entities.Vendedor.list('nome'),
        base44.entities.User.list() // Todos os usuários sem nenhum filtro
        ]);
        setVendedores(vend || []);
        const usuariosValidos = (atend || []).filter(u => u && u.id);
        console.log('[ChatWindow] Usuários carregados no init:', usuariosValidos.length);
        setAtendentesLista(usuariosValidos);
      } catch (error) {
        console.error('[ChatWindow] Erro ao carregar dados:', error);
      }
    };
    carregarDados();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const carregarContato = async () => {
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

  useEffect(() => {
    if (mostrarModalAtribuicao) {
      carregarAtendentes();
      // Mensagem padrão ao abrir
      const nomeContato = contatoCompleto?.nome || 'Cliente';
      setMensagemTransferencia(`Conversa com ${nomeContato} transferida.`);
    }
  }, [mostrarModalAtribuicao, contatoCompleto?.nome]);

  const carregarAtendentes = async () => {
    setCarregandoAtendentes(true);
    try {
      // Buscar TODOS os usuários do sistema usando list() sem filtros
      const users = await base44.entities.User.list();
      console.log('[CHAT] Usuários carregados para transferência:', users?.length || 0);
      
      // Usar todos os usuários válidos
      const usuariosValidos = (users || []).filter(u => u && u.id);
      console.log('[CHAT] Usuários válidos:', usuariosValidos.length, usuariosValidos.map(u => u.full_name || u.email));
      
      setAtendentes(usuariosValidos);
    } catch (error) {
      console.error('[CHAT] Erro ao carregar usuários:', error);
      // Fallback: usar lista carregada no início
      if (atendentesLista && atendentesLista.length > 0) {
        console.log('[CHAT] Usando fallback atendentesLista:', atendentesLista.length);
        setAtendentes(atendentesLista);
      } else {
        setAtendentes([]);
      }
    } finally {
      setCarregandoAtendentes(false);
    }
  };

  const handleAtribuirConversa = async (atendenteId) => {
    // Removida trava de permissão - qualquer usuário pode transferir
    if (!thread || !usuario) {
      toast.error("Dados da conversa não disponíveis");
      return;
    }

    setAtribuindo(true);
    try {
      const atendenteEscolhido = atendentes.find((a) => a.id === atendenteId);

      if (!atendenteEscolhido) {
        throw new Error("Atendente não encontrado");
      }

      await base44.entities.MessageThread.update(thread.id, {
        assigned_user_id: atendenteEscolhido.id,
        assigned_user_name: atendenteEscolhido.full_name,
        pre_atendimento_ativo: false,
        pre_atendimento_state: 'COMPLETED'
      });

      await base44.entities.AutomationLog.create({
        acao: thread.assigned_user_id ? 'reatribuicao_manual' : 'atribuicao_manual',
        contato_id: thread.contact_id,
        thread_id: thread.id,
        usuario_id: usuario.id,
        resultado: 'sucesso',
        timestamp: new Date().toISOString(),
        detalhes: {
          mensagem: `Conversa ${thread.assigned_user_id ? 'transferida' : 'atribuída'} para ${atendenteEscolhido.full_name}`,
          atendente_anterior: thread.assigned_user_name || 'Nenhum',
          atendente_novo: atendenteEscolhido.full_name,
          atribuido_por: usuario.full_name
        },
        origem: 'manual',
        prioridade: 'normal'
      });

      // Mensagem de sistema com texto personalizado
      const textoMensagem = mensagemTransferencia?.trim() 
        ? `🔔 ${mensagemTransferencia} (→ ${atendenteEscolhido.full_name})`
        : `🔔 Conversa ${thread.assigned_user_id ? 'transferida' : 'atribuída'} para ${atendenteEscolhido.full_name} por ${usuario.full_name}`;

      await base44.entities.Message.create({
        thread_id: thread.id,
        sender_id: usuario.id,
        sender_type: 'user',
        recipient_id: thread.contact_id,
        recipient_type: 'contact',
        content: textoMensagem,
        channel: 'interno',
        status: 'enviada',
        sent_at: new Date().toISOString(),
        metadata: {
          is_system_message: true,
          action_type: 'assignment',
          atendente_anterior: thread.assigned_user_name || null,
          atendente_novo: atendenteEscolhido.full_name
        }
      });

      toast.success(
        thread.assigned_user_id ?
        `✅ Conversa transferida para ${atendenteEscolhido.full_name}` :
        `✅ Conversa atribuída a ${atendenteEscolhido.full_name}`
      );

      setMostrarModalAtribuicao(false);

      if (onAtualizarMensagens) {
        setTimeout(async () => {
          const novasMensagens = await base44.entities.Message.filter(
            { thread_id: thread.id },
            'created_date',
            500
          );
          onAtualizarMensagens(novasMensagens);
        }, 500);
      }

    } catch (error) {
      console.error('[CHAT] Erro ao atribuir conversa:', error);
      toast.error(`Erro ao ${thread.assigned_user_id ? 'transferir' : 'atribuir'} conversa: ${error.message}`);
    } finally {
      setAtribuindo(false);
    }
  };

  const iniciarGravacaoAudio = async () => {
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
  };

  const pararGravacaoAudio = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setGravandoAudio(false);
      toast.dismiss();
    }
  };

  const enviarAudio = async (audioBlob) => {
    if (!podeEnviarAudios) {
      toast.error("❌ Você não tem permissão para enviar áudios");
      return;
    }

    if (!thread || !usuario || carregandoContato) {
      toast.error("Dados da conversa ou contato não disponíveis para enviar áudio.");
      return;
    }

    if (!contatoCompleto) {
      toast.error('Contato não carregado. Por favor, recarregue a página.');
      return;
    }

    const telefone = contatoCompleto.telefone || contatoCompleto.celular;
    if (!telefone) {
      toast.error('Este contato não possui telefone cadastrado para enviar áudio.');
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

      const uploadResponse = await base44.integrations.Core.UploadFile({
        file: audioFile
      });

      const audioUrl = uploadResponse.file_url;

      const integrationIdParaUso = canalSelecionado || thread.whatsapp_integration_id;

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
          whatsapp_integration_id: integrationIdParaUso
        });

        toast.success("✅ Áudio enviado com sucesso!");
        setMensagemResposta(null);

        if (onAtualizarMensagens) {
          setTimeout(async () => {
            const novasMensagens = await base44.entities.Message.filter(
              { thread_id: thread.id },
              'created_date',
              500
            );
            onAtualizarMensagens(novasMensagens);
          }, 500);
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
  };

  // Função de envio em massa (broadcast)
  const handleEnviarBroadcast = async () => {
    if (!podeEnviarMensagens) {
      toast.error("❌ Você não tem permissão para enviar mensagens");
      return;
    }

    if (!mensagemTexto.trim()) {
      toast.error("Digite uma mensagem");
      return;
    }

    if (contatosSelecionados.length === 0) {
      toast.error("Nenhum contato selecionado");
      return;
    }

    const integracaoAtiva = integracoes.find(i => i.status === 'conectado');
    if (!integracaoAtiva) {
      toast.error("Nenhuma integração WhatsApp ativa");
      return;
    }

    setEnviandoBroadcast(true);
    setProgressoBroadcast({ enviados: 0, erros: 0, total: contatosSelecionados.length });

    const mensagemParaEnviar = mensagemTexto.trim();
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
        // Usar a mesma função enviarWhatsApp
        const resultado = await base44.functions.invoke('enviarWhatsApp', {
          integration_id: integracaoAtiva.id,
          numero_destino: telefone,
          mensagem: mensagemParaEnviar
        });

        if (resultado.data.success) {
          enviados++;
          
          // Buscar ou criar thread para registrar a mensagem
          let threads = await base44.entities.MessageThread.filter({ contact_id: contato.id });
          let threadContato = threads && threads.length > 0 ? threads[0] : null;
          
          if (!threadContato) {
            threadContato = await base44.entities.MessageThread.create({
              contact_id: contato.id,
              whatsapp_integration_id: integracaoAtiva.id,
              status: 'aberta',
              last_message_content: mensagemParaEnviar.substring(0, 100),
              last_message_at: new Date().toISOString(),
              last_message_sender: 'user'
            });
          } else {
            await base44.entities.MessageThread.update(threadContato.id, {
              last_message_content: mensagemParaEnviar.substring(0, 100),
              last_message_at: new Date().toISOString(),
              last_message_sender: 'user'
            });
          }

          // Registrar a mensagem na thread
          await base44.entities.Message.create({
            thread_id: threadContato.id,
            sender_id: usuario?.id || 'system',
            sender_type: 'user',
            recipient_id: contato.id,
            recipient_type: 'contact',
            content: mensagemParaEnviar,
            channel: 'whatsapp',
            status: 'enviada',
            whatsapp_message_id: resultado.data.message_id,
            sent_at: new Date().toISOString(),
            metadata: {
              whatsapp_integration_id: integracaoAtiva.id,
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
    setMensagemTexto("");
    
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
  };

  const handleEnviar = async (e) => {
    e?.preventDefault();

    // Se está em modo broadcast, usar função de broadcast
    if (modoSelecaoMultipla && contatosSelecionados.length > 0) {
      await handleEnviarBroadcast();
      return;
    }

    if (!podeEnviarMensagens) {
      toast.error("❌ Você não tem permissão para enviar mensagens");
      return;
    }

    if (enviando || gravandoAudio || uploadingPastedFile) {
      return;
    }

    if (carregandoContato) {
      toast.warning('⏳ Aguarde o contato ser carregado antes de enviar mensagens.');
      return;
    }

    if (!mensagemTexto.trim()) return;

    setEnviando(true);
    setErro(null);

    try {
      if (!thread?.whatsapp_integration_id) {
        throw new Error('Thread sem integração WhatsApp configurada');
      }

      if (!contatoCompleto) {
        throw new Error('Contato não carregado. Por favor, recarregue a página.');
      }

      const telefone = contatoCompleto.telefone || contatoCompleto.celular;

      if (!telefone) {
        throw new Error('Este contato não possui telefone cadastrado. Por favor, edite o contato e adicione um número de telefone.');
      }

      const mensagemParaEnviar = mensagemTexto.trim();
      const integrationIdParaUso = canalSelecionado || thread.whatsapp_integration_id;

      console.log('[CHAT] 📤 Enviando com integração:', {
        thread_integration: thread.whatsapp_integration_id,
        canal_selecionado: canalSelecionado,
        integration_id_usado: integrationIdParaUso
      });

      const dadosEnvio = {
        integration_id: integrationIdParaUso,
        numero_destino: telefone,
        mensagem: mensagemParaEnviar
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
          content: mensagemParaEnviar,
          channel: "whatsapp",
          status: "enviada",
          whatsapp_message_id: resultado.data.message_id,
          sent_at: new Date().toISOString(),
          reply_to_message_id: mensagemResposta?.id || null,
          metadata: {
            whatsapp_integration_id: integrationIdParaUso
          }
        });

        await base44.entities.MessageThread.update(thread.id, {
          last_message_content: mensagemParaEnviar.substring(0, 100),
          last_message_at: new Date().toISOString(),
          last_message_sender: "user",
          whatsapp_integration_id: integrationIdParaUso
        });

        toast.success('✅ Mensagem enviada com sucesso!', {
          duration: 2000,
          icon: '✅'
        });

        setMensagemTexto("");
        setMensagemResposta(null);
        setMostrarSugestor(false);

        if (onAtualizarMensagens) {
          setTimeout(async () => {
            const novasMensagens = await base44.entities.Message.filter(
              { thread_id: thread.id },
              'created_date',
              500
            );
            onAtualizarMensagens(novasMensagens);
          }, 500);
        }
      } else {
        throw new Error(resultado.data.error || 'Erro desconhecido ao enviar');
      }

    } catch (error) {
      console.error('[CHAT] ❌ Erro ao enviar:', error);

      let mensagemErro = 'Erro ao enviar mensagem';

      if (error.message?.includes('telefone') || error.message?.includes('contato')) {
        mensagemErro = '❌ ' + error.message;
      } else if (error.message?.includes('bloqueado')) {
        mensagemErro = '❌ Número bloqueado pela Meta';
      } else if (error.message?.includes('rate limit')) {
        mensagemErro = '⚠️ Limite de mensagens atingido. Aguarde alguns minutos.';
      } else {
        mensagemErro = error.message || mensagemErro;
      }

      setErro(mensagemErro);
      toast.error(mensagemErro);
    } finally {
      setEnviando(false);
    }
  };

  const handleResponderMensagem = (mensagem) => {
    setMensagemResposta(mensagem);
    setModoSelecao(false);
    setMensagensSelecionadas([]);
    setMostrarSugestor(false);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  };

  const ativarModoSelecao = () => {
    if (!podeApagarMensagens) {
      toast.error("❌ Você não tem permissão para apagar mensagens");
      return;
    }

    setModoSelecao(true);
    setMensagensSelecionadas([]);
    setMensagemResposta(null);
    setMostrarSugestor(false);
  };

  const cancelarModoSelecao = () => {
    setModoSelecao(false);
    setMensagensSelecionadas([]);
  };

  const toggleSelecionarMensagem = (mensagemId) => {
    setMensagensSelecionadas((prev) => {
      if (prev.includes(mensagemId)) {
        return prev.filter((id) => id !== mensagemId);
      } else {
        return [...prev, mensagemId];
      }
    });
  };

  const apagarMensagensSelecionadas = async () => {
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
        setTimeout(async () => {
          const novasMensagens = await base44.entities.Message.filter(
            { thread_id: thread.id },
            'created_date',
            500
          );
          onAtualizarMensagens(novasMensagens);
        }, 500);
      }
    } catch (error) {
      console.error('[CHAT] ❌ Erro geral ao apagar mensagens:', error);
      toast.error(`Erro inesperado ao tentar apagar mensagens: ${error.message}`);
    } finally {
      setEnviando(false);
    }
  };

  // Removido - agora usa MediaAttachmentSystem

  // Removido - agora usa MediaAttachmentSystem

  // Paste handling agora integrado no MediaAttachmentSystem


  // Removido - agora usa MediaAttachmentSystem

  const handlePrintChat = async () => {
    toast.info('Funcionalidade temporariamente desativada');
  };

  useEffect(() => {
    if (!thread || !usuario || !mensagens.length) return;

    const marcarComoLida = async () => {
      const mensagensNaoLidas = mensagens.filter(
        (m) => m.sender_type === 'contact' && m.status !== 'lida' && m.status !== 'apagada'
      );

      if (mensagensNaoLidas.length === 0) return;

      try {
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
          setTimeout(async () => {
            const novasMensagens = await base44.entities.Message.filter(
              { thread_id: thread.id },
              'created_date',
              500
            );
            onAtualizarMensagens(novasMensagens);
          }, 500);
        }
      } catch (error) {
        console.error('[CHAT] ❌ Erro ao marcar como lida:', error);
      }
    };

    const timer = setTimeout(marcarComoLida, 1000);
    return () => clearTimeout(timer);
  }, [thread?.id, mensagens.length, usuario?.id]);

  // ✅ Foco automático no campo de mensagem ao abrir conversa
  useEffect(() => {
    if (thread?.id && !carregandoContato && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [thread?.id, carregandoContato]);

  useEffect(() => {
    if (!mensagens.length) return;

    const primeiraLidaIndex = mensagens.findIndex(
      (m) => m.sender_type === 'contact' && m.status !== 'lida' && m.status !== 'apagada'
    );

    // Delay maior para garantir DOM renderizado
    const timer = setTimeout(() => {
      if (primeiraLidaIndex !== -1 && thread?.unread_count > 0) {
        if (unreadSeparatorRef.current) {
          console.log('✅ Rolando para mensagens não lidas');
          unreadSeparatorRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        } else {
          console.warn('⚠️ Separador não encontrado');
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        // ✅ Scroll para última mensagem (mais recente)
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      }
      
      // ✅ Foco no campo de digitação após scroll
      inputRef.current?.focus();
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

  // Se está em modo broadcast com contatos selecionados, mostrar interface de envio
  const mostrarInterfaceBroadcast = modoSelecaoMultipla && contatosSelecionados.length > 0;

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

  const handleAtualizarContato = async (campo, valor) => {
    if (!contatoCompleto || !podeTransferirConversas) return;

    try {
      await base44.entities.Contact.update(contatoCompleto.id, { [campo]: valor });
      setContatoCompleto((prev) => ({ ...prev, [campo]: valor }));
    } catch (error) {
      console.error('[ChatWindow] Erro ao atualizar contato:', error);
      toast.error('Erro ao atualizar');
    }
  };

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
  const canManageConversation = isManager || thread.assigned_user_id === usuario?.id || !thread.assigned_user_id;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Se tem imagem colada, enviar imagem em vez de texto
      if (pastedImage) {
        enviarImagemColada();
      } else {
        handleEnviar();
      }
    }
  };

  // Handler para colar imagem (Ctrl+V / Cmd+V)
  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setPastedImage(file);
          const previewUrl = URL.createObjectURL(file);
          setPastedImagePreview(previewUrl);
          toast.info('📷 Imagem colada! Clique em enviar para compartilhar.');
        }
        break;
      }
    }
  };

  const cancelarImagemColada = () => {
    if (pastedImagePreview) {
      URL.revokeObjectURL(pastedImagePreview);
    }
    setPastedImage(null);
    setPastedImagePreview(null);
  };

  const enviarImagemColada = async () => {
    if (!pastedImage || !thread || !usuario || !podeEnviarMidias) {
      toast.error('Não foi possível enviar a imagem');
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

    // Guardar referências antes de limpar UI
    const imagemParaEnviar = pastedImage;
    const legendaImagem = mensagemTexto.trim() || null;
    const respostaParaMensagem = mensagemResposta;
    const previewUrl = pastedImagePreview; // Guardar preview local

    // Limpar UI imediatamente
    setPastedImage(null);
    setPastedImagePreview(null);
    setMensagemTexto('');
    setMensagemResposta(null);
    setUploadingPastedFile(true);
    setErro(null);

    // 1. Criar mensagem com preview LOCAL para aparecer instantaneamente
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
        media_url: previewUrl, // Preview local para exibição imediata
        media_type: 'image',
        media_caption: legendaImagem,
        reply_to_message_id: respostaParaMensagem?.id || null,
        metadata: {
          whatsapp_integration_id: integrationIdParaUso,
          is_pasted_image: true,
          local_preview: true
        }
      });

      // Atualizar UI imediatamente com a mensagem "enviando"
      if (onAtualizarMensagens) {
        onAtualizarMensagens();
      }
    } catch (createError) {
      console.error('[CHAT] Erro ao criar mensagem:', createError);
      toast.error('Erro ao preparar envio.');
      setUploadingPastedFile(false);
      return;
    }

    // 2. Upload e envio em background (não bloqueia UI)
    (async () => {
      try {
        // Criar File com tipo correto
        const timestamp = Date.now();
        let mimeType = imagemParaEnviar.type || 'image/png';
        if (!mimeType.startsWith('image/')) mimeType = 'image/png';
        const ext = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('webp') ? 'webp' : 'png';
        
        const imageFile = new File([imagemParaEnviar], `print-${timestamp}.${ext}`, { 
          type: mimeType,
          lastModified: timestamp
        });

        // Upload
        const uploadResponse = await base44.integrations.Core.UploadFile({ file: imageFile });
        const imageUrl = uploadResponse.file_url;

        // Enviar via WhatsApp
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
            last_media_type: 'image'
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
  };

  return (
    <div className="flex flex-col h-full bg-white">
        {/* Header - Modo Broadcast ou Central de Inteligência do Cliente */}
        {mostrarInterfaceBroadcast ? (
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-3 border-b flex-shrink-0 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Envio em Massa</h3>
                  <p className="text-sm text-white/80">{contatosSelecionados.length} contato(s) selecionado(s)</p>
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
                  console.warn('Erro ao carregar foto:', e);
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
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Contatos selecionados:</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto">
            {contatosSelecionados.map((contato) => (
              <div key={contato.id} className="bg-white rounded-lg p-2 border border-orange-200 flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {(contato.nome || contato.telefone || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-800 truncate">{contato.nome || 'Sem nome'}</p>
                  <p className="text-[10px] text-slate-500 truncate">{contato.telefone}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ) : (
    <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-1 bg-[#efeae2]" style={{ backgroundImage: "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAMAAAAp4XiDAAAAUVBMVEWFhYWDg4N3d3dtbW17e3t1dXWBgYGHh4d5eXlzc3Oeli7////l5eXm5ubU1NTg4ODk5OTh4eHf39/e3t7d3d3c3NzS0tLX19fZ2dnPz8/R0dHLKKyVAAAAG3RSTlNAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAvEOwtAAABhklEQVRIx5WWW47DIAxFMTiYNwEC5NF9L/TPxFJpR5rMGRBfDhdn/XoXKMOGaVhmWQ/WwBEqLwKqrg6hcbKkSBAlR4qAIpNIYXAkI1IYFNEIMYJ4NAQKaAQQKKQRQKCYRgCBkhoAApU0AoiU1gAQKaMRQKSsRgCR8hoARCpoBBCpqBFApJJGAJEqGgBE6mgEEKmrAUCknkYAkfoaAEQaagQQaawRQKSJBgCR5hoBRFprBBBppxFApL1GAJEOGgBEOmoEEOmsEUCki0YAka4aAETaawQQGaIRQGSYRgCRkRoBRMZoBBCZoBFAZJJGAJGpGgFE5mkAEFmoEUBkqUYAkQ0aAUQ2agQQ2aQBQGSbRgCR7RoBRHZqBBDZpQFAZJ9GAJH9GgFEDmoEEDmkAUDkiEYAkaMaAUROaAQQOakBQOScRgCR8xoBRC5qBBC5pAFA5LpGAJEbGgFEbmoEELmjEUDkngYAkYcaAUSeaAQQeaoRQOSFBgCRtxoBRD5oBBD5pAFAhP4Bp4OMj0wjNOcAAAAASUVORK5CYII=')" }}>
        {mensagens.length === 0 ?
        <div className="flex items-center justify-center h-full">
            <p className="text-slate-400">Nenhuma mensagem ainda. Inicie a conversa!</p>
          </div> :
        (() => {
          // 🏷️ FILTRO POR CATEGORIA - Aplicado ANTES de todos os outros filtros
          let mensagensFiltradas = mensagens;

          if (selectedCategoria && selectedCategoria !== 'all') {
            mensagensFiltradas = mensagens.filter((m) => {
              const temCategoria = m.categorias && Array.isArray(m.categorias) && m.categorias.includes(selectedCategoria);
              return temCategoria;
            });
          }

          // Se não há mensagens após filtro de categoria, mostrar aviso
          if (mensagensFiltradas.length === 0 && selectedCategoria && selectedCategoria !== 'all') {
            return (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Tag className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 font-semibold">Nenhuma mensagem com esta etiqueta</p>
                  <p className="text-sm text-slate-400 mt-2">Remova o filtro para ver todas as mensagens</p>
                </div>
              </div>);

          }

          return mensagensFiltradas.
          filter((m) => {
            // ✅ SEMPRE MOSTRAR mensagens deletadas e de sistema legítimas
            if (m.metadata?.deleted) return true;
            if (m.metadata?.is_system_message) return true;

            const content = (m.content || '').trim();

            // ✅ SEMPRE MOSTRAR mensagens com mídia válida (imagem, vídeo, áudio, etc)
            if (m.media_url && m.media_type && m.media_type !== 'none') {
              return true;
            }

            // ❌ BLOQUEAR IMEDIATAMENTE: mensagens vazias sem mídia
            if (!content && (!m.media_url || m.media_type === 'none' || !m.media_type)) {
              return false;
            }

            // ❌ BLOQUEAR: +status@broadcast e variações
            if (/[\+\-\d\s]*status@broadcast/i.test(content)) {
              return false;
            }

            // ❌ BLOQUEAR: qualquer JID do WhatsApp (@broadcast, @lid, @s.whatsapp.net, @c.us)
            if (/@(broadcast|lid|s\.whatsapp\.net|c\.us)/i.test(content)) {
              return false;
            }

            // ❌ BLOQUEAR: status@ em qualquer posição
            if (/status@/i.test(content)) {
              return false;
            }

            // ❌ BLOQUEAR: JIDs iniciando com números/símbolos seguidos de @
            if (/^[\+\-\d\s]+@/i.test(content)) {
              return false;
            }

            // ❌ BLOQUEAR: apenas números e @ (telefones com @)
            if (/^\+?\d+@/i.test(content)) {
              return false;
            }

            // ❌ BLOQUEAR: palavras específicas isoladas
            if (/^(Adicionar|Referência|Mídia enviada|Media enviada)$/i.test(content)) {
              return false;
            }

            // ❌ BLOQUEAR: lista de conteúdos inválidos
            const conteudoInvalido = [
            'Mídia enviada',
            'Media enviada',
            'Adicionar',
            'Referência',
            '[No content]',
            '[Message content missing]',
            '[Recovered message]',
            ''];


            if (conteudoInvalido.includes(content)) {
              return false;
            }

            // ❌ BLOQUEAR: apenas caracteres especiais e números (sem texto real)
            if (/^[\+\-\s\d@\.]+$/.test(content) && content.length < 50) {
              return false;
            }

            // ❌ BLOQUEAR: prefixos inválidos
            if (content.startsWith('[Media type:')) {
              return false;
            }

            // ✅ Tipos especiais de mensagem (contato, localização)
            const tiposEspeciais = ['contact', 'location'];
            if (tiposEspeciais.includes(m.media_type) && content.length > 0) {
              return true;
            }

            // ✅ Mensagens com mídia válida
            if (m.media_url && m.media_type && m.media_type !== 'none') {
              return true;
            }

            // ✅ Mensagens com texto válido (mínimo 1 caractere real)
            if (content.length > 0) {
              return true;
            }

            // ❌ Bloquear tudo que não passou pelos filtros acima
            return false;
          }).
          map((mensagem, index) => {
            const isFirstUnread =
            mensagem.sender_type === 'contact' &&
            mensagem.status !== 'lida' &&
            mensagem.status !== 'apagada' && (
            index === 0 ||
            mensagens[index - 1] && (
            mensagens[index - 1].status === 'lida' ||
            mensagens[index - 1].status === 'apagada' ||
            mensagens[index - 1].sender_type === 'user'));



            return (
              <React.Fragment key={mensagem.id}>
                  {isFirstUnread && thread.unread_count > 0 &&
                <div
                  ref={unreadSeparatorRef}
                  className="flex items-center justify-center my-4">

                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-red-300 to-transparent"></div>
                      <span className="px-4 py-1 text-xs font-semibold text-red-600 bg-red-50 rounded-full border border-red-200 shadow-sm">
                        {thread.unread_count} {thread.unread_count === 1 ? 'mensagem não lida' : 'mensagens não lidas'}
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
                  onToggleSelecao={() => toggleSelecionarMensagem(mensagem.id)}
                  mensagens={mensagens}
                  integracoes={integracoes}
                  usuarioAtual={usuario}
                  contato={contatoCompleto}
                  atendentes={atendentesLista} />

                </React.Fragment>);

          });
        })()}
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

      {/* Sistema de Anexos Melhorado */}
      {mostrarMediaSystem &&
      <MediaAttachmentSystem
        onSend={() => {
          setMostrarMediaSystem(false);
          if (onAtualizarMensagens) {
            setTimeout(async () => {
              const novasMensagens = await base44.entities.Message.filter(
                { thread_id: thread.id },
                'created_date',
                500
              );
              onAtualizarMensagens(novasMensagens);
            }, 500);
          }
        }}
        disabled={enviando || carregandoContato || gravandoAudio || modoSelecao}
        replyToMessage={mensagemResposta}
        thread={thread}
        usuario={usuario}
        integrationIdOverride={canalSelecionado} />

      }

      <form onSubmit={(e) => {
        e.preventDefault();
        // Se tem imagem colada, enviar imagem em vez de texto
        if (pastedImage) {
          enviarImagemColada();
        } else {
          handleEnviar();
        }
      }} className="bg-[#d6dfe1] text-gray-950 px-3 rounded-lg border-t flex-shrink-0">

        {/* Banner de Broadcast quando em modo seleção múltipla */}
        {modoSelecaoMultipla && contatosSelecionados.length > 0 && (
          <div className="mb-2 p-2 bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Enviando para {contatosSelecionados.length} contato(s)
                </span>
              </div>
              <button
                type="button"
                onClick={onCancelarSelecao}
                className="text-white/80 hover:text-white text-xs underline"
              >
                Cancelar
              </button>
            </div>

            {/* Barra de progresso durante envio */}
            {enviandoBroadcast && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-white text-xs mb-1">
                  <span>Enviando...</span>
                  <span>{progressoBroadcast.enviados + progressoBroadcast.erros} / {progressoBroadcast.total}</span>
                </div>
                <div className="w-full h-1.5 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-300"
                    style={{
                      width: `${((progressoBroadcast.enviados + progressoBroadcast.erros) / progressoBroadcast.total) * 100}%`
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Seletor de Canal WhatsApp */}
        {integracoes.length > 1 && !modoSelecaoMultipla &&
        <div className="mb-2 flex items-center gap-2">
            <label className="text-gray-900 text-xs font-medium">Enviar por:</label>
            <select
            value={canalSelecionado || thread?.whatsapp_integration_id || ''}
            onChange={(e) => setCanalSelecionado(e.target.value)} className="bg-[#778ca6] text-slate-50 px-2 py-1 text-xs rounded border border-slate-300">


              {integracoes.map((int) =>
            <option key={int.id} value={int.id}>
                  📱 {int.nome_instancia} ({int.numero_telefone})
                </option>
            )}
            </select>
          </div>
        }
        
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon" className="bg-transparent text-slate-50 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-9 w-9 flex-shrink-0"

            disabled={enviando || carregandoContato || gravandoAudio || modoSelecao || !podeEnviarMidias}
            onClick={() => setMostrarMediaSystem(!mostrarMediaSystem)}
            title={!podeEnviarMidias ? "Sem permissão para enviar mídias" : "Anexar arquivo"}>

            <Paperclip className="w-5 h-5 text-slate-600" />
          </Button>

          <Button
            type="button"
            variant={gravandoAudio ? "destructive" : "ghost"}
            size="icon" className="text-zinc-950 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-9 w-9 flex-shrink-0"

            disabled={enviando || carregandoContato || modoSelecao || uploadingPastedFile || !podeEnviarAudios}
            onClick={gravandoAudio ? pararGravacaoAudio : iniciarGravacaoAudio}
            title={!podeEnviarAudios ? "Sem permissão para enviar áudios" : gravandoAudio ? "Parar gravação" : "Gravar áudio"}>

            {gravandoAudio ?
            <StopCircle className="w-5 h-5 animate-pulse" /> :

            <Mic className="w-5 h-5 text-slate-600" />
            }
          </Button>

          {ultimaMensagemCliente && podeEnviarMensagens && !mostrarSugestor &&
          <Button
            type="button"
            onClick={() => setMostrarSugestor(true)}
            variant="ghost"
            size="icon" className="text-red-600 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:text-accent-foreground h-9 w-9 flex-shrink-0 hover:bg-purple-50"

            title="Sugestões de IA"
            disabled={enviando || carregandoContato || gravandoAudio || modoSelecao || uploadingPastedFile}>

              <Sparkles className="w-5 h-5" />
            </Button>
          }

          <div className="flex-1">
            {/* Preview da imagem colada */}
            {pastedImagePreview &&
            <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <img
                  src={pastedImagePreview}
                  alt="Preview"
                  className="w-20 h-20 object-cover rounded-lg border border-blue-300" />

                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-800 mb-1">📷 Imagem colada</p>
                    <p className="text-xs text-blue-600">Digite uma legenda (opcional) e clique em enviar</p>
                  </div>
                  <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={cancelarImagemColada}
                  className="h-6 w-6 text-blue-600 hover:text-blue-800 hover:bg-blue-100">

                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            }
            
            <textarea
              ref={inputRef}
              value={mensagemTexto}
              onChange={(e) => setMensagemTexto(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={pastedImagePreview ? "Digite uma legenda para a imagem..." : !podeEnviarMensagens ? "Sem permissão para enviar mensagens" : "Digite sua mensagem... (Ctrl+V para colar imagem)"}
              rows={Math.max(1, Math.min(5, mensagemTexto.split('\n').length))}
              className="w-full p-3 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
              disabled={enviando || carregandoContato || gravandoAudio || modoSelecao || uploadingPastedFile || !podeEnviarMensagens} />

          </div>
          
          {pastedImagePreview ?
          <Button
            type="button"
            onClick={enviarImagemColada}
            disabled={enviando || carregandoContato || uploadingPastedFile || !podeEnviarMidias}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white flex-shrink-0"
            title="Enviar imagem colada">
              {uploadingPastedFile ?
            <Loader2 className="w-5 h-5 animate-spin" /> :

            <>
                  <ImageIcon className="w-4 h-4 mr-1" />
                  <Send className="w-4 h-4" />
                </>
            }
            </Button> :

          <Button
            type="submit"
            disabled={!mensagemTexto.trim() || enviando || enviandoBroadcast || carregandoContato || gravandoAudio || modoSelecao || uploadingPastedFile || !podeEnviarMensagens}
            className={`${modoSelecaoMultipla && contatosSelecionados.length > 0 ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600' : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'} text-white flex-shrink-0`}
            title={!podeEnviarMensagens ? "Sem permissão para enviar mensagens" : modoSelecaoMultipla ? `Enviar para ${contatosSelecionados.length} contato(s)` : "Enviar mensagem"}>

              {enviando || enviandoBroadcast ?
            <Loader2 className="w-5 h-5 animate-spin" /> :

            <Send className="w-5 h-5" />
            }
            </Button>
          }
        </div>

        {mostrarSugestor &&
        <div className="mt-2 border border-purple-200 rounded-lg bg-purple-50/50 p-3">
            <SugestorRespostasRapidas
            mensagemCliente={ultimaMensagemCliente}
            threadId={thread.id}
            contactId={thread.contact_id}
            onUseResposta={(conteudo) => {
              setMensagemTexto(conteudo);
              setMostrarSugestor(false);
            }}
            onClose={() => setMostrarSugestor(false)} />

          </div>
        }
      </form>

      {/* Modal removido - agora usa MediaAttachmentSystem */}

      {/* MODAL DE ATRIBUIÇÃO/TRANSFERÊNCIA - NOVO COMPONENTE */}
      <AtribuirConversaModal
        isOpen={mostrarModalAtribuicao}
        onClose={() => setMostrarModalAtribuicao(false)}
        thread={thread}
        usuario={usuario}
        contatoNome={contatoCompleto?.nome || 'Cliente'}
        onSuccess={() => {
          if (onAtualizarMensagens) {
            setTimeout(async () => {
              const novasMensagens = await base44.entities.Message.filter(
                { thread_id: thread.id },
                'created_date',
                500
              );
              onAtualizarMensagens(novasMensagens);
            }, 500);
          }
        }}
      />
    </div>);

}