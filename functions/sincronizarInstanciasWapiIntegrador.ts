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

        // ✅ BUSCA ROBUSTA: Tentar por instanceId primeiro, fallback por nome
        let existentes = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
          instance_id_provider: inst.instanceId,
          api_provider: 'w_api'
        });
        
        console.log(`[SYNC] 🔍 Busca por instanceId (${inst.instanceId}): ${existentes.length} encontrada(s)`);
        
        // ✅ FALLBACK: Se não encontrou, buscar por nome (caso tenha sido criada manualmente)
        if (existentes.length === 0) {
          const porNome = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
            nome_instancia: inst.instanceName,
            api_provider: 'w_api'
          });
          
          console.log(`[SYNC] 🔍 Fallback busca por nome (${inst.instanceName}): ${porNome.length} encontrada(s)`);
          
          if (porNome.length > 0) {
            existentes = porNome;
            console.log(`[SYNC] ⚠️ Encontrada instância manual - será migrada para modo integrator`);
          }
        }
        
        // ✅ PREVENIR DUPLICATAS: Se encontrou múltiplas, usar a primeira e marcar as outras
        if (existentes.length > 1) {
          console.log(`[SYNC] ⚠️ DUPLICATAS DETECTADAS: ${existentes.length} instâncias com mesmo ID/nome`);
          // Manter a primeira (mais antiga), marcar as outras como duplicadas
          for (let i = 1; i < existentes.length; i++) {
            try {
              await base44.asServiceRole.entities.WhatsAppIntegration.update(existentes[i].id, {
                nome_instancia: `[DUPLICATA] ${existentes[i].nome_instancia}`,
                status: 'desconectado'
              });
              console.log(`[SYNC] ⚠️ Marcada como duplicata: ${existentes[i].id}`);
            } catch (err) {
              console.error(`[SYNC] Erro ao marcar duplicata:`, err);
            }
          }
          existentes = [existentes[0]]; // Usar apenas a primeira
        }

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
          // ✅ ATUALIZAR EXISTENTE
          console.log(`[SYNC] 🔄 Atualizando instância existente ID: ${existentes[0].id}`);
          console.log(`[SYNC] 📝 Dados anteriores:`, {
            nome: existentes[0].nome_instancia,
            instanceId: existentes[0].instance_id_provider,
            token: existentes[0].api_key_provider?.substring(0, 10) + '...',
            status: existentes[0].status
          });
          
          await base44.asServiceRole.entities.WhatsAppIntegration.update(
            existentes[0].id,
            dadosIntegracao
          );
          
          resultados.atualizadas++;
          resultados.detalhes.push({
            id_integration: existentes[0].id,
            instancia: inst.instanceName,
            instanceId: inst.instanceId,
            acao: 'atualizada',
            status: inst.connected ? 'conectado' : 'desconectado'
          });
          console.log(`[SYNC] ✅ ATUALIZADA: ${inst.instanceName} (ID: ${existentes[0].id})`);
        } else {
          // ✅ CRIAR NOVA INSTÂNCIA
          console.log(`[SYNC] ➕ Criando NOVA instância: ${inst.instanceName}`);
          console.log(`[SYNC] 📝 Dados:`, {
            instanceId: inst.instanceId,
            nome: inst.instanceName,
            token: inst.token?.substring(0, 10) + '...'
          });
          
          const novaIntegracao = await base44.asServiceRole.entities.WhatsAppIntegration.create(dadosIntegracao);
          
          resultados.criadas++;
          resultados.detalhes.push({
            id_integration: novaIntegracao.id,
            instancia: inst.instanceName,
            instanceId: inst.instanceId,
            acao: 'criada',
            status: inst.connected ? 'conectado' : 'desconectado'
          });
          console.log(`[SYNC] ✅ CRIADA: ${inst.instanceName} (ID: ${novaIntegracao.id})`);
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