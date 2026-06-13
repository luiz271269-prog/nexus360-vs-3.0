import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ── Envio direto ao provedor (Z-API/W-API). NÃO usar invoke('enviarWhatsApp')
// server-to-server: esse hop retorna 403 Forbidden e a mensagem NUNCA chega.
// Chamamos a API do provedor direto, igual ao skillPreAtendimentos. ──
async function enviarTextoWhatsApp(integ, telefone, mensagem) {
  const tel = (telefone || '').replace(/\D/g, '');
  const phone = tel.startsWith('55') ? tel : '55' + tel;

  if (integ.api_provider === 'w_api') {
    const url = (integ.base_url_provider || 'https://api.w-api.app/v1')
      + `/message/send-text?instanceId=${integ.instance_id_provider}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${integ.api_key_provider}` },
      body: JSON.stringify({ phone, message: mensagem, delayMessage: 1 })
    });
    const resp = await r.json().catch(() => ({}));
    const msgId = resp.messageId || resp.insertedId || resp.id || resp.key?.id || null;
    return { ok: r.ok && !!msgId && !resp.error, msgId, raw: resp };
  }
  const url = (integ.base_url_provider || 'https://api.z-api.io')
    + `/instances/${integ.instance_id_provider}/token/${integ.api_key_provider}/send-text`;
  const headers = { 'Content-Type': 'application/json' };
  if (integ.security_client_token_header) headers['Client-Token'] = integ.security_client_token_header;
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ phone, message: mensagem }) });
  const resp = await r.json().catch(() => ({}));
  const msgId = resp.messageId || resp.key?.id || resp.id || null;
  return { ok: r.ok && !!msgId && !resp.error, msgId, raw: resp };
}

// ── Lista interativa nativa do W-API: o cliente vê só o TÍTULO de cada item
// (sem URL visível) e toca para abrir/copiar. Só funciona no provedor w_api. ──
async function enviarListaWapi(integ, telefone, titulo, descricao, itens) {
  const tel = (telefone || '').replace(/\D/g, '');
  const phone = tel.startsWith('55') ? tel : '55' + tel;
  const url = (integ.base_url_provider || 'https://api.w-api.app/v1')
    + `/message/send-option-list?instanceId=${integ.instance_id_provider}`;

  // Monta as seções da lista. Cada item vira uma opção com título limpo;
  // a URL/chave fica na descrição curta (o cliente toca para abrir/copiar).
  const rows = itens.map(i => ({
    title: `${i.emoji || '🔗'} ${i.titulo}`.slice(0, 24),
    description: i.tipo === 'pix' ? 'Toque para copiar a chave Pix' : 'Toque para abrir',
    rowId: i.tipo === 'pix' ? `acesso_pix:${i.id}` : `acesso_link:${i.id}`
  }));

  const body = {
    phone,
    title: titulo,
    description: descricao,
    buttonText: 'Ver opções',
    footer: 'NEURALTEC',
    sections: [{ title: 'Acessos rápidos', rows }],
    delayMessage: 1
  };

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${integ.api_key_provider}` },
    body: JSON.stringify(body)
  });
  const resp = await r.json().catch(() => ({}));
  const msgId = resp.messageId || resp.insertedId || resp.id || resp.key?.id || null;
  return { ok: r.ok && !!msgId && !resp.error, msgId, raw: resp };
}

// ============================================================================
// ACESSOS RÁPIDOS NEURALTEC — cartão compacto, itens lidos do cadastro
// ============================================================================
// Modos:
//  1. manual → atendente envia pelo chat (sem trava)
//  2. automacao → primeira mensagem inbound da conversa (1x por thread,
//     marcado em thread.campos_personalizados.acessos_rapidos_enviado)
// ============================================================================

Deno.serve(async (req) => {
  let etapa = 'inicio';
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const isAutomacao = !!body?.event;
    let threadId, contactId, integrationId, trigger;

    if (isAutomacao) {
      const msg = body.data;
      if (!msg || msg.sender_type !== 'contact' || msg.channel !== 'whatsapp') {
        return Response.json({ success: true, skipped: 'nao_inbound_whatsapp' });
      }
      threadId = msg.thread_id;
      contactId = msg.sender_id;
      trigger = 'auto_primeira_msg';
    } else {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      threadId = body.thread_id;
      contactId = body.contact_id;
      integrationId = body.integration_id || null;
      trigger = 'manual';
    }

    if (!threadId && !contactId) {
      return Response.json({ success: false, error: 'thread_id ou contact_id obrigatório' }, { status: 400 });
    }

    // ── Carregar thread + contato ──
    etapa = 'carregar_thread_contato';
    let thread = null;
    if (threadId) {
      thread = await base44.asServiceRole.entities.MessageThread.get(threadId).catch(() => null);
    }
    if (!contactId && thread?.contact_id) contactId = thread.contact_id;
    if (!contactId) return Response.json({ success: false, error: 'Contato não identificado' });

    if (!thread && contactId) {
      const threads = await base44.asServiceRole.entities.MessageThread.filter({
        contact_id: contactId, is_canonical: true
      });
      thread = threads[0] || null;
    }

    // ── Guard (modo automático) ──
    // Regra do cartão de visitas (simplificada):
    //  - Disparar SOMENTE em mensagens inbound (recebidas do contato) — já
    //    barrado no topo (sender_type !== 'contact' → skip).
    //  - Disparar SEMPRE que o texto for uma saudação (oi, olá, bom dia,
    //    boa tarde, boa noite, e aí, opa). SEM janela de horário/período e
    //    SEM trava de conversa ativa: toda saudação recebe o cartão.
    if (trigger === 'auto_primeira_msg') {
      const texto = String(body?.data?.content || '').toLowerCase().trim();
      const ehSaudacao = /(^|\b)(oi+|ol[aá]+|opa|bom\s*dia|boa\s*tarde|boa\s*noite|e\s*a[ií]|eai)(\b|$|[\s!.,?])/.test(texto);
      if (!ehSaudacao) {
        return Response.json({ success: true, skipped: 'nao_eh_saudacao' });
      }
    }

    etapa = 'carregar_contact';
    const contact = await base44.asServiceRole.entities.Contact.get(contactId).catch(() => null);
    if (!contact?.telefone) {
      return Response.json({ success: false, skipped: 'sem_telefone' });
    }

    if (trigger === 'auto_primeira_msg') {
      const tipo = String(contact.tipo_contato || '').toLowerCase();
      // Envia o cartão para leads, clientes, parceiros e contatos novos/eventuais.
      // Fornecedor segue excluído (não recebe cartão de visitas comercial).
      const tiposPermitidos = ['novo', 'lead', 'cliente', 'eventual', 'ex_cliente', 'parceiro'];
      if (tipo === 'fornecedor') {
        return Response.json({ success: true, skipped: 'tipo_contato_fornecedor' });
      }
      if (tipo && !tiposPermitidos.includes(tipo)) {
        return Response.json({ success: true, skipped: 'tipo_contato_nao_permitido', tipo });
      }
      if (contact.bloqueado) {
        return Response.json({ success: true, skipped: 'bloqueado' });
      }
    }

    // ── Itens do cadastro ──
    etapa = 'carregar_itens';
    console.log('[enviarCartaoAcesso] carregando itens AcessoRapido...');
    const itens = await base44.asServiceRole.entities.AcessoRapido.filter({ ativo: true }, 'ordem');
    console.log('[enviarCartaoAcesso] itens:', itens.length);
    if (!itens.length) {
      return Response.json({ success: false, error: 'Nenhum acesso rápido cadastrado' });
    }

    // ── Selecionar integração ──
    etapa = 'selecionar_integracao';
    let integration = null;
    if (integrationId) {
      integration = await base44.asServiceRole.entities.WhatsAppIntegration.get(integrationId).catch(() => null);
    }
    if (!integration) {
      const ints = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' });
      integration = (thread?.whatsapp_integration_id && ints.find(i => i.id === thread.whatsapp_integration_id)) || ints[0];
    }
    if (!integration) {
      return Response.json({ success: false, error: 'Nenhuma integração WhatsApp conectada' });
    }

    // ── Enviar cartão como TEXTO simples (links clicáveis) ──
    // A lista interativa nativa via invoke('enviarWhatsApp') retorna 403 e NUNCA
    // chega. O texto direto ao provedor é o único formato comprovadamente entregue.
    etapa = 'enviar_whatsapp';
    console.log('[enviarCartaoAcesso] enviando cartão (texto) via', integration.nome_instancia);

    // Formato "botão" limpo: emoji + nome em negrito, link discreto na linha de baixo.
    // Pix copia a chave; setores/links viram um toque ("👉 Toque para abrir").
    const linhas = itens.map(i => {
      const emoji = i.emoji || '🔗';
      if (i.tipo === 'pix') {
        return `${emoji} *${i.titulo}*\n     \`${i.url}\``;
      }
      return `${emoji} *${i.titulo}*\n     ↳ ${i.url}`;
    });
    const mensagemCartao = `*NEURALTEC — Acessos rápidos*\n_Toque em um link para abrir_\n\n${linhas.join('\n\n')}`;

    // W-API: tenta a lista interativa nativa (cliente vê só o título, sem URL).
    // Se a lista falhar, cai no texto. Z-API segue direto no texto.
    let resp;
    let formato = 'texto';
    if (integration.api_provider === 'w_api') {
      const respLista = await enviarListaWapi(
        integration,
        contact.telefone,
        'NEURALTEC — Acessos rápidos',
        'Selecione uma opção abaixo',
        itens
      );
      if (respLista.ok) {
        resp = respLista;
        formato = 'lista_interativa';
      }
    }
    if (!resp) {
      resp = await enviarTextoWhatsApp(integration, contact.telefone, mensagemCartao);
    }
    if (!resp.ok) {
      return Response.json({ success: false, error: 'erro_envio', detalhe: resp.raw });
    }

    // ── Persistir Message na thread ──
    const now = new Date().toISOString();
    if (thread) {
      await base44.asServiceRole.entities.Message.create({
        thread_id: thread.id,
        sender_id: 'system',
        sender_type: 'user',
        recipient_id: contact.id,
        recipient_type: 'contact',
        content: mensagemCartao,
        channel: 'whatsapp',
        status: 'enviada',
        whatsapp_message_id: resp.msgId,
        sent_at: now,
        metadata: {
          whatsapp_integration_id: integration.id,
          is_system_message: trigger !== 'manual',
          message_type: formato === 'lista_interativa' ? 'acessos_rapidos_lista' : 'acessos_rapidos_texto',
          formato,
          trigger
        }
      });

      // ── Marcar envio na thread (não repetir na conversa) ──
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        campos_personalizados: {
          ...(thread.campos_personalizados || {}),
          acessos_rapidos_enviado: true,
          acessos_rapidos_enviado_em: now
        }
      });
    }

    console.log(`[enviarCartaoAcesso] ✅ ${contact.nome} (trigger=${trigger}, itens=${itens.length})`);
    return Response.json({ success: true, message_id: resp.msgId, trigger });

  } catch (error) {
    console.error('[enviarCartaoAcesso] ❌ etapa=' + etapa, error.message);
    return Response.json({ success: false, error: error.message, etapa }, { status: 500 });
  }
});