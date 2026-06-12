import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DEFAULT_IMAP_PORT = 993;
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_PREVIEW_MESSAGES = 5;

// Certificado público/CA do Zimbra mail.liesch.com.br.
// Usar apenas quando `use_embedded_ca: true`; o caminho preferencial continua sendo ca_cert_secret_name.
const LIESCH_ZIMBRA_CA_PEM = `-----BEGIN CERTIFICATE-----
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
type ImapSecurityMode = 'tls' | 'starttls';
type ImapAuthMode = 'login' | 'plain' | 'plain_then_login' | 'login_then_plain';

interface ImapCommandResult {
  ok: boolean;
  lines: string[];
  statusLine: string;
  error?: string;
}

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

function resolveAuthMode(value: string): ImapAuthMode {
  if (value === 'login' || value === 'plain' || value === 'plain_then_login' || value === 'login_then_plain') {
    return value;
  }
  throw new Error(`Modo de autenticação IMAP inválido: ${value}. Use login, plain, plain_then_login ou login_then_plain.`);
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function buildAuthenticatePlainPayload(username: string, password: string) {
  return bytesToBase64(new TextEncoder().encode(`\0${username}\0${password}`));
}

function normalizePemCertificateBlock(block: string) {
  const normalizedNewlines = block.replace(/\\n/g, '\n').trim();
  const match = normalizedNewlines.match(/-----BEGIN CERTIFICATE-----\s*([\s\S]*?)\s*-----END CERTIFICATE-----/);
  if (!match) return normalizedNewlines;

  const body = match[1].replace(/\s+/g, '');
  if (!body) return normalizedNewlines;

  const wrappedBody = body.match(/.{1,64}/g)?.join('\n') || body;
  return `-----BEGIN CERTIFICATE-----\n${wrappedBody}\n-----END CERTIFICATE-----`;
}

function parsePemCertificates(value: string, sourceLabel: string) {
  const normalizedInput = value.replace(/\\n/g, '\n');
  const blocks = normalizedInput.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || [];
  if (blocks.length === 0) {
    throw new Error(`${sourceLabel} não contém um bloco PEM válido de certificado.`);
  }
  return blocks.map(normalizePemCertificateBlock);
}

function readCaCerts(secretName: string, inlinePem: string, useEmbeddedCa = false) {
  if (inlinePem) {
    return parsePemCertificates(inlinePem, 'ca_cert_pem');
  }

  if (useEmbeddedCa) {
    return parsePemCertificates(LIESCH_ZIMBRA_CA_PEM, 'CA embutida mail.liesch.com.br');
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
    return 'Conexão TCP/STARTTLS chegou ao servidor, mas o certificado não é confiável para o Deno. Cadastre o certificado público/CA do Zimbra em um secret e envie ca_cert_secret_name no payload. A função normaliza PEM em linha única, mas o conteúdo precisa conter BEGIN/END CERTIFICATE válidos.';
  }

  if (/STARTTLS/i.test(errorMessage)) {
    return 'A porta respondeu, mas o upgrade STARTTLS falhou. Confirme se a porta suporta STARTTLS IMAP ou teste security=tls na porta 993.';
  }

  if (/IP address|not valid for name|certificate is not valid|CertNotValidForName/i.test(errorMessage)) {
    return 'O certificado não corresponde ao IP usado como host. Envie tls_hostname/server_name com o DNS presente no certificado, por exemplo mail.liesch.com.br, mantendo host como IP se necessário.';
  }

  return 'Se o erro for timeout/conexão, o servidor IMAP pode estar bloqueando a origem externa. Se o erro for certificado, cadastre o PEM público/CA no secret e use ca_cert_secret_name ou envie ca_cert_pem apenas para diagnóstico.';
}

function summarizeCommandResult(result: ImapCommandResult | null) {
  if (!result) return { attempted: false, ok: false };
  return {
    attempted: true,
    ok: result.ok,
    status_line: result.statusLine,
    error: result.error || null
  };
}

function diagnoseAuthFailure(authPlain: ImapCommandResult | null, login: ImapCommandResult | null) {
  if (authPlain?.ok || login?.ok) return 'auth_ok';

  const combined = [authPlain?.error, authPlain?.statusLine, login?.error, login?.statusLine]
    .filter(Boolean)
    .join(' ');

  if (/BAD internal server error/i.test(combined)) {
    return 'server_side_imap_proxy_or_imapd';
  }

  if (/AUTHENTICATE|authentication|auth|credentials|password|login failed|invalid/i.test(combined)) {
    return 'invalid_credentials_or_auth_policy';
  }

  return 'imap_auth_failed';
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

  async commandResult(commandText: string, timeoutMs: number): Promise<ImapCommandResult> {
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
      if (line === null) {
        const error = `Conexão encerrada antes de finalizar ${tag}`;
        return { ok: false, lines, statusLine: error, error };
      }
      lines.push(line);

      if (line.startsWith(`${tag} `)) {
        const ok = new RegExp(`^${tag}\\s+OK\\b`, 'i').test(line);
        return {
          ok,
          lines,
          statusLine: sanitizeLine(line),
          error: ok ? undefined : sanitizeLine(line.replace(new RegExp(`^${tag}\\s+`, 'i'), ''))
        };
      }
    }
  }

  async authenticatePlain(username: string, password: string, timeoutMs: number): Promise<ImapCommandResult> {
    const tag = `A${String(this.tagCounter++).padStart(4, '0')}`;
    const commandText = `${tag} AUTHENTICATE PLAIN\r\n`;
    this.transcript.push(`> ${sanitizeLine(commandText.trim())}`);
    await withTimeout(
      this.conn.write(this.encoder.encode(commandText)),
      timeoutMs,
      'Envio do comando AUTHENTICATE PLAIN'
    );

    const lines: string[] = [];
    while (true) {
      const line = await this.readLine(timeoutMs);
      if (line === null) {
        const error = `Conexão encerrada antes de finalizar ${tag}`;
        return { ok: false, lines, statusLine: error, error };
      }
      lines.push(line);

      if (/^\+/.test(line)) {
        const payload = `${buildAuthenticatePlainPayload(username, password)}\r\n`;
        this.transcript.push('> AUTHENTICATE PLAIN ***');
        await withTimeout(
          this.conn.write(this.encoder.encode(payload)),
          timeoutMs,
          'Envio do payload AUTHENTICATE PLAIN'
        );
        continue;
      }

      if (line.startsWith(`${tag} `)) {
        const ok = new RegExp(`^${tag}\\s+OK\\b`, 'i').test(line);
        return {
          ok,
          lines,
          statusLine: sanitizeLine(line),
          error: ok ? undefined : sanitizeLine(line.replace(new RegExp(`^${tag}\\s+`, 'i'), ''))
        };
      }
    }
  }

  async command(commandText: string, timeoutMs: number) {
    const result = await this.commandResult(commandText, timeoutMs);
    if (!result.ok) {
      throw new Error(`Comando IMAP falhou: ${result.statusLine}`);
    }
    return result.lines;
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
    if (user.role !== 'admin') {
      return jsonResponse({ error: 'Forbidden: Admin access required' }, 403);
    }

    const body = await req.json().catch(() => ({}));

    if (body.email_account_id) {
      const contas = await base44.asServiceRole.entities.EmailAccount.filter({ id: String(body.email_account_id) });
      const conta = contas?.[0];
      if (!conta) {
        return jsonResponse({ error: `EmailAccount ${body.email_account_id} não encontrado.` }, 404);
      }
      body.host = body.host || conta.imap_host;
      body.username = body.username || conta.email_address;
      body.port = body.port || conta.imap_port;
      body.security = body.security || conta.imap_security;
      body.tls_hostname = body.tls_hostname || conta.imap_tls_hostname;
      body.password_secret_name = body.password_secret_name || conta.password_secret_name;
      body.ca_cert_secret_name = body.ca_cert_secret_name || conta.ca_cert_secret_name;
      if (body.use_embedded_ca === undefined && /(^|\.)liesch\.com\.br$/i.test(String(conta.imap_host || ''))) {
        body.use_embedded_ca = true;
      }
    }

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
    const authMode = resolveAuthMode(String(body.auth_mode || 'plain_then_login').trim().toLowerCase());
    const caCertSecretName = String(body.ca_cert_secret_name || body.ca_secret_name || '').trim();
    const inlineCaCertPem = String(body.ca_cert_pem || body.ca_pem || '').trim();
    const tlsHostname = String(body.tls_hostname || body.server_name || body.sni_hostname || host).trim();
    const useEmbeddedCa = body.use_embedded_ca === true;
    const caCerts = readCaCerts(caCertSecretName, inlineCaCertPem, useEmbeddedCa);

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
          mailbox: 'INBOX',
          auth_mode: 'plain_then_login',
          use_embedded_ca: false
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
    const transcriptHistory: string[] = [];

    const connectAndCapability = async () => {
      const connection = await ImapConnection.connect({
        hostname: host,
        port,
        timeoutMs,
        security,
        tlsHostname,
        caCerts
      });
      const capabilities = await connection.command('CAPABILITY', timeoutMs);
      const capability = capabilities.find((line) => /^\*\s+CAPABILITY\b/i.test(line)) || '';
      return { connection, capability };
    };

    const firstConnect = await connectAndCapability();
    imap = firstConnect.connection;
    const greeting = imap.greeting;
    let capabilityLine = firstConnect.capability;
    const supportsPlain = () => /\bAUTH=PLAIN\b/i.test(capabilityLine);
    let authPlainResult: ImapCommandResult | null = null;
    let loginResult: ImapCommandResult | null = null;

    const reconnect = async () => {
      if (imap) {
        transcriptHistory.push(...imap.transcript);
        imap.close();
      }
      const next = await connectAndCapability();
      imap = next.connection;
      capabilityLine = next.capability;
    };

    const tryPlain = async () => {
      authPlainResult = await imap!.authenticatePlain(username, password, timeoutMs);
      return authPlainResult.ok;
    };

    const tryLogin = async () => {
      loginResult = await imap!.commandResult(
        `LOGIN "${escapeImapString(username)}" "${escapeImapString(password)}"`,
        timeoutMs
      );
      return loginResult.ok;
    };

    let authenticated = false;
    if (authMode === 'plain') {
      authenticated = await tryPlain();
    } else if (authMode === 'login') {
      authenticated = await tryLogin();
    } else if (authMode === 'plain_then_login') {
      authenticated = await tryPlain();
      if (!authenticated) {
        await reconnect();
        authenticated = await tryLogin();
      }
    } else {
      authenticated = await tryLogin();
      if (!authenticated) {
        await reconnect();
        authenticated = await tryPlain();
      }
    }

    const transcriptPreview = () => [...transcriptHistory, ...(imap?.transcript || [])].slice(-40);

    if (!authenticated) {
      return jsonResponse({
        ok: false,
        stage: 'auth',
        checked_at: new Date().toISOString(),
        started_at: startedAt,
        host,
        port,
        security,
        tls_ok: true,
        capability_ok: true,
        auth_mode: authMode,
        supports_auth_plain: supportsPlain(),
        auth_plain: summarizeCommandResult(authPlainResult),
        login: summarizeCommandResult(loginResult),
        diagnosis: diagnoseAuthFailure(authPlainResult, loginResult),
        transcript_preview: transcriptPreview()
      }, 500);
    }

    const selectResult = await imap.commandResult(`SELECT "${escapeImapString(mailbox)}"`, timeoutMs);
    if (!selectResult.ok) {
      return jsonResponse({
        ok: false,
        stage: 'select_mailbox',
        checked_at: new Date().toISOString(),
        started_at: startedAt,
        host,
        port,
        security,
        tls_ok: true,
        capability_ok: true,
        auth_mode: authMode,
        supports_auth_plain: supportsPlain(),
        auth_plain: summarizeCommandResult(authPlainResult),
        login: summarizeCommandResult(loginResult),
        select_inbox_result: summarizeCommandResult(selectResult),
        diagnosis: 'mailbox_select_failed',
        transcript_preview: transcriptPreview()
      }, 500);
    }

    const uidValidity = selectResult.lines
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
      auth_mode: authMode,
      tls_hostname: tlsHostname,
      ca_cert_configured: Boolean(caCertSecretName || inlineCaCertPem || useEmbeddedCa),
      ca_cert_source: inlineCaCertPem ? 'payload' : useEmbeddedCa ? 'embedded_liesch' : caCertSecretName ? 'secret' : 'default_trust_store',
      mailbox,
      username,
      greeting: sanitizeLine(greeting),
      tls_ok: true,
      capability_ok: true,
      supports_auth_plain: supportsPlain(),
      auth_plain: summarizeCommandResult(authPlainResult),
      login: summarizeCommandResult(loginResult),
      select_inbox_result: summarizeCommandResult(selectResult),
      uidvalidity: uidValidity,
      total_uids_found: allUids.length,
      last_uid_seen: allUids.length ? allUids.reduce((max, uid) => uid > max ? uid : max, allUids[0]) : null,
      preview_count: previews.length,
      previews,
      transcript_preview: transcriptPreview()
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
