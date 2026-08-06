import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ==========================================================
// RESOLVEDOR ÚNICO DE FOTO DE PERFIL — todos os provedores
// v3.3: fallback ordenado por provider de origem + uso recente (máx. 2)
// ==========================================================
// Regra centralizada: a foto de um número é procurada em TODAS as instâncias
// conectadas de TODOS os provedores (Z-API e W-API), em paralelo, porque cada
// instância só "vê" a foto de quem tem aquele número salvo (privacidade
// "Meus contatos"). A primeira instância que devolver link válido resolve.
//
// v3.2: PRIORIDADE para a instância por onde a conversa chegou (thread do
// contato / conexao_origem) — consulta essa primeiro; só se ela não tiver a
// foto, consulta as demais em paralelo como fallback.
//
// Entrada: { phone, contact_id?, persistir?, integration_id? }
// Saída:   { success, link, file_url, provider, instance_id, tentativas }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const contactId = body?.contact_id || null;
    const persistir = body?.persistir !== false;
    const phone = String(body?.phone || '').replace(/\D/g, '');
    if (phone.length < 10) {
      return Response.json({ success: false, error: 'telefone_invalido' }, { status: 400 });
    }

    const integracoes = await base44.asServiceRole.entities.WhatsAppIntegration.list('-updated_date', 100);
    const utilizaveis = integracoes.filter((i) =>
      i.status === 'conectado' && i.instance_id_provider && i.api_key_provider
    );

    const consultar = async (integracao) => {
      const provider = integracao.api_provider;
      const instance = integracao.instance_id_provider;
      let url = null;
      let headers = {};

      if (provider === 'z_api') {
        const base = (integracao.base_url_provider && integracao.base_url_provider !== 'null')
          ? integracao.base_url_provider.replace(/\/$/, '')
          : 'https://api.z-api.io';
        url = `${base}/instances/${instance}/token/${integracao.api_key_provider}/profile-picture?phone=${phone}`;
        headers = { 'Client-Token': integracao.security_client_token_header || '' };
      } else if (provider === 'w_api') {
        url = `https://api.w-api.app/v1/contacts/profile-picture?instanceId=${instance}&phoneNumber=${phone}`;
        headers = { 'Authorization': `Bearer ${integracao.api_key_provider}`, 'Accept': 'application/json' };
      } else {
        return { instance, provider, resultado: 'provider_nao_suportado', link: null };
      }

      try {
        const resp = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(8000) });
        if (!resp.ok) return { instance, provider, resultado: `http_${resp.status}`, link: null };
        const data = await resp.json().catch(() => ({}));
        const candidato = String(data?.link || data?.profilePictureUrl || data?.url || '');
        if (candidato.startsWith('http')) return { instance, provider, resultado: 'encontrado', link: candidato };
        return { instance, provider, resultado: data?.errorMessage || 'sem_foto', link: null };
      } catch (e) {
        return { instance, provider, resultado: `erro:${e.message}`, link: null };
      }
    };

    // ── Descobrir a(s) integração(ões) por onde a conversa/mensagem chegou ──
    const idsPrioritarios = new Set();
    if (body?.integration_id) idsPrioritarios.add(String(body.integration_id));
    if (contactId) {
      const [contato, threads] = await Promise.all([
        base44.asServiceRole.entities.Contact.get(contactId).catch(() => null),
        base44.asServiceRole.entities.MessageThread.filter({ contact_id: contactId }, '-last_message_at', 5).catch(() => [])
      ]);
      if (contato?.conexao_origem) idsPrioritarios.add(String(contato.conexao_origem));
      for (const t of (threads || [])) {
        if (t.whatsapp_integration_id) idsPrioritarios.add(String(t.whatsapp_integration_id));
        for (const oid of (t.origin_integration_ids || [])) idsPrioritarios.add(String(oid));
        if (t.conexao_id) idsPrioritarios.add(String(t.conexao_id));
      }
    }

    const ehPrioritaria = (i) => idsPrioritarios.has(String(i.id)) || idsPrioritarios.has(String(i.instance_id_provider));
    const prioritarias = utilizaveis.filter(ehPrioritaria);
    const demais = utilizaveis.filter((i) => !ehPrioritaria(i));

    // 1º: consulta pela instância de origem da conversa; 2º: fallback nas demais
    // Fallback ordenado por prioridade real (utilizaveis já são só status=conectado):
    // 1) mesmo provider da integração de origem; 2) uso mais recente (lista vem
    // ordenada por -updated_date). Limite de 2 fallbacks para caber no tempo de execução.
    const providersOrigem = new Set(prioritarias.map((i) => i.api_provider));
    const fallbackOrdenado = [...demais].sort((a, b) => {
      const pesoA = providersOrigem.has(a.api_provider) ? 0 : 1;
      const pesoB = providersOrigem.has(b.api_provider) ? 0 : 1;
      if (pesoA !== pesoB) return pesoA - pesoB;
      return new Date(b.updated_date || 0).getTime() - new Date(a.updated_date || 0).getTime();
    });

    let resultados = prioritarias.length > 0 ? await Promise.all(prioritarias.map(consultar)) : [];
    if (!resultados.some((r) => r.link)) {
      const fallback = prioritarias.length > 0 ? fallbackOrdenado.slice(0, 2) : fallbackOrdenado;
      resultados = resultados.concat(await Promise.all(fallback.map(consultar)));
    }
    const tentativas = resultados.map((r) => ({ instance: r.instance, provider: r.provider, resultado: r.resultado }));

    const vencedor = resultados.find((r) => r.link);
    let link = vencedor?.link || null;
    const providerUsado = vencedor?.provider || null;
    const instanciaUsada = vencedor?.instance || null;

    if (!link) {
      if (contactId && persistir) {
        await base44.asServiceRole.entities.Contact.update(contactId, {
          foto_perfil_url: '',
          foto_perfil_atualizada_em: new Date().toISOString()
        }).catch(() => null);
      }
      return Response.json({ success: true, link: null, file_url: null, tentativas });
    }

    if (!contactId || !persistir) {
      return Response.json({ success: true, link, file_url: null, provider: providerUsado, instance_id: instanciaUsada, tentativas });
    }

    // Persistência permanente: baixa a URL temporária e sobe para o storage
    const t0 = Date.now();
    console.log('[FOTO] inicio_download');
    const download = await fetch(link, { signal: AbortSignal.timeout(15000) });
    console.log('[FOTO] download_ok em', Date.now() - t0, 'ms status', download.status);
    if (!download.ok) throw new Error(`download_status_${download.status}`);
    const contentType = (download.headers.get('content-type') || 'image/jpeg').split(';')[0];
    if (!contentType.startsWith('image/')) throw new Error('conteudo_nao_imagem');
    const bytes = await download.arrayBuffer();
    const extensao = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const file = new File([bytes], `perfil_${contactId}_${Date.now()}.${extensao}`, { type: contentType });

    console.log('[FOTO] inicio_upload bytes', bytes.byteLength, 'em', Date.now() - t0, 'ms');
    const upload = await Promise.race([
      base44.asServiceRole.integrations.Core.UploadFile({ file }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('upload_timeout_20s')), 20000))
    ]);
    console.log('[FOTO] upload_ok em', Date.now() - t0, 'ms');
    if (!upload?.file_url) throw new Error('upload_sem_url');

    // ✅ API REST DIRETA: o SDK trava pós-UploadFile (mesmo padrão do persistirMidiaWapi).
    const appId = Deno.env.get('BASE44_APP_ID');
    const rUpd = await fetch(`https://base44.app/api/apps/${appId}/entities/Contact/${contactId}`, {
      method: 'PUT',
      headers: {
        'Authorization': req.headers.get('authorization') || '',
        'api_key': req.headers.get('api_key') || '',
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        foto_perfil_url: upload.file_url,
        foto_perfil_atualizada_em: new Date().toISOString()
      })
    });
    if (!rUpd.ok) throw new Error(`update_api_http_${rUpd.status}`);
    console.log('[FOTO] update_ok em', Date.now() - t0, 'ms');

    return Response.json({
      success: true,
      link,
      file_url: upload.file_url,
      provider: providerUsado,
      instance_id: instanciaUsada,
      tentativas
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});