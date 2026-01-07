import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ============================================================================
// W-API - REGISTRAR/ATUALIZAR WEBHOOKS (v2.0)
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ 
        success: false, 
        error: 'Acesso negado - apenas administradores' 
      }, { status: 403, headers: corsHeaders });
    }

    const { action, integration_id } = await req.json();

    if (!integration_id) {
      return Response.json({ 
        success: false, 
        error: 'integration_id é obrigatório' 
      }, { status: 400, headers: corsHeaders });
    }

    const integrations = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ id: integration_id });
    const integration = integrations[0];

    if (!integration || integration.api_provider !== 'w_api') {
      return Response.json({ 
        success: false, 
        error: 'Integração W-API não encontrada' 
      }, { status: 404, headers: corsHeaders });
    }

    // ✅ SEMPRE USAR URL DO BANCO (source of truth)
    const webhookUrl = integration.webhook_url;

    if (!webhookUrl) {
      return Response.json({ 
        success: false, 
        error: 'webhook_url não configurada no banco de dados para esta integração' 
      }, { status: 400, headers: corsHeaders });
    }

    console.log(`[WAPI-WEBHOOK] 📋 URL do banco (DB): ${webhookUrl}`);
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${integration.api_key_provider}`
    };

    const baseUrl = integration.base_url_provider || 'https://api.w-api.app/v1';
    const instanceId = integration.instance_id_provider;

    console.log(`[WAPI-WEBHOOK] 🔧 Registrando webhooks para: ${instanceId}`);
    console.log(`[WAPI-WEBHOOK] 🔗 URL: ${webhookUrl}`);

    // ✅ REGISTRAR OS 3 WEBHOOKS PRINCIPAIS NA W-API
    const webhookEndpoints = [
      { tipo: 'Recebimento', url: `${baseUrl}/instance/webhook-received`, body: { instanceId, url: webhookUrl, enabled: true } },
      { tipo: 'Entrega/Lida', url: `${baseUrl}/instance/webhook-delivery`, body: { instanceId, url: webhookUrl, enabled: true } },
      { tipo: 'Status/Conexão', url: `${baseUrl}/instance/webhook-status`, body: { instanceId, url: webhookUrl, enabled: true } }
    ];

    const resultados = [];
    const erros = [];

    for (const endpoint of webhookEndpoints) {
      try {
        console.log(`[WAPI-WEBHOOK] Configurando: ${endpoint.tipo}`);
        
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(endpoint.body)
        });

        const data = await response.json();

        if (data.error === false || response.ok) {
          resultados.push({ tipo: endpoint.tipo, status: 'ok' });
          console.log(`[WAPI-WEBHOOK] ✅ ${endpoint.tipo} configurado`);
        } else {
          const erro = data.message || 'Erro desconhecido';
          erros.push({ tipo: endpoint.tipo, erro });
          console.error(`[WAPI-WEBHOOK] ❌ ${endpoint.tipo}: ${erro}`);
        }
      } catch (error) {
        erros.push({ tipo: endpoint.tipo, erro: error.message });
        console.error(`[WAPI-WEBHOOK] ❌ ${endpoint.tipo}: ${error.message}`);
      }
    }

    // Sucesso se pelo menos o webhook de mensagem foi configurado
    const webhookMensagemOk = resultados.some(r => r.tipo === 'Recebimento');

    if (webhookMensagemOk) {
      return Response.json({
        success: true,
        message: erros.length === 0 ? 
          'Todos os webhooks configurados com sucesso!' : 
          'Webhooks parcialmente configurados (veja detalhes)',
        resultados,
        erros: erros.length > 0 ? erros : undefined,
        webhook_url: webhookUrl
      }, { headers: corsHeaders });
    } else {
      return Response.json({
        success: false,
        error: 'Não foi possível configurar o webhook de recebimento (crítico)',
        resultados,
        erros
      }, { status: 400, headers: corsHeaders });
    }

  } catch (error) {
    console.error('[WAPI-WEBHOOK] ❌ Erro fatal:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500, headers: corsHeaders });
  }
});