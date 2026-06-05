import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Cifra uma senha (AES-GCM) usando a chave-mestra EMAIL_ENCRYPTION_KEY.
// Mesmo formato de salvarSenhaEmailAccount: "iv_base64:ciphertext_base64".
async function encryptPassword(plain, masterKey) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.digest('SHA-256', enc.encode(masterKey));
  const key = await crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain));
  const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  return `${toB64(iv.buffer)}:${toB64(cipherBuf)}`;
}

// Mapa de senhas reais por email_address (Zimbra/IMAP).
const SENHAS = {
  'luiz@lieschnet.com.br': 'Li@3499430',
  'luiz@neuraltec360.com.br': 'Li@3499430',
  'compras@lieschnet.com.br': 'Li@3499430',
  'compras@neuraltec360.com.br': 'Li@3499430',
  'ricardo@lieschnet.com.br': 'l1Eschf09o',
  'ricardo@neuraltec360.com.br': 'l1Eschf09o',
  'paulo@lieschnet.com.br': 'Lieschadne20*',
  'paulo@neuraltec360.com.br': 'Lieschadne20*',
  'vendas1@lieschnet.com.br': '$@das01',
  'vendas1@neuraltec360.com.br': '$@das01',
  'vendas5@liesch.com.br': '$@das05',
  'vendas5@neuraltec360.com.br': '$@das05',
  'financeiro@liesch.com.br': '14071407*',
  'financeiro@neuraltec360.com.br': '14071407*',
  'telemarketing@liesch.com.br': 'M@#3e71',
  'telemarketing@neuraltec360.com.br': 'M@#3e71',
  'atendimento@liesch.com.br': 'Aten2025*',
  'distribuicao@liesch.com.br': 'Dist2025*',
  'portal@liesch.com.br': 'P0rTa12022*',
  'trabalheconosco@liesch.com.br': 'Trab2025*',
  'admin@liesch.com.br': 'l1Eschf09o'
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const masterKey = Deno.env.get('EMAIL_ENCRYPTION_KEY');
    if (!masterKey) return Response.json({ error: 'EMAIL_ENCRYPTION_KEY não configurada.' }, { status: 500 });

    const db = base44.asServiceRole.entities;
    const contas = await db.EmailAccount.list('', 200);

    const resultados = [];
    for (const conta of contas) {
      const email = String(conta.email_address || '').trim().toLowerCase();
      const senha = SENHAS[email];
      if (!senha) {
        resultados.push({ email, status: 'sem_senha_no_mapa' });
        continue;
      }
      const password_encrypted = await encryptPassword(senha, masterKey);
      await db.EmailAccount.update(conta.id, {
        password_encrypted,
        auth_type: 'password_encrypted',
        last_uid_seen: 0,
        last_error: null
      });
      resultados.push({ email, status: 'senha_gravada' });
    }

    const gravadas = resultados.filter(r => r.status === 'senha_gravada').length;
    return Response.json({ ok: true, total_contas: contas.length, gravadas, resultados });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});