import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import nodemailer from 'npm:nodemailer@6.9.14';

// Envia e-mail pela caixa correta (SMTP) e registra a mensagem outbound na thread.
// A senha NUNCA vem do frontend: vem do cofre de Secrets, pelo nome (password_secret_name da EmailAccount).
// Params (preferencial):
//  - email_account_id (obrigatório): caixa remetente (EmailAccount). Resolve SMTP + secret + remetente.
//  - thread_id (opcional): se vier, grava a Message outbound na conversa
//  - to (obrigatório), subject, body (texto)
//  - in_reply_to, references (opcional: mantém a cadeia do e-mail)
//  - from_name (opcional, sobrepõe smtp_from_name)
// Compat legada: account_login + secret_name + smtp_host/smtp_port (quando não houver email_account_id)
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      email_account_id,
      thread_id,
      to,
      subject,
      body: texto,
      account_login: accountLoginParam,
      secret_name: secretNameParam,
      from_name,
      smtp_host: smtpHostParam,
      smtp_port: smtpPortParam,
      smtp_security: smtpSecurityParam,
      in_reply_to,
      references
    } = body;

    if (!to) {
      return Response.json({ error: 'Campo obrigatório ausente: to' }, { status: 400 });
    }

    // Resolve a caixa remetente
    let account = null;
    if (email_account_id) {
      account = await base44.asServiceRole.entities.EmailAccount.get(email_account_id).catch(() => null);
      if (!account) {
        return Response.json({ error: 'EmailAccount não encontrada' }, { status: 404 });
      }
      if (account.outbound_enabled === false) {
        return Response.json({ error: 'Esta caixa está com envio desabilitado (outbound_enabled=false)' }, { status: 403 });
      }
    }

    const accountLogin = (account?.email_address || accountLoginParam || '').trim().toLowerCase();
    const provider = String(account?.provider || '').toLowerCase();
    const authType = String(account?.auth_type || '').toLowerCase();
    const secretName = account?.password_secret_name || secretNameParam;

    if (!accountLogin) {
      return Response.json({ error: 'Não foi possível determinar a caixa remetente' }, { status: 400 });
    }

    // Gmail/OAuth não envia por SMTP sem senha de app — bloqueio claro.
    if ((provider === 'gmail' || authType === 'oauth') && !secretName) {
      return Response.json(
        { error: 'Envio por Gmail/OAuth ainda não suportado nesta caixa. Configure password_secret_name (app password) para enviar via SMTP.' },
        { status: 422 }
      );
    }

    if (!secretName) {
      return Response.json({ error: 'Caixa sem password_secret_name configurado para envio SMTP' }, { status: 400 });
    }

    const senha = Deno.env.get(secretName);
    if (!senha) {
      return Response.json({ error: `Secret "${secretName}" não encontrado no cofre.` }, { status: 400 });
    }

    const smtpHost = account?.smtp_host || smtpHostParam || 'mail.liesch.com.br';
    const smtpPort = Number(account?.smtp_port || smtpPortParam || 587);
    const smtpSecurity = String(account?.smtp_security || smtpSecurityParam || (smtpPort === 465 ? 'tls' : 'starttls')).toLowerCase();
    const remetenteNome = from_name || account?.smtp_from_name || account?.name || user.full_name;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecurity === 'tls' && smtpPort === 465,
      requireTLS: smtpSecurity === 'starttls',
      auth: { user: accountLogin, pass: senha },
      tls: { rejectUnauthorized: false }
    });

    const headers = {};
    if (in_reply_to) headers['In-Reply-To'] = in_reply_to;
    if (references) headers['References'] = references;

    const info = await transporter.sendMail({
      from: remetenteNome ? `"${remetenteNome}" <${accountLogin}>` : accountLogin,
      to,
      subject: subject || '(sem assunto)',
      text: texto || '',
      headers
    });

    // Registra a mensagem outbound na conversa (se thread informada)
    let messageId = null;
    if (thread_id) {
      const db = base44.asServiceRole.entities;
      const agora = new Date().toISOString();
      const msg = await db.Message.create({
        thread_id,
        sender_id: user.id,
        sender_type: 'user',
        recipient_type: 'contact',
        content: texto || '',
        channel: 'email',
        provider: provider === 'gmail' ? 'email_gmail' : 'email_imap',
        status: 'enviada',
        email_message_id: info.messageId || undefined,
        email_account_id: account?.id || undefined,
        email_provider: provider === 'gmail' ? 'gmail' : 'imap',
        from_email: accountLogin,
        to_email: to,
        subject: subject || '',
        sent_at: agora,
        media_type: 'none',
        metadata: {
          email_account: accountLogin,
          assunto: subject || '',
          sender_name: user.full_name
        }
      });
      messageId = msg.id;

      await db.MessageThread.update(thread_id, {
        last_message_content: subject || (texto || '').slice(0, 80),
        last_message_at: agora,
        last_outbound_at: agora,
        last_human_message_at: agora,
        last_message_sender: 'user',
        last_message_sender_name: user.full_name,
        last_email_message_id: info.messageId || undefined,
        email_account_id: account?.id || undefined
      });
    }

    return Response.json({
      ok: true,
      smtp_message_id: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      message_id: messageId
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});