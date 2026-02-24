import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * verificarStatusWapi
 * 
 * Verifica o status real de conexão de uma instância W-API diretamente na API deles.
 * Testa múltiplos endpoints para descobrir qual funciona e retorna diagnóstico completo.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { integration_id, instanceId } = payload;

    if (!integration_id && !instanceId) {
      return Response.json({
        error: 'Informe integration_id (ID do banco) ou instanceId (ID da instância W-API)'
      }, { status: 400 });
    }

    // Buscar integração no banco
    let integracao;
    if (integration_id) {
      integracao = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id);
    } else {
      const lista = await base44.asServiceRole.entities.WhatsAppIntegration.filter(
        { instance_id_provider: instanceId, api_provider: 'w_api' },
        '-created_date',
        1
      );
      integracao = lista?.[0] || null;
    }

    if (!integracao) {
      return Response.json({ error: 'Integração não encontrada' }, { status: 404 });
    }

    if (integracao.api_provider !== 'w_api') {
      return Response.json({ error: `Integração é ${integracao.api_provider}, não w_api` }, { status: 400 });
    }

    const instanceIdReal = integracao.instance_id_provider;
    const token = integracao.api_key_provider;
    const baseUrl = (integracao.base_url_provider || 'https://api.w-api.app/v1').replace(/\/$/, '');

    if (!instanceIdReal || !token) {
      return Response.json({ error: 'Configuração incompleta: instanceId e token são obrigatórios' }, { status: 400 });
    }

    console.log(`[WAPI-STATUS] 🔍 Verificando: ${instanceIdReal} | ${integracao.nome_instancia}`);
    console.log(`[WAPI-STATUS] Base URL: ${baseUrl}`);

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const resultados = {};

    // ENDPOINT 1: /instance/status
    try {
      const url = `${baseUrl}/instance/status?instanceId=${instanceIdReal}`;
      const r = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(8000) });
      const body = await r.text();
      let data = null;
      try { data = JSON.parse(body); } catch (_) { data = body; }
      resultados.status = { url, httpStatus: r.status, response: data };
      console.log(`[WAPI-STATUS] /instance/status → ${r.status}:`, body.substring(0, 300));
    } catch (e) {
      resultados.status = { erro: e.message };
    }

    // ENDPOINT 2: /misc/connected
    try {
      const url = `${baseUrl}/misc/connected?instanceId=${instanceIdReal}`;
      const r = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(8000) });
      const body = await r.text();
      let data = null;
      try { data = JSON.parse(body); } catch (_) { data = body; }
      resultados.connected = { url, httpStatus: r.status, response: data };
      console.log(`[WAPI-STATUS] /misc/connected → ${r.status}:`, body.substring(0, 300));
    } catch (e) {
      resultados.connected = { erro: e.message };
    }

    // ENDPOINT 3: /instance/info
    try {
      const url = `${baseUrl}/instance/info?instanceId=${instanceIdReal}`;
      const r = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(8000) });
      const body = await r.text();
      let data = null;
      try { data = JSON.parse(body); } catch (_) { data = body; }
      resultados.info = { url, httpStatus: r.status, response: data };
      console.log(`[WAPI-STATUS] /instance/info → ${r.status}:`, body.substring(0, 300));
    } catch (e) {
      resultados.info = { erro: e.message };
    }

    // ENDPOINT 4: /misc/check-number-status (para validar se token funciona)
    try {
      const numeroTeste = (integracao.numero_telefone || '554830452078').replace(/\D/g, '');
      const url = `${baseUrl}/misc/check-number-status?instanceId=${instanceIdReal}&phoneNumber=${numeroTeste}`;
      const r = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(8000) });
      const body = await r.text();
      let data = null;
      try { data = JSON.parse(body); } catch (_) { data = body; }
      resultados.checkNumber = { url, httpStatus: r.status, response: data, token_parece_valido: r.status !== 401 && r.status !== 403 };
      console.log(`[WAPI-STATUS] /misc/check-number-status → ${r.status}:`, body.substring(0, 300));
    } catch (e) {
      resultados.checkNumber = { erro: e.message };
    }

    // ============================================================================
    // INTERPRETAR RESULTADOS
    // ============================================================================
    const agora = new Date().toISOString();
    
    const allUnauthorized = Object.values(resultados).every(
      ep => ep?.httpStatus === 401 || ep?.httpStatus === 403 || ep?.erro
    );
    
    let conectado = false;
    let tokenValido = false;
    let statusFinal = 'desconhecido';
    let detalhes = '';

    if (allUnauthorized) {
      tokenValido = false;
      conectado = false;
      statusFinal = 'token_invalido';
      detalhes = 'Token inválido ou expirado (401/403 em todos os endpoints)';
    } else {
      tokenValido = true;
      
      // Tentar interpretar a resposta de cada endpoint
      for (const [key, ep] of Object.entries(resultados)) {
        if (!ep?.response || ep.httpStatus >= 400) continue;
        const r = ep.response;
        
        if (r.connected === true || r.status === 'connected' || r.state === 'open' || r.isConnected === true) {
          conectado = true;
          detalhes = `Conectado (via ${key})`;
          break;
        }
        if (r.connected === false || r.status === 'disconnected' || r.state === 'close') {
          conectado = false;
          detalhes = `Desconectado (via ${key})`;
          break;
        }
        if (r.error === false) {
          // W-API retorna error:false quando sucesso
          conectado = true;
          detalhes = `API respondeu sem erro (via ${key}) - assumindo conectado`;
          break;
        }
      }

      if (!detalhes) {
        detalhes = 'Token válido mas status de conexão não determinado pelos endpoints';
      }
      statusFinal = conectado ? 'conectado' : 'desconectado';
    }

    // Atualizar banco
    await base44.asServiceRole.entities.WhatsAppIntegration.update(integracao.id, {
      status: conectado ? 'conectado' : 'desconectado',
      token_status: tokenValido ? 'valido' : 'invalido',
      token_ultima_verificacao: agora,
      ultima_atividade: agora
    });

    console.log(`[WAPI-STATUS] ✅ Final: ${statusFinal} | Token: ${tokenValido}`);

    return Response.json({
      success: true,
      integracao: {
        id: integracao.id,
        nome: integracao.nome_instancia,
        instanceId: instanceIdReal,
        numero_telefone: integracao.numero_telefone,
        base_url: baseUrl
      },
      diagnostico: {
        conectado,
        statusFinal,
        tokenValido,
        detalhes
      },
      endpoints: resultados,
      banco_atualizado: true,
      verificado_em: agora
    });

  } catch (error) {
    console.error('[WAPI-STATUS] ❌ Erro:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});