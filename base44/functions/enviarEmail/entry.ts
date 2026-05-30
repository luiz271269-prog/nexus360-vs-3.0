import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import nodemailer from 'npm:nodemailer@6.9.14';

// Envia e-mail pela caixa correta (SMTP) e registra a mensagem outbound na thread.
// A senha NUNCA vem do frontend: vem do cofre de Secrets, pelo nome (secret_name).
// Params:
//  - thread_id (opcional): se vier, grava a Message outbound na conversa
//  - to (obrigatório), subject, body (texto)
//  - account_login (obrigatório): caixa remetente (ex: luiz@liesch.com.br)
//  - secret_name (obrigatório): nome do Secret com a senha dessa caixa
//  - from_name (opcional)
//  - smtp_host (default Zimbra), smtp_port (default 587, STARTTLS)
//  - in_reply_to, references (opcional: mantém a cadeia do e-mail)
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      thread_id,
      to,
      subject,
      body: texto,
      account_login,
      secret_name,
      from_name,
      smtp_host = 'mail.liesch.com.br',
      smtp_port = 587,
      in_reply_to,
      references
    } = body;

    if (!to || !account_login || !secret_name) {
      return Response.json(
        { error: 'Faltam campos obrigatórios: to, account_login, secret_name' },
        { status: 400 }
      );
    }

    const senha = Deno.env.get(secret_name);
    if (!senha) {
      return Response.json(
        { error: `Secret "${secret_name}" não encontrado no cofre.` },
        { status: 400 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: smtp_host,
      port: Number(smtp_port),
      secure: Number(smtp_port) === 465, // 465 = SSL; 587 = STARTTLS
      auth: { user: account_login, pass: senha },
      tls: { rejectUnauthorized: false }
    });

    const headers = {};
    if (in_reply_to) headers['In-Reply-To'] = in_reply_to;
    if (references) headers['References'] = references;

    const info = await transporter.sendMail({
      from: from_name ? `"${from_name}" <${account_login}>` : account_login,
      to,
      subject: subject || '(sem assunto)',
      text: texto || '',
      headers
    });

    // Registra a mensagem outbound na conversa (se thread informada)
    let messageId = null;
    if (thread_id) {
      const db = base44.asServiceRole.entities;
      const msg = await db.Message.create({
        thread_id,
        sender_id: user.id,
        sender_type: 'user',
        content: texto || '',
        channel: 'email',
        status: 'enviada',
        email_message_id: info.messageId || undefined,
        sent_at: new Date().toISOString(),
        metadata: {
          email_account: account_login,
          assunto: subject || '',
          sender_name: user.full_name
        }
      });
      messageId = msg.id;

      await db.MessageThread.update(thread_id, {
        last_message_content: subject || (texto || '').slice(0, 80),
        last_message_at: new Date().toISOString(),
        last_outbound_at: new Date().toISOString(),
        last_message_sender: 'user',
        last_message_sender_name: user.full_name
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