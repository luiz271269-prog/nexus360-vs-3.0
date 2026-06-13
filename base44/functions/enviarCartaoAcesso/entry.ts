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

// ── Lista interativa nativa do W-API: o cliente vê só as 4 CATEGORIAS
// (sem URL, sem lista gigante) e toca para abrir o submenu. Só funciona no w_api. ──
async function enviarListaCategoriasWapi(integ, telefone) {
  const tel = (telefone || '').replace(/\D/g, '');
  const phone = tel.startsWith('55') ? tel : '55' + tel;
  const url = (integ.base_url_provider || 'https://api.w-api.app/v1')
    + `/message/send-option-list?instanceId=${integ.instance_id_provider}`;

  const rows = [
    { title: '🏢 Setores',   description: 'Vendas, Assistência, Financeiro, Compras', rowId: 'acesso_menu:setores' },
    { title: '📱 Mídias',    description: 'Site, Instagram, LinkedIn',                 rowId: 'acesso_menu:midias' },
    { title: '🏷️ Promoções', description: 'Nossas promoções atuais',                   rowId: 'acesso_menu:promocoes' },
    { title: '⚡ Pix',        description: 'Chave Pix para pagamento',                  rowId: 'acesso_menu:pix' }
  ];

  const body = {
    phone,
    title: 'NEURALTEC — Acessos rápidos',
    description: 'Como podemos te ajudar? Escolha uma opção.',
    buttonText: 'Ver opções',
    footer: 'NEURALTEC',
    sections: [{ title: 'Categorias', rows }],
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

// ── Menu numérico curto (fallback universal Z-API e W-API) ──
function montarMenuNumerico() {
  return `⚡ *NEURALTEC — Acessos rápidos*\n\nEscolha uma opção digitando o número:\n\n1️⃣ Setores\n2️⃣ Mídias\n3️⃣ Promoções\n4️⃣ Pix`;
}

// ============================================================================
// ACESSOS RÁPIDOS NEURALTEC — MENU EM 3 NÍVEIS
// ============================================================================
// Nível 1 (este arquivo): saudação → menu CURTO de 4 categorias.
//   W-API: lista interativa nativa (4 categorias) → fallback menu numérico.
//   Z-API: menu numérico direto.
//   NÃO envia mais a lista gigante com todos os links abertos.
// Nível 2 (responderMenuAcesso): cliente escolhe categoria → recebe submenu.
//
// Modos:
//  1. manual → atendente envia pelo chat (sem trava)
//  2. automacao → primeira saudação inbound da conversa
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

    // ── Guard (modo automático): só dispara em SAUDAÇÃO ──
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

    // ── Enviar MENU CURTO (4 categorias) ──
    // W-API: tenta lista interativa nativa → fallback menu numérico.
    // Z-API: menu numérico direto.
    etapa = 'enviar_menu';
    const menuNumerico = montarMenuNumerico();
    let resp;
    let formato = 'menu_numerico';

    if (integration.api_provider === 'w_api') {
      const respLista = await enviarListaCategoriasWapi(integration, contact.telefone);
      if (respLista.ok) {
        resp = respLista;
        formato = 'lista_categorias';
      }
    }
    if (!resp) {
      resp = await enviarTextoWhatsApp(integration, contact.telefone, menuNumerico);
    }
    if (!resp.ok) {
      return Response.json({ success: false, error: 'erro_envio', detalhe: resp.raw });
    }

    // ── Persistir Message + marcar thread aguardando escolha ──
    const now = new Date().toISOString();
    const expira = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
    if (thread) {
      await base44.asServiceRole.entities.Message.create({
        thread_id: thread.id,
        sender_id: 'system',
        sender_type: 'user',
        recipient_id: contact.id,
        recipient_type: 'contact',
        content: menuNumerico,
        channel: 'whatsapp',
        status: 'enviada',
        whatsapp_message_id: resp.msgId,
        sent_at: now,
        metadata: {
          whatsapp_integration_id: integration.id,
          is_system_message: trigger !== 'manual',
          message_type: 'acessos_menu_categorias',
          formato,
          trigger
        }
      });

      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        campos_personalizados: {
          ...(thread.campos_personalizados || {}),
          acesso_menu_aguardando: true,
          acesso_menu_aguardando_ate: expira,
          acessos_rapidos_enviado: true,
          acessos_rapidos_enviado_em: now
        }
      });
    }

    console.log(`[enviarCartaoAcesso] ✅ menu (${formato}) → ${contact.nome} (trigger=${trigger})`);
    return Response.json({ success: true, message_id: resp.msgId, formato, trigger });

  } catch (error) {
    console.error('[enviarCartaoAcesso] ❌ etapa=' + etapa, error.message);
    return Response.json({ success: false, error: error.message, etapa }, { status: 500 });
  }
});