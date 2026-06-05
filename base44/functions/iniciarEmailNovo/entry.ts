import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Inicia um e-mail NOVO (não-resposta) a partir da Central:
// 1) localiza/cria o Contact pelo e-mail
// 2) localiza/cria a MessageThread (channel=email) da caixa remetente
// 3) delega o envio + registro da Message à função enviarEmail (já existente)
// Params: email_account_id, to, subject, body
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email_account_id, to, subject, body, attachments } = await req.json().catch(() => ({}));

    if (!email_account_id || !to) {
      return Response.json({ error: 'Campos obrigatórios: email_account_id e to' }, { status: 400 });
    }

    const db = base44.asServiceRole.entities;

    const conta = await db.EmailAccount.get(email_account_id).catch(() => null);
    if (!conta) {
      return Response.json({ error: 'EmailAccount não encontrada' }, { status: 404 });
    }
    if (conta.outbound_enabled === false) {
      return Response.json({ error: 'Caixa com envio desabilitado' }, { status: 403 });
    }

    const destinoEmail = String(to).trim().toLowerCase();

    // 1) Contact por e-mail (campo email OU array emails[])
    let contato = (await db.Contact.filter({ email: destinoEmail }, '-created_date', 1))[0] || null;
    if (!contato) {
      const todos = await db.Contact.filter({}, '-created_date', 500);
      contato = todos.find((c) => (c.emails || []).some((e) => String(e.email || '').toLowerCase() === destinoEmail)) || null;
    }
    if (!contato) {
      contato = await db.Contact.create({
        nome: destinoEmail.split('@')[0],
        email: destinoEmail,
        tipo_contato: 'email'
      });
    }

    // assunto normalizado para threading
    const subjectKey = String(subject || '')
      .replace(/^\s*(re|fwd|fw|enc|res)\s*:\s*/gi, '')
      .trim()
      .toLowerCase();

    // 2) Thread existente (mesma caixa + contato + assunto) ou nova
    let thread = (await db.MessageThread.filter({
      contact_id: contato.id,
      channel: 'email',
      email_account_id: conta.id,
      email_subject_key: subjectKey
    }, '-updated_date', 1))[0] || null;

    if (!thread) {
      thread = await db.MessageThread.create({
        contact_id: contato.id,
        channel: 'email',
        thread_type: 'contact_external',
        email_account_id: conta.id,
        email_subject_key: subjectKey,
        origin_email_account_ids: [conta.id],
        status: 'aberta',
        assigned_user_id: user.id,
        primeira_mensagem_at: new Date().toISOString()
      });
    }

    // 3) Envio + registro da Message (reusa enviarEmail)
    const resp = await base44.functions.invoke('enviarEmail', {
      thread_id: thread.id,
      email_account_id: conta.id,
      to: destinoEmail,
      subject: subject || '(sem assunto)',
      body: body || '',
      attachments: Array.isArray(attachments) ? attachments : []
    });

    const data = resp?.data || resp;
    if (!data?.ok) {
      return Response.json({ error: data?.error || 'Falha no envio do e-mail' }, { status: 502 });
    }

    return Response.json({
      ok: true,
      thread_id: thread.id,
      contact_id: contato.id,
      message_id: data.message_id || null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});