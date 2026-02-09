import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Registra o webhook da W-API de forma rápida e cirúrgica
 * Use: Chame esta função passando integration_id para configurar automaticamente
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { integration_id } = await req.json();

    if (!integration_id) {
      return Response.json({ error: 'integration_id obrigatório' }, { status: 400 });
    }

    // Buscar integração
    const integracao = await base44.entities.WhatsAppIntegration.get(integration_id);

    if (!integracao) {
      return Response.json({ error: 'Integração não encontrada' }, { status: 404 });
    }

    if (integracao.api_provider !== 'w_api') {
      return Response.json({ 
        error: 'Esta função é apenas para W-API' 
      }, { status: 400 });
    }

    const instanceId = integracao.instance_id_provider;
    const token = integracao.api_key_provider;
    
    // ✅ SEMPRE usar URL de PRODUÇÃO fixa (não req.headers que pode ser preview)
    const webhookUrl = 'https://nexus360-pro.base44.app/api/apps/68a7d067890527304dbe8477/functions/webhookWapi';

    console.log(`[WAPI-REGISTER] 📝 Instance: ${instanceId}`);
    console.log(`[WAPI-REGISTER] 🔗 Webhook: ${webhookUrl}`);

    // Registrar webhook na W-API (endpoint simplificado)
    const url = `https://api.w-api.app/v1/instance/webhook?instanceId=${instanceId}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        webhook: webhookUrl
      })
    });

    const responseText = await response.text();
    console.log(`[WAPI-REGISTER] 📥 Resposta (${response.status}):`, responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

    if (!response.ok) {
      return Response.json({
        success: false,
        error: data.error || data.message || 'Erro ao registrar webhook',
        status_code: response.status,
        resposta_completa: data
      }, { status: response.status });
    }

    // Atualizar integração com webhook configurado
    await base44.entities.WhatsAppIntegration.update(integration_id, {
      webhook_url: webhookUrl,
      ultima_atividade: new Date().toISOString()
    });

    console.log('[WAPI-REGISTER] ✅ Webhook registrado com sucesso!');

    return Response.json({
      success: true,
      message: 'Webhook W-API registrado com sucesso!',
      webhook_url: webhookUrl,
      resposta_wapi: data
    });

  } catch (error) {
    console.error('[WAPI-REGISTER] ❌ Erro:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});