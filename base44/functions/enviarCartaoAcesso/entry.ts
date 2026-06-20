import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ============================================================================
// ENVIAR CARTÃO ACESSO — FONTE ÚNICA do menu de Acessos Rápidos NeuralTec
// ============================================================================
// Esta é a ÚNICA função que monta e envia o menu de Acessos Rápidos (cartão de
// visita). Centraliza os 2 estágios via parâmetro `acao`:
//
//   acao: 'menu'    (default) → cartão 1 com 3 CATEGORIAS em formato RESPOSTA ↩
//                               (lista/botão de resposta — o toque devolve a
//                                escolha ao sistema, que abre o submenu).
//   acao: 'submenu' + resposta → destinos da categoria escolhida em BOTÕES DE
//                               URL EMBUTIDA ↗ (o toque abre o link direto, sem
//                               URL escrita e SEM mensagem de confirmação).
//
// Pix NÃO faz parte deste menu — é enviado por ação manual do atendente
// (enviarPixChat, no menu de anexos). Aqui o tipo 'pix' é sempre ignorado.
//
// Gatilhos do 'menu':
//   1. manual          → atendente envia pelo chat (sem trava)
//   2. auto_primeira_msg → saudação inbound (guard temporal de 30min)
// ============================================================================

// ── Envio direto ao provedor (Z-API/W-API). NÃO usar invoke('enviarWhatsApp')
// server-to-server: esse hop retorna 403 Forbidden e a mensagem NUNCA chega. ──
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

// ============================================================================
// ESTÁGIO 1 — CARTÃO DE 3 CATEGORIAS (formato RESPOSTA ↩)
// ============================================================================
const MENU_TITULO = 'NEURALTEC — Acessos rápidos';
const MENU_MENSAGEM = 'Escolha uma opção abaixo:';
const MENU_RODAPE = 'NEURALTEC';

const MENU_CATEGORIAS = [
  { id: 'acesso_menu:setores',   label: '🏢 Setores da Empresa' },
  { id: 'acesso_menu:promocoes', label: '🏷️ Promoções e Web Site' },
  { id: 'acesso_menu:redes',     label: '📱 Redes Sociais' }
];

// Cartão 1: LISTA INTERATIVA (send-list). O reply de lista devolve só o título
// da linha — sem o eco verde duplicado que o botão REPLAY causava.
async function enviarCategoriasWapi(integ, telefone) {
  const tel = (telefone || '').replace(/\D/g, '');
  const phone = tel.startsWith('55') ? tel : '55' + tel;
  const url = (integ.base_url_provider || 'https://api.w-api.app/v1')
    + `/message/send-list?instanceId=${integ.instance_id_provider}`;
  const body = {
    phone,
    title: MENU_TITULO,
    description: MENU_MENSAGEM,
    buttonText: 'Ver opções',
    footer: MENU_RODAPE,
    sections: [{
      title: 'Categorias',
      rows: MENU_CATEGORIAS.map(c => ({ rowId: c.id, title: c.label, description: ' ' }))
    }],
    delayMessage: 1
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${integ.api_key_provider}` },
    body: JSON.stringify(body)
  });
  const rawText = await r.text().catch(() => '');
  let resp = {}; try { resp = rawText ? JSON.parse(rawText) : {}; } catch { resp = {}; }
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
  let resp = {}; try { resp = rawText ? JSON.parse(rawText) : {}; } catch { resp = {}; }
  const msgId = resp.messageId || resp.id || resp.key?.id || null;
  return { ok: r.ok && !!msgId && !resp.error, msgId, raw: resp, httpStatus: r.status, rawText };
}

function montarMenuNumerico() {
  return `⚡ *${MENU_TITULO}*\n${MENU_MENSAGEM}\n\n1️⃣ Setores da Empresa\n2️⃣ Promoções e Web Site\n3️⃣ Redes Sociais`;
}

// ============================================================================
// ESTÁGIO 2 — DESTINOS DA CATEGORIA (formato BOTÕES DE URL ↗)
// ============================================================================
// Botões com URL EMBUTIDA invisível: o cliente toca e o navegador abre direto,
// o link NÃO aparece escrito e NÃO há mensagem de confirmação no chat.
// botoes: [{ buttonText, url }]
async function enviarBotoesUrlWhatsApp(integ, telefone, titulo, mensagem, botoes, rodape) {
  const tel = (telefone || '').replace(/\D/g, '');
  const phone = tel.startsWith('55') ? tel : '55' + tel;

  if (integ.api_provider === 'w_api') {
    const url = (integ.base_url_provider || 'https://api.w-api.app/v1')
      + `/message/send-button-actions?instanceId=${integ.instance_id_provider}`;
    const body = {
      phone,
      message: mensagem,
      title: titulo,
      footer: rodape || 'NEURALTEC',
      buttonActions: botoes.map(b => ({ type: 'URL', buttonText: b.buttonText, url: b.url })),
      delayMessage: 1
    };
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${integ.api_key_provider}` },
      body: JSON.stringify(body)
    });
    const rawText = await r.text().catch(() => '');
    let resp = {}; try { resp = rawText ? JSON.parse(rawText) : {}; } catch { resp = {}; }
    const msgId = resp.messageId || resp.insertedId || resp.id || resp.key?.id || null;
    return { ok: r.ok && !!msgId && !resp.error, msgId, raw: resp, httpStatus: r.status, rawText };
  }

  const url = (integ.base_url_provider || 'https://api.z-api.io')
    + `/instances/${integ.instance_id_provider}/token/${integ.api_key_provider}/send-button-actions`;
  const headers = { 'Content-Type': 'application/json' };
  if (integ.security_client_token_header) headers['Client-Token'] = integ.security_client_token_header;
  const body = {
    phone,
    message: `*${titulo}*\n${mensagem}`,
    buttonActions: botoes.map((b, i) => ({ id: String(i + 1), type: 'URL', label: b.buttonText, url: b.url }))
  };
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const rawText = await r.text().catch(() => '');
  let resp = {}; try { resp = rawText ? JSON.parse(rawText) : {}; } catch { resp = {}; }
  const msgId = resp.messageId || resp.id || resp.key?.id || null;
  return { ok: r.ok && !!msgId && !resp.error, msgId, raw: resp, httpStatus: r.status, rawText };
}

// ── Agrupa itens em 3 categorias: Setores / Promoções e Web Site / Redes Sociais ──
function agrupar(itens) {
  const g = { setores: [], promocoes: [], redes: [] };
  const ehRedeSocial = (t) =>
    t.includes('instagram') || t.includes('linkedin') || t.includes('facebook') ||
    t.includes('youtube') || t.includes('tiktok') || t.includes('twitter') ||
    t.includes('rede social') || t.includes('redes');
  for (const it of itens) {
    const tipo = String(it.tipo || 'link').toLowerCase();
    const t = String(it.titulo || '').toLowerCase();
    if (tipo === 'pix') continue; // Pix sai só por ação manual do atendente
    if (tipo === 'setor') g.setores.push(it);
    else if (ehRedeSocial(t)) g.redes.push(it);
    else g.promocoes.push(it); // Site, loja, promoções e localização
  }
  return g;
}

// ── Interpreta a escolha (número, palavra OU id da lista) ──
function escolherCategoria(conteudo) {
  const t = String(conteudo || '').trim().toLowerCase().replace('acesso_menu:', '');
  if (t === '1' || t === 'setores' || t.includes('setor')) return 'setores';
  if (t === '2' || t === 'promocoes' || t.includes('promo') || t.includes('site') || t.includes('web')) return 'promocoes';
  if (t === '3' || t === 'redes' || t.includes('rede') || t.includes('social') || t.includes('instagram')) return 'redes';
  return null;
}

// ── Resolver integração conectada (compartilhado pelos 2 estágios) ──
async function resolverIntegracao(base44, integrationId, thread) {
  let integration = null;
  if (integrationId) {
    integration = await base44.asServiceRole.entities.WhatsAppIntegration.get(integrationId).catch(() => null);
  }
  if (!integration) {
    const ints = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' });
    integration = (thread?.whatsapp_integration_id && ints.find(i => i.id === thread.whatsapp_integration_id)) || ints[0];
  }
  return integration;
}

// ============================================================================
// HANDLER ÚNICO
// ============================================================================
Deno.serve(async (req) => {
  let etapa = 'inicio';
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const acao = body?.acao || 'menu';

    // ════════════════════════════════════════════════════════════════
    // ESTÁGIO 2 — SUBMENU (destinos da categoria) em BOTÕES DE URL ↗
    // Chamado pelo processInbound quando o cliente escolhe uma categoria.
    // ════════════════════════════════════════════════════════════════
    if (acao === 'submenu') {
      etapa = 'submenu_carregar_thread';
      const threadId = body?.thread_id;
      const resposta = body?.resposta || body?.content || '';
      if (!threadId) return Response.json({ success: true, skipped: 'sem_thread' });

      const thread = await base44.asServiceRole.entities.MessageThread.get(threadId).catch(() => null);
      if (!thread) return Response.json({ success: true, skipped: 'thread_nao_encontrada' });

      const cp = thread.campos_personalizados || {};
      if (!cp.acesso_menu_nivel) return Response.json({ success: true, skipped: 'menu_nao_aberto' });

      // Timeout de 30min: menu antigo é limpo e ignorado
      if (cp.acesso_menu_updated_at && (Date.now() - new Date(cp.acesso_menu_updated_at).getTime()) > 30 * 60 * 1000) {
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          campos_personalizados: { ...cp, acesso_menu_nivel: null }
        });
        return Response.json({ success: true, skipped: 'menu_expirado' });
      }

      const escolha = String(resposta || '').trim();

      // ── TRAVA ANTI-DUPLICIDADE: mesmo clique reentregue em <15s é ignorado ──
      const chaveEscolha = `submenu:${escolha.toLowerCase()}`;
      if (cp.acesso_menu_last_choice === chaveEscolha && cp.acesso_menu_last_choice_at) {
        const idadeMs = Date.now() - new Date(cp.acesso_menu_last_choice_at).getTime();
        if (idadeMs < 15_000) {
          return Response.json({ success: true, skipped: 'duplicata_escolha', chave: chaveEscolha });
        }
      }
      cp.acesso_menu_last_choice = chaveEscolha;
      cp.acesso_menu_last_choice_at = new Date().toISOString();
      await base44.asServiceRole.entities.MessageThread.update(thread.id, { campos_personalizados: { ...cp } });

      etapa = 'submenu_resolver_categoria';
      const categoria = escolherCategoria(escolha);
      if (!categoria) return Response.json({ success: true, skipped: 'escolha_nao_reconhecida' });

      const itens = await base44.asServiceRole.entities.AcessoRapido.filter({ ativo: true }, 'ordem');
      const grupos = agrupar(itens);
      const lista = grupos[categoria];
      if (!lista || !lista.length) return Response.json({ success: true, skipped: 'categoria_vazia', categoria });

      const contactId = thread.contact_id;
      const contato = await base44.asServiceRole.entities.Contact.get(contactId).catch(() => null);
      if (!contato?.telefone) return Response.json({ success: false, error: 'contato_sem_telefone' });

      etapa = 'submenu_integracao';
      const integration = await resolverIntegracao(base44, body?.integration_id || thread.whatsapp_integration_id, thread);
      if (!integration) return Response.json({ success: false, error: 'sem_integracao_conectada' });

      const isRedes = categoria === 'redes';
      const isSetores = categoria === 'setores';
      const titulo = isRedes ? '📱 Redes Sociais'
        : isSetores ? '💬 Setores da Empresa'
        : '🏷️ Promoções e Web Site';
      const mensagem = isRedes ? 'Toque para acessar nossas redes:'
        : isSetores ? 'Toque no setor desejado:'
        : 'Toque para acessar:';

      // Redes: só Instagram ativo (Facebook/LinkedIn em breve)
      const itensDestino = isRedes
        ? lista.filter(it => String(it.titulo || '').toLowerCase().includes('instagram'))
        : lista;
      const rodape = isRedes ? '🔜 Facebook e LinkedIn em breve' : 'NEURALTEC';

      // Botões de URL ↗ (máx 3 por mensagem no WhatsApp interativo)
      const botoes = itensDestino.slice(0, 3).map(it => ({
        buttonText: String(it.titulo || '').slice(0, 24),
        url: it.url
      }));

      etapa = 'submenu_enviar_botoes';
      let formato = 'botoes_url';
      let resp = botoes.length
        ? await enviarBotoesUrlWhatsApp(integration, contato.telefone, titulo, mensagem, botoes, rodape)
        : { ok: false };
      console.log(`[enviarCartaoAcesso:submenu] 🔎 ${categoria} botões URL →`, JSON.stringify({ ok: resp.ok, httpStatus: resp.httpStatus, rawText: resp.rawText }));

      // Fallback: links clicáveis em texto
      if (!resp.ok) {
        formato = 'texto_links';
        const linhas = (itensDestino.length ? itensDestino : lista).map(it => `🔗 ${it.titulo}: ${it.url}`);
        const extra = isRedes ? `\n\n${rodape}` : '';
        const textoResposta = `*${titulo}*\n${mensagem}\n\n${linhas.join('\n')}${extra}`;
        resp = await enviarTextoWhatsApp(integration, contato.telefone, textoResposta);
        if (!resp.ok) return Response.json({ success: false, error: 'erro_envio', detalhe: resp.raw });
      }

      // Persiste Message + mantém nível principal (cliente pode tocar outra categoria)
      etapa = 'submenu_persistir';
      const now = new Date().toISOString();
      await base44.asServiceRole.entities.Message.create({
        thread_id: thread.id,
        sender_id: 'system',
        sender_type: 'user',
        recipient_id: contato.id,
        recipient_type: 'contact',
        content: `${titulo}`,
        channel: 'whatsapp',
        status: 'enviada',
        whatsapp_message_id: resp.msgId,
        sent_at: now,
        metadata: {
          whatsapp_integration_id: integration.id,
          is_system_message: true,
          message_type: 'acessos_submenu',
          categoria,
          formato
        }
      });
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        campos_personalizados: { ...cp, acesso_menu_nivel: 'principal', acesso_menu_updated_at: now }
      });

      console.log(`[enviarCartaoAcesso:submenu] ✅ ${categoria} (${formato}) → ${contato.nome}`);
      return Response.json({ success: true, message_id: resp.msgId, categoria, formato });
    }

    // ════════════════════════════════════════════════════════════════
    // ESTÁGIO 1 — CARTÃO DE CATEGORIAS (formato RESPOSTA ↩) — acao 'menu'
    // ════════════════════════════════════════════════════════════════
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
      threadId = body.thread_id;
      contactId = body.contact_id;
      integrationId = body.integration_id || null;
      trigger = 'auto_primeira_msg';
    } else if (body?.source === 'encaminhamento_manual') {
      // Encaminhamento manual do atendente (backend→backend, sem sessão):
      // trata como ação manual → ignora cooldown de 30min e guards de saudação.
      threadId = body.thread_id;
      contactId = body.contact_id;
      integrationId = body.integration_id || null;
      trigger = 'manual';
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
    if (trigger === 'auto_primeira_msg' && body?.source !== 'skill_saudacao') {
      const texto = String(body?.data?.content || '').toLowerCase().trim();
      const ehSaudacao = /(^|\b)(oi+|ol[aá]+|opa|bom\s*dia|boa\s*tarde|boa\s*noite|e\s*a[ií]|eai)(\b|$|[\s!.,?])/.test(texto);
      if (!ehSaudacao) {
        return Response.json({ success: true, skipped: 'nao_eh_saudacao' });
      }
    }

    // ── Guard ANTI-REENVIO TEMPORAL (30 min) ──
    if (trigger === 'auto_primeira_msg') {
      const enviadoEm = thread?.campos_personalizados?.acessos_rapidos_enviado_em;
      const MENU_REENVIO_GAP_MS = 30 * 60 * 1000;
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

    etapa = 'selecionar_integracao';
    const integration = await resolverIntegracao(base44, integrationId, thread);
    if (!integration) {
      return Response.json({ success: false, error: 'Nenhuma integração WhatsApp conectada' });
    }

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