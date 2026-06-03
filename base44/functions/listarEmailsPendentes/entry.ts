import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Lista EmailSincronizado com status_aprovacao="pendente".
// Regra de visibilidade:
// - admin: vê todos os pendentes.
// - usuário comum: vê só os pendentes das caixas (EmailAccount) onde ele está em assigned_user_ids.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const db = base44.asServiceRole.entities;

    const pendentes = await db.EmailSincronizado.filter(
      { status_aprovacao: 'pendente' },
      '-created_date',
      200
    );

    if (user.role === 'admin') {
      return Response.json({ ok: true, admin: true, pendentes: pendentes || [] });
    }

    // Caixas atribuídas a este usuário
    const contas = await db.EmailAccount.list('-created_date', 200);
    const minhasContas = (contas || []).filter((c) =>
      Array.isArray(c.assigned_user_ids) && c.assigned_user_ids.includes(user.id)
    );
    const meusLogins = new Set(minhasContas.map((c) => (c.email_address || '').toLowerCase()));

    const visiveis = (pendentes || []).filter((e) =>
      meusLogins.has((e.account_login || '').toLowerCase())
    );

    return Response.json({ ok: true, admin: false, pendentes: visiveis });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});