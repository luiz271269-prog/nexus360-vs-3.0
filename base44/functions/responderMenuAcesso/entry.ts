import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ============================================================================
// RESPONDER MENU ACESSO — Níveis 2 e 3 do menu de Acessos Rápidos
// ============================================================================
// Roda como automação de entidade (Message create). Só age quando a thread
// está com campos_personalizados.acesso_menu_aguardando = true (dentro da janela).
//
// Estado de navegação guardado em campos_personalizados:
//   acesso_menu_nivel: 'principal' | 'setores' | 'midias'
// No nível 'principal' o cliente escolhe a categoria (1=Setores, 2=Mídias,
// 3=Promoções, 4=Pix). Setores e Mídias abrem um sub-submenu (nível 3);
// Promoções e Pix entregam o conteúdo final direto.
// ============================================================================

// ── Pix copia-e-cola (BR Code EMV estático) — inline (sem import local) ──
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

// ── Envio de texto direto ao provedor ──
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

// ── Envio de imagem (QR Code do Pix) ──
async function enviarImagemWhatsApp(integ, telefone, imageUrl, caption) {
  const tel = (telefone || '').replace(/\D/g, '');
  const phone = tel.startsWith('55') ? tel : '55' + tel;
  if (integ.api_provider === 'w_api') {
    const url = (integ.base_url_provider || 'https://api.w-api.app/v1')
      + `/message/send-image?instanceId=${integ.instance_id_provider}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${integ.api_key_provider}` },
      body: JSON.stringify({ phone, image: imageUrl, caption, delayMessage: 1 })
    });
    const resp = await r.json().catch(() => ({}));
    return { ok: r.ok && !resp.error, raw: resp };
  }
  const url = (integ.base_url_provider || 'https://api.z-api.io')
    + `/instances/${integ.instance_id_provider}/token/${integ.api_key_provider}/send-image`;
  const headers = { 'Content-Type': 'application/json' };
  if (integ.security_client_token_header) headers['Client-Token'] = integ.security_client_token_header;
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ phone, image: imageUrl, caption }) });
  const resp = await r.json().catch(() => ({}));
  return { ok: r.ok && !resp.error, raw: resp };
}

const NUM = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

// ── Agrupa itens em categorias ──
function agrupar(itens) {
  const g = { setores: [], midias: [], promocoes: [], pix: [] };
  for (const it of itens) {
    const tipo = String(it.tipo || 'link').toLowerCase();
    const t = String(it.titulo || '').toLowerCase();
    if (tipo === 'setor') g.setores.push(it);
    else if (tipo === 'pix') g.pix.push(it);
    else if (t.includes('site') || t.includes('promo') || t.includes('localiza')) {
      if (t.includes('promo')) g.promocoes.push(it);
      else g.midias.push(it); // Site, Localização ficam em Mídias
    } else g.midias.push(it); // Instagram, LinkedIn
  }
  return g;
}

// ── Interpreta a escolha (número, palavra OU id da lista W-API) dado o nível atual ──
// A W-API pode devolver o rowId ('acesso_menu:setores'), o título ('🏢 Setores') ou o texto.
function escolherCategoria(conteudo) {
  const t = String(conteudo || '')
    .trim()
    .toLowerCase()
    .replace('acesso_menu:', ''); // normaliza id da lista interativa
  if (t === '1' || t === 'setores' || t.includes('setor')) return 'setores';
  if (t === '2' || t === 'midias' || t.includes('midia') || t.includes('mídia')) return 'midias';
  if (t === '3' || t === 'promocoes' || t.includes('promo')) return 'promocoes';
  if (t === '4' || t === 'pix' || t.includes('pix')) return 'pix';
  return null;
}

Deno.serve(async (req) => {
  let etapa = 'inicio';
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const isAutomacao = !!body?.event;
    const msg = isAutomacao ? body.data : body;

    if (!msg) return Response.json({ success: true, skipped: 'sem_payload' });

    // Aceita resposta vinda de: invoke (resposta), chamada direta (content) ou automação (data.content)
    const respostaCliente = body?.resposta || body?.content || body?.data?.content || msg?.content || '';
    const threadId = body?.thread_id || msg?.thread_id;
    if (!threadId) return Response.json({ success: true, skipped: 'sem_thread' });

    // ── Carregar thread + validar estado do menu ──
    etapa = 'carregar_thread';
    const thread = await base44.asServiceRole.entities.MessageThread.get(threadId).catch(() => null);
    if (!thread) return Response.json({ success: true, skipped: 'thread_nao_encontrada' });

    const cp = thread.campos_personalizados || {};
    if (!cp.acesso_menu_nivel) {
      return Response.json({ success: true, skipped: 'menu_nao_aberto' });
    }
    // Timeout de 30min: menu antigo é limpo e ignorado
    if (cp.acesso_menu_updated_at && (Date.now() - new Date(cp.acesso_menu_updated_at).getTime()) > 30 * 60 * 1000) {
      await base44.asServiceRole.entities.MessageThread.update(thread.id, {
        campos_personalizados: { ...cp, acesso_menu_nivel: null }
      });
      return Response.json({ success: true, skipped: 'menu_expirado' });
    }

    // ── Carregar itens + contato + integração ──
    etapa = 'carregar_dados';
    const itens = await base44.asServiceRole.entities.AcessoRapido.filter({ ativo: true }, 'ordem');
    const grupos = agrupar(itens);

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

    const nivel = cp.acesso_menu_nivel || 'principal';
    const escolha = String(respostaCliente || '').trim();
    let textoResposta = null;
    let novoNivel = null; // se setado, mantém menu aguardando neste nível
    let enviarQrPix = false;

    // ── NÍVEL 2: dentro de Setores ou Mídias (escolha do item final) ──
    etapa = 'resolver_nivel';
    if (nivel === 'setores' || nivel === 'midias') {
      const lista = grupos[nivel];
      const idx = parseInt(escolha, 10) - 1;
      const item = (idx >= 0 && idx < lista.length) ? lista[idx]
        : lista.find(i => String(i.titulo || '').toLowerCase() === escolha.toLowerCase());
      if (!item) {
        // não reconheceu — reapresenta o submenu
        const linhas = lista.map((it, i) => `${NUM[i]} ${it.titulo}`);
        const tit = nivel === 'setores' ? '💬 *Setores NeuralTec*' : '🌐 *Mídias NeuralTec*';
        textoResposta = `${tit}\n\nNão entendi. Responda com o número:\n\n${linhas.join('\n')}`;
        novoNivel = nivel;
      } else {
        const emoji = item.emoji || (nivel === 'setores' ? '💬' : '🔗');
        textoResposta = `${emoji} *${item.titulo} NeuralTec*\n${item.url}`;
        // volta ao topo: cliente pode pedir outra categoria
        novoNivel = 'principal';
      }
    } else {
      // ── NÍVEL 1: escolha da categoria ──
      const categoria = escolherCategoria(escolha);
      if (!categoria) {
        return Response.json({ success: true, skipped: 'escolha_nao_reconhecida' });
      }

      if (categoria === 'setores' || categoria === 'midias') {
        const lista = grupos[categoria];
        if (!lista.length) return Response.json({ success: true, skipped: 'categoria_vazia', categoria });
        const linhas = lista.map((it, i) => `${NUM[i]} ${it.titulo}`);
        const tit = categoria === 'setores' ? '💬 *Setores NeuralTec*' : '🌐 *Mídias NeuralTec*';
        textoResposta = `${tit}\n\nResponda com o número:\n\n${linhas.join('\n')}`;
        novoNivel = categoria; // abre sub-submenu
      } else if (categoria === 'promocoes') {
        const p = grupos.promocoes[0] || grupos.midias.find(i => String(i.titulo).toLowerCase().includes('site'));
        if (!p) return Response.json({ success: true, skipped: 'sem_promocao' });
        textoResposta = `🏷️ *Promoções NeuralTec*\n\nAcesse nossas promoções:\n${p.url}`;
        novoNivel = 'principal';
      } else if (categoria === 'pix') {
        const pix = grupos.pix[0];
        if (!pix) return Response.json({ success: true, skipped: 'sem_pix' });
        // Texto SEMPRE primeiro (essencial). QR Code é opcional (best-effort).
        textoResposta = `⚡ *Pix NeuralTec*\n\nChave Pix (CNPJ):\n${pix.url}`;
        enviarQrPix = pix;
        novoNivel = 'principal';
      }
    }

    if (!textoResposta) return Response.json({ success: true, skipped: 'sem_resposta' });

    // ── Enviar texto ──
    etapa = 'enviar_texto';
    const resp = await enviarTextoWhatsApp(integration, contato.telefone, textoResposta);
    if (!resp.ok) return Response.json({ success: false, error: 'erro_envio', detalhe: resp.raw });

    // ── QR Code do Pix (OPCIONAL — best-effort, nunca quebra o atendimento) ──
    if (enviarQrPix) {
      etapa = 'enviar_qr_pix';
      try {
        const copiaCola = gerarPixCopiaECola(String(enviarQrPix.url).replace(/\D/g, ''));
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(copiaCola)}`;
        await enviarImagemWhatsApp(integration, contato.telefone, qrUrl, '⚡ Pix NeuralTec — escaneie para pagar');
      } catch (e) {
        console.warn('[responderMenuAcesso] QR Pix falhou (texto já enviado):', e.message);
      }
    }

    // ── Persistir + atualizar nível de navegação ──
    etapa = 'persistir';
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
        nivel_origem: nivel,
        nivel_novo: novoNivel
      }
    });

    // Campo único de estado: acesso_menu_nivel (+ timestamp para timeout de 30min)
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      campos_personalizados: {
        ...cp,
        acesso_menu_nivel: novoNivel || 'principal',
        acesso_menu_updated_at: now
      }
    });

    console.log(`[responderMenuAcesso] ✅ nivel=${nivel}→${novoNivel} → ${contato.nome}`);
    return Response.json({ success: true, message_id: resp.msgId, nivel, novoNivel });

  } catch (error) {
    console.error('[responderMenuAcesso] ❌ etapa=' + etapa, error.message);
    return Response.json({ success: false, error: error.message, etapa }, { status: 500 });
  }
});