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

// Texto/título/rodapé do PRIMEIRO menu (3 categorias).
const MENU_TITULO = 'NEURALTEC — Acessos rápidos';
const MENU_MENSAGEM = 'Escolha uma opção abaixo:';
const MENU_RODAPE = 'NEURALTEC';

// As 3 categorias do primeiro menu. O id (REPLAY) volta como escolha do
// cliente e é interpretado pelo responderMenuAcesso, que então entrega os
// sub-destinos APENAS da categoria escolhida.
const MENU_CATEGORIAS = [
  { id: 'acesso_menu:setores',   label: '🏢 Setores da Empresa' },
  { id: 'acesso_menu:promocoes', label: '🏷️ Promoções e Web Site' },
  { id: 'acesso_menu:redes',     label: '📱 Redes Sociais' }
];

// ── Primeiro menu: 3 botões de RESPOSTA (REPLAY). O cliente toca numa
// categoria e o responderMenuAcesso devolve só os sub-destinos dela. ──
async function enviarCategoriasWapi(integ, telefone) {
  const tel = (telefone || '').replace(/\D/g, '');
  const phone = tel.startsWith('55') ? tel : '55' + tel;
  const url = (integ.base_url_provider || 'https://api.w-api.app/v1')
    + `/message/send-button-actions?instanceId=${integ.instance_id_provider}`;
  const body = {
    phone,
    message: MENU_MENSAGEM,
    title: MENU_TITULO,
    footer: MENU_RODAPE,
    buttonActions: MENU_CATEGORIAS.map(c => ({ type: 'REPLAY', buttonText: c.label, id: c.id })),
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

async function enviarCategoriasZapi(integ, telefone) {
  const tel = (telefone || '').replace(/\D/g, '');
  const phone = tel.startsWith('55') ? tel : '55' + tel;
  const url = (integ.base_url_provider || 'https://api.z-api.io')
    + `/instances/${integ.instance_id_provider}/token/${integ.api_key_provider}/send-button-list`;
  const headers = { 'Content-Type': 'application/json' };
  if (integ.security_client_token_header) headers['Client-Token'] = integ.security_client_token_header;
  const body = {
    phone,
    message: `*${MENU_TITULO}*\n${MENU_MENSAGEM}`,
    buttonList: { buttons: MENU_CATEGORIAS.map(c => ({ id: c.id, label: c.label })) }
  };
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const rawText = await r.text().catch(() => '');
  let resp = {};
  try { resp = rawText ? JSON.parse(rawText) : {}; } catch { resp = {}; }
  const msgId = resp.messageId || resp.id || resp.key?.id || null;
  return { ok: r.ok && !!msgId && !resp.error, msgId, raw: resp, httpStatus: r.status, rawText };
}

// ── Fallback texto: menu numérico de 3 categorias ──
function montarMenuNumerico() {
  return `⚡ *${MENU_TITULO}*\n${MENU_MENSAGEM}\n\n1️⃣ Setores da Empresa\n2️⃣ Promoções e Web Site\n3️⃣ Redes Sociais`;
}

// ============================================================================
// ACESSOS RÁPIDOS NEURALTEC — PRIMEIRO MENU (3 CATEGORIAS)
// ============================================================================
// A saudação envia o PRIMEIRO menu com 3 categorias (Setores, Promoções e
// Web Site, Redes Sociais). Só DEPOIS da escolha do cliente o
// responderMenuAcesso entrega os sub-destinos daquela categoria.
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
    } else if (body?.source === 'skill_saudacao') {
      // Disparo automático vindo do skillPreAtendimentos (saudação pura). Roda
      // como serviço (sem auth de usuário) e aplica o guard temporal de 30min,
      // igual ao trigger automático — evita reenvio em rajada.
      threadId = body.thread_id;
      contactId = body.contact_id;
      integrationId = body.integration_id || null;
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
    // Quando vem da skill (source=skill_saudacao) a saudação já foi confirmada
    // lá — não há body.data para reavaliar, então pula este check.
    if (trigger === 'auto_primeira_msg' && body?.source !== 'skill_saudacao') {
      const texto = String(body?.data?.content || '').toLowerCase().trim();
      const ehSaudacao = /(^|\b)(oi+|ol[aá]+|opa|bom\s*dia|boa\s*tarde|boa\s*noite|e\s*a[ií]|eai)(\b|$|[\s!.,?])/.test(texto);
      if (!ehSaudacao) {
        return Response.json({ success: true, skipped: 'nao_eh_saudacao' });
      }
    }

    // ── Guard ANTI-REENVIO TEMPORAL (30 min): o menu principal não reenvia em
    // rajada. Cada toque numa categoria (ou saudações em sequência em poucos
    // minutos) NÃO reenvia o card "Escolha uma opção abaixo". Mas uma saudação
    // nova passados 30 min volta a trazer o menu junto — que é o comportamento
    // desejado ("toda saudação vem com o menu"). Modo manual é isento.
    // Janela curta em vez de flag permanente: o booleano travava o menu para
    // sempre depois do 1º envio.
    if (trigger === 'auto_primeira_msg') {
      const enviadoEm = thread?.campos_personalizados?.acessos_rapidos_enviado_em;
      const MENU_REENVIO_GAP_MS = 30 * 60 * 1000; // 30 min
      if (enviadoEm && (Date.now() - new Date(enviadoEm).getTime() < MENU_REENVIO_GAP_MS)) {
        return Response.json({ success: true, skipped: 'menu_enviado_recentemente_30min' });
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

    // ── Enviar PRIMEIRO menu: 3 categorias (botões de resposta) ──
    // W-API/Z-API: botões nativos → fallback menu numérico em texto.
    etapa = 'enviar_categorias';
    const menuNumerico = montarMenuNumerico();
    let formato = 'botoes_categorias';
    let resp = integration.api_provider === 'w_api'
      ? await enviarCategoriasWapi(integration, contact.telefone)
      : await enviarCategoriasZapi(integration, contact.telefone);
    console.log(`[enviarCartaoAcesso] 🔎 ${integration.api_provider} categorias →`, JSON.stringify({ ok: resp.ok, httpStatus: resp.httpStatus, rawText: resp.rawText }));

    if (!resp.ok) {
      formato = 'menu_numerico';
      resp = await enviarTextoWhatsApp(integration, contact.telefone, menuNumerico);
      if (!resp.ok) {
        return Response.json({ success: false, error: 'erro_envio', detalhe: resp.raw });
      }
    }

    // ── Persistir Message + marcar thread aguardando escolha da categoria ──
    const now = new Date().toISOString();
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

      // Estado do menu: nível 'principal' aguardando a escolha da categoria.
      // O responderMenuAcesso lê acesso_menu_nivel para entregar o submenu.
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        campos_personalizados: {
          ...(thread.campos_personalizados || {}),
          acesso_menu_nivel: 'principal',
          acesso_menu_updated_at: now,
          acessos_rapidos_enviado: true,
          acessos_rapidos_enviado_em: now
        }
      });
    }

    console.log(`[enviarCartaoAcesso] ✅ menu categorias (${formato}) → ${contact.nome} (trigger=${trigger})`);
    return Response.json({ success: true, message_id: resp.msgId, formato, trigger });

  } catch (error) {
    console.error('[enviarCartaoAcesso] ❌ etapa=' + etapa, error.message);
    return Response.json({ success: false, error: error.message, etapa }, { status: 500 });
  }
});