import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Ponte: pega e-mails já sincronizados (EmailSincronizado) que estão vinculados
// a um Contact e ainda não foram levados para a Central de Comunicação,
// e cria/atualiza a MessageThread (channel="email") + Message (channel="email").
// Desacoplado da ingestão IMAP. Não toca em Comunicacao.jsx.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Permite execução por automação (sem user) ou por admin logado
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const db = base44.asServiceRole.entities;

    // Pega e-mails vinculados a contato e ainda não levados pra Central
    const pendentes = await db.EmailSincronizado.filter(
      { central_message_id: null },
      '-created_date',
      100
    );

    // Só leva pra Central e-mails APROVADOS (remetente já conhecido = auto_aprovado,
    // ou liberado manualmente = aprovado). Pendentes/rejeitados ficam de fora.
    const STATUS_OK = ['auto_aprovado', 'aprovado'];
    const elegiveis = (pendentes || []).filter(
      e => e.contact_id && !e.central_message_id && STATUS_OK.includes(e.status_aprovacao)
    );

    let criadas = 0;
    const detalhes = [];

    for (const email of elegiveis) {
      try {
        // 1) Acha thread de e-mail existente do contato, ou cria
        const existentes = await db.MessageThread.filter({
          contact_id: email.contact_id,
          channel: 'email'
        }, '-updated_date', 1);

        const conteudo = (email.assunto && email.assunto.trim())
          ? email.assunto.trim()
          : '(sem assunto)';
        const previewBolha = email.corpo_preview
          ? `${conteudo}\n\n${email.corpo_preview}`
          : conteudo;

        let thread = existentes && existentes[0];
        if (!thread) {
          thread = await db.MessageThread.create({
            contact_id: email.contact_id,
            thread_type: 'contact_external',
            channel: 'email',
            status: 'aberta',
            is_canonical: true,
            assigned_user_id: email.owner_user_id || undefined,
            last_message_content: conteudo,
            last_message_at: new Date().toISOString(),
            last_inbound_at: new Date().toISOString(),
            last_message_sender: 'contact',
            last_message_sender_name: email.remetente_nome || email.remetente_email,
            total_mensagens: 0
          });
        }

        // 2) Cria a mensagem (inbound, canal email)
        const msg = await db.Message.create({
          thread_id: thread.id,
          sender_id: email.contact_id,
          sender_type: 'contact',
          content: previewBolha,
          channel: 'email',
          status: 'recebida',
          email_message_id: email.email_message_id || undefined,
          sent_at: new Date().toISOString(),
          metadata: {
            email_account: email.account_login,
            remetente_email: email.remetente_email,
            assunto: email.assunto || ''
          }
        });

        // 3) Atualiza thread (preview + contadores) e marca o e-mail como levado
        await db.MessageThread.update(thread.id, {
          last_message_content: conteudo,
          last_message_at: new Date().toISOString(),
          last_inbound_at: new Date().toISOString(),
          last_message_sender: 'contact',
          last_message_sender_name: email.remetente_nome || email.remetente_email,
          total_mensagens: (thread.total_mensagens || 0) + 1
        });

        await db.EmailSincronizado.update(email.id, {
          central_thread_id: thread.id,
          central_message_id: msg.id
        });

        criadas++;
        detalhes.push({ email_id: email.id, thread_id: thread.id, message_id: msg.id });
      } catch (err) {
        detalhes.push({ email_id: email.id, erro: err.message });
      }
    }

    return Response.json({
      ok: true,
      total_pendentes: elegiveis.length,
      mensagens_criadas: criadas,
      detalhes
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});