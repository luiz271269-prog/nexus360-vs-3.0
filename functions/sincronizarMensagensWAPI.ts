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
 * Busca mensagens DIRETO DO PROVEDOR W-API
 */
async function buscarMensagensWAPI({ base44Instance, integration, from, to, phone }) {
  const baseUrl = integration.base_url_provider || 'https://api.w-api.app';
  const token = integration.api_key_provider;
  const instanceId = integration.instance_id_provider;
  
  if (!token || !instanceId) {
    throw new Error('Token ou instanceId ausente na integração');
  }
  
  console.log(`[SYNC-WAPI] 📡 Buscando mensagens DIRETO do provedor W-API...`);
  console.log(`[SYNC-WAPI] 🔑 Instance: ${instanceId}`);
  console.log(`[SYNC-WAPI] 📅 Período: ${from} → ${to}`);
  console.log(`[SYNC-WAPI] 🌐 URL: ${baseUrl}`);
  
  try {
    // W-API endpoint: GET /messages/{instance} com query params
    const fromTimestamp = new Date(from).getTime();
    const toTimestamp = new Date(to).getTime();
    
    const url = new URL(`${baseUrl}/messages/${instanceId}`);
    url.searchParams.append('start', fromTimestamp.toString()); // Unix timestamp em ms
    url.searchParams.append('end', toTimestamp.toString());
    if (phone) {
      url.searchParams.append('phone', normalizarTelefone(phone));
    }
    url.searchParams.append('limit', '500'); // Limite para evitar sobrecarga
    
    console.log(`[SYNC-WAPI] 🚀 Fazendo requisição para: ${url.toString()}`);
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`[SYNC-WAPI] 📥 Status HTTP: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SYNC-WAPI] ❌ Erro HTTP ${response.status}: ${errorText}`);
      throw new Error(`W-API retornou ${response.status}: ${errorText.substring(0, 200)}`);
    }
    
    const data = await response.json();
    
    // ✅ LOG DETALHADO DA ESTRUTURA (para debug - truncado em 2000 chars)
    const dataStr = JSON.stringify(data, null, 2);
    console.log(`[SYNC-WAPI] 📦 ESTRUTURA DA RESPOSTA (${dataStr.length} chars):`);
    console.log(dataStr.substring(0, 2000));
    if (dataStr.length > 2000) {
      console.log(`[SYNC-WAPI] ... (truncado em 2000 de ${dataStr.length} chars)`);
    }
    
    // Extrair array de mensagens (estrutura varia por provedor)
    const allMessages = data.messages || data.data || data.result || (Array.isArray(data) ? data : []);
    
    if (allMessages.length === 0) {
      console.warn(`[SYNC-WAPI] ⚠️ NENHUMA MENSAGEM RETORNADA. Verifique:`);
      console.warn(`[SYNC-WAPI]    - Endpoint correto?`);
      console.warn(`[SYNC-WAPI]    - Query params aceitos pelo provedor?`);
      console.warn(`[SYNC-WAPI]    - Provedor mantém histórico do período solicitado?`);
      console.warn(`[SYNC-WAPI]    - Chaves da resposta: ${Object.keys(data).join(', ')}`);
    } else {
      console.log(`[SYNC-WAPI] 📊 Total de mensagens retornadas: ${allMessages.length}`);
      // Log exemplo da primeira mensagem
      if (allMessages[0]) {
        console.log(`[SYNC-WAPI] 📝 Exemplo da 1ª mensagem:`, JSON.stringify(allMessages[0], null, 2).substring(0, 500));
      }
    }
    
    // Filtrar por período (já filtrado na query, mas validar novamente)
    const filtered = allMessages.filter(msg => {
      // ✅ Normalização robusta de timestamp
      let msgTimestamp;
      if (typeof msg.timestamp === 'number') {
        // Detectar se é segundos ou milissegundos (> 10 bilhões = ms)
        msgTimestamp = msg.timestamp > 100000000000 ? msg.timestamp : msg.timestamp * 1000;
      } else if (typeof msg.t === 'number') {
        msgTimestamp = msg.t > 100000000000 ? msg.t : msg.t * 1000;
      } else if (msg.created_at || msg.date) {
        msgTimestamp = new Date(msg.created_at || msg.date).getTime();
      } else {
        console.warn(`[SYNC-WAPI] ⚠️ Mensagem ${msg.id || msg.messageId || 'sem ID'} SEM timestamp válido. Campos disponíveis:`, Object.keys(msg).join(', '));
        return false; // Descartar mensagens sem timestamp
      }
      
      if (msgTimestamp < fromTimestamp || msgTimestamp > toTimestamp) {
        console.log(`[SYNC-WAPI] ➖ Ignorando por período: ${new Date(msgTimestamp).toISOString()} fora de ${from} → ${to}`);
        return false;
      }
      
      // Apenas mensagens recebidas (não enviadas por nós)
      if (msg.fromMe === true || msg.from_me === true) return false;
      
      // Filtrar por telefone se especificado
      if (phone) {
        const msgPhone = normalizarTelefone(msg.from || msg.phone || msg.sender?.id || msg.chatId);
        const filterPhone = normalizarTelefone(phone);
        if (msgPhone !== filterPhone) return false;
      }
      
      return true;
    });
    
    console.log(`[SYNC-WAPI] 🎯 ${filtered.length} mensagens após filtros (período + direção + telefone)`);
    
    return filtered.map(msg => ({
      message_id: msg.id || msg.messageId || msg.key?.id || msg._id,
      from: normalizarTelefone(msg.from || msg.phone || msg.sender?.id || msg.chatId),
      content: msg.text?.message || msg.body || msg.message || msg.content || '',
      timestamp: msg.timestamp || msg.t || Math.floor(new Date(msg.created_at || msg.date).getTime() / 1000),
      type: msg.type || (msg.msgContent ? 'media' : 'text'),
      pushName: msg.pushName || msg.senderName || msg.sender?.pushName || msg.notifyName,
      raw: msg
    }));
    
  } catch (error) {
    console.error('[SYNC-WAPI] ❌ Erro ao buscar do provedor:', error.message);
    throw error;
  }
}

/**
 * Busca mensagens DIRETO DO PROVEDOR Z-API
 */
async function buscarMensagensZAPI({ base44Instance, integration, from, to, phone }) {
  const baseUrl = integration.base_url_provider || 'https://api.z-api.io';
  const instanceId = integration.instance_id_provider;
  const token = integration.api_key_provider;
  const clientToken = integration.security_client_token_header;
  
  if (!instanceId || !token) {
    throw new Error('Configuração Z-API incompleta');
  }
  
  console.log(`[SYNC-ZAPI] 📡 Buscando mensagens DIRETO do provedor Z-API...`);
  console.log(`[SYNC-ZAPI] 🔑 Instance: ${instanceId}`);
  console.log(`[SYNC-ZAPI] 📅 Período: ${from} → ${to}`);
  
  try {
    // Z-API endpoint: GET /instances/{instance}/token/{token}/messages com query params
    const url = new URL(`${baseUrl}/instances/${instanceId}/token/${token}/messages`);
    url.searchParams.append('startDate', new Date(from).toISOString());
    url.searchParams.append('endDate', new Date(to).toISOString());
    if (phone) {
      url.searchParams.append('phone', normalizarTelefone(phone));
    }
    url.searchParams.append('limit', '500');
    
    console.log(`[SYNC-ZAPI] 🚀 Fazendo requisição para: ${url.toString()}`);
    
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (clientToken) {
      headers['Client-Token'] = clientToken;
    }
    
    const response = await fetch(url.toString(), { method: 'GET', headers });
    
    console.log(`[SYNC-ZAPI] 📥 Status HTTP: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SYNC-ZAPI] ❌ Erro HTTP ${response.status}: ${errorText}`);
      throw new Error(`Z-API retornou ${response.status}: ${errorText.substring(0, 200)}`);
    }
    
    const messages = await response.json();
    
    // ✅ LOG DETALHADO DA ESTRUTURA
    const msgStr = JSON.stringify(messages, null, 2);
    console.log(`[SYNC-ZAPI] 📦 ESTRUTURA DA RESPOSTA (${msgStr.length} chars):`);
    console.log(msgStr.substring(0, 2000));
    if (msgStr.length > 2000) {
      console.log(`[SYNC-ZAPI] ... (truncado em 2000 de ${msgStr.length} chars)`);
    }
    
    const msgArray = Array.isArray(messages) ? messages : (messages.data || []);
    
    if (msgArray.length === 0) {
      console.warn(`[SYNC-ZAPI] ⚠️ NENHUMA MENSAGEM RETORNADA. Verifique:`);
      console.warn(`[SYNC-ZAPI]    - Endpoint correto para sua instância/plano?`);
      console.warn(`[SYNC-ZAPI]    - Z-API mantém histórico desse período?`);
      console.warn(`[SYNC-ZAPI]    - Chaves da resposta: ${Object.keys(messages).join(', ')}`);
    } else {
      console.log(`[SYNC-ZAPI] 📊 Total de mensagens retornadas: ${msgArray.length}`);
      if (msgArray[0]) {
        console.log(`[SYNC-ZAPI] 📝 Exemplo da 1ª mensagem:`, JSON.stringify(msgArray[0], null, 2).substring(0, 500));
      }
    }
    
    // Filtrar por período e telefone (validar novamente)
    const fromTimestamp = new Date(from).getTime();
    const toTimestamp = new Date(to).getTime();
    
    const filtered = msgArray.filter(msg => {
      // ✅ Normalização robusta (Z-API usa 'momment' em segundos)
      let msgTimestamp;
      if (typeof msg.momment === 'number') {
        msgTimestamp = msg.momment * 1000;
      } else if (msg.timestamp) {
        msgTimestamp = new Date(msg.timestamp).getTime();
      } else {
        console.warn(`[SYNC-ZAPI] ⚠️ Mensagem ${msg.messageId || msg.id || 'sem ID'} SEM timestamp válido. Campos disponíveis:`, Object.keys(msg).join(', '));
        return false;
      }
      
      if (msgTimestamp < fromTimestamp || msgTimestamp > toTimestamp) {
        console.log(`[SYNC-ZAPI] ➖ Ignorando por período: ${new Date(msgTimestamp).toISOString()}`);
        return false;
      }
      
      // Apenas recebidas
      if (msg.fromMe === true) return false;
      
      // Filtrar por telefone
      if (phone) {
        const msgPhone = normalizarTelefone(msg.phone || msg.from);
        const filterPhone = normalizarTelefone(phone);
        if (msgPhone !== filterPhone) return false;
      }
      
      return true;
    });
    
    console.log(`[SYNC-ZAPI] 🎯 ${filtered.length} mensagens após filtros`);
    
    return filtered.map(msg => ({
      message_id: msg.messageId || msg.id,
      from: normalizarTelefone(msg.phone || msg.from),
      content: msg.text?.message || msg.body || '',
      timestamp: msg.momment,
      type: msg.type || 'text',
      pushName: msg.senderName || msg.pushName,
      raw: msg
    }));
    
  } catch (error) {
    console.error('[SYNC-ZAPI] ❌ Erro ao buscar do provedor:', error.message);
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