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
    console.log(`[WAPI-WEBHOOK] 🔍 Integração modo: ${integration.modo || 'manual'}`);
    console.log(`[WAPI-WEBHOOK] 🔍 API Provider: ${integration.api_provider}`);
    
    const baseUrl = integration.base_url_provider || 'https://api.w-api.app/v1';
    const instanceId = integration.instance_id_provider;

    console.log(`[WAPI-WEBHOOK] 🔧 Registrando webhooks para: ${instanceId}`);
    console.log(`[WAPI-WEBHOOK] 🔗 URL: ${webhookUrl}`);

    // ✅ USAR INTEGRATOR TOKEN para modo integrador, token individual caso contrário
    const INTEGRATOR_TOKEN = Deno.env.get('WAPI_INTEGRATOR_TOKEN');
    const usarIntegrator = integration.modo === 'integrator' && INTEGRATOR_TOKEN;

    console.log(`[WAPI-WEBHOOK] 🔑 INTEGRATOR_TOKEN presente: ${!!INTEGRATOR_TOKEN}`);
    console.log(`[WAPI-WEBHOOK] 🎯 Usar Integrador: ${usarIntegrator}`);

    let headers;
    let endpoint;
    let body;

    if (usarIntegrator) {
      // Modo Integrador: um único PUT com todos os webhooks
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INTEGRATOR_TOKEN}`
      };
      endpoint = `${baseUrl}/integrator/instance/webhooks`;
      body = {
        instanceId,
        webhookReceivedUrl: webhookUrl,
        webhookDeliveryUrl: webhookUrl,
        webhookDisconnectedUrl: webhookUrl,
        webhookStatusUrl: webhookUrl,
        webhookPresenceUrl: webhookUrl,
        webhookConnectedUrl: webhookUrl
      };
      console.log('[WAPI-WEBHOOK] 🔧 Modo INTEGRADOR detectado');
      console.log(`[WAPI-WEBHOOK] 🎯 Endpoint: ${endpoint}`);
    } else {
      // Modo Manual: endpoints individuais (deprecated, mas mantido como fallback)
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${integration.api_key_provider}`
      };
      console.log('[WAPI-WEBHOOK] 🔧 Modo MANUAL detectado');
    }

    try {
      if (usarIntegrator) {
        // UPDATE via Integrador: um único PUT com todos os webhooks
        console.log(`[WAPI-WEBHOOK] 📤 PUT ${endpoint}`);
        console.log(`[WAPI-WEBHOOK] 📋 Body:`, JSON.stringify(body, null, 2));

        const response = await fetch(endpoint, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[WAPI-WEBHOOK] ❌ HTTP ${response.status}:`, errorText);
          return Response.json({
            success: false,
            error: `HTTP ${response.status}: ${errorText}`,
            modo: 'integrator'
          }, { status: response.status, headers: corsHeaders });
        }

        const data = await response.json();
        console.log(`[WAPI-WEBHOOK] 📥 Status HTTP: ${response.status}`);
        console.log(`[WAPI-WEBHOOK] 📥 Resposta:`, JSON.stringify(data, null, 2));

        if (data.error === false || data.success === true || response.ok) {
          console.log('[WAPI-WEBHOOK] ✅ Webhooks registrados com sucesso no provedor');
          
          // Verificar após 2 segundos se foi aplicado
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          try {
            const verifyResponse = await fetch(`${baseUrl}/integrator/instance?instanceId=${instanceId}`, {
              headers: { 'Authorization': `Bearer ${INTEGRATOR_TOKEN}` }
            });
            const verifyData = await verifyResponse.json();
            
            console.log('[WAPI-WEBHOOK] 🔍 Verificação pós-registro:', JSON.stringify(verifyData, null, 2));
            
            const webhooksAplicados = 
              verifyData.webhookReceivedUrl === webhookUrl &&
              verifyData.webhookDeliveryUrl === webhookUrl &&
              verifyData.webhookDisconnectedUrl === webhookUrl;
            
            return Response.json({
              success: true,
              message: webhooksAplicados ? 
                '✅ Webhooks configurados e verificados!' : 
                '⚠️ Webhooks configurados, mas verificação indica divergência',
              webhook_url: webhookUrl,
              webhooks_aplicados: webhooksAplicados,
              verificacao: verifyData,
              modo: 'integrator'
            }, { headers: corsHeaders });
          } catch (verifyError) {
            console.warn('[WAPI-WEBHOOK] ⚠️ Não foi possível verificar:', verifyError.message);
            return Response.json({
              success: true,
              message: 'Webhooks configurados (verificação não disponível)',
              webhook_url: webhookUrl,
              modo: 'integrator'
            }, { headers: corsHeaders });
          }
        } else {
          console.error('[WAPI-WEBHOOK] ❌ Falha ao registrar webhooks:', data.message || data.error);
          return Response.json({
            success: false,
            error: data.message || data.error || 'Erro ao configurar webhooks via Integrador',
            detalhes: data,
            modo: 'integrator'
          }, { status: 400, headers: corsHeaders });
        }
      } else {
        // Modo manual: múltiplas chamadas POST (fallback)
        const webhookEndpoints = [
          { tipo: 'Recebimento', url: `${baseUrl}/instance/webhook-received`, body: { instanceId, url: webhookUrl, enabled: true } },
          { tipo: 'Entrega/Lida', url: `${baseUrl}/instance/webhook-delivery`, body: { instanceId, url: webhookUrl, enabled: true } },
          { tipo: 'Status/Conexão', url: `${baseUrl}/instance/webhook-status`, body: { instanceId, url: webhookUrl, enabled: true } }
        ];

        const resultados = [];
        const erros = [];

        for (const ep of webhookEndpoints) {
          try {
            console.log(`[WAPI-WEBHOOK] Configurando: ${ep.tipo}`);
            const response = await fetch(ep.url, { method: 'POST', headers, body: JSON.stringify(ep.body) });
            const data = await response.json();

            if (data.error === false || response.ok) {
              resultados.push({ tipo: ep.tipo, status: 'ok' });
              console.log(`[WAPI-WEBHOOK] ✅ ${ep.tipo} configurado`);
            } else {
              erros.push({ tipo: ep.tipo, erro: data.message || 'Erro desconhecido' });
              console.error(`[WAPI-WEBHOOK] ❌ ${ep.tipo}:`, data.message);
            }
          } catch (error) {
            erros.push({ tipo: ep.tipo, erro: error.message });
            console.error(`[WAPI-WEBHOOK] ❌ ${ep.tipo}:`, error.message);
          }
        }

        const webhookMensagemOk = resultados.some(r => r.tipo === 'Recebimento');

        if (webhookMensagemOk) {
          return Response.json({
            success: true,
            message: erros.length === 0 ? 'Todos os webhooks configurados!' : 'Webhooks parcialmente configurados',
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
      }
    } catch (error) {
      console.error('[WAPI-WEBHOOK] ❌ Erro na requisição:', error);
      return Response.json({
        success: false,
        error: error.message,
        stack: error.stack
      }, { status: 500, headers: corsHeaders });
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