import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
// redeploy bump: recarregar secrets de e-mail (EMAIL_PWD_*)

const DEFAULT_IMAP_PORT = 993;
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_PREVIEW_MESSAGES = 5;

// CA pública do Zimbra mail.liesch.com.br (pinning embutido — evita corrupção de secret)
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

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: jsonHeaders
  });
}

function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} excedeu ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
}

function escapeImapString(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function sanitizeLine(line) {
  return line
    .replace(/LOGIN\s+"[^"]*"\s+"[^"]*"/gi, 'LOGIN "***" "***"')
    .replace(/AUTHENTICATE\s+\S+/gi, 'AUTHENTICATE ***');
}

function resolveSecurityMode(value) {
  if (value === 'tls' || value === 'starttls') return value;
  throw new Error(`Modo de segurança IMAP inválido: ${value}. Use tls ou starttls.`);
}

function normalizeToPem(raw) {
  const trimmed = raw.trim();
  // Já está em formato PEM completo
  if (trimmed.includes('-----BEGIN CERTIFICATE-----')) {
    return trimmed;
  }
  // Base64 puro: limpa espaços/quebras, corrige padding e envelopa em PEM
  let b64 = trimmed.replace(/\s+/g, '');
  while (b64.length % 4 !== 0) b64 += '=';
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`;
}

function readCaCerts(secretName, useEmbedded) {
  if (useEmbedded) return [ZIMBRA_CA_PEM];
  if (!secretName) return undefined;
  const caCert = Deno.env.get(secretName);
  if (!caCert) {
    throw new Error(`Secret de certificado ${secretName} não encontrado ou vazio.`);
  }
  return [normalizeToPem(caCert)];
}

function buildErrorHint(errorMessage) {
  if (/UnknownIssuer|invalid peer certificate|certificate/i.test(errorMessage)) {
    return 'Conexão TCP/STARTTLS chegou ao servidor, mas o certificado não é confiável para o Deno. Cadastre o certificado público/CA do Zimbra em um secret e envie ca_cert_secret_name no payload.';
  }

  if (/STARTTLS/i.test(errorMessage)) {
    return 'A porta respondeu, mas o upgrade STARTTLS falhou. Confirme se a porta suporta STARTTLS IMAP ou teste security=tls na porta 993.';
  }

  return 'Se o erro for timeout/conexão, o servidor IMAP pode estar bloqueando a origem externa. Se o erro for certificado, cadastre o PEM público/CA no secret e use ca_cert_secret_name.';
}

function parseHeaderBlocks(lines) {
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
  constructor(conn) {
    this.conn = conn;
    this.decoder = new TextDecoder();
    this.encoder = new TextEncoder();
    this.buffer = '';
    this.tagCounter = 1;
    this.transcript = [];
    this.greeting = '';
  }

  static async connect(options) {
    const { hostname, port, timeoutMs, security, caCerts } = options;

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
        Deno.startTls(plainConn, { hostname, caCerts }),
        timeoutMs,
        `Upgrade STARTTLS com ${hostname}:${port}`
      );
      imap.conn = tlsConn;
      imap.buffer = '';
      return imap;
    }

    const conn = await withTimeout(
      Deno.connectTls({ hostname, port, caCerts }),
      timeoutMs,
      `Conexão TLS IMAP com ${hostname}:${port}`
    );
    const imap = new ImapConnection(conn);
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

  async readLine(timeoutMs) {
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

  async readGreeting(timeoutMs) {
    const greeting = await this.readLine(timeoutMs);
    if (!greeting || !/^\*\s+OK\b/i.test(greeting)) {
      throw new Error(`Servidor não retornou greeting IMAP OK: ${greeting || 'sem resposta'}`);
    }
    return greeting;
  }

  async command(commandText, timeoutMs) {
    const tag = `A${String(this.tagCounter++).padStart(4, '0')}`;
    const fullCommand = `${tag} ${commandText}\r\n`;
    this.transcript.push(`> ${sanitizeLine(fullCommand.trim())}`);
    await withTimeout(
      this.conn.write(this.encoder.encode(fullCommand)),
      timeoutMs,
      'Envio do comando IMAP'
    );

    const lines = [];
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

  let imap = null;

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

    // Modo diagnóstico: inspeciona o que está salvo no secret da CA (sem expor conteúdo)
    if (body.diagnose_ca) {
      const name = String(body.ca_cert_secret_name || body.ca_secret_name || '').trim();
      const raw = name ? Deno.env.get(name) : undefined;
      if (!raw) {
        return jsonResponse({ diagnose_ca: true, secret_name: name, found: false });
      }
      const beginCount = (raw.match(/-----BEGIN CERTIFICATE-----/g) || []).length;
      const endCount = (raw.match(/-----END CERTIFICATE-----/g) || []).length;

      // Decodifica o base64 (sem headers/whitespace) e valida a estrutura DER
      let derInfo = { decoded: false };
      try {
        let b64 = raw.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
        while (b64.length % 4 !== 0) b64 += '=';
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        // DER de um certificado começa com 0x30 0x82 (SEQUENCE, long-form length 2 bytes)
        const seqOk = bytes[0] === 0x30 && bytes[1] === 0x82;
        const declaredLen = seqOk ? (bytes[2] << 8) + bytes[3] + 4 : null;
        derInfo = {
          decoded: true,
          byte_length: bytes.length,
          starts_with_30_82: seqOk,
          declared_total_length: declaredLen,
          length_matches: declaredLen === bytes.length,
          first_bytes_hex: Array.from(bytes.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ')
        };
      } catch (e) {
        derInfo = { decoded: false, error: e instanceof Error ? e.message : String(e) };
      }

      return jsonResponse({
        diagnose_ca: true,
        secret_name: name,
        found: true,
        length: raw.length,
        starts_with_full_header: raw.trimStart().startsWith('-----BEGIN CERTIFICATE-----'),
        begin_blocks: beginCount,
        end_blocks: endCount,
        contains_leaf_marker_MIIDSz: raw.includes('MIIDSz'),
        contains_ca_marker_MIIED: raw.includes('MIIED'),
        first_40: raw.slice(0, 40),
        last_40: raw.slice(-40),
        der: derInfo
      });
    }

    // Modo "por usuário": carrega a config do email_account do User e a senha do secret indicado
    if (body.user_id) {
      const users = await base44.asServiceRole.entities.User.filter({ id: String(body.user_id) });
      const alvo = users && users[0];
      if (!alvo) {
        return jsonResponse({ error: `Usuário ${body.user_id} não encontrado.` }, 404);
      }
      const ec = alvo.email_account || {};
      if (!ec.ativo) {
        return jsonResponse({ error: 'A conta de e-mail deste usuário está inativa. Ative em Comunicação > Conta de E-mail.' }, 400);
      }
      body.imap_host = body.imap_host || ec.imap_host;
      body.username = body.username || ec.login;
      body.imap_port = body.imap_port || ec.imap_port;
      body.security = body.security || ec.imap_security;
      body.password_secret_name = body.password_secret_name || ec.password_secret_name;
      // CA embutida automática para o Zimbra da Liesch
      if (body.use_embedded_ca === undefined && String(ec.imap_host || '').includes('liesch.com.br')) {
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
    const caCertSecretName = String(body.ca_cert_secret_name || body.ca_secret_name || '').trim();

    if (body.debug_ca) {
      const raw = caCertSecretName ? Deno.env.get(caCertSecretName) : null;
      const blocks = raw ? (raw.match(/-----BEGIN CERTIFICATE-----/g) || []).length : 0;
      return jsonResponse({
        debug_ca: true,
        ca_secret_name: caCertSecretName,
        found: Boolean(raw),
        length: raw ? raw.length : 0,
        certificate_blocks: blocks,
        first_line: raw ? raw.split('\n')[0] : null,
        last_line: raw ? raw.trim().split('\n').slice(-1)[0] : null,
        starts_ok: raw ? raw.trim().startsWith('-----BEGIN CERTIFICATE-----') : false,
        ends_ok: raw ? raw.trim().endsWith('-----END CERTIFICATE-----') : false
      });
    }

    const caCerts = readCaCerts(caCertSecretName, body.use_embedded_ca === true);

    const inlinePassword = typeof body.password === 'string' ? body.password : '';
    if (!host || !username || (!passwordSecretName && !inlinePassword)) {
      return jsonResponse({
        error: 'Parâmetros obrigatórios ausentes.',
        required: ['host', 'username', 'password_secret_name'],
        example: {
          host: 'mail.seudominio.com.br',
          port: 143,
          security: 'starttls',
          username: 'caixa@seudominio.com.br',
          password_secret_name: 'ZIMBRA_PWD_CAIXA_TESTE',
          ca_cert_secret_name: 'ZIMBRA_CA_CERT',
          mailbox: 'INBOX'
        }
      }, 400);
    }

    const password = inlinePassword || Deno.env.get(passwordSecretName);
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
      caCerts
    });
    const greeting = imap.greeting;

    await imap.command('CAPABILITY', timeoutMs);

    // Autenticação com fallback automático: tenta AUTHENTICATE PLAIN; se falhar,
    // reconecta e tenta o comando LOGIN clássico (alguns Zimbra recusam SASL-IR com BAD)
    const authMethod = String(body.auth_method || 'auto').toLowerCase();
    const saslPlain = btoa(`\u0000${username}\u0000${password}`);
    const tryPlain = async (c) => { await c.command(`AUTHENTICATE PLAIN ${saslPlain}`, timeoutMs); return 'AUTHENTICATE PLAIN'; };
    const tryLogin = async (c) => { await c.command(`LOGIN "${escapeImapString(username)}" "${escapeImapString(password)}"`, timeoutMs); return 'LOGIN'; };
    let authUsed = null;

    if (authMethod === 'login') {
      authUsed = await tryLogin(imap);
    } else if (authMethod === 'plain') {
      authUsed = await tryPlain(imap);
    } else {
      try {
        authUsed = await tryPlain(imap);
      } catch (plainErr) {
        try { imap.close(); } catch { /* ignore */ }
        imap = await ImapConnection.connect({ hostname: host, port, timeoutMs, security, caCerts });
        await imap.command('CAPABILITY', timeoutMs);
        try {
          authUsed = await tryLogin(imap);
        } catch (loginErr) {
          const pMsg = plainErr instanceof Error ? plainErr.message : String(plainErr);
          const lMsg = loginErr instanceof Error ? loginErr.message : String(loginErr);
          throw new Error(`Autenticação falhou nos dois métodos. AUTHENTICATE PLAIN: ${pMsg} | LOGIN: ${lMsg}`);
        }
      }
    }
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
    let previews = [];

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
      ca_cert_configured: Boolean(caCertSecretName),
      mailbox,
      username,
      auth_method_used: authUsed,
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