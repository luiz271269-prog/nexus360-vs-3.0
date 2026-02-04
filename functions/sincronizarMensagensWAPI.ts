// ============================================================================
// SINCRONIZADOR DE MENSAGENS W-API - Comparação com Provedor
// ============================================================================
// Versão: 2.0.0 - Data: 2026-02-04
// 
// OBJETIVO: Buscar mensagens DIRETO do provedor (W-API/Z-API) e comparar
// com o banco local para identificar MENSAGENS FALTANDO.
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Normaliza telefone para formato padrão (+5548999999999)
 */
function normalizarTelefone(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('55')) return '+' + cleaned;
  if (cleaned.length === 11 || cleaned.length === 10) return '+55' + cleaned;
  return '+' + cleaned;
}

/**
 * Busca mensagens direto da W-API usando logs salvos
 */
async function buscarMensagensWAPI({ base44Instance, integration, from, to, phone }) {
  const baseUrl = integration.base_url_provider || 'https://api.w-api.app';
  const token = integration.api_key_provider;
  const instanceId = integration.instance_id_provider;
  
  if (!token || !instanceId) {
    throw new Error('Token ou instanceId ausente na integração');
  }
  
  console.log(`[SYNC-WAPI] 📡 Buscando mensagens da W-API...`);
  console.log(`[SYNC-WAPI] 🔑 Instance: ${instanceId}`);
  console.log(`[SYNC-WAPI] 📅 Período: ${from} → ${to}`);
  
  try {
    // W-API: Buscar do nosso próprio log (ZapiPayloadNormalized) como fonte confiável
    console.log(`[SYNC-WAPI] ℹ️  Buscando logs salvos (webhooks recebidos)...`);
    
    const logsWapi = await base44Instance.asServiceRole.entities.ZapiPayloadNormalized.filter({
      integration_id: integration.id,
      provider: 'w_api',
      evento: 'ReceivedCallback',
      timestamp_recebido: {
        $gte: from,
        $lte: to
      }
    }, 'timestamp_recebido', 10000);
    
    console.log(`[SYNC-WAPI] ✅ ${logsWapi.length} eventos encontrados nos logs salvos`);
    
    // Extrair mensagens dos payloads brutos
    const messages = logsWapi
      .filter(log => {
        const payload = log.payload_bruto;
        if (!payload) return false;
        
        // Apenas mensagens recebidas
        const data = payload.data || payload;
        if (data.fromMe === true) return false;
        
        // Filtrar por telefone
        if (phone) {
          const msgPhone = normalizarTelefone(data.from || data.phone);
          const filterPhone = normalizarTelefone(phone);
          if (msgPhone !== filterPhone) return false;
        }
        
        return true;
      })
      .map(log => {
        const payload = log.payload_bruto;
        const data = payload.data || payload;
        
        return {
          message_id: data.id || data.messageId || data.key?.id,
          from: normalizarTelefone(data.from || data.phone),
          content: data.text?.message || data.body || '',
          timestamp: log.timestamp_recebido,
          type: data.type || 'text',
          pushName: data.pushName || data.senderName,
          raw: payload
        };
      });
    
    console.log(`[SYNC-WAPI] 🎯 ${messages.length} mensagens válidas após filtros`);
    
    return messages;
    
  } catch (error) {
    console.error('[SYNC-WAPI] ❌ Erro ao buscar mensagens:', error.message);
    throw error;
  }
}

/**
 * Busca mensagens direto da Z-API usando logs salvos
 */
async function buscarMensagensZAPI({ base44Instance, integration, from, to, phone }) {
  console.log(`[SYNC-ZAPI] 📡 Buscando mensagens da Z-API (via logs)...`);
  console.log(`[SYNC-ZAPI] 🔑 Instance: ${integration.instance_id_provider}`);
  console.log(`[SYNC-ZAPI] 📅 Período: ${from} → ${to}`);
  
  try {
    // Z-API: Buscar do nosso próprio log (ZapiPayloadNormalized) como fonte confiável
    const logsZapi = await base44Instance.asServiceRole.entities.ZapiPayloadNormalized.filter({
      integration_id: integration.id,
      provider: 'z_api',
      evento: 'ReceivedCallback',
      timestamp_recebido: {
        $gte: from,
        $lte: to
      }
    }, 'timestamp_recebido', 10000);
    
    console.log(`[SYNC-ZAPI] ✅ ${logsZapi.length} eventos encontrados nos logs salvos`);
    
    // Extrair mensagens dos payloads brutos
    const messages = logsZapi
      .filter(log => {
        const payload = log.payload_bruto;
        if (!payload) return false;
        
        // Apenas mensagens recebidas
        if (payload.fromMe === true) return false;
        
        // Filtrar por telefone
        if (phone) {
          const msgPhone = normalizarTelefone(payload.phone || payload.from);
          const filterPhone = normalizarTelefone(phone);
          if (msgPhone !== filterPhone) return false;
        }
        
        return true;
      })
      .map(log => {
        const payload = log.payload_bruto;
        
        return {
          message_id: payload.messageId || payload.id,
          from: normalizarTelefone(payload.phone || payload.from),
          content: payload.text?.message || payload.body || '',
          timestamp: log.timestamp_recebido,
          type: payload.type || 'text',
          pushName: payload.senderName || payload.pushName,
          raw: payload
        };
      });
    
    console.log(`[SYNC-ZAPI] 🎯 ${messages.length} mensagens válidas após filtros`);
    
    return messages;
    
  } catch (error) {
    console.error('[SYNC-ZAPI] ❌ Erro ao buscar mensagens:', error.message);
    throw error;
  }
}

// ============================================================================
// FUNÇÃO PRINCIPAL: Sincronizar mensagens com provedor
// ============================================================================
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // 🔒 SEGURANÇA: Apenas admins
    if (!user || user.role !== 'admin') {
      return Response.json({ 
        success: false, 
        error: 'Acesso negado. Apenas administradores.' 
      }, { status: 403 });
    }
    
    const { integrationId, from, to, phone, syncMissing = false } = await req.json();
    
    // Validações
    if (!integrationId || !from || !to) {
      return Response.json({ 
        success: false, 
        error: 'Parâmetros obrigatórios: integrationId, from, to' 
      }, { status: 400 });
    }
    
    console.log(`[SYNC] 🚀 Iniciando sincronização para integração ${integrationId}`);
    console.log(`[SYNC] 📅 Período: ${from} → ${to}`);
    console.log(`[SYNC] 🔄 Modo: ${syncMissing ? 'SINCRONIZAR' : 'APENAS COMPARAR'}`);
    
    // Buscar integração
    const integration = await base44.asServiceRole.entities.WhatsAppIntegration.get(integrationId);
    
    if (!integration) {
      return Response.json({ 
        success: false, 
        error: 'Integração não encontrada' 
      }, { status: 404 });
    }
    
    const provider = integration.api_provider;
    
    // ═══════════════════════════════════════════════════════════════════
    // ETAPA 1: Buscar mensagens dos LOGS SALVOS (webhooks recebidos)
    // ═══════════════════════════════════════════════════════════════════
    let mensagensProvedor = [];
    
    try {
      if (provider === 'w_api') {
        mensagensProvedor = await buscarMensagensWAPI({ base44Instance: base44, integration, from, to, phone });
      } else if (provider === 'z_api') {
        mensagensProvedor = await buscarMensagensZAPI({ base44Instance: base44, integration, from, to, phone });
      } else {
        return Response.json({
          success: false,
          error: `Provedor ${provider} não suportado para sincronização`
        }, { status: 400 });
      }
    } catch (error) {
      return Response.json({
        success: false,
        error: `Erro ao buscar logs: ${error.message}`
      }, { status: 500 });
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // ETAPA 2: Buscar mensagens do BANCO LOCAL
    // ═══════════════════════════════════════════════════════════════════
    const idsProvedor = mensagensProvedor
      .map(m => m.message_id)
      .filter(Boolean);
    
    console.log(`[SYNC] 🔍 Verificando ${idsProvedor.length} IDs no banco local...`);
    
    const mensagensBanco = await base44.asServiceRole.entities.Message.filter({
      whatsapp_message_id: { $in: idsProvedor }
    }, '-sent_at', 5000);
    
    const idsBanco = new Set(mensagensBanco.map(m => m.whatsapp_message_id));
    
    // ═══════════════════════════════════════════════════════════════════
    // ETAPA 3: COMPARAÇÃO - Encontrar mensagens faltando
    // ═══════════════════════════════════════════════════════════════════
    const mensagensFaltando = mensagensProvedor.filter(m => 
      m.message_id && !idsBanco.has(m.message_id)
    );
    
    console.log(`[SYNC] 📊 RESULTADO DA COMPARAÇÃO:`);
    console.log(`[SYNC] 📱 Provedor: ${mensagensProvedor.length} mensagens`);
    console.log(`[SYNC] 💾 Banco: ${mensagensBanco.length} mensagens`);
    console.log(`[SYNC] ❌ Faltando: ${mensagensFaltando.length} mensagens`);
    
    // ═══════════════════════════════════════════════════════════════════
    // ETAPA 4: SINCRONIZAR (se solicitado)
    // ═══════════════════════════════════════════════════════════════════
    const resultadoSync = {
      mensagens_provedor: mensagensProvedor.length,
      mensagens_banco: mensagensBanco.length,
      mensagens_faltando: mensagensFaltando.length,
      faltando_detalhes: mensagensFaltando.map(m => ({
        message_id: m.message_id,
        from: m.from,
        content: m.content?.substring(0, 50) || '',
        timestamp: new Date(m.timestamp * 1000).toISOString(),
        type: m.type
      })),
      sincronizadas: 0,
      erros_sync: 0
    };
    
    if (syncMissing && mensagensFaltando.length > 0) {
      console.log(`[SYNC] 🔄 Iniciando sincronização de ${mensagensFaltando.length} mensagens...`);
      
      for (const msgFaltando of mensagensFaltando) {
        try {
          // Invocar webhook interno para reprocessar
          const payload = msgFaltando.raw;
          
          const response = await base44.asServiceRole.functions.invoke(
            provider === 'w_api' ? 'webhookWapi' : 'webhookFinalZapi',
            payload
          );
          
          if (response.data.success || response.data.message_id) {
            resultadoSync.sincronizadas++;
            console.log(`[SYNC] ✅ Mensagem sincronizada: ${msgFaltando.message_id}`);
          } else {
            resultadoSync.erros_sync++;
            console.error(`[SYNC] ❌ Erro ao sincronizar: ${msgFaltando.message_id}`);
          }
          
          // Delay para evitar rate limit
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          resultadoSync.erros_sync++;
          console.error(`[SYNC] ❌ Erro definitivo: ${msgFaltando.message_id} - ${error.message}`);
        }
      }
      
      console.log(`[SYNC] ✅ Sincronização concluída: ${resultadoSync.sincronizadas} OK, ${resultadoSync.erros_sync} erros`);
    }
    
    // Auditoria
    await base44.asServiceRole.entities.AuditLog.create({
      acao: 'sincronizar_mensagens_provedor',
      entidade_tipo: 'WhatsAppIntegration',
      entidade_id: integrationId,
      usuario_id: user.id,
      timestamp: new Date().toISOString(),
      detalhes: {
        integration_id: integrationId,
        provider,
        periodo: { from, to },
        phone_filtro: phone || null,
        resultados: resultadoSync
      },
      origem: 'manual',
      nivel: 'info'
    });
    
    return Response.json({
      success: true,
      provider,
      resultados: resultadoSync,
      mensagem: syncMissing 
        ? `Sincronização concluída: ${resultadoSync.sincronizadas}/${mensagensFaltando.length} recuperadas`
        : `Comparação concluída: ${mensagensFaltando.length} mensagens faltando`
    });
    
  } catch (error) {
    console.error('[SYNC] ❌ Erro crítico:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});