import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DEFAULT_IMAP_PORT = 993;
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_PREVIEW_MESSAGES = 5;
type ImapSecurityMode = 'tls' | 'starttls';

interface ImapConnectOptions {
  hostname: string;
  port: number;
  timeoutMs: number;
  security: ImapSecurityMode;
  tlsHostname?: string;
  caCerts?: string[];
}

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: jsonHeaders
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} excedeu ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
}

function escapeImapString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function sanitizeLine(line: string) {
  return line
    .replace(/LOGIN\s+"[^"]*"\s+"[^"]*"/gi, 'LOGIN "***" "***"')
    .replace(/AUTHENTICATE\s+\S+/gi, 'AUTHENTICATE ***');
}

function resolveSecurityMode(value: string): ImapSecurityMode {
  if (value === 'tls' || value === 'starttls') return value;
  throw new Error(`Modo de segurança IMAP inválido: ${value}. Use tls ou starttls.`);
}

function parsePemCertificates(value: string, sourceLabel: string) {
  const blocks = value.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || [];
  if (blocks.length === 0) {
    throw new Error(`${sourceLabel} não contém um bloco PEM válido de certificado.`);
  }
  return blocks;
}

function readCaCerts(secretName: string, inlinePem: string) {
  if (inlinePem) {
    return parsePemCertificates(inlinePem, 'ca_cert_pem');
  }

  if (!secretName) return undefined;
  const caCert = Deno.env.get(secretName);
  if (!caCert) {
    throw new Error(`Secret de certificado ${secretName} não encontrado ou vazio.`);
  }
  return parsePemCertificates(caCert, `Secret de certificado ${secretName}`);
}

function buildErrorHint(errorMessage: string) {
  if (/UnknownIssuer|invalid peer certificate|certificate/i.test(errorMessage)) {
    return 'Conexão TCP/STARTTLS chegou ao servidor, mas o certificado não é confiável para o Deno. Cadastre o certificado público/CA do Zimbra em um secret e envie ca_cert_secret_name no payload.';
  }

  if (/STARTTLS/i.test(errorMessage)) {
    return 'A porta respondeu, mas o upgrade STARTTLS falhou. Confirme se a porta suporta STARTTLS IMAP ou teste security=tls na porta 993.';
  }

  if (/IP address|not valid for name|certificate is not valid|CertNotValidForName/i.test(errorMessage)) {
    return 'O certificado não corresponde ao IP usado como host. Envie tls_hostname/server_name com o DNS presente no certificado, por exemplo mail.liesch.com.br, mantendo host como IP se necessário.';
  }

  return 'Se o erro for timeout/conexão, o servidor IMAP pode estar bloqueando a origem externa. Se o erro for certificado, cadastre o PEM público/CA no secret e use ca_cert_secret_name ou envie ca_cert_pem apenas para diagnóstico.';
}

function parseHeaderBlocks(lines: string[]) {
  const messages: Array<Record<string, string>> = [];
  let current: Record<string, string> | null = null;
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

    if (/^\)$/i.test(line) || /^A\d+\s+(OK|NO|BAD)\b/i.test(line)) {
      continue;
    }

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
  return messages.slice(-MAX_PREVIEW_MESSAGES);
}

class ImapConnection {
  private conn: Deno.Conn;
  private decoder = new TextDecoder();
  private encoder = new TextEncoder();
  private buffer = '';
  private tagCounter = 1;
  readonly transcript: string[] = [];
  greeting = '';

  constructor(conn: Deno.Conn) {
    this.conn = conn;
  }

  static async connect(options: ImapConnectOptions) {
    const { hostname, port, timeoutMs, security, tlsHostname, caCerts } = options;
    const certificateHostname = tlsHostname || hostname;

    if (security === 'starttls') {
      const plainConn = await withTimeout(
        Deno.connect({ hostname, port }),
        timeoutMs,
        `Conexão TCP IMAP com ${hostname}:${port}`
      );
      const imap = new ImapConnection(plainConn);
      imap.greeting = await imap.readGreeting(timeoutMs);
      await imap.command('STARTTLS', timeoutMs);

      const tlsConn = await withTimeout(
        Deno.startTls(plainConn, { hostname: certificateHostname, caCerts }),
        timeoutMs,
        `Upgrade STARTTLS com ${hostname}:${port}`
      );
      imap.conn = tlsConn;
      imap.buffer = '';
      return imap;
    }

    const plainConn = await withTimeout(
      Deno.connect({ hostname, port }),
      timeoutMs,
      `Conexão TCP IMAP com ${hostname}:${port}`
    );
    const tlsConn = await withTimeout(
      Deno.startTls(plainConn, { hostname: certificateHostname, caCerts }),
      timeoutMs,
      `Handshake TLS IMAP com ${hostname}:${port}`
    );
    const imap = new ImapConnection(tlsConn);
    imap.greeting = await imap.readGreeting(timeoutMs);
    return imap;
  }

  close() {
    try {
      this.conn.close();
    } catch {
      // conexão já encerrada
    }
  }

  async readLine(timeoutMs: number) {
    while (!this.buffer.includes('\r\n')) {
      const chunk = new Uint8Array(4096);
      const bytesRead = await withTimeout(
        this.conn.read(chunk),
        timeoutMs,
        'Leitura da resposta IMAP'
      );

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
    this.transcript.push(sanitizeLine(line));
    return line;
  }

  async readGreeting(timeoutMs: number) {
    const greeting = await this.readLine(timeoutMs);
    if (!greeting || !/^\*\s+OK\b/i.test(greeting)) {
      throw new Error(`Servidor não retornou greeting IMAP OK: ${greeting || 'sem resposta'}`);
    }
    return greeting;
  }

  async command(commandText: string, timeoutMs: number) {
    const tag = `A${String(this.tagCounter++).padStart(4, '0')}`;
    const fullCommand = `${tag} ${commandText}\r\n`;
    this.transcript.push(`> ${sanitizeLine(fullCommand.trim())}`);
    await withTimeout(
      this.conn.write(this.encoder.encode(fullCommand)),
      timeoutMs,
      'Envio do comando IMAP'
    );

    const lines: string[] = [];
    while (true) {
      const line = await this.readLine(timeoutMs);
      if (line === null) throw new Error(`Conexão encerrada antes de finalizar ${tag}`);
      lines.push(line);

      if (line.startsWith(`${tag} `)) {
        if (!new RegExp(`^${tag}\\s+OK\\b`, 'i').test(line)) {
          throw new Error(`Comando IMAP falhou: ${sanitizeLine(line)}`);
        }
        return lines;
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: jsonHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido. Use POST.' }, 405);
  }

  let imap: ImapConnection | null = null;

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const host = String(body.host || body.imap_host || '').trim();
    const username = String(body.username || body.email || '').trim();
    const passwordSecretName = String(body.password_secret_name || body.secret_name || '').trim();
    const port = Number(body.port || body.imap_port || DEFAULT_IMAP_PORT);
    const timeoutMs = Number(body.timeout_ms || DEFAULT_TIMEOUT_MS);
    const mailbox = String(body.mailbox || 'INBOX').trim() || 'INBOX';
    const maxMessages = Math.min(Number(body.max_messages || MAX_PREVIEW_MESSAGES), MAX_PREVIEW_MESSAGES);
    const security = resolveSecurityMode(
      String(body.security || (port === 143 ? 'starttls' : 'tls')).trim().toLowerCase()
    );
    const caCertSecretName = String(body.ca_cert_secret_name || body.ca_secret_name || '').trim();
    const inlineCaCertPem = String(body.ca_cert_pem || body.ca_pem || '').trim();
    const tlsHostname = String(body.tls_hostname || body.server_name || body.sni_hostname || host).trim();
    const caCerts = readCaCerts(caCertSecretName, inlineCaCertPem);

    if (!host || !username || !passwordSecretName) {
      return jsonResponse({
        error: 'Parâmetros obrigatórios ausentes.',
        required: ['host', 'username', 'password_secret_name'],
        example: {
          host: '201.76.14.230',
          port: 993,
          security: 'tls',
          tls_hostname: 'mail.seudominio.com.br',
          username: 'caixa@seudominio.com.br',
          password_secret_name: 'ZIMBRA_PWD_CAIXA_TESTE',
          ca_cert_secret_name: 'ZIMBRA_CA_CERT',
          mailbox: 'INBOX'
        }
      }, 400);
    }

    const password = Deno.env.get(passwordSecretName);
    if (!password) {
      return jsonResponse({
        error: `Secret ${passwordSecretName} não encontrado ou vazio. Cadastre a senha no cofre/secrets antes do teste.`
      }, 400);
    }

    const startedAt = new Date().toISOString();
    imap = await ImapConnection.connect({
      hostname: host,
      port,
      timeoutMs,
      security,
      tlsHostname,
      caCerts
    });
    const greeting = imap.greeting;

    await imap.command('CAPABILITY', timeoutMs);
    await imap.command(`LOGIN "${escapeImapString(username)}" "${escapeImapString(password)}"`, timeoutMs);
    const selectLines = await imap.command(`SELECT "${escapeImapString(mailbox)}"`, timeoutMs);
    const uidValidity = selectLines
      .map((line) => line.match(/UIDVALIDITY\s+(\d+)/i)?.[1])
      .find(Boolean) || null;

    const searchLines = await imap.command('UID SEARCH ALL', timeoutMs);
    const uidLine = searchLines.find((line) => /^\*\s+SEARCH\b/i.test(line)) || '';
    const allUids = uidLine
      .replace(/^\*\s+SEARCH\s*/i, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((uid) => Number(uid))
      .filter((uid) => Number.isFinite(uid));

    const lastUids = allUids.slice(-maxMessages);
    let previews: Array<Record<string, string>> = [];

    if (lastUids.length > 0) {
      const fetchLines = await imap.command(
        `UID FETCH ${lastUids.join(',')} (UID BODY.PEEK[HEADER.FIELDS (SUBJECT FROM DATE MESSAGE-ID)])`,
        timeoutMs
      );
      previews = parseHeaderBlocks(fetchLines);
    }

    await imap.command('LOGOUT', timeoutMs).catch(() => []);

    return jsonResponse({
      ok: true,
      checked_at: new Date().toISOString(),
      started_at: startedAt,
      host,
      port,
      security,
      tls_hostname: tlsHostname,
      ca_cert_configured: Boolean(caCertSecretName || inlineCaCertPem),
      ca_cert_source: inlineCaCertPem ? 'payload' : caCertSecretName ? 'secret' : 'default_trust_store',
      mailbox,
      username,
      greeting: sanitizeLine(greeting),
      uidvalidity: uidValidity,
      total_uids_found: allUids.length,
      last_uid_seen: allUids.length ? Math.max(...allUids) : null,
      preview_count: previews.length,
      previews,
      transcript_preview: imap.transcript.slice(-40)
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      hint: buildErrorHint(error instanceof Error ? error.message : String(error)),
      transcript_preview: imap?.transcript.slice(-40) || []
    }, 500);
  } finally {
    if (imap) imap.close();
  }
});
