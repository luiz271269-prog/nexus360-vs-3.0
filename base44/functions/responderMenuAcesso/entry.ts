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

// ── Botões de URL com link EMBUTIDO (W-API CALL_TO_ACTION / Z-API send-button-actions URL) ──
// O cliente toca no botão e o navegador abre direto — o link NÃO aparece escrito na tela.
// botoes: [{ buttonText, url }]  |  Retorna { ok, msgId, raw, httpStatus, rawText }
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

  // Z-API: send-button-actions com type URL
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

const NUM = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

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

// ── Interpreta a escolha (número, palavra OU id da lista W-API) dado o nível atual ──
// A W-API pode devolver o rowId ('acesso_menu:setores'), o título ('🏢 Setores') ou o texto.
function escolherCategoria(conteudo) {
  const t = String(conteudo || '')
    .trim()
    .toLowerCase()
    .replace('acesso_menu:', ''); // normaliza id da lista interativa
  if (t === '1' || t === 'setores' || t.includes('setor')) return 'setores';
  if (t === '2' || t === 'promocoes' || t.includes('promo') || t.includes('site') || t.includes('web')) return 'promocoes';
  if (t === '3' || t === 'redes' || t.includes('rede') || t.includes('social') || t.includes('instagram')) return 'redes';
  // Pix REMOVIDO do menu automático: deve sair exclusivamente por ação manual
  // do atendente no menu de anexos (enviarPixChat). Evita disparo sozinho quando
  // o cliente escreve qualquer frase contendo "pix".
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

    // ⛔ GUARD PREVENTIVO: o dono único do fluxo de menu é o gate do processInbound (invoke direto).
    // Se a automação de entidade for reativada no futuro, este guard impede que a Message do
    // próprio sistema (sender_type='user') seja interpretada como escolha do cliente — evitando
    // o submenu disparado sozinho (loop). Só mensagens REAIS do contato passam.
    if (isAutomacao && msg?.sender_type !== 'contact') {
      return Response.json({ success: true, skipped: 'nao_eh_mensagem_do_contato' });
    }

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

    // ── TRAVA ANTI-DUPLICIDADE ──
    // W-API/Z-API podem reentregar o MESMO clique de lista/botão (webhook duplicado).
    // Carimbamos a última escolha respondida + timestamp. Se chegar a mesma escolha
    // no mesmo nível dentro de 15s, é reentrega → ignora (não reenvia o card/submenu).
    const chaveEscolha = `${nivel}:${escolha.toLowerCase()}`;
    if (cp.acesso_menu_last_choice === chaveEscolha && cp.acesso_menu_last_choice_at) {
      const idadeMs = Date.now() - new Date(cp.acesso_menu_last_choice_at).getTime();
      if (idadeMs < 15_000) {
        console.log(`[responderMenuAcesso] ⏭️ DUPLICATA ignorada (${chaveEscolha}, age=${idadeMs}ms)`);
        return Response.json({ success: true, skipped: 'duplicata_escolha', chave: chaveEscolha });
      }
    }
    // Marca a escolha ANTES de processar (fecha a janela para o 2º webhook concorrente)
    cp.acesso_menu_last_choice = chaveEscolha;
    cp.acesso_menu_last_choice_at = new Date().toISOString();
    await base44.asServiceRole.entities.MessageThread.update(thread.id, {
      campos_personalizados: { ...cp }
    });

    let textoResposta = null;
    let novoNivel = null; // se setado, mantém menu aguardando neste nível
    let enviarQrPix = false;

    etapa = 'resolver_nivel';
    {
      // FLUXO ÚNICO: toda escolha resolve a categoria e entrega BOTÕES DE URL.
      // Não há mais nível 'setores' (menu numérico) — eliminado para acabar com o
      // "Não entendi" e o eco do número. Threads presas no estado 'setores' antigo
      // também caem aqui e recebem os botões de URL corretamente.
      const categoria = escolherCategoria(escolha);
      if (!categoria) {
        return Response.json({ success: true, skipped: 'escolha_nao_reconhecida' });
      }

      const lista = grupos[categoria];
      if (!lista || !lista.length) return Response.json({ success: true, skipped: 'categoria_vazia', categoria });

      // TODAS as categorias (Setores, Promoções, Redes) → LINKS CLICÁVEIS EM TEXTO.
      // Link escrito no corpo da mensagem abre com um toque, SEM o popup nativo
      // "Deseja abrir o link?" do WhatsApp (que só aparece em botões type:URL).
      {
        const isRedes = categoria === 'redes';
        const isSetores = categoria === 'setores';
        const titulo = isRedes ? '📱 Redes Sociais'
          : isSetores ? '💬 Setores da Empresa'
          : '🏷️ Promoções e Web Site';
        const mensagem = isRedes ? 'Toque para acessar nossas redes:'
          : isSetores ? 'Toque no setor desejado:'
          : 'Toque para ver nossas promoções e o site:';

        // Instagram ativo; Facebook/LinkedIn ainda não integrados → filtrar só Instagram nas redes
        const itensLink = isRedes
          ? lista.filter(it => String(it.titulo || '').toLowerCase().includes('instagram'))
          : lista;

        const rodape = isRedes ? '🔜 Facebook e LinkedIn em breve' : 'NEURALTEC';
        const linhas = itensLink.map(it => `${it.titulo}\n${it.url}`);
        const extra = isRedes ? `\n\n${rodape}` : '';
        textoResposta = `*${titulo}*\n${mensagem}\n\n${linhas.join('\n\n')}${extra}`;
        novoNivel = 'principal';
      }
      // ⛔ Categoria 'pix' removida do menu automático (envio manual via anexos)
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