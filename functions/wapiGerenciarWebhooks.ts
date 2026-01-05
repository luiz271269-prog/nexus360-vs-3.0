import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Gerenciador Unificado de Webhooks W-API
 * - Registrar/atualizar webhooks
 * - Listar webhooks ativos
 * - Deletar webhooks específicos
 * 
 * Baseado na documentação oficial:
 * https://www.postman.com/w-api/w-api-api-do-whatsapp/documentation/
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, integration_id } = await req.json();

    if (!integration_id) {
      return Response.json({ error: 'integration_id é obrigatório' }, { status: 400 });
    }

    // Buscar integração
    const integracoes = await base44.entities.WhatsAppIntegration.filter({ id: integration_id });
    if (!integracoes || integracoes.length === 0) {
      return Response.json({ error: 'Integração não encontrada' }, { status: 404 });
    }

    const integracao = integracoes[0];

    // Validar que é W-API
    if (integracao.api_provider !== 'w_api') {
      return Response.json({ 
        error: 'Esta função é apenas para W-API' 
      }, { status: 400 });
    }

    const instanceId = integracao.instance_id_provider;
    const token = integracao.api_key_provider;
    const webhookUrl = integracao.webhook_url;

    if (!instanceId || !token) {
      return Response.json({ 
        error: 'Integração incompleta. Verifique Instance ID e Token.' 
      }, { status: 400 });
    }

    console.log(`[WAPI-WEBHOOKS] 🔧 Ação: ${action} | Instância: ${instanceId}`);

    // ========================================================================
    // AÇÃO: LISTAR WEBHOOKS ATIVOS
    // ========================================================================
    if (action === 'list') {
      try {
        const url = `https://api.w-api.app/v1/instance/webhook?instanceId=${instanceId}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const data = await response.json();
        console.log('[WAPI-WEBHOOKS] 📋 Webhooks ativos:', JSON.stringify(data, null, 2));

        return Response.json({
          success: true,
          webhooks: data
        });
      } catch (error) {
        console.error('[WAPI-WEBHOOKS] ❌ Erro ao listar:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    // ========================================================================
    // AÇÃO: REGISTRAR/ATUALIZAR WEBHOOKS
    // ========================================================================
    if (action === 'register') {
      if (!webhookUrl) {
        return Response.json({ 
          error: 'webhook_url não configurado na integração' 
        }, { status: 400 });
      }

      console.log(`[WAPI-WEBHOOKS] 🔗 Registrando: ${webhookUrl}`);

      // Webhooks essenciais para funcionamento
      const eventos = [
        { name: 'RECEIVED_MESSAGE', description: 'Mensagens recebidas' },
        { name: 'SENT_MESSAGE', description: 'Mensagens enviadas' },
        { name: 'DISCONNECTED', description: 'Desconexão' }
      ];

      const resultados = [];

      for (const evento of eventos) {
        try {
          const url = `https://api.w-api.app/v1/instance/webhook?instanceId=${instanceId}`;
          
          const body = {
            event: evento.name,
            url: webhookUrl,
            enabled: true
          };
          
          console.log(`[WAPI-WEBHOOKS] 📤 ${evento.name}:`, JSON.stringify(body));
          
          const response = await fetch(url, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
          });

          const responseText = await response.text();
          console.log(`[WAPI-WEBHOOKS] 📥 Resposta ${evento.name} (${response.status}):`, responseText);
          
          let data;
          try {
            data = JSON.parse(responseText);
          } catch {
            data = { raw: responseText };
          }

          if (response.ok || response.status === 200) {
            console.log(`[WAPI-WEBHOOKS] ✅ ${evento.description} OK`);
            resultados.push({
              evento: evento.name,
              descricao: evento.description,
              sucesso: true,
              resposta: data
            });
          } else {
            console.error(`[WAPI-WEBHOOKS] ❌ ${evento.description} FALHOU:`, data);
            resultados.push({
              evento: evento.name,
              descricao: evento.description,
              sucesso: false,
              erro: data.error || data.message || data.raw || 'Erro desconhecido',
              status_code: response.status
            });
          }
        } catch (error) {
          console.error(`[WAPI-WEBHOOKS] ❌ Exceção ${evento.description}:`, error);
          resultados.push({
            evento: evento.name,
            descricao: evento.description,
            sucesso: false,
            erro: error.message
          });
        }
      }

      const todosOk = resultados.every(r => r.sucesso);
      
      if (todosOk) {
        await base44.entities.WhatsAppIntegration.update(integration_id, {
          ultima_atividade: new Date().toISOString()
        });
      }

      return Response.json({
        success: todosOk,
        message: todosOk 
          ? '✅ Todos os webhooks registrados com sucesso!' 
          : '⚠️ Alguns webhooks falharam',
        resultados
      });
    }

    // ========================================================================
    // AÇÃO: DELETAR WEBHOOK ESPECÍFICO
    // ========================================================================
    if (action === 'delete') {
      const { event_name } = await req.json();
      
      if (!event_name) {
        return Response.json({ error: 'event_name é obrigatório para deletar' }, { status: 400 });
      }

      try {
        const url = `https://api.w-api.app/v1/instance/webhook?instanceId=${instanceId}`;
        
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            event: event_name
          })
        });

        const data = await response.json();

        return Response.json({
          success: response.ok,
          message: response.ok ? `Webhook ${event_name} deletado` : 'Erro ao deletar',
          data
        });
      } catch (error) {
        console.error('[WAPI-WEBHOOKS] ❌ Erro ao deletar:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    return Response.json({ error: 'Ação inválida. Use: list, register ou delete' }, { status: 400 });

  } catch (error) {
    console.error('[WAPI-WEBHOOKS] ❌ Erro geral:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});