import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ============================================================================
// WAPI ACTIVATE AUTO DOWNLOAD - v1.0.0
// ============================================================================
// Ativa Auto Download via PATCH /settings no canal W-API
// Endpoint oficial: PATCH https://gate.whapi.cloud/settings
// (ou base_url_provider conforme configuração da integração)
// ============================================================================

Deno.serve(async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  if (req.method === 'GET') {
    return Response.json({
      description: 'Ativa Auto Download no canal W-API via PATCH /settings',
      usage: 'POST com { integration_id: "..." } ou omitir para aplicar em TODAS as integrações w_api'
    }, { headers });
  }

  try {
    const base44 = createClientFromRequest(req);
    const bodyRaw = await req.json().catch(() => ({}));
    const payload = bodyRaw?.payload ?? bodyRaw;

    const { integration_id } = payload;

    // Buscar integrações W-API
    let integracoes;
    if (integration_id) {
      const integ = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);
      integracoes = integ ? [integ] : [];
    } else {
      integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
        { api_provider: 'w_api' },
        '-created_date',
        50
      );
    }

    if (!integracoes || integracoes.length === 0) {
      return Response.json({ success: false, error: 'Nenhuma integração W-API encontrada' }, { status: 404, headers });
    }

    console.log(`[WAPI_AUTO_DOWNLOAD] Aplicando em ${integracoes.length} integração(ões)...`);

    const resultados = [];

    for (const integ of integracoes) {
      const instanceId = integ.instance_id_provider;
      const token = integ.api_key_provider;
      const baseUrl = integ.base_url_provider || 'https://gate.whapi.cloud';

      if (!instanceId || !token) {
        resultados.push({
          integration_id: integ.id,
          nome: integ.nome_instancia,
          success: false,
          error: 'Sem instanceId ou token'
        });
        continue;
      }

      try {
        // PATCH /settings - ativar auto download
        const settingsUrl = `${baseUrl}/settings`;

        console.log(`[WAPI_AUTO_DOWNLOAD] PATCH ${settingsUrl} | Instance: ${instanceId}`);

        const response = await fetch(settingsUrl, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            media: {
              auto_download: ['audio', 'image', 'video', 'document']
            }
          })
        });

        const data = await response.json().catch(() => ({ raw_status: response.status }));

        if (!response.ok) {
          console.warn(`[WAPI_AUTO_DOWNLOAD] ❌ ${integ.nome_instancia}: HTTP ${response.status}`, data);
          resultados.push({
            integration_id: integ.id,
            nome: integ.nome_instancia,
            success: false,
            http_status: response.status,
            response: data
          });
          continue;
        }

        console.log(`[WAPI_AUTO_DOWNLOAD] ✅ ${integ.nome_instancia}: Auto Download ativado`, data);

        // Confirmar configuração atual via GET /settings
        let settingsAtual = null;
        try {
          const getResp = await fetch(settingsUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          settingsAtual = await getResp.json();
          console.log(`[WAPI_AUTO_DOWNLOAD] 📋 Settings atual de ${integ.nome_instancia}:`, JSON.stringify(settingsAtual?.media || settingsAtual).substring(0, 200));
        } catch (e) {
          console.warn(`[WAPI_AUTO_DOWNLOAD] ⚠️ Não foi possível verificar settings: ${e.message}`);
        }

        resultados.push({
          integration_id: integ.id,
          nome: integ.nome_instancia,
          success: true,
          http_status: response.status,
          patch_response: data,
          settings_confirmado: settingsAtual?.media || null
        });

      } catch (e) {
        console.error(`[WAPI_AUTO_DOWNLOAD] ❌ Erro em ${integ.nome_instancia}:`, e.message);
        resultados.push({
          integration_id: integ.id,
          nome: integ.nome_instancia,
          success: false,
          error: e.message
        });
      }
    }

    const sucessos = resultados.filter(r => r.success).length;

    return Response.json({
      success: sucessos > 0,
      total: resultados.length,
      sucessos,
      falhas: resultados.length - sucessos,
      resultados
    }, { headers });

  } catch (error) {
    console.error('[WAPI_AUTO_DOWNLOAD] ❌ ERRO GERAL:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500, headers });
  }
});