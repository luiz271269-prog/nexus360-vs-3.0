import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function b64utf8(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function toBase64Url(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function wrap76(b64) {
  return b64.match(/.{1,76}/g)?.join('\r\n') || b64;
}

function buildRawMime({ from, to, subject, text, inReplyTo }) {
  const lines = [];
  if (from) lines.push(`From: ${from}`);
  lines.push(`To: ${to}`);
  lines.push(`Subject: =?UTF-8?B?${b64utf8(subject)}?=`);
  if (inReplyTo) {
    lines.push(`In-Reply-To: ${inReplyTo}`);
    lines.push(`References: ${inReplyTo}`);
  }
  lines.push('MIME-Version: 1.0');
  lines.push('Content-Type: text/plain; charset="UTF-8"');
  lines.push('Content-Transfer-Encoding: base64');
  lines.push('');
  lines.push(wrap76(b64utf8(text)));
  return lines.join('\r\n');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { thread_id, content } = await req.json();
    if (!thread_id || !content?.trim()) {
      return Response.json({ error: 'thread_id e content são obrigatórios' }, { status: 400 });
    }

    const thread = await base44.asServiceRole.entities.MessageThread.get(thread_id);
    if (!thread) {
      return Response.json({ error: 'Thread não encontrada' }, { status: 404 });
    }

    // Buscar a última mensagem de e-mail recebida para extrair destinatário/assunto/referência
    const mensagens = await base44.asServiceRole.entities.Message.filter(
      { thread_id, channel: 'email' }, '-created_date', 30
    );
    const ultimaInbound = mensagens.find((m) => m.from_email && m.sender_type === 'contact') || mensagens.find((m) => m.from_email);

    let destino = ultimaInbound?.from_email || null;
    if (!destino && thread.contact_id) {
      const contato = await base44.asServiceRole.entities.Contact.get(thread.contact_id).catch(() => null);
      destino = contato?.email || (contato?.emails || [])[0]?.email || null;
    }
    if (!destino) {
      return Response.json({ error: 'Não foi possível identificar o e-mail do destinatário' }, { status: 400 });
    }

    let assunto = ultimaInbound?.subject || thread.email_subject_key || 'Mensagem';
    if (!/^re:/i.test(assunto)) assunto = `Re: ${assunto}`;
    const inReplyTo = ultimaInbound?.email_message_id || thread.last_email_message_id || null;

    // Token Gmail (conexão compartilhada do app)
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // O escopo gmail.send não permite ler o perfil; deixamos o Gmail preencher o From automaticamente.
    let fromEmail = null;
    try {
      const perfilRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (perfilRes.ok) {
        const perfil = await perfilRes.json();
        fromEmail = perfil.emailAddress || null;
      }
    } catch (_) { /* sem permissão de leitura — Gmail preenche o remetente */ }

    const rawMime = buildRawMime({
      from: fromEmail,
      to: destino,
      subject: assunto,
      text: content.trim(),
      inReplyTo
    });

    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: toBase64Url(rawMime) })
    });

    if (!sendRes.ok) {
      const erroTxt = await sendRes.text();
      return Response.json({ error: `Gmail recusou o envio: ${erroTxt}` }, { status: 502 });
    }
    const sent = await sendRes.json();

    // Registrar mensagem enviada na Central
    const novaMsg = await base44.asServiceRole.entities.Message.create({
      thread_id,
      sender_id: user.id,
      sender_type: 'user',
      recipient_id: thread.contact_id || null,
      recipient_type: 'contact',
      content: content.trim(),
      channel: 'email',
      provider: 'email_gmail',
      status: 'enviada',
      from_email: fromEmail || null,
      to_email: destino,
      subject: assunto,
      email_message_id: sent.id || null,
      sent_at: new Date().toISOString(),
      metadata: { gmail_message_id: sent.id, gmail_thread_id: sent.threadId }
    });

    await base44.asServiceRole.entities.MessageThread.update(thread_id, {
      last_message_content: content.trim().slice(0, 200),
      last_message_at: new Date().toISOString(),
      last_message_sender: 'user',
      last_outbound_at: new Date().toISOString(),
      last_human_message_at: new Date().toISOString()
    });

    return Response.json({ success: true, message_id: novaMsg.id, gmail_id: sent.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});