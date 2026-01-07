import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ✅ FUNÇÃO ORQUESTRADORA ÚNICA - W-API
 * Sincroniza + Registra + Corrige + Verifica
 * 
 * Fluxo:
 * 1. Lista instâncias da W-API
 * 2. Atualiza status/telefone no banco
 * 3. Detecta divergências de webhook
 * 4. Registra webhooks corretos na W-API
 * 5. Verifica aplicação
 * 6. Retorna resultado consolidado
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ 
        success: false, 
        error: 'Apenas admins podem executar sincronização' 
      }, { status: 403 });
    }

    const INTEGRATOR_TOKEN = Deno.env.get('WAPI_INTEGRATOR_TOKEN');
    if (!INTEGRATOR_TOKEN) {
      return Response.json({ 
        success: false,
        error: 'WAPI_INTEGRATOR_TOKEN não configurado' 
      }, { status: 500 });
    }

    console.log('[SYNC-FIX] 🚀 Iniciando orquestração completa...');

    // ========================================================================
    // 1️⃣ LISTAR INSTÂNCIAS DA W-API
    // ========================================================================
    const listResponse = await fetch('https://api.w-api.app/v1/integrator/instances?pageSize=100&page=1', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${INTEGRATOR_TOKEN}`
      }
    });

    const listData = await listResponse.json();

    if (listData.error !== false || !listData.data) {
      return Response.json({
        success: false,
        error: 'Erro ao buscar instâncias da W-API',
        detalhes: listData
      }, { status: 400 });
    }

    const instanciasWAPI = listData.data;
    console.log(`[SYNC-FIX] 📊 ${instanciasWAPI.length} instâncias na W-API`);

    // ========================================================================
    // 2️⃣ BUSCAR INTEGRAÇÕES LOCAIS W-API
    // ========================================================================
    const integracoesLocais = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
      api_provider: 'w_api'
    });

    console.log(`[SYNC-FIX] 💾 ${integracoesLocais.length} integrações no banco`);

    const mapeamentoLocal = new Map(
      integracoesLocais.map(i => [i.instance_id_provider, i])
    );

    // ========================================================================
    // 3️⃣ SINCRONIZAR STATUS/TELEFONE + DETECTAR DIVERGÊNCIAS
    // ========================================================================
    let atualizados = 0;
    const divergenciasWebhook = [];

    for (const instW of instanciasWAPI) {
      const intLocal = mapeamentoLocal.get(instW.instanceId);
      if (!intLocal) continue;

      const statusW = instW.connected ? 'conectado' : 'desconectado';
      const numeroW = instW.connectedPhone || '';

      // Atualizar status/telefone se divergente
      if (intLocal.status !== statusW || (numeroW && intLocal.numero_telefone !== numeroW)) {
        try {
          await base44.asServiceRole.entities.WhatsAppIntegration.update(intLocal.id, {
            status: statusW,
            numero_telefone: numeroW || intLocal.numero_telefone,
            ultima_atividade: new Date().toISOString()
          });
          atualizados++;
          console.log(`[SYNC-FIX] ✅ Atualizado: ${intLocal.nome_instancia} (status/telefone)`);
        } catch (error) {
          console.error(`[SYNC-FIX] ❌ Erro ao atualizar ${intLocal.id}:`, error);
        }
      }

      // Detectar divergência de webhook
      const webhookDB = intLocal.webhook_url;
      const webhookWAPI = instW.webhookReceivedUrl;

      if (webhookDB && webhookWAPI && webhookDB !== webhookWAPI) {
        divergenciasWebhook.push({
          integration: intLocal,
          webhookDB,
          webhookWAPI,
          instanceId: instW.instanceId
        });
        console.log(`[SYNC-FIX] ⚠️ Divergência: ${intLocal.nome_instancia} | DB=${webhookDB} | W-API=${webhookWAPI}`);
      }
    }

    console.log(`[SYNC-FIX] 📈 Status: ${atualizados} atualizados | ${divergenciasWebhook.length} webhooks divergentes`);

    // ========================================================================
    // 4️⃣ CORRIGIR DIVERGÊNCIAS DE WEBHOOK (PUT na W-API)
    // ========================================================================
    const correcoes = [];

    for (const div of divergenciasWebhook) {
      const { integration, webhookDB, instanceId } = div;

      console.log(`[SYNC-FIX] 🔧 Corrigindo webhook: ${integration.nome_instancia}`);
      console.log(`[SYNC-FIX] 📋 URL correta (DB): ${webhookDB}`);

      try {
        const putResponse = await fetch('https://api.w-api.app/v1/integrator/instance/webhooks', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${INTEGRATOR_TOKEN}`
          },
          body: JSON.stringify({
            instanceId,
            webhookReceivedUrl: webhookDB,
            webhookDeliveryUrl: webhookDB,
            webhookDisconnectedUrl: webhookDB,
            webhookStatusUrl: webhookDB,
            webhookPresenceUrl: webhookDB,
            webhookConnectedUrl: webhookDB
          })
        });

        const putData = await putResponse.json();
        console.log(`[SYNC-FIX] 📥 PUT Response:`, JSON.stringify(putData, null, 2));

        if (putResponse.ok && (putData.error === false || putData.success === true)) {
          // Esperar 2s e verificar se foi aplicado
          await new Promise(resolve => setTimeout(resolve, 2000));

          const verifyResponse = await fetch(`https://api.w-api.app/v1/integrator/instance?instanceId=${instanceId}`, {
            headers: { 'Authorization': `Bearer ${INTEGRATOR_TOKEN}` }
          });

          const verifyData = await verifyResponse.json();
          const webhookAplicado = verifyData.webhookReceivedUrl === webhookDB;

          correcoes.push({
            nome: integration.nome_instancia,
            instanceId,
            sucesso: webhookAplicado,
            webhookDB,
            webhookWAPI_antes: div.webhookWAPI,
            webhookWAPI_depois: verifyData.webhookReceivedUrl
          });

          console.log(`[SYNC-FIX] ${webhookAplicado ? '✅' : '⚠️'} ${integration.nome_instancia}: ${webhookAplicado ? 'Corrigido' : 'Ainda divergente'}`);
        } else {
          correcoes.push({
            nome: integration.nome_instancia,
            instanceId,
            sucesso: false,
            erro: putData.message || putData.error || 'PUT falhou'
          });
          console.error(`[SYNC-FIX] ❌ Falha no PUT: ${integration.nome_instancia}`);
        }
      } catch (error) {
        correcoes.push({
          nome: integration.nome_instancia,
          instanceId,
          sucesso: false,
          erro: error.message
        });
        console.error(`[SYNC-FIX] ❌ Erro: ${integration.nome_instancia}`, error);
      }
    }

    // ========================================================================
    // 5️⃣ RETORNAR RESULTADO CONSOLIDADO
    // ========================================================================
    const corrigidos = correcoes.filter(c => c.sucesso).length;
    const falhas = correcoes.filter(c => !c.sucesso).length;

    console.log(`[SYNC-FIX] 🏁 Finalizado | Atualizados: ${atualizados} | Webhooks corrigidos: ${corrigidos}/${divergenciasWebhook.length}`);

    return Response.json({
      success: true,
      resumo: {
        instancias_wapi: instanciasWAPI.length,
        integracoes_banco: integracoesLocais.length,
        status_atualizados: atualizados,
        divergencias_detectadas: divergenciasWebhook.length,
        webhooks_corrigidos: corrigidos,
        falhas
      },
      instancias: instanciasWAPI,
      correcoes,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[SYNC-FIX] ❌ Erro fatal:', error);
    return Response.json({ 
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});