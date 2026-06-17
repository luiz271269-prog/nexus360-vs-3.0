import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  let etapa = 'inicio';
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { thread_id, contact_id, integration_id, maps_url } = await req.json();
    if (!thread_id || !contact_id || !maps_url) {
      return Response.json({ success: false, error: 'thread_id, contact_id e maps_url obrigatórios' }, { status: 400 });
    }

    etapa = 'carregar_dados';
    const contato = await base44.asServiceRole.entities.Contact.get(contact_id).catch(() => null);
    if (!contato?.telefone) return Response.json({ success: false, error: 'contato_sem_telefone' });

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

    etapa = 'enviar_texto';
    const textoResposta = `📍 *Localização*\n${maps_url}`;
    const resp = await enviarTextoWhatsApp(integration, contato.telefone, textoResposta);
    if (!resp.ok) return Response.json({ success: false, error: 'erro_envio', detalhe: resp.raw });

    const now = new Date().toISOString();
    await base44.asServiceRole.entities.Message.create({
      thread_id, sender_id: user.id, sender_type: 'user',
      recipient_id: contato.id, recipient_type: 'contact',
      content: textoResposta, channel: 'whatsapp', status: 'enviada',
      whatsapp_message_id: resp.msgId, sent_at: now,
      metadata: { whatsapp_integration_id: integration.id, message_type: 'location' }
    });

    await base44.asServiceRole.entities.MessageThread.update(thread_id, {
      last_message_content: '📍 Localização enviada',
      last_message_at: now, last_message_sender: 'user', last_outbound_at: now
    }).catch(() => {});

    return Response.json({ success: true, message_id: resp.msgId });
  } catch (error) {
    console.error('[enviarLocalizacaoChat] ❌ etapa=' + etapa, error.message);
    return Response.json({ success: false, error: error.message, etapa }, { status: 500 });
  }
});