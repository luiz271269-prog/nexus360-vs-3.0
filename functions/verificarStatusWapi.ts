import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * verificarStatusWapi
 * 
 * Verifica o status real de conexão de uma instância W-API diretamente na API deles.
 * 
 * Endpoint W-API: GET https://api.w-api.app/v1/instance/status?instanceId=XXX
 * Header: Authorization: Bearer {TOKEN}
 * 
 * Também atualiza o campo `status` e `token_status` na entidade WhatsAppIntegration.
 * 
 * USO:
 *   - Chamado manualmente pelo painel de configuração
 *   - Chamado pelo healthcheck periódico
 *   - Chamado após suspeita de desconexão
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
    const baseUrl = integracao.base_url_provider || 'https://api.w-api.app/v1';

    if (!instanceIdReal || !token) {
      return Response.json({ error: 'Configuração incompleta: instanceId e token são obrigatórios' }, { status: 400 });
    }

    console.log(`[WAPI-STATUS] 🔍 Verificando instância: ${instanceIdReal} | ${integracao.nome_instancia}`);

    // ============================================================================
    // CHAMADA REAL NA API W-API
    // Endpoint descoberto via análise da documentação e coleção Postman deles
    // ============================================================================
    const resultados = {};

    // TENTATIVA 1: /v1/instance/status?instanceId=XXX (endpoint mais comum)
    try {
      const url1 = `${baseUrl}/instance/status?instanceId=${instanceIdReal}`;
      console.log(`[WAPI-STATUS] 📡 Tentativa 1: GET ${url1}`);
      
      const r1 = await fetch(url1, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(8000)
      });

      const data1 = await r1.json().catch(() => null);
      resultados.endpoint1 = {
        url: url1,
        httpStatus: r1.status,
        response: data1
      };
      console.log(`[WAPI-STATUS] Endpoint 1 → HTTP ${r1.status}:`, JSON.stringify(data1));
    } catch (e) {
      resultados.endpoint1 = { erro: e.message };
      console.warn(`[WAPI-STATUS] Endpoint 1 falhou:`, e.message);
    }

    // TENTATIVA 2: /v1/misc/connected?instanceId=XXX (alternativa documentada por alguns)
    try {
      const url2 = `${baseUrl}/misc/connected?instanceId=${instanceIdReal}`;
      console.log(`[WAPI-STATUS] 📡 Tentativa 2: GET ${url2}`);
      
      const r2 = await fetch(url2, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(8000)
      });

      const data2 = await r2.json().catch(() => null);
      resultados.endpoint2 = {
        url: url2,
        httpStatus: r2.status,
        response: data2
      };
      console.log(`[WAPI-STATUS] Endpoint 2 → HTTP ${r2.status}:`, JSON.stringify(data2));
    } catch (e) {
      resultados.endpoint2 = { erro: e.message };
      console.warn(`[WAPI-STATUS] Endpoint 2 falhou:`, e.message);
    }

    // TENTATIVA 3: /v1/instance/info?instanceId=XXX (para coletar dados gerais)
    try {
      const url3 = `${baseUrl}/instance/info?instanceId=${instanceIdReal}`;
      console.log(`[WAPI-STATUS] 📡 Tentativa 3: GET ${url3}`);
      
      const r3 = await fetch(url3, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(8000)
      });

      const data3 = await r3.json().catch(() => null);
      resultados.endpoint3 = {
        url: url3,
        httpStatus: r3.status,
        response: data3
      };
      console.log(`[WAPI-STATUS] Endpoint 3 → HTTP ${r3.status}:`, JSON.stringify(data3));
    } catch (e) {
      resultados.endpoint3 = { erro: e.message };
      console.warn(`[WAPI-STATUS] Endpoint 3 falhou:`, e.message);
    }

    // TENTATIVA 4: /v1/misc/check-number-status (para provar que token funciona)
    // Envia um número conhecido para verificar se a API responde corretamente
    try {
      const numeroTeste = integracao.numero_telefone?.replace(/\D/g, '') || '554899322400';
      const url4 = `${baseUrl}/misc/check-number-status?instanceId=${instanceIdReal}&phoneNumber=${numeroTeste}`;
      console.log(`[WAPI-STATUS] 📡 Tentativa 4 (valida token): GET ${url4}`);
      
      const r4 = await fetch(url4, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(8000)
      });

      const data4 = await r4.json().catch(() => null);
      resultados.endpoint4_token_valid = {
        url: url4,
        httpStatus: r4.status,
        response: data4,
        token_ok: r4.status !== 401 && r4.status !== 403
      };
      console.log(`[WAPI-STATUS] Endpoint 4 → HTTP ${r4.status}:`, JSON.stringify(data4));
    } catch (e) {
      resultados.endpoint4_token_valid = { erro: e.message };
      console.warn(`[WAPI-STATUS] Endpoint 4 falhou:`, e.message);
    }

    // ============================================================================
    // INTERPRETAR RESULTADOS e ATUALIZAR BANCO
    // ============================================================================
    const agora = new Date().toISOString();
    
    // Lógica de interpretação: analisar respostas de todos os endpoints
    let statusFinal = 'desconhecido';
    let tokenValido = false;
    let conectado = false;
    let detalhesStatus = '';

    // Verificar se algum endpoint respondeu com sucesso (HTTP 200)
    const ep1 = resultados.endpoint1;
    const ep2 = resultados.endpoint2;
    const ep3 = resultados.endpoint3;
    const ep4 = resultados.endpoint4_token_valid;

    // Token inválido: todos retornam 401/403
    const todosUnauthorized = [ep1, ep2, ep3, ep4].every(
      ep => ep?.httpStatus === 401 || ep?.httpStatus === 403 || ep?.erro
    );
    
    if (todosUnauthorized) {
      statusFinal = 'desconectado';
      tokenValido = false;
      conectado = false;
      detalhesStatus = 'Token inválido ou expirado (401/403 em todos os endpoints)';
    } else {
      // Pelo menos um endpoint respondeu - token parece válido
      tokenValido = true;

      // Tentar extrair status de conexão das respostas
      const respostas = [ep1?.response, ep2?.response, ep3?.response];
      
      for (const resp of respostas) {
        if (!resp) continue;
        
        // Padrões comuns de resposta da W-API
        if (resp.connected === true || resp.status === 'connected' || resp.state === 'open') {
          conectado = true;
          detalhesStatus = 'Instância conectada ao WhatsApp';
          break;
        }
        if (resp.connected === false || resp.status === 'disconnected' || resp.state === 'close') {
          conectado = false;
          detalhesStatus = 'Instância desconectada do WhatsApp';
          break;
        }
        if (resp.error === false) {
          // W-API retorna error:false quando sucesso
          conectado = true;
          detalhesStatus = 'Instância ativa (API respondeu sem erro)';
          break;
        }
      }

      // Se ep4 (check-number-status) respondeu 200, token é válido
      if (ep4?.httpStatus === 200) {
        tokenValido = true;
        if (!detalhesStatus) {
          conectado = true;
          detalhesStatus = 'Token validado via check-number-status';
        }
      }

      statusFinal = conectado ? 'conectado' : 'desconectado';
    }

    // Atualizar banco de dados
    await base44.asServiceRole.entities.WhatsAppIntegration.update(integracao.id, {
      status: statusFinal === 'conectado' ? 'conectado' : 'desconectado',
      token_status: tokenValido ? 'valido' : 'invalido',
      token_ultima_verificacao: agora,
      ultima_atividade: agora
    });

    console.log(`[WAPI-STATUS] ✅ Resultado: ${statusFinal} | Token: ${tokenValido ? 'válido' : 'inválido'}`);

    return Response.json({
      success: true,
      integracao: {
        id: integracao.id,
        nome: integracao.nome_instancia,
        instanceId: instanceIdReal,
        numero_telefone: integracao.numero_telefone
      },
      status: {
        conectado,
        statusFinal,
        tokenValido,
        detalhes: detalhesStatus
      },
      endpoints_testados: resultados,
      atualizado_em: agora
    });

  } catch (error) {
    console.error('[WAPI-STATUS] ❌ Erro:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});