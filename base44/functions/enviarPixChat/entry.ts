import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ── Pix copia-e-cola (BR Code EMV estático) — inline ──
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
function gerarPixCopiaECola(chave, nome, cidade) {
  const merchant = emv('26', emv('00', 'br.gov.bcb.pix') + emv('01', chave));
  const payload = emv('00', '01') + merchant + emv('52', '0000') + emv('53', '986')
    + emv('58', 'BR') + emv('59', (nome || 'NEURALTEC').substring(0, 25))
    + emv('60', (cidade || 'FLORIANOPOLIS').substring(0, 15))
    + emv('62', emv('05', '***')) + '6304';
  return payload + crc16(payload);
}

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
    const msgId = resp.messageId || resp.insertedId || resp.id || resp.key?.id || null;
    return { ok: r.ok && !resp.error, msgId, raw: resp };
  }
  const url = (integ.base_url_provider || 'https://api.z-api.io')
    + `/instances/${integ.instance_id_provider}/token/${integ.api_key_provider}/send-image`;
  const headers = { 'Content-Type': 'application/json' };
  if (integ.security_client_token_header) headers['Client-Token'] = integ.security_client_token_header;
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ phone, image: imageUrl, caption }) });
  const resp = await r.json().catch(() => ({}));
  const msgId = resp.messageId || resp.key?.id || resp.id || null;
  return { ok: r.ok && !resp.error, msgId, raw: resp };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  let etapa = 'inicio';
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { thread_id, contact_id, integration_id } = await req.json();
    if (!thread_id || !contact_id) {
      return Response.json({ success: false, error: 'thread_id e contact_id obrigatórios' }, { status: 400 });
    }

    etapa = 'carregar_dados';
    const contato = await base44.asServiceRole.entities.Contact.get(contact_id).catch(() => null);
    if (!contato?.telefone) return Response.json({ success: false, error: 'contato_sem_telefone' });

    // Chave Pix vem do cadastro de Acessos Rápidos (tipo=pix)
    const itens = await base44.asServiceRole.entities.AcessoRapido.filter({ ativo: true }, 'ordem');
    const pix = itens.find(i => String(i.tipo || '').toLowerCase() === 'pix');
    if (!pix?.url) return Response.json({ success: false, error: 'sem_chave_pix_cadastrada' });

    let integration = null;
    if (integration_id) integration = await base44.asServiceRole.entities.WhatsAppIntegration.get(integration_id).catch(() => null);
    if (!integration) {
      const t = await base44.asServiceRole.entities.MessageThread.get(thread_id).catch(() => null);
      if (t?.whatsapp_integration_id) {
        integration = await base44.asServiceRole.entities.WhatsAppIntegration.get(t.whatsapp_integration_id).catch(() => null);
      }
    }
    if (!integration) {
      const ints = await base44.asServiceRole.entities.WhatsAppIntegration.filter({ status: 'conectado' });
      integration = ints[0];
    }
    if (!integration) return Response.json({ success: false, error: 'sem_integracao_conectada' });

    // Texto enxuto: apenas chave Pix (CNPJ). O copia-e-cola vai na legenda do QR.
    etapa = 'gerar_pix';
    const chaveLimpa = String(pix.url).replace(/\D/g, '') || String(pix.url);
    const copiaCola = gerarPixCopiaECola(chaveLimpa);
    const textoResposta = `⚡ *Pix NeuralTec*\n\n*Chave Pix (CNPJ):*\n${pix.url}`;

    etapa = 'enviar_texto';
    const resp = await enviarTextoWhatsApp(integration, contato.telefone, textoResposta);
    if (!resp.ok) return Response.json({ success: false, error: 'erro_envio', detalhe: resp.raw });

    const now = new Date().toISOString();
    await base44.asServiceRole.entities.Message.create({
      thread_id, sender_id: user.id, sender_type: 'user',
      recipient_id: contato.id, recipient_type: 'contact',
      content: textoResposta, channel: 'whatsapp', status: 'enviada',
      whatsapp_message_id: resp.msgId, sent_at: now,
      metadata: { whatsapp_integration_id: integration.id, message_type: 'pix' }
    });

    // QR Code — gera no qrserver, faz upload no storage Base44 (URL confiável
    // media.base44.com), e envia. Provedores WhatsApp recusam baixar de domínios
    // externos como qrserver.com, por isso re-hospedamos.
    etapa = 'enviar_qr';
    try {
      const qrExternoUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=${encodeURIComponent(copiaCola)}`;
      const qrResp = await fetch(qrExternoUrl);
      if (!qrResp.ok) throw new Error('qrserver retornou ' + qrResp.status);
      const qrBlob = await qrResp.blob();
      const qrFile = new File([qrBlob], 'pix-qrcode.png', { type: 'image/png' });
      const uploadResp = await base44.asServiceRole.integrations.Core.UploadFile({ file: qrFile });
      const qrUrl = uploadResp.file_url;

      // Legenda do QR carrega o copia-e-cola — o cliente copia direto da imagem.
      const captionQr = `⚡ *Pix NeuralTec* — escaneie ou copie e cole:\n${copiaCola}`;
      const respImg = await enviarImagemWhatsApp(integration, contato.telefone, qrUrl, captionQr);
      if (respImg.ok) {
        await base44.asServiceRole.entities.Message.create({
          thread_id, sender_id: user.id, sender_type: 'user',
          recipient_id: contato.id, recipient_type: 'contact',
          content: captionQr, channel: 'whatsapp', status: 'enviada',
          whatsapp_message_id: respImg.msgId, sent_at: new Date().toISOString(),
          media_url: qrUrl, media_type: 'image',
          metadata: { whatsapp_integration_id: integration.id, message_type: 'pix_qr' }
        });
      } else {
        console.warn('[enviarPixChat] QR recusado pelo provedor:', JSON.stringify(respImg.raw));
      }
    } catch (e) {
      console.warn('[enviarPixChat] QR falhou (texto já enviado):', e.message);
    }

    await base44.asServiceRole.entities.MessageThread.update(thread_id, {
      last_message_content: '⚡ Pix enviado',
      last_message_at: now, last_message_sender: 'user', last_outbound_at: now
    }).catch(() => {});

    return Response.json({ success: true, message_id: resp.msgId });
  } catch (error) {
    console.error('[enviarPixChat] ❌ etapa=' + etapa, error.message);
    return Response.json({ success: false, error: error.message, etapa }, { status: 500 });
  }
});