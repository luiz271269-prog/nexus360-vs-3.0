import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_TIMEOUT_MS = 15000;
const CRLF = '\r\n';

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }
  });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function formatEmailSendError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Erro desconhecido');
  const lower = message.toLowerCase();

  if (lower.includes('gmail send falhou') || lower.includes('gmail')) {
    return `${message} Verifique se o conector Gmail possui escopo de envio (gmail.send).`;
  }
  if (lower.includes('535') || lower.includes('auth') || lower.includes('authentication') || lower.includes('autentica')) {
    return 'Autenticação SMTP falhou. Revise usuário/senha no secret da EmailAccount e confirme se SMTP está habilitado para a caixa.';
  }
  if (lower.includes('timed out') || lower.includes('tempo limite') || lower.includes('excedeu')) {
    return 'Tempo limite na conexão SMTP/Gmail. Verifique host, porta, TLS/STARTTLS, firewall e disponibilidade do servidor.';
  }
  if (lower.includes('certificate') || lower.includes('certificado') || lower.includes('unknownissuer')) {
    return 'Falha de certificado TLS no SMTP. Configure smtp_ca_cert_secret_name/ca_cert_secret_name ou revise o certificado do servidor.';
  }
  return message;
}

async function markEmailAccountStatus(base44: any, account: Record<string, unknown> | null, patch: Record<string, unknown>) {
  if (!account?.id) return;
  try {
    await base44.asServiceRole.entities.EmailAccount.update(String(account.id), patch);
  } catch {
    // Diagnóstico operacional não deve mascarar o erro real de envio.
  }
}

function encodeHeader(value: string) {
  if (!/[^\x20-\x7E]/.test(value)) return value;
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function base64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64UrlUtf8(value: string) {
  return base64Utf8(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function escapeSmtpAddress(email: string) {
  return `<${email.replace(/[<>\r\n]/g, '')}>`;
}

function makeMessageId(domainHint: string) {
  const domain = normalizeEmail(domainHint).split('@')[1] || 'nexus360.local';
  return `<${crypto.randomUUID()}@${domain}>`;
}

function buildMime({ fromEmail, fromName, to, subject, body, inReplyTo, references, messageId }: {
  fromEmail: string;
  fromName?: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  messageId: string;
}) {
  const from = fromName ? `${encodeHeader(fromName)} <${fromEmail}>` : fromEmail;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject || '(sem assunto)')}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64'
  ];

  if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`);
  if (references) headers.push(`References: ${references}`);

  return `${headers.join(CRLF)}${CRLF}${CRLF}${base64Utf8(body || '')}${CRLF}`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${label} excedeu ${timeoutMs}ms`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

class SmtpConnection {
  private conn: Deno.Conn;
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private decoder = new TextDecoder();
  private encoder = new TextEncoder();
  private buffer = '';

  constructor(conn: Deno.Conn) {
    this.conn = conn;
    this.reader = conn.readable.getReader();
    this.writer = conn.writable.getWriter();
  }

  static async connect(account: Record<string, unknown>, timeoutMs: number) {
    const hostname = String(account.smtp_host || account.imap_host || '').trim();
    const port = Number(account.smtp_port || 587);
    const security = String(account.smtp_security || (port === 465 ? 'tls' : 'starttls')).toLowerCase();
    const tlsHostname = String(account.smtp_tls_hostname || account.imap_tls_hostname || hostname).trim();

    if (!hostname) throw new Error('EmailAccount sem smtp_host');

    let conn: Deno.Conn;
    if (security === 'tls') {
      conn = await withTimeout(Deno.connectTls({ hostname, port, caCerts: await loadCaCerts(account) }), timeoutMs, `Conexão SMTP TLS ${hostname}:${port}`);
    } else {
      conn = await withTimeout(Deno.connect({ hostname, port }), timeoutMs, `Conexão SMTP ${hostname}:${port}`);
    }

    const smtp = new SmtpConnection(conn);
    await smtp.readResponse(timeoutMs);
    await smtp.command(`EHLO ${tlsHostname || 'nexus360.local'}`, timeoutMs);

    if (security === 'starttls') {
      await smtp.command('STARTTLS', timeoutMs);
      smtp.reader.releaseLock();
      smtp.writer.releaseLock();
      const tlsConn = await withTimeout(Deno.startTls(conn, { hostname: tlsHostname || hostname, caCerts: await loadCaCerts(account) }), timeoutMs, `Upgrade STARTTLS ${hostname}:${port}`);
      smtp.conn = tlsConn;
      smtp.reader = tlsConn.readable.getReader();
      smtp.writer = tlsConn.writable.getWriter();
      smtp.buffer = '';
      await smtp.command(`EHLO ${tlsHostname || 'nexus360.local'}`, timeoutMs);
    }

    return smtp;
  }

  async command(command: string, timeoutMs: number) {
    await this.write(`${command}${CRLF}`);
    return this.readResponse(timeoutMs);
  }

  async write(data: string) {
    await this.writer.write(this.encoder.encode(data));
  }

  async readResponse(timeoutMs: number) {
    return withTimeout(this.readResponseUnsafe(), timeoutMs, 'Resposta SMTP');
  }

  private async readResponseUnsafe() {
    const lines: string[] = [];
    while (true) {
      const line = await this.readLine();
      lines.push(line);
      if (/^\d{3}\s/.test(line)) {
        const code = Number(line.slice(0, 3));
        if (code >= 400) throw new Error(`SMTP ${line}`);
        return lines;
      }
    }
  }

  private async readLine() {
    while (!this.buffer.includes('\n')) {
      const { value, done } = await this.reader.read();
      if (done) throw new Error('Conexão SMTP encerrada');
      this.buffer += this.decoder.decode(value, { stream: true });
    }
    const idx = this.buffer.indexOf('\n');
    const line = this.buffer.slice(0, idx + 1).replace(/\r?\n$/, '');
    this.buffer = this.buffer.slice(idx + 1);
    return line;
  }

  async close() {
    try { await this.command('QUIT', 3000); } catch {}
    try { this.conn.close(); } catch {}
  }
}

async function loadCaCerts(account: Record<string, unknown>) {
  const secretName = String(account.smtp_ca_cert_secret_name || account.ca_cert_secret_name || '').trim();
  if (!secretName) return undefined;
  const cert = Deno.env.get(secretName);
  return cert ? [normalizePem(cert)] : undefined;
}

function normalizePem(value: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes('\n')) return trimmed;
  const match = trimmed.match(/-----BEGIN CERTIFICATE-----(.*?)-----END CERTIFICATE-----/);
  if (!match) return trimmed;
  const body = match[1].replace(/\s+/g, '');
  return `-----BEGIN CERTIFICATE-----\n${body.match(/.{1,64}/g)?.join('\n') || body}\n-----END CERTIFICATE-----`;
}

async function resolveEmailAccount(base44: any, body: Record<string, unknown>) {
  if (body.email_account_id) {
    return base44.asServiceRole.entities.EmailAccount.get(String(body.email_account_id));
  }

  const accountLogin = normalizeEmail(body.account_login);
  if (accountLogin) {
    const accounts = await base44.asServiceRole.entities.EmailAccount.filter({ email_address: accountLogin }, '-updated_date', 1);
    if (accounts?.length) return accounts[0];
  }

  throw new Error('EmailAccount não informada ou não encontrada');
}

async function sendViaGmail(base44: any, account: Record<string, unknown>, mime: string) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: base64UrlUtf8(mime), threadId: account.gmail_thread_id || undefined })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || 'erro sem detalhe';
    throw new Error(`Gmail send falhou (${response.status}): ${detail}`);
  }
  return { providerMessageId: data.id, providerThreadId: data.threadId };
}

async function sendViaSmtp(account: Record<string, unknown>, password: string, mime: string, to: string, timeoutMs: number) {
  let smtp: SmtpConnection | null = null;
  try {
    smtp = await SmtpConnection.connect(account, timeoutMs);
    await smtp.command('AUTH LOGIN', timeoutMs);
    await smtp.command(base64Utf8(String(account.email_address || account.account_login || '')), timeoutMs);
    await smtp.command(base64Utf8(password), timeoutMs);
    await smtp.command(`MAIL FROM:${escapeSmtpAddress(String(account.email_address))}`, timeoutMs);
    await smtp.command(`RCPT TO:${escapeSmtpAddress(to)}`, timeoutMs);
    await smtp.command('DATA', timeoutMs);
    await smtp.write(`${mime}${CRLF}.${CRLF}`);
    await smtp.readResponse(timeoutMs);
    return { providerMessageId: null, providerThreadId: null };
  } finally {
    await smtp?.close();
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ ok: false, error: 'Método não permitido' }, 405);

  const base44 = createClientFromRequest(req);
  let account: Record<string, unknown> | null = null;

  try {
    const body = await req.json();
    account = await resolveEmailAccount(base44, body);

    if (account.can_send === false) throw new Error('Esta EmailAccount está marcada como can_send=false');

    const to = normalizeEmail(body.to);
    const subject = String(body.subject || '(sem assunto)').trim();
    const textBody = String(body.body || '').trim();
    const threadId = String(body.thread_id || '').trim();
    const timeoutMs = Math.min(Number(body.timeout_ms || DEFAULT_TIMEOUT_MS), MAX_TIMEOUT_MS);

    if (!to) throw new Error('Destinatário obrigatório');
    if (!threadId) throw new Error('thread_id obrigatório');
    if (!textBody) throw new Error('Corpo do e-mail obrigatório');

    const user = await base44.auth.me().catch(() => null);
    const fromEmail = normalizeEmail(account.email_address || body.account_login);
    const fromName = String(body.from_name || account.nome_conta || user?.full_name || user?.nome || fromEmail).trim();
    const messageId = makeMessageId(fromEmail);
    const mime = buildMime({
      fromEmail,
      fromName,
      to,
      subject,
      body: textBody,
      inReplyTo: String(body.in_reply_to || '').trim() || undefined,
      references: String(body.references || '').trim() || undefined,
      messageId
    });

    let providerResult;
    const provider = String(account.provider || '').toLowerCase();
    const authType = String(account.auth_type || '').toLowerCase();

    if (provider === 'gmail' || authType === 'gmail_oauth') {
      providerResult = await sendViaGmail(base44, account, mime);
    } else {
      const secretName = String(body.secret_name || account.password_secret_name || '').trim();
      if (!secretName) throw new Error('EmailAccount sem password_secret_name para envio SMTP');
      const password = Deno.env.get(secretName);
      if (!password) throw new Error(`Secret ${secretName} não encontrado ou vazio`);
      providerResult = await sendViaSmtp(account, password, mime, to, timeoutMs);
    }

    const message = await base44.asServiceRole.entities.Message.create({
      thread_id: threadId,
      sender_id: user?.id || account.owner_user_id || 'email-system',
      sender_type: 'user',
      recipient_type: 'contact',
      content: textBody,
      channel: 'email',
      provider: provider === 'gmail' ? 'email_gmail' : 'email_imap',
      visibility: 'public_to_customer',
      status: 'enviada',
      sent_at: new Date().toISOString(),
      media_type: 'none',
      email_account_id: account.id,
      email_message_id: messageId,
      email_provider: provider === 'gmail' ? 'gmail' : 'imap',
      metadata: {
        email_to: to,
        email_from: fromEmail,
        email_subject: subject,
        provider_message_id: providerResult.providerMessageId,
        provider_thread_id: providerResult.providerThreadId
      }
    });

    await base44.asServiceRole.entities.MessageThread.update(threadId, {
      last_message_content: textBody.slice(0, 200),
      last_message_at: new Date().toISOString(),
      last_sent_at: new Date().toISOString(),
      last_human_message_at: new Date().toISOString(),
      last_message_sender: 'user',
      last_email_message_id: messageId,
      email_account_id: account.id
    });

    await markEmailAccountStatus(base44, account, {
      status: 'conectado',
      last_error: null,
      last_error_at: null,
      last_sync_at: new Date().toISOString()
    });

    return json({ ok: true, message_id: message.id, email_message_id: messageId, provider_message_id: providerResult.providerMessageId });
  } catch (error) {
    const formattedError = formatEmailSendError(error);
    await markEmailAccountStatus(base44, account, {
      status: 'erro',
      last_error: formattedError,
      last_error_at: new Date().toISOString()
    });
    return json({ ok: false, error: formattedError }, 500);
  }
});
