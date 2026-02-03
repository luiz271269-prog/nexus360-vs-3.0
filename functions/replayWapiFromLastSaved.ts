// ============================================================================
// REPLAY AUTOMÁTICO W-API - "A partir da última mensagem salva"
// ============================================================================
// Versão: 1.0.0 - Data: 2026-02-03
// 
// OBJETIVO: Detectar automaticamente o ponto de partida (última mensagem salva)
// e reprocessar eventos desde esse ponto até agora.
// ============================================================================

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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
    
    const { integrationId, marginSeconds = 60, phone } = await req.json();
    
    if (!integrationId) {
      return Response.json({ 
        success: false, 
        error: 'Parâmetro obrigatório: integrationId' 
      }, { status: 400 });
    }
    
    console.log(`[REPLAY-AUTO] 🔍 Detectando última mensagem salva para integração ${integrationId}...`);
    
    // 1. Buscar última mensagem desta integração
    const lastMessages = await base44.asServiceRole.entities.Message.filter({
      'metadata.whatsapp_integration_id': integrationId
    }, '-sent_at', 1);
    
    const now = new Date().toISOString();
    let from;
    
    if (!lastMessages || lastMessages.length === 0) {
      // Sem mensagens: usar marco de 24h atrás
      console.log('[REPLAY-AUTO] ⚠️ Nenhuma mensagem encontrada. Usando marco: agora - 24h');
      from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    } else {
      // Com mensagens: usar sent_at da última - margem de segurança
      const lastMsg = lastMessages[0];
      const lastDate = new Date(lastMsg.sent_at || lastMsg.created_date);
      from = new Date(lastDate.getTime() - (marginSeconds * 1000)).toISOString();
      
      console.log(`[REPLAY-AUTO] ✅ Última mensagem: ${lastMsg.id.substring(0, 12)}... em ${lastMsg.sent_at}`);
      console.log(`[REPLAY-AUTO] 📍 Replay a partir de: ${from} (${marginSeconds}s antes)`);
    }
    
    // 2. Chamar replayWapiEvents com a janela calculada
    console.log(`[REPLAY-AUTO] 🚀 Invocando replayWapiEvents...`);
    
    const replayResult = await base44.asServiceRole.functions.invoke('replayWapiEvents', {
      integrationId,
      from,
      to: now,
      phone
    });
    
    // 3. Retornar resultado enriquecido
    return Response.json({
      success: true,
      modo: 'auto_from_last_saved',
      ultima_mensagem_encontrada: lastMessages.length > 0,
      periodo_calculado: { from, to: now },
      margem_segundos: marginSeconds,
      replay_result: replayResult.data
    });
    
  } catch (error) {
    console.error('[REPLAY-AUTO] ❌ Erro:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});