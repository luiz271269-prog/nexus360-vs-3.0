import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DEFAULT_IMAP_PORT = 993;
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_PREVIEW_MESSAGES = 5;

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
  }

  static async connect(hostname, port, timeoutMs) {
    const conn = await withTimeout(
      Deno.connectTls({ hostname, port }),
      timeoutMs,
      `Conexão TLS IMAP com ${hostname}:${port}`
    );
    return new ImapConnection(conn);
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
    const host = String(body.host || body.imap_host || '').trim();
    const username = String(body.username || body.email || '').trim();
    const passwordSecretName = String(body.password_secret_name || body.secret_name || '').trim();
    const port = Number(body.port || body.imap_port || DEFAULT_IMAP_PORT);
    const timeoutMs = Number(body.timeout_ms || DEFAULT_TIMEOUT_MS);
    const mailbox = String(body.mailbox || 'INBOX').trim() || 'INBOX';
    const maxMessages = Math.min(Number(body.max_messages || MAX_PREVIEW_MESSAGES), MAX_PREVIEW_MESSAGES);

    if (!host || !username || !passwordSecretName) {
      return jsonResponse({
        error: 'Parâmetros obrigatórios ausentes.',
        required: ['host', 'username', 'password_secret_name'],
        example: {
          host: 'mail.seudominio.com.br',
          port: 993,
          username: 'caixa@seudominio.com.br',
          password_secret_name: 'ZIMBRA_PWD_CAIXA_TESTE',
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
    imap = await ImapConnection.connect(host, port, timeoutMs);
    const greeting = await imap.readGreeting(timeoutMs);

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
      hint: 'Se o erro for timeout/conexão, o runtime pode estar bloqueando TCP/993 ou o servidor Zimbra pode estar bloqueando origem externa. Nesse caso, use relé externo + webhook Base44.',
      transcript_preview: imap?.transcript.slice(-40) || []
    }, 500);
  } finally {
    if (imap) imap.close();
  }
});