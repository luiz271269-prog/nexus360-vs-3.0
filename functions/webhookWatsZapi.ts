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

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  console.log(`[Z-API-WEBHOOK] 📥 REQUEST | Método: ${req.method} | URL: ${req.url}`);
  
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
      const body = await req.text();
      console.log(`[Z-API-WEBHOOK] 📦 BODY RAW (${body.length} chars):`, body.substring(0, 500));
      payload = JSON.parse(body);
    } catch (e) {
      console.error('[Z-API-WEBHOOK] ❌ Erro ao parsear JSON:', e);
      return Response.json({ error: 'JSON inválido' }, { status: 400 });
    }

    console.log('[Z-API-WEBHOOK] ✅ PAYLOAD:', JSON.stringify(payload, null, 2).substring(0, 1000));

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

    // ✅ DELEGAR TUDO para webhookFinalZapi (v10.0.0-PURE-INGESTION)
    console.log(`[webhookWatsZapi] 🔀 Delegando para webhookFinalZapi...`);
    
    try {
      const response = await base44.asServiceRole.functions.invoke('webhookFinalZapi', payload);
      
      if (response?.data) {
        console.log(`[webhookWatsZapi] ✅ Delegação bem-sucedida: ${JSON.stringify(response.data).substring(0, 200)}`);
        return Response.json(response.data, { status: 200 });
      }
      
      // Se não houver data, retornar resposta genérica
      return Response.json({ 
        status: 'delegated',
        note: 'Processado via webhookFinalZapi'
      }, { status: 200 });
      
    } catch (error) {
      console.error('[webhookWatsZapi] ❌ Erro ao delegar:', error);
      return Response.json({ 
        error: 'Erro na delegação',
        message: error.message 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[webhookWatsZapi] ❌ Erro:', error);
    return Response.json({ 
      error: 'Erro interno',
      message: error.message 
    }, { status: 500 });
  }
});