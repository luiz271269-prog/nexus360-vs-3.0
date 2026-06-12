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


function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9@._\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function parseEmailAddresses(headerValue) {
  const value = String(headerValue || '');
  const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return [...new Set(matches.map(normalizeEmail).filter(Boolean))];
}

function getDestinationEmails(headers) {
  const preferredHeaders = ['Delivered-To', 'X-Original-To', 'To', 'Cc'];
  const emails = [];
  for (const headerName of preferredHeaders) {
    emails.push(...parseEmailAddresses(getHeader(headers, headerName)));
  }
  return [...new Set(emails)];
}

function getContactEmails(contact) {
  const emails = [];
  const primary = normalizeEmail(contact?.email);
  if (primary) emails.push(primary);

  if (Array.isArray(contact?.emails)) {
    for (const item of contact.emails) {
      const email = normalizeEmail(item?.email || item);
      if (email) emails.push(email);
    }
  }

  return [...new Set(emails)];
}

function contactMatchesEmail(contact, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return getContactEmails(contact).includes(normalized);
}

async function ensureContactEmailAlias(base44, contact, email, origem = 'gmail') {
  const normalized = normalizeEmail(email);
  if (!contact?.id || !normalized || contactMatchesEmail(contact, normalized)) return contact;

  const aliases = Array.isArray(contact.emails) ? [...contact.emails] : [];
  aliases.push({ email: normalized, principal: false, origem });
  return base44.asServiceRole.entities.Contact.update(contact.id, { emails: aliases });
}

async function findExistingEmailMessage(base44, messageId) {
  const byTopLevel = await base44.asServiceRole.entities.Message.filter({
    channel: 'email',
    email_message_id: messageId
  }, '-created_date', 1);
  if (byTopLevel?.length) return byTopLevel[0];

  const byLegacyMetadata = await base44.asServiceRole.entities.Message.filter({
    channel: 'email',
    metadata: { gmail_message_id: messageId }
  }, '-created_date', 1);
  return byLegacyMetadata?.[0] || null;
}

function getContactResponsibleId(contact, cliente, fallbackOwnerId) {
  return contact?.atendente_fidelizado_vendas ||
    contact?.atendente_fidelizado_assistencia ||
    contact?.atendente_fidelizado_financeiro ||
    contact?.atendente_fidelizado_fornecedor ||
    cliente?.usuario_id ||
    fallbackOwnerId ||
    undefined;
}

function userOwnsMailbox(user, mailboxEmail) {
  const normalized = normalizeEmail(mailboxEmail);
  if (!normalized) return false;
  const accounts = Array.isArray(user?.email_accounts) ? user.email_accounts : [];
  return accounts.some(account => {
    if (typeof account === 'string') return normalizeEmail(account) === normalized;
    if (account?.ativo === false || account?.active === false) return false;
    return normalizeEmail(account?.login || account?.email || account?.email_address || account?.account_login) === normalized;
  });
}

async function findEmailAccountForDestination(base44, destinationEmails) {
  for (const email of destinationEmails) {
    try {
      const exact = await base44.asServiceRole.entities.EmailAccount.filter({ email_address: email }, '-updated_date', 1);
      if (exact?.length) return exact[0];
    } catch {
      return null;
    }
  }

  try {
    const accounts = await base44.asServiceRole.entities.EmailAccount.list('-updated_date', 500);
    return (accounts || []).find(account => destinationEmails.includes(normalizeEmail(account.email_address))) || null;
  } catch {
    return null;
  }
}

async function resolveDestinationOwner(base44, destinationEmails, appUserId) {
  const emailAccount = await findEmailAccountForDestination(base44, destinationEmails);
  if (emailAccount?.owner_user_id) {
    return {
      ownerUserId: emailAccount.owner_user_id,
      emailAccount,
      destinationEmail: normalizeEmail(emailAccount.email_address) || destinationEmails[0] || '',
      matchedBy: 'email_account'
    };
  }

  const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
  for (const email of destinationEmails) {
    const byMailbox = (users || []).find(user => userOwnsMailbox(user, email));
    if (byMailbox) {
      return { ownerUserId: byMailbox.id, emailAccount, destinationEmail: email, matchedBy: 'user_email_accounts' };
    }
  }

  for (const email of destinationEmails) {
    const byLogin = (users || []).find(user => normalizeEmail(user.email) === email);
    if (byLogin) {
      return { ownerUserId: byLogin.id, emailAccount, destinationEmail: email, matchedBy: 'user_login_email' };
    }
  }

  return {
    ownerUserId: appUserId || undefined,
    emailAccount,
    destinationEmail: destinationEmails[0] || '',
    matchedBy: appUserId ? 'app_user_fallback' : 'none'
  };
}

async function findClienteByEmailOrName(base44, fromEmail, fromName) {
  const normalizedEmail = normalizeEmail(fromEmail);
  const normalizedName = normalizeText(fromName);

  if (normalizedEmail) {
    const exact = await base44.asServiceRole.entities.Cliente.filter({ email: normalizedEmail }, '-updated_date', 1);
    if (exact?.length) return { cliente: exact[0], matchedBy: 'cliente_email_exact' };
  }

  const clientes = await base44.asServiceRole.entities.Cliente.list('-updated_date', 1000);
  const byEmail = (clientes || []).find(cliente => normalizeEmail(cliente.email) === normalizedEmail);
  if (byEmail) return { cliente: byEmail, matchedBy: 'cliente_email_case_insensitive' };

  if (normalizedName.length >= 4) {
    const byName = (clientes || []).find(cliente => {
      const names = [cliente.razao_social, cliente.nome_fantasia, cliente.contato_principal_nome].map(normalizeText).filter(Boolean);
      return names.some(name => name === normalizedName || name.includes(normalizedName) || normalizedName.includes(name));
    });
    if (byName) return { cliente: byName, matchedBy: 'cliente_name' };
  }

  return { cliente: null, matchedBy: null };
}

async function findClienteForContact(base44, contact) {
  if (!contact?.cliente_id) return null;
  try {
    return await base44.asServiceRole.entities.Cliente.get(contact.cliente_id);
  } catch {
    return null;
  }
}

async function findOrCreateContact(base44, fromEmail, fromName) {
  const normalizedEmail = normalizeEmail(fromEmail);
  const normalizedName = normalizeText(fromName);

  let contact = null;
  let matchedBy = null;

  const exact = await base44.asServiceRole.entities.Contact.filter({ email: normalizedEmail }, '-updated_date', 1);
  if (exact?.length) {
    contact = exact[0];
    matchedBy = 'contact_email_exact';
  }

  if (!contact) {
    const contacts = await base44.asServiceRole.entities.Contact.list('-updated_date', 1000);
    contact = (contacts || []).find(item => contactMatchesEmail(item, normalizedEmail));
    if (contact) matchedBy = 'contact_email_case_insensitive';

    if (!contact && normalizedName.length >= 4) {
      contact = (contacts || []).find(item => {
        const names = [item.nome, item.empresa].map(normalizeText).filter(Boolean);
        return names.some(name => name === normalizedName || name.includes(normalizedName) || normalizedName.includes(name));
      });
      if (contact) matchedBy = 'contact_name';
    }
  }

  if (contact) {
    if (!contact.email && normalizedEmail) {
      contact = await base44.asServiceRole.entities.Contact.update(contact.id, {
        email: normalizedEmail,
        emails: [{ email: normalizedEmail, principal: true, origem: 'gmail' }]
      });
    } else {
      contact = await ensureContactEmailAlias(base44, contact, normalizedEmail, 'gmail');
    }
    const linkedCliente = await findClienteForContact(base44, contact);
    return { contact, cliente: linkedCliente, matchedBy, created: false };
  }

  const { cliente, matchedBy: clienteMatchedBy } = await findClienteByEmailOrName(base44, normalizedEmail, fromName);
  if (cliente) {
    contact = await base44.asServiceRole.entities.Contact.create({
      nome: fromName || cliente.contato_principal_nome || cliente.nome_fantasia || cliente.razao_social || normalizedEmail.split('@')[0],
      email: normalizedEmail,
      emails: [{ email: normalizedEmail, principal: true, origem: 'gmail' }],
      telefone: cliente.telefone || undefined,
      empresa: cliente.nome_fantasia || cliente.razao_social || undefined,
      cliente_id: cliente.id,
      tipo_contato: 'cliente'
    });
    return { contact, cliente, matchedBy: clienteMatchedBy, created: true };
  }

  contact = await base44.asServiceRole.entities.Contact.create({
    nome: fromName || normalizedEmail.split('@')[0],
    email: normalizedEmail,
    emails: [{ email: normalizedEmail, principal: true, origem: 'gmail' }],
    tipo_contato: 'email'
  });
  return { contact, cliente: null, matchedBy: 'created_email_contact', created: true };
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

        const headers = message.payload?.headers || [];
        const fromHeader = getHeader(headers, 'From');
        const subject = getHeader(headers, 'Subject') || '(sem assunto)';
        const rfcMessageId = getHeader(headers, 'Message-ID');
        const { name: fromName, email: fromEmail } = parseFrom(fromHeader);

        if (!fromEmail) {
          skipped.push({ id: messageId, reason: 'no_from_email' });
          continue;
        }

        const destinationEmails = getDestinationEmails(headers);
        const { ownerUserId, emailAccount, destinationEmail, matchedBy: ownerMatchedBy } =
          await resolveDestinationOwner(base44, destinationEmails, appUserId);

        // Skip messages we already imported (new top-level field + legacy metadata fallback).
        const existing = await findExistingEmailMessage(base44, messageId);
        if (existing) {
          skipped.push({ id: messageId, reason: 'already_imported' });
          continue;
        }

        const bodyText = extractBody(message.payload).slice(0, 5000);
        const snippet = message.snippet || '';
        const content = bodyText || snippet || subject;
        const now = new Date().toISOString();

        // Find or create Contact by existing Contact/CRM rules before creating a new e-mail contact.
        const { contact, cliente, matchedBy: contactMatchedBy, created: contactCreated } =
          await findOrCreateContact(base44, fromEmail, fromName);
        const assigneeUserId = getContactResponsibleId(contact, cliente, ownerUserId);

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
          const participants = assigneeUserId ? [assigneeUserId] : [];
          thread = await base44.asServiceRole.entities.MessageThread.create({
            contact_id: contact.id,
            thread_type: 'contact_external',
            channel: 'email',
            is_canonical: true,
            status: 'aberta',
            assigned_user_id: assigneeUserId || undefined,
            participants,
            atendentes_historico: participants,
            email_account_id: emailAccount?.id || undefined,
            origin_email_account_ids: emailAccount?.id ? [emailAccount.id] : [],
            email_thread_key: message.threadId || undefined,
            last_email_message_id: messageId,
            last_message_content: subject,
            last_message_at: now,
            last_inbound_at: now,
            last_message_sender: 'contact',
            last_message_sender_name: fromName || fromEmail,
            total_mensagens: 0,
            unread_count: 0
          });
        }

        const threadPatch: Record<string, unknown> = {
          last_message_content: subject,
          last_message_at: now,
          last_inbound_at: now,
          last_message_sender: 'contact',
          last_message_sender_name: fromName || fromEmail,
          total_mensagens: (thread.total_mensagens || 0) + 1,
          unread_count: (thread.unread_count || 0) + 1,
          last_email_message_id: messageId
        };

        if (!thread.assigned_user_id && assigneeUserId) threadPatch.assigned_user_id = assigneeUserId;
        if (!thread.email_account_id && emailAccount?.id) threadPatch.email_account_id = emailAccount.id;
        if (!thread.email_thread_key && message.threadId) threadPatch.email_thread_key = message.threadId;

        const participants = Array.isArray(thread.participants) ? [...thread.participants] : [];
        if (assigneeUserId && !participants.includes(assigneeUserId)) {
          participants.push(assigneeUserId);
          threadPatch.participants = participants;
        }

        const atendentesHistorico = Array.isArray(thread.atendentes_historico) ? [...thread.atendentes_historico] : [];
        if (assigneeUserId && !atendentesHistorico.includes(assigneeUserId)) {
          atendentesHistorico.push(assigneeUserId);
          threadPatch.atendentes_historico = atendentesHistorico;
        }

        const originEmailAccountIds = Array.isArray(thread.origin_email_account_ids) ? [...thread.origin_email_account_ids] : [];
        if (emailAccount?.id && !originEmailAccountIds.includes(emailAccount.id)) {
          originEmailAccountIds.push(emailAccount.id);
          threadPatch.origin_email_account_ids = originEmailAccountIds;
        }

        // Create Message
        const createdMessage = await base44.asServiceRole.entities.Message.create({
          thread_id: thread.id,
          sender_id: contact.id,
          sender_type: 'contact',
          recipient_id: assigneeUserId,
          recipient_type: 'user',
          content: `**${subject}**\n\n${content}`,
          channel: 'email',
          provider: 'email_gmail',
          visibility: 'public_to_customer',
          status: 'recebida',
          sent_at: now,
          media_type: 'none',
          email_account_id: emailAccount?.id || undefined,
          email_message_id: messageId,
          email_provider: 'gmail',
          email_thread_key: message.threadId || undefined,
          metadata: {
            gmail_message_id: messageId,
            gmail_thread_id: message.threadId,
            email_rfc_message_id: rfcMessageId,
            email_from: fromEmail,
            email_from_name: fromName,
            email_to: destinationEmails,
            email_destination: destinationEmail,
            email_owner_match: ownerMatchedBy,
            email_assignee_user_id: assigneeUserId,
            email_contact_match: contactMatchedBy,
            email_contact_created: contactCreated,
            email_subject: subject,
            email_snippet: snippet
          }
        });

        if (assigneeUserId) {
          await base44.asServiceRole.functions.invoke('enviarWakeUpPush', {
            target_user_id: assigneeUserId,
            tipo: 'message',
            title: fromName || fromEmail || 'Novo e-mail',
            body: subject || snippet || 'Novo e-mail recebido',
            thread_id: thread.id,
            message_id: createdMessage.id,
            action_url: '/Comunicacao',
            metadata: { channel: 'email', provider: 'gmail', email_account_id: emailAccount?.id || null }
          }).catch((pushErr) => console.warn('[GMAIL_WEBHOOK] Wake-Up push falhou:', pushErr.message));
        }

        // Update thread tail
        await base44.asServiceRole.entities.MessageThread.update(thread.id, threadPatch);

        created.push({
          messageId,
          threadId: thread.id,
          contactId: contact.id,
          assignedUserId: assigneeUserId,
          emailAccountId: emailAccount?.id || null,
          contactMatchedBy,
          ownerMatchedBy
        });
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