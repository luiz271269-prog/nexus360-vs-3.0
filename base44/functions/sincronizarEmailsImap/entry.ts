import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DEFAULT_TIMEOUT_MS = 20000;
const MAX_MESSAGES = 30;

// CA pública do Zimbra mail.liesch.com.br (pinning embutido)
const ZIMBRA_CA_PEM = `-----BEGIN CERTIFICATE-----
MIIEDjCCAvagAwIBAgIUcUv9ba2i3WzuGehaHCnhk7XUY3UwDQYJKoZIhvcNAQEL
BQAwUDELMAkGA1UECgwCQ0ExJDAiBgNVBAsMG1ppbWJyYSBDb2xsYWJvcmF0aW9u
IFNlcnZlcjEbMBkGA1UEAwwSbWFpbC5saWVzY2guY29tLmJyMB4XDTIyMTIwMzE0
NTkwMFoXDTI3MTIwMjE0NTkwMFowUDELMAkGA1UECgwCQ0ExJDAiBgNVBAsMG1pp
bWJyYSBDb2xsYWJvcmF0aW9uIFNlcnZlcjEbMBkGA1UEAwwSbWFpbC5saWVzY2gu
Y29tLmJyMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuaqG75r3cbxP
9jqpGfmuEKiy1MQt8WyQ95V99DueZv7OcqRj4Uh0enxomPuwYDbwy+HzQQJOyw/u
36xwnHnwGYi5XKsN3vE9i5BfMwPnldmbmHgCdut5Oj4AnsH8CVSb8DcW/DjbKmSa
MLI/MTecBtKuPilgL4GzjEcYD9RPyw0RrJFEDNuS8Va1J3aDmtErWMMs9uzIEGLz
9UBCCl3gSn17O30HYPkjqBNaFQTYwDf52HcaYSfluNo6pW/poRVUMU55KNT69U6g
q44SUpT5dUlaRv+N8ejG38RbFACLIN4MphghjXS6eXJZv/48vR8pFPazQ1xW1P45
O3D3C/a6PwIDAQABo4HfMIHcMB0GA1UdDgQWBBQGU7p3ZkR1aOKu3sd/c0RYVZDu
pzCBjQYDVR0jBIGFMIGCgBQGU7p3ZkR1aOKu3sd/c0RYVZDup6FUpFIwUDELMAkG
A1UECgwCQ0ExJDAiBgNVBAsMG1ppbWJyYSBDb2xsYWJvcmF0aW9uIFNlcnZlcjEb
MBkGA1UEAwwSbWFpbC5saWVzY2guY29tLmJyghRxS/1traLdbO4Z6FocKeGTtdRj
dTAMBgNVHRMEBTADAQH/MB0GA1UdEQQWMBSCEm1haWwubGllc2NoLmNvbS5icjAN
BgkqhkiG9w0BAQsFAAOCAQEAdHgDeFWrDznLXihOQYmk7/LyeBfT3t7sqE34QDZ7
Q6AV9D3OHl3S8RJsgMI1w7ahB2V9ZV6gW6VS1nLG6vWV1wOfT5MLPAQu7kR6uTlj
N/IvugtvaGlMZ/UeBv6st9eWjVENRcox8wdga9fQFbNBFUf+2vO/Z9rXGiF+9kJw
/doa3N/0oeLUaNNOF/MFUT4zIlnlxKjVgvASnhlxwebivmeWHyBLydcqLNXEtmeZ
G7SyX2GuHfe0a+K7oaWFB2jMO5R/EwgC9Drt/SZc2ZHAiO/V/QX/fUPy5l0aIISg
Ss078bl2F03n4kuxrGMgBDenWKiIiUALZw76HQ90tc9Z/Q==
-----END CERTIFICATE-----`;

function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} excedeu ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
}

function escapeImapString(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// Decodifica cabeçalhos MIME "encoded-word" (RFC 2047): =?charset?B/Q?texto?=
function decodeMimeWords(str) {
  if (!str || !str.includes('=?')) return String(str || '');
  try {
    return String(str).replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_, charset, enc, text) => {
      const cs = (charset || 'utf-8').toLowerCase();
      let bytes;
      if (enc.toUpperCase() === 'B') {
        const bin = atob(text.replace(/\s+/g, ''));
        bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      } else {
        // Quoted-printable: _ vira espaço, =XX vira byte
        const qp = text.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
        bytes = Uint8Array.from(qp, (c) => c.charCodeAt(0));
      }
      try {
        return new TextDecoder(cs).decode(bytes);
      } catch {
        return new TextDecoder('utf-8').decode(bytes);
      }
    }).replace(/\?=\s+=\?/g, '').trim();
  } catch {
    return String(str);
  }
}

function normalizarAssunto(assunto) {
  return String(assunto || '')
    .replace(/^(\s*(re|fwd|fw|enc|res)\s*:\s*)+/gi, '')
    .trim()
    .toLowerCase();
}

function extrairEmail(fromHeader) {
  const m = String(fromHeader || '').match(/<([^>]+)>/);
  const email = (m ? m[1] : fromHeader).trim().toLowerCase();
  return email;
}

function extrairNome(fromHeader) {
  const raw = String(fromHeader || '').trim();
  const m = raw.match(/^"?([^"<]+?)"?\s*</);
  return m ? m[1].trim() : '';
}

function parseHeaderBlocks(lines, limit) {
  const messages = [];
  let current = null;
  let currentHeader = '';
  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    if (/^\*\s+\d+\s+FETCH\b/i.test(line)) {
      if (current) messages.push(current);
      current = {};
      currentHeader = '';
      const uidMatch = line.match(/\bUID\s+(\d+)/i);
      if (uidMatch) current.uid = uidMatch[1];
      continue;
    }
    if (!current) continue;
    if (/^\)$/i.test(line) || /^A\d+\s+(OK|NO|BAD)\b/i.test(line)) continue;
    if (/^\s/.test(line) && currentHeader) {
      current[currentHeader] = `${current[currentHeader]} ${line.trim()}`.trim();
      continue;
    }
    const headerMatch = line.match(/^([A-Za-z0-9-]+):\s*(.*)$/);
    if (headerMatch) {
      const key = headerMatch[1].toLowerCase();
      currentHeader = key;
      current[key] = headerMatch[2].trim();
    }
  }
  if (current) messages.push(current);
  return messages.slice(-limit);
}

class ImapConnection {
  constructor(conn) {
    this.conn = conn;
    this.decoder = new TextDecoder();
    this.encoder = new TextEncoder();
    this.buffer = '';
    this.tagCounter = 1;
    this.greeting = '';
  }

  static async connect({ hostname, port, timeoutMs, security, caCerts }) {
    if (security === 'starttls') {
      const plainConn = await withTimeout(Deno.connect({ hostname, port }), timeoutMs, `TCP ${hostname}:${port}`);
      const imap = new ImapConnection(plainConn);
      imap.greeting = await imap.readGreeting(timeoutMs);
      await imap.command('STARTTLS', timeoutMs);
      const tlsConn = await withTimeout(Deno.startTls(plainConn, { hostname, caCerts }), timeoutMs, `STARTTLS ${hostname}`);
      imap.conn = tlsConn;
      imap.buffer = '';
      return imap;
    }
    const conn = await withTimeout(Deno.connectTls({ hostname, port, caCerts }), timeoutMs, `TLS ${hostname}:${port}`);
    const imap = new ImapConnection(conn);
    imap.greeting = await imap.readGreeting(timeoutMs);
    return imap;
  }

  close() {
    try { this.conn.close(); } catch { /* já encerrada */ }
  }

  async readLine(timeoutMs) {
    while (!this.buffer.includes('\r\n')) {
      const chunk = new Uint8Array(4096);
      const bytesRead = await withTimeout(this.conn.read(chunk), timeoutMs, 'Leitura IMAP');
      if (bytesRead === null) {
        if (!this.buffer) return null;
        const tail = this.buffer;
        this.buffer = '';
        return tail;
      }
      this.buffer += this.decoder.decode(chunk.subarray(0, bytesRead), { stream: true });
    }
    const lineEnd = this.buffer.indexOf('\r\n');
    const line = this.buffer.slice(0, lineEnd);
    this.buffer = this.buffer.slice(lineEnd + 2);
    return line;
  }

  async readGreeting(timeoutMs) {
    const greeting = await this.readLine(timeoutMs);
    if (!greeting || !/^\*\s+OK\b/i.test(greeting)) {
      throw new Error(`Greeting IMAP inválido: ${greeting || 'sem resposta'}`);
    }
    return greeting;
  }

  async command(commandText, timeoutMs) {
    const tag = `A${String(this.tagCounter++).padStart(4, '0')}`;
    await withTimeout(this.conn.write(this.encoder.encode(`${tag} ${commandText}\r\n`)), timeoutMs, 'Envio IMAP');
    const lines = [];
    while (true) {
      const line = await this.readLine(timeoutMs);
      if (line === null) throw new Error(`Conexão encerrada antes de finalizar ${tag}`);
      lines.push(line);
      if (line.startsWith(`${tag} `)) {
        if (!new RegExp(`^${tag}\\s+OK\\b`, 'i').test(line)) {
          throw new Error(`Comando IMAP falhou: ${line}`);
        }
        return lines;
      }
    }
  }
}

Deno.serve(async (req) => {
  let imap = null;
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const db = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));

    // Resolve a conta a sincronizar (por id ou por email_address)
    let conta = null;
    if (body.email_account_id) {
      conta = await db.EmailAccount.get(body.email_account_id).catch(() => null);
    } else if (body.email_address) {
      const achadas = await db.EmailAccount.filter({ email_address: String(body.email_address).toLowerCase().trim() }, '-created_date', 1);
      conta = achadas && achadas[0];
    }
    if (!conta) return Response.json({ error: 'Conta de e-mail não encontrada. Informe email_account_id ou email_address.' }, { status: 400 });

    const host = conta.imap_host;
    const username = conta.email_address;
    const port = Number(conta.imap_port || 993);
    const security = String(conta.imap_security || (port === 143 ? 'starttls' : 'tls')).toLowerCase();
    const mailbox = conta.imap_mailbox || 'INBOX';
    const maxMessages = Math.min(Number(body.max_messages || MAX_MESSAGES), MAX_MESSAGES);
    const timeoutMs = DEFAULT_TIMEOUT_MS;

    // Senha: secret da conta OU senha inline (somente para teste manual)
    const inlinePassword = typeof body.password === 'string' ? body.password : '';
    const password = inlinePassword || (conta.password_secret_name ? Deno.env.get(conta.password_secret_name) : null);
    if (!password) {
      return Response.json({ error: `Senha indisponível. Defina password_secret_name na conta ou envie password no payload.` }, { status: 400 });
    }

    const useEmbeddedCa = String(host || '').includes('liesch.com.br');
    const caCerts = useEmbeddedCa ? [ZIMBRA_CA_PEM] : undefined;

    imap = await ImapConnection.connect({ hostname: host, port, timeoutMs, security, caCerts });
    await imap.command('CAPABILITY', timeoutMs);

    const saslPlain = btoa(`\u0000${username}\u0000${password}`);
    try {
      await imap.command(`AUTHENTICATE PLAIN ${saslPlain}`, timeoutMs);
    } catch {
      try { imap.close(); } catch { /* ignore */ }
      imap = await ImapConnection.connect({ hostname: host, port, timeoutMs, security, caCerts });
      await imap.command('CAPABILITY', timeoutMs);
      await imap.command(`LOGIN "${escapeImapString(username)}" "${escapeImapString(password)}"`, timeoutMs);
    }

    await imap.command(`SELECT "${escapeImapString(mailbox)}"`, timeoutMs);
    const searchLines = await imap.command('UID SEARCH ALL', timeoutMs);
    const uidLine = searchLines.find((l) => /^\*\s+SEARCH\b/i.test(l)) || '';
    const allUids = uidLine.replace(/^\*\s+SEARCH\s*/i, '').trim().split(/\s+/).filter(Boolean).map(Number).filter(Number.isFinite);

    // Incremental: só UIDs maiores que o último processado
    const lastUidSeen = Number(conta.last_uid_seen || 0);
    const novosUids = allUids.filter((u) => u > lastUidSeen).slice(-maxMessages);

    let emails = [];
    if (novosUids.length > 0) {
      const fetchLines = await imap.command(
        `UID FETCH ${novosUids.join(',')} (UID BODY.PEEK[HEADER.FIELDS (SUBJECT FROM DATE MESSAGE-ID)])`,
        timeoutMs
      );
      emails = parseHeaderBlocks(fetchLines, maxMessages).map((m) => ({
        uid: m.uid,
        from: decodeMimeWords(m.from || ''),
        subject: decodeMimeWords(m.subject) || '(sem assunto)',
        date: m.date || '',
        message_id: (m['message-id'] || '').replace(/[<>]/g, '').trim()
      }));
    }

    await imap.command('LOGOUT', timeoutMs).catch(() => []);

    // Processa cada e-mail: dedup + match CRM + status de aprovação
    let novos = 0, autoAprovados = 0, pendentes = 0, duplicados = 0;
    let maiorUid = lastUidSeen;

    for (const e of emails) {
      const uidNum = Number(e.uid);
      if (Number.isFinite(uidNum) && uidNum > maiorUid) maiorUid = uidNum;

      // Dedup por (account_login + message_uid)
      const jaExiste = await db.EmailSincronizado.filter({
        account_login: username,
        message_uid: String(e.uid)
      }, '-created_date', 1);
      if (jaExiste && jaExiste.length > 0) { duplicados++; continue; }

      const remetenteEmail = extrairEmail(e.from);
      const remetenteNome = extrairNome(e.from);

      // Match no CRM: Contact (email principal) e Cliente
      let contactMatch = null;
      let clienteMatch = null;
      if (remetenteEmail) {
        const contatos = await db.Contact.filter({ email: remetenteEmail }, '-created_date', 1);
        contactMatch = contatos && contatos[0];
        const clientes = await db.Cliente.filter({ email: remetenteEmail }, '-created_date', 1).catch(() => []);
        clienteMatch = clientes && clientes[0];
      }

      const conhecido = !!(contactMatch || clienteMatch);
      const vinculoTipo = contactMatch && clienteMatch ? 'ambos' : (contactMatch ? 'contact' : (clienteMatch ? 'cliente' : undefined));

      await db.EmailSincronizado.create({
        account_login: username,
        account_tipo: conta.provider || 'zimbra',
        owner_user_id: (conta.assigned_user_ids && conta.assigned_user_ids[0]) || undefined,
        message_uid: String(e.uid),
        email_message_id: e.message_id || undefined,
        remetente_email: remetenteEmail,
        remetente_nome: remetenteNome,
        assunto: e.subject,
        corpo_preview: '',
        data_email: e.date,
        contact_id: contactMatch ? contactMatch.id : undefined,
        cliente_id: clienteMatch ? clienteMatch.id : undefined,
        vinculo_tipo: vinculoTipo,
        status_aprovacao: conhecido ? 'auto_aprovado' : 'pendente'
      });

      novos++;
      if (conhecido) autoAprovados++; else pendentes++;
    }

    // Atualiza ponteiro incremental da conta
    await db.EmailAccount.update(conta.id, {
      last_uid_seen: maiorUid,
      last_sync_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      status: 'active'
    });

    return Response.json({
      ok: true,
      conta: username,
      total_no_servidor: allUids.length,
      novos_processados: novos,
      auto_aprovados: autoAprovados,
      pendentes_aprovacao: pendentes,
      duplicados_ignorados: duplicados,
      last_uid_seen: maiorUid
    });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  } finally {
    if (imap) imap.close();
  }
});