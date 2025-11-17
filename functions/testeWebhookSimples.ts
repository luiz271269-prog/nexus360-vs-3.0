import { createClient } from 'npm:@base44/sdk@0.7.1';

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  TESTE WEBHOOK SIMPLES - Apenas registra tudo que receber   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

Deno.serve(async (req) => {
  console.log('🔔 WEBHOOK TESTE RECEBIDO!');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  try {
    const base44 = createClient({
      appId: Deno.env.get('BASE44_APP_ID'),
      apiKey: Deno.env.get('BASE44_SERVICE_ROLE_KEY')
    });

    let body = null;
    try {
      body = await req.json();
    } catch (e) {
      body = { error: 'Não é JSON' };
    }

    console.log('Body recebido:', JSON.stringify(body, null, 2));

    // Salvar no log
    await base44.entities.WebhookLog.create({
      timestamp: new Date().toISOString(),
      provider: 'teste_simples',
      instance_id: 'teste',
      event_type: 'teste',
      raw_data: body,
      processed: true,
      success: true
    });

    console.log('✅ Log salvo com sucesso!');

    return Response.json({ 
      success: true, 
      message: 'Webhook recebido!',
      timestamp: new Date().toISOString(),
      body_received: body
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    });
  }
});