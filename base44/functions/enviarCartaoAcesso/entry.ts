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

// Texto/título/rodapé compartilhado pelos botões dos dois provedores.
const MENU_TITULO = 'NEURALTEC — Acessos rápidos';
const MENU_MENSAGEM = 'Toque em uma opção para abrir direto:';
const MENU_RODAPE = 'NEURALTEC';

// ── Botões de URL embutidos: cada destino abre o link DIRETO ao toque,
// sem mensagem intermediária e sem responderMenuAcesso. ──
// titulos/links espelham os AcessoRapido cadastrados (Pix e LinkedIn de fora).
async function enviarBotoesUrlWapi(integ, telefone, titulo, mensagem, botoes, rodape) {
  const tel = (telefone || '').replace(/\D/g, '');
  const phone = tel.startsWith('55') ? tel : '55' + tel;
  const url = (integ.base_url_provider || 'https://api.w-api.app/v1')
    + `/message/send-button-actions?instanceId=${integ.instance_id_provider}`;
  const body = {
    phone,
    message: mensagem,
    title: titulo,
    footer: rodape || MENU_RODAPE,
    buttonActions: botoes.map(b => ({ type: 'URL', buttonText: b.buttonText, url: b.url })),
    delayMessage: 1
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${integ.api_key_provider}` },
    body: JSON.stringify(body)
  });
  const rawText = await r.text().catch(() => '');
  let resp = {};
  try { resp = rawText ? JSON.parse(rawText) : {}; } catch { resp = {}; }
  const msgId = resp.messageId || resp.insertedId || resp.id || resp.key?.id || null;
  return { ok: r.ok && !!msgId && !resp.error, msgId, raw: resp, httpStatus: r.status, rawText };
}

// ── Monta os botões de URL a partir dos AcessoRapido cadastrados.
// Cada item vira um botão que abre o link DIRETO ao toque. Exclui Pix
// (tipo=pix, envio manual). LinkedIn fica de fora (ainda não usado). ──
function montarBotoesUrl(acessos) {
  const ordemPreferida = ['Site', 'Promoções', 'Instagram', 'Vendas', 'Assistência', 'Financeiro', 'Compras'];
  const elegiveis = (acessos || [])
    .filter(a => a.tipo !== 'pix' && a.url && /^https?:\/\//i.test(a.url) && a.titulo !== 'LinkedIn')
    .sort((a, b) => {
      const ia = ordemPreferida.indexOf(a.titulo); const ib = ordemPreferida.indexOf(b.titulo);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  return elegiveis.map(a => ({
    buttonText: `${a.emoji ? a.emoji + ' ' : ''}${a.titulo}`.trim(),
    url: a.url
  }));
}

// ── Fallback texto com links clicáveis (se botões de URL falharem) ──
function montarTextoLinks(botoes) {
  const linhas = botoes.map(b => `${b.buttonText}: ${b.url}`);
  return `⚡ *${MENU_TITULO}*\n${MENU_MENSAGEM}\n\n${linhas.join('\n')}`;
}

// ============================================================================
// ACESSOS RÁPIDOS NEURALTEC — BOTÕES DE URL DIRETOS
// ============================================================================
// A saudação envia botões de URL: cada destino (Site, Promoções, Instagram,
// Vendas, Assistência, Financeiro, Compras) abre o link DIRETO ao toque.
// Sem menu numérico, sem lista interativa, sem responderMenuAcesso.
// Como o WhatsApp aceita até 3 botões de URL por card, os destinos são
// enviados em lotes de 3.
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

    // ── Montar botões de URL a partir dos AcessoRapido cadastrados ──
    etapa = 'montar_botoes';
    const acessos = await base44.asServiceRole.entities.AcessoRapido.filter({ ativo: true });
    const botoes = montarBotoesUrl(acessos);
    if (!botoes.length) {
      return Response.json({ success: false, error: 'sem_acessos_cadastrados' });
    }

    // ── Enviar botões de URL em lotes de 3 (limite do WhatsApp). W-API only;
    // Z-API não suporta botão de URL nativo → fallback texto com links. ──
    etapa = 'enviar_botoes';
    let formato = 'botoes_url';
    let primeiroMsgId = null;
    let algumOk = false;

    if (integration.api_provider === 'w_api') {
      for (let i = 0; i < botoes.length; i += 3) {
        const lote = botoes.slice(i, i + 3);
        const r = await enviarBotoesUrlWapi(integration, contact.telefone, MENU_TITULO, MENU_MENSAGEM, lote, MENU_RODAPE);
        console.log(`[enviarCartaoAcesso] 🔎 botões URL lote ${i / 3 + 1} →`, JSON.stringify({ ok: r.ok, httpStatus: r.httpStatus, rawText: r.rawText }));
        if (r.ok) { algumOk = true; if (!primeiroMsgId) primeiroMsgId = r.msgId; }
      }
    }

    // Fallback (Z-API ou botões falharam): texto com links clicáveis.
    if (!algumOk) {
      formato = 'texto_links';
      const respTexto = await enviarTextoWhatsApp(integration, contact.telefone, montarTextoLinks(botoes));
      if (!respTexto.ok) {
        return Response.json({ success: false, error: 'erro_envio', detalhe: respTexto.raw });
      }
      primeiroMsgId = respTexto.msgId;
    }

    // ── Persistir Message (sem estado de menu — não há mais navegação) ──
    const now = new Date().toISOString();
    if (thread) {
      await base44.asServiceRole.entities.Message.create({
        thread_id: thread.id,
        sender_id: 'system',
        sender_type: 'user',
        recipient_id: contact.id,
        recipient_type: 'contact',
        content: montarTextoLinks(botoes),
        channel: 'whatsapp',
        status: 'enviada',
        whatsapp_message_id: primeiroMsgId,
        sent_at: now,
        metadata: {
          whatsapp_integration_id: integration.id,
          is_system_message: trigger !== 'manual',
          message_type: 'acessos_botoes_url',
          formato,
          trigger
        }
      });

      // Limpa qualquer estado de menu antigo (não há mais responderMenuAcesso)
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        campos_personalizados: {
          ...(thread.campos_personalizados || {}),
          acesso_menu_nivel: null,
          acesso_menu_aguardando: false,
          acessos_rapidos_enviado: true,
          acessos_rapidos_enviado_em: now
        }
      });
    }

    console.log(`[enviarCartaoAcesso] ✅ botões URL (${formato}) → ${contact.nome} (trigger=${trigger})`);
    return Response.json({ success: true, message_id: primeiroMsgId, formato, trigger });

  } catch (error) {
    console.error('[enviarCartaoAcesso] ❌ etapa=' + etapa, error.message);
    return Response.json({ success: false, error: error.message, etapa }, { status: 500 });
  }
});