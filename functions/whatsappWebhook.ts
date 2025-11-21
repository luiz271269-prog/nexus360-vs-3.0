import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { 
  normalizarPayloadZAPI, 
  validarPayloadNormalizado,
  extrairInstanceId
} from './adapters/zapiAdapter.js';

/**
 * WHATSAPP WEBHOOK - Z-API + EVOLUTION API
 * Versao: 2.2 - Bypass Reforcado e Logs Limpos
 *
 * Processa eventos com:
 * - Normalizacao de payload via adapters
 * - Persistencia de payload bruto para auditoria
 * - Validacao rigorosa
 * - Multi-conexao robusta
 * - Auto-enfileiramento inteligente
 * - Download e persistencia de midia
 * - Processamento assincrono de IA
 */

Deno.serve(async (req) => {
  console.log('[WEBHOOK] ---------------------------------------------------');
  console.log('[WEBHOOK] Webhook recebido');
  console.log('[WEBHOOK] ---------------------------------------------------');

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ----------------------------------------------------------------
  // TRATAMENTO PARA REQUISICOES GET (HEALTH CHECKS)
  // ----------------------------------------------------------------
  if (req.method === 'GET') {
    console.log('[WEBHOOK] INFO: Recebido GET request (health check). Respondendo com 200 OK.');
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  let auditLogId = null;
  let webhookLogId = null;

  try {
    // ----------------------------------------------------------------
    // 1. INICIALIZAR BASE44 COM SERVICE ROLE
    // ----------------------------------------------------------------
    const base44 = createClientFromRequest(req);

    console.log('[WEBHOOK] OK: Base44 inicializado (Service Role)');

    // ----------------------------------------------------------------
    // 2. VALIDACAO E PARSING DO PAYLOAD
    // ----------------------------------------------------------------
    console.log('[WEBHOOK] Iniciando leitura do body...');
    let evento;
    try {
      const rawBody = await req.text();
      console.log('[WEBHOOK] RAW BODY TAMANHO:', rawBody.length);
      
      if (!rawBody || rawBody.trim() === '') {
        console.error('[WEBHOOK] ERRO: Body vazio recebido');
        return Response.json(
          { success: false, error: 'Empty body' },
          { status: 200, headers: corsHeaders }
        );
      }
      
      evento = JSON.parse(rawBody);
      console.log('[WEBHOOK] Payload parseado com sucesso');
    } catch (e) {
      console.error('[WEBHOOK] ERRO ao parsear JSON:', e.message);
      return Response.json(
        { success: false, error: 'Invalid JSON payload: ' + e.message },
        { status: 200, headers: corsHeaders }
      );
    }

    // ----------------------------------------------------------------
    // EXTRACAO E VALIDACAO INICIAL
    // ----------------------------------------------------------------
    // Extracao robusta de evento e instancia
    const eventoTipo = evento.event || evento.type || evento.event_type || evento.eventName || 'ReceivedCallback';
    const instanceExtraido = evento.instance || evento.instanceId || evento.instance_id || extrairInstanceId(evento);

    console.log('[WEBHOOK] DADOS EXTRAIDOS:', {
      tipo: eventoTipo,
      instancia: instanceExtraido
    });

    if (!eventoTipo || !instanceExtraido) {
      console.warn('[WEBHOOK] AVISO: Campos obrigatorios faltando (event/type ou instance/instanceId)');
      
      // Persistir falha para auditoria
      try {
        await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
          payload_bruto: evento,
          instance_identificado: instanceExtraido || 'unknown',
          evento: eventoTipo || 'unknown',
          timestamp_recebido: new Date().toISOString(),
          sucesso_processamento: false,
          erro_detalhes: 'Campos obrigatorios faltando'
        });
      } catch (err) {
        console.error('[WEBHOOK] ERRO auditoria falha:', err);
      }

      return Response.json(
        { success: true, ignored: 'missing_required_fields' },
        { status: 200, headers: corsHeaders }
      );
    }

    // ----------------------------------------------------------------
    // 3. PERSISTIR AUDITORIA (ZapiPayloadNormalized e WebhookLog)
    // ----------------------------------------------------------------
    const timestampRecebido = new Date().toISOString();

    try {
      const auditLog = await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
        payload_bruto: evento,
        instance_identificado: instanceExtraido,
        evento: eventoTipo,
        timestamp_recebido: timestampRecebido,
        sucesso_processamento: false
      });
      auditLogId = auditLog.id;
      console.log('[WEBHOOK] OK: Auditoria persistida ID:', auditLogId);
    } catch (auditError) {
      console.error('[WEBHOOK] ERRO ao persistir auditoria:', auditError.message);
    }

    try {
      const webhookLog = await base44.asServiceRole.entities.WebhookLog.create({
        timestamp: timestampRecebido,
        provider: 'z_api',
        instance_id: instanceExtraido,
        event_type: eventoTipo,
        payload: evento,
        processed: false,
        success: false
      });
      webhookLogId = webhookLog.id;
    } catch (logError) {
      console.error('[WEBHOOK] ERRO ao persistir WebhookLog:', logError.message);
    }

    // ----------------------------------------------------------------
    // 4. NORMALIZAR PAYLOAD COM ADAPTER
    // ----------------------------------------------------------------
    let payloadNormalizado = null;
    try {
      console.log('[WEBHOOK] Chamando normalizador...');
      payloadNormalizado = normalizarPayloadZAPI(evento);

      // =================================================================================
      // BYPASS DE ROTEAMENTO DE EMERGENCIA (CORRECAO DO UNKNOWN_EVENT)
      // =================================================================================
      if (!payloadNormalizado || payloadNormalizado.type === 'unknown') {
        const rawEventStr = String(evento.event || evento.type || '').trim().toLowerCase();
        
        // Se for um callback de recebimento, FORCA o tipo para message
        if (rawEventStr === 'receivedcallback' || rawEventStr === 'message') {
           console.warn('[WEBHOOK] MITIGACAO: Forcando roteamento para "message"');
           
           if (!payloadNormalizado) payloadNormalizado = {};
           
           payloadNormalizado.type = 'message';
           payloadNormalizado.instanceId = instanceExtraido;
           
           // Recuperacao de dados perdidos
           if (!payloadNormalizado.messageId) payloadNormalizado.messageId = evento.messageId || evento.id || `FALLBACK_${Date.now()}`;
           
           if (!payloadNormalizado.from) {
             const telefone = evento.phone || evento.telefone || evento.connectedPhone;
             payloadNormalizado.from = telefone?.startsWith('+') ? telefone : `+${telefone}`;
           }
           
           if (!payloadNormalizado.timestamp) payloadNormalizado.timestamp = evento.momment || evento.momento || Date.now();
           
           if (!payloadNormalizado.content) {
               if (evento.text && evento.text.message) payloadNormalizado.content = evento.text.message;
               else payloadNormalizado.content = '[Conteudo recuperado via bypass]';
           }
        }
      }
      // =================================================================================

      console.log('[WEBHOOK] Tipo Normalizado Final:', payloadNormalizado.type);

      const validacao = validarPayloadNormalizado(payloadNormalizado);
      if (!validacao.valido) {
        console.warn('[WEBHOOK] AVISO: Payload normalizado invalido:', validacao.erro);
        return Response.json(
          { success: true, ignored: 'invalid_normalized_payload', details: validacao.erro },
          { status: 200, headers: corsHeaders }
        );
      }
    } catch (normError) {
      console.error('[WEBHOOK] ERRO na normalizacao:', normError);
      return Response.json(
        { success: true, ignored: 'normalization_error', error: normError.message },
        { status: 200, headers: corsHeaders }
      );
    }

    // ----------------------------------------------------------------
    // 5. ROTEAMENTO E PROCESSAMENTO
    // ----------------------------------------------------------------
    let resultado;

    console.log('[WEBHOOK] Roteando evento tipo:', payloadNormalizado.type);

    switch (payloadNormalizado.type) {
      case 'qrcode':
        resultado = await processarQRCodeUpdate(instanceExtraido, payloadNormalizado, base44, corsHeaders);
        break;

      case 'connection':
        resultado = await processarConnectionUpdate(instanceExtraido, payloadNormalizado, base44, corsHeaders);
        break;

      case 'message':
        console.log('[WEBHOOK] Rota: Processar Mensagem Recebida');
        resultado = await processarMensagemRecebida(instanceExtraido, payloadNormalizado, base44, corsHeaders, auditLogId);
        break;

      case 'message_update':
        resultado = await processarMensagemUpdate(payloadNormalizado, base44, corsHeaders);
        break;

      case 'send_confirmation':
        resultado = Response.json(
          { success: true, processed: 'send_confirmation' },
          { status: 200, headers: corsHeaders }
        );
        break;

      case 'unknown':
        console.log('[WEBHOOK] Rota: Evento Desconhecido');
        console.log('[WEBHOOK] Evento Original:', payloadNormalizado.event);
        resultado = Response.json(
          { success: true, ignored: 'unknown_event', event: payloadNormalizado.event },
          { status: 200, headers: corsHeaders }
        );
        break;

      default:
        console.log('[WEBHOOK] Rota: Default (Tipo Nao Tratado)');
        resultado = Response.json(
          { success: true, ignored: 'unknown_type', type: payloadNormalizado.type },
          { status: 200, headers: corsHeaders }
        );
    }
    
    // ----------------------------------------------------------------
    // 6. ATUALIZAR STATUS DE SUCESSO
    // ----------------------------------------------------------------
    if (auditLogId) {
      try {
        await base44.asServiceRole.entities.ZapiPayloadNormalized.update(auditLogId, {
          sucesso_processamento: true,
          integration_id: payloadNormalizado.integrationId || null
        });
      } catch (e) { console.error('[WEBHOOK] Erro update auditoria:', e); }
    }

    if (webhookLogId) {
      try {
        await base44.asServiceRole.entities.WebhookLog.update(webhookLogId, {
          processed: true,
          success: true
        });
      } catch (e) { console.error('[WEBHOOK] Erro update log:', e); }
    }

    return resultado;

  } catch (error) {
    console.error('[WEBHOOK] ERRO FATAL:', error);
    console.error('[WEBHOOK] Stack:', error.stack);

    if (auditLogId) {
      try {
        const base44 = createClientFromRequest(req);
        await base44.asServiceRole.entities.ZapiPayloadNormalized.update(auditLogId, {
          sucesso_processamento: false,
          erro_detalhes: error.message
        });
      } catch (e) {}
    }

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
 * FUNCOES DE PROCESSAMENTO
 */

async function processarQRCodeUpdate(instance, payloadNormalizado, base44, corsHeaders) {
  try {
    const integracao = await buscarIntegracaoPorInstance(instance, base44);
    if (!integracao) {
      return Response.json({ success: true, warning: 'integration_not_found' }, { status: 200, headers: corsHeaders });
    }

    await base44.asServiceRole.entities.WhatsAppIntegration.update(integracao.id, {
      qr_code_url: payloadNormalizado.qrCodeUrl,
      status: 'pendente_qrcode',
      ultima_atividade: new Date().toISOString()
    });

    return Response.json({ success: true, processed: 'qrcode_updated' }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('[WEBHOOK] Erro QRCode:', error);
    throw error;
  }
}

async function processarConnectionUpdate(instance, payloadNormalizado, base44, corsHeaders) {
  try {
    const integracao = await buscarIntegracaoPorInstance(instance, base44);
    if (!integracao) {
      return Response.json({ success: true, warning: 'integration_not_found' }, { status: 200, headers: corsHeaders });
    }

    await base44.asServiceRole.entities.WhatsAppIntegration.update(integracao.id, {
      status: payloadNormalizado.status,
      ultima_atividade: new Date().toISOString()
    });

    return Response.json({ success: true, processed: 'connection_updated' }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('[WEBHOOK] Erro Connection:', error);
    throw error;
  }
}

async function processarMensagemRecebida(instance, payloadNormalizado, base44, corsHeaders, auditLogId) {
  console.log('[WEBHOOK] Iniciando processamento de mensagem');
  console.log('[WEBHOOK] Payload normalizado:', JSON.stringify(payloadNormalizado, null, 2));
  
  try {
    const numeroFormatado = payloadNormalizado.from;
    const conteudo = payloadNormalizado.content || '';
    const mediaType = payloadNormalizado.mediaType || 'none';
    const mediaUrl = payloadNormalizado.mediaTempUrl;
    const messageId = payloadNormalizado.messageId;
    const timestamp = payloadNormalizado.timestamp;
    const pushName = payloadNormalizado.pushName;

    console.log('[WEBHOOK] Processando mensagem de:', numeroFormatado);
    console.log('[WEBHOOK] Conteudo:', conteudo.substring(0, 50));

    let contatoCriado = null;
    let threadCriada = null;
    let mensagemCriada = null;

    try {
      // 1. BUSCAR OU CRIAR CONTATO
      let contatos = await base44.asServiceRole.entities.Contact.filter({ telefone: numeroFormatado });
      let contato;

      if (contatos.length === 0) {
        console.log('[WEBHOOK] Criando novo contato');
        contato = await base44.asServiceRole.entities.Contact.create({
          nome: pushName || numeroFormatado,
          telefone: numeroFormatado,
          tipo_contato: 'lead',
          whatsapp_status: 'verificado',
          ultima_interacao: new Date().toISOString()
        });
        contatoCriado = contato;
        console.log('[WEBHOOK] Contato criado:', contato.id);
      } else {
        contato = contatos[0];
        await base44.asServiceRole.entities.Contact.update(contato.id, {
          ultima_interacao: new Date().toISOString()
        });
        console.log('[WEBHOOK] Contato existente:', contato.id);
      }

      // 2. BUSCAR INTEGRACAO
      const integracao = await buscarIntegracaoPorInstance(instance, base44);
      let integracaoId = null;
      if (integracao) {
        integracaoId = integracao.id;
        console.log('[WEBHOOK] Integracao encontrada:', integracaoId);
        
        // Atualizar estatisticas
        const stats = integracao.estatisticas || {};
        stats.total_mensagens_recebidas = (stats.total_mensagens_recebidas || 0) + 1;
        
        await base44.asServiceRole.entities.WhatsAppIntegration.update(integracaoId, {
          estatisticas: stats,
          ultima_atividade: new Date().toISOString(),
          status: 'conectado'
        });
      } else {
        console.warn('[WEBHOOK] Integracao NAO encontrada para instance:', instance);
      }

      // 3. BUSCAR OU CRIAR THREAD
      let threads = await base44.asServiceRole.entities.MessageThread.filter({ contact_id: contato.id });
      let thread;

      if (threads.length === 0) {
        console.log('[WEBHOOK] Criando nova thread');
        thread = await base44.asServiceRole.entities.MessageThread.create({
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
        console.log('[WEBHOOK] Thread criada:', thread.id);
      } else {
        thread = threads[0];
        const updateData = {
          ultima_atividade: new Date().toISOString(),
          janela_24h_expira_em: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
        if (integracaoId && !thread.whatsapp_integration_id) {
          updateData.whatsapp_integration_id = integracaoId;
        }
        await base44.asServiceRole.entities.MessageThread.update(thread.id, updateData);
        console.log('[WEBHOOK] Thread existente:', thread.id);
      }

      // 4. PERSISTIR MIDIA
      let mediaUrlPermanente = null;
      if (mediaType !== 'none' && mediaUrl) {
        mediaUrlPermanente = await baixarEPersistirMidia(mediaUrl, mediaType, base44);
      }

      // 5. VERIFICAR DUPLICIDADE
      if (messageId) {
        const msgExistente = await base44.asServiceRole.entities.Message.filter({ whatsapp_message_id: messageId });
        if (msgExistente.length > 0) {
          console.log('[WEBHOOK] Mensagem duplicada detectada. Ignorando.');
          return Response.json({ success: true, processed: 'duplicate_discarded' }, { status: 200, headers: corsHeaders });
        }
      }

      // 6. CRIAR MENSAGEM
      console.log('[WEBHOOK] Criando registro Message');
      const message = await base44.asServiceRole.entities.Message.create({
        thread_id: thread.id,
        sender_id: contato.id,
        sender_type: 'contact',
        content: conteudo,
        media_url: mediaUrlPermanente || mediaUrl,
        media_type: mediaType,
        channel: 'whatsapp',
        status: 'recebida',
        whatsapp_message_id: messageId,
        sent_at: new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp).toISOString(),
        delivered_at: new Date().toISOString(),
        metadata: { whatsapp_integration_id: integracaoId }
      });
      mensagemCriada = message;
      console.log('[WEBHOOK] Message criada:', message.id);

      // 7. ATUALIZAR THREAD
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        last_message_content: conteudo.substring(0, 100),
        last_message_at: new Date().toISOString(),
        last_message_sender: 'contact',
        unread_count: (thread.unread_count || 0) + 1,
        total_mensagens: (thread.total_mensagens || 0) + 1
      });

      // 8. PROCESSAR IA (ASSINCRONO)
      processarComIAAsync(thread, message, base44).catch(e => console.error('[WEBHOOK] Erro IA:', e));

      console.log('[WEBHOOK] SUCESSO: Mensagem processada e salva');
      
      return Response.json(
        { success: true, processed: 'message_saved', message_id: message.id },
        { status: 200, headers: corsHeaders }
      );

    } catch (error) {
      console.error('[WEBHOOK] ERRO Transacional:', error);
      console.error('[WEBHOOK] Stack:', error.stack);
      
      // Rollback manual
      if (mensagemCriada) {
        await base44.asServiceRole.entities.Message.delete(mensagemCriada.id).catch(e =>
          console.error('[WEBHOOK] Erro rollback Message:', e)
        );
      }
      if (threadCriada) {
        await base44.asServiceRole.entities.MessageThread.delete(threadCriada.id).catch(e =>
          console.error('[WEBHOOK] Erro rollback Thread:', e)
        );
      }
      if (contatoCriado) {
        await base44.asServiceRole.entities.Contact.delete(contatoCriado.id).catch(e =>
          console.error('[WEBHOOK] Erro rollback Contact:', e)
        );
      }
      
      throw error;
    }

  } catch (error) {
    console.error('[WEBHOOK] ERRO Geral Message:', error);
    throw error;
  }
}

async function processarMensagemUpdate(payloadNormalizado, base44, corsHeaders) {
  try {
    const messageId = payloadNormalizado.messageId;
    if (!messageId) return Response.json({ success: true, ignored: 'missing_message_id' }, { status: 200, headers: corsHeaders });

    const mensagens = await base44.asServiceRole.entities.Message.filter({ whatsapp_message_id: messageId });
    if (mensagens.length === 0) return Response.json({ success: true, ignored: 'message_not_found' }, { status: 200, headers: corsHeaders });

    const statusZAPI = payloadNormalizado.status;
    const updates = {};

    if (statusZAPI === 'READ' || statusZAPI === 'read') {
      updates.status = 'lida';
      updates.read_at = new Date().toISOString();
    } else if (statusZAPI === 'DELIVERY_ACK' || statusZAPI === 'delivered') {
      updates.status = 'entregue';
      updates.delivered_at = new Date().toISOString();
    }

    if (Object.keys(updates).length > 0) {
      await base44.asServiceRole.entities.Message.update(mensagens[0].id, updates);
    }

    return Response.json({ success: true, processed: 'message_status_updated' }, { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('[WEBHOOK] Erro update:', error);
    throw error;
  }
}

async function buscarIntegracaoPorInstance(instance, base44) {
  if (!instance) return null;
  
  console.log('[WEBHOOK] Buscando integracao para instance:', instance);
  
  // Busca 1: instance_id_provider
  let integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ instance_id_provider: instance });
  if (integracoes.length > 0) {
    console.log('[WEBHOOK] Integracao encontrada por instance_id_provider');
    return integracoes[0];
  }

  // Busca 2: nome_instancia
  integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ nome_instancia: instance });
  if (integracoes.length > 0) {
    console.log('[WEBHOOK] Integracao encontrada por nome_instancia');
    return integracoes[0];
  }
  
  console.warn('[WEBHOOK] Nenhuma integracao encontrada');
  return null;
}

async function baixarEPersistirMidia(mediaUrl, mediaType, base44) {
  try {
    console.log('[WEBHOOK] Baixando midia...');
    const response = await fetch(mediaUrl);
    if (!response.ok) throw new Error('Falha download midia');
    
    const blob = await response.blob();
    const ext = mediaType === 'image' ? 'jpg' : mediaType === 'video' ? 'mp4' : mediaType === 'audio' ? 'ogg' : 'bin';
    const fileName = `wa_${Date.now()}.${ext}`;
    
    const file = new File([blob], fileName, { type: blob.type });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    
    return file_url;
  } catch (e) {
    console.error('[WEBHOOK] Erro midia:', e);
    return null;
  }
}

async function processarComIAAsync(thread, message, base44) {
  try {
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `Gere 3 sugestoes de resposta para: ${message.content}`,
      response_json_schema: { 
        type: "object", 
        properties: { 
          sugestoes: { 
            type: "array", 
            items: { 
              type: "object", 
              properties: { 
                texto: { type: "string" },
                tom: { type: "string" }
              } 
            } 
          } 
        } 
      }
    });
    await base44.asServiceRole.entities.MessageThread.update(thread.id, { 
      sugestoes_ia_prontas: response.sugestoes || [] 
    });
  } catch (e) {
    console.error('[IA] Erro:', e);
  }
}