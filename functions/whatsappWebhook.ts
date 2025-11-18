import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  WHATSAPP WEBHOOK - EVOLUTION API                           ║
 * ║  Versão: ESTABILIZADA - Validação Rigorosa + Mídia         ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * Processa eventos da Evolution API com:
 * - Validação rigorosa de payload
 * - Tratamento robusto de erros
 * - Download e persistência de mídia
 * - Processamento assíncrono de IA
 */

Deno.serve(async (req) => {
  console.log('[WEBHOOK] ═══════════════════════════════════════════════');
  console.log('[WEBHOOK] 📨 Webhook recebido');
  console.log('[WEBHOOK] ═══════════════════════════════════════════════');

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // ═══════════════════════════════════════════════════════════
    // 1. INICIALIZAR BASE44 COM SERVICE ROLE
    // ═══════════════════════════════════════════════════════════
    const { createClient } = await import('npm:@base44/sdk@0.7.1');
    const base44 = createClient({
      appId: Deno.env.get('BASE44_APP_ID'),
      apiKey: Deno.env.get('BASE44_SERVICE_ROLE_KEY')
    });

    console.log('[WEBHOOK] ✅ Base44 inicializado (Service Role)');

    // ═══════════════════════════════════════════════════════════
    // 2. VALIDAÇÃO DO PAYLOAD
    // ═══════════════════════════════════════════════════════════
    let evento;
    try {
      evento = await req.json();
    } catch (e) {
      console.error('[WEBHOOK] ❌ Payload JSON inválido:', e);
      return Response.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 200, headers: corsHeaders }
      );
    }

    const { event, instance, data } = evento;

    if (!event || !instance) {
      console.warn('[WEBHOOK] ⚠️ Campos obrigatórios faltando (event ou instance)');
      return Response.json(
        { success: true, ignored: 'missing_required_fields' },
        { status: 200, headers: corsHeaders }
      );
    }

    console.log(`[WEBHOOK] 📋 Evento: ${event} | Instância: ${instance}`);
    console.log('[WEBHOOK] 📦 Data:', JSON.stringify(data, null, 2));

    // ═══════════════════════════════════════════════════════════
    // 3. PROCESSAR EVENTO
    // ═══════════════════════════════════════════════════════════
    switch (event) {
      case 'qrcode.updated':
        return await processarQRCodeUpdate(instance, data, base44, corsHeaders);

      case 'connection.update':
        return await processarConnectionUpdate(instance, data, base44, corsHeaders);

      case 'messages.upsert':
        return await processarMensagemRecebida(instance, data, base44, corsHeaders);

      case 'messages.update':
        return await processarMensagemUpdate(data, base44, corsHeaders);

      case 'send.message':
        console.log('[WEBHOOK] ℹ️ Evento send.message (confirmação de envio)');
        return Response.json(
          { success: true, processed: 'send_confirmation' },
          { status: 200, headers: corsHeaders }
        );

      default:
        console.log(`[WEBHOOK] ⚠️ Evento não tratado: ${event}`);
        return Response.json(
          { success: true, ignored: 'unknown_event', event },
          { status: 200, headers: corsHeaders }
        );
    }

  } catch (error) {
    console.error('[WEBHOOK] ❌ ERRO FATAL:', error);
    console.error('[WEBHOOK] Stack:', error.stack);

    // SEMPRE retornar 200 para evitar retry infinito da Evolution API
    return Response.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 200, headers: corsHeaders }
    );
  }
});

/**
 * ═══════════════════════════════════════════════════════════════
 * PROCESSADORES ESPECÍFICOS POR TIPO DE EVENTO
 * ═══════════════════════════════════════════════════════════════
 */

async function processarQRCodeUpdate(instance, data, base44, corsHeaders) {
  console.log('[WEBHOOK] 🔄 Processando atualização de QR Code');

  try {
    const integracoes = await base44.entities.WhatsAppIntegration.filter({
      nome_instancia: instance
    });

    if (integracoes.length === 0) {
      console.warn(`[WEBHOOK] ⚠️ Nenhuma integração encontrada para instância: ${instance}`);
      return Response.json(
        { success: true, warning: 'integration_not_found' },
        { status: 200, headers: corsHeaders }
      );
    }

    await base44.entities.WhatsAppIntegration.update(integracoes[0].id, {
      qr_code_url: data.qrcode || data.qr,
      status: 'pendente_qrcode',
      ultima_atividade: new Date().toISOString()
    });

    console.log('[WEBHOOK] ✅ QR Code atualizado com sucesso');

    return Response.json(
      { success: true, processed: 'qrcode_updated' },
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[WEBHOOK] ❌ Erro ao processar QR Code:', error);
    throw error;
  }
}

async function processarConnectionUpdate(instance, data, base44, corsHeaders) {
  console.log('[WEBHOOK] 🔄 Processando atualização de conexão');

  try {
    const integracoes = await base44.entities.WhatsAppIntegration.filter({
      nome_instancia: instance
    });

    if (integracoes.length === 0) {
      console.warn(`[WEBHOOK] ⚠️ Nenhuma integração encontrada para instância: ${instance}`);
      return Response.json(
        { success: true, warning: 'integration_not_found' },
        { status: 200, headers: corsHeaders }
      );
    }

    let novoStatus = 'desconectado';

    if (data.state === 'open' || data.status === 'open') {
      novoStatus = 'conectado';
    } else if (data.state === 'connecting') {
      novoStatus = 'reconectando';
    } else if (data.state === 'close' || data.status === 'close') {
      novoStatus = 'desconectado';
    }

    await base44.entities.WhatsAppIntegration.update(integracoes[0].id, {
      status: novoStatus,
      ultima_atividade: new Date().toISOString()
    });

    console.log(`[WEBHOOK] ✅ Status de conexão atualizado para: ${novoStatus}`);

    return Response.json(
      { success: true, processed: 'connection_updated', status: novoStatus },
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[WEBHOOK] ❌ Erro ao processar conexão:', error);
    throw error;
  }
}

async function processarMensagemRecebida(instance, data, base44, corsHeaders) {
  console.log('[WEBHOOK] 💬 Processando mensagem recebida');

  try {
    // ═══════════════════════════════════════════════════════════
    // VALIDAÇÃO RIGOROSA
    // ═══════════════════════════════════════════════════════════
    if (!data.messages || !Array.isArray(data.messages) || data.messages.length === 0) {
      console.warn('[WEBHOOK] ⚠️ Estrutura messages ausente ou vazia');
      return Response.json(
        { success: true, ignored: 'invalid_message_format' },
        { status: 200, headers: corsHeaders }
      );
    }

    const mensagem = data.messages[0];

    if (!mensagem.key || !mensagem.key.remoteJid || !mensagem.message) {
      console.warn('[WEBHOOK] ⚠️ Campos obrigatórios faltando na mensagem');
      return Response.json(
        { success: true, ignored: 'invalid_message_format' },
        { status: 200, headers: corsHeaders }
      );
    }

    // Ignorar mensagens próprias
    if (mensagem.key.fromMe) {
      console.log('[WEBHOOK] ℹ️ Mensagem própria ignorada');
      return Response.json(
        { success: true, ignored: 'own_message' },
        { status: 200, headers: corsHeaders }
      );
    }

    // ═══════════════════════════════════════════════════════════
    // EXTRAÇÃO DE DADOS
    // ═══════════════════════════════════════════════════════════
    const numero = mensagem.key.remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
    const numeroFormatado = numero.startsWith('+') ? numero : `+${numero}`;

    // Extrair conteúdo e tipo de mídia
    let conteudo = '[Mensagem vazia]';
    let mediaType = 'none';
    let mediaUrl = null;

    if (mensagem.message.conversation) {
      conteudo = mensagem.message.conversation;
    } else if (mensagem.message.extendedTextMessage?.text) {
      conteudo = mensagem.message.extendedTextMessage.text;
    } else if (mensagem.message.imageMessage) {
      conteudo = mensagem.message.imageMessage.caption || '[Imagem]';
      mediaType = 'image';
      mediaUrl = mensagem.message.imageMessage.url;
    } else if (mensagem.message.videoMessage) {
      conteudo = mensagem.message.videoMessage.caption || '[Vídeo]';
      mediaType = 'video';
      mediaUrl = mensagem.message.videoMessage.url;
    } else if (mensagem.message.audioMessage) {
      conteudo = '[Áudio]';
      mediaType = 'audio';
      mediaUrl = mensagem.message.audioMessage.url;
    } else if (mensagem.message.documentMessage) {
      conteudo = mensagem.message.documentMessage.fileName || '[Documento]';
      mediaType = 'document';
      mediaUrl = mensagem.message.documentMessage.url;
    } else if (mensagem.message.stickerMessage) {
      conteudo = '[Figurinha]';
      mediaType = 'sticker';
    }

    console.log(`[WEBHOOK] 📱 Número: ${numeroFormatado}`);
    console.log(`[WEBHOOK] 💬 Conteúdo: ${conteudo.substring(0, 50)}...`);
    console.log(`[WEBHOOK] 📎 Tipo de mídia: ${mediaType}`);

    // ═══════════════════════════════════════════════════════════
    // FLUXO TRANSACIONAL MANUAL (SEM SDK TRANSACTION)
    // ═══════════════════════════════════════════════════════════
    let contatoCriado = null;
    let threadCriada = null;
    let mensagemCriada = null;

    try {
      // PASSO 1: BUSCAR OU CRIAR CONTACT
      let contatos = await base44.entities.Contact.filter({ telefone: numeroFormatado });
      let contato;

      if (contatos.length === 0) {
        console.log('[WEBHOOK] 👤 Criando novo contato');
        contato = await base44.entities.Contact.create({
          nome: mensagem.pushName || numeroFormatado,
          telefone: numeroFormatado,
          tipo_contato: 'lead',
          whatsapp_status: 'verificado',
          ultima_interacao: new Date().toISOString()
        });
        contatoCriado = contato;
      } else {
        contato = contatos[0];
        await base44.entities.Contact.update(contato.id, {
          ultima_interacao: new Date().toISOString()
        });
        console.log(`[WEBHOOK] ✅ Contato existente: ${contato.nome}`);
      }

      // PASSO 2: BUSCAR WHATSAPP INTEGRATION POR NOME DA INSTÂNCIA OU INSTANCE_ID
      console.log(`[WEBHOOK] 🔍 Buscando integração para instance: ${instance}`);
      
      let integracoes = await base44.entities.WhatsAppIntegration.filter({
        nome_instancia: instance
      });

      // 🆕 FALLBACK: Se não encontrou por nome, tenta por instance_id_provider
      if (integracoes.length === 0 && instance) {
        console.log(`[WEBHOOK] 🔄 Tentando buscar por instance_id_provider: ${instance}`);
        integracoes = await base44.entities.WhatsAppIntegration.filter({
          instance_id_provider: instance
        });
      }

      let integracaoId = null;
      if (integracoes.length > 0) {
        integracaoId = integracoes[0].id;
        console.log(`[WEBHOOK] ✅ WhatsAppIntegration encontrada:`, {
          id: integracaoId,
          nome: integracoes[0].nome_instancia,
          numero: integracoes[0].numero_telefone,
          instance_id: integracoes[0].instance_id_provider
        });
        
        // Atualizar estatísticas de recebimento
        await base44.entities.WhatsAppIntegration.update(integracaoId, {
          'estatisticas.total_mensagens_recebidas': (integracoes[0].estatisticas?.total_mensagens_recebidas || 0) + 1,
          ultima_atividade: new Date().toISOString(),
          status: 'conectado' // 🆕 Atualizar status para conectado ao receber mensagem
        });
      } else {
        console.warn(`[WEBHOOK] ⚠️ Nenhuma WhatsAppIntegration encontrada para instância: ${instance}`);
      }

      // PASSO 3: BUSCAR OU CRIAR THREAD
      let threads = await base44.entities.MessageThread.filter({ contact_id: contato.id });
      let thread;

      if (threads.length === 0) {
        console.log('[WEBHOOK] 💬 Criando nova thread');
        thread = await base44.entities.MessageThread.create({
          contact_id: contato.id,
          whatsapp_integration_id: integracaoId,
          status: 'aberta',
          primeira_mensagem_at: new Date().toISOString(),
          ultima_atividade: new Date().toISOString(),
          janela_24h_expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          can_send_without_template: true,
          total_mensagens: 0,
          unread_count: 0
        });
        threadCriada = thread;
      } else {
        thread = threads[0];
        // Renovar janela 24h e atualizar integration_id se necessário
        const updateData = {
          janela_24h_expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          can_send_without_template: true,
          ultima_atividade: new Date().toISOString()
        };
        
        if (integracaoId && !thread.whatsapp_integration_id) {
          updateData.whatsapp_integration_id = integracaoId;
        }
        
        await base44.entities.MessageThread.update(thread.id, updateData);
        console.log(`[WEBHOOK] ✅ Thread existente: ${thread.id}`);
      }

      // PASSO 3: PERSISTIR MÍDIA (SE HOUVER)
      let mediaUrlPermanente = null;
      if (mediaType !== 'none' && mediaUrl) {
        console.log('[WEBHOOK] 📥 Baixando e persistindo mídia...');
        mediaUrlPermanente = await baixarEPersistirMidia(mediaUrl, mediaType, base44);
      }

      // PASSO 4: CRIAR MESSAGE
      console.log('[WEBHOOK] 📝 Criando message');
      const message = await base44.entities.Message.create({
        thread_id: thread.id,
        sender_id: contato.id,
        sender_type: 'contact',
        content: conteudo,
        media_url: mediaUrlPermanente || mediaUrl,
        media_type: mediaType,
        channel: 'whatsapp',
        status: 'entregue',
        whatsapp_message_id: mensagem.key.id,
        sent_at: new Date((mensagem.messageTimestamp || Date.now() / 1000) * 1000).toISOString(),
        delivered_at: new Date().toISOString()
      });
      mensagemCriada = message;

      // 🆕 NOVO: Registrar indicador de digitação se aplicável
      if (data.isTyping || data.typing) {
        try {
          await base44.entities.AutomationLog.create({
            acao: 'typing_indicator',
            thread_id: thread.id,
            contato_id: contato.id,
            resultado: 'sucesso',
            timestamp: new Date().toISOString(),
            detalhes: {
              mensagem: 'Contato está digitando'
            },
            origem: 'webhook',
            prioridade: 'baixa'
          });
          console.log('[WEBHOOK] ✅ Typing indicator registrado.');
        } catch (err) {
          console.error('[WEBHOOK] Erro ao registrar typing:', err);
        }
      }

      // 🆕 NOVO: Atualizar status de entrega
      // Note: A mensagem é criada com status 'entregue' por padrão, então este bloco
      // só teria efeito se o status inicial fosse 'enviando' por alguma razão futura.
      if (message.status === 'enviando') {
        await base44.entities.Message.update(message.id, {
          status: 'entregue',
          delivered_at: new Date().toISOString()
        });
        console.log(`[WEBHOOK] ✅ Status da mensagem atualizado para 'entregue' (do estado 'enviando').`);
      }

      // PASSO 5: ATUALIZAR THREAD
      console.log('[WEBHOOK] 🔄 Atualizando thread');
      await base44.entities.MessageThread.update(thread.id, {
        last_message_content: conteudo.substring(0, 100),
        last_message_at: new Date().toISOString(),
        last_message_sender: 'contact',
        unread_count: (thread.unread_count || 0) + 1,
        total_mensagens: (thread.total_mensagens || 0) + 1
      });

      // PASSO 6: CRIAR INTERAÇÃO (SE CLIENTE ASSOCIADO)
      if (contato.cliente_id) {
        console.log('[WEBHOOK] 📊 Criando interação');
        await base44.entities.Interacao.create({
          cliente_id: contato.cliente_id,
          cliente_nome: contato.empresa || contato.nome,
          contact_id: contato.id,
          thread_id: thread.id,
          tipo_interacao: 'whatsapp',
          data_interacao: new Date().toISOString(),
          resultado: 'sucesso',
          observacoes: conteudo.substring(0, 500)
        });
      }

      // PASSO 7: PROCESSAR COM IA (ASSÍNCRONO - NÃO BLOQUEIA WEBHOOK)
      processarComIAAsync(thread, message, base44).catch(error => {
        console.error('[WEBHOOK] ⚠️ Erro no processamento assíncrono de IA:', error);
      });

      console.log('[WEBHOOK] ✅ Mensagem processada com sucesso');

      return Response.json(
        {
          success: true,
          processed: 'message_saved',
          contact_id: contato.id,
          thread_id: thread.id,
          message_id: message.id
        },
        { status: 200, headers: corsHeaders }
      );

    } catch (error) {
      // ROLLBACK MANUAL em caso de erro
      console.error('[WEBHOOK] ❌ ERRO no fluxo transacional:', error);

      if (mensagemCriada) {
        await base44.entities.Message.delete(mensagemCriada.id).catch(e =>
          console.error('[WEBHOOK] Erro ao deletar mensagem no rollback:', e)
        );
      }

      if (threadCriada) {
        await base44.entities.MessageThread.delete(threadCriada.id).catch(e =>
          console.error('[WEBHOOK] Erro ao deletar thread no rollback:', e)
        );
      }

      if (contatoCriado) {
        await base44.entities.Contact.delete(contatoCriado.id).catch(e =>
          console.error('[WEBHOOK] Erro ao deletar contato no rollback:', e)
        );
      }

      throw error;
    }

  } catch (error) {
    console.error('[WEBHOOK] ❌ Erro ao processar mensagem:', error);
    throw error;
  }
}

async function processarMensagemUpdate(data, base44, corsHeaders) {
  console.log('[WEBHOOK] 🔄 Processando atualização de status de mensagem');

  try {
    const status = data.status;
    const messageId = data.key?.id;

    if (!messageId) {
      console.warn('[WEBHOOK] ⚠️ Message ID não encontrado no update');
      return Response.json(
        { success: true, ignored: 'missing_message_id' },
        { status: 200, headers: corsHeaders }
      );
    }

    const mensagens = await base44.entities.Message.filter({
      whatsapp_message_id: messageId
    });

    if (mensagens.length === 0) {
      console.warn(`[WEBHOOK] ⚠️ Mensagem não encontrada: ${messageId}`);
      return Response.json(
        { success: true, ignored: 'message_not_found' },
        { status: 200, headers: corsHeaders }
      );
    }

    const updates = {};

    if (status === 'READ' || status === 'read') {
      updates.status = 'lida';
      updates.read_at = new Date().toISOString();
    } else if (status === 'DELIVERY_ACK' || status === 'delivered') {
      updates.status = 'entregue';
      updates.delivered_at = new Date().toISOString();
    }

    if (Object.keys(updates).length > 0) {
      await base44.entities.Message.update(mensagens[0].id, updates);
      console.log(`[WEBHOOK] ✅ Status da mensagem atualizado: ${updates.status}`);
    }

    return Response.json(
      { success: true, processed: 'message_status_updated' },
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[WEBHOOK] ❌ Erro ao processar update:', error);
    throw error;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * FUNÇÕES AUXILIARES
 * ═══════════════════════════════════════════════════════════════
 */

async function baixarEPersistirMidia(mediaUrl, mediaType, base44) {
  try {
    console.log(`[MÍDIA] 📥 Baixando ${mediaType} de:`, mediaUrl.substring(0, 50) + '...');

    // Download da mídia
    const response = await fetch(mediaUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const blob = await response.blob();
    const extensao = getExtensaoPorTipo(mediaType);
    const fileName = `whatsapp_${Date.now()}_${Math.random().toString(36).substring(7)}.${extensao}`;

    // Upload para storage permanente
    const file = new File([blob], fileName, { type: blob.type });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    console.log('[MÍDIA] ✅ Mídia persistida:', file_url);

    return file_url;

  } catch (error) {
    console.error('[MÍDIA] ❌ Erro ao persistir mídia:', error);
    // Retornar null em vez de quebrar o fluxo
    return null;
  }
}

function getExtensaoPorTipo(mediaType) {
  const map = {
    'image': 'jpg',
    'video': 'mp4',
    'audio': 'ogg',
    'document': 'pdf',
    'sticker': 'webp'
  };
  return map[mediaType] || 'bin';
}

async function processarComIAAsync(thread, message, base44) {
  try {
    console.log('[IA] 🧠 Processando mensagem com IA (assíncrono)');

    // Carregar últimas 10 mensagens
    const messages = await base44.entities.Message.filter({
      thread_id: thread.id
    }, '-sent_at', 10);

    const contexto = messages.map(m => `${m.sender_type === 'user' ? 'Vendedor' : 'Cliente'}: ${m.content}`).join('\n');

    // Gerar sugestões com LLM
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `Analise esta conversa de WhatsApp e gere 3 sugestões de resposta profissionais, empáticas e diretas:

${contexto}

Última mensagem do cliente: ${message.content}

Gere 3 sugestões práticas que o vendedor possa usar imediatamente.`,
      response_json_schema: {
        type: "object",
        properties: {
          sugestoes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                texto: { type: "string" },
                tom: { type: "string" },
                objetivo: { type: "string" }
              }
            }
          }
        }
      }
    });

    // Salvar sugestões na thread
    await base44.entities.MessageThread.update(thread.id, {
      sugestoes_ia_prontas: response.sugestoes || [],
      ultima_analise_ia: new Date().toISOString()
    });

    console.log('[IA] ✅ Sugestões geradas e salvas');

  } catch (error) {
    console.error('[IA] ❌ Erro no processamento com IA:', error);
    // Não lançar erro para não quebrar o webhook
  }
}