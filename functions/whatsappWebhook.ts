import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { 
  normalizarPayloadZAPI, 
  validarPayloadNormalizado,
  extrairInstanceId
} from './adapters/zapiAdapter.js';

/**
 * WHATSAPP WEBHOOK - Z-API + EVOLUTION API
 * Versao: 2.5 - FORCE UPDATE (Identificador Unico de Versao)
 *
 * Processa eventos com:
 * - Protecao de Stream (Clone)
 * - Normalizacao de payload
 * - Bypass de roteamento
 * - SEM EMOJIS
 */

Deno.serve(async (req) => {
  // LOG DE VERSAO CRITICO - SE ESTE LOG NAO APARECER, O DEPLOY FALHOU
  console.log('[WEBHOOK] ---------------------------------------------------');
  console.log('[WEBHOOK] v2.5 INICIADA - NOVA VERSAO CARREGADA');
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

  if (req.method === 'GET') {
    console.log('[WEBHOOK] GET Health Check OK');
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    // 1. INICIALIZAR BASE44 (USANDO CLONE)
    const base44 = createClientFromRequest(req.clone());
    console.log('[WEBHOOK] Base44 inicializado');

    // 2. LEITURA DO PAYLOAD
    let evento;
    let rawBody = '';

    try {
      rawBody = await req.text();
      console.log(`[WEBHOOK] Tamanho do Payload: ${rawBody.length} caracteres`);
      
      if (!rawBody || rawBody.trim() === '') {
        console.warn('[WEBHOOK] AVISO: Body vazio.');
        return Response.json(
          { success: false, error: 'Empty body received' },
          { status: 200, headers: corsHeaders }
        );
      }
      
      evento = JSON.parse(rawBody);
      console.log('[WEBHOOK] JSON parseado com sucesso');

    } catch (e) {
      console.error('[WEBHOOK] ERRO CRITICO na leitura do Body:', e.message);
      return Response.json(
        { success: false, error: 'JSON Parse Error: ' + e.message },
        { status: 200, headers: corsHeaders }
      );
    }

    // 3. EXTRACAO E NORMALIZACAO
    const eventoTipo = evento.event || evento.type || evento.event_type || evento.eventName || 'ReceivedCallback';
    const instanceExtraido = evento.instance || evento.instanceId || evento.instance_id || extrairInstanceId(evento);

    console.log('[WEBHOOK] Identificacao preliminar - Tipo:', eventoTipo, 'Instancia:', instanceExtraido);

    // Persistir Auditoria
    const timestampRecebido = new Date().toISOString();
    let auditLogId = null;

    try {
      const auditData = {
        payload_bruto: evento,
        instance_identificado: instanceExtraido || 'unknown',
        evento: eventoTipo || 'unknown',
        timestamp_recebido: timestampRecebido,
        sucesso_processamento: false
      };
      
      const auditLog = await base44.asServiceRole.entities.ZapiPayloadNormalized.create(auditData);
      auditLogId = auditLog.id;
      console.log(`[WEBHOOK] Auditoria criada ID: ${auditLogId}`);
    } catch (err) {
      console.error('[WEBHOOK] Falha na auditoria (nao critico):', err.message);
    }

    // 4. ADAPTER E BYPASS
    let payloadNormalizado = normalizarPayloadZAPI(evento);

    // BYPASS DE EMERGENCIA
    if (!payloadNormalizado || payloadNormalizado.type === 'unknown') {
        const rawEventStr = String(evento.event || evento.type || '').trim().toLowerCase();
        if (rawEventStr.includes('receivedcallback') || rawEventStr.includes('message')) {
           console.warn('[WEBHOOK] MITIGACAO: Forcando tipo "message"');
           if (!payloadNormalizado) payloadNormalizado = {};
           payloadNormalizado.type = 'message';
           payloadNormalizado.instanceId = instanceExtraido;
           
           payloadNormalizado.messageId = evento.messageId || payloadNormalizado.messageId || `FALLBACK_${Date.now()}`;
           payloadNormalizado.from = payloadNormalizado.from || evento.phone || evento.telefone;
           if(!payloadNormalizado.content) {
               payloadNormalizado.content = evento.text?.message || evento.content || '[Conteudo Recuperado]';
           }
        }
    }

    console.log(`[WEBHOOK] Roteando para tipo: ${payloadNormalizado.type}`);

    // 5. ROTEAMENTO
    let resultado;
    switch (payloadNormalizado.type) {
      case 'qrcode':
        resultado = await processarQRCodeUpdate(instanceExtraido, payloadNormalizado, base44, corsHeaders);
        break;
      case 'connection':
        resultado = await processarConnectionUpdate(instanceExtraido, payloadNormalizado, base44, corsHeaders);
        break;
      case 'message':
        resultado = await processarMensagemRecebida(instanceExtraido, payloadNormalizado, base44, corsHeaders);
        break;
      case 'message_update':
        resultado = await processarMensagemUpdate(payloadNormalizado, base44, corsHeaders);
        break;
      case 'send_confirmation':
        resultado = Response.json({ success: true, processed: 'send_confirmation' }, { status: 200, headers: corsHeaders });
        break;
      default:
        console.log('[WEBHOOK] Evento ignorado/desconhecido:', payloadNormalizado.type);
        resultado = Response.json(
          { success: true, ignored: 'unknown_event', type: payloadNormalizado.type },
          { status: 200, headers: corsHeaders }
        );
    }

    // Atualizar sucesso na auditoria
    if (auditLogId) {
        await base44.asServiceRole.entities.ZapiPayloadNormalized.update(auditLogId, {
            sucesso_processamento: true,
            integration_id: payloadNormalizado.integrationId || null
        }).catch(() => {});
    }

    return resultado;

  } catch (error) {
    console.error('[WEBHOOK] ERRO FATAL NO HANDLER:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
});

// --- FUNCOES DE PROCESSAMENTO ---

async function processarQRCodeUpdate(instance, payload, base44, headers) {
    const integracao = await buscarIntegracaoPorInstance(instance, base44);
    if (integracao) {
        await base44.asServiceRole.entities.WhatsAppIntegration.update(integracao.id, {
            qr_code_url: payload.qrCodeUrl,
            status: 'pendente_qrcode',
            ultima_atividade: new Date().toISOString()
        });
    }
    return Response.json({ success: true, processed: 'qrcode_updated' }, { status: 200, headers });
}

async function processarConnectionUpdate(instance, payload, base44, headers) {
    const integracao = await buscarIntegracaoPorInstance(instance, base44);
    if (integracao) {
        await base44.asServiceRole.entities.WhatsAppIntegration.update(integracao.id, {
            status: payload.status,
            ultima_atividade: new Date().toISOString()
        });
    }
    return Response.json({ success: true, processed: 'connection_updated' }, { status: 200, headers });
}

async function processarMensagemUpdate(payload, base44, headers) {
    const msgId = payload.messageId;
    if (msgId) {
        const msgs = await base44.asServiceRole.entities.Message.filter({ whatsapp_message_id: msgId });
        if (msgs.length > 0) {
            const status = payload.status;
            const updates = {};
            if (status === 'READ') updates.status = 'lida';
            else if (status === 'DELIVERED') updates.status = 'entregue';
            
            if (Object.keys(updates).length > 0) {
                await base44.asServiceRole.entities.Message.update(msgs[0].id, updates);
            }
        }
    }
    return Response.json({ success: true, processed: 'message_status_updated' }, { status: 200, headers });
}

async function processarMensagemRecebida(instance, payload, base44, headers) {
    console.log('[WEBHOOK] Iniciando processamento de mensagem...');
    
    try {
        // 1. Buscar/Criar Contato
        const numero = payload.from;
        if (!numero) throw new Error('Numero de origem nao encontrado');

        let contato = (await base44.asServiceRole.entities.Contact.filter({ telefone: numero }))[0];
        if (!contato) {
            contato = await base44.asServiceRole.entities.Contact.create({
                nome: payload.pushName || numero,
                telefone: numero,
                tipo_contato: 'lead',
                whatsapp_status: 'verificado',
                ultima_interacao: new Date().toISOString()
            });
            console.log('[WEBHOOK] Contato criado:', contato.id);
        } else {
             await base44.asServiceRole.entities.Contact.update(contato.id, { ultima_interacao: new Date().toISOString() });
        }

        // 2. Buscar Integracao
        let integracaoId = null;
        if (instance) {
            const ints = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ instance_id_provider: instance });
            if (ints.length > 0) integracaoId = ints[0].id;
        }

        // 3. Criar/Buscar Thread
        let thread = (await base44.asServiceRole.entities.MessageThread.filter({ contact_id: contato.id }))[0];
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

        // 4. Verificar Duplicidade
        if (payload.messageId) {
            const exists = await base44.asServiceRole.entities.Message.filter({ whatsapp_message_id: payload.messageId });
            if (exists.length > 0) {
                console.log('[WEBHOOK] Mensagem duplicada.');
                return Response.json({ success: true, processed: 'duplicate' }, { status: 200, headers });
            }
        }

        // 5. Criar Mensagem
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

        console.log('[WEBHOOK] MENSAGEM SALVA COM SUCESSO ID:', msg.id);
        
        return Response.json({ 
            success: true, 
            processed: 'message_saved',
            message_id: msg.id 
        }, { status: 200, headers });

    } catch (e) {
        console.error('[WEBHOOK] Erro ao salvar mensagem:', e);
        throw e;
    }
}

async function buscarIntegracaoPorInstance(instance, base44) {
    if (!instance) return null;
    const ints = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ instance_id_provider: instance });
    return ints.length > 0 ? ints[0] : null;
}