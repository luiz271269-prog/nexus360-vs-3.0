import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Gerenciador de Instâncias W-API Integrador
 * - Criar instâncias (já com webhooks configurados)
 * - Listar instâncias
 * - Deletar instâncias
 * 
 * Baseado na documentação oficial W-API Integrador
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas admins podem gerenciar instâncias' }, { status: 403 });
    }

    const payload = await req.json();
    const { action } = payload;

    const INTEGRATOR_TOKEN = Deno.env.get('WAPI_INTEGRATOR_TOKEN');
    if (!INTEGRATOR_TOKEN) {
      return Response.json({ 
        error: 'WAPI_INTEGRATOR_TOKEN não configurado' 
      }, { status: 500 });
    }

    // ✅ BUSCAR URL DO BANCO: Para integrações existentes, usar a URL cadastrada
    // Para novas, usar a URL padrão do ambiente
    const DEFAULT_WEBHOOK_URL = 'https://nexus360-pro.base44.app/api/apps/68a7d067890527304dbe8477/functions/webhookWapi';

    // ========================================================================
    // AÇÃO: CRIAR INSTÂNCIA
    // ========================================================================
    if (action === 'createInstance') {
      const { instanceName } = payload;

      if (!instanceName) {
        return Response.json({ error: 'instanceName é obrigatório' }, { status: 400 });
      }

      console.log('[WAPI-INTEGRATOR] 🚀 Criando instância:', instanceName);

      try {
        const response = await fetch('https://api.w-api.app/v1/integrator/create-instance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${INTEGRATOR_TOKEN}`
          },
          body: JSON.stringify({
            instanceName,
            rejectCalls: true,
            callMessage: "Não estamos disponíveis para chamadas no momento.",
            // ✅ CONFIGURAR WEBHOOKS NA CRIAÇÃO (evita passo extra)
            webhookReceivedUrl: DEFAULT_WEBHOOK_URL,
            webhookDeliveryUrl: DEFAULT_WEBHOOK_URL,
            webhookDisconnectedUrl: DEFAULT_WEBHOOK_URL
          })
        });

        const data = await response.json();

        if (data.error === false && data.instanceId && data.token) {
          console.log('[WAPI-INTEGRATOR] ✅ Instância criada:', data.instanceId);

          return Response.json({
            success: true,
            instanceId: data.instanceId,
            token: data.token,
            webhookUrl: DEFAULT_WEBHOOK_URL,
            message: 'Instância criada com webhooks já configurados!'
          });
        } else {
          console.error('[WAPI-INTEGRATOR] ❌ Erro na resposta:', data);
          return Response.json({
            success: false,
            error: data.message || 'Erro ao criar instância'
          }, { status: 400 });
        }
      } catch (error) {
        console.error('[WAPI-INTEGRATOR] ❌ Erro na requisição:', error);
        return Response.json({
          success: false,
          error: error.message
        }, { status: 500 });
      }
    }

    // ========================================================================
    // AÇÃO: LISTAR INSTÂNCIAS
    // ========================================================================
    if (action === 'listInstances') {
      const { pageSize = 50, page = 1 } = payload;

      try {
        const url = `https://api.w-api.app/v1/integrator/instances?pageSize=${pageSize}&page=${page}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${INTEGRATOR_TOKEN}`
          }
        });

        const data = await response.json();

        if (data.error === false) {
          return Response.json({
            success: true,
            instances: data.data || [],
            total: data.total || 0,
            page: data.page || 1,
            totalPages: data.totalPage || 1
          });
        } else {
          return Response.json({
            success: false,
            error: data.message || 'Erro ao listar instâncias'
          }, { status: 400 });
        }
      } catch (error) {
        console.error('[WAPI-INTEGRATOR] ❌ Erro ao listar:', error);
        return Response.json({
          success: false,
          error: error.message
        }, { status: 500 });
      }
    }

    // ========================================================================
    // AÇÃO: DELETAR INSTÂNCIA
    // ========================================================================
    if (action === 'deleteInstance') {
      const { instanceId } = payload;

      if (!instanceId) {
        return Response.json({ error: 'instanceId é obrigatório' }, { status: 400 });
      }

      try {
        const url = `https://api.w-api.app/v1/integrator/delete-instance?instanceId=${instanceId}`;
        
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${INTEGRATOR_TOKEN}`
          }
        });

        const data = await response.json();

        if (data.error === false) {
          console.log('[WAPI-INTEGRATOR] ✅ Instância deletada:', instanceId);
          return Response.json({
            success: true,
            message: 'Instância deletada com sucesso'
          });
        } else {
          return Response.json({
            success: false,
            error: data.message || 'Erro ao deletar instância'
          }, { status: 400 });
        }
      } catch (error) {
        console.error('[WAPI-INTEGRATOR] ❌ Erro ao deletar:', error);
        return Response.json({
          success: false,
          error: error.message
        }, { status: 500 });
      }
    }

    return Response.json({ error: 'Ação inválida. Use: createInstance, listInstances ou deleteInstance' }, { status: 400 });

  } catch (error) {
    console.error('[WAPI-INTEGRATOR] ❌ Erro geral:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});