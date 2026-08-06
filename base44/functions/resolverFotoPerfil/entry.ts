import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// ==========================================================
// RESOLVEDOR ÚNICO DE FOTO DE PERFIL — todos os provedores
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
    let resultados = prioritarias.length > 0 ? await Promise.all(prioritarias.map(consultar)) : [];
    if (!resultados.some((r) => r.link)) {
      resultados = resultados.concat(await Promise.all(demais.map(consultar)));
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
    const download = await fetch(link, { signal: AbortSignal.timeout(15000) });
    if (!download.ok) throw new Error(`download_status_${download.status}`);
    const contentType = (download.headers.get('content-type') || 'image/jpeg').split(';')[0];
    if (!contentType.startsWith('image/')) throw new Error('conteudo_nao_imagem');
    const bytes = await download.arrayBuffer();
    const extensao = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const file = new File([bytes], `perfil_${contactId}_${Date.now()}.${extensao}`, { type: contentType });

    const enviar = () => Promise.race([
      base44.asServiceRole.integrations.Core.UploadFile({ file }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('upload_timeout_25s')), 25000))
    ]);
    let upload = await enviar().catch(() => null);
    if (!upload?.file_url) upload = await enviar();
    if (!upload?.file_url) throw new Error('upload_sem_url');

    await base44.asServiceRole.entities.Contact.update(contactId, {
      foto_perfil_url: upload.file_url,
      foto_perfil_atualizada_em: new Date().toISOString()
    });

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