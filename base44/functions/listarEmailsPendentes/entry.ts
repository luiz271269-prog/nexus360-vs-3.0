import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

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

    // Enriquecer cada e-mail com o tipo_contato do remetente (lookup no CRM por e-mail)
    // Otimizado: 1 única query com $in (evita 429 por excesso de chamadas)
    const enriquecer = async (lista) => {
      const emails = [...new Set((lista || []).map((e) => (e.remetente_email || '').toLowerCase()).filter(Boolean))];
      const mapaTipo = {};
      if (emails.length > 0) {
        const contatos = await db.Contact.filter({ email: { $in: emails } }, '-created_date', 500).catch(() => []);
        for (const c of (contatos || [])) {
          const em = (c.email || '').toLowerCase();
          if (em && !mapaTipo[em]) mapaTipo[em] = c.tipo_contato || 'novo';
        }
      }
      return (lista || []).map((e) => ({
        ...e,
        tipo_contato_remetente: mapaTipo[(e.remetente_email || '').toLowerCase()] || 'desconhecido',
      }));
    };

    if (user.role === 'admin') {
      const enriquecidos = await enriquecer(pendentes);
      return Response.json({ ok: true, admin: true, pendentes: enriquecidos });
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

    const enriquecidos = await enriquecer(visiveis);
    return Response.json({ ok: true, admin: false, pendentes: enriquecidos });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});