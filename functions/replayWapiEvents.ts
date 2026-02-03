// ============================================================================
// REPLAY DE EVENTOS W-API - Recuperação de Mensagens Perdidas
// ============================================================================
// Versão: 1.0.0 - Data: 2026-02-03
// 
// OBJETIVO: Reprocessar eventos históricos de W-API para recuperar mensagens
// que não foram gravadas devido a quedas de banco, falhas ou inconsistências.
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { processInboundEvent } from './lib/inboundCore.js';

/**
 * Normaliza telefone para formato padrão (+5548999999999)
 */
function normalizarTelefone(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('55')) return '+' + cleaned;
  if (cleaned.length === 11) return '+55' + cleaned;
  return '+' + cleaned;
}

/**
 * Busca eventos históricos dos logs do provedor
 */
async function fetchWapiLogs({ base44, integrationId, from, to }) {
  console.log(`[REPLAY] 📥 Buscando logs de ${from} até ${to}...`);
  
  try {
    // Buscar logs armazenados na entidade ZapiPayloadNormalized
    const logs = await base44.asServiceRole.entities.ZapiPayloadNormalized.filter({
      integration_id: integrationId,
      timestamp_recebido: {
        $gte: from,
        $lte: to
      },
      provider: 'w_api'
    }, 'timestamp_recebido', 10000);
    
    console.log(`[REPLAY] ✅ ${logs.length} logs encontrados no banco`);
    return logs.map(log => log.payload_bruto);
    
  } catch (error) {
    console.error('[REPLAY] ❌ Erro ao buscar logs:', error.message);
    return [];
  }
}

/**
 * Normaliza payload W-API para formato do processInboundEvent
 */
function normalizarPayloadReplay(rawEvent) {
  // Estrutura esperada do W-API ReceivedCallback
  const data = rawEvent.data || rawEvent;
  
  return {
    contact: {
      telefone: normalizarTelefone(data.from || data.number),
      nome: data.pushName || data.from
    },
    thread: {
      // Thread será criada/buscada pelo processInboundEvent
    },
    message: {
      whatsapp_message_id: data.id || data.messageId,
      sender_type: 'contact',
      content: data.text?.message || data.body || '',
      channel: 'whatsapp',
      media_type: data.type === 'image' ? 'image' : 
                  data.type === 'video' ? 'video' :
                  data.type === 'audio' ? 'audio' :
                  data.type === 'document' ? 'document' : 'none',
      media_url: data.url || null,
      sent_at: data.timestamp ? new Date(data.timestamp * 1000).toISOString() : new Date().toISOString()
    },
    messageContent: data.text?.message || data.body || '',
    rawPayload: rawEvent
  };
}

// ============================================================================
// FUNÇÃO PRINCIPAL: Replay por janela de tempo
// ============================================================================
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // 🔒 SEGURANÇA: Apenas admins podem executar replay
    if (!user || user.role !== 'admin') {
      return Response.json({ 
        success: false, 
        error: 'Acesso negado. Apenas administradores podem executar replay.' 
      }, { status: 403 });
    }
    
    const { integrationId, from, to, phone } = await req.json();
    
    // Validações
    if (!integrationId || !from || !to) {
      return Response.json({ 
        success: false, 
        error: 'Parâmetros obrigatórios: integrationId, from, to' 
      }, { status: 400 });
    }
    
    console.log(`[REPLAY] 🚀 Iniciando replay para integração ${integrationId}`);
    console.log(`[REPLAY] 📅 Período: ${from} → ${to}`);
    if (phone) console.log(`[REPLAY] 📞 Filtro telefone: ${phone}`);
    
    // Buscar integração
    const integration = await base44.asServiceRole.entities.WhatsAppIntegration.get(integrationId);
    
    if (!integration) {
      return Response.json({ 
        success: false, 
        error: 'Integração não encontrada' 
      }, { status: 404 });
    }
    
    // Buscar eventos históricos
    const events = await fetchWapiLogs({ base44, integrationId, from, to });
    
    // Filtrar eventos válidos
    let candidates = events.filter(event => {
      const data = event.data || event;
      
      // Apenas ReceivedCallback
      if (event.event !== 'ReceivedCallback' && event.type !== 'ReceivedCallback') return false;
      
      // Apenas mensagens recebidas (não enviadas)
      if (data.fromMe === true) return false;
      
      // Filtrar por telefone se especificado
      if (phone) {
        const phoneNorm = normalizarTelefone(data.from || data.number);
        const filterNorm = normalizarTelefone(phone);
        if (phoneNorm !== filterNorm) return false;
      }
      
      return true;
    });
    
    console.log(`[REPLAY] 🎯 ${candidates.length} eventos candidatos para reprocessamento`);
    
    // Resultados
    const results = {
      total: candidates.length,
      created: 0,
      skipped: 0,
      errors: 0,
      detalhes: []
    };
    
    // Processar cada evento
    for (const event of candidates) {
      try {
        const normalized = normalizarPayloadReplay(event);
        
        // Chamar o processInboundEvent (que tem idempotência)
        const processResult = await processInboundEvent({
          base44,
          contact: normalized.contact,
          thread: normalized.thread,
          message: normalized.message,
          integration: integration,
          provider: 'w_api',
          messageContent: normalized.messageContent,
          rawPayload: normalized.rawPayload
        });
        
        if (processResult.skipped) {
          results.skipped++;
          results.detalhes.push({
            message_id: normalized.message.whatsapp_message_id,
            status: 'skipped',
            reason: processResult.reason
          });
        } else if (processResult.status === 'created' || processResult.handled_by_ura) {
          results.created++;
          results.detalhes.push({
            message_id: normalized.message.whatsapp_message_id,
            status: 'created',
            telefone: normalized.contact.telefone
          });
        }
        
      } catch (error) {
        results.errors++;
        results.detalhes.push({
          event: event,
          status: 'error',
          error: error.message
        });
        console.error('[REPLAY] ❌ Erro ao processar evento:', error.message);
      }
    }
    
    // Log final
    console.log(`[REPLAY] ✅ CONCLUÍDO: ${results.created} criadas | ${results.skipped} duplicatas | ${results.errors} erros`);
    
    // Registrar auditoria
    await base44.asServiceRole.entities.AuditLog.create({
      acao: 'replay_wapi_events',
      usuario_id: user.id,
      timestamp: new Date().toISOString(),
      detalhes: {
        integration_id: integrationId,
        periodo: { from, to },
        phone_filtro: phone || null,
        resultados: results
      },
      origem: 'manual',
      prioridade: 'alta'
    });
    
    return Response.json({
      success: true,
      resultados: results,
      mensagem: `Replay concluído: ${results.created} mensagens recuperadas, ${results.skipped} duplicatas ignoradas, ${results.errors} erros`
    });
    
  } catch (error) {
    console.error('[REPLAY] ❌ Erro crítico:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});