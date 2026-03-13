/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔗 WEBHOOK Z-API - PROXY PARA webhookFinalZapi (COMPATIBILIDADE)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * ⚠️ DEPRECATED: Este é um alias para manter compatibilidade.
 * 📌 USAR webhookFinalZapi (v10.0.0-PURE-INGESTION) em nova configuração.
 * 
 * Função original: Processa eventos do Z-API
 * - ReceivedCallback: Mensagens recebidas
 * - MessageStatusCallback: Status de leitura/entrega  
 * - PresenceChatCallback: Indicadores de digitação (ignorados)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    // Health check GET
    if (req.method === 'GET') {
      return Response.json({
        status: 'ok',
        service: 'webhookWatsZapi',
        version: 'v1.0-compatible',
        note: 'Use webhookFinalZapi (v10.0.0-PURE-INGESTION) for new integrations',
        timestamp: new Date().toISOString()
      }, { status: 200 });
    }

    // POST - processar eventos
    if (req.method !== 'POST') {
      return Response.json({ error: 'Método não permitido' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    let payload;

    try {
      payload = await req.json();
    } catch (e) {
      console.error('[webhookWatsZapi] Erro ao parsear JSON:', e);
      return Response.json({ error: 'JSON inválido' }, { status: 400 });
    }

    console.log('[webhookWatsZapi] 📥 Evento recebido (PROXY):', {
      type: payload.type,
      phone: payload.phone,
      instanceId: payload.instanceId
    });

    // ✅ Validação básica
    if (!payload || !payload.instanceId) {
      return Response.json({ 
        error: 'Payload inválido - falta instanceId',
        received: Object.keys(payload || {})
      }, { status: 400 });
    }

    const type = payload.type;

    // Ignorar eventos de sistema
    if (type === 'event_system' || type === 'PresenceChatCallback') {
      console.log(`[webhookWatsZapi] ⏭️ Ignorado: ${type}`);
      return Response.json({ status: 'ignored' }, { status: 200 });
    }

    // ✅ Delegar para webhookFinalZapi via invoke interno (não HTTP)
    if (type === 'ReceivedCallback' || type === 'MessageStatusCallback') {
      try {
        console.log(`[webhookWatsZapi] 🔀 Delegando ${type} para webhookFinalZapi via invoke interno`);
        
        // ✅ INVOKE INTERNO - sem HTTP, sem auth necessária
        const resultado = await base44.asServiceRole.functions.invoke(
          'webhookFinalZapi',
          payload
        );
        
        console.log(`[webhookWatsZapi] ✅ Delegado com sucesso: ${type}`);
        
        return Response.json({ 
          status: 'delegated',
          messageId: payload.messageId,
          result: resultado
        }, { status: 200 });
      } catch (error) {
        console.error('[webhookWatsZapi] ❌ Erro ao delegar:', error);
        return Response.json({ 
          error: 'Erro ao delegar',
          message: error.message 
        }, { status: 500 });
      }
    }



    // Evento desconhecido
    return Response.json({ 
      status: 'unknown_type',
      type: type 
    }, { status: 200 });

  } catch (error) {
    console.error('[webhookWatsZapi] ❌ Erro:', error);
    return Response.json({ 
      error: 'Erro interno',
      message: error.message 
    }, { status: 500 });
  }
});