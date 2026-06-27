import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const DEFAULT_IMAP_PORT = 993;
const DEFAULT_TIMEOUT_MS = 15000;
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

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

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
  if (req.method !== 'POST') return jsonResponse({ error: 'Use POST' }, 405);
  let imap = null;
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);
    if (user.role !== 'admin') return jsonResponse({ error: 'Forbidden: Admin access required' }, 403);

    const body = await req.json().catch(() => ({}));
    const host = String(body.host || body.imap_host || '').trim();
    const username = String(body.username || body.email || '').trim();
    const passwordSecretName = String(body.password_secret_name || '').trim();
    const inlinePassword = typeof body.password === 'string' ? body.password : '';
    const port = Number(body.port || body.imap_port || DEFAULT_IMAP_PORT);
    const timeoutMs = Number(body.timeout_ms || DEFAULT_TIMEOUT_MS);
    const mailbox = String(body.mailbox || 'INBOX').trim() || 'INBOX';
    const maxMessages = Math.min(Number(body.max_messages || MAX_MESSAGES), MAX_MESSAGES);
    const security = String(body.security || (port === 143 ? 'starttls' : 'tls')).trim().toLowerCase();
    const useEmbeddedCa = body.use_embedded_ca === true || host.includes('liesch.com.br');
    const caCerts = useEmbeddedCa ? [ZIMBRA_CA_PEM] : undefined;

    if (!host || !username || (!passwordSecretName && !inlinePassword)) {
      return jsonResponse({ error: 'Parâmetros obrigatórios: host, username, password (ou password_secret_name).' }, 400);
    }
    const password = inlinePassword || Deno.env.get(passwordSecretName);
    if (!password) return jsonResponse({ error: `Secret ${passwordSecretName} não encontrado.` }, 400);

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
    const lastUids = allUids.slice(-maxMessages);

    let emails = [];
    if (lastUids.length > 0) {
      const fetchLines = await imap.command(
        `UID FETCH ${lastUids.join(',')} (UID BODY.PEEK[HEADER.FIELDS (SUBJECT FROM DATE)])`,
        timeoutMs
      );
      emails = parseHeaderBlocks(fetchLines, maxMessages).map((m) => ({
        uid: m.uid,
        from: m.from || '',
        subject: m.subject || '(sem assunto)',
        date: m.date || ''
      })).reverse();
    }

    await imap.command('LOGOUT', timeoutMs).catch(() => []);

    return jsonResponse({ ok: true, host, username, mailbox, total: allUids.length, count: emails.length, emails });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  } finally {
    if (imap) imap.close();
  }
});