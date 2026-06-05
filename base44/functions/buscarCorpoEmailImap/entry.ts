import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DEFAULT_TIMEOUT_MS = 20000;

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

async function decryptPassword(encrypted, masterKey) {
  const [ivB64, cipherB64] = String(encrypted).split(':');
  if (!ivB64 || !cipherB64) throw new Error('Formato de senha cifrada inválido.');
  const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.digest('SHA-256', enc.encode(masterKey));
  const key = await crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, ['decrypt']);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(ivB64) }, key, fromB64(cipherB64));
  return new TextDecoder().decode(plainBuf);
}

// Decodifica quoted-printable
function decodeQuotedPrintable(str) {
  return String(str)
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// Decodifica base64 para texto UTF-8
function decodeBase64Utf8(str) {
  try {
    const clean = String(str).replace(/\s+/g, '');
    const bin = atob(clean);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return String(str);
  }
}

// Remove tags HTML, converte entidades comuns e limpa o texto
function htmlParaTexto(html) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Extrai o corpo legível a partir do BODY[TEXT] bruto (com headers MIME embutidos)
function extrairCorpoLegivel(raw) {
  const texto = String(raw || '');

  // Detecta boundary multipart
  const boundaryMatch = texto.match(/boundary="?([^"\r\n;]+)"?/i);
  let partes = [texto];
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    partes = texto.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'));
  }

  let plainText = '';
  let htmlText = '';

  for (const parte of partes) {
    const lower = parte.toLowerCase();
    const sepIdx = parte.search(/\r?\n\r?\n/);
    if (sepIdx === -1) continue;
    let conteudo = parte.slice(sepIdx).trim();

    const isBase64 = /content-transfer-encoding:\s*base64/i.test(parte);
    const isQP = /content-transfer-encoding:\s*quoted-printable/i.test(parte);

    if (isBase64) conteudo = decodeBase64Utf8(conteudo);
    else if (isQP) conteudo = decodeQuotedPrintable(conteudo);

    if (/content-type:\s*text\/plain/i.test(lower) && !plainText) {
      plainText = conteudo;
    } else if (/content-type:\s*text\/html/i.test(lower) && !htmlText) {
      htmlText = htmlParaTexto(conteudo);
    } else if (!boundaryMatch && !plainText) {
      // Sem multipart: usa o conteúdo direto (pode ser HTML ou texto)
      plainText = /<html|<body|<div|<table/i.test(conteudo) ? htmlParaTexto(conteudo) : conteudo;
    }
  }

  const resultado = (plainText || htmlText || htmlParaTexto(texto)).trim();
  return resultado;
}

function parseFetchBodyText(lines) {
  // Junta todas as linhas e extrai o conteúdo entre o {N} literal e o fechamento
  const full = lines.join('\r\n');
  // Caso literal {N}: o servidor envia o tamanho e depois o conteúdo
  const litMatch = full.match(/BODY\[TEXT\]\s*\{(\d+)\}\r?\n/i);
  if (litMatch) {
    const start = full.indexOf(litMatch[0]) + litMatch[0].length;
    const len = Number(litMatch[1]);
    return full.slice(start, start + len);
  }
  // Caso quoted: BODY[TEXT] "..." (raro)
  const lineIdx = lines.findIndex((l) => /BODY\[TEXT\]/i.test(l));
  if (lineIdx !== -1) {
    return lines.slice(lineIdx + 1).filter((l) => !/^\)$/.test(l) && !/^A\d+\s+OK/i.test(l)).join('\n');
  }
  return '';
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
      const chunk = new Uint8Array(8192);
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
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const emailId = String(body.email_id || '').trim();
    if (!emailId) return Response.json({ error: 'email_id obrigatório' }, { status: 400 });

    const db = base44.asServiceRole.entities;

    const email = await db.EmailSincronizado.get(emailId).catch(() => null);
    if (!email) return Response.json({ error: 'E-mail não encontrado' }, { status: 404 });

    // Se já temos um corpo salvo, retorna direto (cache)
    if (email.corpo_preview && email.corpo_preview.trim().length > 0) {
      return Response.json({ ok: true, corpo: email.corpo_preview, cached: true });
    }

    // Resolve a conta da caixa
    const contas = await db.EmailAccount.filter(
      { email_address: String(email.account_login).toLowerCase().trim() },
      '-created_date',
      1
    );
    const conta = contas && contas[0];
    if (!conta) return Response.json({ error: 'Conta de e-mail não encontrada' }, { status: 404 });

    const host = conta.imap_host;
    const username = conta.email_address;
    const port = Number(conta.imap_port || 993);
    const security = String(conta.imap_security || (port === 143 ? 'starttls' : 'tls')).toLowerCase();
    const mailbox = conta.imap_mailbox || 'INBOX';
    const timeoutMs = DEFAULT_TIMEOUT_MS;

    let password = '';
    if (conta.password_encrypted) {
      const masterKey = Deno.env.get('EMAIL_ENCRYPTION_KEY');
      if (!masterKey) return Response.json({ error: 'EMAIL_ENCRYPTION_KEY não configurada.' }, { status: 500 });
      password = await decryptPassword(conta.password_encrypted, masterKey);
    } else if (conta.password_secret_name) {
      password = Deno.env.get(conta.password_secret_name);
    }
    if (!password) return Response.json({ error: 'Senha da caixa indisponível.' }, { status: 400 });

    const dominiosZimbraLiesch = ['liesch.com.br', 'lieschnet.com.br', 'neuraltec360.com.br'];
    const useEmbeddedCa = dominiosZimbraLiesch.some((d) => String(host || '').includes(d));
    const caCerts = useEmbeddedCa ? [ZIMBRA_CA_PEM] : undefined;
    const connectHost = useEmbeddedCa ? 'mail.liesch.com.br' : host;

    imap = await ImapConnection.connect({ hostname: connectHost, port, timeoutMs, security, caCerts });
    await imap.command('CAPABILITY', timeoutMs);

    const saslPlain = btoa(`\u0000${username}\u0000${password}`);
    try {
      await imap.command(`AUTHENTICATE PLAIN ${saslPlain}`, timeoutMs);
    } catch {
      try { imap.close(); } catch { /* ignore */ }
      imap = await ImapConnection.connect({ hostname: connectHost, port, timeoutMs, security, caCerts });
      await imap.command('CAPABILITY', timeoutMs);
      await imap.command(`LOGIN "${escapeImapString(username)}" "${escapeImapString(password)}"`, timeoutMs);
    }

    await imap.command(`SELECT "${escapeImapString(mailbox)}"`, timeoutMs);

    const fetchLines = await imap.command(
      `UID FETCH ${Number(email.message_uid)} (BODY.PEEK[TEXT])`,
      timeoutMs
    );

    await imap.command('LOGOUT', timeoutMs).catch(() => []);

    const rawBody = parseFetchBodyText(fetchLines);
    let corpo = extrairCorpoLegivel(rawBody);
    if (!corpo) corpo = '(Não foi possível extrair o conteúdo deste e-mail.)';

    // Cache: salva no banco para próximas aberturas
    const corpoSalvar = corpo.slice(0, 20000);
    await db.EmailSincronizado.update(emailId, { corpo_preview: corpoSalvar }).catch(() => {});

    return Response.json({ ok: true, corpo: corpoSalvar, cached: false });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  } finally {
    if (imap) imap.close();
  }
});