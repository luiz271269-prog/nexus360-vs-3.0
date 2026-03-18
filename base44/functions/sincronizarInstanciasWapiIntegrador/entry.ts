import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Sincroniza instâncias do painel W-API Integrador com o banco de dados local
 * Importa automaticamente todas as instâncias criadas via painel
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas admins podem sincronizar' }, { status: 403 });
    }

    const INTEGRATOR_TOKEN = Deno.env.get('WAPI_INTEGRATOR_TOKEN');
    if (!INTEGRATOR_TOKEN) {
      return Response.json({ 
        error: 'WAPI_INTEGRATOR_TOKEN não configurado' 
      }, { status: 500 });
    }

    // ✅ URL CORRETA para W-API (SEMPRE usar webhookWapi, nunca webhookWatsZapi)
    const WEBHOOK_URL_WAPI = 'https://nexus360-pro.base44.app/api/apps/68a7d067890527304dbe8477/functions/webhookWapi';

    console.log('[SYNC] 🔄 Iniciando sincronização com W-API Integrador...');

    // Buscar todas as instâncias do painel W-API
    const response = await fetch('https://api.w-api.app/v1/integrator/instances?pageSize=100&page=1', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INTEGRATOR_TOKEN}`
      }
    });

    const data = await response.json();

    if (data.error !== false || !data.data) {
      return Response.json({
        success: false,
        error: 'Erro ao buscar instâncias da W-API'
      }, { status: 400 });
    }

    const instanciasWAPI = data.data;
    console.log(`[SYNC] 📊 Encontradas ${instanciasWAPI.length} instâncias no painel W-API`);

    // Buscar instâncias locais (modo integrator)
    const integracoesLocais = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
      modo: 'integrator'
    });

    const mapeamentoLocal = new Map(
      integracoesLocais.map(i => [i.instance_id_provider, i])
    );

    let criadas = 0;
    let atualizadas = 0;
    let erros = 0;

    for (const inst of instanciasWAPI) {
      try {
        const integracaoExistente = mapeamentoLocal.get(inst.instanceId);

        // ✅ SEMPRE USAR webhookWapi PARA W-API (ignorar valor antigo errado do banco)
        // Se havia webhookWatsZapi salvo, será substituído pelo correto
        const webhookUrl = WEBHOOK_URL_WAPI;

        const dadosIntegracao = {
          nome_instancia: inst.instanceName,
          numero_telefone: inst.connectedPhone || "",
          status: inst.connected ? 'conectado' : 'desconectado',
          tipo_conexao: "webhook",
          api_provider: "w_api",
          modo: "integrator",
          instance_id_provider: inst.instanceId,
          api_key_provider: inst.token,
          base_url_provider: "https://api.w-api.app/v1",
          webhook_url: webhookUrl,
          ultima_atividade: new Date().toISOString(),
          configuracoes_avancadas: {
            auto_resposta_fora_horario: false,
            rate_limit_mensagens_hora: 100
          },
          estatisticas: {
            total_mensagens_enviadas: 0,
            total_mensagens_recebidas: 0,
            taxa_resposta_24h: 0,
            tempo_medio_resposta_minutos: 0
          }
        };

        if (integracaoExistente) {
          // Atualizar existente
          await base44.asServiceRole.entities.WhatsAppIntegration.update(
            integracaoExistente.id,
            dadosIntegracao
          );
          console.log(`[SYNC] 🔄 Atualizada: ${inst.instanceName}`);
          atualizadas++;
        } else {
          // Criar nova
          await base44.asServiceRole.entities.WhatsAppIntegration.create(dadosIntegracao);
          console.log(`[SYNC] ➕ Criada: ${inst.instanceName}`);
          criadas++;
        }
      } catch (error) {
        console.error(`[SYNC] ❌ Erro ao processar ${inst.instanceName}:`, error);
        erros++;
      }
    }

    console.log(`[SYNC] ✅ Sincronização concluída | Criadas: ${criadas} | Atualizadas: ${atualizadas} | Erros: ${erros}`);

    return Response.json({
      success: true,
      resultados: {
        criadas,
        atualizadas,
        erros,
        total: instanciasWAPI.length
      }
    });

  } catch (error) {
    console.error('[SYNC] ❌ Erro geral:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});