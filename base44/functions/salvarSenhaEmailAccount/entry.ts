import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// Cifra uma senha (AES-GCM) usando a chave-mestra EMAIL_ENCRYPTION_KEY.
// Retorna string "iv_base64:ciphertext_base64".
async function encryptPassword(plain, masterKey) {
  const enc = new TextEncoder();
  // Deriva uma chave AES-256 estável a partir da frase-mestra (SHA-256)
  const keyMaterial = await crypto.subtle.digest('SHA-256', enc.encode(masterKey));
  const key = await crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain));
  const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  return `${toB64(iv.buffer)}:${toB64(cipherBuf)}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const emailAccountId = String(body.email_account_id || '').trim();
    const password = typeof body.password === 'string' ? body.password : '';

    if (!emailAccountId) return Response.json({ error: 'email_account_id é obrigatório.' }, { status: 400 });
    if (!password) return Response.json({ error: 'password é obrigatório.' }, { status: 400 });

    const masterKey = Deno.env.get('EMAIL_ENCRYPTION_KEY');
    if (!masterKey) return Response.json({ error: 'EMAIL_ENCRYPTION_KEY não configurada no app.' }, { status: 500 });

    const db = base44.asServiceRole.entities;
    const conta = await db.EmailAccount.get(emailAccountId).catch(() => null);
    if (!conta) return Response.json({ error: 'EmailAccount não encontrado.' }, { status: 404 });

    const password_encrypted = await encryptPassword(password, masterKey);

    await db.EmailAccount.update(emailAccountId, {
      password_encrypted,
      auth_type: 'password_encrypted'
    });

    return Response.json({ ok: true, email_account_id: emailAccountId, saved: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});