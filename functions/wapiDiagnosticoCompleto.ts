import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ============================================================================
// W-API - DIAGNÓSTICO COMPLETO + AUTO-REGISTRO DE WEBHOOKS
// ============================================================================

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ 
        success: false, 
        error: 'Acesso negado - apenas administradores' 
      }, { status: 403 });
    }

    const { integration_id } = await req.json();

    if (!integration_id) {
      return Response.json({ 
        success: false, 
        error: 'integration_id é obrigatório' 
      }, { status: 400 });
    }

    const integration = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);

    if (!integration || integration.api_provider !== 'w_api') {
      return Response.json({ 
        success: false, 
        error: 'Integração W-API não encontrada' 
      }, { status: 404 });
    }

    console.log('[WAPI-DIAG] 🔍 Diagnosticando:', integration.nome_instancia);

    const webhookUrl = `https://nexus360-pro.base44.app/api/apps/68a7d067890527304dbe8477/functions/webhookWapi`;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${integration.api_key_provider}`
    };

    const baseUrl = integration.base_url_provider || 'https://api.w-api.app/v1';

    const resultado = {
      integration_id: integration.id,
      nome: integration.nome_instancia,
      instance_id: integration.instance_id_provider,
      testes: {},
      acoes_tomadas: []
    };

    // TESTE 1: Status da instância
    console.log('[WAPI-DIAG] 1️⃣ Verificando status da instância...');
    try {
      const statusReq = await fetch(`${baseUrl}/instances/${integration.instance_id_provider}/status`, {
        method: 'GET',
        headers
      });
      const statusRes = await statusReq.json();
      
      resultado.testes.status_instancia = {
        sucesso: statusReq.ok,
        status_http: statusReq.status,
        conectada: statusRes?.status === 'connected' || statusRes?.connected === true,
        dados: statusRes
      };
      console.log('[WAPI-DIAG] ✅ Status:', statusRes?.status || statusRes?.connected);
    } catch (e) {
      resultado.testes.status_instancia = {
        sucesso: false,
        erro: e.message
      };
    }

    // TESTE 2: Listar webhooks atuais
    console.log('[WAPI-DIAG] 2️⃣ Listando webhooks configurados...');
    let webhooksAtuais = [];
    try {
      const webhooksReq = await fetch(`${baseUrl}/instances/${integration.instance_id_provider}/webhooks`, {
        method: 'GET',
        headers
      });
      const webhooksRes = await webhooksReq.json();
      
      webhooksAtuais = webhooksRes?.webhooks || [];
      
      resultado.testes.listar_webhooks = {
        sucesso: webhooksReq.ok,
        status_http: webhooksReq.status,
        total: webhooksAtuais.length,
        webhooks: webhooksAtuais
      };
      console.log('[WAPI-DIAG] 📋 Total de webhooks:', webhooksAtuais.length);
    } catch (e) {
      resultado.testes.listar_webhooks = {
        sucesso: false,
        erro: e.message
      };
    }

    // TESTE 3: Verificar se nosso webhook está configurado
    const nossoWebhook = webhooksAtuais.find(w => 
      w.url === webhookUrl || w.url?.includes('webhookWapi')
    );

    resultado.testes.webhook_configurado = {
      encontrado: !!nossoWebhook,
      webhook_esperado: webhookUrl,
      webhook_atual: nossoWebhook || null
    };

    // AÇÃO CORRETIVA: Registrar webhooks se não existirem
    if (!nossoWebhook) {
      console.log('[WAPI-DIAG] ⚠️ Webhook não encontrado! Registrando automaticamente...');
      
      const eventosObrigatorios = [
        'RECEIVED_MESSAGE',
        'SENT_MESSAGE', 
        'DISCONNECTED'
      ];

      const resultadosRegistro = [];

      for (const evento of eventosObrigatorios) {
        try {
          const registerReq = await fetch(`${baseUrl}/instances/${integration.instance_id_provider}/webhooks`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              event: evento,
              url: webhookUrl
            })
          });
          
          const registerRes = await registerReq.json();
          
          resultadosRegistro.push({
            evento,
            sucesso: registerReq.ok,
            status_http: registerReq.status,
            resposta: registerRes
          });

          console.log(`[WAPI-DIAG] ${registerReq.ok ? '✅' : '❌'} Registrado: ${evento}`);
        } catch (e) {
          resultadosRegistro.push({
            evento,
            sucesso: false,
            erro: e.message
          });
          console.error(`[WAPI-DIAG] ❌ Erro ao registrar ${evento}:`, e.message);
        }
      }

      resultado.acoes_tomadas.push({
        acao: 'registro_webhooks',
        motivo: 'Webhook não encontrado nos webhooks ativos',
        resultados: resultadosRegistro,
        todos_sucesso: resultadosRegistro.every(r => r.sucesso)
      });

      // Atualizar integração
      if (resultadosRegistro.every(r => r.sucesso)) {
        await base44.asServiceRole.entities.WhatsAppIntegration.update(integration.id, {
          webhook_url: webhookUrl,
          token_status: 'valido',
          ultima_atividade: new Date().toISOString()
        });
        resultado.acoes_tomadas.push({
          acao: 'atualizar_integracao',
          webhook_url_salvo: webhookUrl
        });
      }
    } else {
      console.log('[WAPI-DIAG] ✅ Webhook já configurado corretamente!');
      resultado.acoes_tomadas.push({
        acao: 'nenhuma',
        motivo: 'Webhook já está configurado'
      });
    }

    // TESTE 4: Enviar mensagem de teste (opcional, mas útil)
    console.log('[WAPI-DIAG] 4️⃣ Testando envio de mensagem...');
    try {
      const testeReq = await fetch(`${baseUrl}/messages/send/text`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          instanceId: integration.instance_id_provider,
          number: '554899142800', // Campanhas-2800
          text: '🔧 Teste de diagnóstico W-API - ' + new Date().toLocaleTimeString()
        })
      });
      
      const testeRes = await testeReq.json();
      
      resultado.testes.envio_teste = {
        sucesso: testeReq.ok,
        status_http: testeReq.status,
        resposta: testeRes
      };
      console.log('[WAPI-DIAG] ✅ Teste de envio:', testeReq.ok ? 'OK' : 'FALHOU');
    } catch (e) {
      resultado.testes.envio_teste = {
        sucesso: false,
        erro: e.message
      };
    }

    // Resumo final
    resultado.resumo = {
      instancia_conectada: resultado.testes.status_instancia?.conectada || false,
      webhook_configurado: !!nossoWebhook || resultado.acoes_tomadas.some(a => a.acao === 'registro_webhooks' && a.todos_sucesso),
      pronto_para_receber: resultado.testes.status_instancia?.conectada && 
                          (!!nossoWebhook || resultado.acoes_tomadas.some(a => a.acao === 'registro_webhooks' && a.todos_sucesso))
    };

    resultado.proximos_passos = resultado.resumo.pronto_para_receber ?
      '✅ Tudo configurado! Envie uma mensagem para o número conectado e verifique se aparece na Central de Comunicação.' :
      '⚠️ ' + (!resultado.resumo.instancia_conectada ? 'Instância desconectada. Escaneie o QR Code.' : 'Webhooks não puderam ser registrados. Verifique as credenciais da W-API.');

    return Response.json({
      success: true,
      ...resultado
    });

  } catch (error) {
    console.error('[WAPI-DIAG] ❌ Erro fatal:', error.message);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});