import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const GMAIL_CONNECTOR_ID = '6a14df6da76515d039e6833c';

// Decode base64url-encoded Gmail body
function decodeBase64Url(str) {
  if (!str) return '';
  try {
    const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
    return new TextDecoder('utf-8').decode(
      Uint8Array.from(atob(normalized), c => c.charCodeAt(0))
    );
  } catch {
    return '';
  }
}

// Extract plain text body from Gmail message payload
function extractBody(payload) {
  if (!payload) return '';

  // Direct body
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Multipart — prefer text/plain, fallback to text/html
  if (payload.parts && payload.parts.length) {
    const plain = payload.parts.find(p => p.mimeType === 'text/plain');
    if (plain?.body?.data) return decodeBase64Url(plain.body.data);

    const html = payload.parts.find(p => p.mimeType === 'text/html');
    if (html?.body?.data) {
      // Strip basic HTML tags
      return decodeBase64Url(html.body.data).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Recurse into nested parts
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }

  return '';
}

// Get header value (case-insensitive)
function getHeader(headers, name) {
  if (!headers) return '';
  const h = headers.find(x => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

// Parse "Display Name <email@example.com>" → { name, email }
function parseFrom(fromHeader) {
  if (!fromHeader) return { name: '', email: '' };
  const match = fromHeader.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].replace(/['"]/g, '').trim(), email: match[2].trim().toLowerCase() };
  }
  return { name: '', email: fromHeader.trim().toLowerCase() };
}

function normEmail(v) {
  return String(v || '').trim().toLowerCase();
}

// Casa um e-mail contra o e-mail principal OU a lista emails[] do contato
function contactMatchesEmail(c, email) {
  const e = normEmail(email);
  if (!e) return false;
  if (normEmail(c.email) === e) return true;
  if (Array.isArray(c.emails)) {
    return c.emails.some(x => normEmail(x?.email || x) === e);
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200 });
  }

  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);

    // Pre-enriched fields from the platform
    const messageIds = body?.data?.new_message_ids ?? [];
    const hasNew = body?.data?.has_new_messages === true;

    if (!hasNew || messageIds.length === 0) {
      return Response.json({ success: true, skipped: 'no_new_messages' });
    }

    // Get the app user who owns this Gmail connection
    const appUserId = body?.app_user_id || body?.automation?.app_user_id;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    const created = [];
    const skipped = [];

    for (const messageId of messageIds) {
      try {
        const res = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
          { headers: authHeader }
        );
        if (!res.ok) {
          skipped.push({ id: messageId, reason: `fetch_${res.status}` });
          continue;
        }
        const message = await res.json();

        // Filter: only INBOX, skip SPAM/CATEGORY_PROMOTIONS/CATEGORY_SOCIAL
        const labels = message.labelIds || [];
        if (!labels.includes('INBOX')) {
          skipped.push({ id: messageId, reason: 'not_inbox' });
          continue;
        }
        if (labels.includes('SPAM') ||
            labels.includes('CATEGORY_PROMOTIONS') ||
            labels.includes('CATEGORY_SOCIAL')) {
          skipped.push({ id: messageId, reason: 'spam_or_promo' });
          continue;
        }

        // Idempotência: casa por email_message_id (novo) OU metadata.gmail_message_id (histórico)
        let jaImportado = await base44.asServiceRole.entities.Message.filter({
          channel: 'email',
          email_message_id: messageId
        }, '-created_date', 1);
        if (!jaImportado || jaImportado.length === 0) {
          jaImportado = await base44.asServiceRole.entities.Message.filter({
            channel: 'email',
            metadata: { gmail_message_id: messageId }
          }, '-created_date', 1);
        }
        if (jaImportado && jaImportado.length > 0) {
          skipped.push({ id: messageId, reason: 'already_imported' });
          continue;
        }

        const headers = message.payload?.headers || [];
        const fromHeader = getHeader(headers, 'From');
        const subject = getHeader(headers, 'Subject') || '(sem assunto)';
        const { name: fromName, email: fromEmail } = parseFrom(fromHeader);

        // Destinatário = usuário interno dono da CAIXA de destino (header To / Delivered-To).
        // O vínculo correto está em User.email_accounts[].login (caixas que o usuário atende),
        // não em User.email (login de acesso ao app). Fallbacks: User.email -> dono da conexão.
        const toHeader = getHeader(headers, 'To') || getHeader(headers, 'Delivered-To');
        const { email: toEmail } = parseFrom(toHeader);
        let ownerUserId = appUserId || undefined;
        if (toEmail) {
          const todosUsuarios = await base44.asServiceRole.entities.User.list('-created_date', 1000);
          // 1) usuário cuja caixa (email_accounts[].login) bate com o destino
          let dono = todosUsuarios.find(u =>
            (u.email_accounts || []).some(c => (c.login || '').trim().toLowerCase() === toEmail)
          );
          // 2) fallback: login de acesso ao app igual ao destino
          if (!dono) {
            dono = todosUsuarios.find(u => (u.email || '').trim().toLowerCase() === toEmail);
          }
          if (dono) ownerUserId = dono.id;
        }

        if (!fromEmail) {
          skipped.push({ id: messageId, reason: 'no_from_email' });
          continue;
        }

        const bodyText = extractBody(message.payload).slice(0, 5000);
        const snippet = message.snippet || '';
        const content = bodyText || snippet || subject;

        // Conciliação do remetente — evita contato duplicado quando a pessoa usa vários e-mails.
        // Ordem: 1) e-mail exato  2) email/emails[]  3) nome  4) Cliente CRM  5) cria novo tipo email
        let contact = null;
        let candidatos = await base44.asServiceRole.entities.Contact.filter({ email: fromEmail }, '-created_date', 1);

        if (!candidatos || candidatos.length === 0) {
          const todos = await base44.asServiceRole.entities.Contact.list('-created_date', 1000);
          // 2) e-mail principal OU emails[] (ignora maiúsculas/espaços)
          let achado = todos.find(c => contactMatchesEmail(c, fromEmail));
          // 3) nome igual (quando não achou por e-mail)
          if (!achado && fromName) {
            const nomeNorm = fromName.trim().toLowerCase();
            achado = todos.find(c => (c.nome || '').trim().toLowerCase() === nomeNorm);
          }
          if (achado) candidatos = [achado];
        }

        if (candidatos && candidatos.length > 0) {
          contact = candidatos[0];
          // Mantém histórico de e-mails: garante que o remetente esteja em email/emails[]
          const patch = {};
          if (!contact.email && fromEmail) patch.email = fromEmail;
          if (fromEmail && !contactMatchesEmail(contact, fromEmail)) {
            const lista = Array.isArray(contact.emails) ? [...contact.emails] : [];
            lista.push({ email: fromEmail, tipo: 'outro', origem: 'gmail' });
            patch.emails = lista;
          }
          if (Object.keys(patch).length > 0) {
            await base44.asServiceRole.entities.Contact.update(contact.id, patch);
          }
        } else {
          // 4) concilia com Cliente CRM (e-mail exato) antes de criar contato solto
          let clienteVinc = null;
          if (fromEmail) {
            const cli = await base44.asServiceRole.entities.Cliente.filter({ email: fromEmail }, '-created_date', 1);
            if (cli && cli.length > 0) clienteVinc = cli[0];
          }
          if (clienteVinc) {
            contact = await base44.asServiceRole.entities.Contact.create({
              nome: fromName || clienteVinc.nome_fantasia || clienteVinc.razao_social || fromEmail.split('@')[0],
              email: fromEmail,
              telefone: clienteVinc.telefone || undefined,
              empresa: clienteVinc.nome_fantasia || clienteVinc.razao_social || undefined,
              cliente_id: clienteVinc.id,
              tipo_contato: 'cliente',
              emails: [{ email: fromEmail, tipo: 'principal', origem: 'gmail' }]
            });
          } else {
            // 5) cria contato novo tipo email (sem conciliação)
            contact = await base44.asServiceRole.entities.Contact.create({
              nome: fromName || fromEmail.split('@')[0],
              email: fromEmail,
              tipo_contato: 'email',
              emails: [{ email: fromEmail, tipo: 'principal', origem: 'gmail' }]
            });
          }
        }

        // Regra 3 — responsável do contato (fidelizado) tem prioridade sobre o dono da caixa
        const responsavelDoContato =
          contact.atendente_fidelizado_vendas ||
          contact.atendente_fidelizado_assistencia ||
          contact.atendente_fidelizado_financeiro ||
          contact.atendente_fidelizado_fornecedor ||
          null;
        const assignedUserId = responsavelDoContato || ownerUserId || undefined;

        // Find or create MessageThread (canonical) for this contact + email channel
        let thread = null;
        const threadsExistentes = await base44.asServiceRole.entities.MessageThread.filter({
          contact_id: contact.id,
          channel: 'email',
          is_canonical: true
        }, '-created_date', 1);
        if (threadsExistentes && threadsExistentes.length > 0) {
          thread = threadsExistentes[0];
        } else {
          thread = await base44.asServiceRole.entities.MessageThread.create({
            contact_id: contact.id,
            thread_type: 'contact_external',
            channel: 'email',
            is_canonical: true,
            status: 'aberta',
            assigned_user_id: assignedUserId,
            participants: assignedUserId ? [assignedUserId] : [],
            last_message_content: subject,
            last_message_at: new Date().toISOString(),
            last_inbound_at: new Date().toISOString(),
            last_message_sender: 'contact',
            last_message_sender_name: fromName || fromEmail,
            total_mensagens: 0,
            unread_count: 0
          });
        }

        // Create Message
        await base44.asServiceRole.entities.Message.create({
          thread_id: thread.id,
          sender_id: contact.id,
          sender_type: 'contact',
          recipient_id: ownerUserId,
          recipient_type: 'user',
          content: `**${subject}**\n\n${content}`,
          channel: 'email',
          provider: 'email_imap',
          email_message_id: messageId,
          visibility: 'public_to_customer',
          status: 'recebida',
          sent_at: new Date().toISOString(),
          media_type: 'none',
          metadata: {
            gmail_message_id: messageId,
            gmail_thread_id: message.threadId,
            email_from: fromEmail,
            email_from_name: fromName,
            email_subject: subject,
            email_snippet: snippet
          }
        });

        // Update thread tail
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          last_message_content: subject,
          last_message_at: new Date().toISOString(),
          last_inbound_at: new Date().toISOString(),
          last_message_sender: 'contact',
          last_message_sender_name: fromName || fromEmail,
          total_mensagens: (thread.total_mensagens || 0) + 1,
          unread_count: (thread.unread_count || 0) + 1
        });

        created.push({ messageId, threadId: thread.id, contactId: contact.id });
      } catch (innerErr) {
        skipped.push({ id: messageId, reason: 'error', error: innerErr.message });
      }
    }

    return Response.json({
      success: true,
      created: created.length,
      skipped: skipped.length,
      details: { created, skipped }
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});