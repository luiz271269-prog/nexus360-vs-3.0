import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Funções do adapter inline para evitar problemas de importação
function extrairInstanceId(payload) {
  return payload.instance || payload.instanceId || payload.instance_id || 
         payload.instance_id_provider || payload.instanceName || 'unknown';
}

function normalizarPayloadZAPI(evento) {
  if (!evento) return { type: 'unknown' };

  // Detectar mensagem Z-API (ReceivedCallback)
  if (evento.telefone || evento.phone) {
    const telefone = evento.telefone || evento.phone;
    return {
      type: 'message',
      instanceId: extrairInstanceId(evento),
      messageId: evento.messageId,
      from: telefone.startsWith('+') ? telefone : '+' + telefone,
      content: evento.text?.message || evento.body || '',
      mediaType: evento.image ? 'image' : evento.video ? 'video' : evento.audio ? 'audio' : 'none',
      mediaTempUrl: evento.image?.imageUrl || evento.video?.videoUrl || evento.audio?.audioUrl || null,
      mediaCaption: evento.image?.caption || evento.video?.caption || null,
      timestamp: evento.momment || evento.timestamp || Date.now(),
      isFromMe: evento.fromMe || false,
      pushName: evento.senderName || evento.chatName || null
    };
  }

  // Outros tipos de evento
  const eventoTipo = String(evento.event || evento.type || 'unknown').toLowerCase();
  
  if (eventoTipo.includes('qrcode')) {
    return {
      type: 'qrcode',
      instanceId: extrairInstanceId(evento),
      qrCodeUrl: evento.qrcode || evento.qr || null
    };
  }
  
  if (eventoTipo.includes('connection') || eventoTipo.includes('status')) {
    return {
      type: 'connection',
      instanceId: extrairInstanceId(evento),
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
const VERSION = 'v3.5.0';
const BUILD_DATE = '2025-01-22'; // Data do último deploy
const DEPLOYED_AT = new Date().toISOString(); // Auto-capturado no startup

console.log('=============================================================');
console.log('         WHATSAPP WEBHOOK - STARTUP                        ');
console.log('=============================================================');
console.log('VERSION:', VERSION);
console.log('BUILD DATE:', BUILD_DATE);
console.log('DEPLOYED AT:', DEPLOYED_AT);
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
    return new Response(JSON.stringify({ 
      version: VERSION, 
      build_date: BUILD_DATE,
      deployed_at: DEPLOYED_AT,
      status: 'operational',
      uptime_seconds: Math.floor((Date.now() - new Date(DEPLOYED_AT).getTime()) / 1000),
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
      
      // Detectar mensagem Z-API direta
      if ((evento.telefone || evento.phone) && evento.messageId) {
        console.warn('[' + VERSION + '] EMERGENCY BYPASS: Detected Z-API message by structure');
        const telefone = evento.telefone || evento.phone;
        const telefoneFormatado = telefone.startsWith('+') ? telefone : '+' + telefone;
        
        payloadNormalizado = {
          type: 'message',
          instanceId: instanceId,
          messageId: evento.messageId,
          from: telefoneFormatado,
          content: evento.text?.message || evento.body || '[Message content missing]',
          mediaType: evento.image ? 'image' : evento.video ? 'video' : evento.audio ? 'audio' : 'none',
          mediaTempUrl: evento.image?.imageUrl || evento.video?.videoUrl || evento.audio?.audioUrl || null,
          mediaCaption: evento.image?.caption || evento.video?.caption || null,
          timestamp: evento.momment || evento.timestamp || Date.now(),
          isFromMe: evento.fromMe || false,
          pushName: evento.senderName || evento.chatName || null
        };
      }
      else if (rawEventStr.includes('receivedcallback') || 
               rawEventStr.includes('message') || 
               rawEventStr.includes('received') ||
               rawEventStr.includes('callback')) {
        console.warn('[' + VERSION + '] EMERGENCY BYPASS: Detected by event name');
        const telefone = evento.phone || evento.telefone || 'unknown';
        const telefoneFormatado = telefone.startsWith('+') ? telefone : '+' + telefone;
        
        payloadNormalizado = {
          type: 'message',
          instanceId: instanceId,
          messageId: evento.messageId || 'FALLBACK_' + Date.now(),
          from: telefoneFormatado,
          content: evento.text?.message || evento.body || '[Recovered message]',
          mediaType: 'none',
          timestamp: evento.momment || evento.timestamp || Date.now(),
          isFromMe: evento.fromMe || false,
          pushName: evento.senderName || evento.chatName || null
        };
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
  console.log('[HANDLER-QRCODE] Processing QR Code update');
  
  try {
    const integration = await findIntegration(instance, base44);
    if (integration) {
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integration.id, {
        qr_code_url: payload.qrCodeUrl,
        status: 'pendente_qrcode',
        ultima_atividade: new Date().toISOString()
      });
      console.log('[HANDLER-QRCODE] Integration updated with QR code');
    } else {
      console.warn('[HANDLER-QRCODE] Integration not found for instance: ' + instance);
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
  console.log('[HANDLER-CONNECTION] Processing connection status: ' + payload.status);
  
  try {
    const integration = await findIntegration(instance, base44);
    if (integration) {
      await base44.asServiceRole.entities.WhatsAppIntegration.update(integration.id, {
        status: payload.status,
        ultima_atividade: new Date().toISOString()
      });
      console.log('[HANDLER-CONNECTION] Integration status updated to: ' + payload.status);
    } else {
      console.warn('[HANDLER-CONNECTION] Integration not found for instance: ' + instance);
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
  console.log('[HANDLER-MESSAGE-UPDATE] Processing message status update');
  
  try {
    const msgId = payload.messageId;
    if (!msgId) {
      console.warn('[HANDLER-MESSAGE-UPDATE] No messageId provided');
      return Response.json({ 
        success: true, 
        ignored: true,
        reason: 'no_message_id'
      }, { status: 200, headers });
    }
    
    const messages = await base44.asServiceRole.entities.Message.filter({ 
      whatsapp_message_id: msgId 
    });
    
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
        console.log('[HANDLER-MESSAGE-UPDATE] Message status updated to: ' + updates.status);
      }
    } else {
      console.warn('[HANDLER-MESSAGE-UPDATE] Message not found: ' + msgId);
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
  console.log('[HANDLER-MESSAGE] START - Processing incoming message');
  
  try {
    const numero = payload.from;
    if (!numero || numero === 'unknown') {
      throw new Error('Phone number missing or invalid');
    }
    console.log('[HANDLER-MESSAGE] Phone number: ' + numero);

    let contato;
    const contatosExistentes = await base44.asServiceRole.entities.Contact.filter({ 
      telefone: numero 
    });
    
    if (contatosExistentes.length > 0) {
      contato = contatosExistentes[0];
      console.log('[HANDLER-MESSAGE] Contact found: ' + contato.id);
      
      await base44.asServiceRole.entities.Contact.update(contato.id, { 
        ultima_interacao: new Date().toISOString() 
      });
    } else {
      contato = await base44.asServiceRole.entities.Contact.create({
        nome: payload.pushName || numero,
        telefone: numero,
        tipo_contato: 'lead',
        whatsapp_status: 'verificado',
        ultima_interacao: new Date().toISOString()
      });
      console.log('[HANDLER-MESSAGE] Contact created: ' + contato.id);
    }

    let integracaoId = null;
    if (instance && instance !== 'unknown') {
      const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ 
        instance_id_provider: instance 
      });
      if (integracoes.length > 0) {
        integracaoId = integracoes[0].id;
        console.log('[HANDLER-MESSAGE] Integration found: ' + integracaoId);
      } else {
        console.warn('[HANDLER-MESSAGE] Integration not found for instance: ' + instance);
      }
    }

    let thread;
    const threadsExistentes = await base44.asServiceRole.entities.MessageThread.filter({ 
      contact_id: contato.id 
    });
    
    if (threadsExistentes.length > 0) {
      thread = threadsExistentes[0];
      console.log('[HANDLER-MESSAGE] Thread found: ' + thread.id);
      
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        last_message_at: new Date().toISOString(),
        last_message_sender: 'contact',
        last_message_content: payload.content ? payload.content.substring(0, 100) : '[No content]',
        unread_count: (thread.unread_count || 0) + 1,
        total_mensagens: (thread.total_mensagens || 0) + 1,
        status: 'aberta'
      });
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
      console.log('[HANDLER-MESSAGE] Thread created: ' + thread.id);
    }

    if (payload.messageId) {
      const mensagensExistentes = await base44.asServiceRole.entities.Message.filter({ 
        whatsapp_message_id: payload.messageId 
      });
      
      if (mensagensExistentes.length > 0) {
        console.log('[HANDLER-MESSAGE] DUPLICATE detected: ' + payload.messageId);
        return Response.json({ 
          success: true, 
          processed: 'duplicate',
          messageId: payload.messageId,
          version: VERSION
        }, { status: 200, headers });
      }
    }

    const mensagem = await base44.asServiceRole.entities.Message.create({
      thread_id: thread.id,
      sender_id: contato.id,
      sender_type: 'contact',
      content: payload.content || '[No content]',
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
        timestamp: payload.timestamp
      }
    });

    console.log('[HANDLER-MESSAGE] SUCCESS - Message saved: ' + mensagem.id);
    
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
        integration_id: integracaoId
      };
    }
    
    return Response.json(response, { status: 200, headers });

  } catch (error) {
    console.error('[HANDLER-MESSAGE] FAILED: ' + error.message);
    console.error('[HANDLER-MESSAGE] Stack: ' + error.stack);
    throw error;
  }
}

async function findIntegration(instance, base44) {
  if (!instance || instance === 'unknown') {
    console.warn('[HELPER-FIND-INTEGRATION] No instance provided');
    return null;
  }
  
  try {
    const integrations = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ 
      instance_id_provider: instance 
    });
    
    if (integrations.length > 0) {
      console.log('[HELPER-FIND-INTEGRATION] Found integration: ' + integrations[0].id);
      return integrations[0];
    }
    
    console.warn('[HELPER-FIND-INTEGRATION] No integration found for instance: ' + instance);
    return null;
    
  } catch (error) {
    console.error('[HELPER-FIND-INTEGRATION] Error: ' + error.message);
    return null;
  }
}