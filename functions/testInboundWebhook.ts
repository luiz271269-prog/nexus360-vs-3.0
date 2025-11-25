/**
 * FUNÇÃO DE TESTE PARA DIAGNÓSTICO DO INBOUND WEBHOOK
 * Use esta função para testar se o webhook está funcionando
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    console.log('🔍 [TEST] Webhook test iniciado');
    console.log('🔍 [TEST] Method:', req.method);
    console.log('🔍 [TEST] URL:', req.url);
    
    // Capturar o body
    let body;
    try {
      body = await req.json();
      console.log('🔍 [TEST] Body recebido:', JSON.stringify(body, null, 2));
    } catch (e) {
      console.error('❌ [TEST] Erro ao parsear body:', e);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Erro ao parsear JSON',
        details: e.message 
      }), { status: 400, headers });
    }

    // Tentar criar o cliente Base44
    const base44 = createClientFromRequest(req);
    console.log('✅ [TEST] Cliente Base44 criado com sucesso');

    // Tentar salvar um log de teste
    const testLog = await base44.asServiceRole.entities.WebhookLog.create({
      timestamp: new Date().toISOString(),
      provider: 'test',
      instance_id: 'test',
      event_type: 'test-inbound',
      raw_data: body,
      raw_headers: Object.fromEntries(req.headers.entries()),
      processed: true,
      success: true,
      result: { message: 'Teste de diagnóstico' }
    });

    console.log('✅ [TEST] Log salvo com sucesso:', testLog.id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Teste executado com sucesso',
      log_id: testLog.id,
      timestamp: new Date().toISOString()
    }, null, 2), { status: 200, headers });

  } catch (error) {
    console.error('❌ [TEST] Erro geral:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }, null, 2), { status: 500, headers });
  }
});