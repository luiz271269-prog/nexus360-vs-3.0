import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Registra webhooks na W-API para uma instância específica
 * Necessário para instâncias criadas via API Integrador
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
        error: 'Esta função é apenas para W-API. Use configuração manual para outros provedores.' 
      }, { status: 400 });
    }

    const instanceId = integracao.instance_id_provider;
    const token = integracao.api_key_provider;
    const webhookUrl = integracao.webhook_url;

    if (!instanceId || !token || !webhookUrl) {
      return Response.json({ 
        error: 'Integração incompleta. Verifique Instance ID, Token e Webhook URL.' 
      }, { status: 400 });
    }

    console.log(`[WAPI-REGISTER] 📝 Registrando webhooks para instância: ${instanceId}`);
    console.log(`[WAPI-REGISTER] 🔗 Webhook URL: ${webhookUrl}`);
    console.log(`[WAPI-REGISTER] 🔑 Token: ${token.substring(0, 10)}...`);

    // Registrar os 3 webhooks na W-API
    const eventos = [
      { name: 'RECEIVED_MESSAGE', description: 'Ao receber mensagem' },
      { name: 'SENT_MESSAGE', description: 'Ao enviar mensagem' },
      { name: 'DISCONNECTED', description: 'Ao desconectar' }
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
        
        console.log(`[WAPI-REGISTER] 📤 Enviando ${evento.name}:`, JSON.stringify(body));
        
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(body)
        });

        const responseText = await response.text();
        console.log(`[WAPI-REGISTER] 📥 Resposta ${evento.name} (status ${response.status}):`, responseText);
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch {
          data = { raw: responseText };
        }

        if (response.ok) {
          console.log(`[WAPI-REGISTER] ✅ ${evento.description} registrado com sucesso`);
          resultados.push({
            evento: evento.name,
            descricao: evento.description,
            sucesso: true,
            resposta: data
          });
        } else {
          console.error(`[WAPI-REGISTER] ❌ Erro ao registrar ${evento.description}:`, data);
          resultados.push({
            evento: evento.name,
            descricao: evento.description,
            sucesso: false,
            erro: data.error || data.message || data.raw || 'Erro desconhecido',
            status_code: response.status
          });
        }
      } catch (error) {
        console.error(`[WAPI-REGISTER] ❌ Exceção ao registrar ${evento.description}:`, error);
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
      // Atualizar status da integração
      await base44.entities.WhatsAppIntegration.update(integration_id, {
        ultima_atividade: new Date().toISOString()
      });
    }

    return Response.json({
      success: todosOk,
      message: todosOk 
        ? 'Todos os webhooks registrados com sucesso!' 
        : 'Alguns webhooks falharam. Verifique os detalhes.',
      resultados
    });

  } catch (error) {
    console.error('[WAPI-REGISTER] ❌ Erro:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});