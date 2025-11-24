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
  Briefcase } from
"lucide-react";
import MessageBubble from "./MessageBubble";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import html2canvas from "html2canvas";
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

export default function ChatWindow({
  thread,
  mensagens,
  usuario,
  onEnviarMensagem,
  onShowContactInfo,
  onAtualizarMensagens,
  integracoes = [],
  selectedCategoria = 'all'
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

  const [vendedores, setVendedores] = useState([]);
  const [atendentesLista, setAtendentesLista] = useState([]);

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
  const podeTransferirConversas = permissoes.pode_transferir_conversas !== false;

  const navigate = useNavigate();

  // ✅ TODOS OS useEffect NO TOPO - ANTES DE QUALQUER RETURN
  useEffect(() => {
    const carregarDados = async () => {
      try {
        const [vend, atend] = await Promise.all([
        base44.entities.Vendedor.list('nome'),
        base44.entities.User.filter({ is_whatsapp_attendant: true }, 'full_name')]
        );
        setVendedores(vend);
        setAtendentesLista(atend);
      } catch (error) {
        console.error('[ChatWindow] Erro ao carregar dados:', error);
      }
    };
    carregarDados();
  }, []);

  useEffect(() => {
    const carregarContato = async () => {
      if (!thread?.contact_id) {
        setContatoCompleto(null);
        setCarregandoContato(false);
        return;
      }

      setCarregandoContato(true);

      try {
        const contato = await base44.entities.Contact.get(thread.contact_id);
        setContatoCompleto(contato);

        const isContatoReal = contato.telefone && 
          !/^[\+\d\s]+@(lid|broadcast|s\.whatsapp\.net|c\.us)/i.test(contato.telefone) &&
          !/^[\+\d\s]+@/i.test(contato.nome || '');

        if (isContatoReal && thread.whatsapp_integration_id && contato.telefone) {
          const deveBuscarFoto = !contato.foto_perfil_url ||
            !contato.foto_perfil_atualizada_em ||
            new Date() - new Date(contato.foto_perfil_atualizada_em) > 24 * 60 * 60 * 1000;

          const chaveCache = `${contato.id}-${thread.whatsapp_integration_id}`;

          if (deveBuscarFoto && !fotoJaBuscada.current.has(chaveCache)) {
            fotoJaBuscada.current.add(chaveCache);

            setTimeout(async () => {
              try {
                // Buscar foto e nome em paralelo
                const [resultadoFoto, resultadoNome] = await Promise.all([
                  base44.functions.invoke('buscarFotoPerfilWhatsApp', {
                    integration_id: thread.whatsapp_integration_id,
                    phone: contato.telefone
                  }),
                  base44.functions.invoke('buscarNomeContatoWhatsApp', {
                    integration_id: thread.whatsapp_integration_id,
                    phone: contato.telefone
                  })
                ]);

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

                if (Object.keys(updates).length > 0) {
                  await base44.entities.Contact.update(contato.id, updates);

                  setContatoCompleto((prev) => {
                    if (!prev || prev.id !== contato.id) return prev;
                    return { ...prev, ...updates };
                  });
                }
              } catch (error) {
                console.warn('Erro ao buscar dados:', error.message);
              }
            }, 500);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar contato:', error);
        if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
          toast.warning('Muitas requisições. Aguarde alguns segundos...', { duration: 5000 });
        } else {
          toast.error('Erro ao carregar informações do contato');
        }
        setContatoCompleto(null);
      } finally {
        setCarregandoContato(false);
      }
    };

    carregarContato();
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
    if (mostrarModalAtribuicao && atendentes.length === 0) {
      carregarAtendentes();
    }
  }, [mostrarModalAtribuicao]);

  const carregarAtendentes = async () => {
    setCarregandoAtendentes(true);
    try {
      const users = await base44.entities.User.filter({ is_whatsapp_attendant: true }, 'full_name');
      setAtendentes(users);
    } catch (error) {
      console.error('[CHAT] Erro ao carregar atendentes:', error);
      toast.error("Erro ao carregar lista de atendentes");
    } finally {
      setCarregandoAtendentes(false);
    }
  };

  const handleAtribuirConversa = async (atendenteId) => {
    if (!podeTransferirConversas) {
      toast.error("❌ Você não tem permissão para transferir conversas");
      return;
    }

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

      await base44.entities.Message.create({
        thread_id: thread.id,
        sender_id: usuario.id,
        sender_type: 'user',
        recipient_id: thread.contact_id,
        recipient_type: 'contact',
        content: `🔔 Conversa ${thread.assigned_user_id ? 'transferida' : 'atribuída'} para ${atendenteEscolhido.full_name} por ${usuario.full_name}`,
        channel: 'interno',
        status: 'enviada',
        sent_at: new Date().toISOString(),
        metadata: {
          is_system_message: true,
          action_type: 'assignment'
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

  const handleEnviar = async (e) => {
    e?.preventDefault();

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
    if (!chatContainerRef.current) {
      toast.error('Área de conversa não encontrada');
      return;
    }

    setCapturandoTela(true);
    toast.info('📸 Capturando conversa...', { duration: 2000 });

    try {
      const canvas = await html2canvas(chatContainerRef.current, {
        backgroundColor: '#e5ddd5',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true
      });

      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error('Erro ao gerar imagem');
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const nomeContato = contatoCompleto?.nome || 'Conversa';
        const timestamp = new Date().toISOString().split('T')[0];

        link.href = url;
        link.download = `VendaPro_Chat_${nomeContato}_${timestamp}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success('✅ Conversa capturada com sucesso!');
      }, 'image/png');

    } catch (error) {
      console.error('[CHAT] Erro ao capturar tela:', error);
      toast.error('❌ Erro ao capturar conversa');
    } finally {
      setCapturandoTela(false);
    }
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

  if (!thread) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="text-center">
          <MessageSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-xl font-semibold text-slate-600">Selecione uma conversa</p>
          <p className="text-sm text-slate-400 mt-2">ou digite um número para criar contato</p>
        </div>
      </div>);

  }

  if (carregandoContato) {
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

  const tiposContato = [
  { value: 'lead', label: 'Lead', icon: '🎯' },
  { value: 'cliente', label: 'Cliente', icon: '💎' },
  { value: 'fornecedor', label: 'Fornecedor', icon: '🏭' },
  { value: 'parceiro', label: 'Parceiro', icon: '🤝' }];

  const tipoAtual = tiposContato.find((t) => t.value === contatoCompleto?.tipo_contato);

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
      handleEnviar();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header com Cards de Classificação */}
      <div className="bg-[#d7cecc] p-4 rounded-md border-b from-slate-50 to-blue-50 flex-shrink-0 space-y-3">
        <div className="flex items-center gap-4">
          {/* Avatar e Nome à Esquerda */}
          <div className="flex items-center gap-3 flex-1">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg flex-shrink-0 overflow-hidden relative bg-gradient-to-br from-amber-400 via-orange-500 to-red-500">
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
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 truncate">{nomeContato}</h3>
                <CategorizadorRapido
                  thread={thread}
                  onUpdate={onAtualizarMensagens} />

              </div>
              <p className="text-xs text-slate-500">{telefoneExibicao}</p>
            </div>
          </div>

          {/* Cards de Classificação à Direita - Padronizados */}
          <div className="flex gap-2 overflow-x-auto flex-1 justify-end">
            {/* Card Tipo */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg px-3 shadow-md h-[1cm] flex items-center gap-2 flex-shrink-0 hover:shadow-lg transition-shadow">
              <Tag className="w-4 h-4" />
              <div className="flex flex-col justify-center">
                <span className="text-[10px] font-semibold opacity-90">Tipo</span>
                <select
                  value={contatoCompleto?.tipo_contato || 'lead'}
                  onChange={(e) => handleAtualizarContato('tipo_contato', e.target.value)}
                  className="bg-transparent border-0 text-white text-xs focus:outline-none cursor-pointer -mt-1"
                  disabled={!podeTransferirConversas}>

                  {tiposContato.map((tipo) =>
                  <option key={tipo.value} value={tipo.value}>{tipo.icon} {tipo.label}</option>
                  )}
                </select>
              </div>
            </div>

            {/* Card Atendente Fornecedor */}
            {contatoCompleto?.tipo_contato === 'fornecedor' &&
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg px-3 shadow-md h-[1cm] flex items-center gap-2 flex-shrink-0 hover:shadow-lg transition-shadow">
                <User className="w-4 h-4" />
                <div className="flex flex-col justify-center">
                  <span className="text-[10px] font-semibold opacity-90">Atendente</span>
                  <select
                  value={contatoCompleto?.atendente_fidelizado_fornecedor || "nao"}
                  onChange={(e) => handleAtualizarContato('atendente_fidelizado_fornecedor', e.target.value === "nao" ? "" : e.target.value)}
                  className="bg-transparent border-0 text-white text-xs focus:outline-none cursor-pointer -mt-1"
                  disabled={!podeTransferirConversas}>

                    <option value="nao">Não atribuído</option>
                    {atendentesLista.map((a) => <option key={a.id} value={a.full_name}>{a.full_name}</option>)}
                  </select>
                </div>
              </div>
            }

            {/* Card Atendente Cliente */}
            {contatoCompleto?.tipo_contato === 'cliente' &&
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg px-3 shadow-md h-[1cm] flex items-center gap-2 flex-shrink-0 hover:shadow-lg transition-shadow">
                <User className="w-4 h-4" />
                <div className="flex flex-col justify-center">
                  <span className="text-[10px] font-semibold opacity-90">Atendente</span>
                  <select
                  value={contatoCompleto?.atendente_fidelizado_vendas || "nao"}
                  onChange={(e) => handleAtualizarContato('atendente_fidelizado_vendas', e.target.value === "nao" ? "" : e.target.value)}
                  className="bg-transparent border-0 text-white text-xs focus:outline-none cursor-pointer -mt-1"
                  disabled={!podeTransferirConversas}>

                    <option value="nao">Não atribuído</option>
                    {atendentesLista.map((a) => <option key={a.id} value={a.full_name}>{a.full_name}</option>)}
                  </select>
                </div>
              </div>
            }

            {/* Card Vendedor */}
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-lg px-3 shadow-md h-[1cm] flex items-center gap-2 flex-shrink-0 hover:shadow-lg transition-shadow">
              <Briefcase className="w-4 h-4" />
              <div className="flex flex-col justify-center">
                <span className="text-[10px] font-semibold opacity-90">Vendedor</span>
                <select
                  value={contatoCompleto?.vendedor_responsavel || "nao"}
                  onChange={(e) => handleAtualizarContato('vendedor_responsavel', e.target.value === "nao" ? "" : e.target.value)}
                  className="bg-transparent border-0 text-white text-xs focus:outline-none cursor-pointer -mt-1"
                  disabled={!podeTransferirConversas}>

                  <option value="nao">Não atribuído</option>
                  {vendedores.map((v) => <option key={v.id} value={v.nome}>{v.nome}</option>)}
                </select>
              </div>
            </div>

            {/* Card Transferir */}
            {canManageConversation && podeTransferirConversas &&
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-lg px-3 shadow-md h-[1cm] flex items-center gap-2 flex-shrink-0 hover:shadow-lg transition-shadow">
                <Users className="w-4 h-4" />
                <div className="flex flex-col justify-center">
                  <span className="text-[10px] font-semibold opacity-90">Ação</span>
                  <button
                  onClick={() => setMostrarModalAtribuicao(true)}
                  className="bg-transparent border-0 text-white text-xs focus:outline-none cursor-pointer hover:opacity-90 transition-opacity -mt-1 text-left">

                    Transferir
                  </button>
                </div>
              </div>
            }
          </div>

          {/* Botão Ver Detalhes */}
          <div
            onClick={onShowContactInfo}
            className="bg-gradient-to-br from-slate-600 to-slate-700 text-white rounded-lg px-3 shadow-md h-[1cm] flex items-center gap-2 hover:from-slate-700 hover:to-slate-800 hover:shadow-lg transition-all cursor-pointer flex-shrink-0">

            <Info className="w-4 h-4" />
            <div className="flex flex-col justify-center">
              <span className="text-[10px] font-semibold opacity-90">Ver</span>
              <span className="text-xs -mt-1">Detalhes</span>
            </div>
            </div>
            </div>


            </div>

            {mensagemResposta &&
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

      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
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
              ''
            ];

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
                  mensagens={mensagens} />

                </React.Fragment>);

          });
        })()}
        <div ref={messagesEndRef} />
      </div>

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
        usuario={usuario} />

      }

      <form onSubmit={handleEnviar} className="p-4 border-t bg-white flex-shrink-0">
        {/* Seletor de Canal WhatsApp */}
        {integracoes.length > 1 &&
        <div className="mb-2 flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600">Enviar por:</label>
            <select
            value={canalSelecionado || thread.whatsapp_integration_id || ''}
            onChange={(e) => setCanalSelecionado(e.target.value)}
            className="text-xs px-2 py-1 border border-slate-300 rounded bg-white">

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
            size="icon"
            className="flex-shrink-0"
            disabled={enviando || carregandoContato || gravandoAudio || modoSelecao || !podeEnviarMidias}
            onClick={() => setMostrarMediaSystem(!mostrarMediaSystem)}
            title={!podeEnviarMidias ? "Sem permissão para enviar mídias" : "Anexar arquivo"}>

            <Paperclip className="w-5 h-5 text-slate-600" />
          </Button>

          <Button
            type="button"
            variant={gravandoAudio ? "destructive" : "ghost"}
            size="icon"
            className="flex-shrink-0"
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
            size="icon"
            className="flex-shrink-0 text-purple-600 hover:bg-purple-50"
            title="Sugestões de IA"
            disabled={enviando || carregandoContato || gravandoAudio || modoSelecao || uploadingPastedFile}>

              <Sparkles className="w-5 h-5" />
            </Button>
          }

          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={mensagemTexto}
              onChange={(e) => setMensagemTexto(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={!podeEnviarMensagens ? "Sem permissão para enviar mensagens" : "Digite sua mensagem..."}
              rows={Math.max(1, Math.min(5, mensagemTexto.split('\n').length))}
              className="w-full p-3 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
              disabled={enviando || carregandoContato || gravandoAudio || modoSelecao || uploadingPastedFile || !podeEnviarMensagens} />

          </div>
          
          <Button
            type="submit"
            disabled={!mensagemTexto.trim() || enviando || carregandoContato || gravandoAudio || modoSelecao || uploadingPastedFile || !podeEnviarMensagens}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white flex-shrink-0"
            title={!podeEnviarMensagens ? "Sem permissão para enviar mensagens" : "Enviar mensagem"}>

            {enviando ?
            <Loader2 className="w-5 h-5 animate-spin" /> :

            <Send className="w-5 h-5" />
            }
          </Button>
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

      {/* MODAL DE ATRIBUIÇÃO */}
      <Dialog open={mostrarModalAtribuicao} onOpenChange={setMostrarModalAtribuicao}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {thread?.assigned_user_id ? 'Transferir Conversa' : 'Atribuir Conversa'}
            </DialogTitle>
            <DialogDescription>
              Selecione o atendente que será responsável por esta conversa
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {carregandoAtendentes ?
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div> :
            atendentes.length === 0 ?
            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhum atendente disponível. Configure atendentes em Configurações.
                </AlertDescription>
              </Alert> :

            <div className="grid gap-2">
                {atendentes.map((atendente) =>
              <Button
                key={atendente.id}
                onClick={() => handleAtribuirConversa(atendente.id)}
                disabled={atribuindo || thread?.assigned_user_id === atendente.id}
                variant="outline"
                className="w-full justify-start h-auto py-3">

                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                        {atendente.full_name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-semibold">{atendente.full_name}</p>
                        <p className="text-xs text-slate-500">{atendente.email}</p>
                      </div>
                      {thread?.assigned_user_id === atendente.id &&
                  <CheckSquare className="w-5 h-5 text-green-600" />
                  }
                    </div>
                  </Button>
              )}
              </div>
            }
          </div>
        </DialogContent>
      </Dialog>
    </div>);

}