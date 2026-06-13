import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ── Envio direto ao provedor (Z-API/W-API) — mesmo padrão do enviarCartaoAcesso ──
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

// ── Mapeia a escolha do cliente para uma categoria ──
// Aceita: texto "1".."4" OU rowId de lista interativa "acesso_menu:setores" etc.
function resolverCategoria(conteudo) {
  const t = String(conteudo || '').trim().toLowerCase();
  if (t.startsWith('acesso_menu:')) return t.split(':')[1];
  if (t === '1' || t.includes('setor')) return 'setores';
  if (t === '2' || t.includes('midia') || t.includes('mídia')) return 'midias';
  if (t === '3' || t.includes('promo')) return 'promocoes';
  if (t === '4' || t.includes('pix')) return 'pix';
  return null;
}

// ── Monta o submenu de uma categoria a partir dos itens do cadastro ──
function montarSubmenu(categoria, itens) {
  const porTitulo = (nomes) => itens.filter(i =>
    nomes.some(n => String(i.titulo || '').toLowerCase() === n)
  );

  if (categoria === 'setores') {
    const setores = itens.filter(i => i.tipo === 'setor');
    if (!setores.length) return null;
    const linhas = setores.map(i => `${i.emoji || '💬'} *${i.titulo}*\n${i.url}`);
    return `💬 *Setores NeuralTec*\n\n${linhas.join('\n\n')}`;
  }

  if (categoria === 'midias') {
    const midias = porTitulo(['site', 'instagram', 'linkedin']);
    if (!midias.length) return null;
    const linhas = midias.map(i => `${i.emoji || '🔗'} *${i.titulo}*\n${i.url}`);
    return `🌐 *Mídias NeuralTec*\n\n${linhas.join('\n\n')}`;
  }

  if (categoria === 'promocoes') {
    const promo = porTitulo(['promoções', 'promocoes'])[0];
    if (!promo) return null;
    return `🏷️ *Promoções NeuralTec*\n\nAcesse nossas promoções:\n${promo.url}`;
  }

  if (categoria === 'pix') {
    const pix = itens.find(i => i.tipo === 'pix');
    if (!pix) return null;
    return `⚡ *Pix NeuralTec*\n\nChave Pix (copie e cole):\n${pix.url}`;
  }

  return null;
}

// ============================================================================
// RESPONDER MENU ACESSO — Nível 2 do menu de Acessos Rápidos
// ============================================================================
// Roda como automação de entidade (Message create). Só age quando:
//  - a thread está com campos_personalizados.acesso_menu_aguardando = true
//  - dentro da janela (acesso_menu_aguardando_ate)
//  - o conteúdo é 1/2/3/4 OU um rowId "acesso_menu:<categoria>"
// Responde APENAS o submenu da categoria escolhida (não todos os links).
// ============================================================================

Deno.serve(async (req) => {
  let etapa = 'inicio';
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Suporta automação de entidade (body.event/body.data) e chamada direta
    const isAutomacao = !!body?.event;
    const msg = isAutomacao ? body.data : body;

    if (!msg) return Response.json({ success: true, skipped: 'sem_payload' });
    if (isAutomacao && (msg.sender_type !== 'contact' || msg.channel !== 'whatsapp')) {
      return Response.json({ success: true, skipped: 'nao_inbound_whatsapp' });
    }

    const threadId = msg.thread_id;
    if (!threadId) return Response.json({ success: true, skipped: 'sem_thread' });

    // ── Carregar thread e validar estado "aguardando menu" ──
    etapa = 'carregar_thread';
    const thread = await base44.asServiceRole.entities.MessageThread.get(threadId).catch(() => null);
    if (!thread) return Response.json({ success: true, skipped: 'thread_nao_encontrada' });

    const cp = thread.campos_personalizados || {};
    if (!cp.acesso_menu_aguardando) {
      return Response.json({ success: true, skipped: 'menu_nao_aguardando' });
    }
    if (cp.acesso_menu_aguardando_ate && new Date(cp.acesso_menu_aguardando_ate) < new Date()) {
      // Janela expirou — limpar flag e ignorar
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        campos_personalizados: { ...cp, acesso_menu_aguardando: false }
      });
      return Response.json({ success: true, skipped: 'menu_expirado' });
    }

    // ── Resolver categoria escolhida ──
    etapa = 'resolver_categoria';
    const categoria = resolverCategoria(msg.content);
    if (!categoria) {
      return Response.json({ success: true, skipped: 'escolha_nao_reconhecida' });
    }

    // ── Carregar itens do cadastro ──
    etapa = 'carregar_itens';
    const itens = await base44.asServiceRole.entities.AcessoRapido.filter({ ativo: true }, 'ordem');
    const textoResposta = montarSubmenu(categoria, itens);
    if (!textoResposta) {
      return Response.json({ success: true, skipped: 'submenu_vazio', categoria });
    }

    // ── Carregar contato ──
    etapa = 'carregar_contato';
    const contactId = thread.contact_id || msg.sender_id;
    const contato = await base44.asServiceRole.entities.Contact.get(contactId).catch(() => null);
    if (!contato?.telefone) {
      return Response.json({ success: false, error: 'contato_sem_telefone' });
    }

    // ── Selecionar integração ──
    etapa = 'selecionar_integracao';
    let integration = null;
    if (thread.whatsapp_integration_id) {
      integration = await base44.asServiceRole.entities.WhatsAppIntegration.get(thread.whatsapp_integration_id).catch(() => null);
    }
    if (!integration) {
      const ints = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' });
      integration = ints[0];
    }
    if (!integration) {
      return Response.json({ success: false, error: 'sem_integracao_conectada' });
    }

    // ── Enviar submenu ──
    etapa = 'enviar_whatsapp';
    const resp = await enviarTextoWhatsApp(integration, contato.telefone, textoResposta);
    if (!resp.ok) {
      return Response.json({ success: false, error: 'erro_envio', detalhe: resp.raw });
    }

    // ── Persistir + manter flag ativa (cliente pode pedir outra categoria) ──
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.Message.create({
      thread_id: thread.id,
      sender_id: 'system',
      sender_type: 'user',
      recipient_id: contato.id,
      recipient_type: 'contact',
      content: textoResposta,
      channel: 'whatsapp',
      status: 'enviada',
      whatsapp_message_id: resp.msgId,
      sent_at: now,
      metadata: {
        whatsapp_integration_id: integration.id,
        is_system_message: true,
        message_type: 'acessos_submenu',
        categoria
      }
    });

    console.log(`[responderMenuAcesso] ✅ submenu "${categoria}" → ${contato.nome}`);
    return Response.json({ success: true, message_id: resp.msgId, categoria });

  } catch (error) {
    console.error('[responderMenuAcesso] ❌ etapa=' + etapa, error.message);
    return Response.json({ success: false, error: error.message, etapa }, { status: 500 });
  }
});