import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * W-API Integrator Manager
 * Gerencia instâncias W-API através da API de integrador (plano customizado)
 * 
 * Endpoints da W-API Integrator:
 * - POST /v1/integrator/create-instance
 * - GET /v1/integrator/instances
 * - DELETE /v1/integrator/delete-instance
 */

const WAPI_INTEGRATOR_BASE_URL = 'https://api.w-api.app/v1/integrator';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, ...params } = await req.json();

    const integratorToken = Deno.env.get('WAPI_INTEGRATOR_TOKEN');
    if (!integratorToken) {
      return Response.json({ 
        error: 'WAPI_INTEGRATOR_TOKEN não configurado. Configure o secret no painel.' 
      }, { status: 500 });
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${integratorToken}`
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // ACTION: createInstance - Cria nova instância W-API via integrador
    // ═══════════════════════════════════════════════════════════════════════════════
    if (action === 'createInstance') {
      const { instanceName, rejectCalls = true, callMessage = "Não estamos disponíveis no momento." } = params;

      if (!instanceName) {
        return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });
      }

      // Obter URL base do app para configurar webhooks
      const appUrl = Deno.env.get('BASE44_APP_URL') || 'https://app.base44.com';
      const webhookUrl = `${appUrl}/api/functions/webhookWapi`;

      // Criar instância na W-API
      const response = await fetch(`${WAPI_INTEGRATOR_BASE_URL}/create-instance`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          instanceName,
          rejectCalls,
          callMessage,
          webhookConnectedUrl: webhookUrl,
          webhookDeliveryUrl: webhookUrl,
          webhookDisconnectedUrl: webhookUrl,
          webhookStatusUrl: webhookUrl,
          webhookPresenceUrl: webhookUrl,
          webhookReceivedUrl: webhookUrl
        })
      });

      const data = await response.json();

      if (data.error || !response.ok) {
        return Response.json({ 
          error: data.message || 'Erro ao criar instância na W-API',
          details: data 
        }, { status: response.status });
      }

      // Retornar dados da instância criada
      return Response.json({
        success: true,
        instanceId: data.instanceId,
        token: data.token,
        message: data.message,
        webhookUrl
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // ACTION: listInstances - Lista todas as instâncias do integrador
    // ═══════════════════════════════════════════════════════════════════════════════
    if (action === 'listInstances') {
      const { pageSize = 10, page = 1 } = params;

      const response = await fetch(`${WAPI_INTEGRATOR_BASE_URL}/instances?pageSize=${pageSize}&page=${page}`, {
        method: 'GET',
        headers
      });

      const data = await response.json();

      if (data.error || !response.ok) {
        return Response.json({ 
          error: data.message || 'Erro ao listar instâncias',
          details: data 
        }, { status: response.status });
      }

      return Response.json({
        success: true,
        instances: data.data || [],
        total: data.total,
        totalPage: data.totalPage,
        page: data.page,
        pageSize: data.pageSize
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // ACTION: deleteInstance - Deleta instância na W-API
    // ═══════════════════════════════════════════════════════════════════════════════
    if (action === 'deleteInstance') {
      const { instanceId } = params;

      if (!instanceId) {
        return Response.json({ error: 'instanceId é obrigatório' }, { status: 400 });
      }

      const response = await fetch(`${WAPI_INTEGRATOR_BASE_URL}/delete-instance?instanceId=${instanceId}`, {
        method: 'DELETE',
        headers
      });

      const data = await response.json();

      if (data.error || !response.ok) {
        return Response.json({ 
          error: data.message || 'Erro ao deletar instância',
          details: data 
        }, { status: response.status });
      }

      return Response.json({
        success: true,
        message: 'Instância deletada com sucesso'
      });
    }

    return Response.json({ error: 'Ação inválida. Use: createInstance, listInstances ou deleteInstance' }, { status: 400 });

  } catch (error) {
    console.error('[wapiIntegratorManager] Erro:', error);
    return Response.json({ 
      error: error.message || 'Erro interno no servidor',
      stack: error.stack
    }, { status: 500 });
  }
});