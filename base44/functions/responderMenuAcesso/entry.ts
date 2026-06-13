import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ── Envio de TEXTO ao provedor (Z-API/W-API) ──
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

// ── Envio de IMAGEM (QR Code) ao provedor ──
async function enviarImagemWhatsApp(integ, telefone, imageUrl, caption) {
  const tel = (telefone || '').replace(/\D/g, '');
  const phone = tel.startsWith('55') ? tel : '55' + tel;

  if (integ.api_provider === 'w_api') {
    const url = (integ.base_url_provider || 'https://api.w-api.app/v1')
      + `/message/send-image?instanceId=${integ.instance_id_provider}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${integ.api_key_provider}` },
      body: JSON.stringify({ phone, image: imageUrl, caption: caption || '', delayMessage: 1 })
    });
    const resp = await r.json().catch(() => ({}));
    const msgId = resp.messageId || resp.insertedId || resp.id || resp.key?.id || null;
    return { ok: r.ok && !!msgId && !resp.error, msgId, raw: resp };
  }
  const url = (integ.base_url_provider || 'https://api.z-api.io')
    + `/instances/${integ.instance_id_provider}/token/${integ.api_key_provider}/send-image`;
  const headers = { 'Content-Type': 'application/json' };
  if (integ.security_client_token_header) headers['Client-Token'] = integ.security_client_token_header;
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ phone, image: imageUrl, caption: caption || '' }) });
  const resp = await r.json().catch(() => ({}));
  const msgId = resp.messageId || resp.key?.id || resp.id || null;
  return { ok: r.ok && !!msgId && !resp.error, msgId, raw: resp };
}

// ── BR Code Pix (copia e cola) — inline (funções backend não importam arquivos locais) ──
function emv(id, value) {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}
function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function gerarPixCopiaECola(chave) {
  const merchant = emv('26', emv('00', 'br.gov.bcb.pix') + emv('01', chave));
  const payload = emv('00', '01') + merchant + emv('52', '0000') + emv('53', '986')
    + emv('58', 'BR') + emv('59', 'NEURALTEC') + emv('60', 'FLORIANOPOLIS')
    + emv('62', emv('05', '***')) + '6304';
  return payload + crc16(payload);
}

// ── Categoria escolhida no menu principal ──
function resolverCategoria(conteudo) {
  const t = String(conteudo || '').trim().toLowerCase();
  if (t.startsWith('acesso_menu:')) return t.split(':')[1];
  if (t === '1' || t.includes('setor')) return 'setores';
  if (t === '2' || t.includes('midia') || t.includes('mídia')) return 'midias';
  if (t === '3' || t.includes('promo')) return 'promocoes';
  if (t === '4' || t.includes('pix')) return 'pix';
  return null;
}

// ── Submenu de Setores (nível 2): lista numerada ──
function montarSubmenuSetores(setores) {
  if (!setores.length) return null;
  const linhas = setores.map((i, idx) => `${idx + 1}️⃣ ${i.titulo}`);
  return `💬 *Setores NeuralTec*\n\nEscolha o setor:\n\n${linhas.join('\n')}`;
}

// ── Submenu de Mídias (nível 2): lista numerada ──
function montarSubmenuMidias(midias) {
  if (!midias.length) return null;
  const linhas = midias.map((i, idx) => `${idx + 1}️⃣ ${i.titulo}`);
  return `🌐 *Mídias NeuralTec*\n\nEscolha uma opção:\n\n${linhas.join('\n')}`;
}

// ============================================================================
// RESPONDER MENU ACESSO — Níveis 2 e 3 do menu de Acessos Rápidos
// ============================================================================
// Estado na thread (campos_personalizados):
//   acesso_menu_aguardando      = aguardando categoria (1/2/3/4)
//   acesso_menu_sub             = 'setores' | 'midias' (aguardando item específico)
// Fluxo:
//   1) cliente escolhe categoria → Setores/Mídias mostram submenu numerado;
//      Promoções/Pix entregam direto (Pix manda QR Code).
//   2) se estava em submenu (setores/midias) → entrega o link do item escolhido.
// ============================================================================

Deno.serve(async (req) => {
  let etapa = 'inicio';
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const isAutomacao = !!body?.event;
    const msg = isAutomacao ? body.data : body;
    if (!msg) return Response.json({ success: true, skipped: 'sem_payload' });
    if (isAutomacao && (msg.sender_type !== 'contact' || msg.channel !== 'whatsapp')) {
      return Response.json({ success: true, skipped: 'nao_inbound_whatsapp' });
    }

    const threadId = msg.thread_id;
    if (!threadId) return Response.json({ success: true, skipped: 'sem_thread' });

    // ── Carregar thread e validar estado ──
    etapa = 'carregar_thread';
    const thread = await base44.asServiceRole.entities.MessageThread.get(threadId).catch(() => null);
    if (!thread) return Response.json({ success: true, skipped: 'thread_nao_encontrada' });

    const cp = thread.campos_personalizados || {};
    const emSubmenu = cp.acesso_menu_sub === 'setores' || cp.acesso_menu_sub === 'midias';
    if (!cp.acesso_menu_aguardando && !emSubmenu) {
      return Response.json({ success: true, skipped: 'menu_nao_aguardando' });
    }
    if (cp.acesso_menu_aguardando_ate && new Date(cp.acesso_menu_aguardando_ate) < new Date()) {
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        campos_personalizados: { ...cp, acesso_menu_aguardando: false, acesso_menu_sub: null }
      });
      return Response.json({ success: true, skipped: 'menu_expirado' });
    }

    // ── Carregar itens, contato e integração (comum a todos os caminhos) ──
    etapa = 'carregar_dados';
    const itens = await base44.asServiceRole.entities.AcessoRapido.filter({ ativo: true }, 'ordem');
    const setores = itens.filter(i => i.tipo === 'setor');
    const midiaTitulos = ['site', 'instagram', 'linkedin', 'localização', 'localizacao'];
    const midias = itens.filter(i => i.tipo === 'link' && midiaTitulos.includes(String(i.titulo).toLowerCase()) && String(i.titulo).toLowerCase() !== 'promoções' && String(i.titulo).toLowerCase() !== 'promocoes');

    const contactId = thread.contact_id || msg.sender_id;
    const contato = await base44.asServiceRole.entities.Contact.get(contactId).catch(() => null);
    if (!contato?.telefone) return Response.json({ success: false, error: 'contato_sem_telefone' });

    let integration = null;
    if (thread.whatsapp_integration_id) {
      integration = await base44.asServiceRole.entities.WhatsAppIntegration.get(thread.whatsapp_integration_id).catch(() => null);
    }
    if (!integration) {
      const ints = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' });
      integration = ints[0];
    }
    if (!integration) return Response.json({ success: false, error: 'sem_integracao_conectada' });

    const escolhaNum = parseInt(String(msg.content || '').trim(), 10);
    const now = new Date().toISOString();

    const persistir = async (texto, msgId, meta) => {
      await base44.asServiceRole.entities.Message.create({
        thread_id: thread.id, sender_id: 'system', sender_type: 'user',
        recipient_id: contato.id, recipient_type: 'contact',
        content: texto, channel: 'whatsapp', status: 'enviada',
        whatsapp_message_id: msgId, sent_at: now,
        metadata: { whatsapp_integration_id: integration.id, is_system_message: true, ...meta }
      });
    };

    // ========================================================================
    // NÍVEL 3 — cliente estava num submenu (setores/midias) e escolheu o item
    // ========================================================================
    if (emSubmenu) {
      etapa = 'nivel3_item';
      const lista = cp.acesso_menu_sub === 'setores' ? setores : midias;
      const item = (!isNaN(escolhaNum) && escolhaNum >= 1 && escolhaNum <= lista.length) ? lista[escolhaNum - 1] : null;
      if (!item) {
        return Response.json({ success: true, skipped: 'item_invalido' });
      }
      const texto = `${item.emoji || '🔗'} *${item.titulo} NeuralTec*\n${item.url}`;
      const resp = await enviarTextoWhatsApp(integration, contato.telefone, texto);
      if (!resp.ok) return Response.json({ success: false, error: 'erro_envio', detalhe: resp.raw });
      await persistir(texto, resp.msgId, { message_type: 'acessos_item', categoria: cp.acesso_menu_sub, item: item.titulo });
      // Fechar o fluxo
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        campos_personalizados: { ...cp, acesso_menu_aguardando: false, acesso_menu_sub: null }
      });
      console.log(`[responderMenuAcesso] ✅ item "${item.titulo}" entregue`);
      return Response.json({ success: true, item: item.titulo });
    }

    // ========================================================================
    // NÍVEL 2 — cliente escolheu a categoria no menu principal
    // ========================================================================
    etapa = 'nivel2_categoria';
    const categoria = resolverCategoria(msg.content);
    if (!categoria) return Response.json({ success: true, skipped: 'escolha_nao_reconhecida' });

    // Setores → mostra submenu numerado e marca acesso_menu_sub
    if (categoria === 'setores') {
      const texto = montarSubmenuSetores(setores);
      if (!texto) return Response.json({ success: true, skipped: 'sem_setores' });
      const resp = await enviarTextoWhatsApp(integration, contato.telefone, texto);
      if (!resp.ok) return Response.json({ success: false, error: 'erro_envio', detalhe: resp.raw });
      await persistir(texto, resp.msgId, { message_type: 'acessos_submenu', categoria: 'setores' });
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        campos_personalizados: { ...cp, acesso_menu_aguardando: false, acesso_menu_sub: 'setores' }
      });
      return Response.json({ success: true, categoria: 'setores', nivel: 'submenu' });
    }

    // Mídias → mostra submenu numerado e marca acesso_menu_sub
    if (categoria === 'midias') {
      const texto = montarSubmenuMidias(midias);
      if (!texto) return Response.json({ success: true, skipped: 'sem_midias' });
      const resp = await enviarTextoWhatsApp(integration, contato.telefone, texto);
      if (!resp.ok) return Response.json({ success: false, error: 'erro_envio', detalhe: resp.raw });
      await persistir(texto, resp.msgId, { message_type: 'acessos_submenu', categoria: 'midias' });
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        campos_personalizados: { ...cp, acesso_menu_aguardando: false, acesso_menu_sub: 'midias' }
      });
      return Response.json({ success: true, categoria: 'midias', nivel: 'submenu' });
    }

    // Promoções → entrega direto o link
    if (categoria === 'promocoes') {
      const promo = itens.find(i => ['promoções', 'promocoes'].includes(String(i.titulo).toLowerCase()));
      const url = promo?.url || 'https://www.neuraltec360.com.br';
      const texto = `🏷️ *Promoções NeuralTec*\n\nAcesse nossas promoções:\n${url}`;
      const resp = await enviarTextoWhatsApp(integration, contato.telefone, texto);
      if (!resp.ok) return Response.json({ success: false, error: 'erro_envio', detalhe: resp.raw });
      await persistir(texto, resp.msgId, { message_type: 'acessos_item', categoria: 'promocoes' });
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        campos_personalizados: { ...cp, acesso_menu_aguardando: false, acesso_menu_sub: null }
      });
      return Response.json({ success: true, categoria: 'promocoes' });
    }

    // Pix → entrega chave + QR Code (imagem)
    if (categoria === 'pix') {
      etapa = 'pix';
      const pix = itens.find(i => i.tipo === 'pix');
      const chave = pix?.url || '62.982.374/0001-07';
      const brcode = gerarPixCopiaECola(chave.replace(/\D/g, ''));
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(brcode)}`;
      const caption = `⚡ *Pix NeuralTec*\n\nChave Pix (CNPJ):\n${chave}\n\nOu escaneie o QR Code acima. 📲`;

      const resp = await enviarImagemWhatsApp(integration, contato.telefone, qrUrl, caption);
      if (!resp.ok) {
        // Fallback: se a imagem falhar, manda ao menos o texto
        const respTxt = await enviarTextoWhatsApp(integration, contato.telefone, `⚡ *Pix NeuralTec*\n\n${chave}`);
        if (!respTxt.ok) return Response.json({ success: false, error: 'erro_envio', detalhe: resp.raw });
        await persistir(`Pix: ${chave}`, respTxt.msgId, { message_type: 'acessos_item', categoria: 'pix', qr_falhou: true });
      } else {
        await persistir(caption, resp.msgId, { message_type: 'acessos_item', categoria: 'pix', qr_code: true });
      }
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        campos_personalizados: { ...cp, acesso_menu_aguardando: false, acesso_menu_sub: null }
      });
      return Response.json({ success: true, categoria: 'pix' });
    }

    return Response.json({ success: true, skipped: 'categoria_nao_tratada', categoria });

  } catch (error) {
    console.error('[responderMenuAcesso] ❌ etapa=' + etapa, error.message);
    return Response.json({ success: false, error: error.message, etapa }, { status: 500 });
  }
});