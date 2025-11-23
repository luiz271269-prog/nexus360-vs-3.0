import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { normalizarTelefone } from './lib/phoneUtils.js';
import { connectionManager } from './lib/connectionManager.js';

// Funções do adapter inline para evitar problemas de importação
function extrairInstanceId(payload) {
  return payload.instance || payload.instanceId || payload.instance_id || 
         payload.instance_id_provider || payload.instanceName || 'unknown';
}

function normalizarPayloadZAPI(evento) {
  if (!evento) return { type: 'unknown' };

  const eventoTipo = String(evento.event || evento.type || 'unknown').toLowerCase();
  const instanceId = extrairInstanceId(evento);

  // === 1. MessageStatusCallback (Z-API) - Atualizacao de Status ===
  // CRITICO: Detectar ANTES de ReceivedCallback para evitar mensagens [No content]
  if (eventoTipo.includes('messagestatuscallback') || (evento.status && evento.ids && !evento.phone)) {
    return {
      type: 'message_update',
      instanceId: instanceId,
      messageId: evento.ids ? evento.ids[0] : null,
      status: evento.status, // EX: READ, DELIVERED, SENT
      timestamp: evento.momment || Date.now()
    };
  }

  // === 2. ReceivedCallback (Z-API) - Mensagem Real ===
  if (evento.telefone || evento.phone) {
    const numeroLimpo = normalizarTelefone(evento.phone || evento.telefone);
    if (!numeroLimpo) {
      console.warn('[NORMALIZAR] Telefone invalido:', evento.phone || evento.telefone);
      return { type: 'unknown', error: 'Telefone inválido' };
    }

    // ✅ DETECTAR VCARD (compartilhamento de contato)
    let mediaType = 'none';
    let mediaTempUrl = null;
    let conteudo = evento.text?.message || evento.body || evento.buttonsResponseMessage?.message || '';
    
    if (evento.image) {
      mediaType = 'image';
      mediaTempUrl = evento.image.imageUrl;
    } else if (evento.video) {
      mediaType = 'video';
      mediaTempUrl = evento.video.videoUrl;
    } else if (evento.audio) {
      mediaType = 'audio';
      mediaTempUrl = evento.audio.audioUrl;
    } else if (evento.contactMessage || evento.vcard) {
      // 📇 VCARD - Compartilhamento de contato
      mediaType = 'contact';
      const contactData = evento.contactMessage || evento.vcard;
      conteudo = `📇 Contato compartilhado: ${contactData.displayName || contactData.name || 'Sem nome'}`;
    } else if (evento.location || evento.locationMessage) {
      // 📍 LOCALIZAÇÃO
      mediaType = 'location';
      const loc = evento.location || evento.locationMessage;
      conteudo = `📍 Localização: ${loc.name || 'Localização compartilhada'}`;
    } else if (evento.documentMessage) {
      // 📄 DOCUMENTO
      mediaType = 'document';
      mediaTempUrl = evento.documentMessage.documentUrl;
      conteudo = `📄 Documento: ${evento.documentMessage.fileName || 'Arquivo'}`;
    }

    return {
      type: 'message',
      instanceId: instanceId,
      messageId: evento.messageId,
      from: numeroLimpo,
      content: conteudo,
      mediaType: mediaType,
      mediaTempUrl: mediaTempUrl,
      mediaCaption: evento.image?.caption || evento.video?.caption || null,
      timestamp: evento.momment || evento.timestamp || Date.now(),
      isFromMe: evento.fromMe || false,
      pushName: evento.senderName || evento.chatName || null,
      vcard: evento.contactMessage || evento.vcard || null,
      location: evento.location || evento.locationMessage || null
    };
  }

  // === 3. QR Code Update ===
  if (eventoTipo.includes('qrcode')) {
    return {
      type: 'qrcode',
      instanceId: instanceId,
      qrCodeUrl: evento.qrcode || evento.qr || null
    };
  }
  
  // === 4. Connection Status Update ===
  if (eventoTipo.includes('connection')) {
    return {
      type: 'connection',
      instanceId: instanceId,
      status: evento.connected ? 'conectado' : 'desconectado'
    };
  }

  return { type: 'unknown' };
}

function validarPayloadNormalizado(payload) {
  if (!payload) return { valido: false, erro: 'Payload nulo' };
  if (payload.type === 'unknown') return { valido: false, erro: 'Tipo desconhecido' };
  if (!payload.instanceId) return { valido: false, erro: 'Instance ID ausente' };
  return { valido: true };
}

// VERSÃO AUTO-ATUALIZADA - Modifique quando publicar uma nova versão
const VERSION = 'v4.1.0';
const BUILD_DATE = '2025-01-23';
const DEPLOYED_AT = new Date().toISOString();

console.log('=============================================================');
console.log('         WHATSAPP WEBHOOK - STARTUP                        ');
console.log('=============================================================');
console.log('VERSION:', VERSION);
console.log('BUILD DATE:', BUILD_DATE);
console.log('DEPLOYED AT:', DEPLOYED_AT);
console.log('MULTI-CONNECTION MANAGER: ACTIVE');
console.log('=============================================================');

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

Deno.serve(async (req) => {
  const startTime = Date.now();
  const url = new URL(req.url);
  const debugMode = url.searchParams.get('debug') === 'true';
  
  console.log('[WEBHOOK] v' + VERSION + ' - Request received at ' + new Date().toISOString());
  if (debugMode) console.log('[DEBUG] Debug mode ENABLED');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === 'GET') {
    console.log('[' + VERSION + '] Health check OK');
    const metrics = connectionManager.getMetrics();
    return new Response(JSON.stringify({ 
      version: VERSION, 
      build_date: BUILD_DATE,
      deployed_at: DEPLOYED_AT,
      status: 'operational',
      uptime_seconds: Math.floor((Date.now() - new Date(DEPLOYED_AT).getTime()) / 1000),
      connection_manager: metrics,
      timestamp: new Date().toISOString()
    }), { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  let auditLogId = null;
  let base44;

  try {
    base44 = createClientFromRequest(req.clone());
    console.log('[' + VERSION + '] SDK initialized');

    let rawBody = '';
    let evento;

    try {
      rawBody = await req.text();
      console.log('[' + VERSION + '] Payload received: ' + rawBody.length + ' bytes');
      
      if (!rawBody || rawBody.trim() === '') {
        console.warn('[' + VERSION + '] Empty payload received');
        return Response.json(
          { success: false, error: 'Empty payload', version: VERSION },
          { status: 200, headers: corsHeaders }
        );
      }
      
      evento = JSON.parse(rawBody);
      console.log('[' + VERSION + '] JSON parsed successfully');
      console.log('[' + VERSION + '] Payload keys: ' + Object.keys(evento).join(', '));

    } catch (e) {
      console.error('[' + VERSION + '] JSON parse error: ' + e.message);
      return Response.json(
        { success: false, error: 'Invalid JSON: ' + e.message, version: VERSION },
        { status: 200, headers: corsHeaders }
      );
    }

    const eventoTipo = evento.event || evento.type || evento.event_type || 
                       evento.eventType || evento.eventName || evento.evento?.event || 
                       'unknown';
    
    const instanceId = evento.instance || evento.instanceId || evento.instance_id || 
                       evento.instance_id_provider || evento.instanceName || 
                       extrairInstanceId(evento) || 'unknown';

    console.log('[' + VERSION + '] Event Type: ' + eventoTipo);
    console.log('[' + VERSION + '] Instance ID: ' + instanceId);
    console.log('[' + VERSION + '] Full payload: ' + JSON.stringify(evento).substring(0, 500));

    // Registrar/atualizar conexão no gerenciador
    connectionManager.register(instanceId, {
      provider: 'z_api',
      phone: evento.phone || evento.telefone,
      instanceName: evento.instanceName
    });

    try {
      const auditLog = await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
        payload_bruto: evento,
        instance_identificado: instanceId,
        evento: eventoTipo,
        timestamp_recebido: new Date().toISOString(),
        sucesso_processamento: false
      });
      auditLogId = auditLog.id;
      console.log('[' + VERSION + '] Audit log created: ' + auditLogId);
    } catch (err) {
      console.error('[' + VERSION + '] AUDIT LOG FAILED: ' + err.message);
      console.error('[' + VERSION + '] Audit error stack: ' + err.stack);
    }

    let payloadNormalizado;
    try {
      payloadNormalizado = normalizarPayloadZAPI(evento);
      console.log('[' + VERSION + '] Payload normalized: type=' + payloadNormalizado.type);
    } catch (err) {
      console.error('[' + VERSION + '] Normalization failed: ' + err.message);
      payloadNormalizado = null;
    }

    if (!payloadNormalizado || payloadNormalizado.type === 'unknown') {
      const rawEventStr = String(eventoTipo).trim().toLowerCase();
      console.warn('[' + VERSION + '] Unknown payload type, checking emergency bypass');
      console.warn('[' + VERSION + '] Checking for Z-API direct structure...');
      
      // Detectar mensagem Z-API direta (EXCLUIR MessageStatusCallback)
      if ((evento.telefone || evento.phone) && evento.messageId && !evento.status && !evento.ids) {
        console.warn('[' + VERSION + '] EMERGENCY BYPASS: Detected Z-API message by structure');
        const numeroLimpo = normalizarTelefone(evento.telefone || evento.phone);
        
        if (numeroLimpo) {
          payloadNormalizado = {
            type: 'message',
            instanceId: instanceId,
            messageId: evento.messageId,
            from: numeroLimpo,
            content: evento.text?.message || evento.body || '[Message content missing]',
            mediaType: evento.image ? 'image' : evento.video ? 'video' : evento.audio ? 'audio' : 'none',
            mediaTempUrl: evento.image?.imageUrl || evento.video?.videoUrl || evento.audio?.audioUrl || null,
            mediaCaption: evento.image?.caption || evento.video?.caption || null,
            timestamp: evento.momment || evento.timestamp || Date.now(),
            isFromMe: evento.fromMe || false,
            pushName: evento.senderName || evento.chatName || null
          };
        }
      }
      else if (rawEventStr.includes('receivedcallback') && !evento.status && !evento.ids) {
        console.warn('[' + VERSION + '] EMERGENCY BYPASS: Detected by event name');
        const numeroLimpo = normalizarTelefone(evento.phone || evento.telefone || '');
        
        if (numeroLimpo) {
          payloadNormalizado = {
            type: 'message',
            instanceId: instanceId,
            messageId: evento.messageId || 'FALLBACK_' + Date.now(),
            from: numeroLimpo,
            content: evento.text?.message || evento.body || '[Recovered message]',
            mediaType: 'none',
            timestamp: evento.momment || evento.timestamp || Date.now(),
            isFromMe: evento.fromMe || false,
            pushName: evento.senderName || evento.chatName || null
          };
        }
      }
      
      if (!payloadNormalizado || payloadNormalizado.type === 'unknown') {
        console.error('[' + VERSION + '] FAILED TO NORMALIZE - Raw payload:', JSON.stringify(evento, null, 2));
      }
    }

    const validacao = validarPayloadNormalizado(payloadNormalizado);
    if (!validacao.valido) {
      console.error('[' + VERSION + '] Validation failed: ' + validacao.erro);
      return Response.json({
        success: false,
        error: 'Validation failed: ' + validacao.erro,
        version: VERSION,
        debug: {
          eventoTipo: eventoTipo,
          instanceId: instanceId,
          payloadKeys: Object.keys(evento),
          normalized_type: payloadNormalizado?.type || 'null'
        }
      }, { status: 200, headers: corsHeaders });
    }

    // Validar se a conexão está ativa antes de processar
    if (!connectionManager.isActive(instanceId)) {
      console.warn('[' + VERSION + '] Connection is INACTIVE: ' + instanceId);
    }

    console.log('[' + VERSION + '] Routing to handler: ' + payloadNormalizado.type);
    if (debugMode) {
      console.log('[DEBUG] Normalized payload type: ' + payloadNormalizado.type);
      console.log('[DEBUG] Instance: ' + instanceId);
      console.log('[DEBUG] Event: ' + eventoTipo);
    }

    let resultado;
    switch (payloadNormalizado.type) {
      case 'qrcode':
        resultado = await handleQRCode(instanceId, payloadNormalizado, base44, corsHeaders, debugMode);
        break;
      case 'connection':
        resultado = await handleConnection(instanceId, payloadNormalizado, base44, corsHeaders, debugMode);
        break;
      case 'message':
        resultado = await handleMessage(instanceId, payloadNormalizado, base44, corsHeaders, debugMode);
        break;
      case 'message_update':
        resultado = await handleMessageUpdate(payloadNormalizado, base44, corsHeaders, debugMode);
        break;
      case 'send_confirmation':
        console.log('[' + VERSION + '] Send confirmation received, ignoring');
        resultado = Response.json({ 
          success: true, 
          ignored: true,
          ...(debugMode && { debug: { type: 'send_confirmation' } })
        }, { status: 200, headers: corsHeaders });
        break;
      default:
        console.log('[' + VERSION + '] Unknown event type: ' + payloadNormalizado.type);
        resultado = Response.json({
          success: true,
          ignored: true,
          reason: 'unknown_event_type',
          type: payloadNormalizado.type,
          version: VERSION,
          ...(debugMode && { debug: { eventoTipo, instanceId, normalized_type: payloadNormalizado.type } })
        }, { status: 200, headers: corsHeaders });
    }

    if (auditLogId) {
      try {
        await base44.asServiceRole.entities.ZapiPayloadNormalized.update(auditLogId, {
          sucesso_processamento: true,
          integration_id: payloadNormalizado.integrationId || null
        });
        console.log('[' + VERSION + '] Audit log updated: SUCCESS');
      } catch (err) {
        console.error('[' + VERSION + '] Failed to update audit log: ' + err.message);
      }
    }

    const duration = Date.now() - startTime;
    console.log('[' + VERSION + '] Request completed in ' + duration + 'ms');
    
    return resultado;

  } catch (error) {
    console.error('[' + VERSION + '] FATAL ERROR: ' + error.message);
    console.error('[' + VERSION + '] Stack trace: ' + error.stack);
    
    if (auditLogId && base44) {
      try {
        await base44.asServiceRole.entities.ZapiPayloadNormalized.update(auditLogId, {
          sucesso_processamento: false,
          erro_detalhes: error.message
        });
      } catch (e) {
        console.error('[' + VERSION + '] Failed to update audit log with error');
      }
    }
    
    return Response.json({
      success: false,
      error: error.message,
      version: VERSION,
      timestamp: new Date().toISOString()
    }, { status: 500, headers: corsHeaders });
  }
});

async function handleQRCode(instance, payload, base44, headers, debugMode) {
  if (debugMode) console.log('[HANDLER-QRCODE] Processing QR Code update');
  
  try {
    const integration = await findIntegration(instance, base44);
    if (integration) {
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integration.id, {
        qr_code_url: payload.qrCodeUrl,
        status: 'pendente_qrcode',
        ultima_atividade: new Date().toISOString()
      });
      if (debugMode) console.log('[HANDLER-QRCODE] Integration updated with QR code');
    }
    
    return Response.json({ 
      success: true, 
      processed: 'qrcode',
      instance: instance
    }, { status: 200, headers });
    
  } catch (error) {
    console.error('[HANDLER-QRCODE] Error: ' + error.message);
    throw error;
  }
}

async function handleConnection(instance, payload, base44, headers, debugMode) {
  if (debugMode) console.log('[HANDLER-CONNECTION] Processing connection status: ' + payload.status);
  
  try {
    const integration = await findIntegration(instance, base44);
    if (integration) {
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integration.id, {
        status: payload.status,
        ultima_atividade: new Date().toISOString()
      });
      if (debugMode) console.log('[HANDLER-CONNECTION] Integration status updated to: ' + payload.status);
    }
    
    return Response.json({ 
      success: true, 
      processed: 'connection',
      status: payload.status,
      instance: instance
    }, { status: 200, headers });
    
  } catch (error) {
    console.error('[HANDLER-CONNECTION] Error: ' + error.message);
    throw error;
  }
}

async function handleMessageUpdate(payload, base44, headers, debugMode) {
  if (debugMode) console.log('[HANDLER-MESSAGE-UPDATE] Processing message status update');
  
  try {
    const msgId = payload.messageId;
    if (!msgId) {
      return Response.json({ 
        success: true, 
        ignored: true,
        reason: 'no_message_id'
      }, { status: 200, headers });
    }
    
    const messages = await base44.asServiceRole.entities.Message.list('-created_date', 1, { whatsapp_message_id: msgId });
    
    let status_local = null;
    if (messages.length > 0) {
      const updates = {};
      if (payload.status === 'READ') {
        updates.status = 'lida';
        status_local = 'lida';
      } else if (payload.status === 'DELIVERED') {
        updates.status = 'entregue';
        status_local = 'entregue';
      } else if (payload.status === 'SENT') {
        updates.status = 'enviada';
        status_local = 'enviada';
      }
      
      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.Message.update(messages[0].id, updates);
        if (debugMode) console.log('[HANDLER-MESSAGE-UPDATE] Message status updated to: ' + updates.status);
      }
    }
    
    const response = { 
      success: true, 
      processed: 'message_status_updated',
      messageId: msgId
    };
    
    if (status_local) response.status_local = status_local;
    if (debugMode) {
      response.debug = {
        message_found: messages.length > 0,
        status_received: payload.status,
        status_local: status_local
      };
    }
    
    return Response.json(response, { status: 200, headers });
    
  } catch (error) {
    console.error('[HANDLER-MESSAGE-UPDATE] Error: ' + error.message);
    throw error;
  }
}

async function handleMessage(instance, payload, base44, headers, debugMode) {
  const startTime = Date.now();
  if (debugMode) console.log('[HANDLER-MESSAGE] START - Processing incoming message');
  
  try {
    const numero = payload.from;
    if (!numero || numero === 'unknown') {
      throw new Error('Phone number missing or invalid');
    }
    if (debugMode) console.log('[HANDLER-MESSAGE] Phone number: ' + numero);

    const t1 = Date.now();
    const [contatosExistentes, integracoes] = await Promise.all([
      base44.asServiceRole.entities.Contact.list('-created_date', 1, { telefone: numero }),
      (instance && instance !== 'unknown') 
        ? base44.asServiceRole.entities.WhatsAppIntegration.list('-created_date', 1, { instance_id_provider: instance })
        : Promise.resolve([])
    ]);
    if (debugMode) console.log('[HANDLER-MESSAGE] Parallel queries completed in ' + (Date.now() - t1) + 'ms');

    let contato;
    if (contatosExistentes.length > 0) {
      contato = contatosExistentes[0];
      
      // ✨ ATUALIZA NOME SE PUSHNAME ESTIVER DISPONÍVEL E CONTATO ESTIVER SEM NOME
      const updateData = { ultima_interacao: new Date().toISOString() };
      
      if (payload.pushName && 
          (!contato.nome || contato.nome === numero || contato.nome === contato.telefone)) {
        updateData.nome = payload.pushName;
        if (debugMode) console.log('[HANDLER-MESSAGE] 📝 Atualizando nome: ' + payload.pushName);
      }
      
      await base44.asServiceRole.entities.Contact.update(contato.id, updateData);
    } else {
      contato = await base44.asServiceRole.entities.Contact.create({
        nome: payload.pushName || numero,
        telefone: numero,
        tipo_contato: 'lead',
        whatsapp_status: 'verificado',
        ultima_interacao: new Date().toISOString()
      });
    }

    const integracaoId = integracoes.length > 0 ? integracoes[0].id : null;

    const t2 = Date.now();
    const threadsExistentes = await base44.asServiceRole.entities.MessageThread.list('-last_message_at', 1, { contact_id: contato.id });
    if (debugMode) console.log('[HANDLER-MESSAGE] Thread query completed in ' + (Date.now() - t2) + 'ms');
    
    let thread;
    if (threadsExistentes.length > 0) {
      thread = threadsExistentes[0];
      
      const updateData = {
        last_message_at: new Date().toISOString(),
        last_message_sender: 'contact',
        last_message_content: payload.content ? payload.content.substring(0, 100) : '[No content]',
        unread_count: (thread.unread_count || 0) + 1,
        total_mensagens: (thread.total_mensagens || 0) + 1,
        status: 'aberta'
      };
      
      if (integracaoId && !thread.whatsapp_integration_id) {
        updateData.whatsapp_integration_id = integracaoId;
      }
      
      await base44.asServiceRole.entities.MessageThread.update(thread.id, updateData);
    } else {
      thread = await base44.asServiceRole.entities.MessageThread.create({
        contact_id: contato.id,
        whatsapp_integration_id: integracaoId,
        status: 'aberta',
        primeira_mensagem_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        last_message_sender: 'contact',
        last_message_content: payload.content ? payload.content.substring(0, 100) : '[No content]',
        total_mensagens: 1,
        unread_count: 1
      });
    }

    if (payload.messageId) {
      const mensagensExistentes = await base44.asServiceRole.entities.Message.list('-created_date', 1, { whatsapp_message_id: payload.messageId });
      
      if (mensagensExistentes.length > 0) {
        return Response.json({ 
          success: true, 
          processed: 'duplicate',
          messageId: payload.messageId,
          version: VERSION
        }, { status: 200, headers });
      }
    }

    const t3 = Date.now();
    // ✅ VALIDAR CONTEÚDO ANTES DE SALVAR
    const temConteudoValido = payload.content && payload.content.trim() !== '' && payload.content !== '[No content]';
    const temMidiaValida = payload.mediaTempUrl || payload.mediaType === 'contact' || payload.mediaType === 'location';
    
    // ❌ IGNORAR mensagens completamente vazias
    if (!temConteudoValido && !temMidiaValida) {
      console.warn('[HANDLER-MESSAGE] ⚠️ Mensagem vazia ignorada:', {
        messageId: payload.messageId,
        content: payload.content,
        mediaType: payload.mediaType,
        hasMediaUrl: !!payload.mediaTempUrl
      });
      
      return Response.json({ 
        success: true, 
        processed: 'empty_message_ignored',
        messageId: payload.messageId,
        reason: 'No valid content or media',
        version: VERSION
      }, { status: 200, headers });
    }
    
    const mensagem = await base44.asServiceRole.entities.Message.create({
      thread_id: thread.id,
      sender_id: contato.id,
      sender_type: 'contact',
      content: payload.content || `[${payload.mediaType}]`,
      media_url: payload.mediaTempUrl || null,
      media_type: payload.mediaType || 'none',
      media_caption: payload.mediaCaption || null,
      channel: 'whatsapp',
      status: 'recebida',
      whatsapp_message_id: payload.messageId,
      sent_at: new Date().toISOString(),
      metadata: { 
        whatsapp_integration_id: integracaoId,
        is_from_me: payload.isFromMe || false,
        timestamp: payload.timestamp,
        quoted_message: payload.quotedMessage || null,
        media_file_name: payload.mediaFileName || null,
        location: payload.location || null,
        vcard: payload.vcard || null,
        group_id: payload.groupId || null,
        mime_type: payload.mediaMimeType || null
      }
    });
    if (debugMode) console.log('[HANDLER-MESSAGE] Message save completed in ' + (Date.now() - t3) + 'ms');
    
    const totalTime = Date.now() - startTime;
    
    const response = { 
      success: true, 
      processed: 'message_saved',
      message_id: mensagem.id,
      contact_id: contato.id,
      thread_id: thread.id,
      version: VERSION
    };
    
    if (debugMode) {
      response.debug = {
        phone: numero,
        content_length: payload.content?.length || 0,
        media_type: payload.mediaType,
        integration_id: integracaoId,
        processing_time_ms: totalTime
      };
      console.log('[HANDLER-MESSAGE] Total processing time: ' + totalTime + 'ms');
    }
    
    return Response.json(response, { status: 200, headers });

  } catch (error) {
    console.error('[HANDLER-MESSAGE] FAILED: ' + error.message);
    console.error('[HANDLER-MESSAGE] Stack: ' + error.stack);
    throw error;
  }
}

async function findIntegration(instance, base44) {
  if (!instance || instance === 'unknown') return null;
  
  try {
    const integrations = await base44.asServiceRole.entities.WhatsAppIntegration.list('-created_date', 1, { instance_id_provider: instance });
    return integrations.length > 0 ? integrations[0] : null;
  } catch (error) {
    console.error('[HELPER-FIND-INTEGRATION] Error: ' + error.message);
    return null;
  }
}