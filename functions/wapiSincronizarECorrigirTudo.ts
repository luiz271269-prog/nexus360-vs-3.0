import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ✅ FUNÇÃO ORQUESTRADORA ÚNICA - W-API Integrador
 * Sincroniza + Registra + Corrige + Verifica em uma única chamada
 * 
 * Fluxo completo:
 * 1. Lista instâncias da W-API (GET /integrator/instances)
 * 2. Sincroniza com banco (criar/atualizar status/telefone)
 * 3. Detecta divergências de webhook (DB vs W-API)
 * 4. Registra webhooks corretos (PUT /integrator/instance/webhooks)
 * 5. Revalida cada instância (GET /integrator/instance)
 * 6. Retorna resultado detalhado por instância
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

    console.log('[SYNC-FIX] 🚀 Iniciando orquestração completa W-API...');

    // ========================================================================
    // PASSO 1: LISTAR INSTÂNCIAS DA W-API (Integrador)
    // ========================================================================
    console.log('[SYNC-FIX] 📡 Listando instâncias da W-API...');
    
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

    const instancesW = listData.data;
    console.log(`[SYNC-FIX] 📊 ${instancesW.length} instâncias encontradas na W-API`);

    // ========================================================================
    // PASSO 2: SINCRONIZAR COM O BANCO
    // ========================================================================
    console.log('[SYNC-FIX] 💾 Sincronizando com banco de dados...');
    
    const integracoesLocais = await base44.asServiceRole.entities.WhatsAppIntegration.filter({
      api_provider: 'w_api'
    });

    const mapLocalByInstanceId = new Map(
      integracoesLocais.map(i => [i.instance_id_provider, i])
    );

    let atualizados = 0;

    for (const instW of instancesW) {
      const intLocal = mapLocalByInstanceId.get(instW.instanceId);
      
      if (intLocal) {
        // Atualizar status/telefone se divergente
        const statusW = instW.connected ? 'conectado' : 'desconectado';
        const numeroW = instW.connectedPhone || '';

        if (intLocal.status !== statusW || (numeroW && intLocal.numero_telefone !== numeroW)) {
          try {
            await base44.asServiceRole.entities.WhatsAppIntegration.update(intLocal.id, {
              status: statusW,
              numero_telefone: numeroW || intLocal.numero_telefone,
              ultima_atividade: new Date().toISOString()
            });
            atualizados++;
            console.log(`[SYNC-FIX] ✅ Atualizado: ${intLocal.nome_instancia} (status=${statusW}, tel=${numeroW})`);
          } catch (error) {
            console.error(`[SYNC-FIX] ❌ Erro ao atualizar ${intLocal.id}:`, error);
          }
        }
      }
    }

    console.log(`[SYNC-FIX] 📈 ${atualizados} integrações atualizadas (status/telefone)`);

    // ========================================================================
    // PASSO 3: COMPARAR URLs DE WEBHOOK (DB vs W-API)
    // ========================================================================
    console.log('[SYNC-FIX] 🔍 Comparando webhooks DB vs W-API...');
    
    const pendentesDeCorrecao = [];

    for (const instW of instancesW) {
      const intLocal = mapLocalByInstanceId.get(instW.instanceId);
      if (!intLocal) continue;

      const webhookDB = intLocal.webhook_url;
      const webhookWAPI = instW.webhookReceivedUrl;

      const divergente = webhookDB && webhookWAPI && webhookDB !== webhookWAPI;

      if (divergente) {
        pendentesDeCorrecao.push({
          integration: intLocal,
          instW,
          webhookDB,
          webhookWAPI
        });
        console.log(`[SYNC-FIX] ⚠️ Divergência: ${intLocal.nome_instancia}`);
        console.log(`[SYNC-FIX]    DB: ${webhookDB}`);
        console.log(`[SYNC-FIX]    W-API: ${webhookWAPI}`);
      }
    }

    console.log(`[SYNC-FIX] 📋 ${pendentesDeCorrecao.length} instâncias precisam correção de webhook`);

    // ========================================================================
    // PASSO 4: REGISTRAR/CORRIGIR WEBHOOKS NA W-API
    // ========================================================================
    const resultadosPorInstancia = [];

    for (const item of pendentesDeCorrecao) {
      const { integration, instW, webhookDB, webhookWAPI } = item;
      const instanceId = integration.instance_id_provider;

      console.log(`[SYNC-FIX] 🔧 Corrigindo ${integration.nome_instancia} (${instanceId})...`);

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
        console.log(`[SYNC-FIX] 📤 PUT HTTP ${putResponse.status}:`, JSON.stringify(putData, null, 2));

        if (!putResponse.ok || (putData.error !== false && putData.success !== true)) {
          resultadosPorInstancia.push({
            integration_id: integration.id,
            instance_id: instanceId,
            nome: integration.nome_instancia,
            telefone_db: integration.numero_telefone,
            telefone_wapi: instW.connectedPhone,
            webhook_db: webhookDB,
            webhook_wapi_antes: webhookWAPI,
            webhook_wapi_depois: webhookWAPI,
            aplicado: false,
            erro: putData.message || putData.error || `HTTP ${putResponse.status}`
          });
          continue;
        }

        // ========================================================================
        // PASSO 5: REVALIDAR (GET + Comparação)
        // ========================================================================
        console.log(`[SYNC-FIX] 🔍 Revalidando ${integration.nome_instancia}...`);
        
        await new Promise(resolve => setTimeout(resolve, 2000));

        const checkResponse = await fetch(`https://api.w-api.app/v1/integrator/instance?instanceId=${instanceId}`, {
          headers: { 'Authorization': `Bearer ${INTEGRATOR_TOKEN}` }
        });

        const checkData = await checkResponse.json();
        const webhookWAPI2 = checkData.webhookReceivedUrl;
        const aplicado = webhookWAPI2 === webhookDB;

        resultadosPorInstancia.push({
          integration_id: integration.id,
          instance_id: instanceId,
          nome: integration.nome_instancia,
          telefone_db: integration.numero_telefone,
          telefone_wapi: checkData.connectedPhone,
          webhook_db: webhookDB,
          webhook_wapi_antes: webhookWAPI,
          webhook_wapi_depois: webhookWAPI2,
          aplicado,
          erro: aplicado ? null : 'W-API não aplicou a URL (verificar manualmente)'
        });

        console.log(`[SYNC-FIX] ${aplicado ? '✅ SUCESSO' : '❌ FALHOU'}: ${integration.nome_instancia}`);
        console.log(`[SYNC-FIX]    Antes: ${webhookWAPI}`);
        console.log(`[SYNC-FIX]    Depois: ${webhookWAPI2}`);
        console.log(`[SYNC-FIX]    Esperado: ${webhookDB}`);

      } catch (error) {
        resultadosPorInstancia.push({
          integration_id: integration.id,
          instance_id: instanceId,
          nome: integration.nome_instancia,
          aplicado: false,
          erro: error.message
        });
        console.error(`[SYNC-FIX] ❌ Exceção: ${integration.nome_instancia}`, error);
      }
    }

    // ========================================================================
    // PASSO 6: RESPOSTA CONSOLIDADA
    // ========================================================================
    const corrigidos = resultadosPorInstancia.filter(r => r.aplicado).length;
    const falhas = resultadosPorInstancia.filter(r => !r.aplicado).length;

    console.log('[SYNC-FIX] 🏁 FINALIZADO');
    console.log(`[SYNC-FIX]    Total W-API: ${instancesW.length}`);
    console.log(`[SYNC-FIX]    Total Banco: ${integracoesLocais.length}`);
    console.log(`[SYNC-FIX]    Status Atualizados: ${atualizados}`);
    console.log(`[SYNC-FIX]    Divergências Detectadas: ${pendentesDeCorrecao.length}`);
    console.log(`[SYNC-FIX]    Webhooks Corrigidos: ${corrigidos}`);
    console.log(`[SYNC-FIX]    Falhas: ${falhas}`);

    return Response.json({
      success: true,
      provider: 'wapi',
      resumo: {
        total_instancias_provedor: instancesW.length,
        total_integracoes_local: integracoesLocais.length,
        status_atualizados: atualizados,
        divergencias_detectadas: pendentesDeCorrecao.length,
        webhooks_corrigidos: corrigidos,
        falhas
      },
      instancias: instancesW,
      resultados: resultadosPorInstancia,
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