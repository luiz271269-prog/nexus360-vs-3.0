import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

function primeiroNome(nomeCompleto) {
  if (!nomeCompleto) return '';
  return String(nomeCompleto).trim().split(/\s+/)[0] || '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const event = body?.event || {};
    let data = body?.data || null;

    const entityId = event?.entity_id || data?.id || null;
    if (!data && entityId) {
      data = await base44.asServiceRole.entities.EmailSincronizado.get(entityId).catch(() => null);
    }

    if (!data) {
      return Response.json({ skipped: true, reason: 'sem_dados' });
    }

    // GUARD idempotência: não reenviar se já confirmou
    if (data.confirmacao_enviada === true) {
      return Response.json({ skipped: true, reason: 'ja_confirmado' });
    }

    if (data.status_aprovacao !== 'auto_aprovado') {
      return Response.json({ skipped: true, reason: 'remetente_nao_aprovado' });
    }

    const destino = (data.remetente_email || '').trim().toLowerCase();
    if (!destino) {
      return Response.json({ skipped: true, reason: 'sem_email_remetente' });
    }

    // GUARD no-reply: nunca confirmar para caixas automáticas
    const localPart = destino.split('@')[0] || '';
    const padroesNoReply = ['noreply', 'no-reply', 'no_reply', 'mailer-daemon', 'postmaster', 'donotreply', 'do-not-reply', 'bounce'];
    if (padroesNoReply.some(p => localPart.includes(p))) {
      return Response.json({ skipped: true, reason: 'remetente_no_reply' });
    }

    const contaRecebeu = (data.account_login || '').toLowerCase();
    const dominioRemetente = destino.split('@')[1] || '';
    const dominioConta = contaRecebeu.split('@')[1] || '';
    if (dominioRemetente && dominioConta && dominioRemetente === dominioConta) {
      return Response.json({ skipped: true, reason: 'mesmo_dominio_interno' });
    }

    const nome = primeiroNome(data.remetente_nome);
    const saudacao = nome ? `Olá, ${nome}!` : 'Olá!';
    const assuntoOriginal = data.assunto || 'sua mensagem';

    const textoConfirmacao = [
      saudacao,
      '',
      `Recebemos o seu e-mail referente a "${assuntoOriginal}" e ele já está em nossa central de atendimento.`,
      '',
      'Nossa equipe vai analisar sua mensagem e retornar o mais breve possível. Caso seja urgente, fique à vontade para responder este e-mail com mais detalhes.',
      '',
      'Agradecemos o seu contato.',
      '',
      'Atenciosamente,',
      'Equipe Liesch'
    ].join('\n');

    let assunto = assuntoOriginal;
    if (!/^re:/i.test(assunto)) assunto = `Re: ${assunto}`;
    const inReplyTo = data.email_message_id || null;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    let fromEmail = null;
    try {
      const perfilRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (perfilRes.ok) {
        const perfil = await perfilRes.json();
        fromEmail = perfil.emailAddress || null;
      }
    } catch (_) { /* gmail.send não lê perfil */ }

    const rawMime = buildRawMime({
      from: fromEmail,
      to: destino,
      subject: assunto,
      text: textoConfirmacao,
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
      return Response.json({ success: false, error: `Gmail recusou: ${erroTxt}` }, { status: 502 });
    }
    const sent = await sendRes.json();

    // Marca idempotência (evita reenvio em reprocessamento da automação)
    if (entityId) {
      await base44.asServiceRole.entities.EmailSincronizado.update(entityId, {
        confirmacao_enviada: true,
        confirmacao_enviada_em: new Date().toISOString()
      }).catch(() => { /* envio já ocorreu; falha de update não deve quebrar */ });
    }

    return Response.json({ success: true, enviado_para: destino, gmail_id: sent.id });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});