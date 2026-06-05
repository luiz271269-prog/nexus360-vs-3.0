import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Apaga DE VERDADE mensagens no servidor Zimbra (IMAP) por UID.
// Marca \Deleted e faz EXPUNGE. Usado para remover lixo eletrônico de remetentes bloqueados.
// Payload: { email_account_id? , email_address? , uids: number[] | string[] }
//   - Aceita chamada interna confiável via internal_secret = BASE44_APP_ID
//   - Ou usuário admin autenticado

const DEFAULT_TIMEOUT_MS = 20000;

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
    const body = await req.json().catch(() => ({}));

    const appId = Deno.env.get('BASE44_APP_ID');
    const chamadaInterna = !!body.internal_secret && body.internal_secret === appId;

    if (!chamadaInterna) {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const uids = (Array.isArray(body.uids) ? body.uids : [])
      .map((u) => Number(u))
      .filter(Number.isFinite);
    if (uids.length === 0) {
      return Response.json({ error: 'Informe uids (lista de UIDs IMAP a apagar).' }, { status: 400 });
    }

    const db = base44.asServiceRole.entities;

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
    const timeoutMs = DEFAULT_TIMEOUT_MS;

    let password = '';
    if (conta.password_encrypted) {
      const masterKey = Deno.env.get('EMAIL_ENCRYPTION_KEY');
      if (!masterKey) return Response.json({ error: 'EMAIL_ENCRYPTION_KEY não configurada no app.' }, { status: 500 });
      password = await decryptPassword(conta.password_encrypted, masterKey);
    }
    if (!password && conta.password_secret_name) {
      password = Deno.env.get(conta.password_secret_name);
    }
    if (!password) {
      return Response.json({ error: 'Senha indisponível. Cadastre a senha da caixa na tela (será cifrada no banco).' }, { status: 400 });
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

    // SELECT (read-write) para permitir STORE/EXPUNGE
    await imap.command(`SELECT "${escapeImapString(mailbox)}"`, timeoutMs);

    // Marca \Deleted nos UIDs alvo e expurga de verdade
    const uidSet = uids.join(',');
    await imap.command(`UID STORE ${uidSet} +FLAGS (\\Deleted)`, timeoutMs);
    await imap.command(`UID EXPUNGE ${uidSet}`, timeoutMs).catch(async () => {
      // Servidores sem suporte a UID EXPUNGE: usa EXPUNGE geral (só apaga os marcados acima)
      await imap.command('EXPUNGE', timeoutMs);
    });

    await imap.command('LOGOUT', timeoutMs).catch(() => []);

    return Response.json({ ok: true, conta: username, apagados: uids.length, uids });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  } finally {
    if (imap) imap.close();
  }
});