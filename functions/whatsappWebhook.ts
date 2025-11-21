// BUILD TIMESTAMP: 2025-11-21T00:45:00Z
// VERSION: v2.7.1-DIAGNOSTIC
// IF YOU SEE OLD LOGS = BUILD SYSTEM IS CACHING

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { 
  normalizarPayloadZAPI, 
  extrairInstanceId
} from './adapters/zapiAdapter.js';

const VERSION = 'v2.7.1-DIAGNOSTIC';
const BUILD = '2025-11-21T00:45:00Z';

// IMMEDIATE LOG - RUNS ON COLD START
console.log('==========================================================');
console.log(`WEBHOOK ${VERSION} LOADED - BUILD ${BUILD}`);
console.log('==========================================================');

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

Deno.serve(async (req) => {
  console.log(`[${VERSION}] Request received at ${new Date().toISOString()}`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === 'GET') {
    console.log(`[${VERSION}] Health check`);
    return new Response(JSON.stringify({ 
      version: VERSION, 
      build: BUILD,
      status: 'operational',
      timestamp: new Date().toISOString()
    }), { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  let auditLogId = null;

  try {
    const base44 = createClientFromRequest(req.clone());
    console.log(`[${VERSION}] SDK initialized`);

    let rawBody = '';
    let evento;

    try {
      rawBody = await req.text();
      console.log(`[${VERSION}] Payload size: ${rawBody.length} bytes`);
      
      if (!rawBody || rawBody.trim() === '') {
        console.warn(`[${VERSION}] Empty payload`);
        return Response.json(
          { success: false, error: 'Empty payload', version: VERSION },
          { status: 200, headers: corsHeaders }
        );
      }
      
      evento = JSON.parse(rawBody);
      console.log(`[${VERSION}] JSON parsed`);

    } catch (e) {
      console.error(`[${VERSION}] Parse error:`, e.message);
      return Response.json(
        { success: false, error: e.message, version: VERSION },
        { status: 200, headers: corsHeaders }
      );
    }

    const eventoTipo = evento.event || evento.type || evento.event_type || evento.eventName || 'ReceivedCallback';
    const instanceId = evento.instance || evento.instanceId || evento.instance_id || extrairInstanceId(evento);

    console.log(`[${VERSION}] Event: ${eventoTipo} | Instance: ${instanceId}`);

    // Audit log
    try {
      const auditLog = await base44.asServiceRole.entities.ZapiPayloadNormalized.create({
        payload_bruto: evento,
        instance_identificado: instanceId || 'unknown',
        evento: eventoTipo || 'unknown',
        timestamp_recebido: new Date().toISOString(),
        sucesso_processamento: false
      });
      auditLogId = auditLog.id;
      console.log(`[${VERSION}] Audit log: ${auditLogId}`);
    } catch (err) {
      console.error(`[${VERSION}] Audit error:`, err.message);
    }

    // Normalize
    let payloadNormalizado = normalizarPayloadZAPI(evento);

    // Emergency bypass
    if (!payloadNormalizado || payloadNormalizado.type === 'unknown') {
        const rawEventStr = String(evento.event || evento.type || '').trim().toLowerCase();
        if (rawEventStr.includes('receivedcallback') || rawEventStr.includes('message')) {
           console.warn(`[${VERSION}] Emergency bypass activated`);
           if (!payloadNormalizado) payloadNormalizado = {};
           payloadNormalizado.type = 'message';
           payloadNormalizado.instanceId = instanceId;
           payloadNormalizado.messageId = evento.messageId || `FB_${Date.now()}`;
           payloadNormalizado.from = evento.phone || evento.telefone;
           payloadNormalizado.content = evento.text?.message || '[Recovered]';
        }
    }

    console.log(`[${VERSION}] Handler: ${payloadNormalizado.type}`);

    // Route
    let resultado;
    switch (payloadNormalizado.type) {
      case 'qrcode':
        resultado = await handleQRCode(instanceId, payloadNormalizado, base44, corsHeaders);
        break;
      case 'connection':
        resultado = await handleConnection(instanceId, payloadNormalizado, base44, corsHeaders);
        break;
      case 'message':
        resultado = await handleMessage(instanceId, payloadNormalizado, base44, corsHeaders);
        break;
      case 'message_update':
        resultado = await handleMessageUpdate(payloadNormalizado, base44, corsHeaders);
        break;
      default:
        console.log(`[${VERSION}] Unknown event: ${payloadNormalizado.type}`);
        resultado = Response.json(
          { success: true, ignored: true, type: payloadNormalizado.type, version: VERSION },
          { status: 200, headers: corsHeaders }
        );
    }

    // Update audit
    if (auditLogId) {
        await base44.asServiceRole.entities.ZapiPayloadNormalized.update(auditLogId, {
            sucesso_processamento: true,
            integration_id: payloadNormalizado.integrationId || null
        }).catch(() => {});
    }

    return resultado;

  } catch (error) {
    console.error(`[${VERSION}] FATAL:`, error.message);
    console.error(`[${VERSION}] Stack:`, error.stack);
    return Response.json(
      { success: false, error: error.message, version: VERSION },
      { status: 500, headers: corsHeaders }
    );
  }
});

async function handleQRCode(instance, payload, base44, headers) {
    const int = await findIntegration(instance, base44);
    if (int) {
        await base44.asServiceRole.entities.WhatsAppIntegration.update(int.id, {
            qr_code_url: payload.qrCodeUrl,
            status: 'pendente_qrcode',
            ultima_atividade: new Date().toISOString()
        });
    }
    return Response.json({ success: true, processed: 'qrcode' }, { status: 200, headers });
}

async function handleConnection(instance, payload, base44, headers) {
    const int = await findIntegration(instance, base44);
    if (int) {
        await base44.asServiceRole.entities.WhatsAppIntegration.update(int.id, {
            status: payload.status,
            ultima_atividade: new Date().toISOString()
        });
    }
    return Response.json({ success: true, processed: 'connection' }, { status: 200, headers });
}

async function handleMessageUpdate(payload, base44, headers) {
    const msgId = payload.messageId;
    if (msgId) {
        const msgs = await base44.asServiceRole.entities.Message.filter({ whatsapp_message_id: msgId });
        if (msgs.length > 0) {
            const updates = {};
            if (payload.status === 'READ') updates.status = 'lida';
            else if (payload.status === 'DELIVERED') updates.status = 'entregue';
            
            if (Object.keys(updates).length > 0) {
                await base44.asServiceRole.entities.Message.update(msgs[0].id, updates);
            }
        }
    }
    return Response.json({ success: true, processed: 'status_update' }, { status: 200, headers });
}

async function handleMessage(instance, payload, base44, headers) {
    console.log(`[${VERSION}] Processing message...`);
    
    try {
        const numero = payload.from;
        if (!numero) throw new Error('No phone number');

        // Find/Create Contact
        let contato = (await base44.asServiceRole.entities.Contact.filter({ telefone: numero }))[0];
        if (!contato) {
            contato = await base44.asServiceRole.entities.Contact.create({
                nome: payload.pushName || numero,
                telefone: numero,
                tipo_contato: 'lead',
                whatsapp_status: 'verificado',
                ultima_interacao: new Date().toISOString()
            });
            console.log(`[${VERSION}] Contact created: ${contato.id}`);
        } else {
             await base44.asServiceRole.entities.Contact.update(contato.id, { 
                 ultima_interacao: new Date().toISOString() 
             });
        }

        // Find Integration
        let integracaoId = null;
        if (instance) {
            const ints = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ 
                instance_id_provider: instance 
            });
            if (ints.length > 0) integracaoId = ints[0].id;
        }

        // Find/Create Thread
        let thread = (await base44.asServiceRole.entities.MessageThread.filter({ 
            contact_id: contato.id 
        }))[0];
        
        if (!thread) {
            thread = await base44.asServiceRole.entities.MessageThread.create({
                contact_id: contato.id,
                whatsapp_integration_id: integracaoId,
                status: 'aberta',
                primeira_mensagem_at: new Date().toISOString(),
                ultima_atividade: new Date().toISOString(),
                total_mensagens: 0,
                unread_count: 0
            });
        }

        // Duplicate check
        if (payload.messageId) {
            const exists = await base44.asServiceRole.entities.Message.filter({ 
                whatsapp_message_id: payload.messageId 
            });
            if (exists.length > 0) {
                console.log(`[${VERSION}] Duplicate detected`);
                return Response.json({ 
                    success: true, 
                    processed: 'duplicate',
                    version: VERSION 
                }, { status: 200, headers });
            }
        }

        // Create Message
        const msg = await base44.asServiceRole.entities.Message.create({
            thread_id: thread.id,
            sender_id: contato.id,
            sender_type: 'contact',
            content: payload.content || '',
            media_url: payload.mediaTempUrl,
            media_type: payload.mediaType || 'none',
            channel: 'whatsapp',
            status: 'recebida',
            whatsapp_message_id: payload.messageId,
            sent_at: new Date().toISOString(),
            metadata: { whatsapp_integration_id: integracaoId }
        });

        console.log(`[${VERSION}] MESSAGE SAVED: ${msg.id}`);
        
        return Response.json({ 
            success: true, 
            processed: 'message_saved',
            message_id: msg.id,
            contact_id: contato.id,
            thread_id: thread.id,
            version: VERSION
        }, { status: 200, headers });

    } catch (e) {
        console.error(`[${VERSION}] Error:`, e.message);
        throw e;
    }
}

async function findIntegration(instance, base44) {
    if (!instance) return null;
    const ints = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ 
        instance_id_provider: instance 
    });
    return ints.length > 0 ? ints[0] : null;
}