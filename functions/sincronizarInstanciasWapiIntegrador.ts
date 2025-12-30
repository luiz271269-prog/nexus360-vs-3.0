import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Sincroniza Instâncias W-API Integrador com WhatsAppIntegration
 * 
 * Lista todas as instâncias do token de integrador e cria/atualiza
 * registros em WhatsAppIntegration para cada uma.
 * 
 * Uso: Executar manualmente ou via cron para manter sincronizado
 */

const WAPI_INTEGRATOR_BASE_URL = 'https://api.w-api.app/v1/integrator';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized: admin access required' }, { status: 403 });
    }

    console.log('[SYNC] Iniciando sincronização de instâncias W-API Integrador...');

    const integratorToken = Deno.env.get('WAPI_INTEGRATOR_TOKEN');
    if (!integratorToken) {
      return Response.json({ 
        error: 'WAPI_INTEGRATOR_TOKEN não configurado. Configure o secret no painel.' 
      }, { status: 500 });
    }

    // Listar todas as instâncias do integrador
    const response = await fetch(`${WAPI_INTEGRATOR_BASE_URL}/instances?pageSize=100&page=1`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${integratorToken}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      return Response.json({ 
        error: 'Erro ao listar instâncias do integrador',
        details: errorData 
      }, { status: response.status });
    }

    const data = await response.json();
    const instancias = data.data || [];

    console.log(`[SYNC] Encontradas ${instancias.length} instâncias no integrador`);

    const resultados = {
      total: instancias.length,
      criadas: 0,
      atualizadas: 0,
      erros: 0,
      detalhes: []
    };

    // ✅ CRÍTICO: Obter URL base do app para webhooks (produção vs preview)
    const appUrl = Deno.env.get('BASE44_APP_URL') || req.headers.get('origin') || 'https://app.base44.com';
    const webhookUrl = `${appUrl}/api/functions/webhookWapi`;
    
    console.log('[SYNC] 🌐 Webhook URL que será usado:', webhookUrl);

    // Processar cada instância
    for (const inst of instancias) {
      try {
        console.log(`[SYNC] Processando: ${inst.instanceName} (${inst.instanceId})`);

        // Verificar se já existe
        const existentes = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
          instance_id_provider: inst.instanceId,
          api_provider: 'w_api'
        });

        const dadosIntegracao = {
          nome_instancia: inst.instanceName,
          numero_telefone: inst.connectedPhone || '',
          status: inst.connected ? 'conectado' : 'desconectado',
          tipo_conexao: 'webhook',
          api_provider: 'w_api',
          modo: 'integrator',
          instance_id_provider: inst.instanceId,
          api_key_provider: inst.token,
          base_url_provider: 'https://api.w-api.app/v1',
          webhook_url: webhookUrl,
          token_status: inst.connected ? 'valido' : 'nao_verificado',
          token_ultima_verificacao: new Date().toISOString(),
          ultima_atividade: new Date().toISOString(),
          configuracoes_avancadas: {
            auto_resposta_fora_horario: false,
            rate_limit_mensagens_hora: 100
          },
          estatisticas: {
            total_mensagens_enviadas: inst.messagesSent || 0,
            total_mensagens_recebidas: inst.messagesReceived || 0,
            taxa_resposta_24h: 0,
            tempo_medio_resposta_minutos: 0
          }
        };

        if (existentes.length > 0) {
          // Atualizar existente
          await base44.asServiceRole.entities.WhatsAppIntegration.update(
            existentes[0].id,
            dadosIntegracao
          );
          resultados.atualizadas++;
          resultados.detalhes.push({
            instancia: inst.instanceName,
            instanceId: inst.instanceId,
            acao: 'atualizada',
            status: inst.connected ? 'conectado' : 'desconectado'
          });
          console.log(`[SYNC] ✅ Atualizada: ${inst.instanceName}`);
        } else {
          // Criar nova
          await base44.asServiceRole.entities.WhatsAppIntegration.create(dadosIntegracao);
          resultados.criadas++;
          resultados.detalhes.push({
            instancia: inst.instanceName,
            instanceId: inst.instanceId,
            acao: 'criada',
            status: inst.connected ? 'conectado' : 'desconectado'
          });
          console.log(`[SYNC] ✅ Criada: ${inst.instanceName}`);
        }

      } catch (error) {
        console.error(`[SYNC] ❌ Erro ao processar ${inst.instanceName}:`, error);
        resultados.erros++;
        resultados.detalhes.push({
          instancia: inst.instanceName,
          instanceId: inst.instanceId,
          acao: 'erro',
          mensagem: error.message
        });
      }
    }

    console.log('[SYNC] Sincronização concluída:', resultados);

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      resultados
    });

  } catch (error) {
    console.error('[SYNC] Erro fatal:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});