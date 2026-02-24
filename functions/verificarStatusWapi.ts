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

    // =========================================================================
    // W-API: a documentação oficial (Postman) mostra que o endpoint de status
    // correto usa o header Authorization: Bearer {TOKEN} e a URL base é
    // https://api.w-api.app/v1 com instanceId como query param.
    //
    // Endpoints conhecidos (testados contra a API real):
    // 1. POST /message/send-text  → funciona (envios confirmados nos logs)
    // 2. GET /instance/status     → 404 (não documentado na coleção pública)
    //
    // Estratégia de verificação indireta: tentar enviar requisição ao endpoint
    // de "check-number-status" ou fazer um GET simples que valide o token.
    // Se retornar 200 = token válido. Se retornar 401/403 = token inválido.
    // A W-API NÃO publica endpoint público de status de sessão.
    // =========================================================================

    // ENDPOINT 1: Tentar send-text com número inválido para validar token
    // W-API retorna erro de número (não 401) se o token for válido
    try {
      const url = `${baseUrl}/message/send-text?instanceId=${instanceIdReal}`;
      const r = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone: '0000000000', message: 'ping-status-check', delayMessage: 0 }),
        signal: AbortSignal.timeout(8000)
      });
      const bodyText = await r.text();
      let data = null;
      try { data = JSON.parse(bodyText); } catch (_) { data = bodyText; }
      resultados.token_probe = {
        url,
        httpStatus: r.status,
        response: data,
        // 401/403 = token inválido; qualquer outra coisa (400, 422, etc.) = token OK
        token_valido: r.status !== 401 && r.status !== 403,
        nota: 'Probe via send-text com número fake para validar token'
      };
      console.log(`[WAPI-STATUS] token_probe (send-text) → ${r.status}:`, bodyText.substring(0, 300));
    } catch (e) {
      resultados.token_probe = { erro: e.message };
    }

    // ENDPOINT 2: Tentar enviar áudio (outro endpoint - valida se instância responde)
    try {
      const url = `${baseUrl}/message/send-audio?instanceId=${instanceIdReal}`;
      const r = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone: '0000000000', audio: 'https://example.com/test.ogg' }),
        signal: AbortSignal.timeout(8000)
      });
      const bodyText = await r.text();
      let data = null;
      try { data = JSON.parse(bodyText); } catch (_) { data = bodyText; }
      resultados.audio_probe = {
        url,
        httpStatus: r.status,
        response: data,
        token_valido: r.status !== 401 && r.status !== 403
      };
      console.log(`[WAPI-STATUS] audio_probe → ${r.status}:`, bodyText.substring(0, 300));
    } catch (e) {
      resultados.audio_probe = { erro: e.message };
    }

    // ENDPOINT 3: Tentar GET /instance/status (pode não existir, mas logar resposta real)
    try {
      const url = `${baseUrl}/instance/status?instanceId=${instanceIdReal}`;
      const r = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(8000) });
      const bodyText = await r.text();
      let data = null;
      try { data = JSON.parse(bodyText); } catch (_) { data = bodyText; }
      resultados.instance_status = {
        url,
        httpStatus: r.status,
        response: data,
        token_valido: r.status !== 401 && r.status !== 403
      };
      console.log(`[WAPI-STATUS] /instance/status → ${r.status}:`, bodyText.substring(0, 300));
    } catch (e) {
      resultados.instance_status = { erro: e.message };
    }

    // ENDPOINT 4: Tentar GET /instance/info (alternativa)
    try {
      const url = `${baseUrl}/instance/info?instanceId=${instanceIdReal}`;
      const r = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(8000) });
      const bodyText = await r.text();
      let data = null;
      try { data = JSON.parse(bodyText); } catch (_) { data = bodyText; }
      resultados.instance_info = {
        url,
        httpStatus: r.status,
        response: data,
        token_valido: r.status !== 401 && r.status !== 403
      };
      console.log(`[WAPI-STATUS] /instance/info → ${r.status}:`, bodyText.substring(0, 300));
    } catch (e) {
      resultados.instance_info = { erro: e.message };
    }

    // ============================================================================
    // INTERPRETAR RESULTADOS
    // 
    // DESCOBERTA CRÍTICA (testado 2026-02-24):
    // - W-API NÃO tem endpoint GET /instance/status (retorna 404)
    // - W-API NÃO tem endpoint GET /instance/info (retorna 404)
    // - Quando a instância está CONECTADA:
    //   → POST /message/send-text retorna HTTP 200 com messageId
    //   → POST /message/send-audio retorna HTTP 200 com messageId
    //   → Se retornar 401/403: token inválido
    //   → Se retornar 403 com "not connected": instância desconectada mas token válido
    //
    // CONCLUSÃO: A ÚNICA forma de verificar status é via probe de envio.
    // Se a mensagem "enfileira" (HTTP 200 + messageId) = instância conectada ao WhatsApp.
    // Webhook "webhookDisconnected" é enviado quando a sessão cai.
    // ============================================================================
    const agora = new Date().toISOString();
    
    let conectado = false;
    let tokenValido = false;
    let statusFinal = 'desconhecido';
    let detalhes = '';

    // NOTA: os campos de resultados foram renomeados nesta versão
    const tokenProbe = resultados.token_probe;
    const audioProbe = resultados.audio_probe;
    
    console.log('[WAPI-STATUS] 🔬 tokenProbe:', JSON.stringify(tokenProbe));

    // Token inválido: 401 ou 403 no probe
    if (tokenProbe?.httpStatus === 401 || tokenProbe?.httpStatus === 403) {
      tokenValido = false;
      conectado = false;
      statusFinal = 'token_invalido';
      detalhes = `Token inválido ou expirado (HTTP ${tokenProbe.httpStatus})`;
    }
    // W-API COMPORTAMENTO DESCOBERTO (2026-02-24):
    // A W-API ENFILEIRA mensagens mesmo quando o WhatsApp não está conectado.
    // Retorna HTTP 200 + messageId independente do estado de conexão do WhatsApp.
    // PORTANTO: HTTP 200 = token válido + instância existe, MAS NÃO garante WhatsApp conectado.
    // A única fonte de verdade é o webhook "webhookDisconnected" que atualiza o campo `status`
    // no banco de dados. Se `status` = 'conectado' no banco + messageId retornado = provavelmente OK.
    else if (tokenProbe?.httpStatus === 200 && tokenProbe?.response?.messageId) {
      tokenValido = true;
      // Verificar status atual no banco como tie-breaker
      const statusNoBanco = integracao.status;
      conectado = statusNoBanco === 'conectado';
      statusFinal = conectado ? 'conectado' : 'incerto';
      detalhes = `Token válido e instância existe (messageId: ${tokenProbe.response.messageId}). W-API enfileira mesmo desconectado. Status no banco: "${statusNoBanco}". Use o webhook webhookDisconnected como fonte de verdade.`;
    }
    // Instância desconectada mas token válido: 403 "not connected" ou 400
    else if (tokenProbe?.httpStatus === 400 || tokenProbe?.httpStatus === 422) {
      const msg = JSON.stringify(tokenProbe.response || '').toLowerCase();
      tokenValido = true;
      conectado = msg.includes('connect') ? false : false;
      statusFinal = 'desconectado';
      detalhes = `Token válido, mas instância não conectada ao WhatsApp (HTTP ${tokenProbe.httpStatus})`;
    }
    // Erro de rede ou timeout
    else if (tokenProbe?.erro) {
      tokenValido = false;
      conectado = false;
      statusFinal = 'erro_rede';
      detalhes = `Erro ao contactar W-API: ${tokenProbe.erro}`;
    }
    else {
      tokenValido = true;
      conectado = false;
      statusFinal = 'desconhecido';
      detalhes = `Resposta inesperada: HTTP ${tokenProbe?.httpStatus}`;
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